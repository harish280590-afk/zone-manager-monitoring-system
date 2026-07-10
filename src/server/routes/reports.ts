import { Router, Response } from 'express';
import { eq, and, gte, desc } from 'drizzle-orm';
import { GoogleGenAI } from '@google/genai';
import { db } from '../../db/index.ts';
import { reports, users, activities, attendance, gpsHistory } from '../../db/schema.ts';
import { authenticateToken, AuthRequest } from '../middleware/auth.ts';
import { validateBody } from '../middleware/validation.ts';

const router = Router();

// Set up Gemini API client lazily
let ai: GoogleGenAI | null = null;
const initGemini = () => {
  if (!ai && process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return ai;
};

// 1. ARCHIVE / SUBMIT COMPLIANCE REPORT
router.post('/create', 
  authenticateToken, 
  validateBody(['title', 'content', 'date', 'type']), 
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { title, content, date, type } = req.body;

      const [newReport] = await db.insert(reports).values({
        userId,
        title,
        content,
        date, // YYYY-MM-DD
        type: type || 'daily-activity',
      }).returning();

      return res.status(201).json({
        success: true,
        message: 'Report successfully created and archived.',
        report: newReport,
      });
    } catch (err: any) {
      console.error('Error creating report:', err);
      return res.status(500).json({ error: 'Server Error', message: err.message });
    }
});

// 2. GET REPORTS LIST
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, type } = req.query;

    const conditions = [];
    if (userId) {
      conditions.push(eq(reports.userId, parseInt(userId.toString())));
    }
    if (type) {
      conditions.push(eq(reports.type, type.toString()));
    }

    const archivedReports = await db.query.reports.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: {
        user: true,
      },
      orderBy: [desc(reports.createdAt)],
      limit: 50,
    });

    return res.json({
      success: true,
      reports: archivedReports,
    });
  } catch (err: any) {
    console.error('Error listing reports:', err);
    return res.status(500).json({ error: 'Server Error', message: err.message });
  }
});

// 3. AI WORK DIARY GENERATOR (Uses Gemini API)
router.post('/ai-work-diary', 
  authenticateToken, 
  validateBody(['userId']), 
  async (req: AuthRequest, res: Response) => {
    try {
      const targetUserId = parseInt(req.body.userId);
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // 1. Fetch user profile
      const manager = await db.query.users.findFirst({
        where: eq(users.id, targetUserId),
        with: {
          zone: true,
        }
      });

      if (!manager) {
        return res.status(404).json({ error: 'Not Found', message: 'Zone Manager not found.' });
      }

      // 2. Fetch today's shift clock-in detail
      const shift = await db.query.attendance.findFirst({
        where: and(
          eq(attendance.userId, targetUserId),
          gte(attendance.checkInTime, todayStart)
        ),
        orderBy: [desc(attendance.checkInTime)]
      });

      // 3. Fetch today's sanitation activity logs
      const todayActivities = await db.query.activities.findMany({
        where: and(
          eq(activities.userId, targetUserId),
          gte(activities.timestamp, todayStart)
        ),
        orderBy: [desc(activities.timestamp)]
      });

      // 4. Fetch recent GPS tracking checkpoints (max 10)
      const recentGPS = await db.query.gpsHistory.findMany({
        where: and(
          eq(gpsHistory.userId, targetUserId),
          gte(gpsHistory.timestamp, todayStart)
        ),
        orderBy: [desc(gpsHistory.timestamp)],
        limit: 10
      });

      const hasApiKey = !!process.env.GEMINI_API_KEY;
      const client = initGemini();

      if (!hasApiKey || !client) {
        // Return structured fallback report when Gemini key is missing
        const fallbackText = `### Municipal Supervisor Daily Diary (Simulated Summary)

**Officer**: ${manager.name} (EMP ID: ${manager.empId})
**Zone**: ${manager.zone?.name || 'Assigned Zone'} | **Shift Date**: ${todayStart.toISOString().split('T')[0]}

**Shift & Geolocation Coverage Audit**:
- **Status**: ${manager.status === 'checked-in' ? '🟢 Checked-In Active' : '🔴 Checked-Out'}
- **Clock-In**: ${shift ? shift.checkInTime.toLocaleTimeString() : '09:00 AM'}
- **Total Shift Hours**: ${manager.workingHours || 0.0} hrs
- **Cumulative Distance**: ${manager.distanceTravelledKm || 0.0} km
- **Device & Power**: Battery ${manager.battery}%, connected on ${manager.network}

**Field Activities Logged Today (${todayActivities.length})**:
${todayActivities.map((a, i) => `${i + 1}. [${a.category}] **${a.title}** - Status: *${a.status}* | Remarks: "${a.remarks || 'Standard visual parameter inspection'}"`).join('\n') || '- No manual activity audits reported by the officer yet today.'}

**Supervisor Advisory**:
The Zone Manager maintained standard GPS visibility during field shifts. Critical locations like transfer points and ward clusters were covered. Recommended for next shift: prioritize door-to-door (D2D) waste collection audit and follow-up on delayed ward sanitation inspections.`;

        return res.json({
          success: true,
          summary: fallbackText,
          isSimulated: true
        });
      }

      // Prepare data summary to send to Gemini
      const activitiesSummary = todayActivities.length > 0 
        ? todayActivities.map(a => `[Activity: ${a.category}] Title: "${a.title}". Description: "${a.description || 'N/A'}". Status: ${a.status}. Remarks: "${a.remarks || 'N/A'}"`).join('\n')
        : 'No sanitation activities logged today.';

      const gpsSummary = recentGPS.length > 0 
        ? recentGPS.map(g => `[Time: ${g.timestamp.toLocaleTimeString()}] Coordinates: ${g.latitude}, ${g.longitude}. Speed: ${g.speed} km/h. Network: ${g.network}`).join('\n')
        : 'No GPS tracks logged today.';

      const prompt = `You are a Municipal Executive Supervisor auditing the daily field force logs of a Zone Manager. Analyze the following actual database inputs and compile a highly professional, detailed, and formatted Daily Work Diary, Field Force Assessment, and Target Directives. Keep it realistic, objective, constructive, and output in clean Markdown.

Officer Profile:
- Name: ${manager.name}
- Employee ID: ${manager.empId}
- Zone: ${manager.zone?.name || 'General Municipal Zone'}
- Shift Status: ${manager.status}
- Cumulative Distance: ${manager.distanceTravelledKm} km
- Shift Hours: ${manager.workingHours} hours
- Phone: ${manager.phone || 'N/A'}

Today's Attendance Clock-In:
- Time: ${shift ? shift.checkInTime.toLocaleTimeString() : 'N/A'}
- Device: ${shift ? shift.checkInDevice : 'N/A'}
- Network: ${shift ? shift.checkInNetwork : 'N/A'}
- Battery: ${shift ? shift.checkInBattery : 'N/A'}%

Submitted Sanitation Activities Logs:
${activitiesSummary}

Recent GPS Geolocation Breadcrumbs:
${gpsSummary}

Generate the assessment in exactly 4 professional Markdown sections:
1. **Executive Operational Audit Summary** (Review of shift hours, battery/network compliance, and overall travel coverage)
2. **Citizen Satisfaction & Sanitation Review** (Audit of their inspections and complaints handled today)
3. **Key Highlight / Outstanding Action** (Highlight a positive point or raise a critical flag about their shift parameters)
4. **Target Directives for Tomorrow** (3 specific, actionable instructions for their next field shift)`;

      const response = await client.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
      });

      return res.json({
        success: true,
        summary: response.text,
        isSimulated: false
      });
    } catch (err: any) {
      console.error('Error generating AI diary:', err);
      return res.status(500).json({ error: 'Server Error', message: err.message });
    }
});

export default router;
