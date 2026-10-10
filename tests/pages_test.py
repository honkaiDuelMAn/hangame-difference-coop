import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec=importlib.util.spec_from_file_location('pages',Path(__file__).resolve().parents[1]/'tools/pages.py')
pages=importlib.util.module_from_spec(spec)
spec.loader.exec_module(pages)

class PagesTests(unittest.TestCase):
    def test_static_package_excludes_diagnostic_call_interfaces(self):
        with tempfile.TemporaryDirectory() as tmp:
            project=Path(tmp)/'project';public=project/'public';(public/'game').mkdir(parents=True)
            (public/'index.html').write_bytes(b'game')
            (public/'game/game-coop.swf').write_bytes(b'production')
            for name in ['probe-game.swf','game-coop-probe.swf']:(public/'game'/name).write_bytes(b'privileged test callbacks')
            old=pages.ROOT
            try:
                pages.ROOT=project;out=Path(tmp)/'out';pages.stage(out)
                self.assertEqual(sorted(p.name for p in (out/'game').iterdir()),['game-coop.swf'])
                manifest=json.loads((out/'web-hashes.json').read_text(encoding='utf8'))
                self.assertEqual(manifest['game/game-coop.swf'],hashlib.sha256(b'production').hexdigest())
                with self.assertRaises(ValueError):pages.stage(out)
                for invalid in [project,public,public/'nested']:
                    with self.assertRaises(ValueError):pages.stage(invalid)
            finally:pages.ROOT=old

if __name__=='__main__':unittest.main()
