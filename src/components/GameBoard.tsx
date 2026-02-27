"use client";

import React, { useState, useEffect } from 'react';
import { GameState, Card as CardType, Player } from '../logic/types';
import Card from './Card';
import { Socket } from 'socket.io-client';
import { useAudio } from '../hooks/useAudio';

interface GameBoardProps {
    initialGameState: GameState;
    playerIndex: number;
    socket: Socket;
    roomId: string;
    onExit: () => void;
    onNextGame: () => void;
    isHost: boolean;
}

const GameBoard: React.FC<GameBoardProps> = ({ initialGameState, playerIndex, socket, roomId, onExit, onNextGame, isHost }) => {
    const [gameState, setGameState] = useState<GameState>(initialGameState);
    const [error, setError] = useState<string | null>(null);
    const [raiseAmount, setRaiseAmount] = useState<number>(initialGameState.bigBlind * 2);
    const { playSound } = useAudio();

    useEffect(() => {
        socket.on("state_update", (state: GameState) => {
            setGameState(state);
            setError(null);
            if (state.isFinished) playSound('win');
            else playSound('play');
        });

        socket.on("game_start", (data: { state: GameState, playerIndex: number }) => {
            setGameState(data.state);
            setError(null);
            playSound('deal');
        });

        socket.on("error", (msg: string) => {
            setError(msg);
            playSound('error');
        });

        return () => {
            socket.off("state_update");
            socket.off("game_start");
            socket.off("error");
        };
    }, [socket, playerIndex, playSound, roomId]);

    const isMyTurn = gameState.currentPlayerIndex === playerIndex && !gameState.isFinished;
    const me = gameState.players[playerIndex];

    const handleAction = (action: string, amount: number = 0) => {
        socket.emit("poker_action", { roomId, action, amount });
    };

    const getPlayerAtPosition = (pos: number) => {
        const idx = (playerIndex + pos) % gameState.players.length;
        return { ...gameState.players[idx], originalIndex: idx };
    };

    return (
        <div className="fixed inset-0 w-full h-[100dvh] bg-[#071c10] flex flex-col items-center overflow-hidden touch-none select-none">
            {/* Immersive Background */}
            <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-900/30 via-[#0a2313] to-[#040e08]" />

            {/* Top Area: Opponents */}
            <div className="w-full h-[25vh] bg-black/40 backdrop-blur-xl border-b border-white/10 z-20 flex flex-col items-center relative flex-none">
                <div className="w-full flex justify-between items-start px-4 pt-2 absolute top-0 left-0 right-0 z-50">
                    <button onClick={onExit} className="px-4 py-1.5 bg-red-900/30 hover:bg-red-800 text-white rounded-xl text-xs font-black border border-red-400/30 shadow-lg">
                        🚪 退出
                    </button>
                    <div className="bg-yellow-500/10 border border-yellow-500/30 px-3 py-1 rounded-full text-yellow-500 text-xs font-bold">
                        {gameState.phase}
                    </div>
                </div>

                <div className="flex w-full h-full max-w-6xl justify-around items-center px-4 pt-4">
                    {[1, 2, 3].map((pos) => {
                        const p = getPlayerAtPosition(pos);
                        if (!p) return null;
                        const isCurrent = gameState.currentPlayerIndex === p.originalIndex;
                        const isDealer = gameState.dealerIndex === p.originalIndex;
                        return (
                            <div key={pos} className={`flex flex-col items-center transition-all duration-300 ${isCurrent ? 'scale-110' : 'opacity-60 scale-90'}`}>
                                <div className="relative mb-1">
                                    <div className={`w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center text-xl md:text-3xl border ${isCurrent ? 'bg-yellow-500 border-yellow-200 text-black' : 'bg-white/10 border-white/20 text-white'}`}>
                                        👤
                                    </div>
                                    {isDealer && (
                                        <div className="absolute -top-1 -right-1 w-6 h-6 bg-white text-black rounded-full border border-gray-400 flex items-center justify-center font-bold text-[10px]">D</div>
                                    )}
                                    {p.isFolded && <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center text-white font-bold text-[10px]">FOLD</div>}
                                </div>
                                <div className="text-white font-bold text-[10px] md:text-xs truncate max-w-[80px]">{p.name}</div>
                                <div className="text-emerald-400 text-[10px] md:text-xs font-bold">💰 {p.chips.toLocaleString()}</div>
                                {p.lastAction && (
                                    <div className="px-2 py-0.5 bg-white/10 rounded-md text-[8px] text-white mt-1 uppercase">{p.lastAction}</div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Middle Area: Community Cards & Pot */}
            <div className="w-full h-[35vh] flex flex-col items-center justify-center px-4 relative z-10 flex-none">
                <div className="mb-4 bg-black/60 backdrop-blur-md px-6 py-2 rounded-full border border-yellow-500/30 shadow-[0_0_20px_rgba(234,179,8,0.2)]">
                    <span className="text-yellow-500 font-bold text-lg md:text-2xl tracking-widest">POT: 💰 {gameState.pot.toLocaleString()}</span>
                </div>

                <div className="w-full max-w-4xl h-48 bg-white/5 backdrop-blur-[2px] rounded-[40px] border border-white/10 flex items-center justify-center relative shadow-[inset_0_0_40px_rgba(0,0,0,0.6)]">
                    <div className="flex space-x-2 md:space-x-4">
                        {gameState.communityCards.map((c, i) => (
                            <Card key={`${c.rank}-${c.suit}-${i}`} card={c} className="scale-75 md:scale-100" />
                        ))}
                        {Array(5 - gameState.communityCards.length).fill(0).map((_, i) => (
                            <div key={`empty-${i}`} className="w-16 h-24 md:w-20 md:h-28 rounded-xl border border-white/5 bg-black/20" />
                        ))}
                    </div>
                </div>

                {error && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-red-900 px-6 py-3 rounded-2xl text-white font-bold animate-bounce z-50">
                        {error}
                    </div>
                )}
            </div>

            {/* Bottom Area: Controls & Hole Cards */}
            <div className="flex-1 w-full bg-gradient-to-t from-black via-[#041208]/90 to-transparent flex flex-col items-center justify-end pb-8">
                {/* Betting Controls */}
                <div className="w-full max-w-6xl px-4 mb-6 flex flex-wrap justify-center gap-2">
                    {isMyTurn && (
                        <>
                            <div className="w-full flex justify-center mb-2 items-center gap-4">
                                <input
                                    type="range"
                                    min={gameState.currentMaxBet + gameState.bigBlind}
                                    max={me.chips + me.currentBet}
                                    step={gameState.smallBlind}
                                    value={raiseAmount}
                                    onChange={(e) => setRaiseAmount(Number(e.target.value))}
                                    className="w-48 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                                />
                                <span className="text-yellow-500 font-bold">Raise: {raiseAmount}</span>
                            </div>
                            <button onClick={() => handleAction('Fold')} className="px-6 py-3 bg-red-900/80 text-white font-black rounded-xl border border-red-500 shadow-lg active:scale-95 transition-all">FOLD</button>
                            {me.currentBet >= gameState.currentMaxBet ? (
                                <button onClick={() => handleAction('Check')} className="px-6 py-3 bg-blue-600 text-white font-black rounded-xl border border-blue-400 shadow-lg active:scale-95 transition-all">CHECK</button>
                            ) : (
                                <button onClick={() => handleAction('Call')} className="px-6 py-3 bg-indigo-600 text-white font-black rounded-xl border border-indigo-400 shadow-lg active:scale-95 transition-all">CALL {gameState.currentMaxBet - me.currentBet}</button>
                            )}
                            <button onClick={() => handleAction('Raise', raiseAmount)} className="px-6 py-3 bg-yellow-500 text-black font-black rounded-xl border border-yellow-200 shadow-lg active:scale-95 transition-all">RAISE</button>
                            <button onClick={() => handleAction('All-in')} className="px-6 py-3 bg-orange-600 text-white font-black rounded-xl border border-orange-400 shadow-lg active:scale-95 transition-all">ALL-IN</button>
                        </>
                    )}
                </div>

                {/* Hand Display */}
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <div className={`w-14 h-14 md:w-20 md:h-20 rounded-full flex items-center justify-center text-2xl md:text-4xl border border-yellow-200 bg-yellow-500 text-black shadow-xl`}>
                            👤
                        </div>
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-black/80 px-3 py-1 rounded-full border border-emerald-500/50 text-[10px] md:text-sm text-emerald-400 font-bold whitespace-nowrap">
                            {me.name} (💰{me.chips})
                        </div>
                    </div>

                    <div className="flex -space-x-8 md:-space-x-10 transform translate-y-2">
                        {me.hand.map((card, i) => (
                            <Card key={i} card={card} className="rotate-[-5deg] hover:rotate-0 transition-transform origin-bottom" />
                        ))}
                    </div>
                </div>
            </div>

            {/* Showdown / Result Overlay */}
            {gameState.isFinished && (
                <div className="fixed inset-0 bg-black/90 z-[100] flex flex-col items-center justify-center p-8 backdrop-blur-2xl">
                    <div className="text-yellow-500 text-4xl md:text-6xl font-black mb-10 animate-bounce">
                        GAME OVER
                    </div>
                    <div className="w-full max-w-lg space-y-4">
                        {gameState.winners.map((w, i) => (
                            <div key={i} className="bg-white/5 p-6 rounded-3xl border border-yellow-500/50 flex justify-between items-center animate-in fade-in slide-in-from-bottom duration-500">
                                <div>
                                    <div className="text-white/60 text-sm uppercase font-bold tracking-widest">Winner</div>
                                    <div className="text-2xl font-black text-white">{gameState.players.find(p => p.id === w.playerId)?.name}</div>
                                    {w.handName && <div className="text-yellow-500 font-bold mt-1">✨ {w.handName}</div>}
                                </div>
                                <div className="text-green-400 text-3xl font-black">+ {w.amount.toLocaleString()} 💰</div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-12 flex gap-4 w-full max-w-lg">
                        <button onClick={onNextGame} disabled={!isHost} className={`flex-1 py-5 rounded-2xl font-black text-xl ${isHost ? 'bg-yellow-500 text-black' : 'bg-white/5 text-white/20'}`}>
                            {isHost ? "NEXT ROUND" : "WAITING FOR HOST..."}
                        </button>
                        <button onClick={onExit} className="flex-1 py-5 bg-white/10 text-white border border-white/20 rounded-2xl font-black text-xl">EXIT</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GameBoard;
