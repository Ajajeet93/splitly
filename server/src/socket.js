const { Server } = require('socket.io');

let io;

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // Join an expense room to get real-time chat
    socket.on('join_expense', ({ expenseId }) => {
      socket.join(`expense:${expenseId}`);
      console.log(`Socket ${socket.id} joined expense:${expenseId}`);
    });

    // Leave expense room
    socket.on('leave_expense', ({ expenseId }) => {
      socket.leave(`expense:${expenseId}`);
    });

    socket.on('disconnect', () => {
      console.log(`❌ Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
};

module.exports = { initSocket, getIO };
