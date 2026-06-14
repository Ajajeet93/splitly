# AI_CONTEXT.md — Splitly App
> **Source of Truth** for the entire Splitly project.  
> Maintained continuously by AI throughout the build process.  
> Another developer or AI agent should be able to rebuild a near-identical app using this file alone.

---

## 1. Product Understanding

Splitly is a Splitwise-inspired expense-splitting web app targeting two primary user personas:
- **Travel groups**: Friends on trips splitting hotels, meals, transport
- **Roommates**: People sharing a flat splitting rent, electricity, groceries

The product allows users to create groups, add expenses with flexible split types, track who owes whom, chat in real-time on expenses, and record debt settlements.

---

## 2. Product Scope (MVP)

### In Scope
- User registration and login (email + password)
- User profile update (name, avatar)
- Create and manage groups (invite via shareable link, remove members)
- One-on-one direct expenses (outside of groups, between two friends)
- Create and manage expenses with 4 split types: Equal, Unequal, Percentage, Share
- Expense categories (predefined: 🍕Food, 🏠Rent, ✈️Travel, 💡Utilities, 🎉Entertainment, 🛒Shopping, 🏥Health, 📦Other)
- Expense editing (amount, description, splits, category)
- Expense deletion
- Real-time chat on each expense (text + system activity messages via Socket.IO)
- Group balances: net per member + directed "who owes whom"
- Dashboard: total owed + total owed-to + person-by-person breakdown
- Settle debts (lump-sum payment, net balance recomputed)
- In-app notifications (bell icon with unread count)
- Light + Dark mode toggle
- Responsive web UI

### Out of Scope
- Google/social login
- Email notifications
- Multi-currency support (INR only)
- File attachments on expenses
- Mobile native app
- Payment gateway integration
- Debt simplification across groups

---

## 3. User Personas

### Persona 1: Traveller (Rohan, 24)
- Goes on group trips with 4-6 friends
- Someone pays hotel upfront, rest owe them
- Wants to see total trip cost and who owes what at a glance
- Settles via UPI/cash, records it manually in the app

### Persona 2: Roommate (Priya, 22)
- Shares flat with 2 others
- Splits monthly rent (equal), electricity (unequal), groceries (whoever buys pays)
- Checks app at end of month to settle up

---

## 4. Core Workflows

### Registration & Login
1. User opens Splitly → Landing page with Login / Register CTAs
2. Registers with name, email, password (bcrypt hashed)
3. JWT token issued (7 day expiry) → stored in localStorage
4. Redirected to Dashboard

### Create a Group
1. Click "New Group" → enter name, description, choose emoji icon
2. Group created → logged-in user is first member
3. Click "Invite" → unique invite token generated (UUID)
4. Shareable link: `/join/:token`
5. Recipient registers if needed → clicks link again → joins group

### New Member Visibility
- New members see only expenses added **after their `joined_at` timestamp**
- Filtered server-side on every expense list query

### Add an Expense (Group)
1. Inside group → click "Add Expense"
2. Fill: description, amount (₹), category, split type
3. Select members to split with from group member list
4. Logged-in user is always the payer
5. Submit → expense + splits created → balances recomputed on next fetch

### Split Types
| Type | Formula |
|------|---------|
| EQUAL | `amount / n` per person |
| UNEQUAL | user enters exact ₹ per person (must sum to total) |
| PERCENTAGE | user enters % per person (must sum to 100%) |
| SHARE | `user_shares / total_shares × amount` |

### Settle a Debt
1. "Settle Up" → select payee → enter amount → optional note
2. Settlement saved in `settlements` table
3. Net balances recomputed dynamically from expenses + settlements

### Real-time Chat
- Socket.IO room per expense: `expense:{id}`
- User messages + system messages stored in `comments` table
- System messages triggered on: expense created, expense edited, settlement recorded
- On page load: fetch comment history via REST, then subscribe to Socket.IO room

### In-App Notifications
- Bell icon in navbar with unread count
- Triggers: expense added to your group, expense edited, settlement with you
- Click → navigate to relevant expense or group

---

## 5. Implementation Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Auth | JWT (localStorage) | Simple, stateless |
| Password hashing | bcryptjs (salt rounds: 10) | Pure JS, no native bindings |
| Payer | Always logged-in user | Simplifies data model |
| Currency | INR (₹) only | Single currency MVP |
| Group roles | All members equal | No admin complexity |
| New member visibility | Only after joined_at date | Fairness |
| Expense editing | Allowed | Realistic UX |
| Settlement | Lump-sum, recompute net | Simple and effective |
| Invite system | Shareable link with UUID token | No email infra needed |
| Unregistered invite | Redirect to Register, rejoin manually | Simple flow |
| Categories | 8 predefined with emoji | No custom categories needed |
| Notifications | In-app only | No email service needed |
| UI Theme | Light + Dark mode (system default) | Modern UX |
| Primary color | Purple (#7C3AED) | Premium feel |
| App name | Splitly | Clean, memorable |
| Branching | feature branch per feature, merge to main only when tested | Clean git history |

---

## 6. Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | React + Vite | React 18 |
| UI Components | Shadcn/ui | Latest |
| Styling | Tailwind CSS | v3 |
| Icons | Lucide React | Latest |
| HTTP Client | Axios | Latest |
| Real-time Client | Socket.IO Client | v4 |
| Routing | React Router | v6 |
| Backend | Node.js + Express | Node 18+ |
| Real-time Server | Socket.IO | v4 |
| ORM | Prisma | v5 |
| Database | PostgreSQL (Neon.tech) | Latest |
| Auth | JWT + bcryptjs | - |
| Deployment Backend | Render | - |
| Deployment Frontend | Vercel | - |
| Repo | Monorepo (GitHub) `/client` + `/server` | - |

---

## 7. Database Schema

```
users
  id (UUID PK), name, email (unique), password (bcrypt),
  avatar_url (nullable), created_at, updated_at

groups
  id (UUID PK), name, description, emoji (default '👥'),
  invite_token (unique UUID), created_by (FK users),
  created_at, updated_at

group_members
  id (UUID PK), group_id (FK), user_id (FK),
  joined_at — UNIQUE(group_id, user_id)

expenses
  id (UUID PK), group_id (FK nullable — null for direct expenses),
  description, amount (Decimal 10,2), category (default 'Other'),
  split_type (EQUAL|UNEQUAL|PERCENTAGE|SHARE),
  paid_by (FK users), created_by (FK users),
  created_at, updated_at

expense_splits
  id (UUID PK), expense_id (FK cascade), user_id (FK cascade),
  amount (Decimal 10,2), percentage (Decimal 5,2 nullable),
  share (Int nullable), created_at

settlements
  id (UUID PK), group_id (FK nullable), payer_id (FK users),
  payee_id (FK users), amount (Decimal 10,2), note (nullable),
  created_at

comments
  id (UUID PK), expense_id (FK cascade), user_id (FK nullable — null for system),
  message (Text), type ('user'|'system'), created_at

notifications
  id (UUID PK), user_id (FK cascade), type, title, body (nullable),
  link (nullable), is_read (Boolean default false), created_at

friendships
  id (UUID PK), user_id (FK), friend_id (FK),
  created_at — UNIQUE(user_id, friend_id)
```

---

## 8. Balance Calculation Logic

```
For a pair (A, B) within a group:
  owed_by_B_to_A = Σ expense_splits.amount WHERE expense.paid_by=A AND split.user_id=B
  owed_by_A_to_B = Σ expense_splits.amount WHERE expense.paid_by=B AND split.user_id=A
  settled_B_to_A = Σ settlements.amount WHERE payer=B AND payee=A
  settled_A_to_B = Σ settlements.amount WHERE payer=A AND payee=B

  net = (owed_by_B_to_A - settled_B_to_A) - (owed_by_A_to_B - settled_A_to_B)
  if net > 0: B owes A ₹net
  if net < 0: A owes B ₹|net|
```

---

## 9. API Routes

### Auth
```
POST   /api/auth/register    { name, email, password }
POST   /api/auth/login       { email, password }
GET    /api/auth/me          → current user
PUT    /api/auth/me          { name, avatarUrl }
```

### Users
```
GET    /api/users/search?q=  → search by name/email
```

### Groups
```
POST   /api/groups                      { name, description, emoji }
GET    /api/groups                      → my groups
GET    /api/groups/:id                  → group detail + members
PUT    /api/groups/:id                  { name, description, emoji }
DELETE /api/groups/:id
GET    /api/groups/:id/invite-link      → { inviteUrl }
POST   /api/groups/join/:token          → join group via invite token
DELETE /api/groups/:id/members/:userId  → remove member
```

### Expenses
```
POST   /api/expenses             { groupId?, description, amount, category, splitType, splits[] }
GET    /api/expenses?groupId=    → expenses list (filtered by joined_at)
GET    /api/expenses/:id         → expense detail + splits
PUT    /api/expenses/:id         { description, amount, category, splitType, splits[] }
DELETE /api/expenses/:id
```

### Balances
```
GET    /api/groups/:id/balances  → { netBalances[], directedDebts[] }
GET    /api/users/me/balances    → { totalOwed, totalOwedTo, breakdown[] }
```

### Settlements
```
POST   /api/settlements          { groupId?, payeeId, amount, note }
GET    /api/settlements?groupId= → list
```

### Comments
```
GET    /api/expenses/:id/comments   → paginated history
POST   /api/expenses/:id/comments   { message }
```

### Notifications
```
GET    /api/notifications           → my notifications
PUT    /api/notifications/read-all  → mark all read
PUT    /api/notifications/:id/read  → mark one read
```

### Friends
```
GET    /api/friends                 → my friends
POST   /api/friends                 { friendId }
GET    /api/friends/balances        → direct expense balances
```

### Socket.IO Events
```
Client → Server:
  join_expense   { expenseId }
  leave_expense  { expenseId }
  send_message   { expenseId, message }  [NOT USED — REST POST used instead]

Server → Client:
  new_message    { id, userId, userName, message, type, createdAt }
  notification   { type, title, body, link }
```

---

## 10. Frontend Structure

```
client/src/
  pages/
    Landing.jsx        ← public home
    Login.jsx
    Register.jsx
    Dashboard.jsx      ← balance summary + groups + friends
    GroupDetail.jsx    ← expense list + balances
    ExpenseDetail.jsx  ← splits + real-time chat
    SettleUp.jsx
    Profile.jsx
    JoinGroup.jsx      ← invite link landing
  components/
    Navbar.jsx
    GroupCard.jsx
    ExpenseCard.jsx
    BalanceSummary.jsx
    ChatBox.jsx
    NotificationBell.jsx
    SettleModal.jsx
    ThemeToggle.jsx
    SplitForm/
      SplitForm.jsx
      EqualSplit.jsx
      UnequalSplit.jsx
      PercentageSplit.jsx
      ShareSplit.jsx
  context/
    AuthContext.jsx
    ThemeContext.jsx
    SocketContext.jsx
  hooks/
    useAuth.js
    useSocket.js
    useNotifications.js
  lib/
    api.js             ← axios instance with auth header
    utils.js           ← formatCurrency, formatDate, getInitials
  App.jsx
  main.jsx
  index.css
```

---

## 11. Deployment Plan

| Service | Platform | Notes |
|---------|----------|-------|
| PostgreSQL | Neon.tech | Free, serverless, copy DATABASE_URL |
| Backend API | Render | Connect GitHub /server, auto-deploy |
| Frontend | Vercel | Connect GitHub /client, auto-deploy |

### Render Build Settings
- Root directory: `server`
- Build command: `npm install && npx prisma generate && npx prisma migrate deploy`
- Start command: `node src/index.js`
- Env vars: `DATABASE_URL`, `JWT_SECRET`, `CLIENT_URL`, `PORT`, `NODE_ENV`

### Vercel Settings
- Root directory: `client`
- Build command: `npm run build`
- Output: `dist`
- Env var: `VITE_API_URL`, `VITE_SOCKET_URL`

---

## 12. Environment Variables

### Server
```env
DATABASE_URL=postgresql://...@...neon.tech/splitly?sslmode=require
JWT_SECRET=change_this_to_random_string
PORT=5000
CLIENT_URL=https://splitly.vercel.app
NODE_ENV=production
```

### Client
```env
VITE_API_URL=https://splitly-api.onrender.com/api
VITE_SOCKET_URL=https://splitly-api.onrender.com
```

---

## 13. Trade-offs & Known Limitations

| Trade-off | Decision | Reason |
|-----------|----------|--------|
| Balance computation | Fresh on every request | Accuracy > performance |
| Avatar | Initials-based | No file upload complexity |
| Invite links | No expiry | Simpler for MVP |
| Auth storage | localStorage | Simpler than httpOnly cookie |
| Single currency | INR only | Scope limit |
| No debt simplification | Per-group raw debts | Reduces complexity |

---

## 14. Key Prompts & Interview Q&A

See `PROMPTS.md` for full prompt history.

Interview answers summary:
| # | Question | Answer |
|---|----------|--------|
| 1 | Primary users | Travel groups + roommates |
| 2 | Expense types | Group + direct one-on-one |
| 3 | New member visibility | Only after join date |
| 4 | Expense editing | Yes |
| 5 | Settlement | Lump-sum, recompute net |
| 6 | Auth | Email + password (JWT) |
| 7 | Profile update | Yes (name + avatar) |
| 8 | Group roles | All equal |
| 9 | Share split | Weight-based (2:1:1 = 50%:25%:25%) |
| 10 | Payer | Always logged-in user |
| 11 | Currency | INR only |
| 12 | Deployment | Render + Vercel + Neon.tech |
| 13 | Repo | Monorepo |
| 14 | PostgreSQL host | Neon.tech |
| 15 | Chat | Text + system messages |
| 16 | Dashboard | Totals + person breakdown |
| 17 | Group balances | Net + directed debts |
| 18 | Invite | Shareable link |
| 19 | Unregistered invite | Redirect to register, rejoin manually |
| 20 | Categories | 8 predefined with emoji |
| 21 | Filter/search | No |
| 22 | Notifications | In-app only |
| 23 | Theme | Light + Dark toggle |
| 24 | App name | Splitly |
| 25 | Primary color | Purple (#7C3AED) |

---

## 15. Changes During Implementation

| Date | Feature | Change | Reason |
|------|---------|--------|--------|
| Day 1 | Setup | Schema finalized | Interview complete |

---

## 16. Known Limitations

1. Balance computation O(n) per request — may slow with many expenses
2. JWT in localStorage — vulnerable to XSS (acceptable for internship scope)
3. No email verification on registration
4. Invite links never expire
5. Socket.IO not load-balanced (single server only)
