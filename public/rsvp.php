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
    "SELECT id, code, guest_names, attending_guest_names, party_size, rsvp_response, rsvped_at, updated_at FROM rsvp_codes WHERE code = ?"
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

    // Update RSVP, and if guest_names are provided, store them as JSON array
    if (!empty($guestNamesArr)) {
        $guestNamesJson = json_encode($guestNamesArr, JSON_UNESCAPED_UNICODE);
        $update = $pdo->prepare(
            "UPDATE rsvp_codes SET rsvp_response = ?, guest_names = ?, rsvped_at = IFNULL(rsvped_at, NOW()), updated_at = NOW() WHERE code = ?"
        );
        $update->execute([$response, $guestNamesJson, $codeNorm]);
    } else {
        $update = $pdo->prepare(
            "UPDATE rsvp_codes SET rsvp_response = ?, rsvped_at = IFNULL(rsvped_at, NOW()), updated_at = NOW() WHERE code = ?"
        );
        $update->execute([$response, $codeNorm]);
    }

    $check = $pdo->prepare(
        "SELECT id, code, guest_names, attending_guest_names, party_size, rsvp_response, rsvped_at, updated_at FROM rsvp_codes WHERE code = ?"
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

    $subjectBase =
        "RSVP Response Received - " . strtoupper($updated["rsvp_response"]);
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
        <p><span class="label">Name:</span> ' .
        htmlspecialchars($guestNameForEmail) .
        '</p>
        <p><span class="label">Response:</span> ' .
        htmlspecialchars(strtoupper($updated["rsvp_response"])) .
        '</p>
        <p><span class="label">Party size:</span> ' .
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
