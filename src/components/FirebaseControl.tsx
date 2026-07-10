import React, { useState, useEffect } from 'react';
import { 
  auth, 
  db, 
  storage, 
  logCrashToFirestore, 
  logAnalyticsEvent,
  type CrashReport,
  type AnalyticsEvent
} from '../lib/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  type User
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import { 
  Flame, 
  Shield, 
  UserCheck, 
  Database, 
  CloudLightning, 
  BellRing, 
  Bug, 
  BarChart3, 
  RefreshCw, 
  LogIn, 
  UserPlus, 
  LogOut, 
  UploadCloud, 
  FileCheck, 
  AlertOctagon, 
  CheckCircle2, 
  Info, 
  Trash2,
  Sparkles,
  Smartphone
} from 'lucide-react';

interface ZoneManager {
  id: string;
  name: string;
  phone: string;
  empId: string;
  zone: string;
  wards: number[];
  baseLat: number;
  baseLng: number;
  status: 'checked-in' | 'checked-out';
  battery: number;
  batteryStatus: string;
  network: string;
  speed: number;
  lastUpdate: string;
  currentLat: number;
  currentLng: number;
  currentAddress: string;
  distanceTravelledKm: number;
  workingHours: number;
  idleTimeMin: number;
  totalStops: number;
  sos: boolean;
}

interface FirebaseControlProps {
  managers: ZoneManager[];
}

export default function FirebaseControl({ managers }: FirebaseControlProps) {
  // Navigation internal tabs
  const [activeSubTab, setActiveSubTab] = useState<'auth' | 'firestore' | 'storage' | 'notifications' | 'crash' | 'analytics'>('auth');
  
  // Auth States
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authSuccessMsg, setAuthSuccessMsg] = useState('');

  // Firestore Sync States
  const [syncLoading, setSyncLoading] = useState(false);
  const [firestoreManagers, setFirestoreManagers] = useState<any[]>([]);
  const [firestoreLogs, setFirestoreLogs] = useState<string[]>([]);
  const [isLiveSyncing, setIsLiveSyncing] = useState(false);

  // Cloud Storage States
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadUrl, setUploadUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<{name: string, url: string, size: number, time: string}[]>([]);

  // Push Notification States
  const [notifToken, setNotifToken] = useState('');
  const [notifTitle, setNotifTitle] = useState('🚨 EMERGENCY FIELD DISPATCH');
  const [notifBody, setNotifBody] = useState('New critical municipal desilting task assigned in Ward 13.');
  const [sendingNotif, setSendingNotif] = useState(false);
  const [sentNotifs, setSentNotifs] = useState<any[]>([]);
  const [permissionState, setPermissionState] = useState<string>('default');

  // Crash Reporting States
  const [crashErrorMsg, setCrashErrorMsg] = useState('Uncaught TypeError: Cannot read properties of undefined (reading "currentLat")');
  const [crashReports, setCrashReports] = useState<CrashReport[]>([]);
  const [crashLoading, setCrashLoading] = useState(false);

  // Analytics States
  const [analyticsEvents, setAnalyticsEvents] = useState<AnalyticsEvent[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [chartData, setChartData] = useState<Record<string, number>>({});

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        logAnalyticsEvent('firebase_user_session_active', { email: currentUser.email, uid: currentUser.uid });
      }
    });
    return () => unsubscribe();
  }, []);

  // Set up Firebase notifications permission check on load
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermissionState(Notification.permission);
    }
  }, []);

  // Fetch Firestore Managers & Live Snapshot Listener
  useEffect(() => {
    let unsubscribe: () => void = () => {};
    
    if (activeSubTab === 'firestore') {
      setIsLiveSyncing(true);
      addLog("Starting realtime onSnapshot listener for Firestore 'managers' collection...");
      
      const q = collection(db, 'managers');
      unsubscribe = onSnapshot(q, (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((doc) => {
          list.push({ docId: doc.id, ...doc.data() });
        });
        setFirestoreManagers(list);
        addLog(`Realtime Sync: Received ${list.length} managers from Firestore`);
      }, (error) => {
        addLog(`Snapshot Error: ${error.message}`);
      });
    } else {
      setIsLiveSyncing(false);
    }

    return () => unsubscribe();
  }, [activeSubTab]);

  // Listen to Crash Reports
  useEffect(() => {
    if (activeSubTab === 'crash') {
      const q = query(collection(db, 'crashes'), orderBy('timestamp', 'desc'), limit(20));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const list: CrashReport[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() as CrashReport });
        });
        setCrashReports(list);
      });
      return () => unsubscribe();
    }
  }, [activeSubTab]);

  // Listen to Analytics Events & Compute Counts
  useEffect(() => {
    if (activeSubTab === 'analytics') {
      const q = query(collection(db, 'analytics_events'), orderBy('timestamp', 'desc'), limit(50));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const list: AnalyticsEvent[] = [];
        const counts: Record<string, number> = {};
        
        snapshot.forEach((doc) => {
          const ev = doc.data() as AnalyticsEvent;
          list.push({ id: doc.id, ...ev });
          counts[ev.eventName] = (counts[ev.eventName] || 0) + 1;
        });
        
        setAnalyticsEvents(list);
        setChartData(counts);
      });
      return () => unsubscribe();
    }
  }, [activeSubTab]);

  // Helper logger for Firestore syncing
  const addLog = (msg: string) => {
    setFirestoreLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 49)]);
  };

  // Auth Submit Handlers
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setAuthError('Please input both email and password.');
      return;
    }
    setAuthLoading(true);
    setAuthError('');
    setAuthSuccessMsg('');

    try {
      if (isSignUp) {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        setAuthSuccessMsg(`Successfully registered and logged in: ${res.user.email}`);
        logAnalyticsEvent('firebase_sign_up', { email: res.user.email });
      } else {
        const res = await signInWithEmailAndPassword(auth, email, password);
        setAuthSuccessMsg(`Logged in successfully! Welcome, ${res.user.email}`);
        logAnalyticsEvent('firebase_login', { email: res.user.email });
      }
      setEmail('');
      setPassword('');
    } catch (err: any) {
      setAuthError(err.message || 'Authentication operation failed.');
      logCrashToFirestore(err, 'warning');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      const oldEmail = user?.email;
      await signOut(auth);
      setAuthSuccessMsg('Signed out successfully.');
      logAnalyticsEvent('firebase_sign_out', { email: oldEmail });
    } catch (err: any) {
      setAuthError(err.message);
    }
  };

  // Firestore operations
  const bootstrapRosterToFirestore = async () => {
    setSyncLoading(true);
    addLog(`Preparing to upload ${managers.length} Zone Managers to Cloud Firestore...`);
    logAnalyticsEvent('firestore_bootstrap_triggered', { total_managers: managers.length });

    try {
      let count = 0;
      for (const m of managers) {
        const refDoc = doc(db, 'managers', m.id);
        await setDoc(refDoc, {
          id: m.id,
          name: m.name,
          phone: m.phone,
          empId: m.empId,
          zone: m.zone,
          wards: m.wards,
          currentLat: m.currentLat,
          currentLng: m.currentLng,
          currentAddress: m.currentAddress,
          status: m.status,
          battery: m.battery,
          batteryStatus: m.batteryStatus,
          network: m.network,
          speed: m.speed,
          distanceTravelledKm: m.distanceTravelledKm,
          workingHours: m.workingHours,
          idleTimeMin: m.idleTimeMin,
          totalStops: m.totalStops,
          sos: m.sos,
          lastUpdated: new Date().toISOString()
        }, { merge: true });
        count++;
        addLog(`Uploaded manager: ${m.name} (ID: ${m.id})`);
      }
      addLog(`Success: Successfully bootstrapped ${count} managers to Cloud Firestore!`);
      logAnalyticsEvent('firestore_bootstrap_completed', { count });
    } catch (err: any) {
      addLog(`Error syncing to Firestore: ${err.message}`);
      logCrashToFirestore(err, 'error');
    } finally {
      setSyncLoading(false);
    }
  };

  const clearFirestoreRoster = async () => {
    if (!confirm("Are you sure you want to clear the Firestore managers collection? This won't affect local tracking state.")) return;
    setSyncLoading(true);
    addLog('Deleting documents in Firestore "managers" collection...');
    try {
      const q = collection(db, 'managers');
      const querySnapshot = await getDocs(q);
      let deleted = 0;
      for (const d of querySnapshot.docs) {
        await deleteDoc(doc(db, 'managers', d.id));
        deleted++;
      }
      addLog(`Successfully cleared ${deleted} documents in Firestore managers.`);
      logAnalyticsEvent('firestore_clear_managers', { deleted });
    } catch (err: any) {
      addLog(`Error clearing Firestore collection: ${err.message}`);
      logCrashToFirestore(err, 'error');
    } finally {
      setSyncLoading(false);
    }
  };

  const simulateUpdateManagerSpeed = async (managerId: string, currentSpeed: number) => {
    try {
      const refDoc = doc(db, 'managers', managerId);
      const newSpeed = Math.floor(Math.random() * 45) + 5;
      await updateDoc(refDoc, {
        speed: newSpeed,
        lastUpdated: new Date().toISOString()
      });
      addLog(`Simulated field update: Modified Speed of ZM ${managerId} to ${newSpeed} km/h`);
      logAnalyticsEvent('firestore_manager_speed_simulated', { managerId, speed: newSpeed });
    } catch (err: any) {
      addLog(`Error modifying Firestore: ${err.message}`);
    }
  };

  // Cloud Storage upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setStorageError('');
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setStorageError('Please select a file first.');
      return;
    }
    setUploading(true);
    setStorageError('');
    setUploadProgress(10); // Start progress bar

    try {
      // Create Storage reference
      const storageRef = ref(storage, `inspections/${Date.now()}_${selectedFile.name}`);
      addLog(`Cloud Storage: Uploading ${selectedFile.name} (${Math.round(selectedFile.size / 1024)} KB)`);
      
      setUploadProgress(40);
      
      // Upload bytes
      const snapshot = await uploadBytes(storageRef, selectedFile);
      setUploadProgress(75);

      // Get download URL
      const downloadUrl = await getDownloadURL(snapshot.ref);
      setUploadProgress(100);
      setUploadUrl(downloadUrl);
      
      // Add to local uploaded history list
      setUploadedFiles(prev => [
        {
          name: selectedFile.name,
          url: downloadUrl,
          size: selectedFile.size,
          time: new Date().toLocaleTimeString()
        },
        ...prev
      ]);

      logAnalyticsEvent('storage_file_uploaded', { 
        filename: selectedFile.name, 
        size: selectedFile.size, 
        contentType: selectedFile.type 
      });

      addLog(`Cloud Storage: File uploaded successfully! Available at: ${downloadUrl.substring(0, 50)}...`);
      setSelectedFile(null);
    } catch (err: any) {
      setStorageError(err.message || 'Upload failed. Ensure Cloud Storage is active.');
      logCrashToFirestore(err, 'error');
    } finally {
      setUploading(false);
    }
  };

  // Push Notifications simulation
  const handleRequestNotificationPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const permission = await Notification.requestPermission();
      setPermissionState(permission);
      logAnalyticsEvent('push_permission_requested', { result: permission });
      
      if (permission === 'granted') {
        // Generate a beautifully simulated token to display to user
        const simulatedToken = 'fcm_tok_NCT_DELHI_' + Math.random().toString(36).substring(2, 15).toUpperCase();
        setNotifToken(simulatedToken);
        alert('🔔 Notifications Permission Granted! Simulated FCM Token generated successfully.');
      } else {
        alert('⚠️ Notification permission denied. Ensure permissions are allowed in browser options.');
      }
    } else {
      alert('This browser does not support standard Push Notifications.');
    }
  };

  const sendSimulatedPush = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitle || !notifBody) return;
    setSendingNotif(true);

    try {
      // Log event
      logAnalyticsEvent('push_notification_dispatched', { title: notifTitle, body: notifBody });

      // Save to Firebase database
      const notifData = {
        title: notifTitle,
        body: notifBody,
        timestamp: new Date().toISOString(),
        recipient: 'All NCT Officers',
        delivered: true
      };
      const docRef = await addDoc(collection(db, 'push_notifications'), notifData);

      // Pop real browser push notification if granted
      if (permissionState === 'granted' && typeof window !== 'undefined') {
        try {
          new Notification(notifTitle, {
            body: notifBody,
            icon: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=60&auto=format&fit=crop&q=60'
          });
        } catch (err) {
          console.warn("Standard notification failed to spawn in background, falling back to app UI alert.");
        }
      }

      setSentNotifs(prev => [{ id: docRef.id, ...notifData }, ...prev]);
      addLog(`Push Notification broadcasted: "${notifTitle}"`);
      
      // Reset inputs
      setNotifTitle('🚨 EMERGENCY FIELD DISPATCH');
      setNotifBody('New critical municipal desilting task assigned in Ward 13.');
    } catch (err: any) {
      addLog(`Push Error: ${err.message}`);
    } finally {
      setSendingNotif(false);
    }
  };

  // Simulated Crash triggers
  const triggerSimulatedCrash = () => {
    try {
      // Simulate real JavaScript exception being thrown
      throw new TypeError(crashErrorMsg);
    } catch (err: any) {
      logCrashToFirestore(err, 'fatal');
      logAnalyticsEvent('crash_triggered_simulated', { errorClass: 'TypeError', message: crashErrorMsg });
      alert('💥 Simulated App Exception generated and intercepted! Exception payload securely transmitted to Firebase Crashlytics database.');
    }
  };

  const handleResolveCrash = async (crashId: string) => {
    try {
      await updateDoc(doc(db, 'crashes', crashId), {
        resolved: true,
        resolvedAt: new Date().toISOString()
      });
      logAnalyticsEvent('crash_resolved', { crashId });
    } catch (err: any) {
      console.error(err);
    }
  };

  // Quick custom event logger
  const triggerCustomAnalyticsEvent = (eventName: string) => {
    logAnalyticsEvent(eventName, {
      simulatedTime: new Date().toLocaleTimeString(),
      triggerPlatform: 'Web Admin Dashboard',
      uniqueId: Math.floor(Math.random() * 900000) + 100000
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      
      {/* Firebase Header */}
      <div className="bg-gradient-to-r from-[#e65100] to-[#f57c00] text-white p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-white/10 p-2.5 rounded-xl backdrop-blur-md">
            <Flame className="w-8 h-8 text-[#ffa726] animate-pulse fill-[#ffa726]" />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
              Firebase Suite Command Center
              <span className="text-[10px] tracking-wider uppercase font-bold bg-white/20 border border-white/30 px-2 py-0.5 rounded-full">ACTIVE</span>
            </h2>
            <p className="text-xs text-orange-100 mt-0.5">Real-time Cloud Database, Authentication, Cloud Storage, Analytics, FCM Push & Crashlytics Portal</p>
          </div>
        </div>

        {/* Firebase SDK Config Alert */}
        <div className="bg-orange-950/40 border border-orange-400/20 px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs">
          <Shield className="w-4 h-4 text-orange-300" />
          <span className="text-orange-100">Project Config: <strong className="font-mono text-white">upbeat-jet-6fs6l</strong></span>
        </div>
      </div>

      {/* Sub navigation Tabs */}
      <div className="bg-slate-50 border-b border-slate-200 p-1 flex flex-wrap gap-1">
        <button
          onClick={() => { setActiveSubTab('auth'); logAnalyticsEvent('firebase_tab_switched', { tab: 'auth' }); }}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-all ${activeSubTab === 'auth' ? 'bg-[#ff6f00] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Firebase Auth</span>
        </button>

        <button
          onClick={() => { setActiveSubTab('firestore'); logAnalyticsEvent('firebase_tab_switched', { tab: 'firestore' }); }}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-all ${activeSubTab === 'firestore' ? 'bg-[#ff6f00] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
        >
          <Database className="w-4 h-4" />
          <span>Cloud Firestore</span>
          {firestoreManagers.length > 0 && (
            <span className="bg-orange-700 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-bounce">
              {firestoreManagers.length}
            </span>
          )}
        </button>

        <button
          onClick={() => { setActiveSubTab('storage'); logAnalyticsEvent('firebase_tab_switched', { tab: 'storage' }); }}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-all ${activeSubTab === 'storage' ? 'bg-[#ff6f00] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
        >
          <CloudLightning className="w-4 h-4" />
          <span>Cloud Storage</span>
        </button>

        <button
          onClick={() => { setActiveSubTab('notifications'); logAnalyticsEvent('firebase_tab_switched', { tab: 'notifications' }); }}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-all ${activeSubTab === 'notifications' ? 'bg-[#ff6f00] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
        >
          <BellRing className="w-4 h-4" />
          <span>Push Notifications</span>
        </button>

        <button
          onClick={() => { setActiveSubTab('crash'); logAnalyticsEvent('firebase_tab_switched', { tab: 'crash' }); }}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-all ${activeSubTab === 'crash' ? 'bg-[#ff6f00] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
        >
          <Bug className="w-4 h-4" />
          <span>Crash Reporting</span>
          {crashReports.filter(c => !c.resolved).length > 0 && (
            <span className="bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
              {crashReports.filter(c => !c.resolved).length}
            </span>
          )}
        </button>

        <button
          onClick={() => { setActiveSubTab('analytics'); logAnalyticsEvent('firebase_tab_switched', { tab: 'analytics' }); }}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-all ${activeSubTab === 'analytics' ? 'bg-[#ff6f00] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Firebase Analytics</span>
        </button>
      </div>

      {/* Main Panel Content Box */}
      <div className="p-5 min-h-[400px]">
        
        {/* ======================= SUB TAB: AUTHENTICATION ======================= */}
        {activeSubTab === 'auth' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 leading-relaxed">
            
            {/* Info Panel */}
            <div className="md:col-span-5 space-y-4">
              <div className="bg-orange-50 border border-orange-200/50 rounded-xl p-4">
                <h3 className="font-extrabold text-sm text-[#e65100] flex items-center gap-1.5">
                  <Shield className="w-4 h-4" />
                  <span>Secure Firebase Authentication</span>
                </h3>
                <p className="text-xs text-slate-600 mt-2">
                  Firebase Authentication provides secure client-side sign-up and sign-in operations. The session is managed on secure Google infrastructure.
                </p>
                <ul className="text-slate-500 font-mono text-[10px] space-y-1 mt-3 list-disc list-inside">
                  <li>Email & Password validation</li>
                  <li>Local IndexedDB session persistence</li>
                  <li>OIDC compliant tokens and claims</li>
                </ul>
              </div>

              {/* Status Section */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-xs text-slate-500 font-bold uppercase">Auth Session Status</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-black ${user ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                    {user ? 'AUTHENTICATED' : 'ANONYMOUS'}
                  </span>
                </div>

                {user ? (
                  <div className="space-y-2.5">
                    <div className="text-xs space-y-1">
                      <p className="text-slate-500">Log Email:</p>
                      <p className="font-bold text-slate-800 font-mono">{user.email}</p>
                    </div>
                    <div className="text-xs space-y-1">
                      <p className="text-slate-500">Firebase User ID (UID):</p>
                      <p className="font-mono text-slate-700 bg-white p-1.5 border rounded text-[9px] select-all truncate">{user.uid}</p>
                    </div>
                    <button
                      onClick={handleSignOut}
                      className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 font-bold text-xs py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Terminate Auth Session</span>
                    </button>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 italic py-3 text-center">
                    No active authenticated session. Please register or sign in via the right hand interface to test Firebase Auth.
                  </div>
                )}
              </div>
            </div>

            {/* Form Section */}
            <div className="md:col-span-7 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
              <div className="border-b pb-3">
                <h4 className="font-extrabold text-sm text-slate-800 flex items-center gap-1.5">
                  {isSignUp ? <UserPlus className="w-4 h-4 text-blue-600" /> : <LogIn className="w-4 h-4 text-emerald-600" />}
                  <span>{isSignUp ? 'Create New Firebase Account' : 'Sign In with Registered Account'}</span>
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Test real-time user database creation and authentication triggers in the Firebase cloud backend.</p>
              </div>

              {authError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-lg flex items-start gap-2">
                  <AlertOctagon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span className="font-mono">{authError}</span>
                </div>
              )}

              {authSuccessMsg && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs p-3 rounded-lg flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                  <span>{authSuccessMsg}</span>
                </div>
              )}

              <form onSubmit={handleAuthSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-600 font-bold block">Supervisor Email Address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="supervisor@muncipal.delhi.gov.in"
                    className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-orange-500 bg-slate-50"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-600 font-bold block">Password (min 6 characters)</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-orange-500 bg-slate-50"
                  />
                </div>

                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setIsSignUp(!isSignUp)}
                    className="text-xs text-blue-600 hover:underline font-bold"
                  >
                    {isSignUp ? 'Already registered? Log In here' : "Need an account? Sign Up here"}
                  </button>

                  <button
                    type="submit"
                    disabled={authLoading}
                    className="bg-[#e65100] hover:bg-[#d84315] text-white font-extrabold text-xs px-5 py-2.5 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm w-full sm:w-auto justify-center"
                  >
                    {authLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : isSignUp ? (
                      <UserPlus className="w-4 h-4" />
                    ) : (
                      <LogIn className="w-4 h-4" />
                    )}
                    <span>{authLoading ? 'Requesting Firebase...' : isSignUp ? 'Sign Up New User' : 'Sign In'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ======================= SUB TAB: CLOUD FIRESTORE ======================= */}
        {activeSubTab === 'firestore' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 leading-relaxed">
            
            {/* Live Config & Logging */}
            <div className="lg:col-span-5 space-y-4">
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
                <h4 className="font-extrabold text-xs text-slate-700 uppercase tracking-wider">Firestore Provisioning Settings</h4>
                
                <div className="text-[11px] space-y-2 font-mono">
                  <div className="flex justify-between border-b border-slate-200/50 pb-1.5">
                    <span className="text-slate-400">Database ID:</span>
                    <span className="font-bold text-slate-700 truncate max-w-[200px]">
                      ai-studio-zonemanagermonit-7ca70ebf-bd64-429c-ae44-7fc0538a8312
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/50 pb-1.5">
                    <span className="text-slate-400">Sync Status:</span>
                    <span className="font-bold text-emerald-600 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      Active Listener
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Cloud Syncs:</span>
                    <span className="font-bold text-slate-700">{firestoreManagers.length} Documents</span>
                  </div>
                </div>

                <div className="pt-2 flex flex-col gap-2">
                  <button
                    onClick={bootstrapRosterToFirestore}
                    disabled={syncLoading}
                    className="bg-[#e65100] hover:bg-[#d84315] text-white font-extrabold text-xs py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-sm"
                  >
                    <UploadCloud className="w-4 h-4 animate-bounce" />
                    <span>Bootstrap Roster to Firestore</span>
                  </button>

                  <button
                    onClick={clearFirestoreRoster}
                    disabled={syncLoading}
                    className="border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear Cloud Documents</span>
                  </button>
                </div>
              </div>

              {/* Activity Sync Logs */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-900 text-slate-200 font-mono text-[10px] space-y-2 h-[210px] flex flex-col justify-between">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                  <span className="text-blue-400 font-bold">📡 Real-time Client Sync Logs</span>
                  <span className="text-slate-500 text-[9px]">Last 50 entries</span>
                </div>
                <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                  {firestoreLogs.length === 0 ? (
                    <div className="text-slate-500 italic py-6 text-center">No transactions logged yet. Trigger synchronization to stream updates.</div>
                  ) : (
                    firestoreLogs.map((log, i) => (
                      <div key={i} className="leading-normal truncate text-slate-300 border-l border-orange-500/30 pl-2">
                        {log}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Document Data List Grid */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col h-[410px]">
              <div className="border-b pb-3 mb-3 flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold text-sm text-slate-800 flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-[#ff6f00]" />
                    <span>Live Cloud Firestore Grid</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Showing real-time synced documents inside the <code>managers</code> collection.</p>
                </div>
                <span className="bg-orange-50 border border-orange-200 text-orange-700 text-[9px] font-bold px-2 py-0.5 rounded font-mono">
                  Collection: managers
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin">
                {firestoreManagers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400 space-y-3">
                    <Database className="w-10 h-10 text-slate-300 animate-pulse" />
                    <div>
                      <p className="font-bold text-xs text-slate-500">Firestore Database is Empty</p>
                      <p className="text-[10px] text-slate-400 max-w-xs mt-1">Click the "Bootstrap Roster" button on the left to write and sync the initial 13 Zone Managers!</p>
                    </div>
                  </div>
                ) : (
                  firestoreManagers.map((m) => (
                    <div key={m.id} className="border border-slate-100 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-200 p-3 rounded-lg flex items-center justify-between gap-4 transition-all">
                      <div className="space-y-1 truncate">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${m.sos ? 'bg-red-500 animate-pulse' : m.status === 'checked-in' ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                          <span className="font-bold text-xs text-slate-800">{m.name}</span>
                          <span className="text-[9px] font-mono bg-blue-100 text-blue-800 px-1.5 rounded">ID: {m.empId}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 truncate">
                          📍 {m.currentAddress || 'Offline'}
                        </p>
                        <p className="text-[9px] text-slate-400 font-mono">
                          Zone: {m.zone} • Speed: {m.speed} km/h • Battery: {m.battery}% • Last cloud push: {m.lastUpdated ? new Date(m.lastUpdated).toLocaleTimeString() : 'N/A'}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => simulateUpdateManagerSpeed(m.id, m.speed)}
                          className="bg-white border hover:bg-slate-50 hover:border-slate-300 p-1.5 rounded text-[10px] font-bold text-slate-600 flex items-center gap-1 transition"
                          title="Trigger Simulated GPS Speed change in Firestore document"
                        >
                          <Smartphone className="w-3 h-3 text-orange-500" />
                          <span>Simulate Ping</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ======================= SUB TAB: CLOUD STORAGE ======================= */}
        {activeSubTab === 'storage' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 leading-relaxed">
            
            {/* Info and Select Section */}
            <div className="md:col-span-5 space-y-4">
              <div className="bg-orange-50 border border-orange-200/50 rounded-xl p-4">
                <h3 className="font-extrabold text-sm text-[#e65100] flex items-center gap-1.5">
                  <CloudLightning className="w-4 h-4" />
                  <span>Cloud Storage for Inspection Media</span>
                </h3>
                <p className="text-xs text-slate-600 mt-2">
                  Cloud Storage stores inspection logs, site photographs, attendance webcam self-portraits, and signatures. It secures files on Google Cloud bucket servers and generates temporary and public download links.
                </p>
              </div>

              {/* File selection block */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
                <div className="border-b pb-2">
                  <span className="text-xs text-slate-700 font-extrabold uppercase">Upload Field Inspection Photograph</span>
                </div>

                <form onSubmit={handleUploadSubmit} className="space-y-3.5">
                  <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 bg-white text-center hover:border-orange-500 transition-colors relative cursor-pointer">
                    <input
                      type="file"
                      onChange={handleFileChange}
                      accept="image/*,application/pdf"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-2 animate-bounce" />
                    <p className="text-xs font-bold text-slate-700">
                      {selectedFile ? selectedFile.name : 'Choose file or drag & drop'}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">PNG, JPG, PDF up to 10MB</p>
                  </div>

                  {selectedFile && (
                    <div className="text-[10px] text-slate-600 font-mono bg-slate-100 p-2 rounded">
                      <div>File size: {Math.round(selectedFile.size / 1024)} KB</div>
                      <div>Mime Type: {selectedFile.type}</div>
                    </div>
                  )}

                  {storageError && (
                    <div className="text-xs text-red-600 font-mono leading-relaxed bg-red-50 border border-red-100 p-2 rounded">
                      ⚠️ {storageError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={uploading || !selectedFile}
                    className="w-full bg-[#e65100] hover:bg-[#d84315] disabled:opacity-50 text-white font-extrabold text-xs py-2 rounded-lg flex items-center justify-center gap-1.5 transition shadow"
                  >
                    {uploading ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <FileCheck className="w-3.5 h-3.5" />
                    )}
                    <span>{uploading ? 'Uploading to Bucket...' : 'Upload Attachment to Storage'}</span>
                  </button>
                </form>

                {uploading && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[9px] font-mono text-slate-500">
                      <span>Uploading Progress</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-[#ff6f00] h-full rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Uploaded Files inspector */}
            <div className="md:col-span-7 bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col h-[410px]">
              <div className="border-b pb-3 mb-3">
                <h4 className="font-extrabold text-sm text-slate-800">Cloud Storage Bucket Inspector</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Bucket path: <code className="text-orange-700">gs://upbeat-jet-6fs6l.firebasestorage.app/inspections/</code></p>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 scrollbar-thin">
                {uploadedFiles.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center text-slate-400 space-y-2">
                    <UploadCloud className="w-10 h-10 text-slate-300" />
                    <p className="font-bold text-xs text-slate-500">No photos uploaded to Storage in this session</p>
                    <p className="text-[10px] text-slate-400">Upload an inspection photo in the left panel to test real-time Google Cloud Storage bucket injection.</p>
                  </div>
                ) : (
                  uploadedFiles.map((file, i) => (
                    <div key={i} className="border border-slate-100 bg-slate-50/50 p-3 rounded-lg space-y-2.5 hover:border-slate-200 transition-all">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-0.5 truncate">
                          <span className="text-[10px] font-bold font-mono text-orange-600 uppercase">Bucket File #{uploadedFiles.length - i}</span>
                          <h6 className="text-xs font-black text-slate-800 truncate">{file.name}</h6>
                          <p className="text-[9px] text-slate-400 font-mono">Size: {Math.round(file.size / 1024)} KB • Time: {file.time}</p>
                        </div>
                        <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[8px] font-extrabold px-1.5 py-0.5 rounded">UPLOADED</span>
                      </div>

                      <div className="flex gap-2 items-center bg-white p-2 border border-slate-100 rounded-lg">
                        {file.name.match(/\.(jpeg|jpg|gif|png)$/i) ? (
                          <img src={file.url} alt={file.name} className="w-12 h-12 object-cover rounded border border-slate-200 flex-shrink-0" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-12 h-12 bg-slate-100 border border-slate-200 rounded flex items-center justify-center text-slate-400 font-bold text-xs flex-shrink-0">PDF</div>
                        )}
                        <div className="flex-1 truncate space-y-1">
                          <span className="text-[9px] text-slate-400 block font-mono">Download Reference Link:</span>
                          <input type="text" readOnly value={file.url} className="w-full text-[9px] font-mono text-blue-600 bg-slate-50 p-1 rounded border focus:outline-none select-all cursor-pointer" />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ======================= SUB TAB: PUSH NOTIFICATIONS ======================= */}
        {activeSubTab === 'notifications' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 leading-relaxed">
            
            {/* FCM Token Config */}
            <div className="md:col-span-5 space-y-4">
              <div className="bg-orange-50 border border-orange-200/50 rounded-xl p-4">
                <h3 className="font-extrabold text-sm text-[#e65100] flex items-center gap-1.5">
                  <BellRing className="w-4 h-4" />
                  <span>Firebase Cloud Messaging (FCM)</span>
                </h3>
                <p className="text-xs text-slate-600 mt-2">
                  FCM transmits instant background payloads, emergency dispatch pings, and ward level directives to all active zone officers without battery drain.
                </p>
              </div>

              {/* Token Registration Card */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-xs text-slate-700 font-extrabold uppercase">FCM Subscription Status</span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${permissionState === 'granted' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                    {permissionState}
                  </span>
                </div>

                <div className="space-y-3">
                  <p className="text-[11px] text-slate-500">
                    To trigger live browser notifications from Firebase, you must authorize this app to spawn background banners first.
                  </p>

                  {permissionState !== 'granted' && (
                    <button
                      onClick={handleRequestNotificationPermission}
                      className="w-full bg-[#e65100] hover:bg-[#d84315] text-white font-bold text-xs py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition"
                    >
                      <BellRing className="w-4 h-4" />
                      <span>Grant Browser Push Permission</span>
                    </button>
                  )}

                  {notifToken && (
                    <div className="space-y-1">
                      <span className="text-[9px] text-slate-400 block font-mono font-bold uppercase">Active FCM Registration Token:</span>
                      <p className="font-mono text-[9px] text-emerald-700 bg-white p-2 border border-emerald-200 rounded break-all select-all leading-normal">
                        {notifToken}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* FCM Broadcast Portal */}
            <div className="md:col-span-7 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
              <div className="border-b pb-3">
                <h4 className="font-extrabold text-sm text-slate-800 flex items-center gap-1.5">
                  <BellRing className="w-4 h-4 text-orange-500 animate-swing" />
                  <span>Broadcast Directives to FCM Devices</span>
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Push messaging logs are stored dynamically in the <code>push_notifications</code> Firestore collection.</p>
              </div>

              <form onSubmit={sendSimulatedPush} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-xs text-slate-600 font-bold block">Push Notification Title</label>
                  <input
                    type="text"
                    required
                    value={notifTitle}
                    onChange={(e) => setNotifTitle(e.target.value)}
                    placeholder="🚨 EMERGENCY FIELD DISPATCH"
                    className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-orange-500 bg-slate-50 font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-600 font-bold block">Push Notification Body Message</label>
                  <textarea
                    required
                    rows={2}
                    value={notifBody}
                    onChange={(e) => setNotifBody(e.target.value)}
                    placeholder="Provide details of the municipal alert to broadcast..."
                    className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-orange-500 bg-slate-50 leading-relaxed font-mono"
                  ></textarea>
                </div>

                <button
                  type="submit"
                  disabled={sendingNotif}
                  className="w-full bg-[#e65100] hover:bg-[#d84315] disabled:opacity-50 text-white font-extrabold text-xs py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                >
                  <CloudLightning className="w-4 h-4" />
                  <span>{sendingNotif ? 'Dispatching Payloads...' : 'Broadcast Push via Firebase'}</span>
                </button>
              </form>

              {/* History tracker */}
              <div className="pt-2 border-t space-y-2">
                <span className="text-[10px] text-slate-400 block font-mono font-bold uppercase">Sent Notifications Session Feed:</span>
                <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                  {sentNotifs.length === 0 ? (
                    <div className="text-[10px] text-slate-400 italic text-center py-2">No broadcast payloads dispatched yet.</div>
                  ) : (
                    sentNotifs.map((n, idx) => (
                      <div key={idx} className="bg-slate-50 border border-slate-200 rounded p-2 text-[10px] space-y-0.5">
                        <div className="flex justify-between font-bold text-slate-700">
                          <span>{n.title}</span>
                          <span className="text-slate-400 font-mono font-normal">{new Date(n.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-slate-500 font-mono truncate">{n.body}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================= SUB TAB: CRASH REPORTING ======================= */}
        {activeSubTab === 'crash' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 leading-relaxed">
            
            {/* Crash Console */}
            <div className="md:col-span-5 space-y-4">
              <div className="bg-orange-50 border border-orange-200/50 rounded-xl p-4">
                <h3 className="font-extrabold text-sm text-[#e65100] flex items-center gap-1.5">
                  <Bug className="w-4 h-4" />
                  <span>Firebase Crashlytics Diagnostics</span>
                </h3>
                <p className="text-xs text-slate-600 mt-2">
                  To replicate mobile Crashlytics inside our web monitor, we have built an automated global exception logger. Every JavaScript error is logged to Firestore for triage.
                </p>
              </div>

              {/* Simulator Controls */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
                <div className="border-b pb-2">
                  <span className="text-xs text-slate-700 font-extrabold uppercase">Trigger Simulated Client Crash</span>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold block uppercase">Custom Exception Message:</label>
                    <input
                      type="text"
                      value={crashErrorMsg}
                      onChange={(e) => setCrashErrorMsg(e.target.value)}
                      className="w-full text-[10px] font-mono border border-slate-200 rounded p-2 bg-white text-red-700"
                    />
                  </div>

                  <button
                    onClick={triggerSimulatedCrash}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs py-2.5 rounded-lg flex items-center justify-center gap-2 transition"
                  >
                    <Bug className="w-4 h-4 animate-bounce" />
                    <span>Force Web Exception & Send Report</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Crashlytics logs feed */}
            <div className="md:col-span-7 bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col h-[410px]">
              <div className="border-b pb-3 mb-3 flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold text-sm text-slate-800 flex items-center gap-1.5">
                    <AlertOctagon className="w-4 h-4 text-red-600 animate-pulse" />
                    <span>Live Crashlytics Log Stream ({crashReports.filter(c => !c.resolved).length} Unresolved)</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Streams real-time exceptions logged to the <code>crashes</code> Firestore collection.</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
                {crashReports.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center text-slate-400 space-y-2">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                    <p className="font-bold text-xs text-slate-700">All Systems Clear - 0 Crashes</p>
                    <p className="text-[10px] text-slate-400">Throw an exception in the left pane to check live logging.</p>
                  </div>
                ) : (
                  crashReports.map((crash) => (
                    <div key={crash.id} className={`border p-3 rounded-lg space-y-2 transition-all ${crash.resolved ? 'bg-slate-50/50 border-slate-100 opacity-60' : 'bg-red-50/30 border-red-100'}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-0.5 truncate">
                          <span className={`text-[8px] font-black font-mono px-1.5 py-0.5 rounded uppercase ${crash.severity === 'fatal' ? 'bg-red-600 text-white animate-pulse' : 'bg-amber-100 text-amber-800'}`}>
                            {crash.severity} Exception
                          </span>
                          <h6 className="text-xs font-black text-red-800 mt-1 truncate">{crash.message}</h6>
                          <p className="text-[9px] text-slate-400 font-mono">Logged at: {new Date(crash.timestamp).toLocaleString()}</p>
                        </div>

                        {!crash.resolved ? (
                          <button
                            onClick={() => handleResolveCrash(crash.id!)}
                            className="bg-white hover:bg-emerald-50 border hover:border-emerald-200 text-emerald-700 text-[10px] font-bold px-2 py-1 rounded"
                          >
                            Triage & Resolve
                          </button>
                        ) : (
                          <span className="text-emerald-600 text-[10px] font-extrabold flex items-center gap-1 bg-emerald-50 px-2 py-0.5 border border-emerald-200 rounded">
                            ✓ RESOLVED
                          </span>
                        )}
                      </div>

                      <div className="bg-slate-900 text-slate-200 p-2 rounded text-[9px] font-mono whitespace-pre-wrap max-h-[80px] overflow-y-auto leading-relaxed border border-slate-800">
                        {crash.stack || 'No stack trace provided'}
                      </div>

                      <div className="text-[8px] text-slate-400 font-mono truncate">
                        URL: {crash.url} | UserAgent: {crash.userAgent}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ======================= SUB TAB: ANALYTICS ======================= */}
        {activeSubTab === 'analytics' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 leading-relaxed">
            
            {/* Custom Events Console */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-orange-50 border border-orange-200/50 rounded-xl p-4">
                <h3 className="font-extrabold text-sm text-[#e65100] flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4" />
                  <span>Google Analytics for Firebase</span>
                </h3>
                <p className="text-xs text-slate-600 mt-2">
                  Tracks telemetry parameters such as check-in rates, GPS latency logs, SOS triggers, and administrative reports generation.
                </p>
              </div>

              {/* Quick Event Buttons */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
                <div className="border-b pb-2">
                  <span className="text-xs text-slate-700 font-extrabold uppercase">Trigger Custom Analytics Log</span>
                </div>

                <p className="text-[11px] text-slate-500">
                  Select and click on a telemetry button to instantly stream custom parameters directly into Firebase Cloud Analytics.
                </p>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={() => triggerCustomAnalyticsEvent('admin_reports_csv_exported')}
                    className="bg-white border hover:bg-slate-100 p-2 rounded-lg text-[10px] font-bold text-slate-700 flex flex-col items-center text-center gap-1 transition"
                  >
                    <FileCheck className="w-4 h-4 text-orange-500" />
                    <span>CSV Exported</span>
                  </button>

                  <button
                    onClick={() => triggerCustomAnalyticsEvent('sos_test_beacon_shunted')}
                    className="bg-white border hover:bg-slate-100 p-2 rounded-lg text-[10px] font-bold text-slate-700 flex flex-col items-center text-center gap-1 transition"
                  >
                    <AlertOctagon className="w-4 h-4 text-red-500" />
                    <span>SOS Shunted</span>
                  </button>

                  <button
                    onClick={() => triggerCustomAnalyticsEvent('gps_latency_ping_healthy')}
                    className="bg-white border hover:bg-slate-100 p-2 rounded-lg text-[10px] font-bold text-slate-700 flex flex-col items-center text-center gap-1 transition"
                  >
                    <CloudLightning className="w-4 h-4 text-blue-500" />
                    <span>GPS Latency OK</span>
                  </button>

                  <button
                    onClick={() => triggerCustomAnalyticsEvent('ai_telem_audit_request')}
                    className="bg-white border hover:bg-slate-100 p-2 rounded-lg text-[10px] font-bold text-slate-700 flex flex-col items-center text-center gap-1 transition"
                  >
                    <Sparkles className="w-4 h-4 text-[#ff6f00]" />
                    <span>AI Audit Run</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Analytics feed chart and table */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col h-[410px]">
              <div className="border-b pb-3 mb-3 flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold text-sm text-slate-800 flex items-center gap-1.5">
                    <BarChart3 className="w-4 h-4 text-orange-500" />
                    <span>Live Analytics Stream (Last 50 Logs)</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Real-time telemetry event streams in <code>analytics_events</code> Firestore collection.</p>
                </div>
              </div>

              {/* Simulated Chart */}
              {Object.keys(chartData).length > 0 && (
                <div className="bg-slate-50 border border-slate-200/60 p-3 rounded-lg mb-3 flex flex-col gap-2">
                  <span className="text-[9px] font-bold text-slate-500 font-mono uppercase">Event Distribution Graph (SVG)</span>
                  <div className="flex items-end justify-between h-14 pt-2 gap-3 border-b border-slate-200">
                    {Object.entries(chartData).map(([evName, count], idx) => {
                      const max = Math.max(...(Object.values(chartData) as number[]));
                      const countNum = count as number;
                      const heightPercent = max > 0 ? (countNum / max) * 100 : 0;
                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                          <div 
                            style={{ height: `${Math.max(heightPercent, 10)}%` }} 
                            className="bg-[#ffa726] hover:bg-[#e65100] rounded-t w-full transition-all duration-300 relative"
                          >
                            <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[8px] font-black text-slate-700 font-mono">
                              {count}
                            </span>
                          </div>
                          <span className="text-[7px] text-slate-400 truncate w-full text-center mt-1 font-mono font-bold" title={evName}>
                            {evName.replace('firebase_', '')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                {analyticsEvents.length === 0 ? (
                  <div className="text-center py-24 text-slate-400 italic text-xs">No analytics logged yet. Perform interactions to capture triggers.</div>
                ) : (
                  analyticsEvents.map((ev) => (
                    <div key={ev.id} className="bg-slate-50 border border-slate-200/50 p-2.5 rounded-lg flex items-center justify-between text-[10px] hover:bg-slate-100 transition-colors">
                      <div className="space-y-0.5 truncate">
                        <div className="flex items-center gap-1.5 font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
                          <span className="text-slate-800 truncate">{ev.eventName}</span>
                        </div>
                        <p className="text-slate-400 font-mono text-[9px] truncate">
                          Params: {JSON.stringify(ev.params || {})}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-4 font-mono text-slate-400 text-[9px] space-y-0.5">
                        <p className="text-slate-500 font-bold">{ev.userEmail}</p>
                        <p>{new Date(ev.timestamp).toLocaleTimeString()}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info Ribbon */}
      <div className="bg-slate-50 border-t border-slate-200 p-3 text-[10px] text-slate-500 font-mono flex flex-col sm:flex-row justify-between gap-2">
        <span>Cloud Infrastructure: Google Firebase Client SDK &amp; Node Firebase Admin Suite</span>
        <span>Version: Firebase Client v12.15.0</span>
      </div>
    </div>
  );
}
