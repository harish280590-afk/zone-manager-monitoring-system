import { relations } from 'drizzle-orm';
import { pgTable, serial, text, integer, doublePrecision, timestamp, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core';

// ==========================================
// 1. ZONES TABLE
// ==========================================
export const zones = pgTable('zones', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(), // e.g. "Zone 1 (North)"
  baseLat: doublePrecision('base_lat').notNull(),
  baseLng: doublePrecision('base_lng').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const zonesRelations = relations(zones, ({ many }) => ({
  wards: many(wards),
  users: many(users),
}));

// ==========================================
// 2. WARDS TABLE
// ==========================================
export const wards = pgTable('wards', {
  id: serial('id').primaryKey(),
  wardNumber: integer('ward_number').notNull(), // e.g. 1, 2, 3
  name: text('name').notNull(), // e.g. "Ward 1"
  zoneId: integer('zone_id')
    .references(() => zones.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  zoneIdIdx: index('wards_zone_id_idx').on(table.zoneId),
  wardNumZoneUnique: uniqueIndex('ward_num_zone_unique').on(table.wardNumber, table.zoneId),
}));

export const wardsRelations = relations(wards, ({ one, many }) => ({
  zone: one(zones, {
    fields: [wards.zoneId],
    references: [zones.id],
  }),
  activities: many(activities),
  tasks: many(tasks),
}));

// ==========================================
// 3. USERS TABLE (Zone Managers & Admins)
// ==========================================
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Authentication UID
  empId: text('emp_id').notNull().unique(), // e.g. "EMP202601"
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  passwordHash: text('password_hash'),
  role: text('role').default('zone-manager').notNull(), // "admin" or "zone-manager"
  zoneId: integer('zone_id')
    .references(() => zones.id, { onDelete: 'set null' }),
  status: text('status').default('checked-out').notNull(), // "checked-in" or "checked-out"
  battery: integer('battery').default(100),
  network: text('network').default('Offline'),
  speed: doublePrecision('speed').default(0.0),
  currentLat: doublePrecision('current_lat'),
  currentLng: doublePrecision('current_lng'),
  currentAddress: text('current_address'),
  distanceTravelledKm: doublePrecision('distance_travelled_km').default(0.0),
  workingHours: doublePrecision('working_hours').default(0.0),
  lastUpdate: timestamp('last_update'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  uidIdx: uniqueIndex('users_uid_idx').on(table.uid),
  empIdIdx: uniqueIndex('users_emp_id_idx').on(table.empId),
  zoneIdIdx: index('users_zone_id_idx').on(table.zoneId),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  zone: one(zones, {
    fields: [users.zoneId],
    references: [zones.id],
  }),
  attendance: many(attendance),
  gpsHistory: many(gpsHistory),
  activities: many(activities),
  tasks: many(tasks),
  photos: many(photos),
  notifications: many(notifications),
  reports: many(reports),
}));

// ==========================================
// 4. ATTENDANCE TABLE (Daily Shift Log)
// ==========================================
export const attendance = pgTable('attendance', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  checkInTime: timestamp('check_in_time').notNull(),
  checkInLat: doublePrecision('check_in_lat').notNull(),
  checkInLng: doublePrecision('check_in_lng').notNull(),
  checkInAddress: text('check_in_address'),
  checkInDevice: text('check_in_device'),
  checkInNetwork: text('check_in_network'),
  checkInBattery: integer('check_in_battery'),
  checkInPhoto: text('check_in_photo'), // Biometric Selfie URL
  checkOutTime: timestamp('check_out_time'),
  checkOutLat: doublePrecision('check_out_lat'),
  checkOutLng: doublePrecision('check_out_lng'),
  checkOutAddress: text('check_out_address'),
  signature: text('signature'), // Digital Signature text or base64 verification
  workingHours: doublePrecision('working_hours'),
  status: text('status').default('Active').notNull(), // "Active" or "Completed"
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  userIdIdx: index('attendance_user_id_idx').on(table.userId),
}));

export const attendanceRelations = relations(attendance, ({ one }) => ({
  user: one(users, {
    fields: [attendance.userId],
    references: [users.id],
  }),
}));

// ==========================================
// 5. GPS HISTORY TABLE (Real-Time Tracking)
// ==========================================
export const gpsHistory = pgTable('gps_history', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  speed: doublePrecision('speed').default(0.0),
  battery: integer('battery'),
  network: text('network'),
  address: text('address'),
}, (table) => ({
  userIdTimestampIdx: index('gps_history_user_id_timestamp_idx').on(table.userId, table.timestamp),
}));

export const gpsHistoryRelations = relations(gpsHistory, ({ one }) => ({
  user: one(users, {
    fields: [gpsHistory.userId],
    references: [users.id],
  }),
}));

// ==========================================
// 6. ACTIVITIES TABLE (Sanitation Activity Logs)
// ==========================================
export const activities = pgTable('activities', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  category: text('category').notNull(), // e.g. "Ward Inspection", "Public Toilet Inspection"
  description: text('description'),
  wardId: integer('ward_id')
    .references(() => wards.id, { onDelete: 'cascade' })
    .notNull(),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  address: text('address'),
  photo: text('photo'), // watermarked photo Unsplash URL or upload string
  remarks: text('remarks'),
  status: text('status').default('Pending').notNull(), // "Pending", "Approved", "Rejected"
  timestamp: timestamp('timestamp').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('activities_user_id_idx').on(table.userId),
  wardIdIdx: index('activities_ward_id_idx').on(table.wardId),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  user: one(users, {
    fields: [activities.userId],
    references: [users.id],
  }),
  ward: one(wards, {
    fields: [activities.wardId],
    references: [wards.id],
  }),
}));

// ==========================================
// 7. TASKS TABLE (Directives Management)
// ==========================================
export const tasks = pgTable('tasks', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  desc: text('desc'),
  priority: text('priority').default('Medium').notNull(), // "Low", "Medium", "High", "Critical"
  wardId: integer('ward_id')
    .references(() => wards.id, { onDelete: 'cascade' })
    .notNull(),
  managerId: integer('manager_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  deadline: text('deadline'), // e.g. "Today, 14:00"
  photoReq: boolean('photo_req').default(false).notNull(),
  gpsReq: boolean('gps_req').default(false).notNull(),
  status: text('status').default('Pending').notNull(), // "Pending", "In-Progress", "Completed"
  progress: integer('progress').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  managerIdIdx: index('tasks_manager_id_idx').on(table.managerId),
  wardIdIdx: index('tasks_ward_id_idx').on(table.wardId),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  manager: one(users, {
    fields: [tasks.managerId],
    references: [users.id],
  }),
  ward: one(wards, {
    fields: [tasks.wardId],
    references: [wards.id],
  }),
}));

// ==========================================
// 8. PHOTOS TABLE (Watermarked Image Proofs)
// ==========================================
export const photos = pgTable('photos', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  url: text('url').notNull(),
  category: text('category'), // e.g. "Muster", "Inspection", "Emergency"
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  address: text('address'),
  watermarkText: text('watermark_text'), // formatted with date, lat, lng, device ID
  timestamp: timestamp('timestamp').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('photos_user_id_idx').on(table.userId),
}));

export const photosRelations = relations(photos, ({ one }) => ({
  user: one(users, {
    fields: [photos.userId],
    references: [users.id],
  }),
}));

// ==========================================
// 9. NOTIFICATIONS TABLE (Push & System Logs)
// ==========================================
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' }), // nullable for global broadcast
  title: text('title').notNull(),
  body: text('body').notNull(),
  type: text('type').default('push').notNull(), // "push" or "system"
  read: boolean('read').default(false).notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('notifications_user_id_idx').on(table.userId),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

// ==========================================
// 10. REPORTS TABLE (Consolidated Reports)
// ==========================================
export const reports = pgTable('reports', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  content: text('content'), // detailed summary narrative or HTML format
  date: text('date').notNull(), // YYYY-MM-DD
  type: text('type').default('daily-activity').notNull(), // e.g. "daily-activity", "ward-compliance"
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  userIdDateIdx: index('reports_user_id_date_idx').on(table.userId, table.date),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  user: one(users, {
    fields: [reports.userId],
    references: [users.id],
  }),
}));
