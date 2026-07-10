# 🗺️ Zone Manager Management System (ZMMS) — Backend & Migration Guide

This document describes how the **Local Mock Backend** is designed, how data is persistently stored, and how to seamlessly migrate the application to **Supabase (PostgreSQL)** or **Firebase (Firestore & Auth)** when you are ready to move to production.

---

## 1. 💾 Local Mock Backend (Active & Default)

By default, the application runs on a fully self-contained, offline-first **Local Mock Backend**. This approach is ideal for local development, rapid prototyping, and offline testing.

### How it Works
1. **Unified Storage File**: All database state (Users, Attendance Logs, Activities, Tasks, and System Notifications) is stored inside `data/db.json`.
2. **Background Simulation Engine**: In `server.ts`, a background ticker runs every 12 seconds to advance the state of the 13 simulated Zone Managers (advancing their locations along real routes, decreasing batteries, changing cellular network types, and auto-submitting simulated reports and SOS alarms).
3. **Automatic Persistence**: Any action performed by supervisors (like assigning tasks, review comments) or simulated manager check-ins/check-outs writes immediately to `data/db.json` and updates the live memory tree.
4. **Resiliency**: If you restart the server, the state is reloaded from `data/db.json`, preventing any data loss.

---

## 2. ⚡ Migrating to Supabase (PostgreSQL)

The application includes a fully written production-ready **Drizzle ORM** layer designed to map directly to a PostgreSQL database (such as Supabase, Neon, or standard PostgreSQL).

### Schema Mapping
*   **Zones Table (`zones`)**: Stores administrative municipal zones.
*   **Wards Table (`wards`)**: Represents wards with foreign keys linking to zones.
*   **Users Table (`users`)**: Stores administrative supervisors and Zone Manager profiles.
*   **Attendance Table (`attendance`)**: Stores daily shift logs with biometric photos, networks, and touch signatures.
*   **Tasks Table (`tasks`)**: Tracks specific supervisor directives with priority, deadlines, and photo/GPS verification indicators.
*   **Activities Table (`activities`)**: Daily work submissions, categories, and remarks.

### Steps to Activate Supabase
1. **Set Environment Variables**: Add your database connection details to your active `.env` file or AI Studio secrets:
   ```env
   DB_PROVIDER="supabase"
   SQL_HOST="your-supabase-postgres-host.pooler.supabase.com"
   SQL_PORT="5432"
   SQL_USER="postgres"
   SQL_PASSWORD="your-secure-password"
   SQL_DATABASE="postgres"
   ```
2. **Run Migrations**: Use Drizzle Kit to push the schemas directly into your Supabase database:
   ```bash
   npm run drizzle-kit push
   ```
3. **Automatic Seeding**: Upon booting the server with `DB_PROVIDER="supabase"`, the system automatically detects if the database is empty and runs `seedDatabase()` (`src/db/seed.ts`) to populate the tables with structural zones, wards, and the default 13 Zone Manager accounts.

---

## 3. 🔥 Migrating to Firebase (Firestore & Auth)

The client-side React frontend is already pre-configured to initialize Firebase and contains a built-in interactive dashboard for Firebase operations under the **"🔥 Firebase Cloud Control"** tab in the Admin Panel.

### Existing Architecture
*   **Config File (`src/lib/firebase.ts`)**: Initializes the Firebase Web SDK, Firestore, Firebase Auth, and Storage.
*   **Visual Control Dashboard (`src/components/FirebaseControl.tsx`)**: An interactive suite allowing you to:
    *   Create and authenticate supervisor and manager accounts using **Firebase Authentication**.
    *   Review real-time Firestore collection syncs for **Zone Managers**, **Activities**, **Tasks**, and **Notifications**.
    *   Upload images directly to **Firebase Storage**.
    *   Simulate browser-level custom analytics events and crash reports directly logged to Firestore.

### Steps to Migrate Server to Firebase
1. **Provision Firebase Database**:
   *   Run the Firebase provisioning tool through the AI Studio interface.
   *   Set up Firebase Firestore in standard Native mode.
2. **Set Firestore Collection Layout**:
   Map your data models to Firestore root collections as described below:
   *   `users/{userId}`: Document for each manager/admin.
   *   `attendance/{logId}`: Subcollections or root collection storing daily check-ins.
   *   `tasks/{taskId}`: Task directives.
   *   `activities/{activityId}`: Field report logs.
3. **Configure API Route Handlers**:
   In `server.ts`, add your Firebase Admin SDK configuration and let the Express routes read and write directly to Firestore collections.
4. **Deploy Security Rules**:
   Ensure security rules in `firestore.rules` authorize supervisors to write and read all documents, while restricting managers to write only their own records:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId} {
         allow read: if request.auth != null;
         allow write: if request.auth != null && request.auth.token.role == 'admin';
       }
       match /tasks/{taskId} {
         allow read: if request.auth != null;
         allow write: if request.auth != null && request.auth.token.role == 'admin';
       }
     }
   }
   ```
