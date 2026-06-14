const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { authenticate } = require('../middleware/auth.middleware');
const {
  generateAccessToken,
  generateRefreshToken,
  rotateRefreshToken,
  revokeAllRefreshTokens,
} = require('../lib/tokens');

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ error: 'Name, email and password are required' });

    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existing)
      return res.status(409).json({ error: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { name: name.trim(), email: email.toLowerCase().trim(), password: hashed },
      select: { id: true, name: true, email: true, avatarUrl: true, createdAt: true },
    });

    const accessToken = generateAccessToken(user.id);
    const refreshToken = await generateRefreshToken(user.id);

    res.status(201).json({ user, accessToken, refreshToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required' });

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user)
      return res.status(401).json({ error: 'Invalid email or password' });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ error: 'Invalid email or password' });

    const accessToken = generateAccessToken(user.id);
    const refreshToken = await generateRefreshToken(user.id);

    res.json({
      user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/refresh — exchange refresh token for new access + refresh token pair
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken)
      return res.status(400).json({ error: 'Refresh token is required' });

    const { userId, newRefreshToken } = await rotateRefreshToken(refreshToken);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, avatarUrl: true },
    });

    if (!user)
      return res.status(401).json({ error: 'User not found' });

    const accessToken = generateAccessToken(userId);

    res.json({ user, accessToken, refreshToken: newRefreshToken });
  } catch (err) {
    console.error('Refresh token error:', err.message);
    res.status(401).json({ error: err.message || 'Invalid refresh token' });
  }
});

// POST /api/auth/logout — revoke all refresh tokens for user
router.post('/logout', authenticate, async (req, res) => {
  try {
    await revokeAllRefreshTokens(req.user.id);
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  res.json({ user: req.user });
});

// PUT /api/auth/me — update profile
router.put('/me', authenticate, async (req, res) => {
  try {
    const { name, avatarUrl } = req.body;
    const data = {};
    if (name) data.name = name.trim();
    if (avatarUrl !== undefined) data.avatarUrl = avatarUrl;

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data,
      select: { id: true, name: true, email: true, avatarUrl: true },
    });

    res.json({ user: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;
