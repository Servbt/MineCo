const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getElapsedSeconds,
  startTimer,
  stopTimer,
  shouldTickTimer,
} = require('../timer.js');

test('timer stays at zero until the first move starts it', () => {
  assert.equal(getElapsedSeconds({ startedAt: null, finishedAt: null }, 5_000), 0);
});

test('timer counts upward after the first move starts it', () => {
  const timer = startTimer({ startedAt: null, finishedAt: null }, 1_000);
  assert.equal(getElapsedSeconds(timer, 4_200), 3);
});

test('timer freezes once the game is lost or otherwise finished', () => {
  const started = startTimer({ startedAt: null, finishedAt: null }, 1_000);
  const finished = stopTimer(started, 4_400);

  assert.equal(getElapsedSeconds(finished, 4_400), 3);
  assert.equal(getElapsedSeconds(finished, 9_900), 3);
});

test('client ticking only runs while a game has started and is not over', () => {
  assert.equal(shouldTickTimer({ startedAt: null, gameOver: false }), false);
  assert.equal(shouldTickTimer({ startedAt: 1_000, gameOver: false }), true);
  assert.equal(shouldTickTimer({ startedAt: 1_000, gameOver: true }), false);
});
