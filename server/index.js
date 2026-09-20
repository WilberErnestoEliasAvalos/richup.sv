const express = require('express');
const http = require('http');
const cors = require('cors');
const crypto = require('crypto');
const { Server } = require('socket.io');
const {
  board, createRoom, newPlayer, addLog, rollDice, activePlayers,
  currentPlayer, advanceTurn, movePlayer, sendToJail, startAuction,
  currentAuctionPlayerId, resolveAuctionIfDone, handleDrawCard,
  ownerOf, calculateRent, canBuildHouse, canSellHouse, payPlayer,
  checkBankrupt, validateTrade, executeTrade, handlePlayerElimination,
  GO_TO_JAIL_INDEX, JAIL_INDEX,
} = require('./gameLogic');

const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

function cleanName(value, fallback = 'Jugador') {
  const normalized = String(value || '').trim().replace(/\s+/g, ' ');
  const clipped = normalized.slice(0, 16);
  return clipped || fallback;
}

function cleanRoomId(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

function cleanChatText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 140);
}

const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.get('/health', (req, res) => res.json({ ok: true }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: allowedOrigins, credentials: true },
});

const rooms = new Map(); // roomId -> room state

const disconnectTimers = new Map(); // `${roomId}:${playerId}` -> setTimeout handle

const DISCONNECT_GRACE_MS = 60000; // 60 seconds grace period

// Cleanup: delete room if all players are disconnected or bankrupt
function cleanupRoomIfEmpty(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  const connectedSockets = io.sockets.adapter.rooms.get(roomId);
  const hasConnected = connectedSockets && connectedSockets.size > 0;
  if (!hasConnected) {
    rooms.delete(roomId);
  }
}

// Periodic cleanup of abandoned rooms (every 10 minutes)
setInterval(() => {
  for (const [roomId, room] of rooms) {
    const connectedSockets = io.sockets.adapter.rooms.get(roomId);
    if (!connectedSockets || connectedSockets.size === 0) {
      rooms.delete(roomId);
    }
  }
}, 10 * 60 * 1000);

function publicRoom(room) {
  return room; // por simplicidad enviamos todo el estado; ownership/log incluidos
}

function emitRoom(roomId) {
  const room = rooms.get(roomId);
  if (room) io.to(roomId).emit('roomState', publicRoom(room));
}

function genRoomId() {
  let id;
  let attempts = 0;
  do {
    id = crypto.randomBytes(4).toString('hex').slice(0, 6).toUpperCase();
    attempts++;
  } while (rooms.has(id) && attempts < 100);
  return id;
}

io.on('connection', (socket) => {
  socket.on('createRoom', (data = {}, cb) => {
    try {
      const { playerName } = data;
      const roomId = genRoomId();
      const reconnectToken = crypto.randomUUID();
      const room = createRoom(roomId, socket.id, cleanName(playerName));
      room.players[0].reconnectToken = reconnectToken;
      rooms.set(roomId, room);
      socket.join(roomId);
      socket.data.roomId = roomId;
      cb && cb({ ok: true, roomId, room, reconnectToken });
    } catch (err) {
      console.error('createRoom error:', err);
      cb && cb({ ok: false, error: 'Error interno al crear sala.' });
    }
  });

  socket.on('joinRoom', (data = {}, cb) => {
    try {
      const { roomId, playerName } = data;
      const normalizedRoomId = cleanRoomId(roomId);
      const sanitizedName = cleanName(playerName);
      if (!normalizedRoomId) return cb && cb({ ok: false, error: 'Código de sala inválido.' });
      const room = rooms.get(normalizedRoomId);
      if (!room) return cb && cb({ ok: false, error: 'Esa sala no existe.' });
      if (room.started) return cb && cb({ ok: false, error: 'La partida ya empezó.' });
      if (room.players.length >= 6) return cb && cb({ ok: false, error: 'Sala llena (máximo 6).' });
      const reconnectToken = crypto.randomUUID();
      const player = newPlayer(socket.id, sanitizedName, room.players.length);
      player.reconnectToken = reconnectToken;
      room.players.push(player);
      socket.join(normalizedRoomId);
      socket.data.roomId = normalizedRoomId;
      addLog(room, `${sanitizedName} se unió a la sala.`);
      cb && cb({ ok: true, roomId: normalizedRoomId, room, reconnectToken });
      emitRoom(normalizedRoomId);
    } catch (err) {
      console.error('joinRoom error:', err);
      cb && cb({ ok: false, error: 'Error interno al unirse.' });
    }
  });

  socket.on('rejoinRoom', (data = {}, cb) => {
    try {
      const { roomId, reconnectToken } = data;
      const normalizedRoomId = cleanRoomId(roomId);
      if (!normalizedRoomId || !reconnectToken) return cb && cb({ ok: false, error: 'Datos de reconexión inválidos.' });
      const room = rooms.get(normalizedRoomId);
      if (!room) return cb && cb({ ok: false, error: 'La sala ya no existe.' });

      // Find the player by their reconnect token
      const player = room.players.find(p => p.reconnectToken === reconnectToken);
      if (!player) return cb && cb({ ok: false, error: 'Token de reconexión inválido.' });
      if (player.bankrupt) return cb && cb({ ok: false, error: 'Ya fuiste eliminado de la partida.' });

      // Cancel grace period timer if running
      const timerKey = `${normalizedRoomId}:${player.id}`;
      if (disconnectTimers.has(timerKey)) {
        clearTimeout(disconnectTimers.get(timerKey));
        disconnectTimers.delete(timerKey);
      }

      // Swap old socket.id for new one
      const oldId = player.id;
      player.id = socket.id;

      // Update ownership references
      Object.values(room.ownership).forEach(own => {
        if (own.ownerId === oldId) own.ownerId = socket.id;
      });

      // Update trade references
      room.trades.forEach(t => {
        if (t.fromId === oldId) t.fromId = socket.id;
        if (t.toId === oldId) t.toId = socket.id;
      });

      // Update auction references
      if (room.auction) {
        room.auction.order = room.auction.order.map(id => id === oldId ? socket.id : id);
        if (room.auction.highestBidderId === oldId) room.auction.highestBidderId = socket.id;
        if (room.auction.bids[oldId] !== undefined) {
          room.auction.bids[socket.id] = room.auction.bids[oldId];
          delete room.auction.bids[oldId];
        }
      }

      socket.join(normalizedRoomId);
      socket.data.roomId = normalizedRoomId;
      addLog(room, `${player.name} se reconectó.`);
      cb && cb({ ok: true, roomId: normalizedRoomId, room, reconnectToken });
      emitRoom(normalizedRoomId);
    } catch (err) {
      console.error('rejoinRoom error:', err);
      cb && cb({ ok: false, error: 'Error interno al reconectar.' });
    }
  });

  socket.on('startGame', () => {
    try {
      const room = rooms.get(socket.data.roomId);
      if (!room) return;
      if (room.players[0].id !== socket.id) return; // solo el host inicia
      if (room.players.length < 2) return;
      room.started = true;
      addLog(room, 'La partida comenzó. ¡Suerte!');
      emitRoom(room.roomId);
    } catch (err) {
      console.error('startGame error:', err);
    }
  });

  socket.on('rollDice', () => {
    try {
      const room = rooms.get(socket.data.roomId);
      if (!room || !room.started) return;
      const player = currentPlayer(room);
      if (player.id !== socket.id || room.turnPhase !== 'roll') return;

      const [d1, d2] = rollDice();
      room.lastDice = [d1, d2];
      const isDouble = d1 === d2;

      if (player.inJail) {
        if (isDouble) {
          player.inJail = false;
          addLog(room, `${player.name} sacó dobles y salió de la cárcel.`);
        } else {
          player.jailTurns += 1;
          if (player.jailTurns >= 3) {
            player.inJail = false;
            player.cash -= 50;
            addLog(room, `${player.name} pagó $50 y salió de la cárcel tras 3 turnos.`);
          } else {
            addLog(room, `${player.name} sigue en la cárcel (intento ${player.jailTurns}/3).`);
            room.turnPhase = 'end';
            emitRoom(room.roomId);
            return;
          }
        }
      }

      if (isDouble) {
        room.doublesStreak += 1;
        if (room.doublesStreak >= 3) {
          sendToJail(room, player);
          room.turnPhase = 'end';
          emitRoom(room.roomId);
          return;
        }
      }

      const space = movePlayer(room, player, d1 + d2);
      addLog(room, `${player.name} tiró ${d1} y ${d2}, cayó en ${space.name}.`);
      resolveSpace(room, player, space, d1 + d2);
      emitRoom(room.roomId);
    } catch (err) {
      console.error('rollDice error:', err);
    }
  });

  function resolveSpace(room, player, space, diceSum) {
    if (space.type === 'gotojail') {
      sendToJail(room, player);
      room.turnPhase = 'end';
      return;
    }
    if (space.type === 'tax') {
      player.cash -= space.amount;
      room.freeParkingPot += space.amount;
      addLog(room, `${player.name} pagó $${space.amount} de impuestos.`);
      checkBankrupt(room, player, null);
      room.turnPhase = 'end';
      return;
    }
    if (space.type === 'chance' || space.type === 'chest') {
      handleDrawCard(room, player, space.type);
      checkBankrupt(room, player, null);
      room.turnPhase = 'end';
      return;
    }
    if (space.type === 'freeparking') {
      player.cash += room.freeParkingPot;
      if (room.freeParkingPot > 0) addLog(room, `${player.name} se llevó $${room.freeParkingPot} del Parqueo Gratis.`);
      room.freeParkingPot = 0;
      room.turnPhase = 'end';
      return;
    }
    if (space.type === 'property' || space.type === 'railroad' || space.type === 'utility') {
      const own = ownerOf(room, space.id);
      if (!own) {
        room.turnPhase = 'action'; // esperando decisión de compra
        return;
      }
      if (own.ownerId === player.id) {
        room.turnPhase = 'end';
        return;
      }
      if (own.mortgaged) {
        room.turnPhase = 'end';
        return;
      }
      let rent = calculateRent(room, space);
      if (space.type === 'utility') rent = rent * diceSum;
      payPlayer(room, player, own.ownerId, rent);
      addLog(room, `${player.name} pagó $${rent} de renta a ${room.players.find(p => p.id === own.ownerId)?.name}.`);
      checkBankrupt(room, player, own.ownerId);
      room.turnPhase = 'end';
      return;
    }
    room.turnPhase = 'end';
  }

  socket.on('buyProperty', () => {
    try {
      const room = rooms.get(socket.data.roomId);
      if (!room || !room.started) return;
      const player = currentPlayer(room);
      if (player.id !== socket.id || room.turnPhase !== 'action') return;
      const space = board[player.position];
      if (!space.price || ownerOf(room, space.id)) return;
      if (player.cash < space.price) return;
      player.cash -= space.price;
      room.ownership[space.id] = { ownerId: player.id, houses: 0, mortgaged: false };
      addLog(room, `${player.name} compró ${space.name} por $${space.price}.`);
      room.turnPhase = 'end';
      emitRoom(room.roomId);
    } catch (err) {
      console.error('buyProperty error:', err);
    }
  });

  socket.on('skipBuy', () => {
    try {
      const room = rooms.get(socket.data.roomId);
      if (!room || !room.started) return;
      const player = currentPlayer(room);
      if (player.id !== socket.id || room.turnPhase !== 'action') return;
      const space = board[player.position];
      addLog(room, `${player.name} decidió no comprar ${space.name}.`);
      startAuction(room, space);
      emitRoom(room.roomId);
    } catch (err) {
      console.error('skipBuy error:', err);
    }
  });

  socket.on('placeBid', (data = {}) => {
    try {
      const { amount } = data;
      const room = rooms.get(socket.data.roomId);
      if (!room || !room.started || room.turnPhase !== 'auction' || !room.auction) return;
      if (socket.id !== currentAuctionPlayerId(room)) return;

      const bidder = room.players.find(player => player.id === socket.id);
      if (!bidder || bidder.bankrupt) return;

      const bidAmount = Number(amount);
      if (!Number.isFinite(bidAmount)) return;

      const minimumBid = room.auction.highestBid > 0 ? room.auction.highestBid + 10 : 10;
      if (bidAmount < minimumBid) return;
      if (bidAmount > bidder.cash) return;

      room.auction.highestBid = bidAmount;
      room.auction.highestBidderId = bidder.id;
      room.auction.bids[bidder.id] = bidAmount;

      const space = board[room.auction.spaceId];
      addLog(room, `${bidder.name} pujó $${bidAmount} por ${space.name}.`);

      if (!resolveAuctionIfDone(room) && room.auction) {
        room.auction.turnIndex = (room.auction.turnIndex + 1) % room.auction.order.length;
      }

      emitRoom(room.roomId);
    } catch (err) {
      console.error('placeBid error:', err);
    }
  });

  socket.on('passAuction', () => {
    try {
      const room = rooms.get(socket.data.roomId);
      if (!room || !room.started || room.turnPhase !== 'auction' || !room.auction) return;
      if (socket.id !== currentAuctionPlayerId(room)) return;

      const passerIndex = room.auction.order.indexOf(socket.id);
      if (passerIndex === -1) return;

      const passer = room.players.find(player => player.id === socket.id);
      if (!passer || passer.bankrupt) return;

      const space = board[room.auction.spaceId];
      addLog(room, `${passer.name} pasó en la subasta de ${space.name}.`);

      room.auction.order.splice(passerIndex, 1);
      if (room.auction.order.length > 0) {
        if (room.auction.turnIndex >= room.auction.order.length) {
          room.auction.turnIndex = 0;
        }
      }

      resolveAuctionIfDone(room);
      emitRoom(room.roomId);
    } catch (err) {
      console.error('passAuction error:', err);
    }
  });

  socket.on('buildHouse', (data = {}) => {
    try {
      const { spaceId } = data;
      const room = rooms.get(socket.data.roomId);
      if (!room || !room.started) return;
      const player = currentPlayer(room);
      if (player.id !== socket.id) return;
      const space = board.find(s => s.id === spaceId);
      const own = ownerOf(room, spaceId);
      if (!space || space.type !== 'property' || !own || own.ownerId !== player.id) return;
      if (own.houses >= 5) return; // 5 = hotel
      if (!canBuildHouse(room, space, player.id)) return;
      if (player.cash < space.houseCost) return;
      player.cash -= space.houseCost;
      own.houses += 1;
      addLog(room, `${player.name} construyó en ${space.name} (nivel ${own.houses}).`);
      emitRoom(room.roomId);
    } catch (err) {
      console.error('buildHouse error:', err);
    }
  });

  socket.on('sellHouse', (data = {}) => {
    try {
      const { spaceId } = data;
      const room = rooms.get(socket.data.roomId);
      if (!room || !room.started) return;
      const player = currentPlayer(room);
      if (player.id !== socket.id) return;
      const space = board.find(s => s.id === spaceId);
      const own = ownerOf(room, spaceId);
      if (!space || space.type !== 'property' || !own || own.ownerId !== player.id) return;
      if (!canSellHouse(room, space, player.id)) return;
      own.houses -= 1;
      player.cash += Math.floor(space.houseCost / 2);
      addLog(room, `${player.name} vendió una casa de ${space.name} por $${Math.floor(space.houseCost / 2)}.`);
      emitRoom(room.roomId);
    } catch (err) {
      console.error('sellHouse error:', err);
    }
  });

  socket.on('mortgageProperty', (data = {}) => {
    try {
      const { spaceId } = data;
      const room = rooms.get(socket.data.roomId);
      if (!room || !room.started) return;
      const player = currentPlayer(room);
      if (player.id !== socket.id) return;
      const space = board.find(s => s.id === spaceId);
      const own = ownerOf(room, spaceId);
      if (!space || !own || own.ownerId !== player.id) return;
      if (own.houses > 0) return;
      if (own.mortgaged) return;
      own.mortgaged = true;
      player.cash += Math.floor(space.price / 2);
      addLog(room, `${player.name} hipotecó ${space.name} por $${Math.floor(space.price / 2)}.`);
      emitRoom(room.roomId);
    } catch (err) {
      console.error('mortgageProperty error:', err);
    }
  });

  socket.on('unmortgageProperty', (data = {}) => {
    try {
      const { spaceId } = data;
      const room = rooms.get(socket.data.roomId);
      if (!room || !room.started) return;
      const player = currentPlayer(room);
      if (player.id !== socket.id) return;
      const space = board.find(s => s.id === spaceId);
      const own = ownerOf(room, spaceId);
      if (!space || !own || own.ownerId !== player.id) return;
      if (!own.mortgaged) return;
      const cost = Math.ceil(space.price / 2 * 1.10);
      if (player.cash < cost) return;
      own.mortgaged = false;
      player.cash -= cost;
      addLog(room, `${player.name} levantó la hipoteca de ${space.name} pagando $${cost}.`);
      emitRoom(room.roomId);
    } catch (err) {
      console.error('unmortgageProperty error:', err);
    }
  });

  // ---- TRADE EVENTS ----

  function genTradeId() {
    return crypto.randomBytes(3).toString('hex').toUpperCase();
  }

  socket.on('proposeTrade', (data = {}) => {
    try {
      const { toPlayerId, offer, request } = data;
      const room = rooms.get(socket.data.roomId);
      if (!room || !room.started) return;
      const from = room.players.find(p => p.id === socket.id);
      if (!from || from.bankrupt) return;
      const to = room.players.find(p => p.id === toPlayerId);
      if (!to || to.bankrupt || to.id === from.id) return;

      // Sanitize inputs
      const safePids = arr => (Array.isArray(arr) ? arr.map(Number).filter(Number.isFinite) : []);
      const trade = {
        id: genTradeId(),
        fromId: from.id,
        toId: to.id,
        offer:   { cash: Number(offer?.cash)   || 0, propertyIds: safePids(offer?.propertyIds),   jailCards: Number(offer?.jailCards)   || 0 },
        request: { cash: Number(request?.cash) || 0, propertyIds: safePids(request?.propertyIds), jailCards: Number(request?.jailCards) || 0 },
        status: 'pending',
      };

      // Validate BEFORE creating — rejects impossible offers immediately (1st call)
      if (!validateTrade(room, trade)) {
        socket.emit('tradeError', { message: 'El trato no es válido (fondos o propiedades insuficientes).' });
        return;
      }

      room.trades.push(trade);
      addLog(room, `${from.name} le propuso un trato a ${to.name}.`);
      emitRoom(room.roomId);
    } catch (err) {
      console.error('proposeTrade error:', err);
    }
  });

  socket.on('respondTrade', (data = {}) => {
    try {
      const { tradeId, accept } = data;
      const room = rooms.get(socket.data.roomId);
      if (!room || !room.started) return;
      const tradeIndex = room.trades.findIndex(t => t.id === tradeId);
      if (tradeIndex === -1) return;
      const trade = room.trades[tradeIndex];
      // Only the recipient can respond
      if (trade.toId !== socket.id) return;

      // Remove from list regardless of outcome
      room.trades.splice(tradeIndex, 1);

      if (accept) {
        // Re-validate from scratch — protects against stale state (2nd call)
        if (!validateTrade(room, trade)) {
          const from = room.players.find(p => p.id === trade.fromId);
          const to   = room.players.find(p => p.id === trade.toId);
          addLog(room, `El trato entre ${from?.name ?? '?'} y ${to?.name ?? '?'} ya no era válido y se canceló.`);
        } else {
          executeTrade(room, trade);
        }
      } else {
        const from = room.players.find(p => p.id === trade.fromId);
        const to   = room.players.find(p => p.id === trade.toId);
        addLog(room, `${to?.name ?? '?'} rechazó el trato de ${from?.name ?? '?'}.`);
      }

      emitRoom(room.roomId);
    } catch (err) {
      console.error('respondTrade error:', err);
    }
  });

  socket.on('cancelTrade', (data = {}) => {
    try {
      const { tradeId } = data;
      const room = rooms.get(socket.data.roomId);
      if (!room || !room.started) return;
      const tradeIndex = room.trades.findIndex(t => t.id === tradeId);
      if (tradeIndex === -1) return;
      const trade = room.trades[tradeIndex];
      // Only the proposer can cancel
      if (trade.fromId !== socket.id) return;
      room.trades.splice(tradeIndex, 1);
      const from = room.players.find(p => p.id === trade.fromId);
      const to   = room.players.find(p => p.id === trade.toId);
      addLog(room, `${from?.name ?? '?'} canceló el trato con ${to?.name ?? '?'}.`);
      emitRoom(room.roomId);
    } catch (err) {
      console.error('cancelTrade error:', err);
    }
  });

  socket.on('endTurn', () => {
    try {
      const room = rooms.get(socket.data.roomId);
      if (!room || !room.started) return;
      const player = currentPlayer(room);
      if (player.id !== socket.id || room.turnPhase !== 'end') return;

      const winnerCheck = activePlayers(room);
      if (winnerCheck.length === 1) {
        addLog(room, `${winnerCheck[0].name} ganó la partida.`);
        room.started = false;
        emitRoom(room.roomId);
        return;
      }

      if (room.doublesStreak > 0 && room.doublesStreak < 3 && room.lastDice && room.lastDice[0] === room.lastDice[1] && !player.inJail) {
        room.turnPhase = 'roll';
        addLog(room, `${player.name} sacó dobles, tira de nuevo.`);
      } else {
        advanceTurn(room);
      }
      emitRoom(room.roomId);
    } catch (err) {
      console.error('endTurn error:', err);
    }
  });

  socket.on('sendChat', (data = {}) => {
    try {
      const { text } = data;
      const room = rooms.get(socket.data.roomId);
      if (!room) return;
      const player = room.players.find(p => p.id === socket.id);
      if (!player) return;
      const message = cleanChatText(text);
      if (!message) return;
      io.to(room.roomId).emit('chatMessage', { name: player.name, text: message, ts: Date.now() });
    } catch (err) {
      console.error('sendChat error:', err);
    }
  });

  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.bankrupt) {
      cleanupRoomIfEmpty(roomId);
      return;
    }

    if (!room.started) {
      // In lobby: remove player, transfer host if needed
      const idx = room.players.indexOf(player);
      if (idx !== -1) room.players.splice(idx, 1);
      addLog(room, `${player.name} salió de la sala.`);
      if (room.players.length === 0) {
        rooms.delete(roomId);
      } else {
        emitRoom(roomId);
      }
      return;
    }

    // In-game: start grace period
    addLog(room, `${player.name} se desconectó. Tiene ${DISCONNECT_GRACE_MS / 1000}s para reconectar...`);
    player.disconnected = true;
    emitRoom(roomId);

    const timerKey = `${roomId}:${player.id}`;
    const timer = setTimeout(() => {
      disconnectTimers.delete(timerKey);
      const currentRoom = rooms.get(roomId);
      if (!currentRoom) return;
      const p = currentRoom.players.find(pl => pl.reconnectToken === player.reconnectToken);
      if (!p || p.bankrupt) return;
      // Grace period expired — eliminate player
      p.disconnected = false;
      addLog(currentRoom, `${p.name} no reconectó a tiempo y fue eliminado.`);
      handlePlayerElimination(currentRoom, p, null);
      emitRoom(roomId);
      cleanupRoomIfEmpty(roomId);
    }, DISCONNECT_GRACE_MS);
    disconnectTimers.set(timerKey, timer);
  });
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Servidor Cipher Monopoly SV corriendo en puerto ${PORT}`));
