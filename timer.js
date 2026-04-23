function normalizeTimestamp(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function startTimer(timerState = {}, now = Date.now()) {
  const startedAt = normalizeTimestamp(timerState.startedAt);

  if (startedAt !== null) {
    return {
      ...timerState,
      startedAt,
      finishedAt: normalizeTimestamp(timerState.finishedAt),
    };
  }

  return {
    ...timerState,
    startedAt: now,
    finishedAt: null,
  };
}

function stopTimer(timerState = {}, now = Date.now()) {
  const startedAt = normalizeTimestamp(timerState.startedAt);
  const finishedAt = normalizeTimestamp(timerState.finishedAt);

  if (startedAt === null) {
    return {
      ...timerState,
      startedAt: null,
      finishedAt: null,
    };
  }

  return {
    ...timerState,
    startedAt,
    finishedAt: finishedAt ?? now,
  };
}

function getElapsedSeconds(timerState = {}, now = Date.now()) {
  const startedAt = normalizeTimestamp(timerState.startedAt);

  if (startedAt === null) {
    return 0;
  }

  const finishedAt = normalizeTimestamp(timerState.finishedAt);
  const endTime = finishedAt ?? now;
  return Math.max(0, Math.floor((endTime - startedAt) / 1000));
}

function shouldTickTimer(timerState = {}) {
  return normalizeTimestamp(timerState.startedAt) !== null && !timerState.gameOver;
}

const exported = {
  getElapsedSeconds,
  startTimer,
  stopTimer,
  shouldTickTimer,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = exported;
}

if (typeof globalThis !== 'undefined') {
  globalThis.MineCoTimer = exported;
}

if (typeof window !== 'undefined') {
  window.MineCoTimer = exported;
}
