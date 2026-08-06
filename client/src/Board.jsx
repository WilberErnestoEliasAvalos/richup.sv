import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { board, GROUPS } from './boardData';

// Mapea índice 0-39 a posición en grid 11x11 (perímetro), como un Monopoly clásico.
function gridPos(index) {
  if (index === 0) return { row: 11, col: 11 };
  if (index >= 1 && index <= 9) return { row: 11, col: 11 - index };
  if (index === 10) return { row: 11, col: 1 };
  if (index >= 11 && index <= 19) return { row: 11 - (index - 10), col: 1 };
  if (index === 20) return { row: 1, col: 1 };
  if (index >= 21 && index <= 29) return { row: 1, col: 1 + (index - 20) };
  if (index === 30) return { row: 1, col: 11 };
  return { row: 1 + (index - 30), col: 11 }; // 31-39
}

const PLAYER_COLORS = ['#B5322E', '#2B4C7E', '#2E7D46', '#E0B93C', '#8B5A2B', '#2F9C95'];

function SpaceIcon({ space }) {
  if (space.type === 'go') return <span className="space-icon">⬅️</span>;
  if (space.type === 'jail') return <span className="space-icon">🔒</span>;
  if (space.type === 'freeparking') return <span className="space-icon">🅿️</span>;
  if (space.type === 'gotojail') return <span className="space-icon">🚓</span>;
  if (space.type === 'chance') return <span className="space-icon">🍀</span>;
  if (space.type === 'chest') return <span className="space-icon">🎁</span>;
  if (space.type === 'railroad') return <span className="space-icon">🚌</span>;
  if (space.type === 'utility') {
    return <span className="space-icon">{space.name.includes('ANDA') ? '💧' : '⚡'}</span>;
  }
  return null;
}

function rentLine(space, i) {
  if (i === 0) return ['Renta base', `$${space.rent[0]}`];
  if (i === 5) return ['Con hotel', `$${space.rent[5]}`];
  return [`Con ${i} casa${i > 1 ? 's' : ''}`, `$${space.rent[i]}`];
}

function DetailSheet({ space, room, onClose }) {
  if (!space) return null;
  const own = room?.ownership?.[space.id];
  const ownerPlayer = own ? room.players.find(p => p.id === own.ownerId) : null;
  const groupInfo = space.group ? GROUPS[space.group] : null;

  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet-card" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" />
        {groupInfo && <div className="sheet-color-bar" style={{ background: groupInfo.color }} />}
        <div className="sheet-body">
          <h3 className="sheet-title">{space.name}</h3>
          {groupInfo && <p className="sheet-group">{groupInfo.name}</p>}

          {space.price && (
            <p className="sheet-row"><span>Precio</span><span>${space.price}</span></p>
          )}

          {space.type === 'property' && space.rent && space.rent.map((_, i) => {
            const [label, value] = rentLine(space, i);
            return <p className="sheet-row" key={i}><span>{label}</span><span>{value}</span></p>;
          })}

          {space.type === 'property' && (
            <p className="sheet-row"><span>Costo por casa</span><span>${space.houseCost}</span></p>
          )}

          {space.type === 'railroad' && (
            <p className="sheet-note">Renta según cuántas terminales/aeropuerto tengas: $25 · $50 · $100 · $200.</p>
          )}
          {space.type === 'utility' && (
            <p className="sheet-note">Renta = dado tirado × 4 (con 1 servicio) o × 10 (con los 2).</p>
          )}
          {space.type === 'tax' && (
            <p className="sheet-note">Pagás ${space.amount} al bote de Parqueo Gratis.</p>
          )}
          {(space.type === 'chance' || space.type === 'chest') && (
            <p className="sheet-note">Sacás una carta al azar de este mazo.</p>
          )}
          {space.type === 'jail' && (
            <p className="sheet-note">Solo de visita, a menos que te manden aquí desde otra casilla.</p>
          )}
          {space.type === 'gotojail' && (
            <p className="sheet-note">Te manda directo a {board.find(s => s.type === 'jail')?.name}, sin cobrar por pasar Salida.</p>
          )}

          {ownerPlayer ? (
            <p className="sheet-row">
              <span>Dueño</span>
              <span>
                <span className="token-mini" style={{ background: PLAYER_COLORS[ownerPlayer.colorIndex % PLAYER_COLORS.length], marginRight: 6 }} />
                {ownerPlayer.name}{own.houses > 0 ? ` · ${own.houses === 5 ? '🏨' : '🏠'.repeat(own.houses)}` : ''}
              </span>
            </p>
          ) : space.price ? (
            <p className="sheet-note">Sin dueño todavía.</p>
          ) : null}
        </div>

        <button className="btn btn-secondary sheet-close" onClick={onClose}>Cerrar</button>
      </div>
    </div>,
    document.body
  );
}

export default function Board({ room, myId, onSpaceClick }) {
  const players = room?.players || [];
  const [selected, setSelected] = useState(null);

  function handleTap(space) {
    setSelected(space);
    onSpaceClick && onSpaceClick(space);
  }

  return (
    <div className="board-grid">
      {board.map((space) => {
        const { row, col } = gridPos(space.id);
        const groupColor = space.group ? GROUPS[space.group].color : null;
        const own = room?.ownership?.[space.id];
        const ownerPlayer = own ? players.find(p => p.id === own.ownerId) : null;
        const playersHere = players.filter(p => p.position === space.id && !p.bankrupt);

        return (
          <div
            key={space.id}
            className={`space space-${space.type}`}
            style={{ gridRow: row, gridColumn: col }}
            onClick={() => handleTap(space)}
          >
            {groupColor && <div className="space-color-bar" style={{ background: groupColor }} />}
            <div className="space-body">
              <SpaceIcon space={space} />
              <div className="space-name">{space.name}</div>
              {space.price ? (
                <div className="space-price">${space.price}</div>
              ) : space.amount ? (
                <div className="space-price">${space.amount}</div>
              ) : null}
              {ownerPlayer && (
                <div
                  className="space-owner-dot"
                  style={{ background: PLAYER_COLORS[ownerPlayer.colorIndex % PLAYER_COLORS.length] }}
                  title={`Propiedad de ${ownerPlayer.name}`}
                />
              )}
              {own && own.houses > 0 && (
                <div className="space-houses">{own.houses === 5 ? '🏨' : '🏠'.repeat(own.houses)}</div>
              )}
            </div>
            <div className="space-tokens">
              {playersHere.map(p => (
                <div
                  key={p.id}
                  className="token"
                  style={{ background: PLAYER_COLORS[p.colorIndex % PLAYER_COLORS.length] }}
                  title={p.name}
                >
                  {p.name.charAt(0).toUpperCase()}
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <div className="board-center" style={{ gridRow: '2 / 11', gridColumn: '2 / 11' }}>
        <div className="board-center-badge">
          <span className="board-center-eyebrow">Cipher</span>
          <span className="board-center-title">Monopoly SV</span>
        </div>
      </div>

      <DetailSheet space={selected} room={room} onClose={() => setSelected(null)} />
    </div>
  );
}
