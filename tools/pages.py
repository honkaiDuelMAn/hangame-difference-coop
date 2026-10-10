"""Stage only the playable static site; never publish diagnostic SWFs."""
from pathlib import Path
import argparse
import hashlib
import json
import shutil

ROOT = Path(__file__).resolve().parents[1]
EXCLUDED = {'probe-game.swf', 'game-coop-probe.swf'}

def stage(destination):
    destination = Path(destination).resolve()
    source_root = (ROOT / 'public').resolve()
    if destination == ROOT or destination == source_root or source_root in destination.parents or destination in source_root.parents:
        raise ValueError('Choose a separate output directory')
    if destination.exists() and any(destination.iterdir()):
        raise ValueError('Output directory must be empty; stale files cannot be published')
    destination.mkdir(parents=True, exist_ok=True)
    manifest = {}
    for source in (ROOT / 'public').rglob('*'):
        if not source.is_file() or source.name in EXCLUDED:
            continue
        name = source.relative_to(ROOT / 'public').as_posix()
        target = destination / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
        manifest[name] = hashlib.sha256(target.read_bytes()).hexdigest()
    (destination / '.nojekyll').write_text('', encoding='utf8')
    (destination / 'web-hashes.json').write_text(json.dumps(manifest, sort_keys=True, indent=2)+'\n', encoding='utf8')
    print(f'Staged {len(manifest)} static files with source hashes; diagnostics excluded.')

if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('destination',type=Path)
    stage(parser.parse_args().destination)
