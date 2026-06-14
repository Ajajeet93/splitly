# BUILD_PLAN.md — Splitly

## 1. Product Research

### How I Studied Splitwise
- Analyzed Splitwise's core user flows: group creation, expense splitting, balance tracking, and settlements
- Identified primary pain points: tracking informal debts without constant mental math
- Studied the 4 split types (equal, unequal, percentage, share) to understand the data model requirements
- Identified two primary personas: travel groups and roommates

### What I Learned
- The core value is **balance transparency** — users want to know who owes what at a glance
- Groups are the primary organizational unit, but one-on-one debts also matter
- Real-time chat makes expenses feel collaborative, not just transactional
- Settlement is always a manual record — no actual payment processing needed
- New member visibility (from join date) is critical for fairness

### Key Workflows Identified
1. Register → Create Group → Invite via link → Add Expenses → View Balances → Settle Up
2. Register → Add Friend directly → Add Direct Expense → Settle
3. Open Expense → Real-time chat (text + system activity messages)

### Product Assumptions Made
- Users trust each other (no dispute resolution needed)
- Expenses are always paid in full by one person
- Settlements are recorded manually (no payment gateway)
- A user can be in multiple groups simultaneously
- Group member can see only expenses after their join date

---

## 2. Architecture

### Tech Stack
| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | React + Vite | React 18 |
| UI | Shadcn/ui + Tailwind CSS | v3 |
| Icons | Lucide React | Latest |
| HTTP | Axios | Latest |
| Real-time | Socket.IO Client | v4 |
| Routing | React Router | v6 |
| Backend | Node.js + Express | Node 18+ |
| ORM | Prisma | v5 |
| Database | PostgreSQL (Neon.tech) | Latest |
| Auth | JWT + bcryptjs | - |
| Deployment Backend | Render | - |
| Deployment Frontend | Vercel | - |

### Database Schema Summary
- **users**: auth + profile (bcrypt password, optional avatar_url)
- **groups**: metadata + unique invite_token (UUID)
- **group_members**: many-to-many with joined_at timestamp
- **expenses**: core expense with split_type, paid_by, created_by
- **expense_splits**: per-user computed amounts (amount, percentage, share)
- **settlements**: lump-sum payment records between two users
- **comments**: expense chat — user messages + system event messages
- **notifications**: in-app notification feed
- **friendships**: bidirectional friend links for direct expenses

### Balance Calculation Algorithm
```
For pair (A, B):
  owed_by_B_to_A = Σ splits.amount WHERE expense.paid_by=A AND split.user=B
  owed_by_A_to_B = Σ splits.amount WHERE expense.paid_by=B AND split.user=A
  settled_B_to_A = Σ settlements.amount WHERE payer=B AND payee=A
  settled_A_to_B = Σ settlements.amount WHERE payer=A AND payee=B

  net = (owed_by_B_to_A - settled_B_to_A) - (owed_by_A_to_B - settled_A_to_B)
  if net > 0: B owes A
  if net < 0: A owes B
```

### API Design
- REST API on Express, all routes under `/api`
- JWT Bearer token authentication (middleware on all protected routes)
- Socket.IO for real-time expense chat (room per expense: `expense:{id}`)
- System messages auto-posted on expense create/edit/settlement

### Frontend Structure
```
client/src/
  pages/        → route-level components (Landing, Login, Register, Dashboard, etc.)
  components/   → reusable UI (Navbar, SplitForm, ChatBox, etc.)
  context/      → React Context (Auth, Theme, Socket)
  hooks/        → custom hooks (useAuth, useSocket, useNotifications)
  lib/          → axios instance, utility functions
```

### Deployment Approach
- **Monorepo**: one GitHub repo with `/client` and `/server`
- **Render**: backend (Node.js), auto-deploy on push to main, root dir = `server`
- **Neon.tech**: free PostgreSQL, copy DATABASE_URL to Render env vars
- **Vercel**: frontend (React), auto-deploy on push to main, root dir = `client`

---

## 3. AI Collaboration Process

### Tool Used
**Antigravity (Google DeepMind)** — primary development collaborator

### How I Instructed the AI
1. Pasted the Required Initial Prompt from the assignment
2. When the AI listed all questions at once, I instructed: "ask question one by one"
3. Answered each question concisely (single word or short phrase)
4. AI documented every decision in AI_CONTEXT.md after each answer
5. After interview complete, approved the build plan
6. Instructed: feature-by-feature, test before commit, feature branches only

### Questions the AI Asked (25 Total)
1. Primary user personas → Travel groups + roommates
2. Group vs direct expenses → Both
3. New member expense visibility → Only after join date
4. Expense editing → Yes
5. Settlement mechanism → Lump-sum, recompute net
6. Auth method → Email + password, JWT
7. Profile update → Yes (name + avatar)
8. Group roles → All members equal
9. Share split formula → Weight-based (2:1:1 = 50%:25%:25%)
10. Who can be payer → Only logged-in user
11. Currency → INR only
12. Deployment platform → Render + Vercel
13. Repo structure → Monorepo
14. PostgreSQL hosting → Neon.tech (free, no expiry)
15. Chat content → Text + system messages
16. Dashboard balance display → Totals + person breakdown
17. Group balance display → Net per member + directed debts
18. Group invite → Shareable link (UUID token)
19. Unregistered invite click → Redirect to Register, rejoin manually
20. Expense categories → 8 predefined with emoji
21. Filter/search → No
22. Notifications → In-app only (bell icon)
23. UI theme → Light + Dark mode toggle
24. App name → Splitly
25. Primary color → Purple (#7C3AED)

### How the Plan Evolved
- Q2 added direct (non-group) expenses → required friendships table
- Q15 added system messages → same comments table, type='system'
- Q19 simplified invite flow → no auto-join after registration
- Q22 required notifications table and in-app bell
- Q25 locked design: Purple theme (#7C3AED)

### How AI_CONTEXT.md Was Maintained
- Created after interview complete with all 25 decisions documented
- Updated after every feature that changes schema, API, or UI decisions
- Serves as the single source of truth — buildable by another dev or AI

### Git Strategy
- `main` branch: stable, production-ready only
- `feature/fN-name` branches: one per feature
- Merge to main only after feature is fully tested
- Clean git log: one commit per feature

---

## 4. Tradeoffs

### What I Simplified
- Balance computation: fresh on every API request (no Redis caching)
- Avatar: initials-based by default (no file upload / S3)
- Invite links: no expiry (permanent until group deleted)
- No debt simplification algorithm across group members

### What I Hardcoded
- Currency: INR (₹) throughout
- 8 expense categories (no custom user-defined categories)
- JWT expiry: 7 days
- bcrypt salt rounds: 10

### What I Avoided
- Google OAuth / social login
- Email notifications / SMTP
- File attachments on expenses
- Payment gateway integration
- Mobile native app
- Multi-currency with exchange rates
- Advanced Splitwise-style debt simplification

### What I Would Improve With More Time
1. Debt simplification algorithm (minimize number of transactions in a group)
2. Redis caching for balance computation
3. Email notifications via SendGrid/Resend
4. Google OAuth
5. Expense receipt image upload (AWS S3)
6. Export expenses as CSV/PDF
7. Multi-currency support with exchange rates
8. Recurring expense templates (monthly rent)
9. Group activity log/timeline
10. PWA with push notifications
