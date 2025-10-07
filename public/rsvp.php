<?php
header("Content-Type: application/json");

function respond($statusCode, $payload)
{
    http_response_code($statusCode);
    echo json_encode($payload, JSON_PRETTY_PRINT);
    exit();
}

$code = isset($_GET["id"]) ? trim($_GET["id"]) : "";
$response = isset($_GET["response"])
    ? strtolower(trim($_GET["response"]))
    : null;

// Optional: accept guest_names as a JSON-encoded array of strings
$guestNamesParam = isset($_GET["guest_names"]) ? $_GET["guest_names"] : null;
$guestNamesArr = [];
if ($guestNamesParam !== null && $guestNamesParam !== "") {
    $decoded = json_decode($guestNamesParam, true);
    if (is_array($decoded)) {
        foreach ($decoded as $nm) {
            if (!is_string($nm)) { continue; }
            $nm = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', "", trim($nm));
            if ($nm === '') { continue; }
            if (strlen($nm) > 400) { $nm = substr($nm, 0, 400); }
            $guestNamesArr[] = $nm;
            if (count($guestNamesArr) >= 10) { break; } // sanity limit
        }
    }
}

// Optional: accept attending_guest_names as a JSON-encoded array of strings
$attendingNamesParam = array_key_exists("attending_guest_names", $_GET) ? $_GET["attending_guest_names"] : null;
$attendingGuestNamesArr = [];
$attendingProvided = array_key_exists("attending_guest_names", $_GET);
if ($attendingNamesParam !== null && $attendingNamesParam !== "") {
    $decodedA = json_decode($attendingNamesParam, true);
    if (is_array($decodedA)) {
        foreach ($decodedA as $nm) {
            if (!is_string($nm)) { continue; }
            $nm = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', "", trim($nm));
            if ($nm === '') { continue; }
            if (strlen($nm) > 400) { $nm = substr($nm, 0, 400); }
            $attendingGuestNamesArr[] = $nm;
            if (count($attendingGuestNamesArr) >= 10) { break; } // sanity limit
        }
    }
}

if ($code === "") {
    respond(400, [
        "ok" => false,
        "error" => "Missing required query parameter: id",
        "usage" => [
            "yes" => "/rsvp.php?id=123e4567-e89b-12d3-a456-426614174000&response=yes",
            "yes_with_guest_names_json" => "/rsvp.php?id=123e4567-e89b-12d3-a456-426614174000&response=yes&guest_names=%5B%22Alice%22%2C%22Bob%22%5D",
            "no" => "/rsvp.php?id=123e4567-e89b-12d3-a456-426614174000&response=no",
            "check" => "/rsvp.php?id=123e4567-e89b-12d3-a456-426614174000",
        ],
    ]);
}

if ($response !== null && !in_array($response, ["yes", "no"], true)) {
    respond(400, [
        "ok" => false,
        "error" => "Invalid response. Must be 'yes' or 'no'",
    ]);
}

$host = getenv("DB_HOST") ?: "127.0.0.1";
$db = getenv("DB_NAME") ?: "wedding";
$user = getenv("DB_USER") ?: "root";
$pass = getenv("DB_PASS") ?: "";
$dsn = "mysql:host={$host};dbname={$db};charset=utf8mb4";

try {
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (PDOException $e) {
    respond(500, [
        "ok" => false,
        "error" => "Database connection failed",
        "details" => $e->getMessage(),
    ]);
}

// Normalize the code to uppercase to avoid case-sensitivity issues
$codeNorm = strtoupper($code);
// Strict validation for code to guard against injection/malformed input
if (!preg_match('/^[A-Z0-9_-]{1,36}$/', $codeNorm)) {
    respond(400, [
        "ok" => false,
        "error" =>
            "Invalid id format. Use 1-36 characters: letters, numbers, underscore, or hyphen.",
    ]);
}

// Ensure code exists
$stmt = $pdo->prepare(
    "SELECT rc.id, rc.code, rc.guest_names, rc.attending_guest_names, rc.party_size, rs.code AS rsvp_response, rc.rsvped_at, rc.updated_at FROM rsvp_codes rc JOIN rsvp_statuses rs ON rs.id = rc.status_id WHERE rc.code = ?"
);
$stmt->execute([$codeNorm]);
$row = $stmt->fetch();

if (!$row) {
    respond(404, [
        "ok" => false,
        "error" => "RSVP code not found",
        "code" => $codeNorm,
    ]);
}

// Simple per-IP + per-code rate limiting for response submissions
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$windowSeconds = 60; // time window in seconds
$maxActions = 5;     // max allowed actions within the window

try {
    // Create a small throttle table if it doesn't exist yet
    $pdo->exec("CREATE TABLE IF NOT EXISTS rsvp_rate_limit (
        ip VARCHAR(45) NOT NULL,
        code VARCHAR(36) NOT NULL,
        action_time DATETIME NOT NULL,
        INDEX idx_ip_code_time (ip, code, action_time)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
} catch (Throwable $e) {
    // If creation fails, do not block the flow; continue without throttling
}

if ($response !== null) {
    // Only throttle when attempting to submit a yes/no response
    $since = date('Y-m-d H:i:s', time() - $windowSeconds);
    try {
        $cntStmt = $pdo->prepare("SELECT COUNT(*) AS cnt FROM rsvp_rate_limit WHERE ip = ? AND code = ? AND action_time >= ?");
        $cntStmt->execute([$ip, $codeNorm, $since]);
        $rowCnt = $cntStmt->fetch();
        $cnt = isset($rowCnt['cnt']) ? (int)$rowCnt['cnt'] : 0;
        if ($cnt >= $maxActions) {
            respond(429, [
                "ok" => false,
                "error" => "You've done that too many times in a row. Please wait and try again later.",
                "rate_limited" => true,
                "retry_after" => $windowSeconds,
            ]);
        }
        // Record this attempt (best effort)
        $ins = $pdo->prepare("INSERT INTO rsvp_rate_limit (ip, code, action_time) VALUES (?, ?, NOW())");
        $ins->execute([$ip, $codeNorm]);
    } catch (Throwable $e) {
        // ignore throttling errors
    }
}

if ($response === null) {
    // Decode guest names arrays for response
    $guestNames = [];
    if (isset($row['guest_names']) && $row['guest_names'] !== null && $row['guest_names'] !== '') {
        $dec = json_decode($row['guest_names'], true);
        if (is_array($dec)) { $guestNames = array_values(array_filter($dec, 'is_string')); }
    }
    $attendingGuestNames = [];
    if (isset($row['attending_guest_names']) && $row['attending_guest_names'] !== null && $row['attending_guest_names'] !== '') {
        $dec2 = json_decode($row['attending_guest_names'], true);
        if (is_array($dec2)) { $attendingGuestNames = array_values(array_filter($dec2, 'is_string')); }
    }
    // Just return current status (include names and party size for convenience)
    respond(200, [
        "ok" => true,
        "code" => $row["code"],
        "guest_names" => $guestNames,
        "attending_guest_names" => $attendingGuestNames,
        "party_size" => $row["party_size"],
        "rsvp_response" => $row["rsvp_response"],
        "rsvped_at" => $row["rsvped_at"],
        "updated_at" => $row["updated_at"],
        "message" => "No response given; returning current status.",
    ]);
}

// Update RSVP response
try {
    $pdo->beginTransaction();

    // Update RSVP, set guest_names if provided, and handle attending_guest_names per response
    if ($response === 'no') {
        // Decline: clear attending_guest_names
        $update = $pdo->prepare(
            "UPDATE rsvp_codes SET status_id = (SELECT id FROM rsvp_statuses WHERE code = 'no'), " .
            (empty($guestNamesArr) ? "" : "guest_names = :gn, ") .
            "attending_guest_names = JSON_ARRAY(), rsvped_at = IFNULL(rsvped_at, NOW()), updated_at = NOW() WHERE code = :code"
        );
        if (!empty($guestNamesArr)) {
            $guestNamesJson = json_encode($guestNamesArr, JSON_UNESCAPED_UNICODE);
            $update->bindValue(':gn', $guestNamesJson, PDO::PARAM_STR);
        }
        $update->bindValue(':code', $codeNorm, PDO::PARAM_STR);
        $update->execute();
    } else {
        // Accept intent received: determine final status (Yes, Partial, or No) based on attending selections
        // Decode listed guest_names from the current row
        $listedGuests = [];
        if (isset($row['guest_names']) && $row['guest_names'] !== null && $row['guest_names'] !== '') {
            $lg = json_decode($row['guest_names'], true);
            if (is_array($lg)) { $listedGuests = array_values(array_filter($lg, 'is_string')); }
        }
        // Use provided attending list or default to empty selection
        $sel = $attendingProvided ? $attendingGuestNamesArr : [];
        // Keep only names that are part of this invite
        $sel = array_values(array_intersect($listedGuests, $sel));
        $listedCount = count($listedGuests);
        $selCount = count($sel);

        if ($selCount === 0) {
            // If user clicked "yes" but provided no attending selection:
            // For single-guest invites, treat as full YES for that one guest.
            if ($listedCount === 1) {
                $finalStatus = 'yes';
                $attendingJson = json_encode($listedGuests, JSON_UNESCAPED_UNICODE);
            } else {
                // For multi-guest with no selection, keep as NO to avoid accidental confirmations.
                $finalStatus = 'no';
                $attendingJson = json_encode([], JSON_UNESCAPED_UNICODE);
            }
        } elseif ($listedCount > 0 && $selCount === $listedCount) {
            $finalStatus = 'yes';
            $attendingJson = json_encode($sel, JSON_UNESCAPED_UNICODE);
        } else {
            $finalStatus = 'yes partial party attendance';
            $attendingJson = json_encode($sel, JSON_UNESCAPED_UNICODE);
        }

        $sql = "UPDATE rsvp_codes SET status_id = (SELECT id FROM rsvp_statuses WHERE code = :status_code), ";
        $params = [':code' => $codeNorm, ':status_code' => $finalStatus];
        if (!empty($guestNamesArr)) {
            $sql .= "guest_names = :gn, ";
            $params[':gn'] = json_encode($guestNamesArr, JSON_UNESCAPED_UNICODE);
        }
        $sql .= "attending_guest_names = :agn, rsvped_at = IFNULL(rsvped_at, NOW()), updated_at = NOW() WHERE code = :code";
        $params[':agn'] = $attendingJson;
        $update = $pdo->prepare($sql);
        foreach ($params as $k => $v) {
            $update->bindValue($k, $v, PDO::PARAM_STR);
        }
        $update->execute();
    }

    $check = $pdo->prepare(
        "SELECT rc.id, rc.code, rc.guest_names, rc.attending_guest_names, rc.party_size, rs.code AS rsvp_response, rc.rsvped_at, rc.updated_at FROM rsvp_codes rc JOIN rsvp_statuses rs ON rs.id = rc.status_id WHERE rc.code = ?"
    );
    $check->execute([$codeNorm]);
    $updated = $check->fetch();

    $pdo->commit();

    // Send notification email (non-fatal on failure)
    $notifyEmail = getenv("RSVP_NOTIFY_EMAIL") ?: "shalatolbert656@gmail.com";
    $to = $notifyEmail . ", trulyitsalex95@gmail.com"; // multiple recipients
    $fromEmail =
        getenv("RSVP_FROM_EMAIL") ?:
        "no-reply@" . ($_SERVER["SERVER_NAME"] ?? "localhost");

    // Build subject to include partial attendance note when applicable
    $respLowerForSubject = strtolower($updated["rsvp_response"] ?? '');
    if ($respLowerForSubject === 'yes partial party attendance') {
        $subjectResponseDisplay = 'YES (PARTIAL PARTY ATTENDANCE)';
    } else {
        $subjectResponseDisplay = strtoupper($updated["rsvp_response"] ?? '');
    }
    $subjectBase = "RSVP Response Received - " . $subjectResponseDisplay;
    // Decode guest names for email/subject
    $updatedGuestNames = [];
    if (isset($updated['guest_names']) && $updated['guest_names'] !== null && $updated['guest_names'] !== '') {
        $tmp = json_decode($updated['guest_names'], true);
        if (is_array($tmp)) { $updatedGuestNames = array_values(array_filter($tmp, 'is_string')); }
    }
    // Use incoming guestNamesArr as fallback if update just set it
    if (empty($updatedGuestNames) && !empty($guestNamesArr)) {
        $updatedGuestNames = $guestNamesArr;
    }
    $guestNamesJoined = count($updatedGuestNames) ? implode(', ', $updatedGuestNames) : '';
    if ($guestNamesJoined !== "") {
        $subject = $subjectBase . " - Guest(s): " . $guestNamesJoined;
    } else {
        $subject = $subjectBase . " - Invite Code: " . $updated["code"];
    }

    $guestNameForEmail = $guestNamesJoined !== "" ? $guestNamesJoined : "(names not provided)";

    // Decode attending guest names for email (and allow immediate fallback to incoming param)
    $updatedAttendingNames = [];
    if (isset($updated['attending_guest_names']) && $updated['attending_guest_names'] !== null && $updated['attending_guest_names'] !== '') {
        $tmpAtt = json_decode($updated['attending_guest_names'], true);
        if (is_array($tmpAtt)) { $updatedAttendingNames = array_values(array_filter($tmpAtt, 'is_string')); }
    }
    if (empty($updatedAttendingNames) && !empty($attendingGuestNamesArr)) {
        $updatedAttendingNames = $attendingGuestNamesArr;
    }
    $attendingGuestsJoined = count($updatedAttendingNames) ? implode(', ', $updatedAttendingNames) : '';
    $attendingGuestsHtml = '';
    if ($attendingGuestsJoined !== '' && (strtolower($updated['rsvp_response']) === 'yes' || strtolower($updated['rsvp_response']) === 'yes partial party attendance')) {
        $attendingGuestsHtml = '<p><span class="label">Attending guest(s):</span> ' . htmlspecialchars($attendingGuestsJoined) . '</p>';
    }

    // Build email response label; include explicit note for partial attendance
    $respLower = strtolower($updated["rsvp_response"] ?? '');
    if ($respLower === 'yes partial party attendance') {
        $responseDisplay = 'YES (PARTIAL PARTY ATTENDANCE)';
    } else {
        $responseDisplay = strtoupper($updated["rsvp_response"] ?? '');
    }

    // Build HTML email body
    $body =
        '
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <style>
        .card {
          max-width: 500px;
          margin: 20px auto;
          padding: 20px;
          border: 1px solid #e0e0e0;
          border-radius: 12px;
          background-color: #f9f9f9;
          font-family: Arial, sans-serif;
          color: #333;
        }
        .card h2 {
          margin-top: 0;
          color: #2c3e50;
          text-align: center;
        }
        .card p {
          margin: 8px 0;
        }
        .label {
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>New RSVP Response</h2>
        <p><span class="label">Code:</span> ' .
        htmlspecialchars($updated["code"]) .
        '</p>
        <p><span class="label">Guest name(s):</span> ' .
        htmlspecialchars($guestNameForEmail) .
        '</p>
        <p><span class="label">Response:</span> ' .
        htmlspecialchars($responseDisplay) .
        '</p>' .
        $attendingGuestsHtml .
        '<p><span class="label">Party size:</span> ' .
        htmlspecialchars($updated["party_size"] ?? "n/a") .
        '</p>
      </div>
    </body>
    </html>';

    // Headers for HTML email
    $headers =
        "From: " .
        $fromEmail .
        "\r\n" .
        "Reply-To: " .
        $fromEmail .
        "\r\n" .
        "MIME-Version: 1.0\r\n" .
        "Content-Type: text/html; charset=UTF-8\r\n";

    $emailSent = false;
    try {
        $emailSent = @mail($to, $subject, $body, $headers);
    } catch (Throwable $mailErr) {
        $emailSent = false;
    }

    // Also provide a simple human-friendly HTML response if Accept header prefers text/html
    $accept = $_SERVER["HTTP_ACCEPT"] ?? "";
    if (stripos($accept, "text/html") !== false) {
        header("Content-Type: text/html; charset=utf-8");
        echo '<!doctype html><html><head><meta charset="utf-8"><title>RSVP Updated</title></head><body>';
        echo "<h1>Thank you!</h1>";
        echo "<p>RSVP for code <strong>" .
            htmlspecialchars($updated["code"]) .
            "</strong> recorded as <strong>" .
            htmlspecialchars($updated["rsvp_response"]) .
            "</strong>.</p>";
        echo "</body></html>";
        exit();
    }

    // Decode arrays for response
    $updatedGuestNames = [];
    if (isset($updated['guest_names']) && $updated['guest_names'] !== null && $updated['guest_names'] !== '') {
        $tmp3 = json_decode($updated['guest_names'], true);
        if (is_array($tmp3)) { $updatedGuestNames = array_values(array_filter($tmp3, 'is_string')); }
    }
    $updatedAttendingGuestNames = [];
    if (isset($updated['attending_guest_names']) && $updated['attending_guest_names'] !== null && $updated['attending_guest_names'] !== '') {
        $tmp4 = json_decode($updated['attending_guest_names'], true);
        if (is_array($tmp4)) { $updatedAttendingGuestNames = array_values(array_filter($tmp4, 'is_string')); }
    }

    respond(200, [
        "ok" => true,
        "message" => "RSVP updated",
        "code" => $updated["code"],
        "guest_names" => $updatedGuestNames,
        "attending_guest_names" => $updatedAttendingGuestNames,
        "rsvp_response" => $updated["rsvp_response"],
        "rsvped_at" => $updated["rsvped_at"],
        "updated_at" => $updated["updated_at"],
        "email_sent" => (bool) $emailSent,
    ]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    respond(500, [
        "ok" => false,
        "error" => "Failed to update RSVP",
        "details" => $e->getMessage(),
    ]);
}
