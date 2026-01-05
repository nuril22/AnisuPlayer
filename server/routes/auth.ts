import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

const router = Router();

// Get credentials from environment - these are loaded dynamically
const getCredentials = () => ({
  JWT_SECRET: process.env.JWT_SECRET || 'anisuplayer_default_secret',
  ADMIN_USERNAME: process.env.ADMIN_USERNAME || 'admin',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'admin123'
});

// Login endpoint
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    const { JWT_SECRET, ADMIN_USERNAME, ADMIN_PASSWORD } = getCredentials();

    console.log('Login attempt:', { username, expectedUsername: ADMIN_USERNAME });

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    // Check credentials
    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      console.log('Invalid credentials:', { 
        usernameMatch: username === ADMIN_USERNAME, 
        passwordMatch: password === ADMIN_PASSWORD 
      });
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Generate JWT token
    const token = jwt.sign(
      { username, role: 'admin' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Set cookie
    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    res.json({ success: true, message: 'Login successful' });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout endpoint
router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('auth_token');
  res.json({ success: true, message: 'Logout successful' });
});

// Verify token endpoint
router.get('/verify', (req: Request, res: Response) => {
  const token = req.cookies.auth_token;
  const { JWT_SECRET } = getCredentials();

  if (!token) {
    res.status(401).json({ authenticated: false });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ authenticated: true, user: decoded });
  } catch (error) {
    res.status(401).json({ authenticated: false });
  }
});

export default router;
