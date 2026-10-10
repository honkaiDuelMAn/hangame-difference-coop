from pathlib import Path
import importlib.util
import sys

root = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('isolated_build', root / 'tools/build.py')
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)
own = root / 'scratch/mini-diagnosis'
own.mkdir(parents=True, exist_ok=True)
build.ROOT = own
source = own / 'probe.as'
source.write_text((root / 'tests/probe.as').read_text(encoding='utf8') + '\n' + (root / 'tests/mini-diagnosis.as').read_text(encoding='utf8'), encoding='utf8')
original = root / 'public/game/FPBDIFF06.swf'
action = build.compile_action(source, original, 'mini-probe')
build.inject(original, action, own / 'mini-probe.swf')
print('Isolated minigame probe compiled with original tags preserved')
