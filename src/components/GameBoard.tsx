"use client";

import React, { useState, useEffect } from 'react';
import { GameState, Card as CardType, Player } from '../logic/types';
import Card from './Card';
import { Socket } from 'socket.io-client';
import { useAudio } from '../hooks/useAudio';
import confetti from 'canvas-confetti';
import { useRouter } from 'next/navigation';

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
    console.log("[GameBoard] Mounting... PlayerIndex:", playerIndex);
    const router = useRouter();
    const [gameState, setGameState] = useState<GameState>(initialGameState);
    const [error, setError] = useState<string | null>(null);
    const [raiseAmount, setRaiseAmount] = useState<number>(initialGameState.bigBlind * 2);
    const [viewFocusIndex, setViewFocusIndex] = useState<number>(playerIndex !== -1 ? playerIndex : 0);
    const [showTournamentVictory, setShowTournamentVictory] = useState(false);
    const [tournamentWinnerName, setTournamentWinnerName] = useState("");
    const [careerStats, setCareerStats] = useState({
        matchWins: 0,
        totalMatches: 0,
        handWins: 0,
        totalHands: 0
    });
    const [sessionStats, setSessionStats] = useState({
        wins: 0,
        total: 0
    });
    const { playSound } = useAudio();

    const gameStateRef = React.useRef(gameState);
    const sessionStatsRef = React.useRef(sessionStats);
    const careerStatsRef = React.useRef(careerStats);

    useEffect(() => {
        gameStateRef.current = gameState;
        sessionStatsRef.current = sessionStats;
        careerStatsRef.current = careerStats;
    }, [gameState, sessionStats, careerStats]);

    useEffect(() => {
        console.log("[GameBoard] Setting up socket listeners");

        // Load Career Stats
        const saved = localStorage.getItem('poker_career_stats');
        if (saved) setCareerStats(JSON.parse(saved));

        socket.on("state_update", (state: GameState) => {
            console.log("[GameBoard] Socket: state_update");
            const prevState = gameStateRef.current;
            setGameState(state);
            setError(null);

            // Track hand results for session stats
            if (prevState && !prevState.isFinished && state.isFinished) {
                const myState = state.players.find(p => p.name === (prevState.players[playerIndex]?.name || ''));
                const isWinner = state.winners.some(w => w.playerId === myState?.id);
                setSessionStats(prev => ({
                    wins: prev.wins + (isWinner ? 1 : 0),
                    total: prev.total + 1
                }));
                playSound('win');
            } else {
                playSound('play');
            }
        });

        socket.on("game_start", (data: { state: GameState, playerIndex: number }) => {
            console.log("[GameBoard] Socket: game_start", data.playerIndex);
            setGameState(data.state);
            setError(null);
            setShowTournamentVictory(false);
            playSound('deal');
        });

        socket.on("error", (msg: string) => {
            setError(msg);
            playSound('error');
        });

        socket.on("force_leave", (reason: string) => {
            console.log("[GameBoard] Forced to leave:", reason);
            alert(reason);
            window.location.href = "/Texas-Poker/";
        });

        socket.on("tournament_winner", (data: { winner: string }) => {
            console.log("[GameBoard] Socket: tournament_winner", data.winner);

            const currentMeName = gameStateRef.current?.players[playerIndex]?.name;

            // Only show victory screen if I am the winner
            if (data.winner === currentMeName) {
                setTournamentWinnerName(data.winner);
                setShowTournamentVictory(true);

                const currentSessionStats = sessionStatsRef.current;
                const currentCareerStats = careerStatsRef.current;

                // Update career stats
                const newStats = {
                    ...currentCareerStats,
                    matchWins: currentCareerStats.matchWins + 1,
                    totalMatches: currentCareerStats.totalMatches + 1,
                    handWins: currentCareerStats.handWins + currentSessionStats.wins,
                    totalHands: currentCareerStats.totalHands + currentSessionStats.total
                };
                setCareerStats(newStats);
                localStorage.setItem('poker_career_stats', JSON.stringify(newStats));

                // Fire confetti!
                confetti({
                    particleCount: 150,
                    spread: 70,
                    origin: { y: 0.6 }
                });
            } else {
                window.location.href = "/Texas-Poker/";
            }
        });

        return () => {
            console.log("[GameBoard] Cleaning up socket listeners");
            socket.off("state_update");
            socket.off("game_start");
            socket.off("error");
            socket.off("force_leave");
            socket.off("tournament_winner");
        };
    }, [socket, playerIndex, playSound, router]);

    const isMyTurn = gameState.currentPlayerIndex === playerIndex && !gameState.isFinished;
    const me = (playerIndex !== -1 && gameState.players[playerIndex])
        ? gameState.players[playerIndex]
        : { id: 'spectator', name: '觀戰中', chips: 0, currentBet: 0, isFolded: true, isAllIn: false, hand: [] as CardType[] };

    // Mechanism: Smart Default Raise Amount
    useEffect(() => {
        if (isMyTurn && me) {
            const minLegalRaise = gameState.currentMaxBet + gameState.bigBlind;
            const maxPossible = me.chips + me.currentBet;
            // Set default to minimum legal, but cap it at total possible (All-in)
            setRaiseAmount(Math.min(minLegalRaise, maxPossible));
        }
    }, [isMyTurn, gameState.currentMaxBet, me?.chips, me?.currentBet, gameState.bigBlind, me]);

    const handleAction = (action: string, amount: number = 0) => {
        socket.emit("poker_action", { roomId, action, amount });
    };

    // Fix: seat positions for 8 players
    // Seat 0 is always the current player
    const getSeatPosition = (index: number) => {
        const relativeIndex = (index - viewFocusIndex + 8) % 8;
        const positions = [
            { bottom: '16%', left: '50%', transform: 'translateX(-50%)' },          // Seat 0 (Focus/Me)
            { bottom: '6%', left: '5%', transform: 'none' },                        // Seat 1 (Downstream 1)
            { bottom: '28%', left: '2%', transform: 'none' },                       // Seat 2 (Downstream 2)
            { top: '12%', left: '5%', transform: 'none' },                         // Seat 3 (Downstream 3)
            { top: '5%', left: '50%', transform: 'translateX(-50%)' },              // Seat 4 (Top Center)
            { top: '12%', right: '5%', transform: 'none' },                        // Seat 5 (Upstream 3)
            { bottom: '28%', right: '2%', transform: 'none' },                      // Seat 6 (Upstream 2)
            { bottom: '6%', right: '5%', transform: 'none' },                       // Seat 7 (Upstream 1)
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

            {/* 💰 Pot Display (Single Line) */}
            <div className="absolute top-[23%] left-1/2 -translate-x-1/2 z-[140] pointer-events-none">
                <div className="bg-black/70 backdrop-blur-md px-4 py-1.5 rounded-full border border-yellow-500/30 flex items-center space-x-2 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                    <span className="text-white/40 text-[10px] uppercase font-black tracking-widest">Pot</span>
                    <div className="w-[1px] h-3 bg-white/10" />
                    <span className="text-yellow-500 font-black text-xl md:text-2xl tracking-wide flex items-center">
                        <span className="mr-1.5 opacity-80">💰</span>
                        {gameState.pot.toLocaleString()}
                    </span>
                </div>
            </div>

            {/* 📊 Phase & street info (Street Info) */}
            <div className="absolute top-[43%] left-1/2 -translate-x-1/2 z-[140] pointer-events-none text-center">
                <div className="bg-white/5 border border-white/10 px-4 py-1.5 rounded-full text-[10px] md:text-xs text-white/80 font-black uppercase tracking-widest backdrop-blur-md shadow-lg whitespace-nowrap min-w-max">
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
                        className="absolute transition-all duration-500 z-20 cursor-pointer hover:brightness-110"
                        style={pos}
                        onClick={() => setViewFocusIndex(idx)}
                    >
                        <div className={`relative flex flex-col items-center ${p.isFolded ? 'opacity-40 scale-90 grayscale' : 'scale-100'}`}>
                            {/* Role Indicator (D, SB, BB) */}
                            <div className="absolute -top-6 flex space-x-1">
                                {gameState.dealerIndex === idx && <div className="w-6 h-6 rounded-full bg-white text-black text-[10px] font-black border border-gray-400 flex items-center justify-center shadow-md">D</div>}
                                {gameState.smallBlindIndex === idx && <div className="w-6 h-6 rounded-full bg-blue-500 text-white text-[10px] font-black border border-blue-200 flex items-center justify-center shadow-md">SB</div>}
                                {gameState.bigBlindIndex === idx && <div className="w-6 h-6 rounded-full bg-red-500 text-white text-[10px] font-black border border-red-200 flex items-center justify-center shadow-md">BB</div>}
                            </div>

                            {/* Player Card (Restructured to 3 Vertical Layers) */}
                            <div className={`
                                w-24 md:w-32 bg-black/80 backdrop-blur-md rounded-2xl p-1.5 border-2 transition-all shadow-2xl flex flex-col items-stretch
                                ${isCurrent ? 'border-yellow-400 ring-4 ring-yellow-400/20 shadow-yellow-500/20' : 'border-white/10'}
                                ${idx === viewFocusIndex ? 'shadow-[0_0_20px_rgba(59,130,246,0.3)] border-blue-500/50' : ''}
                            `}>
                                {/* Layer 1: Name (Top Center) */}
                                <div className="text-white text-[10px] md:text-xs font-bold truncate text-center mb-1 pb-1 border-b border-white/5 flex items-center justify-center gap-1">
                                    {idx === viewFocusIndex && <span className="text-[8px] animate-pulse">👁️</span>}
                                    {p.name}
                                </div>

                                {/* Layer 2: Avatar (Left) & Chips (Right) */}
                                <div className="flex justify-between items-center mb-1 px-0.5">
                                    <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-gradient-to-br from-gray-700 to-black border border-white/10 flex items-center justify-center text-[10px]">{p.isHuman ? '👤' : '🤖'}</div>
                                    <div className="text-yellow-500 text-[10px] font-black tracking-tighter">
                                        💰{(p.chips || 0).toLocaleString()}
                                    </div>
                                </div>

                                {/* Layer 3: Action Status (Bottom Center) */}
                                <div className={`text-[10px] font-black text-center uppercase py-0.5 min-h-[16px] leading-tight rounded-lg bg-white/5 ${p.isFolded ? 'text-red-500' : 'text-emerald-400'}`}>
                                    {p.isFolded ? (
                                        'Folded'
                                    ) : (
                                        p.currentBet > 0
                                            ? <span className="text-yellow-400">{p.lastAction || 'Bet'} ${p.currentBet}</span>
                                            : (p.lastAction || 'Wait')
                                    )}
                                </div>
                            </div>

                            {/* Cards for other players (reveal on game finish or if spectating/masked) */}
                            {!isMe && !p.isFolded && (
                                <div className="flex -space-x-6 mt-1 translate-y-[-4px]">
                                    {p.hand && p.hand.length > 0 ? (
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
                <div className="flex items-center space-x-3 mb-2 pointer-events-auto">
                    {/* Focus Profile Info */}
                    <div className="flex flex-col items-center">
                        <div className={`
                            w-[68px] h-[68px] md:w-[76px] md:h-[76px] rounded-full flex items-center justify-center text-3xl md:text-4xl shadow-2xl border-4 transition-all
                            ${gameState.currentPlayerIndex === viewFocusIndex ? 'bg-yellow-500 border-yellow-400 scale-110' : 'bg-gray-800 border-white/10'}
                        `}>
                            {gameState.players[viewFocusIndex]?.isHuman ? '👤' : '🤖'}
                        </div>
                        <div className="mt-1 text-center">
                            <div className="text-yellow-500 font-black text-xs md:text-sm">💰 {(gameState.players[viewFocusIndex]?.chips || 0).toLocaleString()}</div>
                        </div>
                    </div>

                    {/* Focus Cards */}
                    <div className="flex -space-x-10 md:-space-x-12 translate-y-[-4px]">
                        {!gameState.players[viewFocusIndex]?.isFolded && (gameState.players[viewFocusIndex]?.hand || []).map((c, i) => (
                            <Card
                                key={i}
                                card={c}
                                className={`
                                    shadow-2xl transition-all duration-300
                                    ${gameState.currentPlayerIndex === viewFocusIndex ? 'scale-110 md:scale-125 z-10' : 'scale-100 md:scale-110'}
                                    hover:translate-y-[-10px]
                                `}
                            />
                        ))}
                        {gameState.players[viewFocusIndex]?.isFolded && <div className="text-red-500 font-black text-2xl uppercase tracking-tighter opacity-50">FOLDED</div>}
                        {!gameState.players[viewFocusIndex]?.isFolded && (!gameState.players[viewFocusIndex]?.hand || gameState.players[viewFocusIndex].hand.length === 0) && (
                            <div className="flex -space-x-8">
                                <Card isHidden className="scale-100 md:scale-110" />
                                <Card isHidden className="scale-100 md:scale-110" />
                            </div>
                        )}
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
                                onClick={() => handleAction("Fold")}
                                className="py-3.5 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl shadow-lg transition-transform active:scale-95 text-xs"
                            >
                                FOLD
                            </button>

                            {toCall <= 0 ? (
                                <button
                                    onClick={() => handleAction('Check')}
                                    className="py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl transition-all shadow-lg active:scale-95 shadow-blue-500/20 border border-blue-400/50 text-xs"
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
                                <span className="text-xs">
                                    {raiseAmount >= (me.chips + me.currentBet) ? 'ALL-IN' : (toCall <= 0 ? 'BET' : 'RAISE')}
                                </span>
                                <span className="text-[9px] opacity-70">{raiseAmount}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Exit Button - Top Left */}
            <button
                onClick={onExit}
                className="fixed z-50 p-3 bg-black/40 backdrop-blur-md rounded-full border border-white/10 hover:bg-red-900/40 text-white/40 hover:text-white transition-all shadow-xl"
                style={{ top: '10px', left: '10px' }}
                title="Exit Game"
            >
                🚪
            </button>

            {/* 🏆 原子化技術緊湊結算控制區 - 影視化 & 動作條對齊版 */}
            {gameState.isFinished && !showTournamentVictory && (
                <>
                    {/* 全桌背景 (Table Backdrop) - 移除霧化效果 */}
                    <div className="fixed inset-0 z-[190] bg-black/10 animate-in fade-in duration-500" />

                    {/* 結算控制卡片 - 位置與下注條完全同步 (Positioned like Action Bar) */}
                    <div className="fixed bottom-32 md:bottom-36 left-1/2 -translate-x-1/2 z-[200] flex flex-col items-center w-[60%] pointer-events-none px-4">
                        <div className="w-full bg-black/60 backdrop-blur-3xl rounded-[32px] p-6 md:p-8 border border-white/20 shadow-[0_20px_80px_rgba(0,0,0,0.6)] pointer-events-auto flex flex-col items-center text-center animate-in fade-in zoom-in duration-300">

                            {/* 獲勝宣告組 (Winning Announcement Group) - 靜態 & 縮小 */}
                            <div className="mb-0 text-[10px] text-yellow-500/40 font-black uppercase tracking-[0.2em]">
                                🎊 Showdown 🎊
                            </div>

                            <div className="h-3" /> {/* 12px 穩定間隔 */}

                            <div className="flex items-center space-x-2 mb-0">
                                <div className="w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center text-[10px] shadow-lg">
                                    {gameState.winners[0]?.playerId && gameState.players.find(p => p.id === gameState.winners[0].playerId)?.isHuman ? '👤' : '🤖'}
                                </div>
                                <h2 className="text-white text-base font-black tracking-tight">
                                    {gameState.winners[0]
                                        ? (gameState.players.find(p => p.id === gameState.winners[0].playerId)?.name || "贏家")
                                        : "無人獲勝"}
                                </h2>
                            </div>

                            <div className="text-yellow-500 font-black text-2xl drop-shadow-[0_2px_10px_rgba(234,179,8,0.4)]">
                                + {gameState.winners[0]?.amount.toLocaleString() || 0} 💰
                            </div>

                            <div className="h-3" /> {/* 12px 穩定間隔 */}

                            {/* 對局詳情組 (Hand Details Group) */}
                            <div className="flex flex-col items-center w-full">
                                {/* 決戰五張牌 (Winning Cards) */}
                                <div className="flex -space-x-4 md:-space-x-6 origin-top scale-[0.65] md:scale-85 mb-0">
                                    {gameState.winners[0]?.cards ? (
                                        gameState.winners[0].cards.map((c, i) => (
                                            <Card key={i} card={c} className="shadow-2xl ring-2 ring-white/10" />
                                        ))
                                    ) : (
                                        gameState.communityCards.map((c, i) => (
                                            <Card key={i} card={c} className="shadow-2xl ring-2 ring-white/10 opacity-50" />
                                        ))
                                    )}
                                </div>

                                {/* 牌型名稱 (Hand Name) - 精密緊貼 mt-[-28px] */}
                                <div className="mt-[-28px] md:mt-[-35px] text-yellow-500/90 font-black text-xs uppercase tracking-[0.2em] leading-none bg-black/60 px-4 py-1.5 rounded-full border border-yellow-500/20 backdrop-blur-xl z-20 shadow-xl">
                                    ( {gameState.winners[0]?.handName || "高牌"} )
                                </div>
                            </div>

                            <div className="h-3" /> {/* 12px 穩定間隔 */}

                            {/* 動作按鈕組 (Action Buttons) - 緊湊長方形雙色版 */}
                            <div className="flex justify-center gap-4 w-full">
                                <button
                                    onClick={onExit}
                                    className="w-28 py-3 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl shadow-[0_4px_0_rgb(150,0,0)] transition-all active:translate-y-1 text-[10px] uppercase tracking-widest"
                                >
                                    EXIT
                                </button>
                                {isHost ? (
                                    <button
                                        onClick={onNextGame}
                                        className="w-28 py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-xl shadow-[0_4px_0_rgb(180,100,0)] transition-all active:translate-y-1 text-[10px] uppercase tracking-widest"
                                    >
                                        NEXT
                                    </button>
                                ) : (
                                    <div className="flex items-center justify-center w-28 py-3 bg-black/40 text-yellow-500/30 font-black rounded-xl border border-yellow-500/10 text-[9px] italic tracking-tighter shadow-inner">
                                        WAIT HOST
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}
            {/* Tournament Victory Overlay */}
            {showTournamentVictory && (
                <div className="fixed inset-0 z-[1000] bg-black flex flex-col items-center justify-start animate-in fade-in duration-300 overflow-y-auto">
                    <div className="w-full flex flex-col items-center">
                        {/* (A) 🏆 Trophy Area: 15% - 35% height */}
                        <div className="relative mt-[15vh] flex flex-col items-center justify-center">
                            <div className="absolute inset-0 bg-yellow-500/20 blur-[10vw] rounded-full scale-150 animate-pulse" />
                            <div className="text-[25vw] md:text-[20vh] drop-shadow-[0_0_5vw_rgba(234,179,8,0.8)] relative z-10 leading-none">
                                🏆
                            </div>
                        </div>

                        {/* (B) Winner Name & Message: 35% - 50% height */}
                        <div className="text-center w-[90vw] mt-[2vh]">
                            <h3 className="text-white font-black text-[5vw] md:text-[3vh] tracking-tighter leading-none mb-[0.5vh]">
                                恭喜獲得最後勝利！
                            </h3>
                            <h2 className="text-yellow-500 font-extrabold text-[12vw] md:text-[7vh] tracking-widest leading-none">
                                {tournamentWinnerName}
                            </h2>
                        </div>

                        {/* (C) Stats Cards Area: 52% - 75% height */}
                        <div className="flex flex-col w-[85vw] max-w-[600px] mt-[4vh]">
                            {/* Match Stats */}
                            <div className="bg-white/10 border-x border-t border-white/20 rounded-t-[5vw] md:rounded-t-[3vh] p-[4vw] md:p-[2vh] backdrop-blur-md">
                                <div className="text-[3vw] md:text-[1.8vh] text-white font-black uppercase tracking-widest mb-[2vh] border-b border-white/10 pb-[1vh] text-center">
                                    本場戰報 (Current Match)
                                </div>
                                <div className="flex justify-around items-end">
                                    <div className="text-center">
                                        <div className="text-white font-black text-[6vw] md:text-[3.5vh] leading-none">{sessionStats.wins}</div>
                                        <div className="text-[2.2vw] md:text-[1.2vh] text-white/40 uppercase mt-[0.5vh] font-bold">勝局數</div>
                                    </div>
                                    <div className="w-[1px] h-[6vh] bg-white/20" />
                                    <div className="text-center">
                                        <div className="text-yellow-500 font-black text-[6vw] md:text-[3.5vh] leading-none">
                                            {sessionStats.total > 0 ? Math.round((sessionStats.wins / sessionStats.total) * 100) : 0}%
                                        </div>
                                        <div className="text-[2.2vw] md:text-[1.2vh] text-white/40 uppercase mt-[0.5vh] font-bold">局勝率</div>
                                    </div>
                                </div>
                            </div>

                            {/* Career Stats */}
                            <div className="bg-yellow-500/10 border border-white/20 rounded-b-[5vw] md:rounded-b-[3vh] p-[4vw] md:p-[2vh] backdrop-blur-md">
                                <div className="text-[3vw] md:text-[1.8vh] text-yellow-500 font-black uppercase tracking-widest mb-[2vh] border-b border-yellow-500/10 pb-[1vh] text-center">
                                    生涯榮譽 (Lifetime Career)
                                </div>
                                <div className="grid grid-cols-2 gap-[4vw]">
                                    <div className="space-y-[1vh] text-center">
                                        <div>
                                            <div className="text-white font-black text-[4.5vw] md:text-[2.5vh] leading-none">{careerStats.matchWins}</div>
                                            <div className="text-[2vw] md:text-[1.1vh] text-white/40 uppercase mt-[0.5vh] font-bold">總冠軍數</div>
                                        </div>
                                        <div>
                                            <div className="text-yellow-500 font-black text-[4.5vw] md:text-[2.5vh] leading-none">
                                                {careerStats.totalMatches > 0 ? Math.round((careerStats.matchWins / careerStats.totalMatches) * 100) : 0}%
                                            </div>
                                            <div className="text-[2vw] md:text-[1.1vh] text-white/40 uppercase mt-[0.5vh] font-bold">比賽勝率</div>
                                        </div>
                                    </div>
                                    <div className="space-y-[1vh] text-center">
                                        <div>
                                            <div className="text-white font-black text-[4.5vw] md:text-[2.5vh] leading-none">{careerStats.handWins + sessionStats.wins}</div>
                                            <div className="text-[2vw] md:text-[1.1vh] text-white/40 uppercase mt-[0.5vh] font-bold">總勝局數</div>
                                        </div>
                                        <div>
                                            <div className="text-yellow-500 font-black text-[4.5vw] md:text-[2.5vh] leading-none">
                                                {(careerStats.totalHands + sessionStats.total) > 0 ? Math.round(((careerStats.handWins + sessionStats.wins) / (careerStats.totalHands + sessionStats.total)) * 100) : 0}%
                                            </div>
                                            <div className="text-[2vw] md:text-[1.1vh] text-white/40 uppercase mt-[0.5vh] font-bold">總局勝率</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* (D) Buttons Area: 78% - 92% height */}
                        <div className="flex flex-row gap-[3vw] w-[85vw] max-w-[600px] mt-[5vh] mb-[8vh]">
                            <button
                                onClick={() => window.location.href = "/Texas-Poker/lobby/"}
                                className="flex-1 py-[4vw] md:py-[2vh] bg-white/10 hover:bg-white/20 text-white font-black rounded-[4vw] md:rounded-[2vh] border border-white/20 shadow-xl transition-all active:translate-y-1 uppercase text-[3.5vw] md:text-[1.8vh]"
                            >
                                回到大廳
                            </button>
                            <button
                                onClick={() => {
                                    const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
                                    window.location.href = `/Texas-Poker/room?id=${newRoomId}`;
                                }}
                                className="flex-1 py-[4vw] md:py-[2vh] bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-[4vw] md:rounded-[2vh] shadow-[0_0.8vh_0_rgb(180,100,0)] transition-all active:translate-y-1 uppercase text-[3.5vw] md:text-[1.8vh]"
                            >
                                再玩一場
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GameBoard;
