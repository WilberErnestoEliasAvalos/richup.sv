import React, { useEffect, useState, useRef } from 'react';
import { socket } from './socket';
import Board from './Board.jsx';
import { board } from './boardData';

const PLAYER_COLORS = ['#B5322E', '#2B4C7E', '#2E7D46', '#E0B93C', '#8B5A2B', '#2F9C95'];

export default function App() {
  const [screen, setScreen] = useState('home'); // home | lobby | game
  const [name, setName] = useState('');
  const [roomIdInput, setRoomIdInput] = useState('');
  const [room, setRoom] = useState(null);
  const [error, setError] = useState('');
  const [chat, setChat] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [auctionBid, setAuctionBid] = useState('');
  const [tab, setTab] = useState('turno'); // turno | jugadores | propiedades | comercio | chat
  const chatEndRef = useRef(null);

  // ---- Trade form state ----
  const [tradeTarget, setTradeTarget] = useState('');
  const [offerCash, setOfferCash]     = useState(0);
  const [offerPropIds, setOfferPropIds] = useState([]);
  const [offerJail, setOfferJail]     = useState(0);
  const [reqCash, setReqCash]         = useState(0);
  const [reqPropIds, setReqPropIds]   = useState([]);
  const [reqJail, setReqJail]         = useState(0);
  const [tradeErr, setTradeErr]       = useState('');

  useEffect(() => {
    function onRoomState(r) {
      setRoom(r);
      setScreen(r.started ? 'game' : 'lobby');
    }
    function onChat(msg) {
      setChat(prev => [...prev, msg]);
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

        <Board room={room} myId={socket.id} />

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

        <nav className="tab-bar">
          <button className={`tab-btn ${tab === 'turno' ? 'active' : ''}`} onClick={() => setTab('turno')}>📜<span>Historial</span></button>
          <button className={`tab-btn ${tab === 'jugadores' ? 'active' : ''}`} onClick={() => setTab('jugadores')}>👥<span>Jugadores</span></button>
          <button className={`tab-btn ${tab === 'propiedades' ? 'active' : ''}`} onClick={() => setTab('propiedades')}>🏠<span>Props</span></button>
          <button className={`tab-btn ${tab === 'comercio' ? 'active' : ''}`} onClick={() => setTab('comercio')}>🤝<span>Comercio</span></button>
          <button className={`tab-btn ${tab === 'chat' ? 'active' : ''}`} onClick={() => setTab('chat')}>💬<span>Chat</span></button>
        </nav>

        <div className="tab-panel">
          {tab === 'turno' && (
            <ul className="log-list">
              {room.log.slice(0, 20).map((entry, i) => (
                <li key={i}>{entry.message}</li>
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

          {tab === 'propiedades' && (
            <ul className="prop-list">
              {myProps.length === 0 && <li className="prop-empty">Todavía no tenés propiedades.</li>}
              {myProps.map(([spaceId, o]) => {
                const sp = board.find(s => s.id === Number(spaceId));
                return (
                  <li key={spaceId} className={`prop-list-item ${o.mortgaged ? 'prop-mortgaged' : ''}`}>
                    <span className="prop-label">
                      {sp.name}
                      {o.mortgaged && <span className="mortgage-tag">Hipotecada</span>}
                      {sp.type === 'property' && o.houses > 0 && <span className="house-count">🏠×{o.houses}</span>}
                    </span>
                    <span className="prop-actions">
                      {sp.type === 'property' && !o.mortgaged && (
                        <button
                          className="btn-mini"
                          disabled={!isMyTurn || o.houses >= 5}
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
          )}

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
            const myTrades = (room.trades || []).filter(t => t.fromId === socket.id || t.toId === socket.id);
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
                {myTrades.length === 0 && (
                  <p className="prop-empty">No hay tratos pendientes.</p>
                )}
                {myTrades.map(t => {
                  const isReceiver = t.toId === socket.id;
                  const otherName = room.players.find(p => p.id === (isReceiver ? t.fromId : t.toId))?.name ?? '?';
                  const offerPropNames  = t.offer.propertyIds.map(id => board.find(s => s.id === id)?.name ?? `#${id}`).join(', ');
                  const reqPropNames    = t.request.propertyIds.map(id => board.find(s => s.id === id)?.name ?? `#${id}`).join(', ');
                  const offerDesc  = [t.offer.cash   > 0 ? `$${t.offer.cash}` : null,   offerPropNames || null, t.offer.jailCards   > 0 ? `${t.offer.jailCards}🃏` : null].filter(Boolean).join(' + ') || '—';
                  const reqDesc    = [t.request.cash > 0 ? `$${t.request.cash}` : null, reqPropNames   || null, t.request.jailCards > 0 ? `${t.request.jailCards}🃏` : null].filter(Boolean).join(' + ') || '—';
                  return (
                    <div key={t.id} className="trade-card">
                      <div className="trade-card-header">
                        <span className="trade-with">{isReceiver ? `De ${otherName}` : `Para ${otherName}`}</span>
                        <span className="trade-id">#{t.id}</span>
                      </div>
                      <div className="trade-sides">
                        <div className="trade-side">
                          <span className="trade-side-label">Ofrecen</span>
                          <span className="trade-side-value">{isReceiver ? offerDesc : reqDesc}</span>
                        </div>
                        <div className="trade-arrow">⇄</div>
                        <div className="trade-side">
                          <span className="trade-side-label">Piden</span>
                          <span className="trade-side-value">{isReceiver ? reqDesc : offerDesc}</span>
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
                        ) : (
                          <button className="btn btn-secondary"
                            onClick={() => socket.emit('cancelTrade', { tradeId: t.id })}>
                            Cancelar trato
                          </button>
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
