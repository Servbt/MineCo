const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');

const BASE_URL = 'http://127.0.0.1:3100';

function startServer() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['server.js'], {
      cwd: process.cwd(),
      env: { ...process.env, PORT: '3100' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const cleanup = () => {
      child.stdout.off('data', onStdout);
      child.stderr.off('data', onStderr);
      child.off('exit', onExit);
    };

    const onStdout = (chunk) => {
      if (chunk.toString().includes('server running')) {
        cleanup();
        resolve(child);
      }
    };

    const onStderr = (chunk) => {
      cleanup();
      reject(new Error(chunk.toString()));
    };

    const onExit = (code) => {
      cleanup();
      reject(new Error(`server exited before startup with code ${code}`));
    };

    child.stdout.on('data', onStdout);
    child.stderr.on('data', onStderr);
    child.on('exit', onExit);
  });
}

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  const body = await response.json();
  return { response, body };
}

test('a room creator can reveal tiles before a second player joins', async () => {
  const server = await startServer();

  try {
    const createResult = await request('/api/rooms', {
      method: 'POST',
      body: JSON.stringify({ level: 'beginner' }),
    });

    assert.equal(createResult.response.status, 201);

    const actionResult = await request(`/api/rooms/${createResult.body.roomCode}/action`, {
      method: 'POST',
      body: JSON.stringify({
        playerId: createResult.body.playerId,
        type: 'reveal',
        row: 0,
        col: 0,
      }),
    });

    assert.equal(actionResult.response.status, 200);
    assert.deepEqual(actionResult.body, { ok: true });
  } finally {
    server.kill('SIGTERM');
  }
});

test('a second player can still join after solo play has already started', async () => {
  const server = await startServer();

  try {
    const createResult = await request('/api/rooms', {
      method: 'POST',
      body: JSON.stringify({ level: 'beginner' }),
    });

    await request(`/api/rooms/${createResult.body.roomCode}/action`, {
      method: 'POST',
      body: JSON.stringify({
        playerId: createResult.body.playerId,
        type: 'reveal',
        row: 0,
        col: 0,
      }),
    });

    const joinResult = await request(`/api/rooms/${createResult.body.roomCode}/join`, {
      method: 'POST',
      body: JSON.stringify({}),
    });

    assert.equal(joinResult.response.status, 200);
    assert.ok(joinResult.body.playerId);
  } finally {
    server.kill('SIGTERM');
  }
});

test('a saved player session can be validated for reconnect after refresh', async () => {
  const server = await startServer();

  try {
    const createResult = await request('/api/rooms', {
      method: 'POST',
      body: JSON.stringify({ level: 'beginner' }),
    });

    const reconnectResult = await request(
      `/api/rooms/${createResult.body.roomCode}/session?playerId=${encodeURIComponent(createResult.body.playerId)}`,
    );

    assert.equal(reconnectResult.response.status, 200);
    assert.deepEqual(reconnectResult.body, {
      ok: true,
      roomCode: createResult.body.roomCode,
      playerId: createResult.body.playerId,
      playMode: 'simultaneous',
      currentTurnPlayerNumber: 1,
    });
  } finally {
    server.kill('SIGTERM');
  }
});

test('reconnect validation rejects stale player sessions', async () => {
  const server = await startServer();

  try {
    const createResult = await request('/api/rooms', {
      method: 'POST',
      body: JSON.stringify({ level: 'beginner' }),
    });

    const reconnectResult = await request(
      `/api/rooms/${createResult.body.roomCode}/session?playerId=missing-player`,
    );

    assert.equal(reconnectResult.response.status, 400);
    assert.equal(reconnectResult.body.error, 'Player not found in this room.');
  } finally {
    server.kill('SIGTERM');
  }
});

test('turn-based rooms reject a move from the wrong player', async () => {
  const server = await startServer();

  try {
    const createResult = await request('/api/rooms', {
      method: 'POST',
      body: JSON.stringify({ level: 'beginner', playMode: 'turn-based' }),
    });

    const joinResult = await request(`/api/rooms/${createResult.body.roomCode}/join`, {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const wrongTurnResult = await request(`/api/rooms/${createResult.body.roomCode}/action`, {
      method: 'POST',
      body: JSON.stringify({
        playerId: joinResult.body.playerId,
        type: 'reveal',
        row: 0,
        col: 0,
      }),
    });

    assert.equal(wrongTurnResult.response.status, 400);
    assert.equal(wrongTurnResult.body.error, 'It is not your turn yet.');
  } finally {
    server.kill('SIGTERM');
  }
});

test('turn-based rooms hand the turn to the other player after a valid move', async () => {
  const server = await startServer();

  try {
    const createResult = await request('/api/rooms', {
      method: 'POST',
      body: JSON.stringify({ level: 'beginner', playMode: 'turn-based' }),
    });

    const joinResult = await request(`/api/rooms/${createResult.body.roomCode}/join`, {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const firstMoveResult = await request(`/api/rooms/${createResult.body.roomCode}/action`, {
      method: 'POST',
      body: JSON.stringify({
        playerId: createResult.body.playerId,
        type: 'reveal',
        row: 0,
        col: 0,
      }),
    });

    assert.equal(firstMoveResult.response.status, 200);

    const roomStateResult = await request(
      `/api/rooms/${createResult.body.roomCode}/session?playerId=${encodeURIComponent(joinResult.body.playerId)}`,
    );

    assert.equal(roomStateResult.response.status, 200);
    assert.equal(roomStateResult.body.playMode, 'turn-based');
    assert.equal(roomStateResult.body.currentTurnPlayerNumber, 2);

    const secondMoveResult = await request(`/api/rooms/${createResult.body.roomCode}/action`, {
      method: 'POST',
      body: JSON.stringify({
        playerId: joinResult.body.playerId,
        type: 'flag',
        row: 0,
        col: 1,
      }),
    });

    assert.equal(secondMoveResult.response.status, 200);
  } finally {
    server.kill('SIGTERM');
  }
});
