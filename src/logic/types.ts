export enum Suit {
    Club = 0,    // 梅花 ♣
    Diamond = 1, // 方塊 ♦
    Heart = 2,   // 紅心 ♥
    Spade = 3,   // 黑桃 ♠
}

export enum Rank {
    Two = 2,
    Three = 3,
    Four = 4,
    Five = 5,
    Six = 6,
    Seven = 7,
    Eight = 8,
    Nine = 9,
    Ten = 10,
    Jack = 11,
    Queen = 12,
    King = 13,
    Ace = 14,
}

export interface Card {
    suit: Suit;
    rank: Rank;
}

export enum HandType {
    HighCard = 'HighCard',
    OnePair = 'OnePair',
    TwoPair = 'TwoPair',
    ThreeOfAKind = 'ThreeOfAKind',
    Straight = 'Straight',
    Flush = 'Flush',
    FullHouse = 'FullHouse',
    FourOfAKind = 'FourOfAKind',
    StraightFlush = 'StraightFlush',
    RoyalFlush = 'RoyalFlush',
}

export type GamePhase = 'Waiting' | 'PreFlop' | 'Flop' | 'Turn' | 'River' | 'Showdown';

export interface Player {
    id: string;
    name: string;
    hand: Card[]; // Hole cards (2 cards)
    isHuman: boolean;
    chips: number;
    isFolded: boolean;
    isAllIn: boolean;
    currentBet: number;
    lastAction?: 'Fold' | 'Check' | 'Call' | 'Raise' | 'All-in' | 'SB' | 'BB';
}

export interface GameState {
    players: Player[];
    communityCards: Card[];
    currentPlayerIndex: number;
    dealerIndex: number;
    smallBlindIndex: number;
    bigBlindIndex: number;
    pot: number;
    smallBlind: number;
    bigBlind: number;
    phase: GamePhase;
    currentMaxBet: number;
    lastRaiserIndex: number | null;
    winners: { playerId: string, amount: number, handName?: string, cards?: Card[] }[];
    isFinished: boolean;
    history: string[]; // Log of actions
}

export interface HandRank {
    type: HandType;
    value: number; // Primary value for comparison
    kickers: number[]; // Additional values for tie-breaking
    cards: Card[]; // The 5 cards forming the hand
}
