import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  onAuthStateChanged,
  type Auth
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot,
  type Firestore
} from 'firebase/firestore';
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL,
  type FirebaseStorage
} from 'firebase/storage';
import { 
  getMessaging, 
  getToken, 
  onMessage,
  type Messaging
} from 'firebase/messaging';
import { 
  getAnalytics, 
  isSupported, 
  logEvent,
  type Analytics
} from 'firebase/analytics';

// Firebase Config fallback to provisioned details
const firebaseConfig = {
  apiKey: "AIzaSyBprkBFPh_6sIrnWCeXqBdJMdp7rf3RBiQ",
  authDomain: "upbeat-jet-6fs6l.firebaseapp.com",
  projectId: "upbeat-jet-6fs6l",
  storageBucket: "upbeat-jet-6fs6l.firebasestorage.app",
  messagingSenderId: "711029020201",
  appId: "1:711029020201:web:3d0c6f11618e6d73a5ae38"
};

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Services
const auth: Auth = getAuth(app);
const db: Firestore = getFirestore(app);
const storage: FirebaseStorage = getStorage(app);

// Messaging (conditional check for service worker/browser support)
let messaging: Messaging | null = null;
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  try {
    messaging = getMessaging(app);
  } catch (err) {
    console.warn("FCM Messaging is not fully supported in this browser environment:", err);
  }
}

// Analytics (conditional check)
let analytics: Analytics | null = null;
isSupported().then(supported => {
  if (supported) {
    analytics = getAnalytics(app);
    console.log("Firebase Analytics initialized successfully");
  }
}).catch(err => {
  console.warn("Analytics not supported or blocked in this environment:", err);
});

// Custom error/crash tracking service to mimic Crashlytics for Web
export interface CrashReport {
  id?: string;
  message: string;
  stack?: string;
  timestamp: string;
  userAgent: string;
  url: string;
  severity: 'fatal' | 'error' | 'warning';
  resolved: boolean;
}

export const logCrashToFirestore = async (error: Error, severity: 'fatal' | 'error' | 'warning' = 'error') => {
  try {
    const crashData: CrashReport = {
      message: error.message || 'Unknown error',
      stack: error.stack || 'No stack trace available',
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      severity,
      resolved: false
    };
    await addDoc(collection(db, 'crashes'), crashData);
    console.log("Logged crash report to Firebase Crashlytics simulated database", crashData);
  } catch (err) {
    console.error("Failed to log crash to Firebase:", err);
  }
};

// Custom Analytics Tracker to guarantee events are visible in the UI
export interface AnalyticsEvent {
  id?: string;
  eventName: string;
  params: Record<string, any>;
  timestamp: string;
  userEmail?: string;
}

export const logAnalyticsEvent = async (eventName: string, params: Record<string, any> = {}) => {
  try {
    // 1. Client-side standard Firebase Analytics log
    if (analytics) {
      logEvent(analytics, eventName, params);
    }
    
    // 2. Client-side database sync so we can render live logs in our dashboard
    const userEmail = auth.currentUser?.email || 'anonymous';
    const eventData: AnalyticsEvent = {
      eventName,
      params,
      timestamp: new Date().toISOString(),
      userEmail
    };
    await addDoc(collection(db, 'analytics_events'), eventData);
    console.log(`Firebase Analytics logged event: ${eventName}`, eventData);
  } catch (err) {
    console.error("Failed to log analytics event:", err);
  }
};

export {
  app,
  auth,
  db,
  storage,
  messaging,
  analytics
};
