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
    auction: null,
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

function startAuction(room, space) {
  const active = activePlayers(room).map(player => player.id);
  const currentId = currentPlayer(room)?.id;
  const currentIndex = active.indexOf(currentId);
  const order = [];

  if (currentIndex !== -1) {
    for (let offset = 1; offset <= active.length; offset += 1) {
      order.push(active[(currentIndex + offset) % active.length]);
    }
  }

  room.auction = {
    spaceId: space.id,
    highestBid: 0,
    highestBidderId: null,
    order,
    turnIndex: 0,
    bids: {},
  };
  room.turnPhase = 'auction';
  addLog(room, `Se abrió subasta por ${space.name}.`);
}

function currentAuctionPlayerId(room) {
  return room.auction?.order?.[room.auction.turnIndex] || null;
}

function resolveAuctionIfDone(room) {
  const auction = room.auction;
  if (!auction) return false;

  const space = board[auction.spaceId];
  if (!space) {
    room.auction = null;
    room.turnPhase = 'end';
    return true;
  }

  if (auction.order.length === 0) {
    addLog(room, `La subasta por ${space.name} terminó sin ganador.`);
    room.auction = null;
    room.turnPhase = 'end';
    return true;
  }

  if (auction.order.length > 1) return false;

  const solePlayerId = auction.order[0];
  const soleBid = auction.bids?.[solePlayerId];
  if (!soleBid) return false;

  const winner = room.players.find(player => player.id === solePlayerId);
  if (!winner) {
    addLog(room, `La subasta por ${space.name} terminó sin ganador.`);
    room.auction = null;
    room.turnPhase = 'end';
    return true;
  }

  if (winner.cash < soleBid) {
    addLog(room, `${winner.name} no tenía efectivo suficiente para cerrar la subasta de ${space.name}.`);
    room.auction = null;
    room.turnPhase = 'end';
    return true;
  }

  winner.cash -= soleBid;
  room.ownership[space.id] = { ownerId: winner.id, houses: 0, mortgaged: false };
  addLog(room, `${winner.name} ganó la subasta de ${space.name} por $${soleBid}.`);
  room.auction = null;
  room.turnPhase = 'end';
  return true;
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

function canBuildHouse(room, space, ownerId) {
  const groupSpaces = board.filter(s => s.group === space.group);
  // Must own entire group
  const allOwned = groupSpaces.every(s => room.ownership[s.id] && room.ownership[s.id].ownerId === ownerId);
  if (!allOwned) return false;
  // No property in the group can be mortgaged
  if (groupSpaces.some(s => room.ownership[s.id].mortgaged)) return false;
  // Even-build: can only build on properties with the minimum house count in the group
  const houseCounts = groupSpaces.map(s => room.ownership[s.id].houses);
  const minHouses = Math.min(...houseCounts);
  const own = room.ownership[space.id];
  return own.houses <= minHouses;
}

function canSellHouse(room, space, ownerId) {
  const own = room.ownership[space.id];
  if (!own || own.ownerId !== ownerId || own.houses <= 0) return false;
  const groupSpaces = board.filter(s => s.group === space.group);
  const houseCounts = groupSpaces
    .filter(s => room.ownership[s.id] && room.ownership[s.id].ownerId === ownerId)
    .map(s => room.ownership[s.id].houses);
  const maxHouses = Math.max(...houseCounts);
  return own.houses >= maxHouses;
}

function payPlayer(room, fromPlayer, toPlayerId, amount) {
  fromPlayer.cash -= amount;
  const to = room.players.find(p => p.id === toPlayerId);
  if (to) to.cash += amount;
}

function checkBankrupt(room, player, creditorId) {
  if (player.cash >= 0) return false;

  // Step 1: auto-sell ALL houses/hotels to the bank (houseCost/2 each)
  let soldAny = true;
  while (player.cash < 0 && soldAny) {
    soldAny = false;
    const myPropIds = Object.keys(room.ownership).filter(id => room.ownership[id].ownerId === player.id);
    for (const id of myPropIds) {
      const own = room.ownership[id];
      if (own.houses > 0) {
        const sp = board[Number(id)];
        const refund = Math.floor(sp.houseCost / 2);
        player.cash += refund;
        own.houses -= 1;
        soldAny = true;
        addLog(room, `${player.name} vendió una casa de ${sp.name} por $${refund} (auto-venta).`);
        if (player.cash >= 0) break;
      }
    }
  }

  // Step 2: if still bankrupt after selling all houses
  if (player.cash < 0) {
    const creditor = creditorId ? room.players.find(p => p.id === creditorId) : null;
    if (creditorId && creditor) {
      // Transfer all properties to creditor (keep mortgaged state, houses already 0)
      Object.keys(room.ownership).forEach(id => {
        if (room.ownership[id].ownerId === player.id) {
          room.ownership[id].ownerId = creditorId;
        }
      });
      addLog(room, `${player.name} quebró. Sus propiedades pasan a ${creditor.name}.`);
    } else {
      // Release properties to bank
      Object.keys(room.ownership).forEach(id => {
        if (room.ownership[id].ownerId === player.id) delete room.ownership[id];
      });
      addLog(room, `${player.name} quebró y sus propiedades volvieron al banco.`);
    }
    player.bankrupt = true;
    player.cash = 0;
    return true;
  }

  // Step 3: saved by selling houses
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
  startAuction,
  currentAuctionPlayerId,
  resolveAuctionIfDone,
  handleDrawCard,
  ownerOf,
  countGroupOwned,
  calculateRent,
  canBuildHouse,
  canSellHouse,
  payPlayer,
  checkBankrupt,
};
