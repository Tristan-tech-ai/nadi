"""Deploy produksi Nadi secara sengaja (deploy otomatis per push dimatikan lewat apps/web/vercel.json).

Dipakai hanya untuk perubahan besar yang digabung (keputusan Tristan 12 Nov 2026: batas Hobby 100 deployment per hari).
Pakai: python -I loop/deploy_produksi.py   (memakai HEAD yang sudah dipush; menunggu READY atau ERROR, paling lama 15 menit)
"""
import json
import shutil
import subprocess
import sys
import tempfile
import time

VC = [shutil.which('node'), r'C:\Users\Tristan\AppData\Roaming\npm\node_modules\vercel\dist\vc.js']
TIM = 'team_AChoIzCZprUuQaBZuhSOpTaU'


def api(jalur, *argumen):
    r = subprocess.run([*VC, 'api', jalur, *argumen, '--raw'], capture_output=True, text=True, encoding='utf-8', errors='replace')
    return json.loads(r.stdout or '{}')


sha = subprocess.run(['git', 'rev-parse', 'HEAD'], capture_output=True, text=True).stdout.strip()
jauh = subprocess.run(['git', 'rev-parse', 'origin/main'], capture_output=True, text=True).stdout.strip()
if sha != jauh:
    sys.exit(f'HEAD {sha[:7]} belum sama dengan origin/main {jauh[:7]}: push dulu')
badan = {'name': 'nadi', 'project': 'nadi', 'target': 'production',
         'gitSource': {'type': 'github', 'org': 'Tristan-tech-ai', 'repo': 'nadi', 'ref': 'main', 'sha': sha}}
with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False, encoding='utf-8') as f:
    json.dump(badan, f)
d = api(f'/v13/deployments?teamId={TIM}', '-X', 'POST', '--input', f.name)
uid = d.get('id')
if not uid:
    sys.exit(f'gagal membuat deployment: {d.get("error")}')
batas = time.time() + 900
while True:
    s = api(f'/v13/deployments/{uid}?teamId={TIM}').get('readyState')
    print(time.strftime('%H:%M:%S'), uid, s, flush=True)
    if s in ('READY', 'ERROR', 'CANCELED') or time.time() > batas:
        sys.exit(0 if s == 'READY' else 1)
    time.sleep(20)
