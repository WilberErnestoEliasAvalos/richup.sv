import React from 'react';
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

export default function Board({ room, myId, onSpaceClick }) {
  const players = room?.players || [];

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
            onClick={() => onSpaceClick && onSpaceClick(space)}
          >
            {groupColor && <div className="space-color-bar" style={{ background: groupColor }} />}
            <div className="space-body">
              <SpaceIcon space={space} />
              <div className="space-name">{space.code}</div>
              {space.price && <div className="space-price">${space.price}</div>}
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
    </div>
  );
}
