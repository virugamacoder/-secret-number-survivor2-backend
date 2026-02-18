# 🎮 Secret Number Survivor 2 — Backend

A real-time multiplayer game backend built with **Node.js**, **Express**, and **Socket.IO**. Players join rooms, pick secret numbers, and take turns eliminating each other — last one standing wins!

---

## 🚀 Live Deployment

> Deployed on **Render**
> 🔗 `https://your-app-name.onrender.com` *(update after deployment)*

---

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| Node.js | Runtime environment |
| Express | HTTP server |
| Socket.IO | Real-time WebSocket communication |
| CORS | Cross-origin request handling |

---

## 📁 Project Structure

```
secret-number-survivor2-backend/
├── index.js          # Entry point — Express + Socket.IO server
├── gameManager.js    # Core game logic (rooms, turns, elimination)
├── package.json      # Dependencies & scripts
├── .gitignore        # Ignored files
└── README.md         # You are here
```

---

## ⚙️ Getting Started (Local Development)

### Prerequisites
- Node.js `>= 18.0.0`
- npm

### Installation

```bash
# Clone the repository
git clone https://github.com/virugamacoder/-secret-number-survivor2-backend.git
cd secret-number-survivor2-backend

# Install dependencies
npm install

# Start development server (with auto-reload)
npm run dev

# OR start production server
npm start
```

Server runs on: `http://localhost:3001`

---

## 🔌 Socket.IO Events

### Client → Server

| Event | Payload | Description |
|---|---|---|
| `create_game` | `{ playerName, range: { min, max } }` | Create a new game room |
| `join_game` | `{ roomCode, playerName }` | Join an existing room |
| `player_ready` | `{ roomCode, secretNumber }` | Lock in your secret number |
| `start_game` | `{ roomCode }` | Host starts the game |
| `eliminate` | `{ roomCode, number }` | Guess/eliminate a number on your turn |

### Server → Client

| Event | Payload | Description |
|---|---|---|
| `game_created` | `game` | Room created successfully |
| `game_joined` | `game` | Joined room successfully |
| `player_joined` | `{ players }` | A new player joined the lobby |
| `player_ready_update` | `{ players }` | A player locked in their secret number |
| `game_started` | `game` | Game has started |
| `number_eliminated` | `{ number, eliminatedPlayers, currentTurnIndex, gameLog }` | A number was called |
| `game_over` | `{ winner }` | Game ended with a winner |
| `player_left` | `{ players }` | A player disconnected |
| `error` | `{ message }` | Error message |

---

## 🎮 Game Flow

```
1. Host creates a room (with optional number range)
2. Players join using the room code
3. Each player locks in their secret number
4. Host starts the game
5. Players take turns calling numbers
6. If a called number matches a player's secret → they're eliminated
7. Last player standing wins!
```

---

## 🌐 Deploying to Render

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → **New Web Service**
3. Connect your GitHub repository
4. Use these settings:

| Setting | Value |
|---|---|
| **Environment** | Node |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Port** | Auto-detected via `process.env.PORT` |

> ✅ No additional environment variables required for basic setup.

---

## 🔧 Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Port the server listens on (auto-set by Render) |

---

## 📜 License

ISC © [virugamacoder](https://github.com/virugamacoder)
