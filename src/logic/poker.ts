import { Card, Rank, HandType, HandRank } from './types';

/**
 * Evaluates the best 5-card hand from a set of cards (typically 7: 2 hole cards + 5 community cards).
 */
export function evaluateBestHand(cards: Card[]): HandRank {
    const combinations = getCombinations(cards, 5);
    let bestHand: HandRank | null = null;

    for (const combo of combinations) {
        const rank = rankHand(combo);
        if (!bestHand || compareHandRanks(rank, bestHand) > 0) {
            bestHand = rank;
        }
    }

    return bestHand!;
}

/**
 * Ranks a specific 5-card hand.
 */
export function rankHand(cards: Card[]): HandRank {
    const sorted = [...cards].sort((a, b) => b.rank - a.rank);
    const ranks = sorted.map(c => c.rank);
    const suits = sorted.map(c => c.suit);

    const isFlush = suits.every(s => s === suits[0]);

    // Check for Straight (including A-2-3-4-5)
    let isStraight = false;
    let straightValue = ranks[0];

    const uniqueRanks = Array.from(new Set(ranks)).sort((a, b) => b - a);
    if (uniqueRanks.length === 5) {
        if (uniqueRanks[0] - uniqueRanks[4] === 4) {
            isStraight = true;
            straightValue = uniqueRanks[0];
        } else if (
            uniqueRanks[0] === Rank.Ace &&
            uniqueRanks[1] === Rank.Five &&
            uniqueRanks[2] === Rank.Four &&
            uniqueRanks[3] === Rank.Three &&
            uniqueRanks[4] === Rank.Two
        ) {
            isStraight = true;
            straightValue = Rank.Five; // 5 is high in A2345
        }
    }

    // Frequencies
    const counts: Record<number, number> = {};
    ranks.forEach(r => counts[r] = (counts[r] || 0) + 1);
    const freq = Object.entries(counts)
        .map(([rank, count]) => ({ rank: Number(rank), count }))
        .sort((a, b) => b.count - a.count || b.rank - a.rank);

    // Royal Flush
    if (isFlush && isStraight && straightValue === Rank.Ace) {
        return { type: HandType.RoyalFlush, value: Rank.Ace, kickers: [], cards: sorted };
    }

    // Straight Flush
    if (isFlush && isStraight) {
        return { type: HandType.StraightFlush, value: straightValue, kickers: [], cards: sorted };
    }

    // Four of a Kind
    if (freq[0].count === 4) {
        return { type: HandType.FourOfAKind, value: freq[0].rank, kickers: [freq[1].rank], cards: sorted };
    }

    // Full House
    if (freq[0].count === 3 && freq[1].count === 2) {
        return { type: HandType.FullHouse, value: freq[0].rank, kickers: [freq[1].rank], cards: sorted };
    }

    // Flush
    if (isFlush) {
        return { type: HandType.Flush, value: ranks[0], kickers: ranks.slice(1), cards: sorted };
    }

    // Straight
    if (isStraight) {
        return { type: HandType.Straight, value: straightValue, kickers: [], cards: sorted };
    }

    // Three of a Kind
    if (freq[0].count === 3) {
        return { type: HandType.ThreeOfAKind, value: freq[0].rank, kickers: freq.slice(1).map(f => f.rank), cards: sorted };
    }

    // Two Pair
    if (freq[0].count === 2 && freq[1].count === 2) {
        return { type: HandType.TwoPair, value: Math.max(freq[0].rank, freq[1].rank), kickers: [Math.min(freq[0].rank, freq[1].rank), freq[2].rank], cards: sorted };
    }

    // One Pair
    if (freq[0].count === 2) {
        return { type: HandType.OnePair, value: freq[0].rank, kickers: freq.slice(1).map(f => f.rank), cards: sorted };
    }

    // High Card
    return { type: HandType.HighCard, value: ranks[0], kickers: ranks.slice(1), cards: sorted };
}

/**
 * Compares two hand ranks. Returns > 0 if a > b, < 0 if a < b, 0 if equal.
 */
export function compareHandRanks(a: HandRank, b: HandRank): number {
    const typeOrder = Object.values(HandType);
    const aOrder = typeOrder.indexOf(a.type);
    const bOrder = typeOrder.indexOf(b.type);

    if (aOrder !== bOrder) return aOrder - bOrder;

    if (a.value !== b.value) return a.value - b.value;

    for (let i = 0; i < Math.max(a.kickers.length, b.kickers.length); i++) {
        if ((a.kickers[i] || 0) !== (b.kickers[i] || 0)) {
            return (a.kickers[i] || 0) - (b.kickers[i] || 0);
        }
    }

    return 0;
}

/**
 * Helper to get all combinations of a certain size from an array.
 */
function getCombinations<T>(array: T[], size: number): T[][] {
    const result: T[][] = [];

    function backtrack(start: number, path: T[]) {
        if (path.length === size) {
            result.push([...path]);
            return;
        }

        for (let i = start; i < array.length; i++) {
            path.push(array[i]);
            backtrack(i + 1, path);
            path.pop();
        }
    }

    backtrack(0, []);
    return result;
}

export const HAND_TYPE_CHINESE: Record<HandType, string> = {
    [HandType.HighCard]: '高牌',
    [HandType.OnePair]: '一對',
    [HandType.TwoPair]: '兩對',
    [HandType.ThreeOfAKind]: '三條',
    [HandType.Straight]: '順子',
    [HandType.Flush]: '同花',
    [HandType.FullHouse]: '葫蘆',
    [HandType.FourOfAKind]: '四條',
    [HandType.StraightFlush]: '同花順',
    [HandType.RoyalFlush]: '皇家同花順',
};
