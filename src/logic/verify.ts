import { Suit, Rank, HandType } from './types';
import { rankHand, compareHandRanks, evaluateBestHand } from './poker';
import { initializeGame } from './game';

function test() {
    console.log('Running Texas Poker Logic Tests...\n');

    // Test 1: Hand Ranking
    const flushCards = [
        { suit: Suit.Spade, rank: Rank.Ace },
        { suit: Suit.Spade, rank: Rank.Ten },
        { suit: Suit.Spade, rank: Rank.Eight },
        { suit: Suit.Spade, rank: Rank.Five },
        { suit: Suit.Spade, rank: Rank.Two },
    ];
    const rank = rankHand(flushCards);
    console.log('Test 1: Flush');
    console.log('Is Flush:', rank.type === HandType.Flush);

    // Test 2: Full House
    const fullHouseCards = [
        { suit: Suit.Spade, rank: Rank.Ace },
        { suit: Suit.Heart, rank: Rank.Ace },
        { suit: Suit.Diamond, rank: Rank.Ace },
        { suit: Suit.Spade, rank: Rank.King },
        { suit: Suit.Heart, rank: Rank.King },
    ];
    const fhRank = rankHand(fullHouseCards);
    console.log('\nTest 2: Full House');
    console.log('Is Full House:', fhRank.type === HandType.FullHouse);

    // Test 3: Comparison
    console.log('\nTest 3: Comparison');
    console.log('Full House beats Flush:', compareHandRanks(fhRank, rank) > 0);

    // Test 4: evaluateBestHand
    const sevenCards = [
        ...fullHouseCards,
        { suit: Suit.Club, rank: Rank.Two },
        { suit: Suit.Club, rank: Rank.Three },
    ];
    const best = evaluateBestHand(sevenCards);
    console.log('\nTest 4: Best Hand from 7');
    console.log('Best type is Full House:', best.type === HandType.FullHouse);

    // Test 5: Game Initialization
    console.log('\nTest 5: Initialization');
    const state = initializeGame([
        { name: 'Alice', isHuman: true, chips: 1000 },
        { name: 'Bob', isHuman: false, chips: 1000 }
    ]);
    console.log('2 players:', state.players.length === 2);
    console.log('Pot has blinds (10+20=30):', state.pot === 30);
    console.log('Alice (SB) has 990:', state.players[0].chips === 990);
    console.log('Bob (BB) has 980:', state.players[1].chips === 980);
}

test();
