# pXiel — Collaborative Pixel Canvas

🎨 Express yourself on the blockchain, one pixel at a time.

pXiel is a decentralized collaborative pixel art canvas built on the Xian blockchain. Paint pixels, create art, and leave your mark forever on an immutable, shared canvas.

## 🚀 Features

- **Decentralized Canvas**: Every pixel is recorded on-chain
- **Real-time Collaboration**: See pixels appear as transactions land
- **Smooth Controls**: Zoom, pan, and paint with a simple UI
- **Wallet Integration**: Connect your Xian wallet to participate
- **1 XIAN per pixel**: Frontend passes value; contract enforces the fee

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, React 18
- **Styling**: Bulma
- **State**: Zustand
- **Indexing**: Apollo Client (GraphQL)
- **Blockchain**: Xian Network + Wallet Extension

## 📋 Prerequisites

- Node.js 18+
- Xian Wallet Extension installed
- Access to Xian testnet funds

## ⚙️ Environment Variables

Create `.env.local` in the project root (values shown are sensible defaults):

```bash
# RPC and WebSocket
NEXT_PUBLIC_XIAN_RPC=https://testnet.xian.org
NEXT_PUBLIC_XIAN_WS_URL=wss://devnet.xian.org/websocket

# Canvas contract + settings
NEXT_PUBLIC_CANVAS_CONTRACT=con_pixel_canvas4
NEXT_PUBLIC_CANVAS_SIZE=500         # default is 32 if unset
NEXT_PUBLIC_PIXEL_PRICE_WEI=1000000000000000000  # 1 XIAN in wei
```

Notes:

- The app has built-in defaults; env vars let you point to custom endpoints/contracts.
- The WebSocket monitor subscribes to `tm.event='Tx'` and filters by `contract` to stream paint events.

## ▶️ Getting Started

1. Install dependencies

```bash
npm install
```

2. Start the dev server (port 4545)

```bash
npm run dev
```

Open `http://localhost:4545`.

## 🧭 Usage

1. Connect your Xian wallet
2. Choose a color
3. Click a pixel to paint (wallet will prompt; 1 XIAN per pixel)
4. Navigate the board:
   - `Ctrl + Scroll` to zoom
   - `Ctrl + Drag` to pan

Painted pixels appear in near real-time as transactions are observed via WebSocket.

## 🔗 Smart Contract Expectations

- Contract name from `NEXT_PUBLIC_CANVAS_CONTRACT` (default: `con_pixel_canvas4`)
- Exposes a `paint` method accepting coordinates and color
- Enforces a 1 XIAN fee per pixel (frontend also sends `value`)

## 🧱 Scripts

- `npm run dev` — Next.js dev server on port 4545
- `npm run build` — Production build
- `npm run start` — Start production server on port 4545
- `npm run lint` — Lint the project

## 📄 License

MIT
