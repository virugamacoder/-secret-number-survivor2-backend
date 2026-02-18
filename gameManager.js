const { v4: uuidv4 } = require('uuid');

// In-memory storage for active games
// Key: roomCode, Value: Game Object
const games = new Map();

class GameManager {
    constructor(io) {
        this.io = io;
    }

    // Generate a random 4-digit room code
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
            gameState: 'LOBBY', // LOBBY, PLAYING, FINISHED
            grid: [],
            currentTurnIndex: 0,
            eliminatedPlayers: [],
            winner: null,
            minNumber: range ? range.min : 1,
            maxNumber: range ? range.max : 100, // Default range
        };

        games.set(roomCode, game);
        console.log(`Game created: ${roomCode} by ${playerName} with range ${game.minNumber}-${game.maxNumber}`);
        return game;
    }

    joinGame(roomCode, playerName, socketId) {
        const game = games.get(roomCode);
        if (!game) {
            return { error: 'Room not found' };
        }
        if (game.gameState !== 'LOBBY') {
            return { error: 'Game already in progress' };
        }
        if (game.players.length >= 20) {
            return { error: 'Room is full' };
        }

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

    // Set secret number for a player
    // This is now "Lock In"
    playerReady(roomCode, socketId, secretNumber) {
        const game = games.get(roomCode);
        if (!game) return;

        const player = game.players.find(p => p.id === socketId);
        if (player) {
            player.secretNumber = parseInt(secretNumber);
            player.isReady = true;
        }

        // We don't auto-start anymore. Host manually starts.
        // But we can notify that a player is ready.
        return { game, action: 'PLAYER_READY' };
    }

    startGame(roomCode) {
        const game = games.get(roomCode);
        if (!game) return { error: 'Game not found' };

        // Validation: Minimum 2 players required
        if (game.players.length < 2) {
            return { error: 'At least 2 players are required to start the game' };
        }

        // Validation: All players must be ready
        const allReady = game.players.every(p => p.isReady);
        if (!allReady) {
            return { error: 'Not all players are ready' };
        }

        game.gameState = 'PLAYING';
        game.currentTurnIndex = 0;
        game.gameLog = []; // Initialize game log

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

        // Safety check: is current player eliminated? Should be skipped but just in case
        if (currentPlayer.isEliminated) {
            // Force next turn
            this.nextTurn(game);
            return { error: 'You are eliminated' };
        }

        // NEW: Prevent self-elimination
        if (currentPlayer.secretNumber === number) {
            return { error: 'You cannot select your own secret number!' };
        }

        // Check if number is someone's secret
        const eliminatedPlayers = [];
        game.players.forEach(p => {
            if (!p.isEliminated && p.secretNumber === number) {
                p.isEliminated = true;
                game.eliminatedPlayers.push(p);
                eliminatedPlayers.push(p);
            }
        });

        // Add to game log
        if (!game.gameLog) game.gameLog = [];
        const logEntry = {
            player: currentPlayer.name,
            number: number,
            eliminated: eliminatedPlayers.map(p => p.name),
            timestamp: Date.now()
        };
        game.gameLog.push(logEntry);

        // Check Win Condition
        const activePlayers = game.players.filter(p => !p.isEliminated);
        if (activePlayers.length <= 1) {
            game.gameState = 'FINISHED';
            game.winner = activePlayers[0] || null;
            return { game, action: 'GAME_OVER', eliminatedPlayers, number, gameLog: game.gameLog };
        }

        // Next Turn
        this.nextTurn(game);

        return { game, action: 'CONTINUE', eliminatedPlayers, number, gameLog: game.gameLog };
    }

    nextTurn(game) {
        let nextIndex = (game.currentTurnIndex + 1) % game.players.length;
        // Skip eliminated players
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

    removePlayer(socketId) {
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
}

module.exports = GameManager;
