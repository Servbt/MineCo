const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
const themeSelectors = [':root', 'forest', 'ocean', 'violet', 'ember'];

function getThemeBlock(selector) {
  if (selector === ':root') {
    const match = css.match(/:root\s*\{([\s\S]*?)\n\}/);
    return match ? match[1] : '';
  }

  const match = css.match(new RegExp(`body\\[data-theme="${selector}"\\]\\s*\\{([\\s\\S]*?)\\n\\}`, 'm'));
  return match ? match[1] : '';
}

function getHex(block, variableName) {
  const match = block.match(new RegExp(`--${variableName}:\\s*(#[0-9a-fA-F]{6})`));
  return match ? match[1] : null;
}

function hexToRgb(hex) {
  const normalized = hex.replace('#', '');
  return [0, 2, 4].map((offset) => parseInt(normalized.slice(offset, offset + 2), 16) / 255);
}

function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((channel) => (
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ));

  return (0.2126 * r) + (0.7152 * g) + (0.0722 * b);
}

test('every theme defines separate dramatic covered and revealed tile palette stops', () => {
  for (const selector of themeSelectors) {
    const block = getThemeBlock(selector);

    assert.ok(getHex(block, 'tile-covered-top'), `${selector} is missing --tile-covered-top`);
    assert.ok(getHex(block, 'tile-covered-bottom'), `${selector} is missing --tile-covered-bottom`);
    assert.ok(getHex(block, 'tile-revealed-top'), `${selector} is missing --tile-revealed-top`);
    assert.ok(getHex(block, 'tile-revealed-bottom'), `${selector} is missing --tile-revealed-bottom`);
  }
});

test('every theme keeps covered tiles dramatically darker than revealed tiles', () => {
  for (const selector of themeSelectors) {
    const block = getThemeBlock(selector);
    const coveredTop = getHex(block, 'tile-covered-top');
    const coveredBottom = getHex(block, 'tile-covered-bottom');
    const revealedTop = getHex(block, 'tile-revealed-top');
    const revealedBottom = getHex(block, 'tile-revealed-bottom');

    assert.ok(coveredTop && coveredBottom && revealedTop && revealedBottom, `${selector} must define all tile palette stops`);

    const coveredAverage = (luminance(coveredTop) + luminance(coveredBottom)) / 2;
    const revealedAverage = (luminance(revealedTop) + luminance(revealedBottom)) / 2;

    assert.ok(
      revealedAverage - coveredAverage >= 0.18,
      `${selector} should make covered tiles much darker than revealed tiles (got ${(revealedAverage - coveredAverage).toFixed(3)})`,
    );
  }
});
