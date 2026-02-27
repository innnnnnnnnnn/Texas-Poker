"use client";

import React from 'react';
import { Card as CardType, Suit, Rank } from '../logic/types';

interface CardProps {
    card?: CardType; // Optional as it might be hidden
    isHidden?: boolean;
    selected?: boolean;
    onClick?: () => void;
    className?: string;
    disabled?: boolean;
}

const suitSymbols = {
    [Suit.Club]: '♣',
    [Suit.Diamond]: '♦',
    [Suit.Heart]: '♥',
    [Suit.Spade]: '♠',
};

const rankLabels: Record<number, string> = {
    [Rank.Three]: '3',
    [Rank.Four]: '4',
    [Rank.Five]: '5',
    [Rank.Six]: '6',
    [Rank.Seven]: '7',
    [Rank.Eight]: '8',
    [Rank.Nine]: '9',
    [Rank.Ten]: '10',
    [Rank.Jack]: 'J',
    [Rank.Queen]: 'Q',
    [Rank.King]: 'K',
    [Rank.Ace]: 'A',
    [Rank.Two]: '2',
};

const Card: React.FC<CardProps> = ({ card, isHidden, selected, onClick, className = '', disabled }) => {
    if (isHidden || !card) {
        return (
            <div
                className={`
                    w-14 h-20 md:w-20 md:h-28 shrink-0
                    rounded-xl border-2 border-white/50
                    bg-[#1a365d] bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]
                    shadow-xl flex items-center justify-center
                    ${className}
                `}
            >
                <div className="w-10 h-14 md:w-14 md:h-20 border border-white/20 rounded-lg flex items-center justify-center">
                    <span className="text-white/20 text-3xl font-black">?</span>
                </div>
            </div>
        );
    }

    const isRed = card.suit === Suit.Diamond || card.suit === Suit.Heart;
    const colorClass = isRed ? 'text-red-600' : 'text-slate-900';

    return (
        <div
            onClick={!disabled ? onClick : undefined}
            className={`
                relative w-14 h-20 md:w-20 md:h-28 shrink-0
                rounded-xl border-[1px] bg-gradient-to-br from-white to-slate-200
                flex flex-col p-1 md:p-1.5 cursor-pointer transition-all duration-300 ease-out transform-gpu
                ${selected
                    ? '-translate-y-4 border-yellow-300 shadow-[0_0_30px_rgba(250,204,21,0.8)] ring-2 ring-yellow-400 z-[100]'
                    : 'border-white/60 shadow-lg hover:-translate-y-1'}
                ${disabled ? 'cursor-default opacity-90 grayscale-[0.2]' : ''}
                ${className}
            `}
        >
            {/* Top-left rank & suit */}
            <div className={`text-xs md:text-sm font-black ${colorClass} self-start leading-none`}>
                {rankLabels[card.rank]}
            </div>
            <div className={`text-xs md:text-base ${colorClass} self-start`}>
                {suitSymbols[card.suit]}
            </div>

            {/* Center large suit */}
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-2xl md:text-4xl ${colorClass} opacity-50`}>
                {suitSymbols[card.suit]}
            </div>

            {/* Bottom-right rank & suit (upside down) */}
            <div className={`absolute bottom-1 right-1 text-xs md:text-sm font-black ${colorClass} flex flex-col items-center leading-none rotate-180`}>
                <span>{rankLabels[card.rank]}</span>
                <span className="text-xs md:text-base">{suitSymbols[card.suit]}</span>
            </div>
        </div>
    );
};

export default Card;
