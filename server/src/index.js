require('dotenv').config();
const app = require('./app');
const { createServer } = require('http');
const { initSocket } = require('./socket');

const PORT = process.env.PORT || 5000;

const httpServer = createServer(app);
initSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`🚀 Splitly server running on port ${PORT}`);
  console.log(`📦 Environment: ${process.env.NODE_ENV}`);
});
