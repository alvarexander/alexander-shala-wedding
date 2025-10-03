<?php
header('Content-Type: application/json');
session_start();

function respond($statusCode, $payload) {
    http_response_code($statusCode);
    echo json_encode($payload, JSON_PRETTY_PRINT);
    exit;
}

// Verify admin token from header against session
$hdrs = getallheaders();
$clientToken = $hdrs['X-Admin-Token'] ?? $hdrs['x-admin-token'] ?? null;
if (!isset($_SESSION['admin_token']) || !$clientToken || !hash_equals((string)$_SESSION['admin_token'], (string)$clientToken)) {
    respond(401, ['ok' => false, 'error' => 'Unauthorized']);
}

// Expect JSON body for updates
$raw = file_get_contents('php://input');
$input = json_decode($raw, true);
if (!is_array($input)) {
    respond(400, ['ok' => false, 'error' => 'Invalid JSON body']);
}

// Identify row either by id or invite_code
$id = isset($input['id']) ? (int)$input['id'] : null;
$inviteCode = isset($input['invite_code']) ? strtoupper(trim((string)$input['invite_code'])) : null;
if (!$id && !$inviteCode) {
    respond(400, ['ok' => false, 'error' => 'Provide id or invite_code']);
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
    // Locate the row
    if ($id) {
        $sel = $pdo->prepare('SELECT * FROM rsvp_codes WHERE id = ?');
        $sel->execute([$id]);
    } else {
        if (!preg_match('/^[A-Z0-9_-]{1,36}$/', $inviteCode)) {
            respond(400, ['ok' => false, 'error' => 'Invalid invite_code format']);
        }
        $sel = $pdo->prepare('SELECT * FROM rsvp_codes WHERE code = ?');
        $sel->execute([$inviteCode]);
    }
    $row = $sel->fetch();
    if (!$row) {
        respond(404, ['ok' => false, 'error' => 'Row not found']);
    }

    $fields = [];
    $params = [];

    // Optional: update invite_code (code)
    if (array_key_exists('invite_code', $input)) {
        $newCode = strtoupper(trim((string)$input['invite_code']));
        if ($newCode === '' || !preg_match('/^[A-Z0-9_-]{1,36}$/', $newCode)) {
            respond(400, ['ok' => false, 'error' => 'Invalid invite_code']);
        }
        $fields[] = 'code = :code';
        $params[':code'] = $newCode;
    }

    // Optional: update party_size
    if (array_key_exists('party_size', $input)) {
        if ($input['party_size'] === null || $input['party_size'] === '') {
            $fields[] = 'party_size = NULL';
        } else {
            $ps = (int)$input['party_size'];
            if ($ps < 0 || $ps > 50) { respond(400, ['ok' => false, 'error' => 'Invalid party_size']); }
            $fields[] = 'party_size = :party_size';
            $params[':party_size'] = $ps;
        }
    }

    // Optional: update guest_names (array of strings)
    if (array_key_exists('guest_names', $input)) {
        $g = $input['guest_names'];
        if (!is_array($g)) { respond(400, ['ok' => false, 'error' => 'guest_names must be an array of strings']); }
        $out = [];
        foreach ($g as $nm) {
            if (!is_string($nm)) { continue; }
            $nm = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', trim($nm));
            if ($nm === '') { continue; }
            if (strlen($nm) > 400) { $nm = substr($nm, 0, 400); }
            $out[] = $nm;
            if (count($out) >= 20) { break; }
        }
        $fields[] = 'guest_names = :guest_names';
        $params[':guest_names'] = json_encode($out, JSON_UNESCAPED_UNICODE);
    }

    // Optional: update attending_guest_names (array of strings)
    if (array_key_exists('attending_guest_names', $input)) {
        $a = $input['attending_guest_names'];
        if (!is_array($a)) { respond(400, ['ok' => false, 'error' => 'attending_guest_names must be an array of strings']); }
        $outA = [];
        foreach ($a as $nm) {
            if (!is_string($nm)) { continue; }
            $nm = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', trim($nm));
            if ($nm === '') { continue; }
            if (strlen($nm) > 400) { $nm = substr($nm, 0, 400); }
            $outA[] = $nm;
            if (count($outA) >= 20) { break; }
        }
        $fields[] = 'attending_guest_names = :attending_guest_names';
        $params[':attending_guest_names'] = json_encode($outA, JSON_UNESCAPED_UNICODE);
    }

    // Optional: update status by status code string
    if (array_key_exists('status', $input)) {
        $status = strtolower(trim((string)$input['status']));
        $statusSel = $pdo->prepare('SELECT id FROM rsvp_statuses WHERE code = ?');
        $statusSel->execute([$status]);
        $statusRow = $statusSel->fetch();
        if (!$statusRow) { respond(400, ['ok' => false, 'error' => 'Unknown status code']); }
        $fields[] = 'status_id = :status_id';
        $params[':status_id'] = (int)$statusRow['id'];
    }

    if (empty($fields)) {
        respond(400, ['ok' => false, 'error' => 'No updatable fields provided']);
    }

    $sql = 'UPDATE rsvp_codes SET ' . implode(', ', $fields) . ', updated_at = NOW() WHERE id = :id';
    $params[':id'] = (int)$row['id'];
    $upd = $pdo->prepare($sql);
    foreach ($params as $k => $v) {
        if ($k === ':party_size' || $k === ':status_id') {
            $type = PDO::PARAM_INT;
        } else {
            $type = PDO::PARAM_STR;
        }
        $upd->bindValue($k, $v, $type);
    }
    $upd->execute();

    // Return updated row joined with status
    $check = $pdo->prepare('SELECT rc.id, rc.code, rc.guest_names, rc.attending_guest_names, rc.party_size, rs.code AS rsvp_response, rc.rsvped_at, rc.updated_at FROM rsvp_codes rc JOIN rsvp_statuses rs ON rs.id = rc.status_id WHERE rc.id = ?');
    $check->execute([(int)$row['id']]);
    $u = $check->fetch();

    $guestNames = [];
    if (isset($u['guest_names']) && $u['guest_names'] !== null && $u['guest_names'] !== '') {
        $dec = json_decode($u['guest_names'], true);
        if (is_array($dec)) { $guestNames = array_values(array_filter($dec, 'is_string')); }
    }
    $attending = [];
    if (isset($u['attending_guest_names']) && $u['attending_guest_names'] !== null && $u['attending_guest_names'] !== '') {
        $dec2 = json_decode($u['attending_guest_names'], true);
        if (is_array($dec2)) { $attending = array_values(array_filter($dec2, 'is_string')); }
    }

    respond(200, [
        'ok' => true,
        'item' => [
            'id' => (int)$u['id'],
            'invite_code' => $u['code'],
            'guest_names' => $guestNames,
            'attending_guest_names' => $attending,
            'party_size' => $u['party_size'] === null ? null : (int)$u['party_size'],
            'status' => $u['rsvp_response'],
            'rsvped_at' => $u['rsvped_at'],
            'updated_at' => $u['updated_at'],
        ],
    ]);
} catch (Throwable $e) {
    respond(500, ['ok' => false, 'error' => 'Failed to update invitation', 'details' => $e->getMessage()]);
}
