import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class BuildTests(unittest.TestCase):
    def test_original_runtime_probe_is_built(self):
        self.assertTrue((ROOT / 'scratch/probe-game.swf').is_file(), 'original runtime probe is missing')

    def test_picture_coordinate_pairs_are_preserved(self):
        pictures = list((ROOT / 'public/game/data/newimage').glob('*.swf'))
        self.assertEqual(len(pictures), 190)
        self.assertTrue(all(p.with_suffix('.xml').exists() for p in pictures))

    def test_cooperative_runtime_is_built(self):
        self.assertTrue((ROOT / 'public/game/game-coop.swf').is_file(), 'cooperative runtime is missing')


if __name__ == '__main__':
    unittest.main()
