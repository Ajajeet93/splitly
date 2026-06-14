const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const groupRoutes = require('./routes/group.routes');
const expenseRoutes = require('./routes/expense.routes');
const settlementRoutes = require('./routes/settlement.routes');
const commentRoutes = require('./routes/comment.routes');
const notificationRoutes = require('./routes/notification.routes');
const friendRoutes = require('./routes/friend.routes');

const app = express();

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', app: 'Splitly API', version: '1.0.0' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/settlements', settlementRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/friends', friendRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

module.exports = app;
