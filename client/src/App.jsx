import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { socket } from './socket';
import Board from './Board.jsx';
import { board, GROUPS } from './boardData';

const PLAYER_COLORS = ['#B5322E', '#2B4C7E', '#2E7D46', '#E0B93C', '#8B5A2B', '#2F9C95'];

// Order of color groups for sorting properties in Props tab
const GROUP_ORDER = ['marron', 'celeste', 'rosa', 'naranja', 'roja', 'amarilla', 'verde', 'azulOscuro', 'railroad', 'utility'];

// ---- Board quadrant logic ----
// Q0=SE (0-9: Salida..Chalchuapa), Q1=SO (10-19: CECOT..Merliot), Q2=NO (20-29: Parqueo..Sunzal), Q3=NE (30-39: Capturado..El Encanto)
const QUAD_TRANSFORM = [
  'translate(-50%, -50%)', // Q0 SE — bottom-right
  'translate(0%,   -50%)', // Q1 SO — bottom-left
  'translate(0%,    0%)',  // Q2 NO — top-left
  'translate(-50%,  0%)',  // Q3 NE — top-right
];
const QUAD_NEIGHBORS = [
  { left: 1,    right: null, up: 3,    down: null }, // Q0 SE
  { left: null, right: 0,   up: 2,    down: null }, // Q1 SO
  { left: null, right: 3,   up: null, down: 1    }, // Q2 NO
  { left: 2,    right: null, up: null, down: 0    }, // Q3 NE
];

// ---- Exact 11x11 Grid Quadrant Mapping ----
// Q0=SE (36..39 & 0..5: Salida/Apopa/Terminal Occidente..), Q1=SO (6..15: Soyapango..Terminal Oriente), Q2=NO (16..25: Zaragoza..Terminal Sur), Q3=NE (26..35: Costa del Sol..Aeropuerto)
function quadrantOf(position) {
  const p = (Number(position) || 0) % 40;
  if (p >= 6  && p <= 15) return 1; // SO (Bottom-Left: 6..15)
  if (p >= 16 && p <= 25) return 2; // NO (Top-Left: 16..25)
  if (p >= 26 && p <= 35) return 3; // NE (Top-Right: 26..35)
  return 0;                         // SE (Bottom-Right: 36..39 & 0..5)
}

function BoardQuadrantView({ room, myId, myPosition }) {
  const [quadrant, setQuadrant] = useState(() => quadrantOf(myPosition ?? 0));
  const [isFullBoard, setIsFullBoard] = useState(false);
  const touchStartRef = useRef(null);

  // Auto-follow: ALWAYS jump to the quadrant of my token whenever position updates or dice are rolled
  useEffect(() => {
    if (typeof myPosition === 'number') {
      const q = quadrantOf(myPosition);
      setQuadrant(q);
    }
  }, [myPosition, room?.lastDice, room?.currentPlayerIndex]);

  const nb = QUAD_NEIGHBORS[quadrant];

  // Swipe gesture support
  function onTouchStart(e) {
    if (isFullBoard) return;
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY, time: Date.now() };
  }
  function onTouchEnd(e) {
    if (isFullBoard || !touchStartRef.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartRef.current.x;
    const dy = t.clientY - touchStartRef.current.y;
    const dt = Date.now() - touchStartRef.current.time;
    touchStartRef.current = null;

    if (dt > 800) return;
    if (Math.abs(dx) < 30 && Math.abs(dy) < 30) return;

    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx < -30 && nb.right !== null) setQuadrant(nb.right);
      if (dx > 30 && nb.left !== null) setQuadrant(nb.left);
    } else {
      if (dy < -30 && nb.down !== null) setQuadrant(nb.down);
      if (dy > 30 && nb.up !== null) setQuadrant(nb.up);
    }
  }

  return (
    <div className="board-viewport" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div
        className="board-scaler"
        style={{
          transform: isFullBoard ? 'none' : QUAD_TRANSFORM[quadrant],
          width: isFullBoard ? '100%' : '200%',
          height: isFullBoard ? '100%' : '200%',
        }}
      >
        <Board room={room} myId={myId} />
      </div>

      {/* Toggle Full Board / Zoom Out button */}
      <button
        className={`quad-zoom-btn ${!isFullBoard ? `quad-zoom-btn-q${quadrant}` : ''}`}
        onClick={() => setIsFullBoard(prev => !prev)}
        title={isFullBoard ? "Vista ampliada por cuadrante" : "Ver tablero completo"}
      >
        {isFullBoard ? "🔎 Zoom Cuadrante" : "🗺️ Ver Todo"}
      </button>

      {/* Navigation arrows (only in quadrant zoom view) */}
      {!isFullBoard && (
        <>
          {nb.up    !== null && <button className="quad-arrow quad-arrow-up"    onClick={() => setQuadrant(nb.up)}>▲</button>}
          {nb.down  !== null && <button className="quad-arrow quad-arrow-down"  onClick={() => setQuadrant(nb.down)}>▼</button>}
          {nb.left  !== null && <button className="quad-arrow quad-arrow-left"  onClick={() => setQuadrant(nb.left)}>◀</button>}
          {nb.right !== null && <button className="quad-arrow quad-arrow-right" onClick={() => setQuadrant(nb.right)}>▶</button>}
        </>
      )}
    </div>
  );
}

function CardModal({ card, onDismiss }) {
  if (!card) return null;
  const isChance = card.deckType === 'chance';
  return createPortal(
    <div className="sheet-backdrop" onClick={onDismiss}>
      <div className={`card-modal-body ${isChance ? 'card-modal-chance' : 'card-modal-chest'}`} onClick={e => e.stopPropagation()}>
        <div className="card-modal-header">
          <span className="card-modal-icon">{isChance ? '🍀' : '🎁'}</span>
          <h3>{isChance ? 'TARJETA DE SUERTE' : 'CAJA COMUNAL'}</h3>
        </div>
        <div className="card-modal-content">
          <p className="card-modal-text">"{card.text}"</p>
          <p className="card-modal-player">Obtenida por: <strong>{card.playerName}</strong></p>
        </div>
        <button className="btn btn-primary card-modal-btn" onClick={onDismiss}>
          Aceptar
        </button>
      </div>
    </div>,
    document.body
  );
}

// ---- Log formatting helper ----
function getLogCategory(msg) {
  if (msg.includes('quebró')) return { category: 'bankrupt', icon: '💥' };
  if (msg.includes('ganó la partida')) return { category: 'win', icon: '🏆' };
  if (msg.includes('pagó') && msg.includes('renta')) return { category: 'rent', icon: '💳' };
  if (msg.includes('pagó') && msg.includes('impuestos')) return { category: 'tax', icon: '🏛️' };
  if (msg.includes('compró')) return { category: 'buy', icon: '🏷️' };
  if (msg.includes('construyó')) return { category: 'build', icon: '🏠' };
  if (msg.includes('vendió una casa')) return { category: 'sell', icon: '🔻' };
  if (msg.includes('hipotecó')) return { category: 'mortgage', icon: '📑' };
  if (msg.includes('levantó la hipoteca')) return { category: 'unmortgage', icon: '🟢' };
  if (msg.includes('Parqueo Gratis')) return { category: 'parking', icon: '🅿️' };
  if (msg.includes('cárcel') || msg.includes('CECOT')) return { category: 'jail', icon: '🔒' };
  if (msg.includes('carta')) return { category: 'card', icon: '🎁' };
  if (msg.includes('subasta') || msg.includes('pujó')) return { category: 'auction', icon: '🔨' };
  if (msg.includes('trato')) return { category: 'trade', icon: '🤝' };
  if (msg.includes('tiró') || msg.includes('pasó por Salida')) return { category: 'roll', icon: '🎲' };
  if (msg.includes('unió') || msg.includes('comenzó')) return { category: 'info', icon: '🚀' };
  return { category: 'info', icon: '📜' };
}

function LogEntryItem({ entry, players }) {
  const { category, icon } = getLogCategory(entry.message);
  const text = entry.message;

  function renderFormattedText(msgText) {
    const parts = msgText.split(/(\$[0-9]+)/g);
    return parts.map((part, index) => {
      if (part.startsWith('$')) {
        return <span key={index} className="log-cash-pill">{part}</span>;
      }
      
      let elements = [part];
      if (players && players.length > 0) {
        players.forEach(p => {
          if (!p.name) return;
          const nextElements = [];
          elements.forEach((el, elIdx) => {
            if (typeof el !== 'string') {
              nextElements.push(el);
              return;
            }
            const nameParts = el.split(p.name);
            nameParts.forEach((nP, nIdx) => {
              if (nIdx > 0) {
                const color = PLAYER_COLORS[p.colorIndex % PLAYER_COLORS.length];
                nextElements.push(
                  <span key={`p-${p.id}-${elIdx}-${nIdx}`} className="log-player-badge" style={{ backgroundColor: color }}>
                    {p.name}
                  </span>
                );
              }
              if (nP) nextElements.push(nP);
            });
          });
          elements = nextElements;
        });
      }
      return <React.Fragment key={index}>{elements}</React.Fragment>;
    });
  }

  const timeStr = entry.ts ? new Date(entry.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <li className={`log-card log-card-${category}`}>
      <span className="log-icon">{icon}</span>
      <div className="log-body">
        <span className="log-text">{renderFormattedText(text)}</span>
        {timeStr && <span className="log-time">{timeStr}</span>}
      </div>
    </li>
  );
}

export default function App() {
  const [screen, setScreen] = useState('home'); // home | lobby | game
  const [name, setName] = useState('');
  const [roomIdInput, setRoomIdInput] = useState('');
  const [room, setRoom] = useState(null);
  const [error, setError] = useState('');
  const [chat, setChat] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [unreadChat, setUnreadChat] = useState(0);
  const [auctionBid, setAuctionBid] = useState('');
  const [tab, setTab] = useState('turno'); // turno | jugadores | propiedades | comercio | chat
  const chatEndRef = useRef(null);

  // ---- Card modal & trade state ----
  const [dismissedCardId, setDismissedCardId] = useState(null);
  const [tradeTarget, setTradeTarget] = useState('');
  const [offerCash, setOfferCash]     = useState(0);
  const [offerPropIds, setOfferPropIds] = useState([]);
  const [offerJail, setOfferJail]     = useState(0);
  const [reqCash, setReqCash]         = useState(0);
  const [reqPropIds, setReqPropIds]   = useState([]);
  const [reqJail, setReqJail]         = useState(0);
  const [tradeErr, setTradeErr]       = useState('');

  const currentTabRef = useRef(tab);
  useEffect(() => {
    currentTabRef.current = tab;
  }, [tab]);

  useEffect(() => {
    function onRoomState(r) {
      setRoom(r);
      setScreen(r.started ? 'game' : 'lobby');
    }
    function onChat(msg) {
      setChat(prev => [...prev, msg]);
      if (currentTabRef.current !== 'chat') {
        setUnreadChat(prev => prev + 1);
      }
    }
    function onTradeError({ message }) {
      setTradeErr(message);
      setTimeout(() => setTradeErr(''), 4000);
    }
    socket.on('roomState', onRoomState);
    socket.on('chatMessage', onChat);
    socket.on('tradeError', onTradeError);
    return () => {
      socket.off('roomState', onRoomState);
      socket.off('chatMessage', onChat);
      socket.off('tradeError', onTradeError);
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat, tab]);

  useEffect(() => {
    if (room?.turnPhase === 'auction' && room.auction) {
      const turnPlayerId = room.auction.order[room.auction.turnIndex];
      if (turnPlayerId === socket.id) {
        const minimumBid = room.auction.highestBid > 0 ? room.auction.highestBid + 10 : 10;
        setAuctionBid(String(minimumBid));
      }
      return;
    }
    setAuctionBid('');
  }, [room?.turnPhase, room?.auction?.spaceId, room?.auction?.turnIndex, room?.auction?.highestBid]);

  function createRoom() {
    if (!name.trim()) return setError('Poné tu nombre primero.');
    socket.emit('createRoom', { playerName: name.trim() }, (res) => {
      if (!res.ok) return setError(res.error || 'Error al crear sala.');
      setRoom(res.room);
      setScreen('lobby');
      setError('');
    });
  }

  function joinRoom() {
    if (!name.trim()) return setError('Poné tu nombre primero.');
    if (!roomIdInput.trim()) return setError('Poné el código de la sala.');
    socket.emit('joinRoom', { roomId: roomIdInput.trim().toUpperCase(), playerName: name.trim() }, (res) => {
      if (!res.ok) return setError(res.error || 'Error al unirse.');
      setRoom(res.room);
      setScreen('lobby');
      setError('');
    });
  }

  function startGame() {
    socket.emit('startGame');
  }

  function sendChat() {
    if (!chatInput.trim()) return;
    socket.emit('sendChat', { text: chatInput.trim() });
    setChatInput('');
  }

  // ---------- HOME ----------
  if (screen === 'home') {
    return (
      <div className="app-shell">
        <div className="screen home-screen">
          <div className="home-card">
            <div className="brand">
              <span className="brand-eyebrow">mycipher.app</span>
              <h1 className="brand-title">Cipher Monopoly SV</h1>
              <p className="brand-sub">Comprá departamentos, cobrá renta y llevate El Salvador entero. Hecho para jugarse con el pulgar.</p>
            </div>
            <input
              className="input"
              placeholder="Tu nombre"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={16}
            />
            <button className="btn btn-primary" onClick={createRoom}>Crear sala nueva</button>
            <div className="divider">o unirte a una sala</div>
            <div className="join-row">
              <input
                className="input"
                placeholder="Código (ej. AB3XZ)"
                value={roomIdInput}
                onChange={(e) => setRoomIdInput(e.target.value)}
                maxLength={6}
              />
              <button className="btn btn-secondary" onClick={joinRoom}>Unirme</button>
            </div>
            {error && <div className="error-msg">{error}</div>}
          </div>
        </div>
      </div>
    );
  }

  // ---------- LOBBY ----------
  if (screen === 'lobby' && room) {
    const isHost = room.players[0]?.id === socket.id;
    return (
      <div className="app-shell">
        <div className="screen lobby-screen">
          <div className="lobby-card">
            <span className="brand-eyebrow">Sala</span>
            <h2 className="room-code">{room.roomId}</h2>
            <p className="brand-sub">Compartí este código con tus amigos para que se unan desde su celular.</p>
            <ul className="player-list">
              {room.players.map((p, i) => (
                <li key={p.id} className="player-list-item">
                  <span className="token-mini" style={{ background: PLAYER_COLORS[p.colorIndex % PLAYER_COLORS.length] }} />
                  {p.name} {i === 0 && <span className="host-tag">Host</span>}
                </li>
              ))}
            </ul>
            {isHost ? (
              <button className="btn btn-primary" disabled={room.players.length < 2} onClick={startGame}>
                {room.players.length < 2 ? 'Esperando más jugadores…' : 'Comenzar partida'}
              </button>
            ) : (
              <p className="waiting-msg">Esperando a que el host inicie la partida…</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---------- GAME ----------
  if (screen === 'game' && room) {
    const me = room.players.find(p => p.id === socket.id);
    const current = room.players[room.currentPlayerIndex];
    const isMyTurn = current?.id === socket.id;
    const currentSpace = board[current?.position ?? 0];
    const own = room.ownership[currentSpace.id];
    const canBuy = isMyTurn && room.turnPhase === 'action' && currentSpace.price && !own;
    const myProps = Object.entries(room.ownership).filter(([, o]) => o.ownerId === me?.id);
    const auction = room.turnPhase === 'auction' ? room.auction : null;
    const auctionSpace = auction ? board[auction.spaceId] : null;
    const auctionTurnPlayer = auction ? room.players.find(p => p.id === auction.order[auction.turnIndex]) : null;
    const auctionTurnColorIndex = auctionTurnPlayer?.colorIndex ?? current?.colorIndex ?? 0;
    const isAuctionMyTurn = auctionTurnPlayer?.id === socket.id;
    const auctionMinBid = auction ? (auction.highestBid > 0 ? auction.highestBid + 10 : 10) : 10;

    function submitAuctionBid() {
      const parsedBid = Number(auctionBid);
      if (!Number.isFinite(parsedBid)) return;
      socket.emit('placeBid', { amount: parsedBid });
    }

    function raiseAuctionBid() {
      setAuctionBid(String(auctionMinBid));
    }

    return (
      <div className="app-shell game-shell">
        <header className="top-bar">
          <span className="top-bar-room">Sala {room.roomId}</span>
          {me && <span className="top-bar-cash">${me.cash}</span>}
        </header>

        <BoardQuadrantView room={room} myId={socket.id} myPosition={me?.position ?? 0} />

        <div className="action-bar">
          <div className="action-bar-turn">
            <span
              className="token-mini"
              style={{ background: PLAYER_COLORS[auctionTurnColorIndex % PLAYER_COLORS.length] }}
            />
            {auction ? (
              <>
                <span className="action-bar-name">{isAuctionMyTurn ? 'Tu turno en subasta' : `Subasta de ${auctionSpace?.name || 'casilla'}`}</span>
                <span className="dice-mini">{auction.highestBid > 0 ? `Puja: $${auction.highestBid}` : 'Sin pujas'}</span>
              </>
            ) : (
              <>
                <span className="action-bar-name">{isMyTurn ? 'Tu turno' : `Turno de ${current?.name}`}</span>
                {room.lastDice && (
                  <span className="dice-mini">🎲 {room.lastDice[0]}+{room.lastDice[1]}</span>
                )}
              </>
            )}
          </div>

          {auction ? (
            isAuctionMyTurn ? (
              <>
                <div className="auction-summary">
                  <span>{auctionSpace?.name}</span>
                  <span>{auction.highestBid > 0 ? `Mínimo $${auctionMinBid}` : 'Arranca en $10'}</span>
                </div>
                <div className="auction-input-row">
                  <input
                    className="input auction-input"
                    type="number"
                    min={auctionMinBid}
                    step="10"
                    value={auctionBid}
                    onChange={(e) => setAuctionBid(e.target.value)}
                    inputMode="numeric"
                  />
                  <button className="btn-mini auction-plus-btn" onClick={raiseAuctionBid}>+$10</button>
                </div>
                <div className="action-buy-row">
                  <button className="btn btn-primary btn-half" onClick={submitAuctionBid}>Pujar</button>
                  <button className="btn btn-secondary btn-half" onClick={() => socket.emit('passAuction')}>Pasar</button>
                </div>
              </>
            ) : (
              <p className="waiting-msg-inline">
                Pujando a {auctionTurnPlayer?.name || 'otro jugador'}… {auction.highestBid > 0 ? `Puja actual $${auction.highestBid}` : 'Sin pujas'}
              </p>
            )
          ) : (
            <>
              {isMyTurn && room.turnPhase === 'roll' && (
                <button className="btn btn-primary btn-big" onClick={() => socket.emit('rollDice')}>Tirar dados</button>
              )}
              {isMyTurn && room.turnPhase === 'action' && canBuy && (
                <div className="action-buy-row">
                  <span className="action-buy-text">{currentSpace.name} · ${currentSpace.price}</span>
                  <button className="btn btn-primary btn-half" onClick={() => socket.emit('buyProperty')}>Comprar</button>
                  <button className="btn btn-secondary btn-half" onClick={() => socket.emit('skipBuy')}>Pasar</button>
                </div>
              )}
              {isMyTurn && room.turnPhase === 'end' && (
                <button className="btn btn-primary btn-big" onClick={() => socket.emit('endTurn')}>Terminar turno</button>
              )}
              {!isMyTurn && <p className="waiting-msg-inline">Esperando a {current?.name}…</p>}
            </>
          )}
        </div>

        <CardModal
          card={room?.lastDrawnCard && room.lastDrawnCard.id !== dismissedCardId ? room.lastDrawnCard : null}
          onDismiss={() => setDismissedCardId(room?.lastDrawnCard?.id)}
        />

        <nav className="tab-bar">
          <button className={`tab-btn ${tab === 'turno' ? 'active' : ''}`} onClick={() => setTab('turno')}>📜<span>Historial</span></button>
          <button className={`tab-btn ${tab === 'jugadores' ? 'active' : ''}`} onClick={() => setTab('jugadores')}>👥<span>Jugadores</span></button>
          <button className={`tab-btn ${tab === 'propiedades' ? 'active' : ''}`} onClick={() => setTab('propiedades')}>🏠<span>Props</span></button>
          <button className={`tab-btn ${tab === 'comercio' ? 'active' : ''}`} onClick={() => setTab('comercio')}>
            🤝<span>Comercio{(room?.trades?.length ?? 0) > 0 && <span className="trade-pulse-dot" />}</span>
          </button>
          <button className={`tab-btn ${tab === 'chat' ? 'active' : ''}`} onClick={() => { setTab('chat'); setUnreadChat(0); }}>
            💬<span>Chat{unreadChat > 0 && <span className="unread-badge">{unreadChat}</span>}</span>
          </button>
        </nav>

        <div className="tab-panel">
          {tab === 'turno' && (
            <ul className="log-list">
              {room.log.slice(0, 30).map((entry, i) => (
                <LogEntryItem key={i} entry={entry} players={room.players} />
              ))}
            </ul>
          )}

          {tab === 'jugadores' && (
            <ul className="player-list">
              {room.players.map(p => (
                <li key={p.id} className={`player-list-item ${p.id === current?.id ? 'is-current' : ''} ${p.bankrupt ? 'is-bankrupt' : ''}`}>
                  <span className="token-mini" style={{ background: PLAYER_COLORS[p.colorIndex % PLAYER_COLORS.length] }} />
                  <span className="player-name">{p.name}</span>
                  <span className="player-cash">${p.cash}</span>
                  {p.inJail && <span className="jail-tag">🔒</span>}
                </li>
              ))}
            </ul>
          )}

          {tab === 'propiedades' && (() => {
            const sortedMyProps = Object.entries(room.ownership)
              .filter(([, o]) => o.ownerId === me?.id)
              .map(([id, o]) => ({ spaceId: Number(id), own: o, space: board.find(s => s.id === Number(id)) }))
              .filter(item => Boolean(item.space))
              .sort((a, b) => {
                const groupA = a.space.group || a.space.type;
                const groupB = b.space.group || b.space.type;
                const indexA = GROUP_ORDER.indexOf(groupA);
                const indexB = GROUP_ORDER.indexOf(groupB);
                if (indexA !== indexB) return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
                return a.space.id - b.space.id;
              });

            return (
              <ul className="prop-list">
                {sortedMyProps.length === 0 && <li className="prop-empty">Todavía no tenés propiedades.</li>}
                {sortedMyProps.map(({ spaceId, own: o, space: sp }) => {
                  const groupColor = sp.group ? GROUPS[sp.group]?.color : (sp.type === 'railroad' ? '#4A5563' : '#1E4E8C');
                  const groupSpaces = sp.group ? board.filter(s => s.group === sp.group) : [];
                  const totalInGroup = groupSpaces.length;
                  const ownedInGroup = groupSpaces.filter(s => room.ownership[s.id]?.ownerId === me?.id).length;
                  const ownsAllGroup = sp.type === 'property' && totalInGroup > 0 && ownedInGroup === totalInGroup;

                  return (
                    <li
                      key={spaceId}
                      className={`prop-list-item ${o.mortgaged ? 'prop-mortgaged' : ''}`}
                      style={{ borderLeft: `6px solid ${groupColor}`, paddingLeft: '10px' }}
                    >
                      <span className="prop-label">
                        <span className="prop-name-text">{sp.name}</span>
                        {o.mortgaged && <span className="mortgage-tag">Hipotecada</span>}
                        {sp.type === 'property' && o.houses > 0 && <span className="house-count">🏠×{o.houses}</span>}
                        {sp.type === 'property' && !ownsAllGroup && (
                          <span className="group-progress" title={`Debes poseer las ${totalInGroup} propiedades de este grupo`}>
                            ({ownedInGroup}/{totalInGroup})
                          </span>
                        )}
                      </span>
                      <span className="prop-actions">
                        {sp.type === 'property' && !o.mortgaged && (
                          <button
                            className="btn-mini"
                            disabled={!isMyTurn || o.houses >= 5 || !ownsAllGroup || (me?.cash ?? 0) < sp.houseCost}
                            title={!ownsAllGroup ? `Debes poseer el grupo completo (${ownedInGroup}/${totalInGroup}) para construir` : ''}
                            onClick={() => socket.emit('buildHouse', { spaceId: sp.id })}
                          >
                            🏠 ${sp.houseCost}
                          </button>
                        )}
                        {sp.type === 'property' && o.houses > 0 && (
                          <button
                            className="btn-mini"
                            disabled={!isMyTurn}
                            onClick={() => socket.emit('sellHouse', { spaceId: sp.id })}
                          >
                            🔻 ${Math.floor(sp.houseCost / 2)}
                          </button>
                        )}
                        {o.mortgaged ? (
                          <button
                            className="btn-mini"
                            disabled={!isMyTurn}
                            onClick={() => socket.emit('unmortgageProperty', { spaceId: sp.id })}
                          >
                            Levantar (${Math.ceil(sp.price / 2 * 1.10)})
                          </button>
                        ) : (
                          sp.price && o.houses === 0 && (
                            <button
                              className="btn-mini"
                              disabled={!isMyTurn}
                              onClick={() => socket.emit('mortgageProperty', { spaceId: sp.id })}
                            >
                              Hipotecar
                            </button>
                          )
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            );
          })()}

          {tab === 'chat' && (
            <div className="chat-block">
              <div className="chat-messages">
                {chat.map((m, i) => (
                  <div key={i} className="chat-msg"><b>{m.name}:</b> {m.text}</div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <div className="chat-input-row">
                <input
                  className="input"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendChat()}
                  placeholder="Escribí algo…"
                />
                <button className="btn-mini" onClick={sendChat}>Enviar</button>
              </div>
            </div>
          )}

          {tab === 'comercio' && (() => {
            const allTrades = room.trades || [];
            const otherPlayers = room.players.filter(p => p.id !== socket.id && !p.bankrupt);
            const targetPlayer = otherPlayers.find(p => p.id === tradeTarget) || otherPlayers[0];
            const effectiveTarget = targetPlayer?.id || '';

            // My props with houses===0 (tradeable)
            const myTradeableProps = Object.entries(room.ownership)
              .filter(([, o]) => o.ownerId === socket.id && o.houses === 0)
              .map(([id]) => board.find(s => s.id === Number(id)))
              .filter(Boolean);

            // Target's props with houses===0 (tradeable)
            const targetTradeableProps = effectiveTarget
              ? Object.entries(room.ownership)
                  .filter(([, o]) => o.ownerId === effectiveTarget && o.houses === 0)
                  .map(([id]) => board.find(s => s.id === Number(id)))
                  .filter(Boolean)
              : [];

            const myJailCards = me?.getOutOfJailCards ?? 0;
            const targetJailCards = targetPlayer?.getOutOfJailCards ?? 0;

            function togglePropId(list, setList, id) {
              setList(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
            }

            function submitTrade() {
              if (!effectiveTarget) return;
              socket.emit('proposeTrade', {
                toPlayerId: effectiveTarget,
                offer:   { cash: Number(offerCash) || 0, propertyIds: offerPropIds, jailCards: Number(offerJail) || 0 },
                request: { cash: Number(reqCash)   || 0, propertyIds: reqPropIds,   jailCards: Number(reqJail)   || 0 },
              });
              // Reset form
              setOfferCash(0); setOfferPropIds([]); setOfferJail(0);
              setReqCash(0);   setReqPropIds([]);   setReqJail(0);
            }

            return (
              <div className="trade-panel">

                {/* --- Pending trades --- */}
                <div className="trade-section-title">Tratos pendientes</div>
                {allTrades.length === 0 && (
                  <p className="prop-empty">No hay tratos pendientes.</p>
                )}
                {allTrades.map(t => {
                  const isReceiver = t.toId === socket.id;
                  const isProposer = t.fromId === socket.id;
                  const fromName = room.players.find(p => p.id === t.fromId)?.name ?? '?';
                  const toName   = room.players.find(p => p.id === t.toId)?.name ?? '?';

                  const offerPropNames = t.offer.propertyIds.map(id => board.find(s => s.id === id)?.name ?? `#${id}`).join(', ');
                  const reqPropNames   = t.request.propertyIds.map(id => board.find(s => s.id === id)?.name ?? `#${id}`).join(', ');
                  const offerDesc = [t.offer.cash   > 0 ? `$${t.offer.cash}` : null,   offerPropNames || null, t.offer.jailCards   > 0 ? `${t.offer.jailCards}🃏` : null].filter(Boolean).join(' + ') || '—';
                  const reqDesc   = [t.request.cash > 0 ? `$${t.request.cash}` : null, reqPropNames   || null, t.request.jailCards > 0 ? `${t.request.jailCards}🃏` : null].filter(Boolean).join(' + ') || '—';

                  return (
                    <div key={t.id} className="trade-card">
                      <div className="trade-card-header">
                        <span className="trade-with">{fromName} ➔ {toName}</span>
                        <span className="trade-id">#{t.id}</span>
                      </div>
                      <div className="trade-sides">
                        <div className="trade-side">
                          <span className="trade-side-label">{fromName} ofrece</span>
                          <span className="trade-side-value">{offerDesc}</span>
                        </div>
                        <div className="trade-arrow">⇄</div>
                        <div className="trade-side">
                          <span className="trade-side-label">{toName} pide</span>
                          <span className="trade-side-value">{reqDesc}</span>
                        </div>
                      </div>
                      <div className="trade-card-actions">
                        {isReceiver ? (
                          <>
                            <button className="btn btn-primary btn-half"
                              onClick={() => socket.emit('respondTrade', { tradeId: t.id, accept: true })}>
                              Aceptar
                            </button>
                            <button className="btn btn-secondary btn-half"
                              onClick={() => socket.emit('respondTrade', { tradeId: t.id, accept: false })}>
                              Rechazar
                            </button>
                          </>
                        ) : isProposer ? (
                          <button className="btn btn-secondary"
                            onClick={() => socket.emit('cancelTrade', { tradeId: t.id })}>
                            Cancelar trato
                          </button>
                        ) : (
                          <span className="trade-spectator-badge">Pendiente entre {fromName} y {toName}</span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* --- Propose trade --- */}
                <div className="trade-section-title" style={{ marginTop: 18 }}>Proponer trato</div>
                {otherPlayers.length === 0 ? (
                  <p className="prop-empty">No hay otros jugadores activos.</p>
                ) : (
                  <>
                    <label className="trade-label">Con quién</label>
                    <select
                      className="input trade-select"
                      value={tradeTarget || effectiveTarget}
                      onChange={e => { setTradeTarget(e.target.value); setReqPropIds([]); }}
                    >
                      {otherPlayers.map(p => (
                        <option key={p.id} value={p.id}>{p.name} (${p.cash})</option>
                      ))}
                    </select>

                    <div className="trade-cols">
                      {/* LEFT: what I offer */}
                      <div className="trade-col">
                        <div className="trade-col-header">Yo ofrezco</div>
                        <label className="trade-label">Efectivo</label>
                        <input type="number" className="input trade-num" min={0} value={offerCash}
                          onChange={e => setOfferCash(Math.max(0, Number(e.target.value)))} />
                        {myTradeableProps.length > 0 && (
                          <>
                            <label className="trade-label">Propiedades</label>
                            {myTradeableProps.map(sp => (
                              <label key={sp.id} className="trade-check-row">
                                <input type="checkbox"
                                  checked={offerPropIds.includes(sp.id)}
                                  onChange={() => togglePropId(offerPropIds, setOfferPropIds, sp.id)} />
                                {sp.name}
                              </label>
                            ))}
                          </>
                        )}
                        {myJailCards > 0 && (
                          <>
                            <label className="trade-label">Cartas cárcel (tenés {myJailCards})</label>
                            <input type="number" className="input trade-num" min={0} max={myJailCards} value={offerJail}
                              onChange={e => setOfferJail(Math.min(myJailCards, Math.max(0, Number(e.target.value))))} />
                          </>
                        )}
                      </div>

                      {/* RIGHT: what I request */}
                      <div className="trade-col">
                        <div className="trade-col-header">Yo pido</div>
                        <label className="trade-label">Efectivo</label>
                        <input type="number" className="input trade-num" min={0} value={reqCash}
                          onChange={e => setReqCash(Math.max(0, Number(e.target.value)))} />
                        {targetTradeableProps.length > 0 && (
                          <>
                            <label className="trade-label">Propiedades</label>
                            {targetTradeableProps.map(sp => (
                              <label key={sp.id} className="trade-check-row">
                                <input type="checkbox"
                                  checked={reqPropIds.includes(sp.id)}
                                  onChange={() => togglePropId(reqPropIds, setReqPropIds, sp.id)} />
                                {sp.name}
                              </label>
                            ))}
                          </>
                        )}
                        {targetJailCards > 0 && (
                          <>
                            <label className="trade-label">Cartas cárcel ({targetPlayer?.name} tiene {targetJailCards})</label>
                            <input type="number" className="input trade-num" min={0} max={targetJailCards} value={reqJail}
                              onChange={e => setReqJail(Math.min(targetJailCards, Math.max(0, Number(e.target.value))))} />
                          </>
                        )}
                      </div>
                    </div>

                    {tradeErr && <div className="trade-error">{tradeErr}</div>}
                    <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={submitTrade}>
                      Proponer trato
                    </button>
                  </>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    );
  }

  return <div className="screen">Cargando…</div>;
}
