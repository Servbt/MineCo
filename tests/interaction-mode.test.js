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
  getInviteLink,
  getRoomCodeFromLocationSearch,
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

test('copy invite button label reflects whether the link was copied', () => {
  assert.equal(getCopyRoomCodeButtonLabel(false), 'Copy invite link');
  assert.equal(getCopyRoomCodeButtonLabel(true), 'Copied link!');
});

test('copy invite status message reflects room availability and copy success', () => {
  assert.equal(getCopyRoomCodeStatusMessage('', false), 'Create a room first to copy the invite link.');
  assert.equal(getCopyRoomCodeStatusMessage('ABC123', false), 'Invite link for room ABC123 is ready to share.');
  assert.equal(getCopyRoomCodeStatusMessage('ABC123', true), 'Copied invite link for room ABC123. Send it to your teammate.');
});

test('native share support requires both the API and a room code', () => {
  assert.equal(supportsNativeShare(undefined, 'ABC123'), false);
  assert.equal(supportsNativeShare(() => {}, ''), false);
  assert.equal(supportsNativeShare(() => {}, 'ABC123'), true);
});

test('share invite button label reflects whether sharing is available', () => {
  assert.equal(getShareRoomCodeButtonLabel(false), 'Share unavailable');
  assert.equal(getShareRoomCodeButtonLabel(true), 'Share invite');
});

test('share invite status message reflects availability and success', () => {
  assert.equal(getShareRoomCodeStatusMessage('', false), 'Create a room first to share the invite link.');
  assert.equal(getShareRoomCodeStatusMessage('ABC123', false), 'Invite link for room ABC123 is ready to share from your phone.');
  assert.equal(getShareRoomCodeStatusMessage('ABC123', true), 'Share sheet opened for the invite link to room ABC123.');
});

test('invite links include the room code as a URL param', () => {
  assert.equal(
    getInviteLink('ABC123', 'https://mineco.onrender.com', '/'),
    'https://mineco.onrender.com/?room=ABC123',
  );
  assert.equal(getInviteLink('', 'https://mineco.onrender.com', '/'), '');
});

test('room code can be restored from the URL search params', () => {
  assert.equal(getRoomCodeFromLocationSearch('?room=abc123'), 'ABC123');
  assert.equal(getRoomCodeFromLocationSearch('?unused=value'), '');
  assert.equal(getRoomCodeFromLocationSearch('?room=a!b@1#2c3'), 'AB12C3');
});

test('long press vibration uses a short touch-friendly pulse', () => {
  assert.deepEqual(getLongPressVibrationPattern(), [35]);
});
