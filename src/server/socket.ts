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
    players: { id: string, name: string, socketId: string, isHost: boolean, isAI?: boolean }[];
    state: GameState | null;
    difficulty: 'Easy' | 'Medium' | 'Hard' | 'Expert' | 'Master';
}

const rooms: Record<string, Room> = {};
const playerRoomMap: Record<string, string> = {};

const DIFFICULTY_MAP = {
    'Easy': '簡單',
    'Medium': '中等',
    'Hard': '困難',
    'Expert': '專家',
    'Master': '大師'
};

io.on("connection", (socket) => {
    socket.on("join_room", (data: { roomId: string, name: string, userId: string }) => {
        const { roomId, name, userId } = data;
        if (!rooms[roomId]) {
            rooms[roomId] = { id: roomId, players: [], state: null, difficulty: 'Medium' };
        }
        const room = rooms[roomId];
        const existingPlayerIndex = room.players.findIndex(p => p.id === userId);

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
            room.players.push({ id: userId, name, socketId: socket.id, isHost });
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
            players: room.players.map(p => ({ id: p.id, name: p.name, isHost: p.isHost, ready: true, isAI: p.isAI })),
            count: room.players.length,
            difficulty: room.difficulty
        });
    });

    socket.on("start_game", (data: { roomId: string }) => {
        const room = rooms[data.roomId];
        if (!room) return;
        if (room.state && !room.state.isFinished) return;

        const player = room.players.find(p => p.socketId === socket.id);
        if (!player || !player.isHost) return;

        if (room.players.length < 2) {
            for (let i = room.players.length; i < 4; i++) {
                room.players.push({
                    id: `ai_${i}`,
                    name: `神貓 AI(${DIFFICULTY_MAP[room.difficulty]})`,
                    socketId: "",
                    isHost: false,
                    isAI: true
                });
            }
        }

        const playerInfos = room.players.map((p) => ({
            name: p.name,
            isHuman: !p.isAI,
            chips: 1000
        }));
        room.state = initializeGame(playerInfos);

        room.players.forEach((p, index) => {
            if (p.socketId) {
                io.to(p.socketId).emit("game_start", {
                    state: room.state,
                    playerIndex: index
                });
            }
        });

        if (room.state && !room.state.players[room.state.currentPlayerIndex].isHuman) {
            setTimeout(() => triggerAI(data.roomId), 1500);
        }
    });

    socket.on("poker_action", (data: { action: string, amount?: number, roomId: string }) => {
        const room = rooms[data.roomId];
        if (!room || !room.state) return;

        const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
        if (playerIndex === -1 || playerIndex !== room.state.currentPlayerIndex) return;

        const result = handleAction(room.state, playerIndex, data.action, data.amount || 0);
        if (typeof result !== "string") {
            room.state = result;
            io.to(data.roomId).emit("state_update", result);

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
            io.to(roomId).emit("state_update", result);
            if (!result.isFinished && !result.players[result.currentPlayerIndex].isHuman) {
                setTimeout(() => triggerAI(roomId), 1000);
            }
        }
    };

    socket.on("disconnect", () => {
        const roomId = playerRoomMap[socket.id];
        if (roomId) {
            const room = rooms[roomId];
            room.players = room.players.filter(p => p.socketId !== socket.id);
            delete playerRoomMap[socket.id];
            if (room.players.length === 0) delete rooms[roomId];
        }
    });
});

const PORT = Number(process.env.PORT) || 3002;
httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Poker server is running on port ${PORT}`);
});
