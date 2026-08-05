# Cipher Monopoly SV

Clon de Richup.io tematizado con El Salvador (departamentos, terminales de buses,
ANDA/CAESS, "Suerte" y "Caja Comunal"), multijugador en tiempo real.

## Qué incluye este MVP

- Salas con código para invitar amigos (crear / unirse)
- Turnos por orden, dados, movimiento, cárcel (3 turnos o dobles o pagar $50)
- Compra de propiedades, terminales de buses y servicios (ANDA/CAESS)
- Renta automática (incluye monopolio x2 sin casas, terminales y servicios escalonados)
- Construcción de casas/hotel por color
- Suerte y Caja Comunal con cartas temáticas
- Impuestos, Parqueo Gratis con bote acumulado
- Chat en vivo y bancarrota / condición de victoria

## Lo que falta para una versión 1.0 completa (siguiente iteración)

- Subastas cuando alguien no compra una propiedad
- Comercio/trueque entre jugadores (propiedades + efectivo)
- Hipotecar propiedades
- Reconexión tras perder internet (ahora mismo, desconectarse = bancarrota)
- Animación de dados y del movimiento de fichas
- Persistencia de salas (ahora todo vive en memoria del servidor; si el server
  se reinicia, las salas se pierden)

Decime cuál de estos querés que construyamos primero y seguimos desde aquí.

## Correrlo en tu computadora

Si ya tenés el runtime local instalado en `.tooling/nodejs`, podés levantar
todo con un solo comando desde la raíz del proyecto:

```bash
bash dev.sh
```

### 1. Backend

```bash
cd server
npm install
npm run dev
```

Esto levanta el servidor en `http://localhost:3001`.

### 2. Frontend

En otra terminal:

```bash
cd client
npm install
npm run dev
```

Esto levanta Vite en `http://localhost:5173`. Abrí esa URL en varias pestañas
(o compartila en tu red local) para probar el multijugador.

## Desplegarlo en producción (gratis) y conectarlo a mycipher.app

### Paso 1 — Backend en Railway (o Render)

1. Subí la carpeta `server/` a un repo de GitHub.
2. En [railway.app](https://railway.app) (o [render.com](https://render.com)),
   creá un nuevo proyecto "Deploy from GitHub repo" apuntando a esa carpeta.
3. Ambos detectan Node automáticamente. Asegurate que el comando de arranque
   sea `npm start` y que el puerto lea `process.env.PORT` (ya está así en
   `index.js`).
4. Cuando termine el deploy, copiá la URL pública, algo como
   `https://cipher-monopoly-sv.up.railway.app`.

### Variables de entorno recomendadas

Usá estos valores como base:

- `server/.env`
  - `PORT=3001`
  - `CLIENT_ORIGIN=https://monopoly.mycipher.app`
- `client/.env`
  - `VITE_SERVER_URL=https://cipher-monopoly-sv.up.railway.app`

Los ejemplos listos para copiar están en `server/.env.example` y
`client/.env.example`.

### Paso 2 — Frontend en Vercel o Netlify

1. Subí la carpeta `client/` a otro repo (o el mismo, como sub-carpeta).
2. En Vercel: "New Project" → importás el repo → Framework: Vite.
3. Antes de desplegar, agregá la variable de entorno:
   - `VITE_SERVER_URL` = la URL de Railway/Render del paso 1.
4. Deploy.

### Paso 3 — Apuntar tu subdominio

En el panel DNS de `mycipher.app` (donde tengas administrado el dominio),
creá un registro:

- Tipo: `CNAME`
- Nombre: `monopoly` (o el subdominio que quieras, ej. `juego`)
- Valor: el dominio que te da Vercel/Netlify (ej. `cname.vercel-dns.com`)

Luego en el proyecto de Vercel/Netlify, agregá `monopoly.mycipher.app` como
dominio personalizado — ellos te confirman cuándo el DNS propagó.

El backend (Railway/Render) puede quedarse en su propia URL, no necesita
subdominio propio, pero si querés uno (ej. `api.mycipher.app`), el proceso es
el mismo: CNAME apuntando a la URL que te dé la plataforma.

### Nota sobre CORS en producción

En producción, definí `CLIENT_ORIGIN` con el dominio real del frontend para
que solo ese origen pueda conectar al servidor de juego. Si servís varios
frontends legítimos, separalos con comas.

Ejemplo:

```bash
CLIENT_ORIGIN=https://monopoly.mycipher.app,https://www.mycipher.app
```
