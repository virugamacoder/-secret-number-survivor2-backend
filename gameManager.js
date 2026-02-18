const { v4: uuidv4 } = require('uuid');

// In-memory storage for active games
const games = new Map();

// Track pending disconnect timers: socketId -> timer
const disconnectTimers = new Map();

class GameManager {
    constructor(io) {
        this.io = io;
    }

    generateRoomCode() {
        let code;
        do {
            code = Math.floor(1000 + Math.random() * 9000).toString();
        } while (games.has(code));
        return code;
    }

    createGame(playerName, socketId, range) {
        const roomCode = this.generateRoomCode();
        const player = {
            id: socketId,
            name: playerName,
            isHost: true,
            secretNumber: null,
            isEliminated: false,
            isReady: false
        };

        const game = {
            roomCode,
            players: [player],
            gameState: 'LOBBY',
            grid: [],
            currentTurnIndex: 0,
            eliminatedPlayers: [],
            winner: null,
            minNumber: range ? range.min : 1,
            maxNumber: range ? range.max : 100,
        };

        games.set(roomCode, game);
        console.log(`Game created: ${roomCode} by ${playerName} with range ${game.minNumber}-${game.maxNumber}`);
        return game;
    }

    joinGame(roomCode, playerName, socketId) {
        const game = games.get(roomCode);
        if (!game) return { error: 'Room not found' };
        if (game.gameState !== 'LOBBY') return { error: 'Game already in progress' };
        if (game.players.length >= 20) return { error: 'Room is full' };

        const player = {
            id: socketId,
            name: playerName,
            isHost: false,
            secretNumber: null,
            isEliminated: false,
            isReady: false
        };

        game.players.push(player);
        console.log(`Player ${playerName} joined room ${roomCode}`);
        return { game };
    }

    // Reconnect: find player by name, update their socket ID
    rejoinGame(roomCode, playerName, newSocketId) {
        const game = games.get(roomCode);
        if (!game) return { error: 'Room not found' };

        const player = game.players.find(p => p.name === playerName);
        if (!player) return { error: 'Player not found in this room' };

        // Cancel any pending removal timer for the old socket
        if (disconnectTimers.has(player.id)) {
            clearTimeout(disconnectTimers.get(player.id));
            disconnectTimers.delete(player.id);
            console.log(`Reconnect: cancelled removal timer for ${playerName}`);
        }

        player.id = newSocketId;
        console.log(`Player ${playerName} rejoined room ${roomCode} with new socket ${newSocketId}`);
        return { game, player };
    }

    playerReady(roomCode, socketId, secretNumber) {
        const game = games.get(roomCode);
        if (!game) return;

        const player = game.players.find(p => p.id === socketId);
        if (player) {
            player.secretNumber = parseInt(secretNumber);
            player.isReady = true;
        }

        return { game, action: 'PLAYER_READY' };
    }

    startGame(roomCode) {
        const game = games.get(roomCode);
        if (!game) return { error: 'Game not found' };

        if (game.players.length < 2) {
            return { error: 'At least 2 players are required to start the game' };
        }

        const allReady = game.players.every(p => p.isReady);
        if (!allReady) {
            return { error: 'Not all players are ready' };
        }

        game.gameState = 'PLAYING';
        game.currentTurnIndex = 0;
        game.gameLog = [];

        return game;
    }

    eliminateNumber(roomCode, number, socketId) {
        const game = games.get(roomCode);
        if (!game) return null;
        if (game.gameState !== 'PLAYING') return null;

        const currentPlayer = game.players[game.currentTurnIndex];
        if (currentPlayer.id !== socketId) {
            return { error: 'Not your turn' };
        }

        if (currentPlayer.isEliminated) {
            this.nextTurn(game);
            return { error: 'You are eliminated' };
        }

        if (currentPlayer.secretNumber === number) {
            return { error: 'You cannot select your own secret number!' };
        }

        const eliminatedPlayers = [];
        game.players.forEach(p => {
            if (!p.isEliminated && p.secretNumber === number) {
                p.isEliminated = true;
                game.eliminatedPlayers.push(p);
                eliminatedPlayers.push(p);
            }
        });

        if (!game.gameLog) game.gameLog = [];
        game.gameLog.push({
            player: currentPlayer.name,
            number,
            eliminated: eliminatedPlayers.map(p => p.name),
            timestamp: Date.now()
        });

        const activePlayers = game.players.filter(p => !p.isEliminated);
        if (activePlayers.length <= 1) {
            game.gameState = 'FINISHED';
            game.winner = activePlayers[0] || null;
            return { game, action: 'GAME_OVER', eliminatedPlayers, number, gameLog: game.gameLog };
        }

        this.nextTurn(game);
        return { game, action: 'CONTINUE', eliminatedPlayers, number, gameLog: game.gameLog };
    }

    nextTurn(game) {
        let nextIndex = (game.currentTurnIndex + 1) % game.players.length;
        let attempts = 0;
        while (game.players[nextIndex].isEliminated && attempts < game.players.length) {
            nextIndex = (nextIndex + 1) % game.players.length;
            attempts++;
        }
        game.currentTurnIndex = nextIndex;
    }

    getGame(roomCode) {
        return games.get(roomCode);
    }

    // Schedule removal after 10s grace period — allows page refresh to reconnect
    scheduleRemovePlayer(socketId, gracePeriodMs = 10000) {
        if (disconnectTimers.has(socketId)) {
            clearTimeout(disconnectTimers.get(socketId));
        }

        const timer = setTimeout(() => {
            disconnectTimers.delete(socketId);
            const result = this._removePlayerNow(socketId);
            if (result && result.action === 'PLAYER_LEFT') {
                this.io.to(result.roomCode).emit('player_left', { players: result.game.players });
            }
        }, gracePeriodMs);

        disconnectTimers.set(socketId, timer);
    }

    _removePlayerNow(socketId) {
        for (const [code, game] of games.entries()) {
            const index = game.players.findIndex(p => p.id === socketId);
            if (index !== -1) {
                const player = game.players[index];
                game.players.splice(index, 1);

                if (game.players.length === 0) {
                    games.delete(code);
                    return { roomCode: code, action: 'GAME_DELETED' };
                }

                if (player.isHost && game.players.length > 0) {
                    game.players[0].isHost = true;
                }

                return { roomCode: code, game, action: 'PLAYER_LEFT' };
            }
        }
        return null;
    }

    removePlayer(socketId) {
        return this._removePlayerNow(socketId);
    }
}

module.exports = GameManager;
