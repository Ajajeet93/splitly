const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth.middleware');
const { createNotification } = require('../lib/notifications');
const { getIO } = require('../socket');

// POST /api/settlements
router.post('/', authenticate, async (req, res) => {
  try {
    const { groupId, payeeId, amount, note } = req.body;

    if (!payeeId || !amount)
      return res.status(400).json({ error: 'payeeId and amount are required' });

    if (payeeId === req.user.id)
      return res.status(400).json({ error: 'Cannot settle with yourself' });

    const settlement = await prisma.settlement.create({
      data: {
        groupId: groupId || null,
        payerId: req.user.id,
        payeeId,
        amount,
        note: note || null,
      },
      include: {
        payer: { select: { id: true, name: true } },
        payee: { select: { id: true, name: true } },
      },
    });

    // Notify payee
    await createNotification({
      userId: payeeId,
      type: 'settlement',
      title: 'Settlement recorded',
      body: `${req.user.name} paid you ₹${amount}${note ? ` — "${note}"` : ''}`,
      link: groupId ? `/groups/${groupId}` : `/dashboard`,
    });

    res.status(201).json({ settlement });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to record settlement' });
  }
});

// GET /api/settlements?groupId=
router.get('/', authenticate, async (req, res) => {
  try {
    const { groupId } = req.query;
    const where = groupId ? { groupId } : {
      OR: [{ payerId: req.user.id }, { payeeId: req.user.id }],
    };

    const settlements = await prisma.settlement.findMany({
      where,
      include: {
        payer: { select: { id: true, name: true, avatarUrl: true } },
        payee: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ settlements });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch settlements' });
  }
});

module.exports = router;
