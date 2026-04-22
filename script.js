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
const flagModeButton = document.getElementById("flag-mode-button");
const copyRoomCodeButton = document.getElementById("copy-room-code-button");

const {
  getPrimaryAction: getTilePrimaryAction,
  getFlagModeButtonLabel: getFlagModeButtonText,
  getFlagModeStatusMessage: getFlagModeTouchMessage,
  shouldFlagOnLongPress: shouldTriggerFlagOnLongPress,
  getCopyRoomCodeButtonLabel: getCopyRoomCodeButtonText,
  getCopyRoomCodeStatusMessage: getCopyRoomCodeMessage,
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
  localState: createLocalPlaceholder(),
};

function createLocalPlaceholder() {
  return {
    level: "beginner",
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
  renderBoard();
  renderRoster();
  updateHUD();
  updateStatus();
  updateIdentity();
}

function renderBoard() {
  const state = client.localState;
  boardElement.innerHTML = "";
  boardElement.style.gridTemplateColumns = `repeat(${state.cols}, minmax(0, 1fr))`;

  const canInteract = Boolean(client.roomCode) && !state.gameOver && state.players.length >= 1;

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
}

function updateStatus() {
  const state = client.localState;

  if (!client.roomCode) {
    setStatus("Create a room or join a friend to start playing together.");
    resetButton.textContent = ":)";
    return;
  }

  if (state.players.length < 2) {
    if (state.firstMove) {
      setStatus("Solo mode is ready. Start now, or share the code to turn it into co-op.");
    } else if (state.lastAction) {
      const actor = state.players.find((player) => player.playerNumber === state.lastAction.playerNumber);
      const verb = state.lastAction.type === "flag" ? "flagged" : "revealed";
      setStatus(`${actor ? actor.name : "You"} ${verb} row ${state.lastAction.row + 1}, column ${state.lastAction.col + 1}. Share the code anytime for co-op.`);
    } else {
      setStatus("Solo mode is ready. Start now, or share the code to turn it into co-op.");
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

  if (!roomCode) {
    setStatus(getCopyRoomCodeMessage('', false));
    return;
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(roomCode);
    } else {
      const helperInput = document.createElement('input');
      helperInput.value = roomCode;
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
    setStatus(`Could not copy room code ${roomCode}. Copy it manually.`);
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
    const payload = await requestJson("/api/rooms", {
      method: "POST",
      body: JSON.stringify({ level }),
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
  if (!client.roomCode || !client.playerId) {
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
roomCodeInput.addEventListener("input", () => {
  roomCodeInput.value = roomCodeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
});

window.addEventListener("beforeunload", () => {
  if (client.eventSource) {
    client.eventSource.close();
  }
});

updateFlagModeButton();
renderBoard();
updateHUD();
updateStatus();
updateIdentity();
