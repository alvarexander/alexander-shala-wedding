<?php
header('Content-Type: application/json');

function respond($statusCode, $payload) {
    http_response_code($statusCode);
    echo json_encode($payload, JSON_PRETTY_PRINT);
    exit;
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
    respond(500, ['ok' => false, 'error' => 'Database connection failed', 'details' => $e->getMessage()]);
}

try {
    // Get all statuses for mapping
    $statusesStmt = $pdo->query('SELECT id, code, label FROM rsvp_statuses ORDER BY id');
    $statuses = $statusesStmt->fetchAll();

    $stmt = $pdo->query('SELECT rc.id, rc.code, rc.guest_names, rc.attending_guest_names, rc.party_size, rc.status_id, rs.code AS rsvp_response, rs.label AS status_label, rc.rsvped_at, rc.updated_at FROM rsvp_codes rc JOIN rsvp_statuses rs ON rs.id = rc.status_id ORDER BY rc.code ASC');
    $rows = $stmt->fetchAll();

    $mapped = array_map(function($row) {
        $guestNames = [];
        if (isset($row['guest_names']) && $row['guest_names'] !== null && $row['guest_names'] !== '') {
            $dec = json_decode($row['guest_names'], true);
            if (is_array($dec)) { $guestNames = array_values(array_filter($dec, 'is_string')); }
        }
        $attending = [];
        if (isset($row['attending_guest_names']) && $row['attending_guest_names'] !== null && $row['attending_guest_names'] !== '') {
            $dec2 = json_decode($row['attending_guest_names'], true);
            if (is_array($dec2)) { $attending = array_values(array_filter($dec2, 'is_string')); }
        }
        return [
            'id' => (int)$row['id'],
            'invite_code' => $row['code'],
            'guest_names' => $guestNames,
            'attending_guest_names' => $attending,
            'party_size' => $row['party_size'] === null ? null : (int)$row['party_size'],
            'status' => $row['rsvp_response'],
            'status_label' => $row['status_label'],
            'status_id' => (int)$row['status_id'],
            'rsvped_at' => $row['rsvped_at'],
            'updated_at' => $row['updated_at'],
        ];
    }, $rows);

    respond(200, [
        'ok' => true,
        'items' => $mapped,
        'statuses' => $statuses,
    ]);
} catch (Throwable $e) {
    respond(500, ['ok' => false, 'error' => 'Failed to list invitations', 'details' => $e->getMessage()]);
}
