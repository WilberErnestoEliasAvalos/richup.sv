import React, { useEffect, useState, useRef } from 'react';
import { socket } from './socket';
import Board from './Board.jsx';
import { board, GROUPS } from './boardData';

const PLAYER_COLORS = ['#B5322E', '#2B4C7E', '#2E7D46', '#E0B93C', '#8B5A2B', '#2F9C95'];

export default function App() {
  const [screen, setScreen] = useState('home'); // home | lobby | game
  const [name, setName] = useState('');
  const [roomIdInput, setRoomIdInput] = useState('');
  const [room, setRoom] = useState(null);
  const [error, setError] = useState('');
  const [chat, setChat] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [tab, setTab] = useState('turno'); // turno | jugadores | propiedades | historial | chat
  const [selectedSpace, setSelectedSpace] = useState(null); // casilla tocada, para la tarjeta de detalle
  const chatEndRef = useRef(null);

  useEffect(() => {
    function onRoomState(r) {
      setRoom(r);
      setScreen(r.started ? 'game' : 'lobby');
    }
    function onChat(msg) {
      setChat(prev => [...prev, msg]);
    }
    socket.on('roomState', onRoomState);
    socket.on('chatMessage', onChat);
    return () => {
      socket.off('roomState', onRoomState);
      socket.off('chatMessage', onChat);
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat, tab]);

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

    return (
      <div className="app-shell game-shell">
        <header className="top-bar">
          <span className="top-bar-room">Sala {room.roomId}</span>
          {me && <span className="top-bar-cash">${me.cash}</span>}
        </header>

        <Board room={room} myId={socket.id} onSpaceClick={setSelectedSpace} />

        {selectedSpace && (
          <SpaceDetailSheet
            space={selectedSpace}
            room={room}
            onClose={() => setSelectedSpace(null)}
          />
        )}

        <div className="action-bar">
          <div className="action-bar-turn">
            <span
              className="token-mini"
              style={{ background: PLAYER_COLORS[current?.colorIndex % PLAYER_COLORS.length] }}
            />
            <span className="action-bar-name">{isMyTurn ? 'Tu turno' : `Turno de ${current?.name}`}</span>
            {room.lastDice && (
              <span className="dice-mini">🎲 {room.lastDice[0]}+{room.lastDice[1]}</span>
            )}
          </div>

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
        </div>

        <nav className="tab-bar">
          <button className={`tab-btn ${tab === 'turno' ? 'active' : ''}`} onClick={() => setTab('turno')}>📜<span>Historial</span></button>
          <button className={`tab-btn ${tab === 'jugadores' ? 'active' : ''}`} onClick={() => setTab('jugadores')}>👥<span>Jugadores</span></button>
          <button className={`tab-btn ${tab === 'propiedades' ? 'active' : ''}`} onClick={() => setTab('propiedades')}>🏠<span>Propiedades</span></button>
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
                  <li key={spaceId} className="prop-list-item">
                    <span>{sp.name}</span>
                    {sp.type === 'property' && (
                      <button
                        className="btn-mini"
                        disabled={!isMyTurn || o.houses >= 5}
                        onClick={() => socket.emit('buildHouse', { spaceId: sp.id })}
                      >
                        🏠 ${sp.houseCost}
                      </button>
                    )}
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
        </div>
      </div>
    );
  }

  return <div className="screen">Cargando…</div>;
}

function SpaceDetailSheet({ space, room, onClose }) {
  const own = room?.ownership?.[space.id];
  const ownerPlayer = own ? room.players.find(p => p.id === own.ownerId) : null;
  const group = space.group ? GROUPS[space.group] : null;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet-card" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        {group && <div className="sheet-color-bar" style={{ background: group.color }} />}
        <div className="sheet-body">
          <h3 className="sheet-title">{space.name}</h3>
          {group && <p className="sheet-group">{group.name}</p>}

          {space.price && (
            <p className="sheet-row"><span>Precio</span><span>${space.price}</span></p>
          )}
          {space.houseCost && (
            <p className="sheet-row"><span>Costo por casa</span><span>${space.houseCost}</span></p>
          )}
          {space.amount && (
            <p className="sheet-row"><span>Monto</span><span>${space.amount}</span></p>
          )}
          {ownerPlayer && (
            <p className="sheet-row"><span>Dueño</span><span>{ownerPlayer.name}</span></p>
          )}
          {own?.houses > 0 && (
            <p className="sheet-row"><span>Construcción</span><span>{own.houses === 5 ? '🏨 Hotel' : '🏠'.repeat(own.houses)}</span></p>
          )}
          {!space.price && !space.amount && !group && (
            <p className="sheet-note">Esta casilla no se compra ni se paga.</p>
          )}
        </div>
        <button className="btn btn-secondary btn-big sheet-close" onClick={onClose}>Cerrar</button>
      </div>
    </div>
  );
}
