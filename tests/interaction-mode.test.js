const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getPrimaryAction,
  getFlagModeButtonLabel,
  getFlagModeStatusMessage,
} = require('../interaction-mode.js');

test('primary tile action is reveal when flag mode is off', () => {
  assert.equal(getPrimaryAction(false), 'reveal');
});

test('primary tile action is flag when flag mode is on', () => {
  assert.equal(getPrimaryAction(true), 'flag');
});

test('flag mode button label reflects the current mode', () => {
  assert.equal(getFlagModeButtonLabel(false), 'Flag mode: Off');
  assert.equal(getFlagModeButtonLabel(true), 'Flag mode: On');
});

test('flag mode status message explains the touch-friendly behavior', () => {
  assert.equal(
    getFlagModeStatusMessage(false),
    'Tap tiles to reveal. Turn on Flag mode to mark mines on touch devices.',
  );
  assert.equal(
    getFlagModeStatusMessage(true),
    'Flag mode is on. Tap a tile to place or remove a flag.',
  );
});
