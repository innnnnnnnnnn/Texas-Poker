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

    // Fix: seat positions for 8 players
    // Seat 0 is always the current player
    const getSeatPosition = (index: number) => {
        const relativeIndex = (index - playerIndex + 8) % 8;
        const positions = [
            { bottom: '5%', left: '50%', transform: 'translateX(-50%)' },           // Seat 0 (Me)
            { bottom: '20%', right: '5%', transform: 'none' },                     // Seat 1
            { top: '50%', right: '2%', transform: 'translateY(-50%)' },            // Seat 2
            { top: '15%', right: '5%', transform: 'none' },                        // Seat 3
            { top: '2%', left: '50%', transform: 'translateX(-50%)' },             // Seat 4
            { top: '15%', left: '5%', transform: 'none' },                         // Seat 5
            { top: '50%', left: '2%', transform: 'translateY(-50%)' },             // Seat 6
            { bottom: '20%', left: '5%', transform: 'none' },                      // Seat 7
        ];
        return positions[relativeIndex];
    };

    const toCall = gameState.currentMaxBet - me.currentBet;
    const minRaise = gameState.currentMaxBet + gameState.bigBlind;

    return (
        <div className="fixed inset-0 w-full h-[100dvh] bg-[#0b3d1f] flex items-center justify-center overflow-hidden touch-none select-none font-sans">
            {/* Dark Wood/Felt Overlay */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#1a5d2e_0%,_#0a2e16_70%,_#051a0d_100%)] opacity-100" />

            {/* Table Border (The Ellipse) */}
            <div className="absolute w-[90%] h-[75%] max-w-5xl rounded-[200px] border-[12px] border-[#3d2b1f] shadow-[0_0_100px_rgba(0,0,0,0.8),inset_0_0_50px_rgba(0,0,0,0.5)] bg-emerald-900/20" />

            {/* Center Area */}
            <div className="relative z-10 flex flex-col items-center justify-center pointer-events-none">
                {/* Pot Display */}
                <div className="mb-6 bg-black/60 backdrop-blur-md px-8 py-3 rounded-full border border-yellow-500/30 flex flex-col items-center">
                    <span className="text-white/40 text-[10px] uppercase font-bold tracking-tighter">Total Pot</span>
                    <span className="text-yellow-500 font-black text-2xl md:text-3xl tracking-wide">
                        💰 {gameState.pot.toLocaleString()}
                    </span>
                </div>

                {/* Community Cards */}
                <div className="flex space-x-2 md:space-x-3 mb-4">
                    {gameState.communityCards.map((c, i) => (
                        <Card key={i} card={c} className="scale-90 md:scale-110 shadow-2xl" />
                    ))}
                    {Array(5 - gameState.communityCards.length).fill(0).map((_, i) => (
                        <div key={i} className="w-14 h-20 md:w-20 md:h-28 rounded-xl border-2 border-white/5 bg-black/20 backdrop-blur-sm" />
                    ))}
                </div>

                {/* Phase & street info */}
                <div className="bg-white/5 border border-white/10 px-4 py-1.5 rounded-full text-[10px] md:text-xs text-white/60 font-black uppercase tracking-widest backdrop-blur-sm">
                    {gameState.phase} • {toCall > 0 ? `To Call: ${toCall}` : 'Check or Bet'}
                </div>
            </div>

            {/* Players (Seats) */}
            {gameState.players.map((p, idx) => {
                const isCurrent = gameState.currentPlayerIndex === idx && !gameState.isFinished;
                const isMe = idx === playerIndex;
                const pos = getSeatPosition(idx);

                return (
                    <div
                        key={p.id}
                        className="absolute transition-all duration-500 z-20"
                        style={pos}
                    >
                        <div className={`relative flex flex-col items-center ${p.isFolded ? 'opacity-40 scale-90 grayscale' : 'scale-100'}`}>
                            {/* Role Indicator (D, SB, BB) */}
                            <div className="absolute -top-6 flex space-x-1">
                                {gameState.dealerIndex === idx && <div className="w-6 h-6 rounded-full bg-white text-black text-[10px] font-black border border-gray-400 flex items-center justify-center shadow-md">D</div>}
                                {gameState.smallBlindIndex === idx && <div className="w-6 h-6 rounded-full bg-blue-500 text-white text-[10px] font-black border border-blue-200 flex items-center justify-center shadow-md">SB</div>}
                                {gameState.bigBlindIndex === idx && <div className="w-6 h-6 rounded-full bg-red-500 text-white text-[10px] font-black border border-red-200 flex items-center justify-center shadow-md">BB</div>}
                            </div>

                            {/* Player Card */}
                            <div className={`
                                w-24 md:w-32 bg-[#1a1a1a] rounded-2xl p-2 border-2 transition-all shadow-2xl
                                ${isCurrent ? 'border-yellow-400 ring-4 ring-yellow-400/20 shadow-yellow-500/20' : 'border-white/10'}
                            `}>
                                <div className="flex items-center space-x-2 mb-1">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-700 to-black border border-white/10 flex items-center justify-center text-xs">👤</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-white text-[10px] font-bold truncate">{p.name}</div>
                                        <div className="text-yellow-500 text-[10px] font-black">💰{p.chips.toLocaleString()}</div>
                                    </div>
                                </div>
                                <div className="h-0.5 bg-white/5 w-full mb-1" />
                                {p.isFolded ? (
                                    <div className="text-red-500 text-[9px] font-black text-center uppercase py-0.5">Folded</div>
                                ) : (
                                    <div className="text-emerald-400 text-[9px] font-black text-center uppercase py-0.5 min-h-[14px]">
                                        {p.lastAction || 'Wait'}
                                    </div>
                                )}
                            </div>

                            {/* Cards for this player */}
                            <div className="flex -space-x-6 mt-1 translate-y-[-4px]">
                                {p.isFolded ? null : (
                                    <>
                                        {isMe ? (
                                            p.hand.map((c, i) => <Card key={i} card={c} className="scale-50 origin-top shadow-xl" />)
                                        ) : (
                                            <>
                                                <Card isHidden className="scale-50 origin-top shadow-xl" />
                                                <Card isHidden className="scale-50 origin-top shadow-xl" />
                                            </>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Current Bet (Flying area) */}
                            {p.currentBet > 0 && !p.isFolded && (
                                <div className="mt-1 bg-black/60 px-3 py-0.5 rounded-full border border-white/10 flex items-center space-x-1 shadow-lg">
                                    <span className="text-[10px] text-yellow-500 font-bold">BET: {p.currentBet}</span>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}

            {/* Error Message Toast */}
            {error && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[200] bg-red-600 text-white px-6 py-3 rounded-full font-black shadow-2xl border-2 border-white/20 animate-bounce">
                    ⚠️ {error}
                </div>
            )}

            {/* Action Bar (Bottom Right) */}
            {isMyTurn && (
                <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end w-full max-w-md pointer-events-none">
                    <div className="w-full bg-black/80 backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-2xl pointer-events-auto">
                        <div className="flex justify-between items-center mb-4">
                            <span className="text-white/60 text-[10px] font-black uppercase tracking-widest">Raise Control</span>
                            <span className="text-yellow-500 font-black text-lg">💰 {raiseAmount}</span>
                        </div>

                        {/* Bet Slider */}
                        <div className="flex items-center space-x-4 mb-6">
                            <input
                                type="range"
                                min={minRaise}
                                max={me.chips + me.currentBet}
                                step={gameState.smallBlind}
                                value={raiseAmount}
                                onChange={(e) => setRaiseAmount(Number(e.target.value))}
                                className="flex-1 h-3 bg-white/10 rounded-full appearance-none cursor-pointer accent-yellow-500"
                            />
                        </div>

                        {/* Quick Action Buttons */}
                        <div className="grid grid-cols-4 gap-2 mb-6 text-[9px] font-black">
                            <button onClick={() => setRaiseAmount(Math.floor(gameState.pot * 0.5))} className="py-2 bg-white/5 rounded-lg border border-white/10 text-white/60 hover:bg-white/10 transition-colors uppercase">1/2 Pot</button>
                            <button onClick={() => setRaiseAmount(Math.floor(gameState.pot * 0.75))} className="py-2 bg-white/5 rounded-lg border border-white/10 text-white/60 hover:bg-white/10 transition-colors uppercase">3/4 Pot</button>
                            <button onClick={() => setRaiseAmount(gameState.pot)} className="py-2 bg-white/5 rounded-lg border border-white/10 text-white/60 hover:bg-white/10 transition-colors uppercase">Pot</button>
                            <button onClick={() => setRaiseAmount(me.chips + me.currentBet)} className="py-2 bg-red-900/40 rounded-lg border border-red-500/50 text-red-400 hover:bg-red-900/60 transition-colors uppercase">All-in</button>
                        </div>

                        {/* Primary Interaction Buttons */}
                        <div className="grid grid-cols-3 gap-3">
                            <button
                                onClick={() => handleAction('Fold')}
                                className="py-4 bg-gray-800 hover:bg-gray-700 text-white font-black rounded-2xl transition-all shadow-lg active:scale-95 border border-white/5"
                            >
                                FOLD
                            </button>

                            {toCall <= 0 ? (
                                <button
                                    onClick={() => handleAction('Check')}
                                    className="py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl transition-all shadow-lg active:scale-95 shadow-blue-500/20 border border-blue-400/50"
                                >
                                    CHECK
                                </button>
                            ) : (
                                <button
                                    onClick={() => handleAction('Call')}
                                    className="py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl transition-all shadow-lg active:scale-95 shadow-indigo-500/20 border border-indigo-400/50 flex flex-col items-center justify-center leading-none"
                                >
                                    <span>CALL</span>
                                    <span className="text-[9px] mt-1 opacity-80">{toCall}</span>
                                </button>
                            )}

                            <button
                                onClick={() => handleAction('Raise', raiseAmount)}
                                className="py-4 bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-2xl transition-all shadow-lg active:scale-95 shadow-yellow-500/20 border-b-4 border-yellow-700 flex flex-col items-center justify-center leading-none"
                            >
                                <span>{toCall <= 0 ? 'BET' : 'RAISE'}</span>
                                <span className="text-[9px] mt-1 opacity-80">{raiseAmount}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Exit Button - Top Left */}
            <button
                onClick={onExit}
                className="fixed top-6 left-6 z-50 p-3 bg-black/40 backdrop-blur-md rounded-full border border-white/10 hover:bg-red-900/40 text-white/40 hover:text-white transition-all shadow-xl"
                title="Exit Game"
            >
                🚪
            </button>

            {/* Result Overlay */}
            {gameState.isFinished && (
                <div className="fixed inset-0 bg-black/90 z-[500] flex flex-col items-center justify-center p-8 backdrop-blur-2xl">
                    <div className="text-yellow-500 text-4xl md:text-6xl font-black mb-10 animate-pulse tracking-tighter">
                        SHOWDOWN
                    </div>
                    <div className="w-full max-w-lg space-y-4">
                        {gameState.winners.map((w, i) => (
                            <div key={i} className="bg-gradient-to-r from-yellow-500/20 to-transparent p-6 rounded-3xl border border-yellow-500/50 flex justify-between items-center">
                                <div>
                                    <div className="text-yellow-500 text-[10px] uppercase font-black tracking-widest mb-1">WINNER ✨</div>
                                    <div className="text-2xl font-black text-white">{gameState.players.find(p => p.id === w.playerId)?.name}</div>
                                    {w.handName && <div className="px-3 py-1 bg-white/5 rounded-lg text-emerald-400 font-bold mt-2 text-xs inline-block">{w.handName}</div>}
                                </div>
                                <div className="text-yellow-400 text-3xl font-black">+ {w.amount.toLocaleString()} 💰</div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-12 flex gap-4 w-full max-w-lg">
                        <button onClick={onNextGame} disabled={!isHost} className={`flex-1 py-5 rounded-3xl font-black text-xl shadow-2xl transition-all ${isHost ? 'bg-yellow-500 text-black active:scale-95' : 'bg-white/5 text-white/20 cursor-not-allowed'}`}>
                            {isHost ? "NEXT ROUND" : "WAITING FOR HOST..."}
                        </button>
                        <button onClick={onExit} className="flex-1 py-5 bg-white/5 text-white border border-white/10 rounded-3xl font-black text-xl hover:bg-white/10 transition-all active:scale-95">EXIT</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GameBoard;
