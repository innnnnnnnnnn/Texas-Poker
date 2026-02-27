"use client";

import { useRouter, useSearchParams } from "next/navigation";
import React, { useState, useEffect, Suspense } from "react";
import { useAppSession } from "../../hooks/useAppSession";
import { io, Socket } from "socket.io-client";
import GameBoard from "@/components/GameBoard";
import { GameState } from "@/logic/types";

let socket: Socket;

const RoomContent = () => {
    const { session } = useAppSession();
    const searchParams = useSearchParams();
    const roomId = searchParams.get("id");
    const router = useRouter();

    const [players, setPlayers] = useState<{ id?: string, name: string, isHost: boolean, ready: boolean }[]>([]);
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [playerIndex, setPlayerIndex] = useState<number>(-1);
    const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard' | 'Expert' | 'Master'>('Medium');
    const [connectionError, setConnectionError] = useState<string | null>(null);

    const myId = (session?.user as any)?.id;
    const myName = (session?.user?.name || "").trim();
    const meMatched = players.find(p => {
        const pId = p.id;
        const pName = (p.name || "").trim();
        return (pId && pId === myId) || (pName && pName === myName);
    });
    const currentIsHost = meMatched?.isHost || false;

    useEffect(() => {
        console.log("[Room] Auth Debug:", { myId, myName, playersCount: players.length, amIHost: currentIsHost });
    }, [myId, myName, players, currentIsHost]);

    useEffect(() => {
        if (!myId || !roomId) return;

        console.log("[Room] Effect Triggered: Joining...");
        const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3002";

        if (!socket || !socket.connected) {
            socket = io(wsUrl);
        }

        socket.on("connect", () => {
            setConnectionError(null);
            console.log("[Room] Socket Connected!");
        });

        socket.on("connect_error", (err) => {
            console.error("[Room] Socket Connection Error:", err.message);
            setConnectionError(`無法連線至伺服器: ${wsUrl}`);
        });

        socket.emit("join_room", {
            roomId,
            name: myName,
            userId: myId
        });

        socket.on("room_update", (data) => {
            setPlayers(data.players);
            if (data.difficulty) setDifficulty(data.difficulty);
            console.log("[Room] Updated players list. My ID:", myId);
        });

        socket.on("difficulty_update", (newDiff: any) => {
            setDifficulty(newDiff);
        });

        socket.on("game_start", (data: { state: GameState, playerIndex: number }) => {
            setGameState(data.state);
            setPlayerIndex(data.playerIndex);
        });

        socket.on("state_update", (state: GameState) => {
            setGameState(state);
        });

        return () => {
            socket.disconnect();
        };
    }, [myId, roomId, myName]);

    if (!session) return null;

    const startGame = () => {
        socket.emit("start_game", { roomId });
    };

    const handleDifficultyChange = (newDiff: 'Easy' | 'Medium' | 'Hard' | 'Expert' | 'Master') => {
        setDifficulty(newDiff);
        socket.emit("set_difficulty", { roomId, difficulty: newDiff });
    };

    const copyLink = () => {
        navigator.clipboard.writeText(window.location.href);
        alert("Copied room link!");
    };

    const difficulties = [
        { id: 'Easy', name: '簡單', color: 'bg-green-500' },
        { id: 'Medium', name: '中等', color: 'bg-blue-500' },
        { id: 'Hard', name: '困難', color: 'bg-orange-500' },
        { id: 'Expert', name: '專家', color: 'bg-red-500' },
        { id: 'Master', name: '大師', color: 'bg-purple-600' },
    ];

    if (gameState) {
        return (
            <GameBoard
                initialGameState={gameState}
                playerIndex={playerIndex}
                socket={socket}
                roomId={roomId as string}
                onExit={() => router.push("/lobby")}
                onNextGame={startGame}
                isHost={currentIsHost}
            />
        );
    }

    return (
        <div className="h-screen bg-[#0a4d2e] flex flex-col items-center justify-center py-4 px-4 md:p-8 overflow-hidden">
            <div className="w-full max-w-2xl bg-black/30 rounded-3xl p-6 md:p-10 border border-white/10 shadow-2xl backdrop-blur-xl flex flex-col max-h-full">
                <div className="flex flex-col md:flex-row justify-between items-start mb-6 gap-4 flex-none">
                    <div>
                        <h2 className="text-xl md:text-2xl font-bold text-white">建立新局</h2>
                        <p className="text-white/40 text-center text-sm md:text-base">建立一個德州撲克牌局，邀請好友或與 AI 對戰。</p>
                        <p className="text-yellow-500 text-sm font-bold">房號: {roomId} (等待玩家加入中... {players.length}/8)</p>
                    </div>
                    <button
                        onClick={copyLink}
                        className="w-full md:w-auto px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full text-xs font-bold border border-white/10 transition-all"
                    >
                        📋 複製邀請連結
                    </button>
                </div>

                {connectionError && (
                    <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-xl text-red-400 text-xs font-bold animate-pulse flex-none">
                        ⚠️ {connectionError}
                    </div>
                )}

                <div className="space-y-2 md:space-y-4 mb-6 overflow-y-auto flex-1 pr-2 scrollbar-hide">
                    {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
                        const p = players[i];
                        return (
                            <div key={i} className={`flex items-center justify-between p-2 md:p-3 rounded-xl border ${p ? 'bg-black/40 border-white/20' : 'bg-black/10 border-white/5 border-dashed opacity-50'}`}>
                                <div className="flex items-center space-x-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${p ? 'bg-yellow-500' : 'bg-white/5'}`}>
                                        {p ? '👤' : ''}
                                    </div>
                                    <div>
                                        <div className={`font-bold text-xs md:text-sm ${p ? 'text-white' : 'text-white/20'}`}>
                                            {p ? p.name : '等待加入...'}
                                        </div>
                                        {p?.isHost && <span className="text-[8px] bg-yellow-600 text-white px-2 py-0.5 rounded-full uppercase font-black">房主</span>}
                                    </div>
                                </div>
                                {p && <div className="text-green-500 font-bold text-[10px]">已就緒</div>}
                            </div>
                        );
                    })}
                </div>

                {/* AI Difficulty Selector */}
                <div className="mb-6 bg-black/20 p-4 md:p-6 rounded-2xl border border-white/5 flex-none">
                    <h2 className="text-white text-sm font-bold mb-3 flex items-center">
                        🤖 電腦難度
                    </h2>
                    <div className="flex flex-wrap gap-2">
                        {difficulties.map((diff) => (
                            <button
                                key={diff.id}
                                disabled={!currentIsHost}
                                onClick={() => handleDifficultyChange(diff.id as 'Easy' | 'Medium' | 'Hard' | 'Expert' | 'Master')}
                                className={`flex-1 min-w-[60px] py-2 rounded-xl font-black text-[10px] md:text-xs transition-all border-2 ${difficulty === diff.id
                                    ? `${diff.color} border-white text-white shadow-lg`
                                    : 'bg-black/40 border-transparent text-white/40 hover:bg-black/60'
                                    } ${!currentIsHost && 'cursor-default'}`}
                            >
                                {diff.name}
                            </button>
                        ))}
                    </div>
                </div>

                {currentIsHost ? (
                    <button
                        onClick={startGame}
                        className="w-full py-4 bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-2xl text-lg shadow-[0_5px_0_rgb(180,100,0)] transition-all active:translate-y-1 flex-none"
                    >
                        開始遊戲 (START)
                    </button>
                ) : (
                    <div className="text-white/40 text-center font-bold text-sm flex-none">等待房主開始...</div>
                )}

                <p className="mt-6 text-center text-white/20 text-xs">
                    支援最多 8 人對戰。人數不足 2 人時，系統會自動加入 AI 參與。
                </p>
            </div>
        </div>
    );
};

const RoomPage = () => {
    return (
        <Suspense fallback={<div className="min-h-screen bg-black/50" />}>
            <RoomContent />
        </Suspense>
    );
};

export default RoomPage;
