from pathlib import Path
import importlib.util
import struct
import subprocess

root = Path(__file__).resolve().parents[1]
own = root / 'scratch/mini-diagnosis'
spec = importlib.util.spec_from_file_location('isolated_build', root / 'tools/build.py')
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)
asset = 'minigame2.swf' if '2' in __import__('sys').argv[1:] else 'minigame.swf'
header, records = build.tags(build.unpack(root / 'public/game' / asset))
selected = []
root_actions = []
for kind, raw, payload in records:
    if kind == 12 and b'shot_effect' in payload:
        root_actions.append(raw)
    if kind == 39 and (struct.unpack_from('<H', payload)[0] == 251 or b'onMouseDown' in payload or b'bullet_mc' in payload):
        identity = struct.unpack_from('<H', payload)[0]
        selected.append(raw)
        print('Cursor sprite', identity, len(payload))
        (own / ('cursor-' + str(identity) + '.bin')).write_bytes(payload)
output = own / (asset + '-root-scripts.swf')
output.write_bytes(build.serialize(header[:-2] + b'\x01\x00', root_actions + [build.tag(1, b''), build.tag(0, b'')]))
result = subprocess.run([str(build.JAVA), '-Djava.awt.headless=true', '-jar', str(build.FFDEC), '-format', 'script:pcode', '-export', 'script', str(own / (asset + '-root-pcode')), str(output)], capture_output=True, text=True, timeout=45)
print(result.stdout, result.stderr)
