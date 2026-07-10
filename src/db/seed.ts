import bcrypt from 'bcryptjs';
import { db } from './index.ts';
import { zones, wards, users, tasks, activities, attendance, notifications } from './schema.ts';
import { eq, sql } from 'drizzle-orm';

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

export async function seedDatabase() {
  try {
    console.log('Checking if seeding is required...');

    // 1. Check if users already exist
    const userCountResult = await db.select({ count: sql<number>`count(*)::int` }).from(users);
    const userCount = userCountResult[0]?.count || 0;

    if (userCount > 0) {
      console.log('Database already has users. Skipping seeding.');
      return;
    }

    console.log('Database is empty. Starting seeding process...');

    const salt = await bcrypt.genSalt(10);
    const defaultPasswordHash = await bcrypt.hash('password123', salt);

    // 2. Insert Zones and Wards
    for (const m of ZONE_MANAGERS_STATIC) {
      // Create Zone
      let zoneRecord = await db.query.zones.findFirst({
        where: eq(zones.name, m.zone),
      });

      if (!zoneRecord) {
        const [insertedZone] = await db.insert(zones).values({
          name: m.zone,
          baseLat: m.baseLat,
          baseLng: m.baseLng,
        }).returning();
        zoneRecord = insertedZone;
      }

      // Create Wards for this zone
      const insertedWardIds: number[] = [];
      for (const wNo of m.wards) {
        const [wardRecord] = await db.insert(wards).values({
          wardNumber: wNo,
          name: `Ward ${wNo}`,
          zoneId: zoneRecord.id,
        }).returning();
        insertedWardIds.push(wardRecord.id);
      }

      // Create Zone Manager User
      const [insertedUser] = await db.insert(users).values({
        uid: `uid-${m.id}`,
        empId: m.empId,
        name: m.name,
        email: `${m.name.toLowerCase().replace(/\s+/g, '')}@municipal.gov.in`,
        phone: m.phone,
        passwordHash: defaultPasswordHash,
        role: 'zone-manager',
        zoneId: zoneRecord.id,
        status: 'checked-in', // Start some pre-checked-in
        battery: 88,
        network: '5G',
        speed: 0.0,
        currentLat: m.baseLat,
        currentLng: m.baseLng,
        currentAddress: 'Zone Headquarters Office',
        distanceTravelledKm: 1.4,
        workingHours: 2.5,
        lastUpdate: new Date(),
      }).returning();

      // Create checked-in attendance log for pre-checked-in managers
      const checkInTime = new Date();
      checkInTime.setHours(checkInTime.getHours() - 2); // 2 hours ago

      const [attendanceRecord] = await db.insert(attendance).values({
        userId: insertedUser.id,
        checkInTime,
        checkInLat: m.baseLat,
        checkInLng: m.baseLng,
        checkInAddress: 'Zone Headquarters Office',
        checkInDevice: 'Samsung Galaxy - Android 14',
        checkInNetwork: '5G',
        checkInBattery: 98,
        status: 'Active',
      }).returning();

      // Seed a couple of activities
      await db.insert(activities).values({
        userId: insertedUser.id,
        title: 'Morning Muster Inspection',
        category: 'Ward Inspection',
        description: 'Completed sanitation worker muster verification at Ward Office. Reviewed attendance lists.',
        wardId: insertedWardIds[0],
        latitude: m.baseLat + 0.002,
        longitude: m.baseLng - 0.001,
        address: 'Ward Sanitation Office Area',
        remarks: 'All 15 sweepers present. Shift started on schedule.',
        status: 'Approved',
        timestamp: new Date(),
      });

      // Seed a directive task
      await db.insert(tasks).values({
        title: 'Verify Waste Segregation Campaign',
        desc: 'Audit the dry vs wet waste collection status in ward residential pockets.',
        priority: 'High',
        wardId: insertedWardIds[0],
        managerId: insertedUser.id,
        deadline: 'Today, 17:00',
        photoReq: true,
        gpsReq: true,
        status: 'In-Progress',
        progress: 50,
      });
    }

    // Seed one Administrator account
    const adminPasswordHash = await bcrypt.hash('admin123', salt);
    await db.insert(users).values({
      uid: 'uid-admin-1',
      empId: 'EMPADMIN01',
      name: 'Supervisory Commissioner',
      email: 'commissioner@municipal.gov.in',
      phone: '9999999999',
      passwordHash: adminPasswordHash,
      role: 'admin',
      status: 'checked-out',
    });

    console.log('Database seeded successfully with initial Zone, Wards, Managers, Tasks and Admin!');
  } catch (err) {
    console.error('Error during database seeding:', err);
  }
}
