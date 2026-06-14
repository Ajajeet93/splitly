const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../lib/prisma');

const ACCESS_TOKEN_EXPIRY = '15m';   // 15 minutes
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

/**
 * Generate a short-lived access token (15 min)
 */
function generateAccessToken(userId) {
  return jwt.sign(
    { userId, type: 'access' },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

/**
 * Generate a long-lived refresh token (UUID stored in DB, 7 days)
 */
async function generateRefreshToken(userId) {
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);

  await prisma.refreshToken.create({
    data: { userId, token, expiresAt },
  });

  return token;
}

/**
 * Verify access token — returns decoded payload or throws
 */
function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
}

/**
 * Rotate refresh token: validate → delete old → issue new
 * Returns { userId, newRefreshToken }
 */
async function rotateRefreshToken(oldToken) {
  const record = await prisma.refreshToken.findUnique({ where: { token: oldToken } });

  if (!record) throw new Error('Invalid refresh token');
  if (record.expiresAt < new Date()) {
    await prisma.refreshToken.delete({ where: { token: oldToken } });
    throw new Error('Refresh token expired');
  }

  // Delete used token (rotation — one-time use)
  await prisma.refreshToken.delete({ where: { token: oldToken } });

  const newRefreshToken = await generateRefreshToken(record.userId);
  return { userId: record.userId, newRefreshToken };
}

/**
 * Revoke all refresh tokens for a user (logout)
 */
async function revokeAllRefreshTokens(userId) {
  await prisma.refreshToken.deleteMany({ where: { userId } });
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  rotateRefreshToken,
  revokeAllRefreshTokens,
};
