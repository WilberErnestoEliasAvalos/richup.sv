const { board, chanceCards, chestCards } = require('./board');

const STARTING_CASH = 1500;
const JAIL_INDEX = 10;
const GO_TO_JAIL_INDEX = 30;
const PASS_GO_AMOUNT = 200;

function createRoom(roomId, hostId, hostName) {
  return {
    roomId,
    players: [
      newPlayer(hostId, hostName, 0),
    ],
    started: false,
    currentPlayerIndex: 0,
    ownership: {}, // spaceId -> { ownerId, houses }
    log: [],
    turnPhase: 'roll', // roll -> action -> end
    lastDice: null,
    doublesStreak: 0,
    freeParkingPot: 0,
  };
}

function newPlayer(id, name, colorIndex) {
  return {
    id,
    name,
    colorIndex,
    cash: STARTING_CASH,
    position: 0,
    inJail: false,
    jailTurns: 0,
    getOutOfJailCards: 0,
    bankrupt: false,
  };
}

function addLog(room, message) {
  room.log.unshift({ message, ts: Date.now() });
  if (room.log.length > 60) room.log.pop();
}

function rollDice() {
  const d1 = 1 + Math.floor(Math.random() * 6);
  const d2 = 1 + Math.floor(Math.random() * 6);
  return [d1, d2];
}

function activePlayers(room) {
  return room.players.filter(p => !p.bankrupt);
}

function currentPlayer(room) {
  return room.players[room.currentPlayerIndex];
}

function advanceTurn(room) {
  const n = room.players.length;
  let next = room.currentPlayerIndex;
  do {
    next = (next + 1) % n;
  } while (room.players[next].bankrupt && activePlayers(room).length > 0);
  room.currentPlayerIndex = next;
  room.turnPhase = 'roll';
  room.lastDice = null;
  room.doublesStreak = 0;
}

function movePlayer(room, player, steps) {
  const prev = player.position;
  let next = (player.position + steps) % 40;
  if (next < 0) next += 40;
  if (steps > 0 && next < prev) {
    player.cash += PASS_GO_AMOUNT;
    addLog(room, `${player.name} pasó por Salida y cobró $${PASS_GO_AMOUNT}.`);
  }
  player.position = next;
  return board[next];
}

function sendToJail(room, player) {
  player.position = JAIL_INDEX;
  player.inJail = true;
  player.jailTurns = 0;
  addLog(room, `${player.name} fue enviado a la cárcel.`);
}

function handleDrawCard(room, player, deckType) {
  const deck = deckType === 'chance' ? chanceCards : chestCards;
  const card = deck[Math.floor(Math.random() * deck.length)];
  addLog(room, `${player.name} sacó carta (${deckType === 'chance' ? 'Suerte' : 'Caja Comunal'}): ${card.text}`);
  switch (card.action) {
    case 'collect':
      player.cash += card.amount;
      break;
    case 'pay':
      player.cash -= card.amount;
      break;
    case 'goto': {
      const steps = (card.to - player.position + 40) % 40;
      movePlayer(room, player, steps);
      break;
    }
    case 'move':
      movePlayer(room, player, card.steps);
      break;
    case 'gotojail':
      sendToJail(room, player);
      break;
    case 'getoutofjail':
      player.getOutOfJailCards += 1;
      break;
    case 'collectFromAll':
      room.players.forEach(p => {
        if (p.id !== player.id && !p.bankrupt) {
          p.cash -= card.amount;
          player.cash += card.amount;
        }
      });
      break;
  }
  return card;
}

function ownerOf(room, spaceId) {
  return room.ownership[spaceId];
}

function countGroupOwned(room, group, ownerId) {
  const spaces = board.filter(s => s.group === group);
  const owned = spaces.filter(s => room.ownership[s.id] && room.ownership[s.id].ownerId === ownerId);
  return { total: spaces.length, owned: owned.length };
}

function calculateRent(room, space) {
  const own = room.ownership[space.id];
  if (!own) return 0;
  if (space.type === 'property') {
    const houses = own.houses || 0;
    const { total, owned } = countGroupOwned(room, space.group, own.ownerId);
    let rent = space.rent[houses];
    if (houses === 0 && owned === total) rent *= 2; // monopolio sin casas = renta x2
    return rent;
  }
  if (space.type === 'railroad') {
    const railroads = board.filter(s => s.type === 'railroad');
    const ownedCount = railroads.filter(s => room.ownership[s.id] && room.ownership[s.id].ownerId === own.ownerId).length;
    return 25 * Math.pow(2, ownedCount - 1);
  }
  if (space.type === 'utility') {
    const utilities = board.filter(s => s.type === 'utility');
    const ownedCount = utilities.filter(s => room.ownership[s.id] && room.ownership[s.id].ownerId === own.ownerId).length;
    const multiplier = ownedCount >= 2 ? 10 : 4;
    return multiplier; // se multiplica por el último dado tirado, ver server
  }
  return 0;
}

function payPlayer(room, fromPlayer, toPlayerId, amount) {
  fromPlayer.cash -= amount;
  const to = room.players.find(p => p.id === toPlayerId);
  if (to) to.cash += amount;
}

function checkBankrupt(room, player) {
  if (player.cash < 0) {
    player.bankrupt = true;
    // liberar propiedades
    Object.keys(room.ownership).forEach(id => {
      if (room.ownership[id].ownerId === player.id) delete room.ownership[id];
    });
    addLog(room, `${player.name} quebró y salió del juego.`);
    return true;
  }
  return false;
}

module.exports = {
  board,
  STARTING_CASH,
  JAIL_INDEX,
  GO_TO_JAIL_INDEX,
  PASS_GO_AMOUNT,
  createRoom,
  newPlayer,
  addLog,
  rollDice,
  activePlayers,
  currentPlayer,
  advanceTurn,
  movePlayer,
  sendToJail,
  handleDrawCard,
  ownerOf,
  countGroupOwned,
  calculateRent,
  payPlayer,
  checkBankrupt,
};
