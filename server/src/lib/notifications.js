const prisma = require('./prisma');

/**
 * Create an in-app notification
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} params.type
 * @param {string} params.title
 * @param {string} [params.body]
 * @param {string} [params.link]
 */
async function createNotification({ userId, type, title, body, link }) {
  try {
    return await prisma.notification.create({
      data: { userId, type, title, body: body || null, link: link || null },
    });
  } catch (err) {
    console.error('Failed to create notification:', err.message);
  }
}

module.exports = { createNotification };
