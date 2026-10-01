export const COLORS = ['Yellow', 'Blue', 'Purple', 'Pink', 'Green'];
export const CURRENCY_NAMES = ['Sterling', 'Dollar', 'Yuan', 'Euro', 'Rupee'];
export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 5;

export function assignCurrencyNames(playerIds) {
  return Object.fromEntries(
    [...playerIds].sort().map((playerId, index) => [playerId, CURRENCY_NAMES[index % CURRENCY_NAMES.length]]),
  );
}

export function isOrphanedRoomJoin(roomCode, joinedAsHost) {
  return Boolean(roomCode.trim()) && joinedAsHost;
}
export const COLOR_MARKS = {
  Yellow: 'Y',
  Blue: 'B',
  Purple: 'P',
  Pink: 'Pi',
  Green: 'G',
};
export const CHART_A = [0, 4, 8, 12, 16, 20];

const STARTING_COINS = { 3: 35, 4: 25, 5: 20 };
const STARTING_HANDS = { 3: 5, 4: 4, 5: 3 };

function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function createMissions() {
  const missions = [];
  for (let first = 0; first < COLORS.length; first += 1) {
    for (let second = first; second < COLORS.length; second += 1) {
      missions.push({
        id: `pair-${first}-${second}`,
        title: `${COLORS[first]} + ${COLORS[second]}`,
        requirement: { type: 'set', colors: [COLORS[first], COLORS[second]] },
        points: 5,
      });
    }
  }
  for (let first = 0; first < COLORS.length; first += 1) {
    for (let second = first + 1; second < COLORS.length; second += 1) {
      for (let third = second + 1; third < COLORS.length; third += 1) {
        missions.push({
          id: `triple-${first}-${second}-${third}`,
          title: `${COLORS[first]} + ${COLORS[second]} + ${COLORS[third]}`,
          requirement: { type: 'set', colors: [COLORS[first], COLORS[second], COLORS[third]] },
          points: 10,
        });
      }
    }
  }
  return [
    ...missions,
    { id: 'mystery-pair', title: 'Any pair', requirement: { type: 'pair' }, points: 5 },
    { id: 'mystery-two-pairs', title: 'Any two pairs', requirement: { type: 'two-pairs' }, points: 15 },
    { id: 'mystery-three-kind', title: 'Three of a kind', requirement: { type: 'three-kind' }, points: 10 },
    { id: 'mystery-three-colors', title: 'Three different', requirement: { type: 'three-different' }, points: 5 },
    { id: 'mystery-four-colors', title: 'Four different', requirement: { type: 'four-different' }, points: 10 },
  ];
}

function createAuctionDeck(playerCount) {
  const cardCount = (baseCount) => Math.max(1, Math.round(baseCount * playerCount / 5));
  return [
    ...Array.from({ length: cardCount(12) }, () => ({ type: 'gems', amount: 1, title: '1 gem' })),
    ...Array.from({ length: cardCount(5) }, () => ({ type: 'gems', amount: 2, title: '2 gems' })),
    ...Array.from({ length: cardCount(2) }, () => ({ type: 'invest', amount: 5, title: 'Invest · 5' })),
    ...Array.from({ length: cardCount(2) }, () => ({ type: 'invest', amount: 10, title: 'Invest · 10' })),
    ...Array.from({ length: cardCount(2) }, () => ({ type: 'loan', amount: 10, title: 'Loan · 10' })),
    ...Array.from({ length: cardCount(2) }, () => ({ type: 'loan', amount: 20, title: 'Loan · 20' })),
  ].map((card, index) => ({ ...card, id: `auction-${index}` }));
}

export function createGame(playerIds, random = Math.random) {
  if (playerIds.length < MIN_PLAYERS || playerIds.length > MAX_PLAYERS) {
    throw new Error(`Megagem supports ${MIN_PLAYERS} to ${MAX_PLAYERS} players.`);
  }

  const playerCount = playerIds.length;
  const startingCoins = STARTING_COINS[playerCount] ?? Math.max(5, Math.round((100 / playerCount) / 5) * 5);
  const informationGems = STARTING_HANDS[playerCount] ?? Math.max(2, Math.round(15 / playerCount));
  const gemsPerColor = Math.ceil(6 * playerCount / 5);
  const gemDeck = shuffle(COLORS.flatMap((color) => Array(gemsPerColor).fill(color)), random);
  const hands = {};
  const players = {};
  playerIds.forEach((id) => {
    hands[id] = gemDeck.splice(0, informationGems);
    players[id] = {
      coins: startingCoins,
      collection: [],
      missions: [],
      loans: 0,
      investments: [],
    };
  });

  const market = gemDeck.splice(0, 2);
  const auctions = shuffle(createAuctionDeck(playerCount), random);
  const missionCount = Math.max(2, Math.round(4 * playerCount / 5));
  const missions = shuffle(createMissions(), random).slice(0, missionCount);

  return {
    game: {
      phase: 'bidding',
      round: 1,
      players: playerIds,
      playerData: players,
      missions,
      publicGems: [],
      gemDeck,
      market,
      currentAuction: auctions[0],
      auctionDeck: auctions.slice(1),
      lastWinnerId: null,
      lastResult: null,
      history: [],
      scores: null,
    },
    hands,
  };
}

export function canBid(game, playerId, bid) {
  const player = game.playerData[playerId];
  if (!player || !Number.isInteger(bid) || bid < 0) return false;
  const loanCredit = game.currentAuction?.type === 'loan' ? game.currentAuction.amount : 0;
  return bid <= player.coins + loanCredit;
}

export function resolveBids(game, bids) {
  if (game.phase !== 'bidding') throw new Error('This auction is not accepting bids.');
  const submitted = game.players.map((playerId) => ({ playerId, amount: bids[playerId]?.amount }));
  if (submitted.some((bid) => !Number.isInteger(bid.amount) || !canBid(game, bid.playerId, bid.amount))) {
    throw new Error('Every player must submit a valid bid before bids are revealed.');
  }

  const highBid = Math.max(...submitted.map((bid) => bid.amount));
  const tiedPlayers = new Set(submitted.filter((bid) => bid.amount === highBid).map((bid) => bid.playerId));
  const previousWinner = game.players.indexOf(game.lastWinnerId);
  const tieStart = previousWinner < 0 ? 0 : (previousWinner + 1) % game.players.length;
  const tieOrder = [...game.players.slice(tieStart), ...game.players.slice(0, tieStart)];
  const winnerId = tieOrder.find((id) => tiedPlayers.has(id));

  return {
    ...game,
    phase: 'reveal',
    lastResult: {
      auction: game.currentAuction,
      bids: Object.fromEntries(submitted.map((bid) => [bid.playerId, bid.amount])),
      winnerId,
      bid: highBid,
      revealedColor: null,
    },
  };
}

function satisfiesMission(mission, collection) {
  const counts = Object.fromEntries(COLORS.map((color) => [color, 0]));
  collection.forEach((color) => { counts[color] += 1; });
  const requirement = mission.requirement;
  if (requirement.type === 'set') {
    const needed = Object.fromEntries(COLORS.map((color) => [color, 0]));
    requirement.colors.forEach((color) => { needed[color] += 1; });
    return COLORS.every((color) => counts[color] >= needed[color]);
  }
  if (requirement.type === 'pair') return collection.length >= 2;
  if (requirement.type === 'two-pairs') return COLORS.reduce((pairs, color) => pairs + Math.floor(counts[color] / 2), 0) >= 2;
  if (requirement.type === 'three-kind') return COLORS.some((color) => counts[color] >= 3);
  if (requirement.type === 'three-different') return COLORS.filter((color) => counts[color] > 0).length >= 3;
  if (requirement.type === 'four-different') return COLORS.filter((color) => counts[color] > 0).length >= 4;
  return false;
}

export function scoreGame(game) {
  const revealedCounts = Object.fromEntries(COLORS.map((color) => [color, 0]));
  game.publicGems.forEach((color) => { revealedCounts[color] += 1; });

  return Object.fromEntries(game.players.map((id) => {
    const player = game.playerData[id];
    const gemPoints = player.collection.reduce((total, color) => {
      const count = Math.min(revealedCounts[color], CHART_A.length - 1);
      return total + CHART_A[count];
    }, 0);
    const missionPoints = player.missions.reduce((total, mission) => total + mission.points, 0);
    const investmentPoints = player.investments.reduce((total, investment) => total + investment.amount + investment.bid, 0);
    const total = player.coins + gemPoints + missionPoints + investmentPoints - player.loans;
    return [id, { total, coins: player.coins, gemPoints, missionPoints, investmentPoints, loans: player.loans }];
  }));
}

export function resolveAuction(game, hands, revealedColor) {
  if (game.phase !== 'reveal' || !game.lastResult) throw new Error('Reveal bids before resolving the auction.');
  const { winnerId, bid, auction } = game.lastResult;
  const nextPlayers = structuredClone(game.playerData);
  const nextHands = Object.fromEntries(game.players.map((id) => [id, [...(hands[id] || [])]]));
  const winner = nextPlayers[winnerId];
  const hand = nextHands[winnerId];
  if (hand.length && !hand.includes(revealedColor)) throw new Error('Choose an information gem from your hand.');

  let revealed = null;
  if (revealedColor) {
    const cardIndex = hand.indexOf(revealedColor);
    hand.splice(cardIndex, 1);
    revealed = revealedColor;
  }

  const market = [...game.market];
  let gemDeck = [...game.gemDeck];
  let reward = auction.title;

  if (auction.type === 'gems') {
    const acquired = market.splice(0, Math.min(auction.amount, market.length));
    winner.collection.push(...acquired);
    const replenished = gemDeck.splice(0, acquired.length);
    market.push(...replenished);
    reward = acquired.length ? acquired.join(' + ') : 'No gems left in the market';
    nextPlayers[winnerId].coins -= bid;
  } else if (auction.type === 'invest') {
    winner.coins -= bid;
    winner.investments.push({ amount: auction.amount, bid });
  } else {
    winner.coins += auction.amount - bid;
    winner.loans += auction.amount;
  }

  const completedMissions = [];
  let missions = [...game.missions];
  if (auction.type === 'gems') {
    const remainingMissions = [];
    missions.forEach((mission) => {
      if (satisfiesMission(mission, winner.collection)) {
        completedMissions.push(mission);
      } else {
        remainingMissions.push(mission);
      }
    });
    winner.missions.push(...completedMissions);
    missions = remainingMissions;
  }

  const publicGems = revealed ? [...game.publicGems, revealed] : [...game.publicGems];
  const gameOver = market.length === 0 && gemDeck.length === 0;
  const lastResult = {
    ...game.lastResult,
    revealedColor: revealed,
    reward,
    completedMissions: completedMissions.map((mission) => mission.title),
  };
  const history = [...(game.history || []), {
    round: game.round,
    winnerId,
    bid,
    auction: auction.title,
    reward,
    revealed,
    completedMissions: completedMissions.map((mission) => mission.title),
  }];

  if (gameOver) {
    game.players.forEach((id) => {
      publicGems.push(...nextHands[id]);
      nextHands[id] = [];
    });
    const finalGame = {
      ...game,
      phase: 'complete',
      playerData: nextPlayers,
      publicGems,
      market,
      gemDeck,
      lastWinnerId: winnerId,
      lastResult,
      history,
      scores: null,
      missions,
    };
    finalGame.scores = scoreGame(finalGame);
    return { game: finalGame, hands: nextHands };
  }

  const [currentAuction, ...auctionDeck] = game.auctionDeck;
  if (!currentAuction) throw new Error('Auction deck ran out before the market was cleared.');
  return {
    game: {
      ...game,
      phase: 'bidding',
      round: game.round + 1,
      playerData: nextPlayers,
      missions,
      publicGems,
      market,
      gemDeck,
      currentAuction,
      auctionDeck,
      lastWinnerId: winnerId,
      lastResult,
      history,
      scores: null,
    },
    hands: nextHands,
  };
}