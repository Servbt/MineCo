# MineCo

MineCo is a lightweight multiplayer Minesweeper built with vanilla JavaScript and a small Node.js server. It keeps the classic tension of Minesweeper, then adds online co-op room sharing so you can clear the board with a friend in real time.

## Live demo

Play the deployed version here:

**https://mineco.onrender.com**

## Features

- **Online room-based play** — create a room, share a short code, and have a second player join instantly.
- **Live co-op mode** — both players can work through the same board together in real time.
- **Turn-based mode** — switch to alternating turns when you want a more deliberate, pass-and-play style rhythm.
- **Solo-to-co-op flow** — start clearing tiles on your own and let a second player join mid-game.
- **Invite links** — copy or share a room link that automatically pre-fills the room code.
- **Reconnect support** — refresh the page and rejoin your active room when your saved session is still valid.
- **Mobile-friendly controls** — long-press to flag on phones and tablets, plus a dedicated flag mode toggle.
- **Selectable color schemes** — swap between multiple visual themes for different moods and contrast preferences.
- **Built-in game timer** — tracks elapsed time once the first move is made.
- **Classic difficulty levels** — beginner, intermediate, and expert boards.

## How it works

MineCo serves a simple frontend from a Node.js HTTP server and keeps active room state in memory. Clients receive live board updates through server-sent events, which keeps the project small, fast to load, and easy to iterate on.

## Tech stack

- **Frontend:** HTML, CSS, vanilla JavaScript
- **Backend:** Node.js (`http` server)
- **Realtime updates:** Server-Sent Events (SSE)
- **Testing:** Node test runner (`node --test`)

## Running locally

```bash
npm install
npm start
```

Then open:

```text
http://localhost:3000
```

## Running tests

```bash
npm test
```

## Notes

- Active rooms are stored in memory, so restarting the server clears ongoing sessions.
- The project is intentionally framework-light and easy to modify.
