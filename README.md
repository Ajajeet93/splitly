# Splitly

> A full-stack expense splitting app inspired by Splitwise — built with React, Node.js, PostgreSQL & Socket.IO

**Live App:** [splitly.vercel.app](https://splitly.vercel.app) *(updated after deployment)*

---

## Features

- 🔐 Email + password authentication (JWT)
- 👥 Create groups, invite members via shareable link
- 💸 Add expenses with 4 split types: Equal, Unequal, Percentage, Share
- 💬 Real-time chat on each expense (Socket.IO)
- 📊 Group balances + individual balance dashboard
- 🤝 Settle debts with lump-sum payments
- 🔔 In-app notifications
- 🌙 Light + Dark mode
- 📱 Responsive design

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + Vite |
| UI | Shadcn/ui + Tailwind CSS |
| Backend | Node.js + Express |
| Database | PostgreSQL (Neon.tech) |
| ORM | Prisma |
| Real-time | Socket.IO |
| Auth | JWT + bcrypt |
| Deployment | Render (API) + Vercel (Frontend) |

---

## Local Setup

### Prerequisites
- Node.js v18+
- npm v9+
- PostgreSQL database (or Neon.tech free account)

### 1. Clone the repo
```bash
git clone https://github.com/Ajajeet93/splitly.git
cd splitly
```

### 2. Backend Setup
```bash
cd server
cp .env.example .env
# Fill in your values in .env
npm install
npx prisma migrate dev
npm run dev
```

### 3. Frontend Setup
```bash
cd client
cp .env.example .env
# Fill in your values in .env
npm install
npm run dev
```

### 4. Environment Variables

#### Server (`/server/.env`)
```env
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
JWT_SECRET=your_super_secret_jwt_key_here
PORT=5000
CLIENT_URL=http://localhost:5173
NODE_ENV=development
```

#### Client (`/client/.env`)
```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

---

## AI Used

**Antigravity (Google DeepMind)** — used as the primary AI development collaborator throughout this project.

See [`AI_CONTEXT.md`](./AI_CONTEXT.md) for full context, decisions, and prompts used.
See [`PROMPTS.md`](./PROMPTS.md) for all key prompts — sufficient to recreate this app.

---

## Project Structure

```
splitly/
├── client/          # React + Vite frontend
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── context/
│   │   ├── hooks/
│   │   └── lib/
│   └── package.json
├── server/          # Node.js + Express backend
│   ├── src/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   └── lib/
│   ├── prisma/
│   │   └── schema.prisma
│   └── package.json
├── AI_CONTEXT.md
├── BUILD_PLAN.md
└── PROMPTS.md
```

---

## License
MIT
