import { Router, Response } from 'express';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { attendance, users } from '../../db/schema.ts';
import { authenticateToken, AuthRequest } from '../middleware/auth.ts';
import { validateBody, validateCoordinates } from '../middleware/validation.ts';

const router = Router();

// 1. CLOCK-IN API
router.post('/check-in', 
  authenticateToken, 
  validateBody(['lat', 'lng']), 
  validateCoordinates('lat', 'lng'),
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { lat, lng, address, device, network, battery, photo } = req.body;

      // Check if already checked in
      const activeShift = await db.query.attendance.findFirst({
        where: and(
          eq(attendance.userId, userId),
          eq(attendance.status, 'Active')
        )
      });

      if (activeShift) {
        return res.status(400).json({ error: 'Check-In failed.', message: 'You are already checked into an active shift.' });
      }

      const checkInTime = new Date();

      // Transaction to insert attendance and update user status
      await db.transaction(async (tx) => {
        // Create attendance record
        await tx.insert(attendance).values({
          userId,
          checkInTime,
          checkInLat: parseFloat(lat),
          checkInLng: parseFloat(lng),
          checkInAddress: address || 'Assigned Zone Office',
          checkInDevice: device || 'Android Smartphone - Field App',
          checkInNetwork: network || '5G',
          checkInBattery: battery ? parseInt(battery) : 100,
          checkInPhoto: photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=60',
          status: 'Active',
        });

        // Update user
        await tx.update(users)
          .set({
            status: 'checked-in',
            currentLat: parseFloat(lat),
            currentLng: parseFloat(lng),
            currentAddress: address || 'Assigned Zone Office',
            battery: battery ? parseInt(battery) : 100,
            network: network || '5G',
            speed: 0.0,
            distanceTravelledKm: 0.0,
            workingHours: 0.0,
            lastUpdate: checkInTime,
          })
          .where(eq(users.id, userId));
      });

      return res.json({
        success: true,
        message: 'Checked in successfully.',
        timestamp: checkInTime,
      });
    } catch (err: any) {
      console.error('Error during check-in:', err);
      return res.status(500).json({ error: 'Server Error', message: err.message });
    }
});

// 2. CLOCK-OUT API
router.post('/check-out', 
  authenticateToken, 
  validateBody(['signature']),
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { lat, lng, address, signature } = req.body;

      // Find the active shift
      const activeShift = await db.query.attendance.findFirst({
        where: and(
          eq(attendance.userId, userId),
          eq(attendance.status, 'Active')
        )
      });

      if (!activeShift) {
        return res.status(400).json({ error: 'Check-Out failed.', message: 'No active shift found to check out from.' });
      }

      const checkOutTime = new Date();
      
      // Calculate working hours
      const diffMs = checkOutTime.getTime() - activeShift.checkInTime.getTime();
      const workingHoursCalculated = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));

      await db.transaction(async (tx) => {
        // Update attendance record
        await tx.update(attendance)
          .set({
            checkOutTime,
            checkOutLat: lat ? parseFloat(lat) : null,
            checkOutLng: lng ? parseFloat(lng) : null,
            checkOutAddress: address || 'Zone Field Area',
            signature,
            workingHours: workingHoursCalculated,
            status: 'Completed',
          })
          .where(eq(attendance.id, activeShift.id));

        // Update user status
        await tx.update(users)
          .set({
            status: 'checked-out',
            speed: 0.0,
            network: 'Offline',
            workingHours: workingHoursCalculated,
            lastUpdate: checkOutTime,
          })
          .where(eq(users.id, userId));
      });

      return res.json({
        success: true,
        message: 'Checked out successfully.',
        workingHours: workingHoursCalculated,
        timestamp: checkOutTime,
      });
    } catch (err: any) {
      console.error('Error during check-out:', err);
      return res.status(500).json({ error: 'Server Error', message: err.message });
    }
});

// 3. GET CURRENT USER ATTENDANCE HISTORY
router.get('/history', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const logs = await db.query.attendance.findMany({
      where: eq(attendance.userId, userId),
      orderBy: [desc(attendance.checkInTime)],
      limit: 30,
    });

    return res.json({
      success: true,
      logs,
    });
  } catch (err: any) {
    console.error('Error fetching attendance history:', err);
    return res.status(500).json({ error: 'Server Error', message: err.message });
  }
});

// 4. GET ALL ATTENDANCE LOGS (For Admin/Supervisors)
router.get('/all', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const logs = await db.query.attendance.findMany({
      with: {
        user: true,
      },
      orderBy: [desc(attendance.checkInTime)],
      limit: 100,
    });

    return res.json({
      success: true,
      logs,
    });
  } catch (err: any) {
    console.error('Error fetching all attendance logs:', err);
    return res.status(500).json({ error: 'Server Error', message: err.message });
  }
});

export default router;
