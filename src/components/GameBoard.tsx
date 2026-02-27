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
            { bottom: '15%', left: '50%', transform: 'translateX(-50%)' },          // Seat 0 (Me)
            { bottom: '8%', left: '5%', transform: 'none' },                        // Seat 1 (Downstream 1)
            { bottom: '28%', left: '2%', transform: 'none' },                       // Seat 2 (Downstream 2)
            { top: '12%', left: '5%', transform: 'none' },                         // Seat 3 (Downstream 3)
            { top: '5%', left: '50%', transform: 'translateX(-50%)' },              // Seat 4 (Top Center)
            { top: '12%', right: '5%', transform: 'none' },                        // Seat 5 (Upstream 3)
            { bottom: '28%', right: '2%', transform: 'none' },                      // Seat 6 (Upstream 2)
            { bottom: '8%', right: '5%', transform: 'none' },                       // Seat 7 (Upstream 1)
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

            {/* Individually Positioned Center Components */}

            {/* 💰 Pot Display */}
            <div className="absolute top-[20%] left-1/2 -translate-x-1/2 z-[140] pointer-events-none">
                <div className="bg-black/60 backdrop-blur-md px-8 py-3 rounded-full border border-yellow-500/30 flex flex-col items-center shadow-2xl">
                    <span className="text-white/40 text-[10px] uppercase font-bold tracking-tighter leading-none mb-1">Total Pot</span>
                    <span className="text-yellow-500 font-black text-2xl md:text-3xl tracking-wide leading-none">
                        💰 {gameState.pot.toLocaleString()}
                    </span>
                </div>
            </div>

            {/* 📊 Phase & street info (Street Info) */}
            <div className="absolute top-[32%] left-1/2 -translate-x-1/2 z-[140] pointer-events-none text-center">
                <div className="bg-white/5 border border-white/10 px-6 py-2 rounded-full text-[10px] md:text-xs text-white/80 font-black uppercase tracking-widest backdrop-blur-md shadow-lg whitespace-nowrap min-w-max">
                    {gameState.phase} • {toCall > 0 ? `To Call: ${toCall}` : 'Check or Bet'}
                </div>
            </div>

            {/* 🃏 Community Cards */}
            <div className="absolute top-[30%] left-1/2 -translate-x-1/2 z-[140] pointer-events-none">
                <div className="flex space-x-2 md:space-x-3">
                    {gameState.communityCards.map((c, i) => (
                        <Card key={i} card={c} className="scale-90 md:scale-125 shadow-2xl" />
                    ))}
                    {Array(5 - gameState.communityCards.length).fill(0).map((_, i) => (
                        <div key={i} className="w-14 h-20 md:w-20 md:h-28 rounded-xl border-2 border-white/5 bg-black/20 backdrop-blur-sm" />
                    ))}
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
                                <div className={`text-[10px] font-black text-center uppercase py-0.5 min-h-[16px] leading-tight ${p.isFolded ? 'text-red-500' : 'text-emerald-400'}`}>
                                    {p.isFolded ? (
                                        'Folded'
                                    ) : (
                                        p.currentBet > 0
                                            ? <span className="text-yellow-400">{p.lastAction || 'Bet'} ${p.currentBet}</span>
                                            : (p.lastAction || 'Wait')
                                    )}
                                </div>
                            </div>

                            {/* Cards for other players (reveal on game finish) */}
                            {!isMe && !p.isFolded && (
                                <div className="flex -space-x-6 mt-1 translate-y-[-4px]">
                                    {gameState.isFinished ? (
                                        p.hand.map((c, i) => <Card key={i} card={c} className="scale-40 origin-top shadow-xl" />)
                                    ) : (
                                        <>
                                            <Card isHidden className="scale-40 origin-top shadow-xl" />
                                            <Card isHidden className="scale-40 origin-top shadow-xl" />
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}

            {/* My Dedicated Hand & Info Area (Bottom) - Cards on Top! */}
            <div className="fixed bottom-0 left-0 right-0 h-32 md:h-40 z-[150] bg-gradient-to-t from-black via-black/80 to-transparent flex items-center justify-center px-4 pointer-events-none">
                <div className="flex items-center space-x-6 mb-2 pointer-events-auto">
                    {/* User Profile Info */}
                    <div className="flex flex-col items-center">
                        <div className={`
                            w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center text-3xl md:text-4xl shadow-2xl border-4 transition-all
                            ${gameState.currentPlayerIndex === playerIndex ? 'bg-yellow-500 border-yellow-400 scale-110' : 'bg-gray-800 border-white/10'}
                        `}>
                            👤
                        </div>
                        <div className="mt-2 text-center">
                            <div className="text-white font-black text-sm md:text-base leading-none">{me.name}</div>
                            <div className="text-yellow-500 font-black text-xs md:text-sm mt-1">💰 {me.chips.toLocaleString()}</div>
                        </div>
                    </div>

                    {/* User Cards */}
                    <div className="flex -space-x-10 md:-space-x-12 translate-y-[-4px]">
                        {!me.isFolded && me.hand.map((c, i) => (
                            <Card
                                key={i}
                                card={c}
                                className={`
                                    shadow-2xl transition-all duration-300
                                    ${gameState.currentPlayerIndex === playerIndex ? 'scale-110 md:scale-125 z-10' : 'scale-100 md:scale-110 opacity-80'}
                                    hover:translate-y-[-10px]
                                `}
                            />
                        ))}
                        {me.isFolded && <div className="text-red-500 font-black text-2xl uppercase tracking-tighter opacity-50">FOLDED</div>}
                    </div>
                </div>
            </div>

            {/* Error Message Toast */}
            {error && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[200] bg-red-600 text-white px-6 py-3 rounded-full font-black shadow-2xl border-2 border-white/20 animate-bounce">
                    ⚠️ {error}
                </div>
            )}

            {/* Action Bar (Centered & Highest Layer) */}
            {isMyTurn && (
                <div className="fixed bottom-32 md:bottom-36 left-1/2 -translate-x-1/2 z-[200] flex flex-col items-center w-full max-w-sm pointer-events-none px-4">
                    <div className="w-full bg-black/60 backdrop-blur-3xl rounded-3xl p-5 border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.6)] pointer-events-auto">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-white/40 text-[9px] font-black uppercase tracking-widest">Raise To</span>
                            <span className="text-yellow-500 font-black text-xl">💰 {raiseAmount}</span>
                        </div>

                        {/* Bet Slider */}
                        <div className="flex items-center space-x-4 mb-4">
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
                        <div className="grid grid-cols-4 gap-1.5 mb-4 text-[9px] font-black">
                            <button onClick={() => setRaiseAmount(Math.floor(gameState.pot * 0.5))} className="py-2 bg-white/5 rounded-lg border border-white/5 text-white/40 hover:bg-white/10 transition-colors">1/2 POT</button>
                            <button onClick={() => setRaiseAmount(Math.floor(gameState.pot * 0.75))} className="py-2 bg-white/5 rounded-lg border border-white/5 text-white/40 hover:bg-white/10 transition-colors">3/4 POT</button>
                            <button onClick={() => setRaiseAmount(gameState.pot)} className="py-2 bg-white/5 rounded-lg border border-white/5 text-white/40 hover:bg-white/10 transition-colors">POT</button>
                            <button onClick={() => setRaiseAmount(me.chips + me.currentBet)} className="py-2 bg-red-900/20 rounded-lg border border-red-500/30 text-red-500/80 hover:bg-red-900/40 transition-colors">ALL-IN</button>
                        </div>

                        {/* Primary Interaction Buttons */}
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                onClick={() => handleAction('Fold')}
                                className="py-3.5 bg-gray-800 hover:bg-gray-700 text-white font-black rounded-2xl transition-all shadow-lg active:scale-95 border border-white/5"
                            >
                                FOLD
                            </button>

                            {toCall <= 0 ? (
                                <button
                                    onClick={() => handleAction('Check')}
                                    className="py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl transition-all shadow-lg active:scale-95 shadow-blue-500/20 border border-blue-400/50"
                                >
                                    CHECK
                                </button>
                            ) : (
                                <button
                                    onClick={() => handleAction('Call')}
                                    className="py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl transition-all shadow-lg active:scale-95 shadow-indigo-500/20 border border-indigo-400/50 flex flex-col items-center justify-center leading-tight"
                                >
                                    <span className="text-xs">CALL</span>
                                    <span className="text-[9px] opacity-70">{toCall}</span>
                                </button>
                            )}

                            <button
                                onClick={() => handleAction('Raise', raiseAmount)}
                                className="py-3.5 bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-2xl transition-all shadow-lg active:scale-95 shadow-yellow-500/20 border-b-4 border-yellow-700 flex flex-col items-center justify-center leading-tight"
                            >
                                <span className="text-xs">{toCall <= 0 ? 'BET' : 'RAISE'}</span>
                                <span className="text-[9px] opacity-70">{raiseAmount}</span>
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
