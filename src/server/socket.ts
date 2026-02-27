import { createServer } from "http";
import { Server } from "socket.io";
import { initializeGame, handleAction } from "../logic/game";
import { GameState } from "../logic/types";

const httpServer = createServer((req, res) => {
    if (req.url === "/") {
        res.writeHead(200);
        res.end("Texas Poker server is running!");
    }
});
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

interface Room {
    id: string;
    players: { id: string, name: string, socketId: string, isHost: boolean, isAI?: boolean, isSpectator?: boolean }[];
    state: GameState | null;
    difficulty: 'Easy' | 'Medium' | 'Hard' | 'Expert' | 'Master';
    maxPlayers: number;
}

const rooms: Record<string, Room> = {};
const playerRoomMap: Record<string, string> = {};
const disconnectTimeouts: Record<string, NodeJS.Timeout> = {};

const DIFFICULTY_MAP = {
    'Easy': '簡單',
    'Medium': '中等',
    'Hard': '困難',
    'Expert': '專家',
    'Master': '大師'
};

const broadcastState = (roomId: string) => {
    const room = rooms[roomId];
    if (!room || !room.state) return;

    room.players.forEach((p) => {
        if (!p.socketId) return;

        // Spectators see everything
        const isSpectator = !room.state?.players.some(stateP => stateP.name === p.name);

        if (isSpectator) {
            io.to(p.socketId).emit("state_update", room.state);
            return;
        }

        // Players see only their own cards
        const playerIdx = room.state?.players.findIndex(stateP => stateP.name === p.name);

        const maskedState = {
            ...room.state,
            players: room.state?.players.map((sp, idx) => ({
                ...sp,
                hand: (idx === playerIdx || room.state?.isFinished || room.state?.phase === 'Showdown') ? sp.hand : []
            }))
        };

        io.to(p.socketId).emit("state_update", maskedState);
    });
};

io.on("connection", (socket) => {
    // Mechanism C: Keep-alive ping handler
    socket.on("ping", () => {
        socket.emit("pong");
    });

    socket.on("join_room", (data: { roomId: string, name: string, userId: string }) => {
        const { roomId, name, userId } = data;

        // Mechanism B: Cancel pending disconnect timeout for this user
        if (disconnectTimeouts[userId]) {
            console.log(`[Server] Player ${userId} reconnected, cancelling removal.`);
            clearTimeout(disconnectTimeouts[userId]);
            delete disconnectTimeouts[userId];
        }

        if (!rooms[roomId]) {
            rooms[roomId] = { id: roomId, players: [], state: null, difficulty: 'Medium', maxPlayers: 4 };
        }
        const room = rooms[roomId];
        const existingPlayerIndex = room.players.findIndex(p => p.id === userId);
        const gameInProgress = room.state && !room.state.isFinished;

        if (existingPlayerIndex !== -1) {
            const oldSocketId = room.players[existingPlayerIndex].socketId;
            delete playerRoomMap[oldSocketId];
            room.players[existingPlayerIndex].socketId = socket.id;
            room.players[existingPlayerIndex].name = name;
            playerRoomMap[socket.id] = roomId;
        } else {
            if (room.players.length >= 8) {
                socket.emit("error", "房間已滿");
                return;
            }
            const isHost = room.players.length === 0;
            // Key Logic: If joining while game is in progress, you are a permanent spectator for this session
            const isSpectator = !!gameInProgress;
            room.players.push({ id: userId, name, socketId: socket.id, isHost, isSpectator });
            playerRoomMap[socket.id] = roomId;
        }

        socket.join(roomId);
        let hostAssigned = false;
        room.players.forEach((p) => {
            if (!p.isAI && !hostAssigned) {
                p.isHost = true;
                hostAssigned = true;
            } else {
                p.isHost = false;
            }
        });

        io.to(roomId).emit("room_update", {
            players: room.players.map(p => ({
                id: p.id,
                name: p.name,
                isHost: p.isHost,
                ready: true,
                isAI: p.isAI,
                isSpectator: p.isSpectator
            })),
            count: room.players.length,
            difficulty: room.difficulty,
            maxPlayers: room.maxPlayers
        });

        // Re-sync game state if game is in progress
        if (room.state && !room.state.isFinished) {
            const playerInGameIdx = room.state.players.findIndex(p => p.name === name);
            const playerIndex = playerInGameIdx; // -1 if spectator

            // Mask state for new joiner
            const maskedState = (playerIndex === -1) ? room.state : {
                ...room.state,
                players: room.state.players.map((sp, idx) => ({
                    ...sp,
                    hand: (idx === playerIndex) ? sp.hand : []
                }))
            };

            socket.emit("game_start", {
                state: maskedState,
                playerIndex: playerIndex
            });
        }
    });

    socket.on("set_max_players", (data: { roomId: string, maxPlayers: number }) => {
        const room = rooms[data.roomId];
        if (!room) return;
        const player = room.players.find(p => p.socketId === socket.id);
        if (!player || !player.isHost) return;

        room.maxPlayers = Math.max(2, Math.min(8, data.maxPlayers));
        io.to(data.roomId).emit("max_players_update", room.maxPlayers);
    });

    socket.on("start_game", (data: { roomId: string }) => {
        const room = rooms[data.roomId];
        if (!room) return;

        console.log(`[Socket] Starting game for room ${data.roomId}. Players: ${room.players.length}`);

        // 1. Filter spectators and existing AI
        const spectators = room.players.filter(p => !!p.isSpectator);
        const originalParticipants = room.players.filter(p => !p.isSpectator && !p.isAI);

        // 2. Fill with AI up to maxPlayers
        const targetAI = Math.max(0, room.maxPlayers - originalParticipants.length);

        // Always ensure we have at least 2 players total including AI
        const finalTargetAI = (originalParticipants.length < 2 && targetAI === 0) ? 1 : targetAI;

        // Clean existing AI to re-populate correctly based on new maxPlayers or room state
        room.players = [...originalParticipants];
        for (let i = 0; i < finalTargetAI; i++) {
            room.players.push({
                id: `ai_${room.players.length}`,
                name: `神貓 AI-${room.players.length + 1}`,
                socketId: "",
                isHost: false,
                isAI: true,
                isSpectator: false
            });
        }
        room.players.push(...spectators);

        // 2. Chip Inheritance & Bankruptcy removal (Only if game was already running)
        let previousPlayers = room.state?.players || [];
        if (previousPlayers.length > 0) {
            const bankruptNames = previousPlayers
                .filter(p => p.chips < 20)
                .map(p => p.name);

            // Notify and remove bankrupt players
            const originalPlayersInRoom = [...room.players];
            room.players = room.players.filter(p => !bankruptNames.includes(p.name));

            originalPlayersInRoom.forEach(p => {
                if (bankruptNames.includes(p.name) && p.socketId) {
                    io.to(p.socketId).emit("force_leave", "籌碼不足，遺憾離場");
                }
            });

            // Tournament Winner Detection (Only if 1 human remains and no AI is needed/left)
            const humanParticipants = room.players.filter(p => !p.isSpectator && !p.isAI);
            const aiParticipants = room.players.filter(p => !p.isSpectator && p.isAI);

            if (humanParticipants.length === 1 && aiParticipants.length === 0) {
                const winner = humanParticipants[0];
                if (winner.socketId) {
                    io.to(winner.socketId).emit("tournament_winner", {
                        winner: winner.name,
                        stats: { matchWins: 1 }
                    });
                }
                // Notify spectators game is over or just let them stay
                room.state = null;
                return;
            }
        }

        // 3. Define the active participants for the game logic
        const activeParticipants = room.players.filter(p => !p.isSpectator);

        const playerInfos = activeParticipants.map((p) => {
            const prev = previousPlayers.find(prevP => prevP.name === p.name);
            return {
                name: p.name,
                isHuman: !p.isAI,
                chips: prev && prev.chips >= 20 ? prev.chips : 1000
            };
        });

        room.state = initializeGame(playerInfos);

        // 4. Distribute game_start to everyone in the room
        room.players.forEach((p) => {
            if (!p.socketId) return;

            // Determine if this person is a player or spectator in the actual game state
            const playerIndexInGame = room.state!.players.findIndex(stateP => stateP.name === p.name);

            const maskedState = (playerIndexInGame === -1) ? room.state! : {
                ...room.state!,
                players: room.state!.players.map((sp, idx) => ({
                    ...sp,
                    hand: (idx === playerIndexInGame) ? sp.hand : []
                }))
            };

            io.to(p.socketId).emit("game_start", {
                state: maskedState,
                playerIndex: playerIndexInGame
            });
        });

        if (room.state && !room.state.players[room.state.currentPlayerIndex].isHuman) {
            setTimeout(() => triggerAI(data.roomId), 1500);
        }
    });

    socket.on("poker_action", (data: { action: string, amount?: number, roomId: string }) => {
        const room = rooms[data.roomId];
        if (!room || !room.state) return;

        const playerInRoom = room.players.find(p => p.socketId === socket.id);
        if (!playerInRoom) return;

        const playerIndex = room.state.players.findIndex(p => p.name === playerInRoom.name);
        if (playerIndex === -1 || playerIndex !== room.state.currentPlayerIndex) return;

        const result = handleAction(room.state, playerIndex, data.action, data.amount || 0);
        if (typeof result !== "string") {
            room.state = result;
            broadcastState(data.roomId);

            if (!result.isFinished && !result.players[result.currentPlayerIndex].isHuman) {
                setTimeout(() => triggerAI(data.roomId), 1000);
            }
        } else {
            socket.emit("error", result);
        }
    });

    const triggerAI = (roomId: string) => {
        const room = rooms[roomId];
        if (!room || !room.state || room.state.isFinished) return;

        const aiIndex = room.state.currentPlayerIndex;
        const aiPlayer = room.state.players[aiIndex];
        if (aiPlayer.isHuman) return;

        let action = "Check";
        let amount = 0;

        if (aiPlayer.currentBet < room.state.currentMaxBet) {
            action = "Call";
        }

        if (Math.random() > 0.8) {
            action = "Raise";
            amount = room.state.currentMaxBet + 20;
            if (amount > aiPlayer.chips) {
                action = "All-in";
            }
        }

        console.log(`[AI] ${aiPlayer.name} takes action: ${action}`);
        const result = handleAction(room.state, aiIndex, action, amount);
        if (typeof result !== "string") {
            room.state = result;
            broadcastState(roomId);
            if (!result.isFinished && !result.players[result.currentPlayerIndex].isHuman) {
                setTimeout(() => triggerAI(roomId), 1000);
            }
        }
    };

    socket.on("disconnect", () => {
        const roomId = playerRoomMap[socket.id];
        if (roomId) {
            const room = rooms[roomId];
            const player = room.players.find(p => p.socketId === socket.id);

            if (player) {
                console.log(`[Server] Player ${player.name} (${player.id}) disconnected. Waiting 30s grace period.`);

                // Mechanism B: Set a 30s timeout before removing the player
                disconnectTimeouts[player.id] = setTimeout(() => {
                    console.log(`[Server] Grace period expired. Removing player ${player.name} from room ${roomId}.`);
                    room.players = room.players.filter(p => p.id !== player.id);
                    delete playerRoomMap[socket.id];
                    delete disconnectTimeouts[player.id];

                    if (room.players.length === 0) {
                        delete rooms[roomId];
                    } else {
                        io.to(roomId).emit("room_update", {
                            players: room.players.map(p => ({ id: p.id, name: p.name, isHost: p.isHost, ready: true, isAI: p.isAI })),
                            count: room.players.length,
                            difficulty: room.difficulty,
                            maxPlayers: room.maxPlayers
                        });
                    }
                }, 30000); // 30 seconds
            }
        }
    });
});

const PORT = Number(process.env.PORT) || 3002;
httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Poker server is running on port ${PORT}`);
});
