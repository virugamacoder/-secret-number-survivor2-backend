const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const GameManager = require('./gameManager');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins for now (dev mode)
        methods: ["GET", "POST"]
    }
});

const gameManager = new GameManager(io);

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('create_game', ({ playerName, range }) => {
        try {
            const game = gameManager.createGame(playerName, socket.id, range);
            socket.join(game.roomCode);
            socket.emit('game_created', game);
            // Also emit update to lobby
            io.to(game.roomCode).emit('player_joined', { players: game.players });
        } catch (e) {
            socket.emit('error', { message: e.message });
        }
    });

    socket.on('join_game', ({ roomCode, playerName }) => {
        const result = gameManager.joinGame(roomCode, playerName, socket.id);
        if (result.error) {
            socket.emit('error', { message: result.error });
        } else {
            socket.join(roomCode);
            socket.emit('game_joined', result.game);
            io.to(roomCode).emit('player_joined', { players: result.game.players });
        }
    });

    socket.on('start_game', ({ roomCode }) => {
        const game = gameManager.startGame(roomCode);
        if (game.error) {
            socket.emit('error', { message: game.error });
        } else {
            // Emit game_started event with the full game object
            io.to(roomCode).emit('game_started', game);
        }
    });

    socket.on('player_ready', ({ roomCode, secretNumber }) => {
        const result = gameManager.playerReady(roomCode, socket.id, secretNumber);
        if (result) {
            if (result.action === 'START_PLAYING') {
                io.to(roomCode).emit('game_started', result.game);
            } else {
                // Notify that this player is ready
                io.to(roomCode).emit('player_ready_update', { players: result.game.players });
            }
        }
    });

    socket.on('eliminate', ({ roomCode, number }) => {
        const result = gameManager.eliminateNumber(roomCode, number, socket.id);
        if (result) {
            if (result.error) {
                socket.emit('error', { message: result.error });
            } else {
                io.to(roomCode).emit('number_eliminated', {
                    number,
                    eliminatedPlayers: result.eliminatedPlayers,
                    currentTurnIndex: result.game.currentTurnIndex,
                    gameLog: result.gameLog || []
                });

                if (result.action === 'GAME_OVER') {
                    io.to(roomCode).emit('game_over', { winner: result.game.winner });
                }
            }
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        const result = gameManager.removePlayer(socket.id);
        if (result && result.action === 'PLAYER_LEFT') {
            io.to(result.roomCode).emit('player_left', { players: result.game.players });
            // Optionally handle game abort or pause
        }
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`SERVER RUNNING ON PORT ${PORT}`);
});
