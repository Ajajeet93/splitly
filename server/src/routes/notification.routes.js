const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth.middleware');

// GET /api/notifications
router.get('/', authenticate, async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const unreadCount = notifications.filter(n => !n.isRead).length;
    res.json({ notifications, unreadCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// PUT /api/notifications/read-all
router.put('/read-all', authenticate, async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true },
    });
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', authenticate, async (req, res) => {
  try {
    await prisma.notification.update({
      where: { id: req.params.id },
      data: { isRead: true },
    });
    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

module.exports = router;
