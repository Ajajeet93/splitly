const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth.middleware');

// GET /api/friends
router.get('/', authenticate, async (req, res) => {
  try {
    const friendships = await prisma.friendship.findMany({
      where: { userId: req.user.id },
      include: { friend: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    });
    const friends = friendships.map(f => f.friend);
    res.json({ friends });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch friends' });
  }
});

// POST /api/friends
router.post('/', authenticate, async (req, res) => {
  try {
    const { friendId } = req.body;
    if (!friendId) return res.status(400).json({ error: 'friendId is required' });
    if (friendId === req.user.id) return res.status(400).json({ error: 'Cannot add yourself' });

    const existing = await prisma.friendship.findUnique({
      where: { userId_friendId: { userId: req.user.id, friendId } },
    });
    if (existing) return res.status(409).json({ error: 'Already friends' });

    await prisma.$transaction([
      prisma.friendship.create({ data: { userId: req.user.id, friendId } }),
      prisma.friendship.create({ data: { userId: friendId, friendId: req.user.id } }),
    ]);

    const friend = await prisma.user.findUnique({
      where: { id: friendId },
      select: { id: true, name: true, email: true, avatarUrl: true },
    });

    res.status(201).json({ friend });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add friend' });
  }
});

// GET /api/friends/balances
router.get('/balances', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    // Direct expenses (groupId is null)
    const directExpensesPaid = await prisma.expense.findMany({
      where: { paidBy: userId, groupId: null },
      include: { splits: true },
    });

    const directSplits = await prisma.expenseSplit.findMany({
      where: { userId, expense: { groupId: null } },
      include: { expense: { select: { paidBy: true } } },
    });

    const settlements = await prisma.settlement.findMany({
      where: {
        groupId: null,
        OR: [{ payerId: userId }, { payeeId: userId }],
      },
    });

    const balanceMap = {};

    for (const expense of directExpensesPaid) {
      for (const split of expense.splits) {
        if (split.userId === userId) continue;
        balanceMap[split.userId] = (balanceMap[split.userId] || 0) + Number(split.amount);
      }
    }

    for (const split of directSplits) {
      if (split.expense.paidBy === userId) continue;
      balanceMap[split.expense.paidBy] = (balanceMap[split.expense.paidBy] || 0) - Number(split.amount);
    }

    for (const s of settlements) {
      if (s.payerId === userId) {
        balanceMap[s.payeeId] = (balanceMap[s.payeeId] || 0) + Number(s.amount);
      } else {
        balanceMap[s.payerId] = (balanceMap[s.payerId] || 0) - Number(s.amount);
      }
    }

    const personIds = Object.keys(balanceMap);
    const persons = await prisma.user.findMany({
      where: { id: { in: personIds } },
      select: { id: true, name: true, avatarUrl: true },
    });
    const personMap = Object.fromEntries(persons.map(p => [p.id, p]));

    const breakdown = personIds.map(id => ({
      user: personMap[id] || { id, name: 'Unknown' },
      net: parseFloat((balanceMap[id] || 0).toFixed(2)),
    }));

    res.json({ breakdown });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch friend balances' });
  }
});

module.exports = router;
