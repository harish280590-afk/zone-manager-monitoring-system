import { Router, Response } from 'express';
import { eq, and, gte, sql } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { users, tasks, activities, attendance } from '../../db/schema.ts';
import { authenticateToken, AuthRequest } from '../middleware/auth.ts';

const router = Router();

// 1. GET CENTRAL SUPERVISOR ANALYTICS & METRICS
router.get('/stats', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // 1. Total managers vs Active checked-in
    const allUsers = await db.query.users.findMany({
      where: eq(users.role, 'zone-manager'),
    });

    const totalManagers = allUsers.length;
    const activeCheckedIn = allUsers.filter(u => u.status === 'checked-in').length;
    const lowBatteryCount = allUsers.filter(u => u.status === 'checked-in' && u.battery !== null && u.battery < 25).length;
    const weakNetworkCount = allUsers.filter(u => u.status === 'checked-in' && (u.network === 'Offline' || u.network === '3G' || u.network === 'No Signal')).length;

    // 2. Task compliance
    const allTasks = await db.query.tasks.findMany();
    const pendingTasks = allTasks.filter(t => t.status !== 'Completed').length;
    const completedTasks = allTasks.filter(t => t.status === 'Completed').length;

    // 3. Sanitation activity count logged today
    const activitiesToday = await db.query.activities.findMany({
      where: gte(activities.timestamp, todayStart)
    });

    const totalActivitiesToday = activitiesToday.length;

    // 4. Calculate total distance covered today by active field force
    const totalDistanceCoveredToday = allUsers
      .filter(u => u.status === 'checked-in')
      .reduce((sum, u) => sum + (u.distanceTravelledKm || 0.0), 0.0);

    return res.json({
      success: true,
      stats: {
        totalManagers,
        activeCheckedIn,
        inactiveOrCheckedOut: totalManagers - activeCheckedIn,
        pendingTasks,
        completedTasks,
        totalActivitiesToday,
        totalDistanceCoveredToday: parseFloat(totalDistanceCoveredToday.toFixed(2)),
        lowBatteryAlerts: lowBatteryCount,
        weakNetworkAlerts: weakNetworkCount,
      }
    });
  } catch (err: any) {
    console.error('Error fetching dashboard stats:', err);
    return res.status(500).json({ error: 'Server Error', message: err.message });
  }
});

// 2. GET CURRENT GEO-LOCATIONS & STATUSES FOR ALL FIELD MANAGERS (For Maps)
router.get('/managers', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const managers = await db.query.users.findMany({
      where: eq(users.role, 'zone-manager'),
      with: {
        zone: true,
      },
    });

    // Format fields cleanly
    const formatted = managers.map(m => ({
      id: m.id,
      empId: m.empId,
      name: m.name,
      phone: m.phone,
      email: m.email,
      status: m.status,
      battery: m.battery,
      network: m.network,
      speed: m.speed,
      currentLat: m.currentLat,
      currentLng: m.currentLng,
      currentAddress: m.currentAddress,
      distanceTravelledKm: m.distanceTravelledKm,
      workingHours: m.workingHours,
      lastUpdate: m.lastUpdate,
      zoneName: m.zone?.name || 'Unassigned',
    }));

    return res.json({
      success: true,
      managers: formatted,
    });
  } catch (err: any) {
    console.error('Error listing manager locations:', err);
    return res.status(500).json({ error: 'Server Error', message: err.message });
  }
});

export default router;
