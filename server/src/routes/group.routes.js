const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth.middleware');

// POST /api/groups — create group
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, description, emoji } = req.body;
    if (!name) return res.status(400).json({ error: 'Group name is required' });

    const group = await prisma.group.create({
      data: {
        name,
        description: description || null,
        emoji: emoji || '👥',
        inviteToken: uuidv4(),
        createdBy: req.user.id,
        members: {
          create: { userId: req.user.id },
        },
      },
      include: { members: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } } },
    });

    res.status(201).json({ group });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// GET /api/groups — my groups
router.get('/', authenticate, async (req, res) => {
  try {
    const memberships = await prisma.groupMember.findMany({
      where: { userId: req.user.id },
      include: {
        group: {
          include: {
            members: {
              include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
            },
            _count: { select: { expenses: true } },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    const groups = memberships.map(m => m.group);
    res.json({ groups });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

// GET /api/groups/:id — group detail
router.get('/:id', authenticate, async (req, res) => {
  try {
    const group = await prisma.group.findUnique({
      where: { id: req.params.id },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
          orderBy: { joinedAt: 'asc' },
        },
        creator: { select: { id: true, name: true } },
      },
    });

    if (!group) return res.status(404).json({ error: 'Group not found' });

    const isMember = group.members.some(m => m.userId === req.user.id);
    if (!isMember) return res.status(403).json({ error: 'Not a member of this group' });

    res.json({ group });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch group' });
  }
});

// PUT /api/groups/:id — update group
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { name, description, emoji } = req.body;
    const group = await prisma.group.findUnique({ where: { id: req.params.id }, include: { members: true } });
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const isMember = group.members.some(m => m.userId === req.user.id);
    if (!isMember) return res.status(403).json({ error: 'Not a member of this group' });

    const updated = await prisma.group.update({
      where: { id: req.params.id },
      data: { name: name || group.name, description, emoji: emoji || group.emoji },
    });

    res.json({ group: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update group' });
  }
});

// DELETE /api/groups/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const group = await prisma.group.findUnique({ where: { id: req.params.id }, include: { members: true } });
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const isMember = group.members.some(m => m.userId === req.user.id);
    if (!isMember) return res.status(403).json({ error: 'Not a member of this group' });

    await prisma.group.delete({ where: { id: req.params.id } });
    res.json({ message: 'Group deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

// GET /api/groups/:id/invite-link
router.get('/:id/invite-link', authenticate, async (req, res) => {
  try {
    const group = await prisma.group.findUnique({ where: { id: req.params.id }, include: { members: true } });
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const isMember = group.members.some(m => m.userId === req.user.id);
    if (!isMember) return res.status(403).json({ error: 'Not a member' });

    const baseUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    res.json({ inviteUrl: `${baseUrl}/join/${group.inviteToken}`, token: group.inviteToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get invite link' });
  }
});

// POST /api/groups/join/:token — join via invite link
router.post('/join/:token', authenticate, async (req, res) => {
  try {
    const group = await prisma.group.findUnique({
      where: { inviteToken: req.params.token },
      include: { members: true },
    });

    if (!group) return res.status(404).json({ error: 'Invalid invite link' });

    const alreadyMember = group.members.some(m => m.userId === req.user.id);
    if (alreadyMember) return res.status(409).json({ error: 'Already a member of this group' });

    await prisma.groupMember.create({
      data: { groupId: group.id, userId: req.user.id },
    });

    res.json({ message: `Joined group "${group.name}" successfully`, groupId: group.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to join group' });
  }
});

// DELETE /api/groups/:id/members/:userId — remove member
router.delete('/:id/members/:userId', authenticate, async (req, res) => {
  try {
    const group = await prisma.group.findUnique({ where: { id: req.params.id }, include: { members: true } });
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const isMember = group.members.some(m => m.userId === req.user.id);
    if (!isMember) return res.status(403).json({ error: 'Not a member' });

    await prisma.groupMember.deleteMany({
      where: { groupId: req.params.id, userId: req.params.userId },
    });

    res.json({ message: 'Member removed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// GET /api/groups/:id/balances
router.get('/:id/balances', authenticate, async (req, res) => {
  try {
    const groupId = req.params.id;

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
        expenses: { include: { splits: true } },
        settlements: true,
      },
    });

    if (!group) return res.status(404).json({ error: 'Group not found' });

    const isMember = group.members.some(m => m.userId === req.user.id);
    if (!isMember) return res.status(403).json({ error: 'Not a member' });

    const members = group.members.map(m => m.user);

    // Build net balance matrix: balanceMatrix[A][B] = B owes A (positive means B owes A)
    const balanceMatrix = {};
    members.forEach(a => {
      balanceMatrix[a.id] = {};
      members.forEach(b => { balanceMatrix[a.id][b.id] = 0; });
    });

    for (const expense of group.expenses) {
      for (const split of expense.splits) {
        if (split.userId === expense.paidBy) continue;
        // split.userId owes expense.paidBy the split amount
        if (balanceMatrix[expense.paidBy] && balanceMatrix[expense.paidBy][split.userId] !== undefined) {
          balanceMatrix[expense.paidBy][split.userId] += Number(split.amount);
        }
      }
    }

    for (const settlement of group.settlements) {
      // payer paid payee → payee's debt to payer decreases
      if (balanceMatrix[settlement.payeeId] && balanceMatrix[settlement.payeeId][settlement.payerId] !== undefined) {
        balanceMatrix[settlement.payeeId][settlement.payerId] -= Number(settlement.amount);
      }
    }

    // Build directed debts list
    const directedDebts = [];
    const netBalances = {};
    members.forEach(m => { netBalances[m.id] = 0; });

    members.forEach(creditor => {
      members.forEach(debtor => {
        if (creditor.id === debtor.id) return;
        const net = balanceMatrix[creditor.id][debtor.id] - (balanceMatrix[debtor.id]?.[creditor.id] || 0);
        if (net > 0.01) {
          directedDebts.push({
            from: debtor,
            to: creditor,
            amount: parseFloat(net.toFixed(2)),
          });
          netBalances[debtor.id] -= net;
          netBalances[creditor.id] += net;
        }
      });
    });

    const netBalancesList = members.map(m => ({
      user: m,
      net: parseFloat((netBalances[m.id] || 0).toFixed(2)),
    }));

    res.json({ netBalances: netBalancesList, directedDebts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch balances' });
  }
});

module.exports = router;
