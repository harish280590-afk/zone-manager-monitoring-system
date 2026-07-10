import { Router, Response } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { activities, notifications, users } from '../../db/schema.ts';
import { authenticateToken, AuthRequest } from '../middleware/auth.ts';
import { validateBody, validateCoordinates } from '../middleware/validation.ts';

const router = Router();

// 1. SUBMIT NEW SANITATION ACTIVITY LOG
router.post('/', 
  authenticateToken, 
  validateBody(['title', 'category', 'wardId', 'latitude', 'longitude']), 
  validateCoordinates('latitude', 'longitude'),
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { title, category, description, wardId, latitude, longitude, address, photo, remarks } = req.body;

      const [newActivity] = await db.insert(activities).values({
        userId,
        title,
        category,
        description: description || null,
        wardId: parseInt(wardId),
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        address: address || null,
        photo: photo || null,
        remarks: remarks || null,
        status: 'Pending', // pending supervisor approval
      }).returning();

      // Trigger automatic notification for supervisors/admin
      await db.insert(notifications).values({
        userId: null, // Broadcast notification
        title: 'New Field Activity',
        body: `Zone Manager ${req.user!.name} submitted a new ${category} report for Ward ${wardId}.`,
        type: 'push',
        read: false,
      });

      return res.status(201).json({
        success: true,
        message: 'Sanitation activity reported successfully.',
        activity: newActivity
      });
    } catch (err: any) {
      console.error('Error reporting activity:', err);
      return res.status(500).json({ error: 'Server Error', message: err.message });
    }
});

// 2. GET ACTIVITIES LIST (With Filters)
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { status, wardId, userId } = req.query;
    
    // Build filter conditions
    const conditions = [];
    if (status) {
      conditions.push(eq(activities.status, status.toString()));
    }
    if (wardId) {
      conditions.push(eq(activities.wardId, parseInt(wardId.toString())));
    }
    if (userId) {
      conditions.push(eq(activities.userId, parseInt(userId.toString())));
    }

    const logs = await db.query.activities.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: {
        user: true,
        ward: {
          with: {
            zone: true
          }
        },
      },
      orderBy: [desc(activities.timestamp)],
      limit: 100
    });

    return res.json({
      success: true,
      activities: logs
    });
  } catch (err: any) {
    console.error('Error fetching activities:', err);
    return res.status(500).json({ error: 'Server Error', message: err.message });
  }
});

// 3. APPROVE / REJECT FIELD ACTIVITY (Supervisor Actions)
router.post('/:id/status', 
  authenticateToken, 
  validateBody(['status']), 
  async (req: AuthRequest, res: Response) => {
    try {
      const activityId = parseInt(req.params.id);
      const { status, remarks } = req.body;

      if (!['Approved', 'Rejected', 'Pending'].includes(status)) {
        return res.status(400).json({ error: 'Validation Error', message: 'Status must be Approved, Rejected, or Pending.' });
      }

      const existingActivity = await db.query.activities.findFirst({
        where: eq(activities.id, activityId)
      });

      if (!existingActivity) {
        return res.status(404).json({ error: 'Not Found', message: 'Activity log not found.' });
      }

      const [updatedActivity] = await db.update(activities)
        .set({
          status,
          remarks: remarks || existingActivity.remarks,
        })
        .where(eq(activities.id, activityId))
        .returning();

      // Notify the Zone Manager who created it
      await db.insert(notifications).values({
        userId: existingActivity.userId,
        title: `Activity Audit: ${status}`,
        body: `Your activity report "${existingActivity.title}" has been reviewed and marked as ${status}.`,
        type: 'system',
        read: false,
      });

      return res.json({
        success: true,
        message: `Activity successfully marked as ${status}.`,
        activity: updatedActivity
      });
    } catch (err: any) {
      console.error('Error updating activity status:', err);
      return res.status(500).json({ error: 'Server Error', message: err.message });
    }
});

export default router;
