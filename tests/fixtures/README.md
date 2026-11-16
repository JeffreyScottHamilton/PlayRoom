# Test fixtures

Dev/test only. Fixtures in this directory are never part of the game manifest
(`src/data/games.json`) and are never shipped as games.

## ruffle-test.swf

- Use: Ruffle verification (`e2e/player.spec.mjs`), renders two overlapping filled shapes.
- Stage size: 550 x 400 (read from the SWF header RECT).
- Source: https://github.com/ruffle-rs/ruffle/blob/f9987b0e8f2c30d743f27bd7763830dd9a54b752/tests/tests/swfs/visual/simple_shapes/overlaps/test.swf
- Raw: https://raw.githubusercontent.com/ruffle-rs/ruffle/f9987b0e8f2c30d743f27bd7763830dd9a54b752/tests/tests/swfs/visual/simple_shapes/overlaps/test.swf
- Upstream commit: f9987b0e8f2c30d743f27bd7763830dd9a54b752 (ruffle-rs/ruffle)
- Licence: MIT OR Apache-2.0 (Ruffle project licence, see LICENSE.md in the upstream repository; the test suite is covered by it).
