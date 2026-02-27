import { Card, Suit, Rank, Player, GameState, GamePhase } from './types';
import { evaluateBestHand, HAND_TYPE_CHINESE, compareHandRanks } from './poker';

export function createDeck(): Card[] {
    const deck: Card[] = [];
    for (const suit of [Suit.Club, Suit.Diamond, Suit.Heart, Suit.Spade]) {
        for (const rank of [
            Rank.Two, Rank.Three, Rank.Four, Rank.Five, Rank.Six, Rank.Seven,
            Rank.Eight, Rank.Nine, Rank.Ten, Rank.Jack, Rank.Queen, Rank.King, Rank.Ace
        ]) {
            deck.push({ suit, rank });
        }
    }
    return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

export function initializeGame(playerInfos: { name: string, isHuman: boolean, chips?: number }[]): GameState {
    const players: Player[] = playerInfos.map((info, i) => ({
        id: `p${i}`,
        name: info.name,
        hand: [],
        isHuman: info.isHuman,
        chips: info.chips || 1000,
        isFolded: false,
        isAllIn: false,
        currentBet: 0
    }));

    return startNewRound({
        players,
        communityCards: [],
        currentPlayerIndex: 0,
        dealerIndex: -1, // Will be incremented to 0
        pot: 0,
        smallBlind: 10,
        bigBlind: 20,
        phase: 'Waiting',
        currentMaxBet: 0,
        lastRaiserIndex: null,
        winners: [],
        isFinished: false,
        history: []
    });
}

export function startNewRound(state: GameState): GameState {
    const deck = shuffleDeck(createDeck());
    const players = state.players.map(p => ({
        ...p,
        hand: [] as Card[],
        isFolded: false,
        isAllIn: false,
        currentBet: 0,
        lastAction: undefined as Player['lastAction']
    }));

    const dealerIndex = (state.dealerIndex + 1) % players.length;
    const sbIndex = (dealerIndex + 1) % players.length;
    const bbIndex = (dealerIndex + 2) % players.length;

    // Deal hole cards
    for (let i = 0; i < 2; i++) {
        for (let j = 0; j < players.length; j++) {
            players[j].hand.push(deck.pop()!);
        }
    }

    // Post blinds
    players[sbIndex].chips -= state.smallBlind;
    players[sbIndex].currentBet = state.smallBlind;
    players[sbIndex].lastAction = 'Small Blind';

    players[bbIndex].chips -= state.bigBlind;
    players[bbIndex].currentBet = state.bigBlind;
    players[bbIndex].lastAction = 'Big Blind';

    return {
        ...state,
        players,
        communityCards: [],
        dealerIndex,
        currentPlayerIndex: (bbIndex + 1) % players.length,
        pot: state.smallBlind + state.bigBlind,
        phase: 'PreFlop',
        currentMaxBet: state.bigBlind,
        lastRaiserIndex: bbIndex,
        isFinished: false,
        winners: [],
        history: [`Round started. Dealer: ${players[dealerIndex].name}`]
    };
}

export function handleAction(state: GameState, playerIndex: number, action: string, amount: number = 0): GameState | string {
    if (state.currentPlayerIndex !== playerIndex) return "Not your turn";
    if (state.phase === 'Showdown' || state.isFinished) return "Game is not in betting phase";

    const player = state.players[playerIndex];
    const nextState = { ...state, players: [...state.players] };
    const nextPlayer = { ...player };
    nextState.players[playerIndex] = nextPlayer;

    switch (action) {
        case 'Fold':
            nextPlayer.isFolded = true;
            nextPlayer.lastAction = 'Fold';
            nextState.history.push(`${player.name} folds.`);
            break;

        case 'Check':
            if (player.currentBet < state.currentMaxBet) return "Cannot check, you must call or fold";
            nextPlayer.lastAction = 'Check';
            nextState.history.push(`${player.name} checks.`);
            break;

        case 'Call': {
            const callAmount = state.currentMaxBet - player.currentBet;
            if (callAmount > player.chips) {
                // All-in call
                return handleAction(state, playerIndex, 'All-in', player.chips);
            }
            nextPlayer.chips -= callAmount;
            nextPlayer.currentBet += callAmount;
            nextState.pot += callAmount;
            nextPlayer.lastAction = 'Call';
            nextState.history.push(`${player.name} calls ${callAmount}.`);
            break;
        }

        case 'Raise': {
            const totalBet = amount;
            if (totalBet <= state.currentMaxBet) return "Raise must be higher than current max bet";
            const raiseCost = totalBet - player.currentBet;
            if (raiseCost > player.chips) return "Not enough chips";

            nextPlayer.chips -= raiseCost;
            nextPlayer.currentBet = totalBet;
            nextState.pot += raiseCost;
            nextState.currentMaxBet = totalBet;
            nextState.lastRaiserIndex = playerIndex;
            nextPlayer.lastAction = 'Raise';
            nextState.history.push(`${player.name} raises to ${totalBet}.`);
            break;
        }

        case 'All-in': {
            const allInAmount = player.chips + player.currentBet;
            const diff = player.chips;
            nextPlayer.chips = 0;
            nextPlayer.currentBet = allInAmount;
            nextState.pot += diff;
            nextPlayer.isAllIn = true;
            if (allInAmount > state.currentMaxBet) {
                nextState.currentMaxBet = allInAmount;
                nextState.lastRaiserIndex = playerIndex;
            }
            nextPlayer.lastAction = 'All-in';
            nextState.history.push(`${player.name} goes All-in!`);
            break;
        }

        default:
            return "Invalid action";
    }

    return advanceTurn(nextState);
}

function advanceTurn(state: GameState): GameState {
    const foldedPlayers = state.players.filter(p => !p.isFolded);
    if (foldedPlayers.length === 1) {
        return resolveWinner(state, foldedPlayers[0].id);
    }

    let nextIndex = (state.currentPlayerIndex + 1) % state.players.length;

    while (state.players[nextIndex].isFolded || state.players[nextIndex].isAllIn) {
        if (nextIndex === state.lastRaiserIndex) break;
        nextIndex = (nextIndex + 1) % state.players.length;
    }

    if (nextIndex === state.lastRaiserIndex) {
        return advancePhase(state);
    }

    return { ...state, currentPlayerIndex: nextIndex };
}

function advancePhase(state: GameState): GameState {
    const getRandomCard = () => {
        const suits = [Suit.Club, Suit.Diamond, Suit.Heart, Suit.Spade];
        const ranks = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
        return {
            suit: suits[Math.floor(Math.random() * 4)],
            rank: ranks[Math.floor(Math.random() * 13)]
        };
    };

    let nextPhase: GamePhase = 'PreFlop';
    const communityCards = [...state.communityCards];

    switch (state.phase) {
        case 'PreFlop':
            nextPhase = 'Flop';
            for (let i = 0; i < 3; i++) communityCards.push(getRandomCard());
            break;
        case 'Flop':
            nextPhase = 'Turn';
            communityCards.push(getRandomCard());
            break;
        case 'Turn':
            nextPhase = 'River';
            communityCards.push(getRandomCard());
            break;
        case 'River':
            return showdown(state);
    }

    const players = state.players.map(p => ({
        ...p,
        currentBet: 0,
        lastAction: undefined as Player['lastAction']
    }));

    return {
        ...state,
        players,
        communityCards,
        phase: nextPhase,
        currentMaxBet: 0,
        lastRaiserIndex: (state.dealerIndex + 1) % state.players.length,
        currentPlayerIndex: (state.dealerIndex + 1) % state.players.length
    };
}

function showdown(state: GameState): GameState {
    const activePlayers = state.players.filter(p => !p.isFolded);
    const results = activePlayers.map(p => ({
        playerId: p.id,
        rank: evaluateBestHand([...p.hand, ...state.communityCards])
    })).sort((a, b) => compareHandRanks(b.rank, a.rank));

    const winnerId = results[0].playerId;
    return resolveWinner(state, winnerId, HAND_TYPE_CHINESE[results[0].rank.type]);
}

function resolveWinner(state: GameState, winnerId: string, handName?: string): GameState {
    const players = state.players.map(p => {
        if (p.id === winnerId) {
            return { ...p, chips: p.chips + state.pot };
        }
        return p;
    });

    return {
        ...state,
        players,
        isFinished: true,
        phase: 'Showdown',
        winners: [{ playerId: winnerId, amount: state.pot, handName }],
        history: [...state.history, `Winner: ${players.find(p => p.id === winnerId)?.name} wins ${state.pot} chips.`]
    };
}
