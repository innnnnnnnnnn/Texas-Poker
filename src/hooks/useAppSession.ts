"use client";

import { useEffect, useState, useMemo } from "react";
import liff from "@line/liff";

export interface AppUser {
    id: string;
    name: string;
}

export const useAppSession = () => {
    const [user, setUser] = useState<AppUser | null>(null);
    const [status, setStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading");
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;

    useEffect(() => {
        const initSession = async () => {
            console.log("[AppSession] Initializing...");

            // 1. Check LocalStorage first for high speed
            const stored = localStorage.getItem("texas_user");
            if (stored) {
                try {
                    const parsed = JSON.parse(stored);
                    setUser(parsed);
                    setStatus("authenticated");
                    console.log("[AppSession] Authenticated via LocalStorage:", parsed.name);
                } catch (_) {
                    console.error("[AppSession] LocalStorage parse error");
                }
            }

            // 2. Check LIFF if ID exists
            if (liffId) {
                try {
                    console.log("[AppSession] Initializing LIFF:", liffId.trim());
                    await liff.init({ liffId: liffId.trim() });
                    if (liff.isLoggedIn()) {
                        const profile = await liff.getProfile();
                        console.log("[AppSession] LIFF Profile found:", profile.displayName);

                        const newUser = { id: `line_${profile.userId}`, name: profile.displayName };
                        localStorage.setItem("texas_user", JSON.stringify(newUser));
                        setUser(newUser);
                        setStatus("authenticated");
                    } else if (!stored) {
                        setStatus("unauthenticated");
                    }
                } catch (err) {
                    console.error("[AppSession] LIFF Init Error:", err);
                    if (!stored) setStatus("unauthenticated");
                }
            } else if (!stored) {
                setStatus("unauthenticated");
            }
        };

        initSession();
    }, [liffId]);

    const login = (name: string) => {
        console.log("[AppSession] Logging in user:", name);
        const newUser = { id: `user_${Math.random().toString(36).substr(2, 9)}`, name };
        localStorage.setItem("texas_user", JSON.stringify(newUser));
        setUser(newUser);
        setStatus("authenticated");
    };

    const logout = () => {
        console.log("[AppSession] Logging out...");
        localStorage.removeItem("texas_user");
        if (liffId && liff.isLoggedIn()) {
            liff.logout();
        }
        setUser(null);
        setStatus("unauthenticated");
        // Force redirect to signin
        window.location.href = (process.env.NEXT_PUBLIC_BASE_PATH || "/texas") + "/auth/signin/";
    };

    const sessionObject = useMemo(() => (user ? { user } : null), [user]);

    return { session: sessionObject, status, login, logout };
};
