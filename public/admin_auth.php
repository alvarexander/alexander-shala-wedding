<?php
header('Content-Type: application/json');
session_start();

/**
 * Respond helper: sends JSON with an HTTP status code and exits.
 */
function respond($statusCode, $payload) {
    http_response_code($statusCode);
    echo json_encode($payload, JSON_PRETTY_PRINT);
    exit;
}

// Expect JSON body: { username?: string, password: string }
$raw = file_get_contents('php://input');
$input = json_decode($raw, true);
if (!is_array($input)) {
    respond(400, ['ok' => false, 'error' => 'Invalid JSON body']);
}

$username = isset($input['username']) ? trim((string)$input['username']) : 'admin';
$password = isset($input['password']) ? (string)$input['password'] : '';
if ($password === '') {
    respond(400, ['ok' => false, 'error' => 'Password is required']);
}
if ($username === '' || strlen($username) > 64) {
    respond(400, ['ok' => false, 'error' => 'Invalid username']);
}

$host = getenv('DB_HOST') ?: '127.0.0.1';
$db   = getenv('DB_NAME') ?: 'wedding';
$user = getenv('DB_USER') ?: 'root';
$pass = getenv('DB_PASS') ?: '';
$dsn = "mysql:host={$host};dbname={$db};charset=utf8mb4";

// This is used ONLY for first-run bootstrap if no admins exist yet.
// It adopts the previously hardcoded client-side password so behavior is preserved.
$DEFAULT_BOOTSTRAP_PASSWORD = 'Alex&Shala0225656r!@#';

try {
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (PDOException $e) {
    respond(500, ['ok' => false, 'error' => 'Database connection failed', 'details' => $e->getMessage()]);
}

try {
    // Ensure table exists (in case migration not yet applied)
    $pdo->exec('CREATE TABLE IF NOT EXISTS rsvp_admins (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT,
        username VARCHAR(64) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_rsvp_admin_username (username)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');

    // Bootstrap a default admin if table is empty
    $count = (int)$pdo->query('SELECT COUNT(*) AS c FROM rsvp_admins')->fetchColumn();
    if ($count === 0) {
        $hash = password_hash($DEFAULT_BOOTSTRAP_PASSWORD, PASSWORD_BCRYPT);
        $ins = $pdo->prepare('INSERT INTO rsvp_admins (username, password_hash) VALUES (?, ?)');
        $ins->execute(['admin', $hash]);
    }

    // Look up the requested user (default 'admin')
    $sel = $pdo->prepare('SELECT id, username, password_hash FROM rsvp_admins WHERE username = ?');
    $sel->execute([$username]);
    $row = $sel->fetch();

    if (!$row) {
        // Do not reveal whether username exists
        respond(401, ['ok' => false, 'error' => 'Invalid credentials']);
    }

    $valid = password_verify($password, $row['password_hash'] ?? '');
    if (!$valid) {
        respond(401, ['ok' => false, 'error' => 'Invalid credentials']);
    }

    // Issue a session-bound token and return it to the client
    $token = bin2hex(random_bytes(32));
    $_SESSION['admin_user_id'] = (int)$row['id'];
    $_SESSION['admin_username'] = $row['username'];
    $_SESSION['admin_token'] = $token;
    $_SESSION['admin_token_issued_at'] = time();

    respond(200, [
        'ok' => true,
        'token' => $token,
        'user' => [
            'id' => (int)$row['id'],
            'username' => $row['username'],
        ],
    ]);
} catch (Throwable $e) {
    respond(500, ['ok' => false, 'error' => 'Auth failed', 'details' => $e->getMessage()]);
}
