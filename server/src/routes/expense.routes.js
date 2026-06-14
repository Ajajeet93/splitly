const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth.middleware');
const { getIO } = require('../socket');
const { createNotification } = require('../lib/notifications');

// Helper: compute split amounts from type
function computeSplits(amount, splitType, splits) {
  const total = Number(amount);
  switch (splitType) {
    case 'EQUAL': {
      const each = parseFloat((total / splits.length).toFixed(2));
      const remainder = parseFloat((total - each * splits.length).toFixed(2));
      return splits.map((s, i) => ({
        userId: s.userId,
        amount: i === 0 ? each + remainder : each,
      }));
    }
    case 'UNEQUAL': {
      const sum = splits.reduce((acc, s) => acc + Number(s.amount), 0);
      if (Math.abs(sum - total) > 0.01)
        throw new Error(`Unequal amounts must sum to ₹${total}`);
      return splits.map(s => ({ userId: s.userId, amount: Number(s.amount) }));
    }
    case 'PERCENTAGE': {
      const pctSum = splits.reduce((acc, s) => acc + Number(s.percentage), 0);
      if (Math.abs(pctSum - 100) > 0.01)
        throw new Error('Percentages must sum to 100%');
      return splits.map(s => ({
        userId: s.userId,
        amount: parseFloat(((Number(s.percentage) / 100) * total).toFixed(2)),
        percentage: Number(s.percentage),
      }));
    }
    case 'SHARE': {
      const totalShares = splits.reduce((acc, s) => acc + Number(s.share), 0);
      return splits.map(s => ({
        userId: s.userId,
        amount: parseFloat(((Number(s.share) / totalShares) * total).toFixed(2)),
        share: Number(s.share),
      }));
    }
    default:
      throw new Error('Invalid split type');
  }
}

// POST /api/expenses
router.post('/', authenticate, async (req, res) => {
  try {
    const { groupId, description, amount, category, splitType, splits } = req.body;

    if (!description || !amount || !splitType || !splits || splits.length === 0)
      return res.status(400).json({ error: 'description, amount, splitType, and splits are required' });

    let computedSplits;
    try {
      computedSplits = computeSplits(amount, splitType, splits);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }

    const expense = await prisma.expense.create({
      data: {
        groupId: groupId || null,
        description,
        amount,
        category: category || 'Other',
        splitType,
        paidBy: req.user.id,
        createdBy: req.user.id,
        splits: { create: computedSplits },
      },
      include: {
        splits: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
        payer: { select: { id: true, name: true } },
      },
    });

    // System message in chat
    try {
      await prisma.comment.create({
        data: {
          expenseId: expense.id,
          message: `${req.user.name} added expense "${description}" for ₹${amount}`,
          type: 'system',
        },
      });
      getIO().to(`expense:${expense.id}`).emit('new_message', {
        type: 'system',
        message: `${req.user.name} added expense "${description}" for ₹${amount}`,
        createdAt: new Date(),
      });
    } catch (_) {}

    // Notify group members
    if (groupId) {
      try {
        const members = await prisma.groupMember.findMany({ where: { groupId } });
        for (const m of members) {
          if (m.userId === req.user.id) continue;
          await createNotification({
            userId: m.userId,
            type: 'expense_added',
            title: `New expense in group`,
            body: `${req.user.name} added "${description}" for ₹${amount}`,
            link: `/expenses/${expense.id}`,
          });
        }
      } catch (_) {}
    }

    res.status(201).json({ expense });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

// GET /api/expenses?groupId=
router.get('/', authenticate, async (req, res) => {
  try {
    const { groupId } = req.query;

    if (!groupId) return res.status(400).json({ error: 'groupId is required' });

    // Get member's joined_at for this group
    const membership = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: req.user.id } },
    });

    if (!membership) return res.status(403).json({ error: 'Not a member of this group' });

    const expenses = await prisma.expense.findMany({
      where: {
        groupId,
        createdAt: { gte: membership.joinedAt },
      },
      include: {
        payer: { select: { id: true, name: true, avatarUrl: true } },
        splits: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
        _count: { select: { comments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ expenses });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

// GET /api/expenses/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const expense = await prisma.expense.findUnique({
      where: { id: req.params.id },
      include: {
        payer: { select: { id: true, name: true, avatarUrl: true } },
        creator: { select: { id: true, name: true } },
        splits: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
        group: { select: { id: true, name: true, emoji: true } },
      },
    });

    if (!expense) return res.status(404).json({ error: 'Expense not found' });

    // Check user has access (is in splits or is payer)
    const hasAccess = expense.paidBy === req.user.id || expense.splits.some(s => s.userId === req.user.id);
    if (!hasAccess) return res.status(403).json({ error: 'Access denied' });

    res.json({ expense });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch expense' });
  }
});

// PUT /api/expenses/:id
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { description, amount, category, splitType, splits } = req.body;
    const existing = await prisma.expense.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Expense not found' });
    if (existing.createdBy !== req.user.id)
      return res.status(403).json({ error: 'Only the creator can edit this expense' });

    let computedSplits;
    if (splits && splits.length > 0) {
      try {
        computedSplits = computeSplits(amount || existing.amount, splitType || existing.splitType, splits);
      } catch (e) {
        return res.status(400).json({ error: e.message });
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (computedSplits) {
        await tx.expenseSplit.deleteMany({ where: { expenseId: req.params.id } });
        await tx.expenseSplit.createMany({ data: computedSplits.map(s => ({ ...s, expenseId: req.params.id })) });
      }

      return tx.expense.update({
        where: { id: req.params.id },
        data: {
          description: description || existing.description,
          amount: amount || existing.amount,
          category: category || existing.category,
          splitType: splitType || existing.splitType,
        },
        include: {
          splits: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
          payer: { select: { id: true, name: true } },
        },
      });
    });

    // System message
    try {
      await prisma.comment.create({
        data: {
          expenseId: req.params.id,
          message: `${req.user.name} edited this expense`,
          type: 'system',
        },
      });
      getIO().to(`expense:${req.params.id}`).emit('new_message', {
        type: 'system',
        message: `${req.user.name} edited this expense`,
        createdAt: new Date(),
      });
    } catch (_) {}

    res.json({ expense: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update expense' });
  }
});

// DELETE /api/expenses/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const existing = await prisma.expense.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Expense not found' });
    if (existing.createdBy !== req.user.id)
      return res.status(403).json({ error: 'Only the creator can delete this expense' });

    await prisma.expense.delete({ where: { id: req.params.id } });
    res.json({ message: 'Expense deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

module.exports = router;
