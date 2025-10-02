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
     $subjectBase = 'RSVP Response Received - ' . strtoupper($updated['rsvp_response']);
       $guestNameTrim = isset($updated['guest_name']) ? trim($updated['guest_name']) : '';
       if ($guestNameTrim !== '') {
           $subject = $subjectBase . ' - Guest(s) ' . $guestNameTrim;
       } else {
           $subject = $subjectBase . ' - Invite Code ' . $updated['code'];
       }
    $guestNameForEmail = $updated['guest_name'] ?? '';
    if ($guestNameForEmail === '' || $guestNameForEmail === null) {
        $guestNameForEmail = ($name !== null && $name !== '') ? $name : '(unknown)';
    }
    $bodyLines = [
        'An RSVP response was recorded:',
        '',
        'Code: ' . $updated['code'],
        'Name: ' . $guestNameForEmail,
        'Response: ' . $updated['rsvp_response'],
        'Party size: ' . ((isset($updated['party_size']) && $updated['party_size'] !== null) ? $updated['party_size'] : 'n/a'),
        'RSVPed at: ' . $updated['rsvped_at'],
        'Updated at: ' . $updated['updated_at'],
        '',
        'IP: ' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown'),
        'User-Agent: ' . ($_SERVER['HTTP_USER_AGENT'] ?? 'unknown'),
        'Time: ' . date('c'),
    ];
    $body = implode("\n", $bodyLines);
    $headers = 'From: ' . $fromEmail . "\r\n" .
               'Reply-To: ' . $fromEmail . "\r\n" .
               'Content-Type: text/plain; charset=UTF-8';

    $emailSent = false;
    try {
        $emailSent = @mail($to, $subject, $body, $headers);
    } catch (Throwable $mailErr) {
        // Swallow any mail-related errors to ensure 200 response
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
