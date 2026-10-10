"""Preserve original AVM1 tags and inject separately compiled bridge actions."""
from pathlib import Path
import argparse
import struct
import subprocess
import zlib

ROOT = Path(__file__).resolve().parents[1]
JAVA = Path('C:/Program Files (x86)/NS-USBloader/jdk/bin/java.exe')
FFDEC = Path('C:/Users/whdhk/Documents/Codex/2026-10-03/c-users-whdhk-downloads-inuyasha/work/ffdec/ffdec.jar')


def unpack(path):
    data = Path(path).read_bytes()
    if data[:3] == b'CWS':
        data = b'FWS' + data[3:8] + zlib.decompress(data[8:])
    if data[:3] != b'FWS' or len(data) != struct.unpack_from('<I', data, 4)[0]:
        raise ValueError('Invalid standard SWF')
    return data


def tags(data):
    pos = 8 + (5 + 4 * (data[8] >> 3) + 7) // 8 + 4
    header = data[:pos]
    result = []
    while pos < len(data):
        start = pos
        value = struct.unpack_from('<H', data, pos)[0]
        pos += 2
        size = value & 63
        if size == 63:
            size = struct.unpack_from('<I', data, pos)[0]
            pos += 4
        if pos + size > len(data):
            raise ValueError('Truncated SWF tag')
        result.append((value >> 6, data[start:pos + size], data[pos:pos + size]))
        pos += size
    return header, result


def tag(kind, payload):
    return struct.pack('<HI', (kind << 6) | 63, len(payload)) + payload


def serialize(header, records):
    raw = header + b''.join(records)
    raw = b'FWS' + raw[3:4] + struct.pack('<I', len(raw)) + raw[8:]
    return b'CWS' + raw[3:8] + zlib.compress(raw[8:])


def compile_action(source, template, name):
    scratch = ROOT / 'scratch'
    scratch.mkdir(exist_ok=True)
    header, _ = tags(unpack(template))
    empty = scratch / 'empty.swf'
    empty.write_bytes(serialize(header[:-2] + b'\x01\x00', [tag(12, b'\0'), tag(1, b''), tag(0, b'')]))
    output = scratch / (name + '-compiled.swf')
    result = subprocess.run([str(JAVA), '-Djava.awt.headless=true', '-jar', str(FFDEC), '-replace', str(empty), str(output), r'\frame_1\DoAction', str(source)], capture_output=True, text=True, timeout=45)
    (scratch / (name + '-compiler.log')).write_text(result.stdout + result.stderr, encoding='utf8')
    if result.returncode or not output.exists():
        raise RuntimeError('Bridge compilation failed: ' + result.stdout[-2000:] + result.stderr[-1000:])
    actions = [raw for kind, raw, _ in tags(unpack(output))[1] if kind == 12]
    if len(actions) != 1 or len(actions[0]) < 30:
        raise RuntimeError('No compiled bridge action')
    return actions[0]


def inject(source, action, output):
    header, records = tags(unpack(source))
    patched = []
    installed = False
    for kind, raw, _ in records:
        if kind == 1 and not installed:
            patched.append(action)
            installed = True
        patched.append(raw)
    if not installed:
        raise ValueError('Original has no first frame')
    output.write_bytes(serialize(header, patched))
    assert [r[1] for r in tags(unpack(output))[1] if r[1] != action] == [r[1] for r in records]


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--probe', action='store_true')
    parser.add_argument('--test', action='store_true')
    parser.add_argument('--java', type=Path, default=JAVA)
    parser.add_argument('--ffdec', type=Path, default=FFDEC)
    args = parser.parse_args()
    JAVA = args.java.resolve()
    FFDEC = args.ffdec.resolve()
    original = ROOT / 'public/game/FPBDIFF06.swf'
    if args.probe:
        action = compile_action(ROOT / 'tests/probe.as', original, 'probe')
        inject(original, action, ROOT / 'scratch/probe-game.swf')
        print('Probe compiled; all original main tags preserved exactly.')
    else:
        action = compile_action(ROOT / 'flash/coop.as', original, 'coop')
        inject(original, action, ROOT / 'public/game/game-coop.swf')
        print('Cooperative bridge compiled; all original main tags preserved exactly.')
        if args.test:
            probe = compile_action(ROOT / 'tests/probe.as', original, 'probe')
            inject(ROOT / 'public/game/game-coop.swf', probe, ROOT / 'public/game/game-coop-probe.swf')
