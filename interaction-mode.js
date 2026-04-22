function getPrimaryAction(flagMode) {
  return flagMode ? 'flag' : 'reveal';
}

function getFlagModeButtonLabel(flagMode) {
  return `Flag mode: ${flagMode ? 'On' : 'Off'}`;
}

function getFlagModeStatusMessage(flagMode) {
  if (flagMode) {
    return 'Flag mode is on. Tap a tile to place or remove a flag.';
  }

  return 'Tap tiles to reveal. Turn on Flag mode to mark mines on touch devices.';
}

function shouldFlagOnLongPress(durationMs, thresholdMs = 250) {
  return durationMs >= thresholdMs;
}

function getCopyRoomCodeButtonLabel(copied) {
  return copied ? 'Copied!' : 'Copy code';
}

function getCopyRoomCodeStatusMessage(roomCode, copied) {
  if (!roomCode) {
    return 'Create a room first to copy the code.';
  }

  if (copied) {
    return `Copied room code ${roomCode}. Send it to your teammate.`;
  }

  return `Room code ${roomCode} is ready to share.`;
}

function supportsNativeShare(nativeShareFn, roomCode) {
  return typeof nativeShareFn === 'function' && Boolean(roomCode);
}

function getShareRoomCodeButtonLabel(canShare) {
  return canShare ? 'Share code' : 'Share unavailable';
}

function getShareRoomCodeStatusMessage(roomCode, shared) {
  if (!roomCode) {
    return 'Create a room first to share the code.';
  }

  if (shared) {
    return `Share sheet opened for room code ${roomCode}.`;
  }

  return `Room code ${roomCode} is ready to share from your phone.`;
}

function getLongPressVibrationPattern() {
  return [35];
}

const exported = {
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
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = exported;
}

if (typeof window !== 'undefined') {
  window.MineCoInteractionMode = exported;
}
