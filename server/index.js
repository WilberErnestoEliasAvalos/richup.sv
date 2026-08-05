const express = require('express');
const http = require('http');
const cors = require('cors');
const crypto = require('crypto');
const { Server } = require('socket.io');
const {
  board, createRoom, newPlayer, addLog, rollDice, activePlayers,
  currentPlayer, advanceTurn, movePlayer, sendToJail, handleDrawCard,
  ownerOf, calculateRent, payPlayer, checkBankrupt, GO_TO_JAIL_INDEX, JAIL_INDEX,
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

function publicRoom(room) {
  return room; // por simplicidad enviamos todo el estado; ownership/log incluidos
}

function emitRoom(roomId) {
  const room = rooms.get(roomId);
  if (room) io.to(roomId).emit('roomState', publicRoom(room));
}

function genRoomId() {
  return crypto.randomBytes(4).toString('hex').slice(0, 6).toUpperCase();
}

io.on('connection', (socket) => {
  socket.on('createRoom', ({ playerName }, cb) => {
    const roomId = genRoomId();
    const room = createRoom(roomId, socket.id, cleanName(playerName));
    rooms.set(roomId, room);
    socket.join(roomId);
    socket.data.roomId = roomId;
    cb && cb({ ok: true, roomId, room });
  });

  socket.on('joinRoom', ({ roomId, playerName }, cb) => {
    const normalizedRoomId = cleanRoomId(roomId);
    const sanitizedName = cleanName(playerName);
    if (!normalizedRoomId) return cb && cb({ ok: false, error: 'Código de sala inválido.' });
    const room = rooms.get(normalizedRoomId);
    if (!room) return cb && cb({ ok: false, error: 'Esa sala no existe.' });
    if (room.started) return cb && cb({ ok: false, error: 'La partida ya empezó.' });
    if (room.players.length >= 6) return cb && cb({ ok: false, error: 'Sala llena (máximo 6).' });
    room.players.push(newPlayer(socket.id, sanitizedName, room.players.length));
    socket.join(normalizedRoomId);
    socket.data.roomId = normalizedRoomId;
    addLog(room, `${sanitizedName} se unió a la sala.`);
    cb && cb({ ok: true, roomId: normalizedRoomId, room });
    emitRoom(normalizedRoomId);
  });

  socket.on('startGame', () => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return;
    if (room.players[0].id !== socket.id) return; // solo el host inicia
    if (room.players.length < 2) return;
    room.started = true;
    addLog(room, 'La partida comenzó. ¡Suerte!');
    emitRoom(room.roomId);
  });

  socket.on('rollDice', () => {
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
      checkBankrupt(room, player);
      room.turnPhase = 'end';
      return;
    }
    if (space.type === 'chance' || space.type === 'chest') {
      handleDrawCard(room, player, space.type);
      checkBankrupt(room, player);
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
      let rent = calculateRent(room, space);
      if (space.type === 'utility') rent = rent * diceSum;
      payPlayer(room, player, own.ownerId, rent);
      addLog(room, `${player.name} pagó $${rent} de renta a ${room.players.find(p => p.id === own.ownerId)?.name}.`);
      checkBankrupt(room, player);
      room.turnPhase = 'end';
      return;
    }
    room.turnPhase = 'end';
  }

  socket.on('buyProperty', () => {
    const room = rooms.get(socket.data.roomId);
    if (!room || !room.started) return;
    const player = currentPlayer(room);
    if (player.id !== socket.id || room.turnPhase !== 'action') return;
    const space = board[player.position];
    if (!space.price || ownerOf(room, space.id)) return;
    if (player.cash < space.price) return;
    player.cash -= space.price;
    room.ownership[space.id] = { ownerId: player.id, houses: 0 };
    addLog(room, `${player.name} compró ${space.name} por $${space.price}.`);
    room.turnPhase = 'end';
    emitRoom(room.roomId);
  });

  socket.on('skipBuy', () => {
    const room = rooms.get(socket.data.roomId);
    if (!room || !room.started) return;
    const player = currentPlayer(room);
    if (player.id !== socket.id || room.turnPhase !== 'action') return;
    addLog(room, `${player.name} decidió no comprar ${board[player.position].name}.`);
    room.turnPhase = 'end';
    emitRoom(room.roomId);
  });

  socket.on('buildHouse', ({ spaceId }) => {
    const room = rooms.get(socket.data.roomId);
    if (!room || !room.started) return;
    const player = currentPlayer(room);
    if (player.id !== socket.id) return;
    const space = board.find(s => s.id === spaceId);
    const own = ownerOf(room, spaceId);
    if (!space || space.type !== 'property' || !own || own.ownerId !== player.id) return;
    if (own.houses >= 5) return; // 5 = hotel
    if (player.cash < space.houseCost) return;
    player.cash -= space.houseCost;
    own.houses += 1;
    addLog(room, `${player.name} construyó en ${space.name} (nivel ${own.houses}).`);
    emitRoom(room.roomId);
  });

  socket.on('endTurn', () => {
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
  });

  socket.on('sendChat', ({ text }) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;
    const message = cleanChatText(text);
    if (!message) return;
    io.to(room.roomId).emit('chatMessage', { name: player.name, text: message, ts: Date.now() });
  });

  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (player) {
      player.bankrupt = true;
      addLog(room, `${player.name} se desconectó.`);
      emitRoom(roomId);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Servidor Cipher Monopoly SV corriendo en puerto ${PORT}`));
