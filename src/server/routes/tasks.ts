import { Router, Response } from 'express';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import { tasks, notifications, users } from '../../db/schema.ts';
import { authenticateToken, AuthRequest } from '../middleware/auth.ts';
import { validateBody } from '../middleware/validation.ts';

const router = Router();

// 1. CREATE AND ALLOCATE TASK (Supervisor Only)
router.post('/', 
  authenticateToken, 
  validateBody(['title', 'wardId', 'managerId', 'deadline']), 
  async (req: AuthRequest, res: Response) => {
    try {
      const { title, desc: description, priority, wardId, managerId, deadline, photoReq, gpsReq } = req.body;

      const [newTask] = await db.insert(tasks).values({
        title,
        desc: description || null,
        priority: priority || 'Medium',
        wardId: parseInt(wardId),
        managerId: parseInt(managerId),
        deadline,
        photoReq: !!photoReq,
        gpsReq: !!gpsReq,
        status: 'Pending',
        progress: 0,
      }).returning();

      // Notify the specific Zone Manager
      await db.insert(notifications).values({
        userId: parseInt(managerId),
        title: 'New Task Directive Assigned',
        body: `High-priority directive: "${title}" is due by ${deadline}.`,
        type: 'push',
        read: false,
      });

      return res.status(201).json({
        success: true,
        message: 'Task successfully created and assigned.',
        task: newTask,
      });
    } catch (err: any) {
      console.error('Error creating task:', err);
      return res.status(500).json({ error: 'Server Error', message: err.message });
    }
});

// 2. LIST TASKS (Filtered by Manager, Status, Ward)
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { managerId, status, wardId } = req.query;

    const conditions = [];
    if (managerId) {
      conditions.push(eq(tasks.managerId, parseInt(managerId.toString())));
    }
    if (status) {
      conditions.push(eq(tasks.status, status.toString()));
    }
    if (wardId) {
      conditions.push(eq(tasks.wardId, parseInt(wardId.toString())));
    }

    const taskLogs = await db.query.tasks.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: {
        manager: true,
        ward: {
          with: {
            zone: true,
          }
        },
      },
      orderBy: [desc(tasks.createdAt)],
      limit: 100,
    });

    return res.json({
      success: true,
      tasks: taskLogs,
    });
  } catch (err: any) {
    console.error('Error listing tasks:', err);
    return res.status(500).json({ error: 'Server Error', message: err.message });
  }
});

// 3. UPDATE TASK PROGRESS & STATUS
router.post('/:id/update', 
  authenticateToken, 
  validateBody(['status', 'progress']), 
  async (req: AuthRequest, res: Response) => {
    try {
      const taskId = parseInt(req.params.id);
      const { status, progress, notes } = req.body;

      if (!['Pending', 'In-Progress', 'Completed'].includes(status)) {
        return res.status(400).json({ error: 'Validation Error', message: 'Status must be Pending, In-Progress, or Completed.' });
      }

      const progressNum = parseInt(progress);
      if (isNaN(progressNum) || progressNum < 0 || progressNum > 100) {
        return res.status(400).json({ error: 'Validation Error', message: 'Progress must be an integer between 0 and 100.' });
      }

      const existingTask = await db.query.tasks.findFirst({
        where: eq(tasks.id, taskId),
      });

      if (!existingTask) {
        return res.status(404).json({ error: 'Not Found', message: 'Task directive not found.' });
      }

      const [updatedTask] = await db.update(tasks)
        .set({
          status,
          progress: progressNum,
        })
        .where(eq(tasks.id, taskId))
        .returning();

      // If completed, trigger system broadcast or notify supervisors
      if (status === 'Completed') {
        await db.insert(notifications).values({
          userId: null, // broadcast to supervisor dashboard
          title: 'Directive Task Completed',
          body: `Zone Manager ${req.user!.name} completed task "${existingTask.title}".`,
          type: 'system',
          read: false,
        });
      }

      return res.json({
        success: true,
        message: 'Task directive progress updated successfully.',
        task: updatedTask,
      });
    } catch (err: any) {
      console.error('Error updating task:', err);
      return res.status(500).json({ error: 'Server Error', message: err.message });
    }
});

export default router;
