import json
import os
import sqlite3
import urllib.request

base = os.path.dirname(__file__)
db_path = os.path.join(base, 'quantum_communication.db')
print('DB_PATH', db_path)
print('DB_EXISTS', os.path.exists(db_path))

if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    rows = conn.execute(
        "SELECT id, name, username, email, role, is_active, password_hash FROM users ORDER BY id"
    ).fetchall()
    print('ROWS', rows)
    conn.close()

req = urllib.request.Request(
    'http://localhost:8000/api/auth/login',
    data=json.dumps({'username': 'admin@example.com', 'password': 'Admin123456'}).encode('utf-8'),
    headers={'Content-Type': 'application/json'},
    method='POST',
)
try:
    with urllib.request.urlopen(req, timeout=20) as resp:
        body = resp.read().decode('utf-8')
        print('HTTP_STATUS', resp.status)
        print('HTTP_BODY', body)
except Exception as exc:
    print('EXC_TYPE', type(exc).__name__)
    print('HTTP_STATUS', getattr(exc, 'code', None))
    try:
        raw = exc.read().decode('utf-8')
    except Exception:
        raw = str(exc)
    print('HTTP_BODY', raw)
