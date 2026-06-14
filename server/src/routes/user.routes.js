const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth.middleware');

// GET /api/users/search?q=
router.get('/search', authenticate, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2)
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });

    const users = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: req.user.id } },
          {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          },
        ],
      },
      select: { id: true, name: true, email: true, avatarUrl: true },
      take: 10,
    });

    res.json({ users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// GET /api/users/me/balances — dashboard balance summary
router.get('/me/balances', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all expenses where user is involved (as payer or split member)
    const expenseSplits = await prisma.expenseSplit.findMany({
      where: { userId },
      include: {
        expense: { select: { paidBy: true, groupId: true } },
      },
    });

    // Get all expenses paid by user
    const expensesPaid = await prisma.expense.findMany({
      where: { paidBy: userId },
      include: {
        splits: true,
      },
    });

    // Get all settlements
    const settlementsGiven = await prisma.settlement.findMany({
      where: { payerId: userId },
      select: { payeeId: true, amount: true },
    });
    const settlementsReceived = await prisma.settlement.findMany({
      where: { payeeId: userId },
      select: { payerId: true, amount: true },
    });

    // Compute net balance per person
    const balanceMap = {}; // personId -> net (positive = they owe me, negative = I owe them)

    // What others owe me (I paid, they are in splits)
    for (const expense of expensesPaid) {
      for (const split of expense.splits) {
        if (split.userId === userId) continue;
        balanceMap[split.userId] = (balanceMap[split.userId] || 0) + Number(split.amount);
      }
    }

    // What I owe others (they paid, I am in splits)
    for (const split of expenseSplits) {
      if (split.expense.paidBy === userId) continue;
      const payerId = split.expense.paidBy;
      balanceMap[payerId] = (balanceMap[payerId] || 0) - Number(split.amount);
    }

    // Adjust for settlements
    for (const s of settlementsGiven) {
      balanceMap[s.payeeId] = (balanceMap[s.payeeId] || 0) + Number(s.amount);
    }
    for (const s of settlementsReceived) {
      balanceMap[s.payerId] = (balanceMap[s.payerId] || 0) - Number(s.amount);
    }

    // Fetch user info for each person in balance map
    const personIds = Object.keys(balanceMap).filter(id => balanceMap[id] !== 0);
    const persons = await prisma.user.findMany({
      where: { id: { in: personIds } },
      select: { id: true, name: true, email: true, avatarUrl: true },
    });

    const personMap = Object.fromEntries(persons.map(p => [p.id, p]));

    const breakdown = personIds.map(id => ({
      user: personMap[id] || { id, name: 'Unknown' },
      net: parseFloat(balanceMap[id].toFixed(2)),
    }));

    const totalOwed = breakdown.filter(b => b.net < 0).reduce((sum, b) => sum + Math.abs(b.net), 0);
    const totalOwedTo = breakdown.filter(b => b.net > 0).reduce((sum, b) => sum + b.net, 0);

    res.json({
      totalOwed: parseFloat(totalOwed.toFixed(2)),
      totalOwedTo: parseFloat(totalOwedTo.toFixed(2)),
      breakdown,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch balances' });
  }
});

module.exports = router;
