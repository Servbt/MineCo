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

function sanitizeRoomCode(roomCode) {
  return String(roomCode || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);
}

function getCopyRoomCodeButtonLabel(copied) {
  return copied ? 'Copied link!' : 'Copy invite link';
}

function getCopyRoomCodeStatusMessage(roomCode, copied) {
  const normalizedRoomCode = sanitizeRoomCode(roomCode);

  if (!normalizedRoomCode) {
    return 'Create a room first to copy the invite link.';
  }

  if (copied) {
    return `Copied invite link for room ${normalizedRoomCode}. Send it to your teammate.`;
  }

  return `Invite link for room ${normalizedRoomCode} is ready to share.`;
}

function supportsNativeShare(nativeShareFn, roomCode) {
  return typeof nativeShareFn === 'function' && Boolean(sanitizeRoomCode(roomCode));
}

function getShareRoomCodeButtonLabel(canShare) {
  return canShare ? 'Share invite' : 'Share unavailable';
}

function getShareRoomCodeStatusMessage(roomCode, shared) {
  const normalizedRoomCode = sanitizeRoomCode(roomCode);

  if (!normalizedRoomCode) {
    return 'Create a room first to share the invite link.';
  }

  if (shared) {
    return `Share sheet opened for the invite link to room ${normalizedRoomCode}.`;
  }

  return `Invite link for room ${normalizedRoomCode} is ready to share from your phone.`;
}

function getInviteLink(roomCode, origin, pathname = '/') {
  const normalizedRoomCode = sanitizeRoomCode(roomCode);

  if (!normalizedRoomCode || !origin) {
    return '';
  }

  const inviteUrl = new URL(pathname || '/', origin);
  inviteUrl.searchParams.set('room', normalizedRoomCode);
  return inviteUrl.toString();
}

function getRoomCodeFromLocationSearch(search) {
  const params = new URLSearchParams(search || '');
  return sanitizeRoomCode(params.get('room'));
}

function getReconnectStorageKey() {
  return 'mineco:last-room-session';
}

function createReconnectState(roomCode, playerId) {
  const normalizedRoomCode = sanitizeRoomCode(roomCode);
  const normalizedPlayerId = String(playerId || '').trim();

  if (!normalizedRoomCode || !normalizedPlayerId) {
    return null;
  }

  return {
    roomCode: normalizedRoomCode,
    playerId: normalizedPlayerId,
  };
}

function parseReconnectState(serializedState) {
  if (!serializedState) {
    return null;
  }

  try {
    const parsedState = JSON.parse(serializedState);
    return createReconnectState(parsedState.roomCode, parsedState.playerId);
  } catch (error) {
    return null;
  }
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
  getInviteLink,
  getRoomCodeFromLocationSearch,
  getReconnectStorageKey,
  createReconnectState,
  parseReconnectState,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = exported;
}

if (typeof window !== 'undefined') {
  window.MineCoInteractionMode = exported;
}
