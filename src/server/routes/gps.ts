import { Router, Response } from 'express';
import { eq, desc, and } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { gpsHistory, users } from '../../db/schema.ts';
import { authenticateToken, AuthRequest } from '../middleware/auth.ts';
import { validateBody, validateCoordinates } from '../middleware/validation.ts';

const router = Router();

// Helper function to calculate distance in KM between two lat/lng points (Haversine formula)
function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; // Distance in km
  return d;
}

// 1. RECEIVE GPS BREADCRUMB (Ping API)
router.post('/ping', 
  authenticateToken, 
  validateBody(['latitude', 'longitude']), 
  validateCoordinates('latitude', 'longitude'),
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { latitude, longitude, speed, battery, network, address } = req.body;
      const latNum = parseFloat(latitude);
      const lngNum = parseFloat(longitude);
      const speedNum = speed ? parseFloat(speed) : 0.0;
      const batteryNum = battery ? parseInt(battery) : 100;
      const now = new Date();

      // Retrieve previous location to calculate incremental distance travelled
      const currentUser = await db.query.users.findFirst({
        where: eq(users.id, userId)
      });

      let distanceIncrement = 0.0;
      if (currentUser && currentUser.currentLat && currentUser.currentLng) {
        distanceIncrement = getDistanceKm(
          currentUser.currentLat, 
          currentUser.currentLng, 
          latNum, 
          lngNum
        );
        // Clean up outliers (e.g. if jump is greater than 100km, ignore it as bad GPS spike)
        if (distanceIncrement > 100) {
          distanceIncrement = 0.0;
        }
      }

      const updatedDistance = parseFloat(((currentUser?.distanceTravelledKm || 0.0) + distanceIncrement).toFixed(2));

      await db.transaction(async (tx) => {
        // 1. Insert history row
        await tx.insert(gpsHistory).values({
          userId,
          latitude: latNum,
          longitude: lngNum,
          speed: speedNum,
          battery: batteryNum,
          network: network || '5G',
          address: address || null,
          timestamp: now
        });

        // 2. Update current position in users table
        await tx.update(users)
          .set({
            currentLat: latNum,
            currentLng: lngNum,
            currentAddress: address || currentUser?.currentAddress || 'Field Tracking Location',
            battery: batteryNum,
            network: network || '5G',
            speed: speedNum,
            distanceTravelledKm: updatedDistance,
            lastUpdate: now
          })
          .where(eq(users.id, userId));
      });

      return res.json({
        success: true,
        message: 'GPS breadcrumb recorded successfully.',
        distanceTravelledToday: updatedDistance,
        timestamp: now
      });
    } catch (err: any) {
      console.error('Error in GPS ping API:', err);
      return res.status(500).json({ error: 'Server Error', message: err.message });
    }
});

// 2. GET GPS PATH HISTORY FOR A MANAGER (For Mapping)
router.get('/history/:userId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const targetUserId = parseInt(req.params.userId);

    const history = await db.query.gpsHistory.findMany({
      where: eq(gpsHistory.userId, targetUserId),
      orderBy: [desc(gpsHistory.timestamp)],
      limit: 150, // Get last 150 breadcrumbs for plotting
    });

    // Return chronological path order for direct maps drawing
    return res.json({
      success: true,
      path: history.reverse()
    });
  } catch (err: any) {
    console.error('Error fetching GPS history:', err);
    return res.status(500).json({ error: 'Server Error', message: err.message });
  }
});

export default router;
