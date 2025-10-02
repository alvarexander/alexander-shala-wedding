<?php
// Simple RSVP endpoint
// Usage examples:
//   - Record a YES: /rsvp.php?id=A007&response=yes
//   - Record a NO:  /rsvp.php?id=A007&response=no
//   - Check status: /rsvp.php?id=A007
//
// Database credentials via environment variables (recommended), with fallbacks:
//   DB_HOST (default: 127.0.0.1)
//   DB_NAME (default: wedding)
//   DB_USER (default: root)
//   DB_PASS (default: empty)
//
// Import schema and seed data from public/rsvp.sql before using this endpoint.

header('Content-Type: application/json');

function respond($statusCode, $payload) {
    http_response_code($statusCode);
    echo json_encode($payload, JSON_PRETTY_PRINT);
    exit;
}

$code = isset($_GET['id']) ? trim($_GET['id']) : '';
$response = isset($_GET['response']) ? strtolower(trim($_GET['response'])) : null;
$name = isset($_GET['name']) ? trim($_GET['name']) : null;
if ($name !== null && $name !== '') {
    if (strlen($name) > 400) {
        $name = substr($name, 0, 400);
    }
    // Normalize name to avoid control characters in email body/logs
    $name = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $name);
}

if ($code === '') {
    respond(400, [
        'ok' => false,
        'error' => 'Missing required query parameter: id',
        'usage' => [
            'yes' => '/rsvp.php?id=A007&response=yes',
            'no'  => '/rsvp.php?id=A007&response=no',
            'check' => '/rsvp.php?id=A007'
        ]
    ]);
}

if ($response !== null && !in_array($response, ['yes', 'no'], true)) {
    respond(400, [
        'ok' => false,
        'error' => "Invalid response. Must be 'yes' or 'no'",
    ]);
}

$host = getenv('DB_HOST') ?: '127.0.0.1';
$db   = getenv('DB_NAME') ?: 'wedding';
$user = getenv('DB_USER') ?: 'root';
$pass = getenv('DB_PASS') ?: '';
$dsn = "mysql:host={$host};dbname={$db};charset=utf8mb4";

try {
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (PDOException $e) {
    respond(500, [
        'ok' => false,
        'error' => 'Database connection failed',
        'details' => $e->getMessage(),
    ]);
}

// Normalize the code to uppercase to avoid case-sensitivity issues
$codeNorm = strtoupper($code);
// Strict validation for code to guard against injection/malformed input
if (!preg_match('/^[A-Z0-9_-]{1,32}$/', $codeNorm)) {
    respond(400, [
        'ok' => false,
        'error' => 'Invalid id format. Use 1-32 characters: letters, numbers, underscore, or hyphen.'
    ]);
}

// Ensure code exists
$stmt = $pdo->prepare('SELECT id, code, guest_name, party_size, rsvp_response, rsvped_at, updated_at FROM rsvp_codes WHERE code = ?');
$stmt->execute([$codeNorm]);
$row = $stmt->fetch();

if (!$row) {
    respond(404, [
        'ok' => false,
        'error' => 'RSVP code not found',
        'code' => $codeNorm,
    ]);
}

if ($response === null) {
    // Just return current status (include name and party size for convenience)
    respond(200, [
        'ok' => true,
        'code' => $row['code'],
        'guest_name' => $row['guest_name'],
        'party_size' => $row['party_size'],
        'rsvp_response' => $row['rsvp_response'],
        'rsvped_at' => $row['rsvped_at'],
        'updated_at' => $row['updated_at'],
        'message' => 'No response given; returning current status.'
    ]);
}

// Update RSVP response
try {
    $pdo->beginTransaction();

    // Update RSVP, and if a name is provided, store it as guest_name
    if ($name !== null && $name !== '') {
        $update = $pdo->prepare('UPDATE rsvp_codes SET rsvp_response = ?, guest_name = ?, rsvped_at = IFNULL(rsvped_at, NOW()), updated_at = NOW() WHERE code = ?');
        $update->execute([$response, $name, $codeNorm]);
    } else {
        $update = $pdo->prepare('UPDATE rsvp_codes SET rsvp_response = ?, rsvped_at = IFNULL(rsvped_at, NOW()), updated_at = NOW() WHERE code = ?');
        $update->execute([$response, $codeNorm]);
    }

    $check = $pdo->prepare('SELECT id, code, guest_name, party_size, rsvp_response, rsvped_at, updated_at FROM rsvp_codes WHERE code = ?');
    $check->execute([$codeNorm]);
    $updated = $check->fetch();

    $pdo->commit();

    // Send notification email (non-fatal on failure)
    $to = getenv('RSVP_NOTIFY_EMAIL') ?: 'shalatolbert656@gmail.com';
    $fromEmail = getenv('RSVP_FROM_EMAIL') ?: ('no-reply@' . (isset($_SERVER['SERVER_NAME']) ? $_SERVER['SERVER_NAME'] : 'localhost'));
    // validate/sanitize From address
    $fromEmail = filter_var($fromEmail, FILTER_VALIDATE_EMAIL) ? $fromEmail : 'no-reply@localhost';

    $subjectBase = 'RSVP Response Received - ' . strtoupper($updated['rsvp_response']);
    // Sanitize guest name from DB to avoid header injection
    $guestNameTrim = isset($updated['guest_name']) ? trim($updated['guest_name']) : '';
    if ($guestNameTrim !== '') {
        $guestNameTrim = preg_replace('/[\x00-\x1F\x7F]/', '', $guestNameTrim);
        $guestNameTrim = preg_replace("/[\r\n]+/", ' ', $guestNameTrim);
    }
    if ($guestNameTrim !== '') {
        $subject = $subjectBase . ' - Guest(s) ' . $guestNameTrim;
    } else {
        $subject = $subjectBase . ' - Invite Code ' . $updated['code'];
    }
    // Sanitize subject for safety
    $subject = preg_replace('/[\x00-\x1F\x7F]/', '', $subject);
    $subject = preg_replace("/[\r\n]+/", ' ', $subject);

    $guestNameForEmail = $updated['guest_name'] ?? '';
    if ($guestNameForEmail === '' || $guestNameForEmail === null) {
        $guestNameForEmail = ($name !== null && $name !== '') ? $name : '(unknown)';
    }
    // Build a styled HTML email body (card) using Arial
    $partyDisplay = (isset($updated['party_size']) && $updated['party_size'] !== null) ? $updated['party_size'] : 'n/a';
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $ua = $_SERVER['HTTP_USER_AGENT'] ?? 'unknown';
    $timeIso = date('c');

    $codeEsc = htmlspecialchars($updated['code'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $nameEsc = htmlspecialchars($guestNameForEmail, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $respEsc = htmlspecialchars($updated['rsvp_response'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $partyEsc = htmlspecialchars((string)$partyDisplay, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $rsvpedEsc = htmlspecialchars((string)$updated['rsvped_at'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $updatedEsc = htmlspecialchars((string)$updated['updated_at'], ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $ipEsc = htmlspecialchars($ip, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $uaEsc = htmlspecialchars($ua, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $timeEsc = htmlspecialchars($timeIso, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

    $body = '<!doctype html>' .
        '<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' .
        '<title>RSVP Response</title></head>' .
        '<body style="margin:0;background:#f5f6f8;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">' .
        '  <div style="max-width:640px;margin:0 auto;">' .
        '    <div style="background:#ffffff;border-radius:12px;box-shadow:0 2px 10px rgba(0,0,0,0.08);overflow:hidden;border:1px solid #e5e7eb;">' .
        '      <div style="padding:20px 24px;border-bottom:1px solid #f1f5f9;background:#fafafa;">' .
        '        <h2 style="margin:0;font-size:20px;line-height:28px;font-weight:700;font-family:Arial,Helvetica,sans-serif;color:#111827;">RSVP Response Recorded</h2>' .
        '        <p style="margin:6px 0 0 0;font-size:14px;color:#6b7280;">A new RSVP update has been received.</p>' .
        '      </div>' .
        '      <div style="padding:20px 24px;">' .
        '        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;font-size:14px;">' .
        '          <tr><td style="padding:8px 0;width:160px;color:#6b7280;">Code</td><td style="padding:8px 0;color:#111827;"><strong>' . $codeEsc . '</strong></td></tr>' .
        '          <tr><td style="padding:8px 0;width:160px;color:#6b7280;">Name</td><td style="padding:8px 0;color:#111827;">' . $nameEsc . '</td></tr>' .
        '          <tr><td style="padding:8px 0;width:160px;color:#6b7280;">Response</td><td style="padding:8px 0;color:#111827;">' . strtoupper($respEsc) . '</td></tr>' .
        '          <tr><td style="padding:8px 0;width:160px;color:#6b7280;">Party size</td><td style="padding:8px 0;color:#111827;">' . $partyEsc . '</td></tr>' .
        '          <tr><td style="padding:8px 0;width:160px;color:#6b7280;">RSVPed at</td><td style="padding:8px 0;color:#111827;">' . $rsvpedEsc . '</td></tr>' .
        '          <tr><td style="padding:8px 0;width:160px;color:#6b7280;">Updated at</td><td style="padding:8px 0;color:#111827;">' . $updatedEsc . '</td></tr>' .
        '        </table>' .
        '      </div>' .
        '      <div style="padding:16px 24px;border-top:1px solid #f1f5f9;background:#fafafa;">' .
        '        <p style="margin:0 0 6px 0;font-size:12px;color:#6b7280;">IP: ' . $ipEsc . '</p>' .
        '        <p style="margin:0 0 6px 0;font-size:12px;color:#6b7280;">User-Agent: ' . $uaEsc . '</p>' .
        '        <p style="margin:0;font-size:12px;color:#6b7280;">Time: ' . $timeEsc . '</p>' .
        '      </div>' .
        '    </div>' .
        '    <p style="text-align:center;margin:16px 0 0 0;font-size:12px;color:#9ca3af;font-family:Arial,Helvetica,sans-serif;">This is an automated message. Please do not reply.</p>' .
        '  </div>' .
        '</body></html>';

    $headers = 'MIME-Version: 1.0' . "\r\n" .
               'From: ' . $fromEmail . "\r\n" .
               'Reply-To: ' . $fromEmail . "\r\n" .
               'Content-Type: text/html; charset=UTF-8' . "\r\n" .
               'Content-Transfer-Encoding: 8bit';

    // Optional envelope sender for better deliverability
    $envelopeFrom = getenv('RSVP_ENVELOPE_FROM');
    if (!filter_var($envelopeFrom, FILTER_VALIDATE_EMAIL)) {
        $envelopeFrom = $fromEmail;
    }
    $extraParams = '';
    if (filter_var($envelopeFrom, FILTER_VALIDATE_EMAIL)) {
        $extraParams = '-f' . $envelopeFrom;
    }

    $emailSent = false;
    $emailErrors = [];
    try {
        if ($extraParams !== '') {
            $emailSent = @mail($to, $subject, $body, $headers, $extraParams);
        } else {
            $emailSent = @mail($to, $subject, $body, $headers);
        }
        if (!$emailSent) {
            $lastErr = function_exists('error_get_last') ? error_get_last() : null;
            @error_log('RSVP mail() failed for code ' . $codeNorm . ' to ' . $to . ' with subject: ' . $subject . ($lastErr ? (' | last_error: ' . json_encode($lastErr)) : ''));
            $errMsg = 'mail() returned false';
            if ($lastErr && isset($lastErr['message'])) { $errMsg .= ' | ' . $lastErr['message']; }
            $emailErrors[] = $errMsg;
            // Fallback: SendGrid Web API if configured
            $sgApiKey = getenv('SENDGRID_API_KEY');
            if ($sgApiKey) {
                $sgFrom = getenv('SENDGRID_FROM_EMAIL');
                if (!filter_var($sgFrom, FILTER_VALIDATE_EMAIL)) {
                    $sgFrom = $fromEmail;
                }
                $recipients = array_map('trim', explode(',', $to));
                $toArray = [];
                foreach ($recipients as $rcpt) {
                    if ($rcpt !== '' && filter_var($rcpt, FILTER_VALIDATE_EMAIL)) {
                        $toArray[] = ['email' => $rcpt];
                    }
                }
                if (!empty($toArray)) {
                    $sgPayload = [
                        'personalizations' => [
                            ['to' => $toArray]
                        ],
                        'from' => ['email' => $sgFrom],
                        'subject' => $subject,
                        'content' => [
                            ['type' => 'text/html', 'value' => $body]
                        ]
                    ];
                    $ch = @curl_init('https://api.sendgrid.com/v3/mail/send');
                    if ($ch !== false) {
                        @curl_setopt($ch, CURLOPT_POST, true);
                        @curl_setopt($ch, CURLOPT_HTTPHEADER, [
                            'Authorization: Bearer ' . $sgApiKey,
                            'Content-Type: application/json'
                        ]);
                        @curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($sgPayload));
                        @curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                        @curl_setopt($ch, CURLOPT_TIMEOUT, 10);
                        $sgRespBody = @curl_exec($ch);
                        $sgHttpCode = @curl_getinfo($ch, CURLINFO_HTTP_CODE);
                        if ($sgRespBody === false) {
                            $sgErr = @curl_error($ch);
                            @error_log('RSVP SendGrid curl error for code ' . $codeNorm . ': ' . $sgErr);
                            $emailErrors[] = 'SendGrid curl error: ' . $sgErr;
                        }
                        @curl_close($ch);
                        if ($sgHttpCode >= 200 && $sgHttpCode < 300) {
                            // SendGrid returns 202 on success
                            $emailSent = true;
                        } else {
                            @error_log('RSVP SendGrid send failed for code ' . $codeNorm . ' http=' . $sgHttpCode . ' resp=' . $sgRespBody);
                            $emailErrors[] = 'SendGrid send failed http=' . $sgHttpCode . ' resp=' . $sgRespBody;
                        }
                    } else {
                        @error_log('RSVP SendGrid curl_init failed');
                        $emailErrors[] = 'SendGrid curl_init failed';
                    }
                } else {
                    @error_log('RSVP SendGrid: no valid recipients parsed from: ' . $to);
                    $emailErrors[] = 'SendGrid: no valid recipients parsed from: ' . $to;
                }
            } else {
                $emailErrors[] = 'SendGrid fallback not configured (SENDGRID_API_KEY not set)';
            }
        }
    } catch (Throwable $mailErr) {
        // Swallow any mail-related errors to ensure 200 response
        @error_log('RSVP mail exception for code ' . $codeNorm . ': ' . $mailErr->getMessage());
        $emailErrors[] = 'mail exception: ' . $mailErr->getMessage();
        $emailSent = false;
    }

    // Also provide a simple human-friendly HTML response if Accept header prefers text/html
    $accept = isset($_SERVER['HTTP_ACCEPT']) ? $_SERVER['HTTP_ACCEPT'] : '';
    if (stripos($accept, 'text/html') !== false) {
        header('Content-Type: text/html; charset=utf-8');
        echo '<!doctype html><html><head><meta charset="utf-8"><title>RSVP Updated</title></head><body>';
        echo '<h1>Thank you!</h1>';
        echo '<p>RSVP for code <strong>' . htmlspecialchars($updated['code']) . '</strong> recorded as <strong>' . htmlspecialchars($updated['rsvp_response']) . '</strong>.</p>';
        echo '</body></html>';
        exit;
    }

    respond(200, [
        'ok' => true,
        'message' => 'RSVP updated',
        'code' => $updated['code'],
        'guest_name' => $updated['guest_name'],
        'rsvp_response' => $updated['rsvp_response'],
        'rsvped_at' => $updated['rsvped_at'],
        'updated_at' => $updated['updated_at'],
        'email_sent' => (bool)$emailSent,
        'email_errors' => $emailErrors,
    ]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    respond(500, [
        'ok' => false,
        'error' => 'Failed to update RSVP',
        'details' => $e->getMessage(),
    ]);
}
