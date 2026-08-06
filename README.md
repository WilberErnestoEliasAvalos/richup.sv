# Cipher Monopoly SV 🇸🇻

Clon de Richup.io tematizado con El Salvador (departamentos, terminales de buses, ANDA/CAESS, "Suerte" y "Caja Comunal"), multijugador en tiempo real con Socket.io y React. Diseñado específicamente para pantallas de smartphones.

---

## 🚀 Características Implementadas (v1.0)

### 🎲 Mecánicas Principales de Juego
- **Salas Multijugador en Tiempo Real**: Creación e ingreso mediante código corto de sala.
- **Turnos y Movimiento**: Orden de juego, lanzamiento de dados, cárcel (3 turnos, dobles o pago de $50).
- **Propiedades Temáticas Salvadoreñas**: Departamentos por grupos de color, terminales de buses y servicios públicos (ANDA y CAESS).
- **Renta Automática**: Renta base, multiplicador de grupo completo (sin casas), cálculo dinámico por número de casas/hotel, terminales y servicios.

### 🏢 Reglas Oficiales de Monopoly
- **Subastas Públicas**: Si un jugador no compra la casilla en la que cayó, se abre subasta pública inmediata para todos los activos.
- **Construcción Pareja Obligatoria**: La compra de casas exige poseer **el grupo completo de color** y construir de forma pareja (paridad).
- **Venta de Casas al Banco**: Venta al 50% del valor con paridad inversa (desde la propiedad con más casas del grupo).
- **Hipotecas y Deshipotecas**: Hipotecar al 50% del valor (requiere 0 casas), cobro de renta suspendido mientras esté hipotecada y deshipoteca con 10% de interés.
- **Bancarrota Diferenciada**:
  - **Contra un Jugador**: Todos los fondos, cartas y propiedades (hipotecadas o no) pasan al acreedor.
  - **Contra el Banco**: Casas vendidas al 50% al bote de Parqueo Gratis y propiedades subastadas entre los sobrevivientes.
- **Sistema de Comercio/Trueque entre Jugadores**: Proponer ofertas de efectivo, propiedades e insignias de salida de cárcel a cualquier jugador activo en cualquier momento.

### 📱 Interfaz Optimizada para Pantallas Táctiles Móviles
- **Visor por Cuadrantes (Escala 200%)**: Tablero dividido en 4 cuadrantes con escala al 200% para máxima legibilidad sin necesidad de hacer zoom manual.
- **Mapeo Matemático de Auto-Seguimiento**: El tablero sigue automáticamente la posición de la ficha del jugador al tirar dados o moverse.
- **Gestos Táctiles (Swipe)**: Deslizar con el dedo en cualquier dirección para navegar libremente por el tablero.
- **Botón Zoom Out (`🗺️ Ver Todo`)**: Alternar con un toque entre la vista ampliada de cuadrante y la vista completa del tablero 11×11.
- **Tarjetas Emergentes (Suerte 🍀 y Caja Comunal 🎁)**: Modales interactivos emergentes que simulan la tarjeta física obtenida.
- **Historial de Turnos Enriquecido**: Registros clasificados por tarjetas de color, insignias de jugador con su color oficial e íconos característicos por tipo de evento.

---

## 🛠️ Desarrollo Local

Podés levantar todo localmente con Node.js:

### 1. Servidor (Backend)
```bash
cd server
npm install
npm run dev
```
*Servidor corriendo en `http://localhost:3001`.*

### 2. Cliente (Frontend)
```bash
cd client
npm install
npm run dev
```
*Vite corriendo en `http://localhost:5173`.*

---

## 🌐 Guía de Despliegue en Producción (100% Gratuito)

Para subir el juego a producción utilizando tu propio subdominio (ej. `monopoly.mycipher.app`) con **Cloudflare** y aprovechar tu paquete de **GitHub Student Developer Pack**:

### Opción Recomendada (Koyeb/Render + Vercel + Cloudflare)

#### 1. Servidor Node.js (Backend con Socket.io) en Koyeb o Render
1. Subí la carpeta `server/` a GitHub.
2. Registrate en **[Koyeb.com](https://koyeb.com)** o **[Render.com](https://render.com)** (ambos ofrecen plan gratuito que soporta WebSockets sin apagar el servidor).
3. Creá un **Web Service** conectado a tu repositorio:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Variable de Entorno**: `CLIENT_ORIGIN=https://monopoly.mycipher.app`
4. Copiá la URL asignada (ej: `https://cipher-monopoly-sv.koyeb.app`).

#### 2. Cliente React/Vite (Frontend) en Vercel
1. Subí la carpeta `client/` a GitHub.
2. En **[Vercel.com](https://vercel.com)**: **New Project** → Importar repositorio → Framework: **Vite**.
3. En **Environment Variables**, agregá:
   - `VITE_SERVER_URL` = `https://cipher-monopoly-sv.koyeb.app` (la URL de tu backend del paso 1).
4. Desplegá el proyecto.

#### 3. Configurar tu Subdominio en Cloudflare
1. En tu panel de **Cloudflare** para `mycipher.app`, ve a **DNS** → **Records**.
2. Creá un nuevo registro DNS:
   - **Type**: `CNAME`
   - **Name**: `monopoly` (para usar `monopoly.mycipher.app`)
   - **Target**: `cname.vercel-dns.com` (o la URL que te asigna Vercel)
   - **Proxy Status**: `Proxied` (Nube Naranja)
3. En **Vercel** → **Settings** → **Domains**, agregá `monopoly.mycipher.app`.

> 💡 **Nota sobre WebSockets en Cloudflare**: Cloudflare mantiene activos los WebSockets por defecto. Asegúrate de tener el modo SSL/TLS en **Full** o **Full (Strict)** en el panel de Cloudflare.

#### 4. Alternativa con GitHub Student Developer Pack
Con tu **GitHub Student Pack**, disponés de:
- **DigitalOcean**: $200 de crédito gratis (podés levantar un Droplet con Node.js + PM2 + Nginx).
- **Azure for Students**: $100 de crédito gratis sin tarjeta de crédito.

