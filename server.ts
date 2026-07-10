import express from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

// Import PostgreSQL Database seed and routes
import { seedDatabase } from './src/db/seed.ts';
import authRouter from './src/server/routes/auth.ts';
import attendanceRouter from './src/server/routes/attendance.ts';
import gpsRouter from './src/server/routes/gps.ts';
import activitiesRouter from './src/server/routes/activities.ts';
import tasksRouter from './src/server/routes/tasks.ts';
import dashboardRouter from './src/server/routes/dashboard.ts';
import reportsRouter from './src/server/routes/reports.ts';

dotenv.config();

// Configurable DB Provider: "local" (JSON-backed mock), "supabase" (PostgreSQL/Drizzle), or "firebase"
const DB_PROVIDER = process.env.DB_PROVIDER || (process.env.SQL_HOST ? 'supabase' : 'local');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '10mb' }));

// Set up Gemini API Client
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

// Database JSON Path
const DB_PATH = path.resolve(__dirname, 'data', 'db.json');

// Ensure data folder exists
if (!fs.existsSync(path.dirname(DB_PATH))) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

// 13 Zone Managers Initial Config
const ZONE_MANAGERS_STATIC = [
  { id: 'zm-1', name: 'Rohan Sharma', phone: '9876543201', empId: 'EMP202601', zone: 'Zone 1 (North)', wards: [1, 2], baseLat: 28.6320, baseLng: 77.2180 },
  { id: 'zm-2', name: 'Amit Patel', phone: '9876543202', empId: 'EMP202602', zone: 'Zone 2 (South)', wards: [3, 4], baseLat: 28.5950, baseLng: 77.2010 },
  { id: 'zm-3', name: 'Priyanka Sen', phone: '9876543203', empId: 'EMP202603', zone: 'Zone 3 (East)', wards: [5, 6], baseLat: 28.6210, baseLng: 77.2450 },
  { id: 'zm-4', name: 'Vikram Rao', phone: '9876543204', empId: 'EMP202604', zone: 'Zone 4 (West)', wards: [7, 8], baseLat: 28.6110, baseLng: 77.1680 },
  { id: 'zm-5', name: 'Karan Johar', phone: '9876543205', empId: 'EMP202605', zone: 'Zone 5 (North-East)', wards: [9, 10], baseLat: 28.6450, baseLng: 77.2350 },
  { id: 'zm-6', name: 'Sneha Reddy', phone: '9876543206', empId: 'EMP202606', zone: 'Zone 6 (North-West)', wards: [11, 12], baseLat: 28.6520, baseLng: 77.1850 },
  { id: 'zm-7', name: 'Rajesh Kumar', phone: '9876543207', empId: 'EMP202607', zone: 'Zone 7 (South-East)', wards: [13, 14], baseLat: 28.5750, baseLng: 77.2300 },
  { id: 'zm-8', name: 'Anjali Gupta', phone: '9876543208', empId: 'EMP202608', zone: 'Zone 8 (South-West)', wards: [15, 16], baseLat: 28.5680, baseLng: 77.1550 },
  { id: 'zm-9', name: 'Sanjay Verma', phone: '9876543209', empId: 'EMP202609', zone: 'Zone 9 (Central-North)', wards: [17, 18], baseLat: 28.6250, baseLng: 77.2080 },
  { id: 'zm-10', name: 'Meera Nair', phone: '9876543210', empId: 'EMP202610', zone: 'Zone 10 (Central-South)', wards: [19, 20], baseLat: 28.5880, baseLng: 77.2150 },
  { id: 'zm-11', name: 'Deepak Joshi', phone: '9876543211', empId: 'EMP202611', zone: 'Zone 11 (Central-East)', wards: [21, 22], baseLat: 28.6150, baseLng: 77.2320 },
  { id: 'zm-12', name: 'Sunita Rao', phone: '9876543212', empId: 'EMP202612', zone: 'Zone 12 (Central-West)', wards: [23, 24], baseLat: 28.6080, baseLng: 77.1880 },
  { id: 'zm-13', name: 'Abhishek Singh', phone: '9876543213', empId: 'EMP202613', zone: 'Zone 13 (Core Center)', wards: [25, 26], baseLat: 28.6139, baseLng: 77.2090 }
];

// Generate an active route coordinates path for each manager
function generateSimulatedPath(baseLat: number, baseLng: number): { lat: number, lng: number, label: string, durationMin: number, activityTrigger?: string }[] {
  return [
    { lat: baseLat, lng: baseLng, label: 'Zone Headquarters Office', durationMin: 30 },
    { lat: baseLat + 0.003, lng: baseLng - 0.002, label: 'Ward Sanitation Office', durationMin: 45, activityTrigger: 'Ward Inspection' },
    { lat: baseLat + 0.006, lng: baseLng + 0.001, label: 'Garbage Transfer Station', durationMin: 35, activityTrigger: 'Transfer Station Inspection' },
    { lat: baseLat + 0.004, lng: baseLng + 0.005, label: 'Public Toilet Complex A', durationMin: 20, activityTrigger: 'Public Toilet Inspection' },
    { lat: baseLat - 0.001, lng: baseLng + 0.004, label: 'Citizen Complaint #4019 Point', durationMin: 40, activityTrigger: 'Citizen Complaint' },
    { lat: baseLat - 0.004, lng: baseLng - 0.001, label: 'Open Depot Point & Waste Heap', durationMin: 30, activityTrigger: 'Open Depot Inspection' },
    { lat: baseLat - 0.002, lng: baseLng - 0.004, label: 'Community Toilet Complex B', durationMin: 25, activityTrigger: 'Public Toilet Inspection' },
    { lat: baseLat, lng: baseLng, label: 'Zone Headquarters Office', durationMin: 15 }
  ];
}

// Set up Mock Tasks
const INITIAL_TASKS = [
  { id: 'task-1', title: 'Verify Transfer Station Waste Clearance', desc: 'Inspect the garbage accumulation and clearance rate at Ward 3 Transfer Station.', priority: 'High', ward: 3, managerId: 'zm-2', deadline: 'Today, 14:00', photoReq: true, gpsReq: true, status: 'Pending', progress: 0 },
  { id: 'task-2', title: 'Address Citizen Water Logging Complaint', desc: 'Visit Ward 1 Complaint Location to check choked drains after rainfall.', priority: 'Critical', ward: 1, managerId: 'zm-1', deadline: 'Today, 12:00', photoReq: true, gpsReq: true, status: 'Completed', progress: 100 },
  { id: 'task-3', title: 'Inspect Public Toilet Sanitation', desc: 'Check cleanliness, running water, and lighting facilities at Public Toilet Complex in Ward 5.', priority: 'Medium', ward: 5, managerId: 'zm-3', deadline: 'Today, 17:00', photoReq: true, gpsReq: false, status: 'Pending', progress: 40 },
  { id: 'task-4', title: 'D2D Segregation Monitoring Campaign', desc: 'Conduct spot checks on waste segregation in Ward 11 residential pockets.', priority: 'Medium', ward: 11, managerId: 'zm-6', deadline: 'Today, 16:30', photoReq: false, gpsReq: true, status: 'Pending', progress: 10 },
  { id: 'task-5', title: 'Emergency Nallah Desilting Audit', desc: 'Inspect desilting progress at main open drain line in Ward 13.', priority: 'High', ward: 13, managerId: 'zm-7', deadline: 'Today, 13:00', photoReq: true, gpsReq: true, status: 'Completed', progress: 100 }
];

// Initial State Database Generator
function getInitialData() {
  const managers = ZONE_MANAGERS_STATIC.map((m, index) => {
    const route = generateSimulatedPath(m.baseLat, m.baseLng);
    
    // Some are pre-checked-in, some are absent
    const isCheckedIn = index < 10; // First 10 are checked in, 3 are absent/inactive
    const pathHistory = isCheckedIn ? [
      { lat: route[0].lat, lng: route[0].lng, timestamp: '09:00 AM', speed: 0, battery: 98, network: '5G' },
      { lat: route[1].lat, lng: route[1].lng, timestamp: '09:40 AM', speed: 12, battery: 94, network: '5G' },
      { lat: route[2].lat, lng: route[2].lng, timestamp: '10:30 AM', speed: 28, battery: 89, network: '4G' }
    ] : [];

    // Pre-populate some timeline spent places
    const visitedPlaces = isCheckedIn ? [
      { name: 'Zone Headquarters Office', arrival: '09:00 AM', departure: '09:30 AM', durationMin: 30, distancePrev: 0 },
      { name: 'Ward Sanitation Office', arrival: '09:42 AM', departure: '10:27 AM', durationMin: 45, distancePrev: 1.2 }
    ] : [];

    // Pre-populate some activities
    const activities = isCheckedIn ? [
      {
        id: `act-pre-${m.id}-1`,
        title: 'Morning Muster & Attendance Audit',
        category: 'Ward Inspection',
        description: 'Supervised the morning attendance collection and sanitation worker deployment at Ward Office.',
        wardNum: m.wards[0],
        gps: { lat: route[1].lat, lng: route[1].lng, address: route[1].label },
        timestamp: '09:55 AM',
        remarks: 'All 24 sweepers present. Cleaning started on time.',
        status: 'Approved',
        photo: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=600&auto=format&fit=crop&q=60'
      }
    ] : [];

    return {
      ...m,
      status: isCheckedIn ? 'checked-in' : 'checked-out',
      battery: isCheckedIn ? 84 - (index * 2) : 100,
      batteryStatus: isCheckedIn ? 'discharging' : 'unknown',
      network: isCheckedIn ? (index % 3 === 0 ? '4G' : '5G') : 'Offline',
      speed: isCheckedIn ? (index % 2 === 0 ? 0 : 22) : 0,
      lastUpdate: isCheckedIn ? '10:32 AM' : 'Never Today',
      currentLat: isCheckedIn ? route[2].lat : m.baseLat,
      currentLng: isCheckedIn ? route[2].lng : m.baseLng,
      currentAddress: isCheckedIn ? route[2].label : 'Home / Offline',
      routePoints: route,
      currentRouteIndex: isCheckedIn ? 2 : 0,
      tickAccumulator: 0,
      distanceTravelledKm: isCheckedIn ? 2.8 + (index * 0.3) : 0,
      workingHours: isCheckedIn ? 1.5 : 0,
      idleTimeMin: isCheckedIn ? 15 : 0,
      totalStops: isCheckedIn ? 2 : 0,
      pathHistory,
      visitedPlaces,
      activities,
      attendance: isCheckedIn ? {
        checkInTime: '09:00 AM',
        checkInLat: route[0].lat,
        checkInLng: route[0].lng,
        checkInAddress: route[0].label,
        checkInDevice: 'Samsung Galaxy A34 - Android 14',
        checkInNetwork: '5G',
        checkInBattery: 98,
        checkInPhoto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=60'
      } : null,
      performance: {
        attendanceRate: isCheckedIn ? 94 : 0,
        workingHoursTotal: isCheckedIn ? 38 : 0,
        distanceTotal: isCheckedIn ? 72 : 0,
        activitiesCompleted: isCheckedIn ? 14 : 0,
        responseTimeMinutes: isCheckedIn ? 24 : 0,
        productivityScore: isCheckedIn ? 85 + (index % 10) : 0
      },
      sos: false
    };
  });

  return {
    managers,
    tasks: INITIAL_TASKS,
    notifications: [
      { id: 'notif-1', title: '📋 New Task Assigned', body: 'Directive "Clean up solid waste heap near metro pillar" assigned to Rohan Sharma.', time: '09:15 AM', type: 'new-task', managerId: 'zm-1' },
      { id: 'notif-2', title: '⚠️ Attendance Reminder', body: 'Amit Patel has not checked in. Please complete morning validation.', time: '09:30 AM', type: 'attendance-reminder', managerId: 'zm-2' },
      { id: 'notif-3', title: '🚨 GPS Off Alert', body: 'Sneha Reddy\'s tracking has been reported offline. High accuracy GPS lost.', time: '08:45 AM', type: 'gps-off', managerId: 'zm-4' },
      { id: 'notif-4', title: '📝 Activity Pending Review', body: 'Priyanka Sen uploaded a Ward Inspection checklist report. Review pending.', time: '09:02 AM', type: 'activity-pending', managerId: 'zm-3' },
      { id: 'notif-5', title: '⏰ Task Deadline Reminder', body: 'Task "Verify garbage clearance in public market" is approaching its deadline in 1 hour.', time: '10:05 AM', type: 'task-reminder', managerId: 'zm-1' }
    ] as any[],
    simulationTime: '10:35 AM',
    simulationSpeed: 'normal' // paused, normal, fast_10x, fast_100x
  };
}

// Load database
let db = getInitialData();
if (fs.existsSync(DB_PATH)) {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    db = JSON.parse(raw);
    // Safety check in case of malformed state
    if (!db.managers || db.managers.length === 0) {
      db = getInitialData();
      saveDb();
    }
  } catch (err) {
    db = getInitialData();
    saveDb();
  }
} else {
  saveDb();
}

function saveDb() {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
}

// SIMULATION TICK LOOP
// A "tick" simulates passage of time.
// Normal speed: 1 tick = 5 simulated minutes every 15 seconds.
// Fast 10x: 1 tick = 15 simulated minutes every 15 seconds.
// Fast 100x: 1 tick = 45 simulated minutes every 15 seconds.

function parseTimeToMin(timeStr: string): number {
  const [time, modifier] = timeStr.split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  if (hours === 12) {
    hours = 0;
  }
  if (modifier === 'PM') {
    hours += 12;
  }
  return hours * 60 + minutes;
}

function minToTimeStr(totalMin: number): string {
  let hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  const modifier = hours >= 12 ? 'PM' : 'AM';
  if (hours > 12) {
    hours -= 12;
  } else if (hours === 0) {
    hours = 12;
  }
  const minStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
  const hrStr = hours < 10 ? `0${hours}` : `${hours}`;
  return `${hrStr}:${minStr} ${modifier}`;
}

function tickSimulation(stepMinutes: number = 5) {
  let currentTimeMin = parseTimeToMin(db.simulationTime);
  currentTimeMin += stepMinutes;
  
  // Daily reset simulation if time rolls over to 7:00 PM
  if (currentTimeMin >= 19 * 60) {
    currentTimeMin = 9 * 60; // Reset to 9:00 AM next day
    // Clear out today's transient states
    db.managers.forEach(m => {
      m.status = Math.random() > 0.15 ? 'checked-in' : 'checked-out'; // some are absent
      const route = m.routePoints;
      m.currentRouteIndex = 0;
      m.currentLat = route[0].lat;
      m.currentLng = route[0].lng;
      m.currentAddress = route[0].label;
      m.battery = m.status === 'checked-in' ? 100 : 100;
      m.batteryStatus = m.status === 'checked-in' ? 'discharging' : 'unknown';
      m.network = m.status === 'checked-in' ? '5G' : 'Offline';
      m.speed = 0;
      m.lastUpdate = '09:00 AM';
      m.distanceTravelledKm = 0;
      m.workingHours = 0;
      m.idleTimeMin = 0;
      m.totalStops = 0;
      m.sos = false;
      m.pathHistory = m.status === 'checked-in' ? [
        { lat: route[0].lat, lng: route[0].lng, timestamp: '09:00 AM', speed: 0, battery: 100, network: '5G' }
      ] : [];
      m.visitedPlaces = m.status === 'checked-in' ? [
        { name: route[0].label, arrival: '09:00 AM', departure: '', durationMin: 0, distancePrev: 0 }
      ] : [];
      m.activities = [];
      m.attendance = m.status === 'checked-in' ? {
        checkInTime: '09:00 AM',
        checkInLat: route[0].lat,
        checkInLng: route[0].lng,
        checkInAddress: route[0].label,
        checkInDevice: 'Realme Pro 12 - Android 14',
        checkInNetwork: '5G',
        checkInBattery: 100,
        checkInPhoto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=60'
      } : null;
    });
    db.notifications.unshift({
      id: `notif-${Date.now()}`,
      title: 'New Working Day Started',
      body: 'All system parameters initialized to 09:00 AM standard shift.',
      time: '09:00 AM',
      type: 'attendance-reminder'
    });
  }

  db.simulationTime = minToTimeStr(currentTimeMin);

  // Trigger 09:30 AM Attendance Reminder for all checked-out managers
  if (currentTimeMin >= 570 && currentTimeMin < 570 + stepMinutes) {
    db.managers.forEach(m => {
      if (m.status === 'checked-out') {
        db.notifications.unshift({
          id: `notif-att-remind-${Date.now()}-${m.id}`,
          title: '⚠️ Attendance Reminder',
          body: `${m.name} (${m.empId}) has not checked in for their shift yet. Please check in with selfie verification.`,
          time: db.simulationTime,
          type: 'attendance-reminder',
          managerId: m.id
        });
      }
    });
  }

  // Advance each checked-in manager's state
  db.managers.forEach(m => {
    if (m.status !== 'checked-in') return;

    // Tick battery down slowly
    if (Math.random() > 0.7) {
      m.battery = Math.max(15, m.battery - 1);
    }

    // Toggle Network randomly occasionally
    if (Math.random() > 0.95) {
      m.network = m.network === 'Offline' ? '4G' : (Math.random() > 0.5 ? '5G' : 'Offline');
      if (m.network === 'Offline') {
        db.notifications.unshift({
          id: `notif-${Date.now()}-${m.id}`,
          title: '🚨 GPS Off Alert',
          body: `${m.name}'s GPS tracking or network connection has been reported offline. Tracking paused.`,
          time: db.simulationTime,
          type: 'gps-off',
          managerId: m.id
        });
      }
    }

    // Advance GPS Along the route
    const currentPoint = m.routePoints[m.currentRouteIndex];
    m.tickAccumulator += stepMinutes;

    if (m.tickAccumulator >= currentPoint.durationMin) {
      // Completed stay at this point! Move to next point
      m.tickAccumulator = 0;
      const nextIndex = (m.currentRouteIndex + 1) % m.routePoints.length;
      const nextPoint = m.routePoints[nextIndex];
      
      // Calculate distance offset
      const dist = parseFloat((Math.abs(nextPoint.lat - currentPoint.lat) * 111 + Math.abs(nextPoint.lng - currentPoint.lng) * 111).toFixed(2));
      m.distanceTravelledKm = parseFloat((m.distanceTravelledKm + dist).toFixed(2));
      
      // Set moving parameters
      m.currentRouteIndex = nextIndex;
      m.currentLat = nextPoint.lat;
      m.currentLng = nextPoint.lng;
      m.currentAddress = nextPoint.label;
      m.speed = Math.floor(Math.random() * 25) + 15; // Moving speed
      m.lastUpdate = db.simulationTime;

      // Update travel history
      m.pathHistory.push({
        lat: nextPoint.lat,
        lng: nextPoint.lng,
        timestamp: db.simulationTime,
        speed: m.speed,
        battery: m.battery,
        network: m.network
      });

      // Update visited places
      if (m.visitedPlaces.length > 0) {
        m.visitedPlaces[m.visitedPlaces.length - 1].departure = db.simulationTime;
        m.visitedPlaces[m.visitedPlaces.length - 1].durationMin = currentPoint.durationMin;
      }
      m.visitedPlaces.push({
        name: nextPoint.label,
        arrival: db.simulationTime,
        departure: '',
        durationMin: 0,
        distancePrev: dist
      });

      m.totalStops += 1;

      // Trigger automatic simulated activities to populate the dashboard dynamically!
      if (nextPoint.activityTrigger) {
        const actCategories = [
          'Ward Inspection',
          'Door-to-Door Monitoring',
          'Transfer Station Inspection',
          'Public Toilet Inspection',
          'Open Depot Inspection',
          'Citizen Complaint',
          'Meeting'
        ];
        const category = nextPoint.activityTrigger;
        const photos = [
          'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=600&auto=format&fit=crop&q=60', // constr
          'https://images.unsplash.com/photo-1574127242631-29188e7a8698?w=600&auto=format&fit=crop&q=60', // road
          'https://images.unsplash.com/photo-1616401784845-180882ba9ba8?w=600&auto=format&fit=crop&q=60', // toilet/facility
          'https://images.unsplash.com/photo-1516880711640-ef7db81be3e1?w=600&auto=format&fit=crop&q=60'  // inspection
        ];
        
        const selectedPhoto = photos[Math.floor(Math.random() * photos.length)];

        m.activities.push({
          id: `act-auto-${Date.now()}-${m.id}`,
          title: `Simulated ${category}`,
          category,
          description: `Automatically completed point sanitation checklist at ${nextPoint.label}. Sweepers logged, trash volume checked.`,
          wardNum: m.wards[0],
          gps: { lat: nextPoint.lat, lng: nextPoint.lng, address: nextPoint.label },
          timestamp: db.simulationTime,
          remarks: 'Standard visual parameter inspection: Satisfactory.',
          status: 'Pending',
          photo: selectedPhoto
        });

        db.notifications.unshift({
          id: `notif-${Date.now()}-act`,
          title: '📝 Activity Pending Review',
          body: `${m.name} uploaded a ${category} report at ${nextPoint.label}. Validation required.`,
          time: db.simulationTime,
          type: 'activity-pending',
          managerId: m.id
        });
      }
    } else {
      // Still staying at this place
      m.speed = 0; // Stopped at location
    }

    // Update working hours
    m.workingHours = parseFloat((m.workingHours + (stepMinutes / 60)).toFixed(2));
    if (m.speed === 0) {
      m.idleTimeMin += stepMinutes;
    }

    // Dynamic performance updates
    const completedActs = m.activities.length;
    m.performance.activitiesCompleted = completedActs + 10;
    m.performance.distanceTotal = parseFloat((m.performance.distanceTotal + (m.distanceTravelledKm / 10)).toFixed(2));
    m.performance.productivityScore = Math.min(100, Math.max(50, Math.floor(
      (m.performance.attendanceRate * 0.4) + 
      (Math.min(10, m.workingHours) * 3) + 
      (completedActs * 4) + 
      (m.battery > 20 ? 10 : 0)
    )));
  });

  // Prune notifications if too long
  if (db.notifications.length > 50) {
    db.notifications = db.notifications.slice(0, 50);
  }

  saveDb();
}

// Background simulation ticker: runs every 12 seconds, steps simulation forward by 5 minutes
const simInterval = setInterval(() => {
  if (db.simulationSpeed !== 'paused') {
    let step = 5;
    if (db.simulationSpeed === 'fast_10x') step = 15;
    if (db.simulationSpeed === 'fast_100x') step = 45;
    tickSimulation(step);
  }
}, 12000);

// API ROUTES

// Mount PostgreSQL-backed production APIs conditionally based on provider
if (DB_PROVIDER === 'supabase') {
  console.log('🔌 DB_PROVIDER: "supabase". Mounting PostgreSQL/Drizzle production routers...');
  app.use('/api/auth', authRouter);
  app.use('/api/attendance', attendanceRouter);
  app.use('/api/gps', gpsRouter);
  app.use('/api/activity', activitiesRouter);
  app.use('/api/tasks', tasksRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/reports', reportsRouter);
} else {
  console.log(`💾 DB_PROVIDER: "${DB_PROVIDER}". Using Local JSON Mock Backend (${DB_PATH})`);
}

// Get entire DB state
app.get('/api/state', (req, res) => {
  res.json(db);
});

// Reset Simulation
app.post('/api/simulation/reset', (req, res) => {
  db = getInitialData();
  saveDb();
  res.json({ success: true, message: 'Simulation state reset completely.', state: db });
});

// Force Simulation Step Tick
app.post('/api/simulation/step', (req, res) => {
  const minutes = req.body.minutes || 15;
  tickSimulation(minutes);
  res.json({ success: true, message: `Advanced simulation by ${minutes} minutes.`, state: db });
});

// Change Simulation Speed
app.post('/api/simulation/speed', (req, res) => {
  const { speed } = req.body;
  if (['paused', 'normal', 'fast_10x', 'fast_100x'].includes(speed)) {
    db.simulationSpeed = speed;
    saveDb();
    res.json({ success: true, speed: db.simulationSpeed });
  } else {
    res.status(400).json({ error: 'Invalid speed profile.' });
  }
});

// Trigger/Broadcast custom notification
app.post('/api/notifications/trigger', (req, res) => {
  const { title, body, type, managerId } = req.body;
  const newNotif = {
    id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    title,
    body,
    time: db.simulationTime,
    type: type || 'warning',
    managerId: managerId || null
  };
  
  db.notifications.unshift(newNotif);
  
  // Prune list
  if (db.notifications.length > 50) {
    db.notifications = db.notifications.slice(0, 50);
  }
  
  saveDb();
  res.json({ success: true, notification: newNotif, state: db });
});

// Clear all notifications
app.post('/api/notifications/clear', (req, res) => {
  db.notifications = [];
  saveDb();
  res.json({ success: true, state: db });
});

// Delete specific notification
app.delete('/api/notifications/:id', (req, res) => {
  const { id } = req.params;
  db.notifications = db.notifications.filter(n => n.id !== id);
  saveDb();
  res.json({ success: true, state: db });
});

// Trigger SOS
app.post('/api/managers/:id/sos', (req, res) => {
  const { id } = req.params;
  const manager = db.managers.find(m => m.id === id);
  if (manager) {
    manager.sos = !manager.sos;
    if (manager.sos) {
      db.notifications.unshift({
        id: `sos-${Date.now()}`,
        title: '🔴 EMERGENCY SOS ACTIVE',
        body: `Zone Manager ${manager.name} triggered SOS in ${manager.zone}. Current Lat: ${manager.currentLat}, Lng: ${manager.currentLng}`,
        time: db.simulationTime,
        type: 'warning'
      });
    }
    saveDb();
    res.json({ success: true, sos: manager.sos });
  } else {
    res.status(404).json({ error: 'Zone Manager not found.' });
  }
});

// Manual Check-In (GPS & Attendance Mark)
app.post('/api/attendance/check-in', (req, res) => {
  const { managerId, lat, lng, address, device, network, battery, photo } = req.body;
  const manager = db.managers.find(m => m.id === managerId);
  
  if (!manager) {
    return res.status(404).json({ error: 'Zone Manager not found.' });
  }

  manager.status = 'checked-in';
  manager.currentLat = lat || manager.baseLat;
  manager.currentLng = lng || manager.baseLng;
  manager.currentAddress = address || 'Assigned Zone Office';
  manager.battery = battery || 95;
  manager.batteryStatus = 'discharging';
  manager.network = network || '5G';
  manager.speed = 0;
  manager.distanceTravelledKm = 0;
  manager.workingHours = 0;
  manager.idleTimeMin = 0;
  manager.totalStops = 0;
  manager.lastUpdate = db.simulationTime;

  manager.attendance = {
    checkInTime: db.simulationTime,
    checkInLat: lat || manager.baseLat,
    checkInLng: lng || manager.baseLng,
    checkInAddress: address || 'Zone Headquarters Office',
    checkInDevice: device || 'Android Smartphone - Client App',
    checkInNetwork: network || '4G/Wi-Fi',
    checkInBattery: battery || 95,
    checkInPhoto: photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=60'
  };

  manager.pathHistory = [
    {
      lat: lat || manager.baseLat,
      lng: lng || manager.baseLng,
      timestamp: db.simulationTime,
      speed: 0,
      battery: battery || 95,
      network: network || '5G'
    }
  ];

  manager.visitedPlaces = [
    {
      name: address || 'Zone Headquarters Office',
      arrival: db.simulationTime,
      departure: '',
      durationMin: 0,
      distancePrev: 0
    }
  ];

  db.notifications.unshift({
    id: `notif-${Date.now()}`,
    title: '✅ Attendance Check-In',
    body: `${manager.name} checked in successfully at ${db.simulationTime}. Location verified.`,
    time: db.simulationTime,
    type: 'attendance-reminder',
    managerId: managerId
  });

  saveDb();
  res.json({ success: true, manager });
});

// Manual Check-Out
app.post('/api/attendance/check-out', (req, res) => {
  const { managerId, signature } = req.body;
  const manager = db.managers.find(m => m.id === managerId);

  if (!manager) {
    return res.status(404).json({ error: 'Zone Manager not found.' });
  }

  manager.status = 'checked-out';
  manager.speed = 0;
  manager.network = 'Offline';
  manager.batteryStatus = 'unknown';
  
  if (manager.attendance) {
    (manager.attendance as any).checkOutTime = db.simulationTime;
    (manager.attendance as any).signature = signature || 'Digital Touch Signature Verified';
  }

  db.notifications.unshift({
    id: `notif-${Date.now()}`,
    title: '🚪 Attendance Check-Out',
    body: `${manager.name} signed off and checked out of shift at ${db.simulationTime}.`,
    time: db.simulationTime,
    type: 'attendance-reminder',
    managerId: managerId
  });

  saveDb();
  res.json({ success: true, manager });
});

// Submit Daily Activity
app.post('/api/activity', (req, res) => {
  const { managerId, title, category, description, wardNum, gps, remarks, photo } = req.body;
  const manager = db.managers.find(m => m.id === managerId);

  if (!manager) {
    return res.status(404).json({ error: 'Zone Manager not found.' });
  }

  const newActivity = {
    id: `act-${Date.now()}`,
    title,
    category,
    description,
    wardNum: parseInt(wardNum) || manager.wards[0],
    gps: gps || { lat: manager.currentLat, lng: manager.currentLng, address: manager.currentAddress },
    timestamp: db.simulationTime,
    remarks: remarks || 'All correct.',
    status: 'Pending',
    photo: photo || 'https://images.unsplash.com/photo-1616401784845-180882ba9ba8?w=600&auto=format&fit=crop&q=60'
  };

  manager.activities.unshift(newActivity);
  
  db.notifications.unshift({
    id: `notif-${Date.now()}`,
    title: '📝 Activity Pending Review',
    body: `${manager.name} submitted a new ${category} in Ward ${wardNum}. Verification pending.`,
    time: db.simulationTime,
    type: 'activity-pending',
    managerId: managerId
  });

  saveDb();
  res.json({ success: true, activity: newActivity });
});

// Assign / Create Task
app.post('/api/tasks', (req, res) => {
  const { title, desc, priority, ward, managerId, deadline, photoReq, gpsReq } = req.body;
  
  const newTask = {
    id: `task-${Date.now()}`,
    title,
    desc,
    priority: priority || 'Medium',
    ward: parseInt(ward) || 1,
    managerId,
    deadline: deadline || 'Today, 18:00',
    photoReq: !!photoReq,
    gpsReq: !!gpsReq,
    status: 'Pending',
    progress: 0
  };

  db.tasks.unshift(newTask);

  const manager = db.managers.find(m => m.id === managerId);
  const managerName = manager ? manager.name : 'Unassigned';

  db.notifications.unshift({
    id: `notif-${Date.now()}`,
    title: '📋 New Task Assigned',
    body: `Directive "${title}" assigned to ${managerName} in Ward ${ward}.`,
    time: db.simulationTime,
    type: 'new-task',
    managerId: managerId
  });

  saveDb();
  res.json({ success: true, task: newTask });
});

// Update Task Progress
app.post('/api/tasks/:id/update', (req, res) => {
  const { id } = req.params;
  const { status, progress } = req.body;
  const task = db.tasks.find(t => t.id === id);

  if (task) {
    if (status) task.status = status;
    if (progress !== undefined) task.progress = parseInt(progress);
    
    saveDb();
    res.json({ success: true, task });
  } else {
    res.status(404).json({ error: 'Task not found.' });
  }
});

// AI Work Summary Daily Diary (using Gemini API)
app.post('/api/ai-summary', async (req, res) => {
  const { managerId } = req.body;
  const manager = db.managers.find(m => m.id === managerId);

  if (!manager) {
    return res.status(404).json({ error: 'Zone Manager not found.' });
  }

  if (!ai) {
    return res.json({
      summary: `### Municipal Supervisor Daily Diary (Simulated Summary)

**Officer**: ${manager.name} | **Zone**: ${manager.zone}
**Timeline & Activities Captured**:
- Checked-In: ${manager.attendance?.checkInTime || '09:00 AM'}
- Total Distance Covered: ${manager.distanceTravelledKm} km
- Verified stops: ${manager.totalStops} stops completed
- Submitted activities: ${manager.activities.length} logs reported

**Supervisor Assessment**:
The officer maintained high visibility within assigned Wards ${manager.wards.join(', ')}. Key locations such as the waste transfer facility and public toilet complexes were checked. Recommended focus for tomorrow: monitor D2D waste segregation coverage in Ward ${manager.wards[0]} and ensure faster resolution of citizen complaint tickets.`
    });
  }

  try {
    const activityLog = manager.activities.map(a => `[${a.timestamp}] [Ward ${a.wardNum}] [${a.category}] ${a.title} - Description: ${a.description}. Status: ${a.status}. Remarks: ${a.remarks}`).join('\n');
    const visitedPlacesLog = manager.visitedPlaces.map(p => `[${p.arrival} - ${p.departure || 'Ongoing'}] Stayed at ${p.name} for ${p.durationMin} mins`).join('\n');

    const prompt = `You are a Municipal Executive Supervisor auditing the daily field force report of a Zone Manager. Analyze the following daily logs and generate a highly professional, detailed Daily Work Diary, Performance Score Assessment, and Supervisory Review. Keep it realistic, constructive, and formatted in clean Markdown.

Officer Profile:
- Name: ${manager.name}
- Employee ID: ${manager.empId}
- Assigned Zone: ${manager.zone}
- Active Wards: ${manager.wards.join(', ')}
- Check-In Time: ${manager.attendance?.checkInTime || '09:00 AM'}
- Distance Travelled: ${manager.distanceTravelledKm} km
- Total Stopped Checkpoints: ${manager.totalStops}
- Working Hours Recorded: ${manager.workingHours} hours
- Active SOS Triggered: ${manager.sos ? 'Yes (Emergency Reported)' : 'No'}

Submitted Field Activities:
${activityLog || 'No manual field activities submitted yet today.'}

Geographical Visited Locations:
${visitedPlacesLog || 'No visited stops recorded yet.'}

Format the response cleanly with sections:
1. **Executive Operational Audit Summary** (Review of shift coverage, speed, distance)
2. **Citizen Satisfaction & Sanitation Review** (Audit of their inspections and complaints handled)
3. **Key Highlight / Outstanding Action** (Spotlight a positive action or critical concern)
4. **Target Directives for Tomorrow** (3 actionable instructions for the next shift)`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
    });

    res.json({ summary: response.text });
  } catch (err: any) {
    console.error('Gemini error:', err);
    res.status(500).json({ error: 'AI generation failed: ' + err.message });
  }
});


// Update Daily Activity Status/Remarks
app.post('/api/activity/:id/status', (req, res) => {
  const { id } = req.params;
  const { status, remarks } = req.body;

  let foundActivity = null;
  let foundManager = null;

  for (const m of db.managers) {
    const act = m.activities.find(a => a.id === id);
    if (act) {
      foundActivity = act;
      foundManager = m;
      break;
    }
  }

  if (foundActivity) {
    if (status) foundActivity.status = status;
    if (remarks !== undefined) foundActivity.remarks = remarks;

    db.notifications.unshift({
      id: `notif-${Date.now()}`,
      title: `📝 Activity Reviewed: ${status}`,
      body: `Supervisor reviewed ${foundManager.name}'s activity "${foundActivity.title}". Status set to ${status}.`,
      time: db.simulationTime,
      type: 'activity-pending',
      managerId: foundManager.id
    });

    saveDb();
    res.json({ success: true, activity: foundActivity });
  } else {
    res.status(404).json({ error: 'Activity log not found.' });
  }
});


// Serve React Frontend (Production or Dev Middleware)
const isProd = process.env.NODE_ENV === 'production';

if (!isProd) {
  // Developer Vite Middleware Mode
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'custom',
  });
  
  app.use(vite.middlewares);

  app.use('*', async (req, res, next) => {
    const url = req.originalUrl;
    try {
      let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
      template = await vite.transformIndexHtml(url, template);
      res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
    } catch (e: any) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
} else {
  // Serve static build in production
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
}

// Start full-stack server on Port 3000
const port = 3000;
app.listen(port, '0.0.0.0', async () => {
  console.log(`ZMMS Server listening on http://0.0.0.0:${port} (Vite mode: ${!isProd ? 'Dev' : 'Prod'})`);
  // Automatically seed PostgreSQL database on boot if empty and provider is supabase
  if (DB_PROVIDER === 'supabase') {
    try {
      await seedDatabase();
    } catch (err) {
      console.warn('⚠️ Seeding PostgreSQL skipped/failed:', err);
    }
  }
});
