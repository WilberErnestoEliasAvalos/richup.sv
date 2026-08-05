// Tablero de 40 casillas — "Cipher Monopoly SV"
// Grupos de color y zonas urbanas de El Salvador.

const GROUPS = {
  marron:      { name: 'Marrón',      color: '#8B5A2B' },
  celeste:     { name: 'Celeste',     color: '#5BB9E6' },
  rosa:        { name: 'Rosa',        color: '#E56AA6' },
  naranja:     { name: 'Naranja',     color: '#F28C38' },
  roja:        { name: 'Roja',        color: '#D73A3A' },
  amarilla:    { name: 'Amarilla',    color: '#E0B93C' },
  verde:       { name: 'Verde',       color: '#2E8B57' },
  azulOscuro:  { name: 'Azul Oscuro', color: '#173E8F' },
};

// type: 'go' | 'property' | 'chest' | 'tax' | 'railroad' | 'chance' | 'jail' | 'freeparking' | 'gotojail' | 'utility'
const board = [
  { id: 0,  type: 'go', name: 'Salida' },
  { id: 1,  type: 'property', name: 'Apopa Centro', group: 'marron', price: 60, rent: [2, 10, 30, 90, 160, 250], houseCost: 50 },
  { id: 2,  type: 'chest', name: 'Caja Comunal' },
  { id: 3,  type: 'property', name: 'Ciudad Delgado Centro', group: 'marron', price: 60, rent: [4, 20, 60, 180, 320, 450], houseCost: 50 },
  { id: 4,  type: 'tax', name: 'Renta Hacienda', amount: 200 },
  { id: 5,  type: 'railroad', name: 'Terminal de Occidente', price: 200 },
  { id: 6,  type: 'property', name: 'Soyapango Centro', group: 'celeste', price: 100, rent: [6, 30, 90, 270, 400, 550], houseCost: 50 },
  { id: 7,  type: 'chance', name: 'Suerte' },
  { id: 8,  type: 'property', name: 'Ilopango Centro', group: 'celeste', price: 100, rent: [6, 30, 90, 270, 400, 550], houseCost: 50 },
  { id: 9,  type: 'property', name: 'Chalchuapa Centro', group: 'celeste', price: 120, rent: [8, 40, 100, 300, 450, 600], houseCost: 50 },
    { id: 10,  type: 'jail', name: 'CECOT' },
  { id: 11, type: 'property', name: 'Centro Histórico de Sonsonate', group: 'rosa', price: 140, rent: [10, 50, 150, 450, 625, 750], houseCost: 100 },
  { id: 12, type: 'utility', name: 'AES El Salvador', price: 150 },
  { id: 13, type: 'property', name: 'Centro Histórico de Santa Ana', group: 'rosa', price: 140, rent: [10, 50, 150, 450, 625, 750], houseCost: 100 },
  { id: 14, type: 'property', name: 'Centro Histórico de San Miguel', group: 'rosa', price: 160, rent: [12, 60, 180, 500, 700, 900], houseCost: 100 },
  { id: 15, type: 'railroad', name: 'Terminal de Oriente', price: 200 },
  { id: 16, type: 'property', name: 'Zaragoza', group: 'naranja', price: 180, rent: [14, 70, 200, 550, 750, 950], houseCost: 100 },
  { id: 17, type: 'chest', name: 'Caja Comunal' },
  { id: 18, type: 'property', name: 'Lourdes Colón', group: 'naranja', price: 180, rent: [14, 70, 200, 550, 750, 950], houseCost: 100 },
  { id: 19, type: 'property', name: 'Ciudad Merliot', group: 'naranja', price: 200, rent: [16, 80, 220, 600, 800, 1000], houseCost: 100 },
  { id: 20, type: 'freeparking', name: 'Parqueo Gratis' },
  { id: 21, type: 'property', name: 'Santa Tecla Centro', group: 'roja', price: 220, rent: [18, 90, 250, 700, 875, 1050], houseCost: 150 },
  { id: 22, type: 'chance', name: 'Suerte' },
  { id: 23, type: 'property', name: 'Colonia San Francisco', group: 'roja', price: 220, rent: [18, 90, 250, 700, 875, 1050], houseCost: 150 },
  { id: 24, type: 'property', name: 'Colonia Escalón', group: 'roja', price: 240, rent: [20, 100, 300, 750, 925, 1100], houseCost: 150 },
  { id: 25, type: 'railroad', name: 'Terminal del Sur', price: 200 },
  { id: 26, type: 'property', name: 'Costa del Sol', group: 'amarilla', price: 260, rent: [22, 110, 330, 800, 975, 1150], houseCost: 150 },
  { id: 27, type: 'property', name: 'El Tunco', group: 'amarilla', price: 260, rent: [22, 110, 330, 800, 975, 1150], houseCost: 150 },
  { id: 28, type: 'utility', name: 'ANDA (Agua)', price: 150 },
  { id: 29, type: 'property', name: 'El Sunzal', group: 'amarilla', price: 280, rent: [24, 120, 360, 850, 1025, 1200], houseCost: 150 },
  { id: 30, type: 'gotojail', name: 'Capturado en Régimen de Excepción' },
  { id: 31, type: 'property', name: 'San Benito', group: 'verde', price: 300, rent: [26, 130, 390, 900, 1100, 1275], houseCost: 200 },
  { id: 32, type: 'property', name: 'Santa Elena', group: 'verde', price: 300, rent: [26, 130, 390, 900, 1100, 1275], houseCost: 200 },
  { id: 33, type: 'chest', name: 'Caja Comunal' },
  { id: 34, type: 'property', name: 'Cumbres de Cuscatlán', group: 'verde', price: 320, rent: [28, 150, 450, 1000, 1200, 1400], houseCost: 200 },
  { id: 35, type: 'railroad', name: 'Aeropuerto Internacional de El Salvador', price: 200 },
  { id: 36, type: 'chance', name: 'Suerte' },
  { id: 37, type: 'property', name: 'Tuscania', group: 'azulOscuro', price: 350, rent: [35, 175, 500, 1100, 1300, 1500], houseCost: 200 },
  { id: 38, type: 'tax', name: 'Impuesto de Alcaldía', amount: 100 },
  { id: 39, type: 'property', name: 'El Encanto', group: 'azulOscuro', price: 400, rent: [50, 200, 600, 1400, 1700, 2000], houseCost: 200 },
];

const chanceCards = [
  { text: 'Ganás un tour gratis en el Boquerón. Avanzá a Salida y cobrá $200.', action: 'goto', to: 0, collect: true },
  { text: 'Te encontraste tráfico en el Bulevar. Retrocedé 3 casillas.', action: 'move', steps: -3 },
  { text: 'Ganaste el bingo del cantón. Cobrá $50.', action: 'collect', amount: 50 },
  { text: 'Multa de tránsito en Santa Tecla Centro. Pagá $75.', action: 'pay', amount: 75 },
  { text: 'Vas directo a la cárcel. No pasás por Salida.', action: 'gotojail' },
  { text: 'Herencia de tu tía en Zaragoza. Cobrá $150.', action: 'collect', amount: 150 },
  { text: 'Reparación de tu pick-up. Pagá $100.', action: 'pay', amount: 100 },
  { text: 'Ganaste una rifa de la iglesia. Avanzá a Santa Tecla Centro.', action: 'goto', to: 21 },
];

const chestCards = [
  { text: 'Devolución de renta. Cobrá $20 de cada jugador.', action: 'collectFromAll', amount: 20 },
  { text: 'Pagaste la colegiatura. Pagá $150.', action: 'pay', amount: 150 },
  { text: 'Bono de fin de año. Cobrá $100.', action: 'collect', amount: 100 },
  { text: 'Gastos médicos. Pagá $50.', action: 'pay', amount: 50 },
  { text: 'Salís de la cárcel gratis (guardá esta carta).', action: 'getoutofjail' },
  { text: 'Venta de artesanías en Sonsonate. Cobrá $80.', action: 'collect', amount: 80 },
  { text: 'Impuestos municipales atrasados. Pagá $60.', action: 'pay', amount: 60 },
];

module.exports = { board, GROUPS, chanceCards, chestCards };
