<?php
// Simple endpoint to get RSVP details (guest_names array, party_size, and status) by code
// Usage: /rsvp_info.php?id=123e4567-e89b-12d3-a456-426614174000

header('Content-Type: application/json');

function respond($statusCode, $payload) {
    http_response_code($statusCode);
    echo json_encode($payload, JSON_PRETTY_PRINT);
    exit;
}

$code = isset($_GET['id']) ? trim($_GET['id']) : '';
if ($code === '') {
    respond(400, [
        'ok' => false,
        'error' => 'Missing required query parameter: id',
        'usage' => '/rsvp_info.php?id=123e4567-e89b-12d3-a456-426614174000',
    ]);
}

$host = getenv('DB_HOST') ?: '127.0.0.1';
$db   = getenv('DB_NAME') ?: 'wedding';
$user = getenv('DB_USER') ?: 'root';
$pass = getenv('DB_PASS') ?: '';
$dsn = "mysql:host={$host};dbname={$db};charset=utf8mb4";

// Normalize the code to uppercase to avoid case-sensitivity issues
$codeNorm = strtoupper($code);
// Strict validation for code to guard against injection/malformed input
if (!preg_match('/^[A-Z0-9_-]{1,36}$/', $codeNorm)) {
    respond(400, [
        'ok' => false,
        'error' => 'Invalid id format. Use 1-36 characters: letters, numbers, underscore, or hyphen.'
    ]);
}

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

$stmt = $pdo->prepare('SELECT code, guest_names, attending_guest_names, party_size, rsvp_response, rsvped_at, updated_at FROM rsvp_codes WHERE code = ?');
$stmt->execute([$codeNorm]);
$row = $stmt->fetch();

if (!$row) {
    respond(404, [
        'ok' => false,
        'error' => 'RSVP code not found',
        'code' => $codeNorm,
    ]);
}

$guestNames = [];
if (isset($row['guest_names']) && $row['guest_names'] !== null && $row['guest_names'] !== '') {
    $decoded = json_decode($row['guest_names'], true);
    if (is_array($decoded)) { $guestNames = array_values(array_filter($decoded, 'is_string')); }
}
$attendingGuestNames = [];
if (isset($row['attending_guest_names']) && $row['attending_guest_names'] !== null && $row['attending_guest_names'] !== '') {
    $decoded2 = json_decode($row['attending_guest_names'], true);
    if (is_array($decoded2)) { $attendingGuestNames = array_values(array_filter($decoded2, 'is_string')); }
}

respond(200, [
    'ok' => true,
    'code' => $row['code'],
    'guest_names' => $guestNames,
    'attending_guest_names' => $attendingGuestNames,
    'party_size' => $row['party_size'],
    'rsvp_response' => $row['rsvp_response'],
    'rsvped_at' => $row['rsvped_at'],
    'updated_at' => $row['updated_at'],
]);
