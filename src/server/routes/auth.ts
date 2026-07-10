import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { users } from '../../db/schema.ts';
import { authenticateToken, AuthRequest } from '../middleware/auth.ts';
import { validateBody } from '../middleware/validation.ts';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-in-production';

// 1. REGISTER NEW USER (Admin or Zone Manager)
router.post('/register', validateBody(['empId', 'name', 'password', 'role']), async (req, res) => {
  try {
    const { empId, name, email, phone, password, role, zoneId } = req.body;

    // Check if employee ID already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.empId, empId),
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User registration failed.', message: 'Employee ID already registered.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const uid = `custom-uid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const [newUser] = await db.insert(users).values({
      uid,
      empId,
      name,
      email: email || null,
      phone: phone || null,
      passwordHash,
      role: role || 'zone-manager',
      zoneId: zoneId ? parseInt(zoneId) : null,
      status: 'checked-out',
    }).returning();

    return res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      user: {
        id: newUser.id,
        empId: newUser.empId,
        name: newUser.name,
        role: newUser.role,
        zoneId: newUser.zoneId,
      },
    });
  } catch (err: any) {
    console.error('Error in /register:', err);
    return res.status(500).json({ error: 'Server Error', message: err.message });
  }
});

// 2. LOGIN USER
router.post('/login', validateBody(['empId', 'password']), async (req, res) => {
  try {
    const { empId, password } = req.body;

    const user = await db.query.users.findFirst({
      where: eq(users.empId, empId),
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Authentication failed.', message: 'Invalid Employee ID or Password.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Authentication failed.', message: 'Invalid Employee ID or Password.' });
    }

    // Sign JWT
    const token = jwt.sign(
      {
        id: user.id,
        uid: user.uid,
        empId: user.empId,
        name: user.name,
        role: user.role,
        zoneId: user.zoneId,
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        empId: user.empId,
        name: user.name,
        role: user.role,
        zoneId: user.zoneId,
        status: user.status,
      },
    });
  } catch (err: any) {
    console.error('Error in /login:', err);
    return res.status(500).json({ error: 'Server Error', message: err.message });
  }
});

// 3. GET CURRENT LOGGED IN USER PROFILE (JWT Auth)
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, req.user.id),
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    return res.json({
      success: true,
      user: {
        id: user.id,
        uid: user.uid,
        empId: user.empId,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        zoneId: user.zoneId,
        status: user.status,
        battery: user.battery,
        network: user.network,
        speed: user.speed,
        currentLat: user.currentLat,
        currentLng: user.currentLng,
        currentAddress: user.currentAddress,
        distanceTravelledKm: user.distanceTravelledKm,
        workingHours: user.workingHours,
        lastUpdate: user.lastUpdate,
      },
    });
  } catch (err: any) {
    console.error('Error in /me:', err);
    return res.status(500).json({ error: 'Server Error', message: err.message });
  }
});

export default router;
