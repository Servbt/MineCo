const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getPrimaryAction,
  getFlagModeButtonLabel,
  getFlagModeStatusMessage,
  shouldFlagOnLongPress,
  getCopyRoomCodeButtonLabel,
  getCopyRoomCodeStatusMessage,
  supportsNativeShare,
  getShareRoomCodeButtonLabel,
  getShareRoomCodeStatusMessage,
  getLongPressVibrationPattern,
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

test('long press becomes a flag only after the hold threshold', () => {
  assert.equal(shouldFlagOnLongPress(249, 250), false);
  assert.equal(shouldFlagOnLongPress(250, 250), true);
  assert.equal(shouldFlagOnLongPress(600, 250), true);
});

test('copy room code button label reflects whether the code was copied', () => {
  assert.equal(getCopyRoomCodeButtonLabel(false), 'Copy code');
  assert.equal(getCopyRoomCodeButtonLabel(true), 'Copied!');
});

test('copy room code status message reflects room availability and copy success', () => {
  assert.equal(getCopyRoomCodeStatusMessage('', false), 'Create a room first to copy the code.');
  assert.equal(getCopyRoomCodeStatusMessage('ABC123', false), 'Room code ABC123 is ready to share.');
  assert.equal(getCopyRoomCodeStatusMessage('ABC123', true), 'Copied room code ABC123. Send it to your teammate.');
});

test('native share support requires both the API and a room code', () => {
  assert.equal(supportsNativeShare(undefined, 'ABC123'), false);
  assert.equal(supportsNativeShare(() => {}, ''), false);
  assert.equal(supportsNativeShare(() => {}, 'ABC123'), true);
});

test('share room button label reflects whether sharing is available', () => {
  assert.equal(getShareRoomCodeButtonLabel(false), 'Share unavailable');
  assert.equal(getShareRoomCodeButtonLabel(true), 'Share code');
});

test('share room status message reflects availability and success', () => {
  assert.equal(getShareRoomCodeStatusMessage('', false), 'Create a room first to share the code.');
  assert.equal(getShareRoomCodeStatusMessage('ABC123', false), 'Room code ABC123 is ready to share from your phone.');
  assert.equal(getShareRoomCodeStatusMessage('ABC123', true), 'Share sheet opened for room code ABC123.');
});

test('long press vibration uses a short touch-friendly pulse', () => {
  assert.deepEqual(getLongPressVibrationPattern(), [35]);
});
