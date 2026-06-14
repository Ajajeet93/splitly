const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth.middleware');
const { getIO } = require('../socket');

// GET /api/expenses/:id/comments
router.get('/:id/comments', authenticate, async (req, res) => {
  try {
    const comments = await prisma.comment.findMany({
      where: { expenseId: req.params.id },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ comments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// POST /api/expenses/:id/comments
router.post('/:id/comments', authenticate, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim())
      return res.status(400).json({ error: 'Message is required' });

    const comment = await prisma.comment.create({
      data: {
        expenseId: req.params.id,
        userId: req.user.id,
        message: message.trim(),
        type: 'user',
      },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    // Emit real-time to expense room
    getIO().to(`expense:${req.params.id}`).emit('new_message', {
      id: comment.id,
      userId: comment.userId,
      userName: req.user.name,
      userAvatar: req.user.avatarUrl,
      message: comment.message,
      type: 'user',
      createdAt: comment.createdAt,
    });

    res.status(201).json({ comment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to post comment' });
  }
});

module.exports = router;
