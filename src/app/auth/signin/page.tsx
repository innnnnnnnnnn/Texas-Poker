"use client";

import { useAppSession } from "../../../hooks/useAppSession";
import { useRouter } from "next/navigation";
import React, { useState, useEffect } from "react";
import liff from "@line/liff";

const SignInPage = () => {
    const [guestName, setGuestName] = useState("");
    const { session, status, login } = useAppSession();
    const router = useRouter();
    const [liffError, setLiffError] = useState<string | null>(null);

    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;

    // 如果已經登入，自動跳轉到大廳
    useEffect(() => {
        if (status === "authenticated") {
            window.location.href = "/Texas-Poker/lobby/";
        }
    }, [status]);

    const handleGuestLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (guestName.trim()) {
            login(guestName);
        }
    };

    const handleLineLogin = async () => {
        if (!liffId) {
            setLiffError("尚未設定 NEXT_PUBLIC_LIFF_ID。");
            return;
        }

        try {
            await liff.init({ liffId: liffId.trim() });
            if (!liff.isLoggedIn()) {
                liff.login();
            } else {
                const profile = await liff.getProfile();
                login(profile.displayName);
            }
        } catch (err: any) {
            setLiffError("LINE 登入失敗: " + err.message);
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md bg-[#1a1a1a] rounded-3xl p-8 border border-white/10 shadow-2xl">
                <h1 className="text-4xl font-black text-center mb-2 bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent">
                    神貓德州撲克
                </h1>
                <p className="text-white/60 text-center mb-10">Shenmao Texas Poker Online</p>

                {liffError && (
                    <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-400 text-sm text-center">
                        ⚠️ {liffError}
                        <br />
                        <span className="text-[10px]">請確保已在 GitHub Repository Secrets 設定 NEXT_PUBLIC_LIFF_ID</span>
                    </div>
                )}

                <div className="space-y-4">
                    <form onSubmit={handleGuestLogin} className="pb-6 border-b border-white/5 mb-6">
                        <div className="text-white/40 text-sm mb-2 text-center">快速試玩 (訪客登入)</div>
                        <div className="flex space-x-2">
                            <input
                                type="text"
                                placeholder="輸入暱稱..."
                                value={guestName}
                                onChange={(e) => setGuestName(e.target.value)}
                                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-yellow-500 outline-none"
                            />
                            <button
                                type="submit"
                                className="bg-yellow-500 hover:bg-yellow-400 text-black font-black px-6 py-3 rounded-xl transition-all active:scale-95"
                            >
                                開始!
                            </button>
                        </div>
                    </form>

                    <div className="text-white/40 text-xs text-center mb-2">或使用社群帳號 (實際登入)</div>

                    <button
                        onClick={handleLineLogin}
                        className="w-full py-4 bg-[#06C755] hover:bg-[#05b14c] text-white font-bold rounded-xl flex items-center justify-center space-x-3 transition-all active:scale-95 shadow-lg shadow-green-900/20"
                    >
                        <span className="text-xl">💬</span>
                        <span>使用 LINE 帳號登入</span>
                    </button>
                </div>

                <div className="mt-12 text-center text-white/30 text-sm">
                    登入即表示您同意服務條款。
                </div>

                {/* Debug Footer (Only visible during setup/dev) */}
                <div className="mt-8 pt-4 border-t border-white/5 opacity-10 hover:opacity-100 transition-opacity">
                    <p className="text-[10px] text-white/40 text-center font-mono">
                        DEBUG: ST={status} | ID={liffId ? `${liffId.substring(0, 6)}...` : "NONE"}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SignInPage;
