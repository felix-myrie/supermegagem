import test from 'node:test';
import assert from 'node:assert/strict';
import { assignCurrencyNames, canBid, createGame, isOrphanedRoomJoin, resolveAuction, resolveBids, scoreGame } from './game.js';

test('assigns distinct currency names consistently regardless of player order', () => {
  const names = assignCurrencyNames(['c', 'a', 'b']);
  assert.deepEqual(names, { a: 'Sterling', b: 'Dollar', c: 'Yuan' });
  assert.deepEqual(assignCurrencyNames(['b', 'c', 'a']), names);
});

test('sets starting coins, information hands, and gem market by player count', () => {
  const three = createGame(['a', 'b', 'c'], () => 0.5);
  assert.deepEqual(three.game.players.map((id) => three.game.playerData[id].coins), [35, 35, 35]);
  assert.deepEqual(Object.values(three.hands).map((hand) => hand.length), [5, 5, 5]);
  assert.equal(three.game.market.length + three.game.gemDeck.length, 5);

  const four = createGame(['a', 'b', 'c', 'd'], () => 0.5);
  assert.deepEqual(four.game.players.map((id) => four.game.playerData[id].coins), [25, 25, 25, 25]);
  assert.deepEqual(Object.values(four.hands).map((hand) => hand.length), [4, 4, 4, 4]);
});

test('validates player count and allows loan bids against borrowed coins', () => {
  assert.throws(() => createGame(['a', 'b']), /3 to 5 players/);
  const { game } = createGame(['a', 'b', 'c'], () => 0.5);
  game.currentAuction = { type: 'loan', amount: 10, title: 'Loan · 10' };
  game.playerData.a.coins = 2;
  assert.equal(canBid(game, 'a', 12), true);
  assert.equal(canBid(game, 'a', 13), false);
});

test('rejects code-based joins that create a new host-only room', () => {
  assert.equal(isOrphanedRoomJoin('WRONG1', true), true);
  assert.equal(isOrphanedRoomJoin('  ', true), false);
  assert.equal(isOrphanedRoomJoin('ROOM1', false), false);
});

test('scales gem, mission, and auction-card counts across supported player counts', () => {
  for (let playerCount = 3; playerCount <= 5; playerCount += 1) {
    const ids = Array.from({ length: playerCount }, (_, index) => `p${index}`);
    const { game, hands } = createGame(ids, () => 0.5);
    const auctions = [game.currentAuction, ...game.auctionDeck];
    const count = (type, amount) => auctions.filter((card) => card.type === type && card.amount === amount).length;
    const cards = (baseCount) => Math.max(1, Math.round(baseCount * playerCount / 5));
    const gemsPerColor = Math.ceil(6 * playerCount / 5);

    assert.equal(game.players.length, playerCount);
    assert.equal(game.market.length + game.gemDeck.length + Object.values(hands).flat().length, gemsPerColor * 5);
    assert.equal(game.missions.length, Math.max(2, Math.round(4 * playerCount / 5)));
    assert.equal(count('gems', 1), cards(12));
    assert.equal(count('gems', 2), cards(5));
    assert.equal(count('invest', 5), cards(2));
    assert.equal(count('invest', 10), cards(2));
    assert.equal(count('loan', 10), cards(2));
    assert.equal(count('loan', 20), cards(2));
  }
  assert.throws(() => createGame(['a', 'b', 'c', 'd', 'e', 'f']), /3 to 5 players/);
});

test('breaks ties clockwise after the last auction winner', () => {
  const { game } = createGame(['a', 'b', 'c'], () => 0.5);
  game.lastWinnerId = 'b';
  const next = resolveBids(game, {
    a: { playerId: 'a', amount: 7 },
    b: { playerId: 'b', amount: 7 },
    c: { playerId: 'c', amount: 7 },
  });
  assert.equal(next.lastResult.winnerId, 'c');
});

test('settles investment and loan auctions using their different cash rules', () => {
  const investment = createGame(['a', 'b', 'c'], () => 0.5).game;
  investment.currentAuction = { type: 'invest', amount: 5, title: 'Invest · 5' };
  investment.phase = 'reveal';
  investment.lastResult = { winnerId: 'a', bid: 4, auction: investment.currentAuction };
  const invested = resolveAuction(investment, { a: ['Yellow'] }, 'Yellow').game;
  assert.equal(invested.playerData.a.coins, 31);
  assert.deepEqual(invested.playerData.a.investments, [{ amount: 5, bid: 4 }]);

  const loan = createGame(['a', 'b', 'c'], () => 0.5).game;
  loan.currentAuction = { type: 'loan', amount: 10, title: 'Loan · 10' };
  loan.phase = 'reveal';
  loan.lastResult = { winnerId: 'a', bid: 38, auction: loan.currentAuction };
  const borrowed = resolveAuction(loan, { a: ['Blue'] }, 'Blue').game;
  assert.equal(borrowed.playerData.a.coins, 7);
  assert.equal(borrowed.playerData.a.loans, 10);
});

test('scores gems from public information plus missions, investments, and loans', () => {
  const { game } = createGame(['a', 'b', 'c'], () => 0.5);
  game.publicGems = ['Green', 'Green', 'Green'];
  game.playerData.a.collection = ['Green', 'Green'];
  game.playerData.a.coins = 2;
  game.playerData.a.loans = 10;
  game.playerData.a.investments = [{ amount: 5, bid: 3 }];
  game.playerData.a.missions = [{ points: 15 }];
  const score = scoreGame(game).a;
  assert.equal(score.gemPoints, 24);
  assert.equal(score.total, 39);
});

test('claims any two pairs and ends after the final market gem', () => {
  const { game } = createGame(['a', 'b', 'c'], () => 0.5);
  game.phase = 'reveal';
  game.currentAuction = { type: 'gems', amount: 1, title: '1 gem' };
  game.market = ['Yellow'];
  game.gemDeck = [];
  game.playerData.a.collection = ['Yellow', 'Yellow', 'Yellow'];
  game.missions = [{
    id: 'two-pairs',
    title: 'Any two pairs',
    requirement: { type: 'two-pairs' },
    points: 15,
  }];
  game.lastResult = { winnerId: 'a', bid: 0, auction: game.currentAuction };

  const result = resolveAuction(game, { a: ['Blue'], b: ['Pink'], c: ['Green'] }, 'Blue');
  assert.equal(result.game.phase, 'complete');
  assert.deepEqual(result.game.playerData.a.collection, ['Yellow', 'Yellow', 'Yellow', 'Yellow']);
  assert.deepEqual(result.game.playerData.a.missions.map((mission) => mission.id), ['two-pairs']);
  assert.deepEqual(result.game.publicGems.sort(), ['Blue', 'Green', 'Pink']);
  assert.deepEqual(result.hands, { a: [], b: [], c: [] });
});