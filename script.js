const DIFFICULTIES = {
  beginner: { rows: 9, cols: 9, mines: 10 },
  intermediate: { rows: 16, cols: 16, mines: 40 },
  expert: { rows: 16, cols: 30, mines: 99 },
};

const boardElement = document.getElementById("board");
const resetButton = document.getElementById("reset-button");
const difficultySelect = document.getElementById("difficulty");
const mineCountElement = document.getElementById("mine-count");
const timerElement = document.getElementById("timer");
const statusElement = document.getElementById("status");
const roomCodeElement = document.getElementById("room-code");
const playerCountElement = document.getElementById("player-count");
const rosterElement = document.getElementById("roster");
const playerNameElement = document.getElementById("player-name");
const createRoomButton = document.getElementById("create-room-button");
const joinRoomButton = document.getElementById("join-room-button");
const roomCodeInput = document.getElementById("room-code-input");
const playModeSelect = document.getElementById("play-mode");
const colorSchemeSelect = document.getElementById("color-scheme");
const flagModeButton = document.getElementById("flag-mode-button");
const copyRoomCodeButton = document.getElementById("copy-room-code-button");
const shareRoomCodeButton = document.getElementById("share-room-code-button");

const {
  getPrimaryAction: getTilePrimaryAction,
  getFlagModeButtonLabel: getFlagModeButtonText,
  getFlagModeStatusMessage: getFlagModeTouchMessage,
  shouldFlagOnLongPress: shouldTriggerFlagOnLongPress,
  getCopyRoomCodeButtonLabel: getCopyRoomCodeButtonText,
  getCopyRoomCodeStatusMessage: getCopyRoomCodeMessage,
  supportsNativeShare: canUseNativeShare,
  getShareRoomCodeButtonLabel: getShareRoomCodeButtonText,
  getShareRoomCodeStatusMessage: getShareRoomCodeMessage,
  getLongPressVibrationPattern: getLongPressVibrationPulse,
  getInviteLink: getRoomInviteLink,
  getRoomCodeFromLocationSearch: getRoomCodeFromUrlSearch,
  getReconnectStorageKey: getReconnectStorageKeyName,
  createReconnectState: buildReconnectState,
  parseReconnectState: parseSavedReconnectState,
  getAvailableColorSchemes: getThemeOptions,
  normalizeColorScheme: normalizeThemeId,
  getColorSchemeStorageKey: getColorSchemeStorageKeyName,
} = window.MineCoInteractionMode;

const PLAYER_COLORS = {
  1: "player-1",
  2: "player-2",
};

const client = {
  playerId: null,
  playerNumber: null,
  roomCode: null,
  eventSource: null,
  timerId: null,
  flagMode: false,
  colorScheme: normalizeThemeId('sunset'),
  roomCodeCopied: false,
  roomCodeCopyTimeoutId: null,
  longPress: {
    timerId: null,
    startedAt: 0,
    tileKey: null,
    pointerId: null,
    handled: false,
  },
  suppressClickTileKey: null,
  pendingReconnectNotice: null,
  localState: createLocalPlaceholder(),
};

function createLocalPlaceholder() {
  return {
    level: "beginner",
    playMode: "simultaneous",
    rows: DIFFICULTIES.beginner.rows,
    cols: DIFFICULTIES.beginner.cols,
    mineTotal: DIFFICULTIES.beginner.mines,
    board: buildBoard(DIFFICULTIES.beginner.rows, DIFFICULTIES.beginner.cols),
    firstMove: true,
    gameOver: false,
    revealedSafeTiles: 0,
    flagCount: 0,
    startedAt: null,
    elapsedSeconds: 0,
    players: [],
    currentTurnPlayerNumber: 1,
    roomCode: null,
    lastAction: null,
  };
}

function buildBoard(rows, cols) {
  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => ({
      row,
      col,
      isMine: false,
      isRevealed: false,
      isFlagged: false,
      neighborMines: 0,
      revealedBy: null,
      flaggedBy: null,
    })),
  );
}

function getColorSchemeStorage() {
  try {
    return window.localStorage;
  } catch (error) {
    return null;
  }
}

function applyColorScheme(colorScheme) {
  const normalizedColorScheme = normalizeThemeId(colorScheme);
  client.colorScheme = normalizedColorScheme;
  document.body.dataset.theme = normalizedColorScheme;

  if (colorSchemeSelect) {
    colorSchemeSelect.value = normalizedColorScheme;
  }

  return normalizedColorScheme;
}

function persistColorScheme(colorScheme = client.colorScheme) {
  const storage = getColorSchemeStorage();

  if (!storage) {
    return;
  }

  storage.setItem(getColorSchemeStorageKeyName(), normalizeThemeId(colorScheme));
}

function restoreColorScheme() {
  const storage = getColorSchemeStorage();
  const savedColorScheme = storage ? storage.getItem(getColorSchemeStorageKeyName()) : null;
  return applyColorScheme(savedColorScheme);
}

function populateColorSchemeOptions() {
  colorSchemeSelect.innerHTML = '';

  for (const scheme of getThemeOptions()) {
    const option = document.createElement('option');
    option.value = scheme.id;
    option.textContent = `${scheme.label} · ${scheme.accent} / ${scheme.accentAlt}`;
    colorSchemeSelect.appendChild(option);
  }

  colorSchemeSelect.value = client.colorScheme;
}

function updateFromServer(payload) {
  const previousRoomCode = client.localState.roomCode;

  client.playerId = payload.playerId;
  client.playerNumber = payload.playerNumber;
  client.localState = payload.gameState;

  if (previousRoomCode !== client.localState.roomCode) {
    client.roomCodeCopied = false;
    if (client.roomCodeCopyTimeoutId) {
      clearTimeout(client.roomCodeCopyTimeoutId);
      client.roomCodeCopyTimeoutId = null;
    }
  }

  difficultySelect.value = client.localState.level;
  playModeSelect.value = client.localState.playMode || "simultaneous";
  renderBoard();
  renderRoster();
  updateHUD();
  updateStatus();
  updateIdentity();

  if (client.pendingReconnectNotice) {
    setStatus(client.pendingReconnectNotice);
    client.pendingReconnectNotice = null;
  }
}

function isTurnBasedRoom(state = client.localState) {
  return state.playMode === "turn-based";
}

function isCurrentPlayersTurn(state = client.localState) {
  if (!isTurnBasedRoom(state) || state.players.length < 2) {
    return true;
  }

  return client.playerNumber === state.currentTurnPlayerNumber;
}

function renderBoard() {
  const state = client.localState;
  boardElement.innerHTML = "";
  boardElement.style.gridTemplateColumns = `repeat(${state.cols}, minmax(0, 1fr))`;

  const canInteract = Boolean(client.roomCode)
    && !state.gameOver
    && state.players.length >= 1
    && isCurrentPlayersTurn(state);

  for (let row = 0; row < state.rows; row += 1) {
    for (let col = 0; col < state.cols; col += 1) {
      const cell = state.board[row][col];
      const button = document.createElement("button");

      button.type = "button";
      button.className = "tile";
      button.dataset.row = String(row);
      button.dataset.col = String(col);
      button.setAttribute("role", "gridcell");
      button.setAttribute("aria-label", describeCell(cell));
      button.disabled = !canInteract;

      if (cell.isRevealed) {
        button.classList.add("revealed");

        if (cell.isMine) {
          button.classList.add("mine");
          button.textContent = "*";
        } else if (cell.neighborMines > 0) {
          button.textContent = String(cell.neighborMines);
          button.classList.add(`n${cell.neighborMines}`);
        }
      } else if (cell.isFlagged) {
        button.classList.add("flagged");
        button.textContent = "F";
      }

      if (state.lastAction && state.lastAction.row === row && state.lastAction.col === col) {
        const colorClass = PLAYER_COLORS[state.lastAction.playerNumber];

        if (colorClass) {
          button.classList.add(`last-${colorClass}`);
        }
      }

      boardElement.appendChild(button);
    }
  }
}

function renderRoster() {
  const players = client.localState.players || [];
  rosterElement.innerHTML = "";

  for (const player of players) {
    const chip = document.createElement("div");
    chip.className = `player-chip player-${player.playerNumber}`;
    chip.textContent = `${player.name}${player.playerId === client.playerId ? " (you)" : ""}`;
    rosterElement.appendChild(chip);
  }

  if (players.length === 1) {
    const waiting = document.createElement("div");
    waiting.className = "player-chip";
    waiting.textContent = "Waiting for player 2";
    rosterElement.appendChild(waiting);
  }
}

function updateHUD() {
  const state = client.localState;
  const minesLeft = Math.max(state.mineTotal - state.flagCount, 0);

  mineCountElement.textContent = String(minesLeft).padStart(3, "0");
  timerElement.textContent = String(Math.min(state.elapsedSeconds, 999)).padStart(3, "0");
  roomCodeElement.textContent = state.roomCode || "------";
  playerCountElement.textContent = `${state.players.length} / 2`;
  copyRoomCodeButton.disabled = !state.roomCode;
  copyRoomCodeButton.textContent = getCopyRoomCodeButtonText(client.roomCodeCopied && Boolean(state.roomCode));
  const shareAvailable = canUseNativeShare(navigator.share, state.roomCode);
  shareRoomCodeButton.disabled = !shareAvailable;
  shareRoomCodeButton.textContent = getShareRoomCodeButtonText(shareAvailable);
}

function updateStatus() {
  const state = client.localState;
  const activePlayer = state.players.find((player) => player.playerNumber === state.currentTurnPlayerNumber);
  const activePlayerName = activePlayer ? activePlayer.name : `Player ${state.currentTurnPlayerNumber || 1}`;

  if (!client.roomCode) {
    setStatus("Create a room or join a friend to start playing together.");
    resetButton.textContent = ":)";
    return;
  }

  if (state.players.length < 2) {
    if (state.firstMove) {
      setStatus(
        isTurnBasedRoom(state)
          ? "Turn-based mode is ready. Player 1 will start, and player 2 can join anytime."
          : "Solo mode is ready. Start now, or share the invite link to turn it into co-op.",
      );
    } else if (state.lastAction) {
      const actor = state.players.find((player) => player.playerNumber === state.lastAction.playerNumber);
      const verb = state.lastAction.type === "flag" ? "flagged" : "revealed";
      setStatus(
        isTurnBasedRoom(state)
          ? `${actor ? actor.name : "You"} ${verb} row ${state.lastAction.row + 1}, column ${state.lastAction.col + 1}. Player 2 will take the next turn when they join.`
          : `${actor ? actor.name : "You"} ${verb} row ${state.lastAction.row + 1}, column ${state.lastAction.col + 1}. Share the invite link anytime for co-op.`,
      );
    } else {
      setStatus(
        isTurnBasedRoom(state)
          ? "Turn-based mode is ready. Player 1 will start, and player 2 can join anytime."
          : "Solo mode is ready. Start now, or share the invite link to turn it into co-op.",
      );
    }
    resetButton.textContent = ":)";
    return;
  }

  if (state.gameOver) {
    const lost = state.lastAction && state.board[state.lastAction.row][state.lastAction.col].isMine;
    setStatus(lost ? "Boom. The team hit a mine." : "Board cleared. Team victory.");
    resetButton.textContent = lost ? "X(" : "B)";
    return;
  }

  if (isTurnBasedRoom(state)) {
    if (state.firstMove) {
      setStatus(`${activePlayerName} goes first in turn-based mode.`);
    } else if (state.lastAction) {
      const actor = state.players.find((player) => player.playerNumber === state.lastAction.playerNumber);
      const verb = state.lastAction.type === "flag" ? "flagged" : "revealed";
      setStatus(`${actor ? actor.name : "A player"} ${verb} row ${state.lastAction.row + 1}, column ${state.lastAction.col + 1}. ${activePlayerName} is up next.`);
    } else {
      setStatus(`${activePlayerName} is up first in turn-based mode.`);
    }

    resetButton.textContent = ":)";
    return;
  }

  if (state.firstMove) {
    setStatus("Both players are connected. Make the first move together.");
  } else if (state.lastAction) {
    const actor = state.players.find((player) => player.playerNumber === state.lastAction.playerNumber);
    const verb = state.lastAction.type === "flag" ? "flagged" : "revealed";
    setStatus(`${actor ? actor.name : "A player"} ${verb} row ${state.lastAction.row + 1}, column ${state.lastAction.col + 1}.`);
  } else {
    setStatus("Both players are connected. Start clearing the board.");
  }

  resetButton.textContent = ":)";
}

function updateIdentity() {
  const label = client.playerNumber ? `Player ${client.playerNumber}` : "Spectator";
  playerNameElement.textContent = label;
}

function describeCell(cell) {
  if (cell.isFlagged) {
    return `Flagged row ${cell.row + 1} column ${cell.col + 1}`;
  }

  if (!cell.isRevealed) {
    return `Hidden row ${cell.row + 1} column ${cell.col + 1}`;
  }

  if (cell.isMine) {
    return `Mine at row ${cell.row + 1} column ${cell.col + 1}`;
  }

  if (cell.neighborMines === 0) {
    return `Empty row ${cell.row + 1} column ${cell.col + 1}`;
  }

  return `${cell.neighborMines} adjacent mines at row ${cell.row + 1} column ${cell.col + 1}`;
}

function setStatus(message) {
  statusElement.textContent = message;
}

function getInviteLinkForRoom(roomCode = client.localState.roomCode) {
  return getRoomInviteLink(roomCode, window.location.origin, window.location.pathname);
}

function syncRoomCodeToUrl(roomCode) {
  if (!window.history?.replaceState) {
    return;
  }

  const nextUrl = new URL(window.location.href);
  const normalizedRoomCode = getRoomCodeFromUrlSearch(`?room=${roomCode || ''}`);

  if (normalizedRoomCode) {
    nextUrl.searchParams.set('room', normalizedRoomCode);
  } else {
    nextUrl.searchParams.delete('room');
  }

  window.history.replaceState({}, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
}

function restoreRoomCodeFromUrl() {
  const roomCodeFromUrl = getRoomCodeFromUrlSearch(window.location.search);

  if (!roomCodeFromUrl) {
    return false;
  }

  roomCodeInput.value = roomCodeFromUrl;
  setStatus(`Room code ${roomCodeFromUrl} loaded from the invite link. Tap Join when you're ready.`);
  return true;
}

function getReconnectSessionStorage() {
  try {
    return window.localStorage;
  } catch (error) {
    return null;
  }
}

function persistReconnectState(roomCode = client.roomCode, playerId = client.playerId) {
  const storage = getReconnectSessionStorage();
  const reconnectState = buildReconnectState(roomCode, playerId);

  if (!storage || !reconnectState) {
    return;
  }

  storage.setItem(getReconnectStorageKeyName(), JSON.stringify(reconnectState));
}

function clearReconnectState() {
  const storage = getReconnectSessionStorage();

  if (!storage) {
    return;
  }

  storage.removeItem(getReconnectStorageKeyName());
}

function getSavedReconnectState() {
  const storage = getReconnectSessionStorage();

  if (!storage) {
    return null;
  }

  return parseSavedReconnectState(storage.getItem(getReconnectStorageKeyName()));
}

async function validateReconnectState(reconnectState) {
  return requestJson(
    `/api/rooms/${reconnectState.roomCode}/session?playerId=${encodeURIComponent(reconnectState.playerId)}`,
  );
}

async function reconnectToLastRoom() {
  const roomCodeFromUrl = getRoomCodeFromUrlSearch(window.location.search);
  const reconnectState = getSavedReconnectState();

  if (roomCodeFromUrl && (!reconnectState || reconnectState.roomCode !== roomCodeFromUrl)) {
    restoreRoomCodeFromUrl();
    return;
  }

  if (!reconnectState) {
    restoreRoomCodeFromUrl();
    return;
  }

  try {
    await validateReconnectState(reconnectState);
    client.pendingReconnectNotice = `Reconnected to room ${reconnectState.roomCode} after refresh.`;
    connectToRoom(reconnectState.roomCode, reconnectState.playerId);
  } catch (error) {
    clearReconnectState();

    if (!restoreRoomCodeFromUrl()) {
      setStatus('Your last room is no longer available. Create a room or join a friend to start playing together.');
    }
  }
}

function getTileKey(row, col) {
  return `${row}:${col}`;
}

function clearLongPressTimer() {
  if (client.longPress.timerId) {
    clearTimeout(client.longPress.timerId);
    client.longPress.timerId = null;
  }
}

function resetLongPressState() {
  clearLongPressTimer();
  client.longPress.startedAt = 0;
  client.longPress.tileKey = null;
  client.longPress.pointerId = null;
  client.longPress.handled = false;
}

function updateFlagModeButton() {
  flagModeButton.textContent = getFlagModeButtonText(client.flagMode);
  flagModeButton.setAttribute("aria-pressed", String(client.flagMode));
  flagModeButton.classList.toggle("active", client.flagMode);
}

function toggleFlagMode() {
  client.flagMode = !client.flagMode;
  updateFlagModeButton();
  setStatus(getFlagModeTouchMessage(client.flagMode));
}

async function copyRoomCode() {
  const roomCode = client.localState.roomCode;
  const inviteLink = getInviteLinkForRoom(roomCode);

  if (!inviteLink) {
    setStatus(getCopyRoomCodeMessage('', false));
    return;
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(inviteLink);
    } else {
      const helperInput = document.createElement('input');
      helperInput.value = inviteLink;
      document.body.appendChild(helperInput);
      helperInput.select();
      document.execCommand('copy');
      helperInput.remove();
    }

    client.roomCodeCopied = true;
    if (client.roomCodeCopyTimeoutId) {
      clearTimeout(client.roomCodeCopyTimeoutId);
    }
    client.roomCodeCopyTimeoutId = setTimeout(() => {
      client.roomCodeCopied = false;
      updateHUD();
    }, 1600);
    updateHUD();
    setStatus(getCopyRoomCodeMessage(roomCode, true));
  } catch (error) {
    setStatus(`Could not copy the invite link for room ${roomCode}. Copy it manually.`);
  }
}

async function shareRoomCode() {
  const roomCode = client.localState.roomCode;
  const inviteLink = getInviteLinkForRoom(roomCode);

  if (!inviteLink) {
    setStatus(getShareRoomCodeMessage('', false));
    return;
  }

  if (!canUseNativeShare(navigator.share, roomCode)) {
    setStatus(`Sharing is not available on this device. Use the invite link for room ${roomCode} manually.`);
    return;
  }

  try {
    await navigator.share({
      title: 'MineCo invite',
      text: `Join my MineCo room with code ${roomCode}.`,
      url: inviteLink,
    });
    setStatus(getShareRoomCodeMessage(roomCode, true));
  } catch (error) {
    if (error?.name !== 'AbortError') {
      setStatus(`Could not open the share sheet for room ${roomCode}.`);
    }
  }
}

function pulseLongPressFeedback() {
  if (typeof navigator.vibrate === 'function') {
    navigator.vibrate(getLongPressVibrationPulse());
  }
}

function beginLongPress(tile, pointerId) {
  if (client.flagMode) {
    return;
  }

  const row = Number(tile.dataset.row);
  const col = Number(tile.dataset.col);
  const tileKey = getTileKey(row, col);

  resetLongPressState();
  client.longPress.startedAt = Date.now();
  client.longPress.tileKey = tileKey;
  client.longPress.pointerId = pointerId;
  client.longPress.timerId = setTimeout(() => {
    client.longPress.handled = true;
    client.suppressClickTileKey = tileKey;
    pulseLongPressFeedback();
    sendAction('flag', row, col);
  }, 250);
}

function endLongPress(tile, pointerId) {
  if (!client.longPress.tileKey) {
    return false;
  }

  const tileKey = getTileKey(Number(tile.dataset.row), Number(tile.dataset.col));
  const samePointer = client.longPress.pointerId === null || client.longPress.pointerId === pointerId;
  const handled = client.longPress.handled;
  const shouldHandle = samePointer && tileKey === client.longPress.tileKey;

  if (!shouldHandle) {
    return false;
  }

  const durationMs = Date.now() - client.longPress.startedAt;
  clearLongPressTimer();

  if (!handled && shouldTriggerFlagOnLongPress(durationMs, 250)) {
    client.longPress.handled = true;
    client.suppressClickTileKey = tileKey;
    sendAction('flag', Number(tile.dataset.row), Number(tile.dataset.col));
  }

  const wasHandled = client.longPress.handled;
  resetLongPressState();
  return wasHandled;
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Request failed");
  }

  return payload;
}

async function createRoom() {
  try {
    const level = difficultySelect.value;
    const playMode = playModeSelect.value;
    const payload = await requestJson("/api/rooms", {
      method: "POST",
      body: JSON.stringify({ level, playMode }),
    });

    connectToRoom(payload.roomCode, payload.playerId);
  } catch (error) {
    setStatus(error.message);
  }
}

async function joinRoom() {
  const roomCode = roomCodeInput.value.trim().toUpperCase();

  if (!roomCode) {
    setStatus("Enter a room code first.");
    return;
  }

  try {
    const payload = await requestJson(`/api/rooms/${roomCode}/join`, {
      method: "POST",
    });

    connectToRoom(roomCode, payload.playerId);
  } catch (error) {
    setStatus(error.message);
  }
}

function connectToRoom(roomCode, playerId) {
  client.roomCode = roomCode;
  client.playerId = playerId;
  roomCodeInput.value = roomCode;
  syncRoomCodeToUrl(roomCode);
  persistReconnectState(roomCode, playerId);

  if (client.eventSource) {
    client.eventSource.close();
  }

  const eventSource = new EventSource(
    `/api/rooms/${roomCode}/events?playerId=${encodeURIComponent(playerId)}`,
  );

  eventSource.onmessage = (event) => {
    updateFromServer(JSON.parse(event.data));
  };

  eventSource.onerror = () => {
    setStatus("Connection dropped. Trying to reconnect.");
  };

  client.eventSource = eventSource;
}

async function sendAction(type, row, col) {
  if (!client.roomCode || !client.playerId || !isCurrentPlayersTurn()) {
    return;
  }

  try {
    await requestJson(`/api/rooms/${client.roomCode}/action`, {
      method: "POST",
      body: JSON.stringify({
        playerId: client.playerId,
        type,
        row,
        col,
      }),
    });
  } catch (error) {
    setStatus(error.message);
  }
}

async function restartRoom() {
  if (!client.roomCode || !client.playerId) {
    setStatus("Create or join a room first.");
    return;
  }

  try {
    await requestJson(`/api/rooms/${client.roomCode}/reset`, {
      method: "POST",
      body: JSON.stringify({
        playerId: client.playerId,
        level: difficultySelect.value,
        playMode: playModeSelect.value,
      }),
    });
  } catch (error) {
    setStatus(error.message);
  }
}

boardElement.addEventListener("pointerdown", (event) => {
  const tile = event.target.closest(".tile");

  if (!tile || event.pointerType === "mouse") {
    return;
  }

  if (tile.setPointerCapture) {
    try {
      tile.setPointerCapture(event.pointerId);
    } catch (error) {
      // Synthetic events in tests/browser automation may not have an active pointer.
    }
  }

  beginLongPress(tile, event.pointerId);
});

boardElement.addEventListener("pointerup", (event) => {
  const tile = event.target.closest(".tile");

  if (!tile || event.pointerType === "mouse") {
    return;
  }

  endLongPress(tile, event.pointerId);
});

boardElement.addEventListener("pointercancel", () => {
  resetLongPressState();
});

boardElement.addEventListener("click", (event) => {
  const tile = event.target.closest(".tile");

  if (!tile) {
    return;
  }

  const tileKey = getTileKey(Number(tile.dataset.row), Number(tile.dataset.col));

  if (client.suppressClickTileKey === tileKey) {
    client.suppressClickTileKey = null;
    return;
  }

  const action = getTilePrimaryAction(client.flagMode);
  sendAction(action, Number(tile.dataset.row), Number(tile.dataset.col));
});

boardElement.addEventListener("contextmenu", (event) => {
  const tile = event.target.closest(".tile");

  if (!tile) {
    return;
  }

  event.preventDefault();
  sendAction("flag", Number(tile.dataset.row), Number(tile.dataset.col));
});

boardElement.addEventListener("keydown", (event) => {
  const tile = event.target.closest(".tile");

  if (!tile || event.key.toLowerCase() !== "f") {
    return;
  }

  event.preventDefault();
  sendAction("flag", Number(tile.dataset.row), Number(tile.dataset.col));
});

createRoomButton.addEventListener("click", createRoom);
joinRoomButton.addEventListener("click", joinRoom);
resetButton.addEventListener("click", restartRoom);
flagModeButton.addEventListener("click", toggleFlagMode);
copyRoomCodeButton.addEventListener("click", copyRoomCode);
shareRoomCodeButton.addEventListener("click", shareRoomCode);
colorSchemeSelect.addEventListener("change", () => {
  applyColorScheme(colorSchemeSelect.value);
  persistColorScheme();
});
roomCodeInput.addEventListener("input", () => {
  roomCodeInput.value = roomCodeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
});

window.addEventListener("beforeunload", () => {
  if (client.eventSource) {
    client.eventSource.close();
  }
});

updateFlagModeButton();
populateColorSchemeOptions();
restoreColorScheme();
renderBoard();
updateHUD();
updateStatus();
updateIdentity();
reconnectToLastRoom();
