"""Compare the deployed manifest to committed Git bytes, then sample real files."""
import hashlib
import json
import subprocess
import sys
from urllib.request import urlopen
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
url = sys.argv[1].rstrip('/') + '/'
paths = subprocess.check_output(['git', 'ls-files', 'public'], cwd=ROOT, text=True).splitlines()
process = subprocess.Popen(['git', 'cat-file', '--batch'], cwd=ROOT, stdin=subprocess.PIPE, stdout=subprocess.PIPE)
expected = {}
for name in paths:
    process.stdin.write(('HEAD:' + name + '\n').encode())
    process.stdin.flush()
    header = process.stdout.readline().split()
    size = int(header[2])
    digest = hashlib.sha256()
    while size:
        chunk = process.stdout.read(min(size, 1048576))
        digest.update(chunk)
        size -= len(chunk)
    assert process.stdout.read(1) == b'\n'
    expected[name.removeprefix('public/')] = digest.hexdigest()
process.stdin.close()
assert process.wait() == 0
with urlopen(url + 'web-hashes.json', timeout=30) as response:
    actual = json.load(response)
assert actual == expected, 'Deployed manifest differs from committed public files'
samples = ['index.html', 'app.mjs', 'engine.mjs', 'characters.mjs', 'style.css',
           'game/game-coop.swf', 'game/FPBDIFF06.swf', 'assets/boy.png', 'assets/girl.png']
for name in samples:
    digest = hashlib.sha256()
    with urlopen(url + name, timeout=45) as response:
        while chunk := response.read(1048576):
            digest.update(chunk)
    assert digest.hexdigest() == expected[name], name + ' differs from committed bytes'
assert not any('probe' in name for name in actual)
print(f'PASS deployed manifest matches all {len(actual)} committed files; {len(samples)} served samples match SHA-256; no diagnostic SWFs.')
