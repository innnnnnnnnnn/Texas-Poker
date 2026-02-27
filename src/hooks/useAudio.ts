import { useEffect } from 'react';

// Singleton AudioContext
let audioCtx: AudioContext | null = null;
const initAudio = () => {
    if (!audioCtx && typeof window !== 'undefined') {
        // @ts-ignore - compatibility for older browsers
        const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
            audioCtx = new AudioContextClass();
        }
    }
    return audioCtx;
};

const playTone = (type: 'play' | 'slide' | 'deal' | 'error' | 'win') => {
    const ctx = initAudio();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
        ctx.resume();
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === 'slide') {
        // 輕盈的紙牌點選摩擦聲
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.05);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
    } else if (type === 'play') {
        // 出牌時實體卡牌拍在桌上的重擊聲
        osc.type = 'square';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.1);

        // 加入雜訊般的低音與快速淡出
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'deal') {
        // 洗牌與發出
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.2);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
    } else if (type === 'error') {
        // 錯誤提示音
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.setValueAtTime(120, now + 0.1);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
    } else if (type === 'win') {
        // 勝利小鈴響
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.2); // G5 

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.2, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
        osc.start(now);
        osc.stop(now + 0.6);
    }
};

export const useAudio = () => {
    // 預載初始化 (通常需由第一個互動觸發)
    useEffect(() => {
        const handleFirstInteract = () => { initAudio(); };
        window.addEventListener('click', handleFirstInteract, { once: true });
        return () => window.removeEventListener('click', handleFirstInteract);
    }, []);

    const playSound = (type: 'play' | 'slide' | 'deal' | 'error' | 'win') => {
        try {
            playTone(type);
        } catch (e) {
            console.error('Audio playback failed', e);
        }
    };

    return { playSound };
};
