const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";
const ROOT = __dirname;

const DIFFICULTIES = {
  beginner: { rows: 9, cols: 9, mines: 10 },
  intermediate: { rows: 16, cols: 16, mines: 40 },
  expert: { rows: 16, cols: 30, mines: 99 },
};

const rooms = new Map();

function createBoard(rows, cols) {
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

function createRoom(level) {
  const settings = DIFFICULTIES[level] || DIFFICULTIES.beginner;
  const roomCode = generateRoomCode();
  const room = {
    roomCode,
    level,
    rows: settings.rows,
    cols: settings.cols,
    mineTotal: settings.mines,
    board: createBoard(settings.rows, settings.cols),
    firstMove: true,
    gameOver: false,
    revealedSafeTiles: 0,
    flagCount: 0,
    startedAt: null,
    elapsedSeconds: 0,
    players: [],
    watchers: new Set(),
    lastAction: null,
  };

  rooms.set(roomCode, room);
  return room;
}

function resetRoom(room, level) {
  const nextLevel = DIFFICULTIES[level] ? level : room.level;
  const settings = DIFFICULTIES[nextLevel];

  room.level = nextLevel;
  room.rows = settings.rows;
  room.cols = settings.cols;
  room.mineTotal = settings.mines;
  room.board = createBoard(settings.rows, settings.cols);
  room.firstMove = true;
  room.gameOver = false;
  room.revealedSafeTiles = 0;
  room.flagCount = 0;
  room.startedAt = null;
  room.elapsedSeconds = 0;
  room.lastAction = null;
}

function generateRoomCode() {
  let roomCode = "";

  do {
    roomCode = crypto.randomBytes(3).toString("hex").toUpperCase();
  } while (rooms.has(roomCode));

  return roomCode;
}

function addPlayer(room) {
  if (room.players.length >= 2) {
    throw new Error("Room is full.");
  }

  const player = {
    playerId: crypto.randomUUID(),
    playerNumber: room.players.length + 1,
    name: `Player ${room.players.length + 1}`,
  };

  room.players.push(player);
  return player;
}

function getNeighbors(room, row, col) {
  const neighbors = [];

  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
      if (rowOffset === 0 && colOffset === 0) {
        continue;
      }

      const nextRow = row + rowOffset;
      const nextCol = col + colOffset;

      if (nextRow < 0 || nextRow >= room.rows || nextCol < 0 || nextCol >= room.cols) {
        continue;
      }

      neighbors.push(room.board[nextRow][nextCol]);
    }
  }

  return neighbors;
}

function shuffle(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[randomIndex]] = [items[randomIndex], items[index]];
  }
}

function placeMines(room, safeRow, safeCol) {
  const candidates = [];

  for (let row = 0; row < room.rows; row += 1) {
    for (let col = 0; col < room.cols; col += 1) {
      const rowDistance = Math.abs(row - safeRow);
      const colDistance = Math.abs(col - safeCol);

      if (rowDistance <= 1 && colDistance <= 1) {
        continue;
      }

      candidates.push([row, col]);
    }
  }

  shuffle(candidates);

  for (let index = 0; index < room.mineTotal; index += 1) {
    const [row, col] = candidates[index];
    room.board[row][col].isMine = true;
  }

  for (let row = 0; row < room.rows; row += 1) {
    for (let col = 0; col < room.cols; col += 1) {
      const cell = room.board[row][col];

      if (cell.isMine) {
        cell.neighborMines = 0;
        continue;
      }

      cell.neighborMines = getNeighbors(room, row, col).filter((neighbor) => neighbor.isMine).length;
    }
  }
}

function revealArea(room, startRow, startCol, playerNumber) {
  const queue = [[startRow, startCol]];

  while (queue.length > 0) {
    const [row, col] = queue.shift();

    for (const neighbor of getNeighbors(room, row, col)) {
      if (neighbor.isRevealed || neighbor.isFlagged || neighbor.isMine) {
        continue;
      }

      neighbor.isRevealed = true;
      neighbor.revealedBy = playerNumber;
      room.revealedSafeTiles += 1;

      if (neighbor.neighborMines === 0) {
        queue.push([neighbor.row, neighbor.col]);
      }
    }
  }
}

function revealCell(room, row, col, playerNumber) {
  const cell = room.board[row]?.[col];

  if (!cell || room.gameOver || cell.isRevealed || cell.isFlagged) {
    return;
  }

  if (room.firstMove) {
    placeMines(room, row, col);
    room.firstMove = false;
    room.startedAt = Date.now();
  }

  cell.isRevealed = true;
  cell.revealedBy = playerNumber;
  room.lastAction = { type: "reveal", row, col, playerNumber };

  if (cell.isMine) {
    room.gameOver = true;

    for (const boardRow of room.board) {
      for (const boardCell of boardRow) {
        if (boardCell.isMine) {
          boardCell.isRevealed = true;
        }
      }
    }

    return;
  }

  room.revealedSafeTiles += 1;

  if (cell.neighborMines === 0) {
    revealArea(room, row, col, playerNumber);
  }

  if (room.revealedSafeTiles === room.rows * room.cols - room.mineTotal) {
    room.gameOver = true;

    for (const boardRow of room.board) {
      for (const boardCell of boardRow) {
        if (boardCell.isMine && !boardCell.isFlagged) {
          boardCell.isFlagged = true;
          boardCell.flaggedBy = playerNumber;
          room.flagCount += 1;
        }
      }
    }
  }
}

function toggleFlag(room, row, col, playerNumber) {
  const cell = room.board[row]?.[col];

  if (!cell || room.gameOver || cell.isRevealed) {
    return;
  }

  cell.isFlagged = !cell.isFlagged;
  cell.flaggedBy = cell.isFlagged ? playerNumber : null;
  room.flagCount += cell.isFlagged ? 1 : -1;
  room.lastAction = { type: "flag", row, col, playerNumber };
}

function serializeRoom(room, playerId) {
  const player = room.players.find((entry) => entry.playerId === playerId) || null;

  return {
    playerId,
    playerNumber: player ? player.playerNumber : null,
    gameState: {
      roomCode: room.roomCode,
      level: room.level,
      rows: room.rows,
      cols: room.cols,
      mineTotal: room.mineTotal,
      board: room.board,
      firstMove: room.firstMove,
      gameOver: room.gameOver,
      revealedSafeTiles: room.revealedSafeTiles,
      flagCount: room.flagCount,
      startedAt: room.startedAt,
      elapsedSeconds: room.startedAt ? Math.floor((Date.now() - room.startedAt) / 1000) : 0,
      players: room.players,
      lastAction: room.lastAction,
    },
  };
}

function broadcastRoom(room) {
  for (const watcher of room.watchers) {
    watcher.write(`data: ${JSON.stringify(serializeRoom(room, watcher.playerId))}\n\n`);
  }
}

function getJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
    });

    request.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });

    request.on("error", reject);
  });
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function sendFile(response, filename) {
  const filePath = path.join(ROOT, filename);
  const extension = path.extname(filePath);
  const contentType = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
  }[extension] || "application/octet-stream";

  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendJson(response, 404, { error: "Not found" });
      return;
    }

    response.writeHead(200, { "Content-Type": contentType });
    response.end(content);
  });
}

function getRoomOrFail(roomCode) {
  const room = rooms.get(roomCode);

  if (!room) {
    throw new Error("Room not found.");
  }

  return room;
}

function requirePlayer(room, playerId) {
  const player = room.players.find((entry) => entry.playerId === playerId);

  if (!player) {
    throw new Error("Player not found in this room.");
  }

  return player;
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const pathname = url.pathname;

  try {
    if (request.method === "GET" && pathname === "/") {
      sendFile(response, "index.html");
      return;
    }

    if (request.method === "GET" && (pathname === "/styles.css" || pathname === "/script.js")) {
      sendFile(response, pathname.slice(1));
      return;
    }

    if (request.method === "POST" && pathname === "/api/rooms") {
      const body = await getJsonBody(request);
      const room = createRoom(body.level || "beginner");
      const player = addPlayer(room);

      sendJson(response, 201, {
        roomCode: room.roomCode,
        playerId: player.playerId,
      });
      return;
    }

    if (request.method === "POST" && /^\/api\/rooms\/[A-Z0-9]+\/join$/.test(pathname)) {
      const roomCode = pathname.split("/")[3];
      const room = getRoomOrFail(roomCode);
      const player = addPlayer(room);

      sendJson(response, 200, { playerId: player.playerId });
      broadcastRoom(room);
      return;
    }

    if (request.method === "GET" && /^\/api\/rooms\/[A-Z0-9]+\/events$/.test(pathname)) {
      const roomCode = pathname.split("/")[3];
      const playerId = url.searchParams.get("playerId");
      const room = getRoomOrFail(roomCode);

      requirePlayer(room, playerId);

      response.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      });

      response.write(`data: ${JSON.stringify(serializeRoom(room, playerId))}\n\n`);
      response.playerId = playerId;
      room.watchers.add(response);

      const keepAlive = setInterval(() => {
        response.write(": keep-alive\n\n");
      }, 15000);

      request.on("close", () => {
        clearInterval(keepAlive);
        room.watchers.delete(response);
      });

      return;
    }

    if (request.method === "POST" && /^\/api\/rooms\/[A-Z0-9]+\/action$/.test(pathname)) {
      const roomCode = pathname.split("/")[3];
      const room = getRoomOrFail(roomCode);
      const body = await getJsonBody(request);
      const player = requirePlayer(room, body.playerId);

      if (body.type === "reveal") {
        revealCell(room, body.row, body.col, player.playerNumber);
      } else if (body.type === "flag") {
        toggleFlag(room, body.row, body.col, player.playerNumber);
      } else {
        throw new Error("Unknown action.");
      }

      broadcastRoom(room);
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === "POST" && /^\/api\/rooms\/[A-Z0-9]+\/reset$/.test(pathname)) {
      const roomCode = pathname.split("/")[3];
      const room = getRoomOrFail(roomCode);
      const body = await getJsonBody(request);

      requirePlayer(room, body.playerId);
      resetRoom(room, body.level || room.level);
      broadcastRoom(room);
      sendJson(response, 200, { ok: true });
      return;
    }

    sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    sendJson(response, 400, { error: error.message || "Request failed" });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Co-op Minesweeper server running on http://${HOST}:${PORT}`);
});
