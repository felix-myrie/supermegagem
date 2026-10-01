import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  getRoomCode,
  insertCoin,
  isHost as playroomIsHost,
  myPlayer,
  useIsHost,
  useMultiplayerState,
  usePlayerState,
  usePlayersList,
  usePlayersState,
} from 'playroomkit';
import {
  ArrowDownRight,
  ArrowRight,
  Check,
  Copy,
  Crown,
  Gem,
  Info,
  Minus,
  Plus,
  RotateCcw,
  Sparkles,
  Trophy,
  Users,
  Wifi,
} from 'lucide-react';
import {
  CHART_A,
  COLORS,
  assignCurrencyNames,
  canBid,
  createGame,
  isOrphanedRoomJoin,
  MAX_PLAYERS,
  MIN_PLAYERS,
  resolveAuction,
  resolveBids,
} from './game.js';

const gameId = import.meta.env.VITE_PLAYROOM_GAME_ID || '';
export default function App() {
  const [connection, setConnection] = useState(null);
  const inviteCode = new URLSearchParams(window.location.hash.slice(1)).get('r') || '';
  const [roomCode, setRoomCode] = useState(inviteCode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inviteAttempted = useRef(false);

  useEffect(() => {
    if (inviteCode && gameId && !inviteAttempted.current) {
      inviteAttempted.current = true;
      void connect(inviteCode);
    }
  }, []);

  async function connect(code = '') {
    if (!gameId) {
      setError('Add your Playroom game ID to .env.local to connect a room.');
      return;
    }
    setBusy(true);
    setError('');
    const joinCode = code.trim().toUpperCase();
    try {
      await insertCoin({
        gameId,
        roomCode: joinCode || undefined,
        skipLobby: true,
        maxPlayersPerRoom: MAX_PLAYERS + 1,
      });
      if (isOrphanedRoomJoin(joinCode, playroomIsHost())) {
        myPlayer().leaveRoom();
        throw new Error('No active host found for that code. Check the code or ask the host to reopen the table.');
      }
      setConnection({ code: getRoomCode() || joinCode });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not join room.');
      setBusy(false);
    }
  }

  if (connection) {
    return <PlayroomTable roomCode={connection.code} onExit={() => { myPlayer().leaveRoom(); setConnection(null); }} />;
  }

  return (
    <Landing
      busy={busy}
      error={error}
      onConnect={connect}
      roomCode={roomCode}
      setRoomCode={setRoomCode}
    />
  );
}

function Landing({ busy, error, onConnect, roomCode, setRoomCode }) {
  return (
    <main className="landing">
      <div className="landing-grain" />
      <header className="landing-brand"><Gem size={23} strokeWidth={2.4} /> <span>Made by Felix for SuMS economics society</span></header>
      <section className="landing-main">
        <p className="eyebrow">THE INFORMATION IS THE EDGE</p>
        <h1>Mega<span>gem</span></h1>
        <p className="landing-deck">Trade cash for color. Read the room. Make every reveal count.</p>
        <div className="landing-actions">
          <button className="button button-lime" disabled={busy} onClick={() => onConnect()}>
            <Wifi size={17} /> {busy ? 'Opening table…' : 'Host a table'} <ArrowRight size={17} />
          </button>
          <form className="join-form" onSubmit={(event) => { event.preventDefault(); onConnect(roomCode); }}>
            <input
              aria-label="Enter room code"
              autoCapitalize="characters"
              onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
              placeholder="ROOM CODE"
              value={roomCode}
            />
            <button className="button button-outline" disabled={busy || !roomCode.trim()}>
              Join <ArrowRight size={15} />
            </button>
          </form>
          <button className="sample-link" onClick={() => window.dispatchEvent(new Event('megagem:sample'))}>
            Explore a sample table <ArrowDownRight size={15} />
          </button>
        </div>
        {error && <p className="connection-error" role="alert">{error}</p>}
      </section>
      <div className="landing-specimen" aria-hidden="true">
        {['Yellow', 'Blue', 'Purple', 'Pink', 'Green'].map((color, index) => (
          <div className={`specimen specimen-${color.toLowerCase()}`} key={color} style={{ '--i': index }}>
            <Gem size={42} strokeWidth={1.25} />
          </div>
        ))}
        <div className="specimen-caption">FIVE COLORS · ONE SHARED MARKET</div>
      </div>
      <footer className="landing-footer"><span>3—5 PLAYERS</span><span>AUCTION · INFORMATION · VALUE</span><span>CHART A</span></footer>
      <SampleLauncher />
    </main>
  );
}

function SampleLauncher() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const open = () => setShow(true);
    window.addEventListener('megagem:sample', open);
    return () => window.removeEventListener('megagem:sample', open);
  }, []);
  return show ? createPortal(<DemoTable onExit={() => setShow(false)} />, document.body) : null;
}

function PlayroomTable({ roomCode, onExit }) {
  const isHost = useIsHost();
  const players = usePlayersList(true);
  const me = myPlayer();
  const [game, setGame] = useMultiplayerState('megagem:state', null);
  const [hand, setHand] = usePlayerState(me, 'megagem:hand', []);
  const [sealedBid, setSealedBid] = usePlayerState(me, 'megagem:bid', null);
  const allHands = usePlayersState('megagem:hand');
  const allBids = usePlayersState('megagem:bid');
  const handMap = Object.fromEntries(allHands.map(({ player, state }) => [player.id, state || []]));
  const bidMap = Object.fromEntries(allBids.map(({ player, state }) => [player.id, state]));
  const nameIds = game?.players || players.filter((player) => !isHost || player.id !== me.id).map((player) => player.id);
  const currencyNames = assignCurrencyNames(nameIds);
  const connectedRoster = players.map((player) => ({
    id: player.id,
    name: currencyNames[player.id] || 'Disconnected',
    color: player.getProfile()?.color?.hexString,
  }));
  const roster = game
    ? game.players.map((id) => connectedRoster.find((player) => player.id === id) || { id, name: 'Disconnected', color: '#aab3a7' })
    : connectedRoster.filter((player) => !isHost || player.id !== me.id);
  const activePlayers = game
    ? players.filter((player) => game.players.includes(player.id))
    : players.filter((player) => !isHost || player.id !== me.id);
  const roundBid = sealedBid?.round === game?.round ? sealedBid : null;
  const readyCount = activePlayers.filter((player) => bidMap[player.id]?.round === game?.round && bidMap[player.id]?.ready).length;

  function startGame() {
    if (!isHost || activePlayers.length < MIN_PLAYERS || activePlayers.length > MAX_PLAYERS || game) return;
    const participantIds = activePlayers.map((player) => player.id);
    const created = createGame(participantIds);
    activePlayers.forEach((player) => player.setState('megagem:hand', created.hands[player.id], true));
    activePlayers.forEach((player) => player.setState('megagem:bid', null, true));
    setGame(created.game, true);
  }

  function submitBid(amount) {
    if (!game || game.phase !== 'bidding' || !canBid(game, me.id, amount)) return;
    if (roundBid?.ready) return;
    setSealedBid({ round: game.round, amount, ready: true }, true);
  }

  function revealBids() {
    if (!isHost || !game || readyCount !== game.players.length) return;
    const bids = Object.fromEntries(game.players.map((id) => [id, {
      playerId: id,
      amount: bidMap[id]?.round === game.round ? bidMap[id].amount : 0,
    }]));
    setGame(resolveBids(game, bids), true);
  }

  function revealGem(color) {
    if (!game || game.phase !== 'reveal' || game.lastResult.winnerId !== me.id) return;
    const result = resolveAuction(game, handMap, color);
    activePlayers.forEach((player) => {
      player.setState('megagem:hand', result.hands[player.id] || [], true);
      player.setState('megagem:bid', null, true);
    });
    setHand(result.hands[me.id] || [], true);
    setSealedBid(null, true);
    setGame(result.game, true);
  }

  if (game && !game.players.includes(me.id) && !isHost) {
    return <main className="spectator-screen"><Brand /><h1>This game is already underway.</h1><p>Ask the host for a seat in the next round.</p><button className="text-button" onClick={onExit}>Return to Megagem</button></main>;
  }

  if (!game) {
    return (
      <Lobby
        isHost={isHost}
        onExit={onExit}
        onStart={startGame}
        players={roster}
        roomCode={roomCode}
      />
    );
  }

  return (
    <GameBoard
      bids={bidMap}
      game={game}
      hand={hand || []}
      isHost={isHost}
      isDemo={false}
      meId={game.players.includes(me.id) ? me.id : null}
      onExit={onExit}
      onRevealBids={revealBids}
      onRevealGem={revealGem}
      onSubmitBid={submitBid}
      players={roster}
      readyCount={readyCount}
      roomCode={roomCode}
    />
  );
}

function Lobby({ isHost, onExit, onStart, players, roomCode }) {
  const [copied, setCopied] = useState(false);
  const gameUrl = `${window.location.origin}${window.location.pathname}`;
  const inviteLink = `${gameUrl}#r=${roomCode}`;
  async function copyInvite() {
    await navigator.clipboard?.writeText(inviteLink);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <main className="lobby-page">
      <header className="lobby-top"><Brand /><button className="text-button" onClick={onExit}>Leave table</button></header>
      <section className="lobby-content">
        <div className="lobby-copy">
          <p className="eyebrow">TABLE SETUP</p>
          <h1>Bring in<br /><em>the bidders.</em></h1>
          <p>Three to ten players can join. The host runs the table but does not take a seat.</p>
          <div className="room-code-block">
            <span>ROOM CODE</span>
            <strong>{roomCode || '-----'}</strong>
            <button aria-label="Copy invitation link" className="icon-button" onClick={copyInvite} title="Copy invitation link">
              {copied ? <Check size={18} /> : <Copy size={18} />}
            </button>
          </div>
          <div className="lobby-roster">
            <div className="section-kicker"><Users size={15} /> PLAYERS <span>{players.length}/{MAX_PLAYERS}</span></div>
            {players.map((player, index) => (
              <PlayerLine key={player.id} index={index} player={player} />
            ))}
            {players.length < MIN_PLAYERS && <p className="waiting-note">Waiting for {MIN_PLAYERS - players.length} more player{players.length === MIN_PLAYERS - 1 ? '' : 's'}…</p>}
          </div>
          <button className="button button-lime start-game-button" disabled={!isHost || players.length < MIN_PLAYERS || players.length > MAX_PLAYERS} onClick={onStart}>
            {isHost ? 'Start game' : 'Waiting for host'} <ArrowRight size={17} />
          </button>
          {players.length > MAX_PLAYERS && <p className="connection-error">A table can hold at most {MAX_PLAYERS} players plus its host.</p>}
        </div>
        <aside className="invite-card">
          <div className="qr-frame"><QRCodeSVG value={gameUrl} size={186} bgColor="#f3f3e8" fgColor="#14231b" /></div>
          <div><strong>Scan to open Megagem</strong><p>Enter the room code to join this table.</p></div>
          <div className="invite-code"><span>JOIN WITH CODE</span><b>{roomCode || '-----'}</b></div>
        </aside>
      </section>
      <footer className="lobby-footer">THREE DECKS. ONE MARKET. NO INFORMATION IS FREE.</footer>
    </main>
  );
}

function DemoTable({ onExit }) {
  const [snapshot, setSnapshot] = useState(() => {
    const created = createGame(['mira', 'sol', 'theo']);
    return { ...created, bids: {} };
  });
  const players = [
    { id: 'mira', name: 'Sterling', color: '#ed9280' },
    { id: 'sol', name: 'Dollar', color: '#83b9d5' },
    { id: 'theo', name: 'Yuan', color: '#d5ee67' },
  ];
  const game = snapshot.game;

  useEffect(() => {
    if (game.phase !== 'reveal') return;
    const timeout = window.setTimeout(() => {
      const color = snapshot.hands[game.lastResult.winnerId]?.[0] || null;
      const result = resolveAuction(game, snapshot.hands, color);
      setSnapshot((previous) => ({ ...previous, ...result, bids: {} }));
    }, 1800);
    return () => window.clearTimeout(timeout);
  }, [game, snapshot.hands]);

  useEffect(() => {
    if (game.phase !== 'bidding' || players.every((player) => snapshot.bids[player.id]?.round === game.round)) return;
    const bids = {};
    players.forEach((player) => {
      const maximum = game.playerData[player.id].coins + (game.currentAuction.type === 'loan' ? game.currentAuction.amount : 0);
      bids[player.id] = { playerId: player.id, round: game.round, amount: Math.floor(Math.random() * Math.min(8, maximum + 1)), ready: true };
    });
    setSnapshot((previous) => ({ ...previous, bids }));
  }, [game, players, snapshot.bids]);

  function showBids() {
    if (Object.keys(snapshot.bids).length !== players.length) return;
    const bids = resolveBids(game, snapshot.bids);
    setSnapshot((previous) => ({ ...previous, game: bids }));
  }

  function revealGem(color) {
    const result = resolveAuction(game, snapshot.hands, color);
    setSnapshot((previous) => ({ ...previous, ...result, bids: {} }));
  }

  return (
    <GameBoard
      bids={snapshot.bids}
      game={game}
      hand={[]}
      isHost
      isDemo
      meId={null}
      onExit={onExit}
      onRevealBids={showBids}
      onRevealGem={revealGem}
      onSubmitBid={() => {}}
      players={players}
      readyCount={Object.values(snapshot.bids).filter((bid) => bid?.round === game.round).length}
      roomCode="SAMPLE"
    />
  );
}

function GameBoard({ bids, game, hand, isHost, isDemo, meId, onExit, onRevealBids, onRevealGem, onSubmitBid, players, readyCount, roomCode }) {
  const [copied, setCopied] = useState(false);
  const inviteLink = `${window.location.origin}${window.location.pathname}#r=${roomCode}`;
  const isWinner = game.lastResult?.winnerId === meId;
  const currentPlayer = meId ? game.playerData[meId] : null;
  const committedBid = bids[meId]?.round === game.round ? bids[meId].amount : null;
  const maxBid = !currentPlayer ? 0 : game.currentAuction.type === 'loan'
    ? currentPlayer.coins + game.currentAuction.amount
    : currentPlayer.coins;
  const canReveal = isHost && readyCount === game.players.length && game.players.length >= MIN_PLAYERS;

  async function copyInvite() {
    await navigator.clipboard?.writeText(inviteLink);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <main className="game-page">
      <header className="game-header">
        <Brand />
        <div className="header-center">
          <span className="round-status"><span className="live-dot" /> {game.phase === 'complete' ? 'GAME COMPLETE' : `ROUND ${String(game.round).padStart(2, '0')}`}</span>
          {!isHost && meId && <strong className="header-player-name">{nameFor(players, meId)} · YOU</strong>}
        </div>
        <div className="header-actions">
          {!isDemo && <button className="room-pill" onClick={copyInvite} title="Copy room invitation">
            <span>{copied ? 'COPIED' : roomCode}</span>{copied ? <Check size={14} /> : <Copy size={14} />}
          </button>}
          {isDemo && <span className="sample-pill">SAMPLE TABLE</span>}
          <button aria-label="Leave table" className="icon-button header-exit" onClick={onExit} title="Leave table"><RotateCcw size={16} /></button>
        </div>
      </header>
      {isHost && <div className="game-summary">
        <span><span className="summary-label">VALUE CHART</span> A · LINEAR</span>
        <span><span className="summary-label">GEMS IN DECK</span> {game.gemDeck.length}</span>
        <span><span className="summary-label">IN THE MARKET</span> {game.market.length}</span>
        <span><span className="summary-label">PLAYERS</span> {game.players.length}</span>
      </div>}
      {isHost && game.phase === 'complete' ? (
        <FinalScores game={game} players={players} />
      ) : (
        <div className={`table-layout ${isHost ? 'host-layout' : 'player-layout'}`}>
          {isHost && <MarketPanel game={game} players={players} />}
          <AuctionPanel
            bids={bids}
            canReveal={canReveal}
            committedBid={committedBid}
            game={game}
            hand={hand}
            isHost={isHost}
            isWinner={isWinner}
            maxBid={maxBid}
            meId={meId}
            onRevealBids={onRevealBids}
            onRevealGem={onRevealGem}
            onSubmitBid={onSubmitBid}
            players={players}
            readyCount={readyCount}
          />
          {isHost && <PlayerPanel game={game} meId={meId} players={players} />}
        </div>
      )}
      {isHost
        ? <footer className="game-footer"><span><Info size={14} /> Starting gems are information only. Auction gems are the assets.</span><span>MEGAGEM · CHART A</span></footer>
        : <footer className="player-footer">YOUR HAND IS PRIVATE · YOUR BID IS VISIBLE ONLY AFTER REVEAL</footer>}
    </main>
  );
}

function Brand() {
  return <a className="brand" href="/" aria-label="Megagem home"><Gem size={19} strokeWidth={2.2} /><span>MEGA<span>GEM</span></span></a>;
}

function MarketPanel({ game, players }) {
  const counts = Object.fromEntries(COLORS.map((color) => [color, game.publicGems.filter((gem) => gem === color).length]));
  return (
    <section className="panel market-panel">
      <div className="panel-heading"><div><p className="eyebrow">PUBLIC INFORMATION</p><h2>The market</h2></div><span className="heading-count">{game.publicGems.length} REVEALED</span></div>
      <div className="chart-table">
        <div className="chart-head"><span>COLOR</span><span>INFO REVEALED</span></div>
        {COLORS.map((color) => (
          <div className="chart-row" key={color}>
            <span className="color-name"><Gem className={`gem-icon gem-${color.toLowerCase()}`} size={17} /> {color}</span>
            <span className="chart-count">{counts[color]}</span>
          </div>
        ))}
      </div>
      <div className="visible-market">
        <div className="section-kicker">VISIBLE TREASURE <span>{game.market.length} FOR SALE</span></div>
        {game.market.length ? <div className="visible-gems">
          {game.market.map((color, index) => (
            <div className="visible-gem" key={`${color}-${index}`}>
              <span>{index === 0 ? 'OLDEST' : 'NEXT'}</span>
              <Gem className={`gem-icon gem-${color.toLowerCase()}`} size={23} />
              <b>{color}</b>
            </div>
          ))}
        </div> : <p className="empty-note">No gems remain for auction.</p>}
      </div>
      <div className="public-pool">
        <div className="section-kicker">REVEALED GEMS <span>{game.publicGems.length}</span></div>
        {game.publicGems.length ? (
          <div className="gem-piles">
            {COLORS.filter((color) => counts[color] > 0).map((color) => (
              <div className="gem-pile" key={color}>
                <div className="pile-icons">{game.publicGems.filter((gem) => gem === color).map((gem, index) => <Gem className={`gem-icon gem-${gem.toLowerCase()}`} key={`${gem}-${index}`} size={16} />)}</div>
                <span>{color} <b>×{counts[color]}</b></span>
              </div>
            ))}
          </div>
        ) : <p className="empty-note">The first winner will reveal one gem.</p>}
      </div>
      <div className="mission-list">
        <div className="section-kicker">OPEN MISSIONS <span>{game.missions.length}</span></div>
        {game.missions.length ? game.missions.map((mission) => (
          <div className="mission-row" key={mission.id}>
            <span className="mission-glyph"><Sparkles size={15} /></span>
            <span className="mission-name">{mission.title}</span>
            <b>{mission.points}<small> pts</small></b>
          </div>
        )) : <p className="empty-note">All missions have been claimed.</p>}
      </div>
      {game.history?.length > 0 && <div className="auction-log">
        <div className="section-kicker">AUCTION LOG <span>LAST {Math.min(4, game.history.length)}</span></div>
        {game.history.slice(-4).reverse().map((result) => (
          <div className="auction-log-row" key={result.round}>
            <span>R{String(result.round).padStart(2, '0')}</span>
            <b>{nameFor(players, result.winnerId)}</b>
            <span>{result.reward} · {result.bid}c</span>
          </div>
        ))}
      </div>}
    </section>
  );
}

function AuctionPanel({ bids, canReveal, committedBid, game, hand, isHost, isWinner, maxBid, meId, onRevealBids, onRevealGem, onSubmitBid, players, readyCount }) {
  const [amount, setAmount] = useState(0);
  const [selected, setSelected] = useState(null);
  useEffect(() => {
    setAmount(0);
    setSelected(null);
  }, [game.round, game.phase]);

  return (
    <section className="panel auction-panel">
      <div className="panel-heading auction-heading">
        <div><p className="eyebrow">CURRENT AUCTION</p><h2>{game.phase === 'complete' ? 'Final ledger' : `Lot ${String(game.round).padStart(2, '0')}`}</h2></div>
        {game.phase !== 'complete' && <span className={`auction-kind kind-${game.currentAuction.type}`}>{game.currentAuction.type.toUpperCase()}</span>}
      </div>
      {game.phase === 'complete' ? (
        isHost ? <FinalScores game={game} players={players} /> : <div className="player-complete"><Trophy size={24} /><h3>Game complete</h3><p>Ask the host for the final results.</p></div>
      ) : (
        <>
          <div className={`lot-card lot-${game.currentAuction.type}`}>
            <div className="lot-icon">
              {game.currentAuction.type === 'gems' ? <Gem size={34} /> : game.currentAuction.type === 'invest' ? <Trophy size={31} /> : <ArrowDownRight size={31} />}
            </div>
            <div><span className="lot-overline">ON THE BLOCK</span><h3>{game.currentAuction.title}</h3>
              <p>{game.currentAuction.type === 'gems' ? `${Math.min(game.currentAuction.amount, game.market.length)} from the front of the market` : game.currentAuction.type === 'invest' ? 'Your bid is tied up and returned at the end.' : 'Borrowed cash is liquid now, debt is settled at scoring.'}</p>
              {game.currentAuction.type === 'gems' && game.market.length > 0 && <div className="lot-gem-contents" aria-label={`Auctioned gems: ${game.market.slice(0, game.currentAuction.amount).join(', ')}`}>
                {game.market.slice(0, game.currentAuction.amount).map((color, index) => <span key={`${color}-${index}`}><Gem className={`gem-icon gem-${color.toLowerCase()}`} size={17} /> {color}</span>)}
              </div>}
            </div>
            {game.currentAuction.type !== 'gems' && <strong className="lot-amount">{game.currentAuction.amount}<small>c</small></strong>}
          </div>
          {isHost && <div className="auction-progress">
            <span>{readyCount}/{players.length} BIDS SEALED</span>
            <div className="progress-track"><i style={{ width: `${Math.min(100, (readyCount / Math.max(1, players.length)) * 100)}%` }} /></div>
            <span className="sealed-status">{committedBid !== null ? <><Check size={13} /> SEALED</> : 'SIMULTANEOUS'}</span>
          </div>}
          {game.phase === 'bidding' ? (
            isHost ? <div className="host-auction-control">
              <p>{readyCount}/{players.length} players have sealed a bid.</p>
              <button className="button bid-submit" disabled={!canReveal} onClick={onRevealBids}>{canReveal ? 'Reveal all bids' : 'Waiting for bids'}</button>
            </div> : <div className="bid-area">
              <div className="bid-instruction"><span>YOUR BID</span><span>{currentBidHint(game, meId)}</span></div>
              <PrivateHand hand={hand} />
              <div className="bid-entry">
                <button aria-label="Decrease bid" className="step-button" disabled={committedBid !== null || amount <= 0} onClick={() => setAmount((value) => Math.max(0, value - 1))}><Minus size={17} /></button>
                <label className="bid-amount"><input aria-label="Bid amount" disabled={committedBid !== null} max={maxBid} min="0" onChange={(event) => setAmount(Math.min(maxBid, Math.max(0, Number(event.target.value) || 0)))} type="number" value={amount} /><span>COINS</span></label>
                <button aria-label="Increase bid" className="step-button" disabled={committedBid !== null || amount >= maxBid} onClick={() => setAmount((value) => Math.min(maxBid, value + 1))}><Plus size={17} /></button>
              </div>
              <div className="bid-limits"><span>AVAILABLE <b>{game.playerData[meId].coins}</b></span><span>MAX BID <b>{maxBid}</b></span></div>
              <button className={`button bid-submit ${committedBid !== null ? 'is-sealed' : ''}`} disabled={committedBid !== null || amount > maxBid} onClick={() => onSubmitBid(amount)}>
                {committedBid !== null ? <><Check size={17} /> Bid sealed</> : <>Seal bid <ArrowRight size={17} /></>}
              </button>
              <p className="waiting-note bid-waiting">The host reveals bids when everyone is ready.</p>
            </div>
          ) : (
            <RevealStage bids={bids} game={game} hand={hand} isWinner={isWinner} meId={meId} onRevealGem={onRevealGem} players={players} selected={selected} setSelected={setSelected} />
          )}
        </>
      )}
      {isHost && game.lastResult && <div className="last-result"><span>PREVIOUS WINNER</span><b>{nameFor(players, game.lastResult.winnerId)}</b><small>{game.lastResult.reward || game.lastResult.auction.title} · bid {game.lastResult.bid}</small></div>}
    </section>
  );
}

function PrivateHand({ hand }) {
  return (
    <div className="private-hand">
      <div className="section-kicker">YOUR INFORMATION HAND <span>PRIVATE · {hand.length}</span></div>
      <div className="hand-gems">
        {hand.length ? hand.map((color, index) => (
          <div className="hand-chip" key={`${color}-${index}`}>
            <Gem className={`gem-icon gem-${color.toLowerCase()}`} size={18} /><span>{color}</span>
          </div>
        )) : <span className="empty-hand">No information gems remain.</span>}
      </div>
    </div>
  );
}

function currentBidHint(game, meId) {
  if (game.currentAuction.type === 'loan' && game.currentAuction.amount > game.playerData[meId].coins) return 'Loan bids can exceed your cash';
  if (game.currentAuction.type === 'invest') return 'Bid is locked in the investment';
  return 'Paid to the bank if you win';
}

function RevealStage({ bids, game, hand, isWinner, meId, onRevealGem, players, selected, setSelected }) {
  const result = game.lastResult;
  return (
    <div className="reveal-stage">
      <div className="reveal-winner"><span className="winner-mark"><Crown size={17} /></span><div><span>AUCTION WINNER</span><strong>{nameFor(players, result.winnerId)}</strong></div><b>{result.bid}<small>c</small></b></div>
      <div className="revealed-bids">
        {players.map((player) => (
          <div className="revealed-bid" key={player.id}><span>{player.name}</span><b>{bids[player.id]?.amount ?? result.bids?.[player.id] ?? '—'}<small>c</small></b><i>{player.id === result.winnerId ? 'WON' : 'BID'}</i></div>
        ))}
      </div>
      {isWinner ? (
        <div className="choose-reveal">
          <p>Choose one information gem to reveal to the table.</p>
          {hand.length ? <div className="hand-gems reveal-hand">
            {hand.map((color, index) => (
              <button aria-label={`Reveal ${color}`} className={`hand-gem ${selected === `${color}-${index}` ? 'selected' : ''}`} key={`${color}-${index}`} onClick={() => setSelected(`${color}-${index}`)}>
                <Gem className={`gem-icon gem-${color.toLowerCase()}`} size={23} /><span>{color}</span>
              </button>
            ))}
          </div> : <p className="waiting-note">Your information hand is empty. Continue without a reveal.</p>}
          <button className="button reveal-submit" disabled={hand.length > 0 && selected === null} onClick={() => {
            const [color] = selected?.split('-') || [];
            onRevealGem(color || null);
          }}>Reveal gem & continue <ArrowRight size={17} /></button>
        </div>
      ) : <p className="waiting-note reveal-waiting">Waiting for {nameFor(players, result.winnerId)} to reveal an information gem…</p>}
    </div>
  );
}

function PlayerPanel({ game, meId, players }) {
  return (
    <section className="panel players-panel">
      <div className="panel-heading"><div><p className="eyebrow">TABLE LEDGER</p><h2>The players</h2></div><Users className="panel-heading-icon" size={18} /></div>
      <div className="players-list">
        {players.map((player, index) => {
          const data = game.playerData[player.id];
          if (!data) return null;
          const isMe = player.id === meId;
          const isWinner = game.lastResult?.winnerId === player.id;
          return (
            <article className={`player-card ${isMe ? 'player-self' : ''} ${isWinner && game.phase !== 'bidding' ? 'player-winner' : ''}`} key={player.id}>
              <div className="player-card-top">
                <span className="player-avatar" style={{ '--avatar-color': player.color || avatarColor(index) }}>{isWinner ? <Crown size={16} /> : player.name.slice(0, 1).toUpperCase()}</span>
                <div className="player-identity"><strong>{player.name}{isMe && <small>YOU</small>}</strong><span>{isWinner ? 'Last winner' : `Mission ${data.missions.length ? 'claimed' : 'open'}`}</span></div>
                <div className="player-cash"><b>{data.coins}</b><small>COINS</small></div>
              </div>
              <div className="player-assets">
                <div><span>COLLECTION</span><b>{data.collection.length ? data.collection.map((color, itemIndex) => <Gem className={`gem-icon gem-${color.toLowerCase()}`} key={`${color}-${itemIndex}`} size={14} />) : '—'}</b></div>
                <div><span>INVEST / LOAN</span><b>{data.investments.reduce((total, investment) => total + investment.amount, 0)} / {data.loans}</b></div>
              </div>
              {data.missions.length > 0 && <div className="claimed-missions">{data.missions.map((mission) => <span key={mission.id}><Sparkles size={12} /> {mission.title} <b>+{mission.points}</b></span>)}</div>}
              {game.phase === 'complete' && <div className="final-total"><span>FINAL SCORE</span><b>{game.scores[player.id]?.total}</b></div>}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function FinalScores({ game, players }) {
  const ranked = [...players].sort((a, b) => game.scores[b.id].total - game.scores[a.id].total);
  return (
    <div className="final-scores">
      <div className="final-scores-heading"><div><p className="eyebrow">FINAL SCORING</p><h2>Table results</h2></div><div className="final-winner"><Trophy size={22} /><div><span>TABLE WINNER</span><strong>{ranked[0]?.name}</strong></div><b>{game.scores[ranked[0]?.id]?.total}</b></div></div>
      <div className="score-chart">
        <div className="score-chart-title">CHART A · POINTS PER GEM AT FINAL SCORING</div>
        <div className="score-chart-grid"><b>REVEALED</b>{CHART_A.map((value, index) => <b key={index}>{index === 5 ? '5+' : index}</b>)}</div>
        <div className="score-chart-grid"><b>POINTS / GEM</b>{CHART_A.map((value, index) => <span key={index}>{value}</span>)}</div>
      </div>
      <div className="score-table-wrap"><table className="score-table">
        <thead><tr><th>RANK</th><th>PLAYER</th><th>CASH</th><th>GEMS</th><th>MISSIONS</th><th>INVESTMENTS</th><th>LOANS</th><th>TOTAL</th></tr></thead>
        <tbody>{ranked.map((player, index) => {
          const score = game.scores[player.id];
          return <tr key={player.id}><td>{String(index + 1).padStart(2, '0')}</td><td>{player.name}</td><td>{score.coins}</td><td>+{score.gemPoints}</td><td>+{score.missionPoints}</td><td>+{score.investmentPoints}</td><td>−{score.loans}</td><td className="score-total">{score.total}</td></tr>;
        })}</tbody>
      </table></div>
      <p className="final-note">All remaining information gems were revealed before Chart A scoring. Gems in starting hands are information only and do not score.</p>
    </div>
  );
}

function PlayerLine({ index, player }) {
  return <div className="lobby-player"><span className="player-avatar" style={{ '--avatar-color': player.color || avatarColor(index) }}>{player.name.slice(0, 1).toUpperCase()}</span><strong>{player.name}</strong><span className="connected-label"><i /> READY</span></div>;
}

function nameFor(players, id) {
  return players.find((player) => player.id === id)?.name || 'Player';
}

function avatarColor(index) {
  return ['#d5ee67', '#ed9280', '#83b9d5', '#c2a1d4', '#9dc394'][index % 5];
}