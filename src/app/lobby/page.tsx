"use client";

import { useAppSession } from "../../hooks/useAppSession";
import { useRouter } from "next/navigation";
import React, { useState } from "react";

const LobbyPage = () => {
    const { session, status, logout } = useAppSession();
    const router = useRouter();
    const [roomId, setRoomId] = useState("");

    if (status === "loading") return <div className="min-h-screen bg-black" />;
    if (!session) {
        router.push("/auth/signin");
        return null;
    }

    const createRoom = () => {
        const id = Math.random().toString(36).substring(2, 8).toUpperCase();
        router.push(`/room?id=${id}`);
    };

    const joinRoom = (e: React.FormEvent) => {
        e.preventDefault();
        if (roomId.trim()) {
            router.push(`/room?id=${roomId.toUpperCase()}`);
        }
    };

    return (
        <div className="h-screen bg-[#0a4d2e] p-4 md:p-8 flex flex-col items-center justify-center overflow-hidden">
            <div className="w-full max-w-4xl flex flex-col md:flex-row justify-between items-center mb-6 md:mb-12 gap-4">
                <h1 className="text-2xl md:text-3xl font-black text-yellow-500">大廳 Lobby</h1>
                <div className="flex items-center space-x-4 bg-black/30 p-3 md:p-4 rounded-2xl border border-white/10">
                    <div className="text-right">
                        <div className="text-white text-sm md:text-base font-bold">{session.user?.name}</div>
                        <div className="text-yellow-400 text-sm md:text-base font-black">💰 1,000</div>
                    </div>
                    <button onClick={() => logout()} className="text-white/50 hover:text-white text-xs md:text-sm">Sign Out</button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 w-full max-w-4xl overflow-y-auto max-h-[80vh] scrollbar-hide py-2">
                <div className="bg-black/20 rounded-2xl md:rounded-3xl p-6 md:p-10 border border-white/5 flex flex-col items-center justify-center space-y-4 md:space-y-6">
                    <div className="text-4xl md:text-6xl text-yellow-500">🃏</div>
                    <h2 className="text-xl md:text-2xl font-bold text-white">建立新牌桌</h2>
                    <p className="text-white/40 text-center text-sm md:text-base">邀請你的好友一起對戰，真的人數不足時可讓電腦補位。</p>
                    <button
                        onClick={createRoom}
                        className="w-full py-3 md:py-4 bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-xl transition-all shadow-[0_5px_0_rgb(180,100,0)] active:translate-y-1"
                    >
                        建立房間 (CREATE)
                    </button>
                </div>

                <div className="bg-black/20 rounded-2xl md:rounded-3xl p-6 md:p-10 border border-white/5 flex flex-col items-center justify-center space-y-4 md:space-y-6">
                    <div className="text-4xl md:text-6xl text-blue-500">🔗</div>
                    <h2 className="text-xl md:text-2xl font-bold text-white">加入現有房間</h2>
                    <form onSubmit={joinRoom} className="w-full space-y-3 md:space-y-4">
                        <input
                            type="text"
                            value={roomId}
                            onChange={(e) => setRoomId(e.target.value)}
                            placeholder="請輸入房間代碼"
                            className="w-full py-3 md:py-4 bg-black/40 border border-white/10 rounded-xl text-center text-white font-bold placeholder:text-white/20 text-sm md:text-base"
                        />
                        <button
                            type="submit"
                            className="w-full py-3 md:py-4 bg-white hover:bg-gray-200 text-black font-black rounded-xl transition-all shadow-[0_5px_0_rgb(150,150,150)] active:translate-y-1"
                        >
                            加入房間 (JOIN)
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default LobbyPage;
