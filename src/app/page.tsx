"use client";

import { useAppSession } from "../hooks/useAppSession";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const { session, status } = useAppSession();
  const router = useRouter();

  useEffect(() => {
    console.log("[Home] Auth Status:", status);
    if (status === "unauthenticated") {
      window.location.href = "/Texas-Poker/auth/signin/";
    } else if (status === "authenticated") {
      window.location.href = "/Texas-Poker/lobby/";
    }
  }, [status]);

  return (
    <main className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-yellow-500 font-bold animate-pulse text-2xl">
        Loading Shenmao Texas Poker...
      </div>
    </main>
  );
}
