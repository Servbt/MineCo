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

const COLOR_SCHEMES = [
  { id: 'sunset', label: 'Sunset', accent: '#c96b3b', accentAlt: '#2f6b78' },
  { id: 'forest', label: 'Forest', accent: '#2f7a4b', accentAlt: '#c96a3d' },
  { id: 'ocean', label: 'Ocean', accent: '#2a6f97', accentAlt: '#f4a261' },
  { id: 'violet', label: 'Violet', accent: '#7353ba', accentAlt: '#f2a65a' },
  { id: 'ember', label: 'Ember', accent: '#c44536', accentAlt: '#2a9d8f' },
];

function getAvailableColorSchemes() {
  return COLOR_SCHEMES.map((scheme) => ({ ...scheme }));
}

function normalizeColorScheme(colorScheme) {
  const normalizedColorScheme = String(colorScheme || '').trim().toLowerCase();
  return COLOR_SCHEMES.some((scheme) => scheme.id === normalizedColorScheme)
    ? normalizedColorScheme
    : 'sunset';
}

function getColorSchemeStorageKey() {
  return 'mineco:color-scheme';
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
  getAvailableColorSchemes,
  normalizeColorScheme,
  getColorSchemeStorageKey,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = exported;
}

if (typeof window !== 'undefined') {
  window.MineCoInteractionMode = exported;
}
