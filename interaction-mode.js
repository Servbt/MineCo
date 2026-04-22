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

const exported = {
  getPrimaryAction,
  getFlagModeButtonLabel,
  getFlagModeStatusMessage,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = exported;
}

if (typeof window !== 'undefined') {
  window.MineCoInteractionMode = exported;
}
