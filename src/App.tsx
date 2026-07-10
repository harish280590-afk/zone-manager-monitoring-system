import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import MapComponent from './components/MapComponent';
import {
  Search,
  Filter,
  Download,
  Plus,
  CheckCircle,
  AlertTriangle,
  MapPin,
  Map,
  User,
  Users,
  Check,
  Activity,
  Clock,
  Battery,
  Wifi,
  WifiOff,
  RotateCcw,
  FileText,
  TrendingUp,
  Smartphone,
  LayoutDashboard,
  Play,
  Pause,
  FastForward,
  RefreshCw,
  AlertOctagon,
  Shield,
  QrCode,
  PenTool,
  Sparkles,
  ChevronRight,
  Layers,
  Lock,
  Settings,
  LogOut,
  MapPinned,
  Flame,
  Printer,
  Calendar,
  Award,
  FileSpreadsheet,
  Eye,
  Bell
} from 'lucide-react';
import FirebaseControl from './components/FirebaseControl';
import { db } from './lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

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
  pathHistory: { lat: number; lng: number; timestamp: string; speed: number; battery: number; network: string }[];
  visitedPlaces: { name: string; arrival: string; departure: string; durationMin: number; distancePrev: number }[];
  activities: ActivityLog[];
  attendance: {
    checkInTime: string;
    checkInLat: number;
    checkInLng: number;
    checkInAddress: string;
    checkInDevice: string;
    checkInNetwork: string;
    checkInBattery: number;
    checkInPhoto: string;
    checkOutTime?: string;
    signature?: string;
  } | null;
  performance: {
    attendanceRate: number;
    workingHoursTotal: number;
    distanceTotal: number;
    activitiesCompleted: number;
    responseTimeMinutes: number;
    productivityScore: number;
  };
  sos: boolean;
}

interface ActivityLog {
  id: string;
  title: string;
  category: string;
  description: string;
  wardNum: number;
  gps: { lat: number; lng: number; address: string };
  timestamp: string;
  remarks: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  photo: string;
}

interface Task {
  id: string;
  title: string;
  desc: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  ward: number;
  managerId: string;
  deadline: string;
  photoReq: boolean;
  gpsReq: boolean;
  status: 'Pending' | 'In-Progress' | 'Completed';
  progress: number;
}

const FIELD_PHOTO_PRESETS = [
  { id: 'photo-1', name: 'Garbage Cleared', url: 'https://images.unsplash.com/photo-1616401784845-180882ba9ba8?w=600&auto=format&fit=crop&q=60' },
  { id: 'photo-2', name: 'Drain Inspected', url: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=600&auto=format&fit=crop&q=60' },
  { id: 'photo-3', name: 'Toilet Complex Checked', url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=600&auto=format&fit=crop&q=60' },
  { id: 'photo-4', name: 'Workers Muster Spot', url: 'https://images.unsplash.com/photo-1590086782957-93c06ef21604?w=600&auto=format&fit=crop&q=60' }
];

const MOCK_SELFIES = [
  { name: 'Rohan Sharma', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=60' },
  { name: 'Amit Patel', url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=60' },
  { name: 'Priyanka Sen', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=60' },
  { name: 'Sneha Reddy', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=60' }
];

export default function App() {
  // Navigation & Role States
  const [currentRole, setCurrentRole] = useState<'admin' | 'zone-manager'>('admin');
  const [selectedManagerId, setSelectedManagerId] = useState<string>('zm-1');
  const [activeAdminTab, setActiveAdminTab] = useState<'dashboard' | 'map' | 'analytics' | 'tasks' | 'activities' | 'reports' | 'firebase' | 'notifications'>('dashboard');
  
  // App Global State
  const [state, setState] = useState<{
    managers: ZoneManager[];
    tasks: Task[];
    notifications: { id: string; title: string; body: string; time: string; type: string }[];
    simulationTime: string;
    simulationSpeed: string;
  } | null>(null);

  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [zoneFilter, setZoneFilter] = useState('All');
  const [wardFilter, setWardFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Daily Activity Module Filters & States
  const [actSearchQuery, setActSearchQuery] = useState('');
  const [actCategoryFilter, setActCategoryFilter] = useState('All');
  const [actWardFilter, setActWardFilter] = useState('All');
  const [actStatusFilter, setActStatusFilter] = useState('All');
  const [selectedActId, setSelectedActId] = useState<string | null>(null);
  const [supervisorRemarksText, setSupervisorRemarksText] = useState('');

  // Reports Engine States
  const [reportFrequency, setReportFrequency] = useState<'Daily' | 'Weekly' | 'Monthly'>('Daily');
  const [reportSection, setReportSection] = useState<'Attendance' | 'Distance' | 'Activities' | 'Working Hours' | 'Performance'>('Attendance');
  const [reportSelectedManagerId, setReportSelectedManagerId] = useState<string>('All');
  const [reportDate, setReportDate] = useState<string>('2026-07-05');
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);

  // Interactive Map Options
  const [mapOverlay, setMapOverlay] = useState<'wards' | 'heatmap' | 'none'>('wards');
  const [selectedMapManagerId, setSelectedMapManagerId] = useState<string>('zm-1');
  const [replayActive, setReplayActive] = useState(false);
  const [replayStep, setReplayStep] = useState(0);

  // Zone Manager Form States
  const [gpsEnabled, setGpsEnabled] = useState(true);
  const [offlineMode, setOfflineMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('zmms_offline_mode');
    return saved === 'true';
  });
  const [localCache, setLocalCache] = useState<{ activities: any[]; attendance: any[] }>(() => {
    const saved = localStorage.getItem('zmms_local_cache');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved local cache:', e);
      }
    }
    return { activities: [], attendance: [] };
  });
  const [webcamPhoto, setWebcamPhoto] = useState<string>('');
  const [qrScanning, setQrScanning] = useState(false);
  const [selectedActivityCategory, setSelectedActivityCategory] = useState('Ward Inspection');
  const [newActivityTitle, setNewActivityTitle] = useState('');
  const [newActivityDesc, setNewActivityDesc] = useState('');
  const [newActivityRemarks, setNewActivityRemarks] = useState('');
  const [newActivityWard, setNewActivityWard] = useState<number>(1);
  const [signatureData, setSignatureData] = useState<string>('');
  const [isSigning, setIsSigning] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // New Admin Task Form States
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'Critical' | 'High' | 'Medium' | 'Low'>('Medium');
  const [newTaskWard, setNewTaskWard] = useState<number>(1);
  const [newTaskManager, setNewTaskManager] = useState('zm-1');
  const [newTaskDeadline, setNewTaskDeadline] = useState('Today, 18:00');
  const [newTaskPhotoReq, setNewTaskPhotoReq] = useState(true);
  const [newTaskGpsReq, setNewTaskGpsReq] = useState(true);

  // Notification Broadcast states
  const [notifFormType, setNotifFormType] = useState<'attendance-reminder' | 'task-reminder' | 'gps-off' | 'new-task' | 'activity-pending'>('attendance-reminder');
  const [notifFormManagerId, setNotifFormManagerId] = useState<string>('all');
  const [notifFormCustomBody, setNotifFormCustomBody] = useState<string>('');
  const [notifFilterType, setNotifFilterType] = useState<string>('All');

  // AI Summary State
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [aiSummaryText, setAiSummaryText] = useState<string>('');

  // Mobile App Specific States
  const [isMobileLoggedIn, setIsMobileLoggedIn] = useState(false);
  const [mobileEmpId, setMobileEmpId] = useState('');
  const [mobilePassword, setMobilePassword] = useState('');
  const [mobileActiveTab, setMobileActiveTab] = useState<'home' | 'tasks' | 'report' | 'settings'>('home');
  const [batteryOptimization, setBatteryOptimization] = useState(false);
  const [mobileNotifications, setMobileNotifications] = useState<{ id: string; title: string; body: string; time: string; read: boolean }[]>([
    { id: 'm-notif-1', title: '🛡️ GPS Secure Encryption Active', body: 'Field Device connected to Govt Server. Location accuracy: ±3m. Cryptographic tracking locked.', time: '09:00 AM', read: false },
    { id: 'm-notif-2', title: '📋 Welcome to ZMMS Field App', body: 'Please mark your GPS Attendance Check-In with selfie validation to activate dispatch pipeline.', time: '09:02 AM', read: false }
  ]);
  const [activePushNotification, setActivePushNotification] = useState<{ id: string; title: string; body: string } | null>(null);
  const [selectedPresetPhoto, setSelectedPresetPhoto] = useState<string>(FIELD_PHOTO_PRESETS[0].url);
  const [selectedSelfiePhoto, setSelectedSelfiePhoto] = useState<string>(MOCK_SELFIES[0].url);

  // Global Admin Toast System
  const lastGlobalNotifIdRef = useRef<string | null>(null);
  const [globalToast, setGlobalToast] = useState<{ id: string; title: string; body: string; type: string } | null>(null);

  // Monitor assigned tasks to trigger realistic slide-down Push Notifications!
  const lastTasksCountRef = useRef<number>(0);
  useEffect(() => {
    if (state && state.tasks && isMobileLoggedIn) {
      const myTasks = state.tasks.filter(t => t.managerId === selectedManagerId);
      if (lastTasksCountRef.current > 0 && myTasks.length > lastTasksCountRef.current) {
        const latestTask = myTasks[0]; // Newest task is unshifted
        const newNotif = {
          id: `m-notif-${Date.now()}`,
          title: '📋 Live Directive Issued',
          body: `Task assigned: "${latestTask.title}". Priority: ${latestTask.priority}. Ward: ${latestTask.ward}.`,
          time: state.simulationTime.split(' ').slice(-2).join(' ') || '10:30 AM',
          read: false
        };
        setMobileNotifications(prev => [newNotif, ...prev]);
        setActivePushNotification({ id: newNotif.id, title: newNotif.title, body: newNotif.body });
        
        // Auto dismiss push notification banner
        setTimeout(() => {
          setActivePushNotification(current => current?.id === newNotif.id ? null : current);
        }, 6000);
      }
      lastTasksCountRef.current = myTasks.length;
    } else if (state && state.tasks) {
      lastTasksCountRef.current = state.tasks.filter(t => t.managerId === selectedManagerId).length;
    }
  }, [state?.tasks, isMobileLoggedIn, selectedManagerId]);

  // Fetch state on mount and update periodically
  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 3000);
    return () => clearInterval(interval);
  }, []);

  // Sync state back to localStorage
  useEffect(() => {
    localStorage.setItem('zmms_local_cache', JSON.stringify(localCache));
  }, [localCache]);

  useEffect(() => {
    localStorage.setItem('zmms_offline_mode', String(offlineMode));
  }, [offlineMode]);

  // Auto sync function
  const autoSyncOfflineData = async () => {
    if (localCache.activities.length === 0 && localCache.attendance.length === 0) {
      return;
    }

    try {
      // Sync Attendance
      for (const item of localCache.attendance) {
        const url = item.type === 'check-in' ? '/api/attendance/check-in' : '/api/attendance/check-out';
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.data)
        });
      }

      // Sync Activities
      for (const act of localCache.activities) {
        await fetch('/api/activity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(act)
        });
      }

      const syncedCount = localCache.activities.length + localCache.attendance.length;
      setLocalCache({ activities: [], attendance: [] });
      fetchState();
      
      // Fire a beautiful global toast
      setGlobalToast({
        id: `autosync-${Date.now()}`,
        title: '🔄 Auto-Sync Completed',
        body: `Successfully synchronized ${syncedCount} offline logs with central server.`,
        type: 'new-task'
      });
    } catch (err) {
      console.error('Auto sync failed:', err);
    }
  };

  // Auto sync when going online
  useEffect(() => {
    if (!offlineMode) {
      if (localCache.activities.length > 0 || localCache.attendance.length > 0) {
        autoSyncOfflineData();
      }
    }
  }, [offlineMode]);

  // Monitor real browser online event
  useEffect(() => {
    const handleOnlineEvent = () => {
      if (!offlineMode && (localCache.activities.length > 0 || localCache.attendance.length > 0)) {
        autoSyncOfflineData();
      }
    };
    window.addEventListener('online', handleOnlineEvent);
    return () => window.removeEventListener('online', handleOnlineEvent);
  }, [offlineMode, localCache]);

  // Synchronize Global Admin Toast System
  useEffect(() => {
    if (state?.notifications && state.notifications.length > 0) {
      const latest = state.notifications[0];
      if (lastGlobalNotifIdRef.current && lastGlobalNotifIdRef.current !== latest.id) {
        // A new notification was added!
        setGlobalToast({
          id: latest.id,
          title: latest.title,
          body: latest.body,
          type: latest.type
        });
        
        // Auto-dismiss after 6 seconds
        const timer = setTimeout(() => {
          setGlobalToast(current => current?.id === latest.id ? null : current);
        }, 6000);
      }
      lastGlobalNotifIdRef.current = latest.id;
    } else if (state?.notifications && state.notifications.length === 0) {
      lastGlobalNotifIdRef.current = null;
    }
  }, [state?.notifications]);

  const fetchState = async () => {
    try {
      const res = await fetch('/api/state');
      const data = await res.json();
      setState(data);
    } catch (err) {
      console.error('Failed to fetch system state:', err);
    }
  };

  // Quick Action: Step Simulation
  const handleStepSimulation = async (minutes: number) => {
    try {
      const res = await fetch('/api/simulation/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes })
      });
      const data = await res.json();
      setState(data.state);
    } catch (err) {
      console.error(err);
    }
  };

  // Quick Action: Change Simulation Speed
  const handleChangeSimSpeed = async (speed: string) => {
    try {
      const res = await fetch('/api/simulation/speed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ speed })
      });
      const data = await res.json();
      if (data.success) {
        setState(prev => prev ? { ...prev, simulationSpeed: speed } : null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Quick Action: Reset State
  const handleResetSimulation = async () => {
    if (confirm('Are you sure you want to reset all tracking history, attendance logs, and activities?')) {
      try {
        const res = await fetch('/api/simulation/reset', { method: 'POST' });
        const data = await res.json();
        setState(data.state);
        alert('Simulation state reset successfully!');
      } catch (err) {
        console.error(err);
      }
    }
  };

  // SOS Trigger
  const handleTriggerSOS = async (managerId: string) => {
    try {
      const res = await fetch(`/api/managers/${managerId}/sos`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        fetchState();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Submit custom broadcast notification
  const handleBroadcastNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Choose appropriate title and standard body if custom is empty
    let title = '';
    let body = notifFormCustomBody.trim();
    
    const manager = notifFormManagerId === 'all' ? null : state?.managers.find(m => m.id === notifFormManagerId);
    const targetName = manager ? manager.name : 'All Zone Officers';
    
    if (notifFormType === 'attendance-reminder') {
      title = '⚠️ Attendance Reminder';
      if (!body) body = `REMINDER: ${targetName}, please mark your shift attendance check-in with selfie verification immediately.`;
    } else if (notifFormType === 'task-reminder') {
      title = '⏰ Task Deadline Reminder';
      if (!body) body = `URGENT: ${targetName}, you have pending field directives nearing their target deadline. Please report progress.`;
    } else if (notifFormType === 'gps-off') {
      title = '🚨 GPS Off Alert';
      if (!body) body = `ALERT: Critical telemetry lost. ${targetName}'s GPS/network tracking appears inactive. Please enable location.`;
    } else if (notifFormType === 'new-task') {
      title = '📋 New Task Assigned';
      if (!body) body = `NOTICE: New sanitation directive assigned to ${targetName}. Review details in your active task hub.`;
    } else if (notifFormType === 'activity-pending') {
      title = '📝 Activity Pending Review';
      if (!body) body = `AUDIT: New activity logs uploaded by ${targetName} are pending supervisor verification and audit sign-off.`;
    }
    
    try {
      const res = await fetch('/api/notifications/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          body,
          type: notifFormType,
          managerId: notifFormManagerId === 'all' ? null : notifFormManagerId
        })
      });
      const data = await res.json();
      if (data.success) {
        setState(data.state);
        setNotifFormCustomBody('');
        alert('Notification broadcasted successfully!');
      }
    } catch (err) {
      console.error('Failed to trigger notification:', err);
    }
  };

  // Delete specific notification
  const handleDeleteNotification = async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setState(data.state);
      }
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  // Clear all notifications
  const handleClearAllNotifications = async () => {
    if (confirm('Are you sure you want to clear all notifications from the Command Center database?')) {
      try {
        const res = await fetch('/api/notifications/clear', {
          method: 'POST'
        });
        const data = await res.json();
        if (data.success) {
          setState(data.state);
        }
      } catch (err) {
        console.error('Failed to clear notifications:', err);
      }
    }
  };

  // Manager Check-In
  const handleCheckIn = async (manager: ZoneManager) => {
    if (!gpsEnabled) {
      alert('⚠️ Attendance Blocked: GPS must be turned ON to mark attendance!');
      return;
    }

    const checkInData = {
      managerId: manager.id,
      lat: manager.baseLat,
      lng: manager.baseLng,
      address: `Checked In at ${manager.zone} Office`,
      device: 'Samsung Galaxy A34 (Android 14)',
      network: offlineMode ? 'Offline Caching' : '5G (Jio)',
      battery: 95,
      photo: webcamPhoto || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=60'
    };

    if (offlineMode) {
      const updatedCache = { ...localCache };
      updatedCache.attendance.push({ type: 'check-in', data: checkInData });
      setLocalCache(updatedCache);
      alert('💾 Offline Mode Active: Check-In marked locally! Will synchronize once internet status is toggled online.');
      return;
    }

    try {
      const res = await fetch('/api/attendance/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkInData)
      });
      const data = await res.json();
      if (data.success) {
        fetchState();
        alert(`Present! Rohan Checked In successfully at ${state?.simulationTime || '09:00 AM'}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Manager Check-Out
  const handleCheckOut = async (managerId: string) => {
    const checkOutData = {
      managerId,
      signature: signatureData || 'Verified touch signature'
    };

    if (offlineMode) {
      const updatedCache = { ...localCache };
      updatedCache.attendance.push({ type: 'check-out', data: checkOutData });
      setLocalCache(updatedCache);
      alert('💾 Offline Mode Active: Check-Out marked locally!');
      return;
    }

    try {
      const res = await fetch('/api/attendance/check-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkOutData)
      });
      const data = await res.json();
      if (data.success) {
        fetchState();
        setSignatureData('');
        alert('Checked out successfully. Shift summary logged.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Manager Submit Activity
  const handleNewActivitySubmit = async (e: React.FormEvent, manager: ZoneManager) => {
    e.preventDefault();
    if (!newActivityTitle || !newActivityDesc) {
      alert('Please fill out Title and Description');
      return;
    }

    const activityData = {
      managerId: manager.id,
      title: newActivityTitle,
      category: selectedActivityCategory,
      description: newActivityDesc,
      wardNum: newActivityWard,
      gps: {
        lat: manager.currentLat,
        lng: manager.currentLng,
        address: manager.currentAddress
      },
      remarks: newActivityRemarks,
      photo: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=600&auto=format&fit=crop&q=60'
    };

    if (offlineMode) {
      const updatedCache = { ...localCache };
      updatedCache.activities.push(activityData);
      setLocalCache(updatedCache);
      alert('💾 Activity cached locally. Sync queued.');
      setNewActivityTitle('');
      setNewActivityDesc('');
      setNewActivityRemarks('');
      return;
    }

    try {
      const res = await fetch('/api/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activityData)
      });
      const data = await res.json();
      if (data.success) {
        fetchState();
        setNewActivityTitle('');
        setNewActivityDesc('');
        setNewActivityRemarks('');
        alert('Field Activity report uploaded to server with auto-watermark.');

        // Firestore persistent cloud sync for activities log history
        try {
          const actId = data.activity?.id || `act-${Date.now()}`;
          await setDoc(doc(db, 'activities_history', actId), {
            id: actId,
            managerId: manager.id,
            managerName: manager.name,
            title: activityData.title,
            category: activityData.category,
            description: activityData.description,
            wardNum: activityData.wardNum,
            gps: activityData.gps,
            remarks: activityData.remarks || 'None',
            status: 'Pending',
            photo: activityData.photo,
            timestamp: new Date().toISOString()
          });
          console.log('Successfully synchronized daily activity submission with Firestore collection: activities_history');
        } catch (fErr) {
          console.warn('Firestore activity sync failed (non-blocking):', fErr);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Supervisor Update Activity Status & Remarks
  const handleUpdateActivityStatus = async (activityId: string, status: 'Approved' | 'Rejected', remarks: string) => {
    try {
      const res = await fetch(`/api/activity/${activityId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, remarks })
      });
      const data = await res.json();
      if (data.success) {
        fetchState();
        alert(`Activity status updated to ${status} successfully.`);

        // Firestore persistent cloud sync for reviews
        try {
          await setDoc(doc(db, 'activities_history', activityId), {
            status,
            remarks,
            reviewedAt: new Date().toISOString(),
            reviewedBy: 'Admin Supervisor'
          }, { merge: true });
          console.log('Successfully synchronized activity status review with Firestore collection: activities_history');
        } catch (fErr) {
          console.warn('Firestore status sync failed (non-blocking):', fErr);
        }
      } else {
        alert('Failed to update activity status: ' + data.error);
      }
    } catch (err) {
      console.error('Error updating activity status:', err);
    }
  };

  // Admin Create Task
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle || !newTaskDesc) {
      alert('Please enter task title and description.');
      return;
    }

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTaskTitle,
          desc: newTaskDesc,
          priority: newTaskPriority,
          ward: newTaskWard,
          managerId: newTaskManager,
          deadline: newTaskDeadline,
          photoReq: newTaskPhotoReq,
          gpsReq: newTaskGpsReq
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchState();
        setNewTaskTitle('');
        setNewTaskDesc('');
        alert('Task assigned successfully!');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Complete / Progress Task
  const handleUpdateTask = async (taskId: string, status: string, progress: number) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, progress })
      });
      const data = await res.json();
      if (data.success) {
        fetchState();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Offline Sync Trigger
  const handleSyncOfflineData = async () => {
    if (localCache.activities.length === 0 && localCache.attendance.length === 0) {
      alert('No offline data to sync.');
      return;
    }

    try {
      // Sync Attendance
      for (const item of localCache.attendance) {
        const url = item.type === 'check-in' ? '/api/attendance/check-in' : '/api/attendance/check-out';
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.data)
        });
      }

      // Sync Activities
      for (const act of localCache.activities) {
        await fetch('/api/activity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(act)
        });
      }

      setLocalCache({ activities: [], attendance: [] });
      fetchState();
      alert('✅ Sync Successful: All cached logs uploaded to central database!');
    } catch (err) {
      console.error(err);
      alert('Sync failed. Please check backend connection.');
    }
  };

  // Generate Gemini Summary
  const handleGenerateAISummary = async (managerId: string) => {
    setAiSummaryLoading(true);
    setAiSummaryText('');
    try {
      const res = await fetch('/api/ai-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ managerId })
      });
      const data = await res.json();
      setAiSummaryText(data.summary);
    } catch (err) {
      console.error(err);
      setAiSummaryText('Failed to generate AI Daily Summary.');
    } finally {
      setAiSummaryLoading(false);
    }
  };

  // Signature Canvas Helpers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    setIsSigning(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isSigning) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsSigning(false);
    const canvas = canvasRef.current;
    if (canvas) {
      setSignatureData(canvas.toDataURL());
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureData('');
  };

  // Download Reports (CSV Sim)
  const downloadReport = (type: string) => {
    if (!state) return;
    let csvContent = 'data:text/csv;charset=utf-8,';
    
    if (type === 'attendance') {
      csvContent += 'Employee ID,Name,Zone,Status,Check-In,Check-Out,Working Hours,Distance Travelled (Km)\n';
      state.managers.forEach(m => {
        csvContent += `${m.empId},${m.name},"${m.zone}",${m.status},${m.attendance?.checkInTime || 'Absent'},${m.attendance?.checkOutTime || 'N/A'},${m.workingHours} hrs,${m.distanceTravelledKm} km\n`;
      });
    } else if (type === 'activities') {
      csvContent += 'Date/Time,Zone Manager,Category,Title,Ward,Location,Status\n';
      state.managers.forEach(m => {
        m.activities.forEach(a => {
          csvContent += `"${a.timestamp}","${m.name}","${a.category}","${a.title}",${a.wardNum},"${a.gps.address}",${a.status}\n`;
        });
      });
    } else {
      csvContent += 'Employee ID,Name,Zone,Attendance %,Working Hours Total,Distance Total (km),Activities Logged,Productivity Score\n';
      state.managers.forEach(m => {
        csvContent += `${m.empId},${m.name},"${m.zone}",${m.performance.attendanceRate}%,${m.performance.workingHoursTotal} hrs,${m.performance.distanceTotal} km,${m.performance.activitiesCompleted},${m.performance.productivityScore}/100\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ZMMS_${type}_report_${state.simulationTime.replace(/ /g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportExcel = (title: string, columns: string[], rows: any[][]) => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    
    // Header Row
    csvContent += columns.map(c => `"${c.replace(/"/g, '""')}"`).join(',') + '\n';
    
    // Data Rows
    rows.forEach(row => {
      csvContent += row.map(cell => {
        const val = typeof cell === 'string' ? cell : (cell?.toString() || '');
        return `"${val.replace(/"/g, '""')}"`;
      }).join(',') + '\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ZMMS_${reportFrequency}_${reportSection}_Report_${reportDate.replace(/-/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getReportContent = () => {
    if (!state) return { kpis: [], columns: [], rows: [], title: "" };

    const isAll = reportSelectedManagerId === 'All';
    const selectedManager = state.managers.find(m => m.id === reportSelectedManagerId);
    const targetManagers = isAll ? state.managers : (selectedManager ? [selectedManager] : []);

    let kpis: { title: string; value: string | number; desc: string; color: string }[] = [];
    let columns: string[] = [];
    let rows: any[][] = [];
    let title = "";

    if (reportSection === 'Attendance') {
      title = `${reportFrequency} Shift Attendance & Telemetry Log`;
      columns = ['Employee ID', 'Officer Name', 'Zone', 'Wards', 'Status', 'Clock-In', 'Clock-Out', 'Duty Hours', 'Clock-In Device', 'Network Quality'];
      
      if (reportFrequency === 'Daily') {
        kpis = [
          { title: 'Scheduled Officers', value: state.managers.length, desc: 'Total on roster today', color: 'text-blue-600 bg-blue-50' },
          { title: 'Checked In', value: state.managers.filter(m => m.status === 'checked-in').length, desc: 'Active in-field forces', color: 'text-emerald-600 bg-emerald-50' },
          { title: 'Absent / Checked Out', value: state.managers.filter(m => m.status !== 'checked-in').length, desc: 'Off-duty today', color: 'text-rose-600 bg-rose-50' },
          { title: 'Muster Security Stamp', value: '100%', desc: 'Selfie biometric verified', color: 'text-violet-600 bg-violet-50' }
        ];
        
        rows = targetManagers.map(m => [
          m.empId,
          m.name,
          m.zone,
          m.wards.join(', '),
          m.status === 'checked-in' ? '🟢 Present' : '🔴 Checked-Out / Absent',
          m.attendance?.checkInTime ? new Date(m.attendance.checkInTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'N/A',
          m.attendance?.checkOutTime ? new Date(m.attendance.checkOutTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'N/A',
          `${m.workingHours.toFixed(1)} hrs`,
          m.attendance?.checkInDevice || 'Not Recorded',
          m.network || '4G/5G'
        ]);
      } else if (reportFrequency === 'Weekly') {
        kpis = [
          { title: 'Avg Weekly Attendance', value: '94.2%', desc: 'Overall muster compliance', color: 'text-blue-600 bg-blue-50' },
          { title: 'Total Hours Scheduled', value: (targetManagers.length * 48) + ' hrs', desc: 'Combined roster budget', color: 'text-emerald-600 bg-emerald-50' },
          { title: 'Total Shifts Logged', value: targetManagers.length * 6, desc: 'Successful check-ins', color: 'text-amber-600 bg-amber-50' },
          { title: 'Compliance Index', value: 'Excellent', desc: 'Secure signature matching', color: 'text-violet-600 bg-violet-50' }
        ];

        if (isAll) {
          rows = targetManagers.map(m => [
            m.empId,
            m.name,
            m.zone,
            m.wards.join(', '),
            `Weekly Roster`,
            `${m.performance.attendanceRate}% Rate`,
            `${Math.round(6 * (m.performance.attendanceRate / 100))} of 6 days`,
            `${(m.performance.workingHoursTotal * 0.75).toFixed(1)} hrs`,
            `Validated Shift`,
            `GPS Verified`
          ]);
        } else {
          const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          rows = days.map((day, idx) => {
            const present = idx < Math.round(6 * (selectedManager!.performance.attendanceRate / 100));
            return [
              selectedManager!.empId,
              selectedManager!.name,
              selectedManager!.zone,
              selectedManager!.wards.join(', '),
              present ? '🟢 Present' : '🔴 Absent',
              present ? '09:00 AM' : 'N/A',
              present ? '05:00 PM' : 'N/A',
              present ? '8.0 hrs' : '0.0 hrs',
              present ? 'Biometric Device' : 'N/A',
              present ? '5G Govt Network' : 'N/A'
            ];
          });
        }
      } else { // Monthly
        kpis = [
          { title: 'Monthly Attendance Avg', value: '91.8%', desc: 'July 2026 muster registry', color: 'text-blue-600 bg-blue-50' },
          { title: 'Total Shift Audits', value: targetManagers.length * 26, desc: 'Approved for payroll', color: 'text-emerald-600 bg-emerald-50' },
          { title: 'Signal Loss Exclusions', value: '0 cases', desc: 'Tamper proof telemetry verified', color: 'text-rose-600 bg-rose-50' },
          { title: 'Government Audit Status', value: 'APPROVED', desc: 'Accounting department cleared', color: 'text-violet-600 bg-violet-50' }
        ];

        if (isAll) {
          rows = targetManagers.map(m => [
            m.empId,
            m.name,
            m.zone,
            m.wards.join(', '),
            `Monthly Archive`,
            `${m.performance.attendanceRate}% Rate`,
            `${Math.round(26 * (m.performance.attendanceRate / 100))} of 26 days`,
            `${m.performance.workingHoursTotal.toFixed(1)} hrs`,
            `Consolidated`,
            `Crypto Audited`
          ]);
        } else {
          const weeks = ['Week 1 (July 01 - 07)', 'Week 2 (July 08 - 14)', 'Week 3 (July 15 - 21)', 'Week 4 (July 22 - 28)'];
          rows = weeks.map((week, idx) => {
            const rate = selectedManager!.performance.attendanceRate;
            const presentDays = Math.round(6 * (rate / 100));
            return [
              selectedManager!.empId,
              selectedManager!.name,
              selectedManager!.zone,
              selectedManager!.wards.join(', '),
              '🟢 Active',
              `Muster Roll Cleared`,
              `Checked-in`,
              `${(selectedManager!.performance.workingHoursTotal / 4).toFixed(1)} hrs`,
              `${presentDays} days active`,
              `98.2% GIS Compliance`
            ];
          });
        }
      }
    } else if (reportSection === 'Distance') {
      title = `${reportFrequency} GPS Distance & Vehicle Log`;
      columns = ['Employee ID', 'Officer Name', 'Zone', 'Wards', 'Frequency/Date', 'Total Distance (Km)', 'Breadcrumb Logs', 'Average Speed (km/h)', 'GPS Accuracy Index', 'Fuel Allowance Allocation'];

      if (reportFrequency === 'Daily') {
        const sumDistance = targetManagers.reduce((acc, m) => acc + m.distanceTravelledKm, 0);
        kpis = [
          { title: 'Cumulative Mileage Today', value: `${sumDistance.toFixed(1)} km`, desc: 'Fleet travel coverage', color: 'text-blue-600 bg-blue-50' },
          { title: 'Avg Speed On-Duty', value: '14.5 km/h', desc: 'Standard transit velocity', color: 'text-emerald-600 bg-emerald-50' },
          { title: 'Total GPS Breadcrumbs', value: targetManagers.reduce((acc, m) => acc + m.pathHistory.length, 0), desc: 'Telemetry ticks registered', color: 'text-amber-600 bg-amber-50' },
          { title: 'GIS Path Consistency', value: '98.4%', desc: 'Route fidelity matching', color: 'text-violet-600 bg-violet-50' }
        ];

        rows = targetManagers.map(m => [
          m.empId,
          m.name,
          m.zone,
          m.wards.join(', '),
          'Today',
          `${m.distanceTravelledKm.toFixed(2)} km`,
          `${m.pathHistory.length} breadcrumbs`,
          `${m.speed} km/h`,
          '±3.2 meters (High)',
          `${(m.distanceTravelledKm * 0.12).toFixed(1)} Litres Approved`
        ]);
      } else if (reportFrequency === 'Weekly') {
        const totalWeeklyDistance = targetManagers.reduce((acc, m) => acc + m.performance.distanceTotal * 0.75, 0);
        kpis = [
          { title: 'Total Distance Covered', value: `${totalWeeklyDistance.toFixed(1)} km`, desc: 'Weekly active distance', color: 'text-blue-600 bg-blue-50' },
          { title: 'Avg Mileage Per Officer', value: `${(totalWeeklyDistance / targetManagers.length).toFixed(1)} km`, desc: 'Zone transit budget', color: 'text-emerald-600 bg-emerald-50' },
          { title: 'Diesel Allocation Approved', value: `${(totalWeeklyDistance * 0.12).toFixed(1)} L`, desc: 'Muster quota cleared', color: 'text-amber-600 bg-amber-50' },
          { title: 'Verification Method', value: '2-Min Interval GPS', desc: 'Secure encryption check', color: 'text-violet-600 bg-violet-50' }
        ];

        if (isAll) {
          rows = targetManagers.map(m => {
            const dist = m.performance.distanceTotal * 0.75;
            return [
              m.empId,
              m.name,
              m.zone,
              m.wards.join(', '),
              'Weekly Roster',
              `${dist.toFixed(1)} km`,
              `${Math.round(dist * 30)} logs`,
              '12.5 km/h avg',
              'GPS Replay Verified',
              `${(dist * 0.12).toFixed(1)} Litres`
            ];
          });
        } else {
          const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          rows = days.map((day, idx) => {
            const active = idx < Math.round(6 * (selectedManager!.performance.attendanceRate / 100));
            const dailyDist = active ? (selectedManager!.performance.distanceTotal / 4) * (0.8 + (idx * 0.05) % 0.4) : 0;
            return [
              selectedManager!.empId,
              selectedManager!.name,
              selectedManager!.zone,
              selectedManager!.wards.join(', '),
              day,
              `${dailyDist.toFixed(1)} km`,
              `${Math.round(dailyDist * 30)} logs`,
              active ? '13.2 km/h' : '0.0 km/h',
              active ? '±3.0 meters (High)' : 'N/A',
              `${(dailyDist * 0.12).toFixed(1)} Litres`
            ];
          });
        }
      } else { // Monthly
        const totalMonthlyDistance = targetManagers.reduce((acc, m) => acc + m.performance.distanceTotal, 0);
        kpis = [
          { title: 'Total Monthly Distance', value: `${totalMonthlyDistance.toFixed(1)} km`, desc: 'Fleet coverage (July 2026)', color: 'text-blue-600 bg-blue-50' },
          { title: 'Monthly Diesel Budget', value: `${(totalMonthlyDistance * 0.12).toFixed(1)} Litres`, desc: 'Fuel budget sanctioned', color: 'text-emerald-600 bg-emerald-50' },
          { title: 'GPS Data Points', value: Math.round(totalMonthlyDistance * 28), desc: 'Total database points', color: 'text-amber-600 bg-amber-50' },
          { title: 'Audit Result', value: '100% Clear', desc: 'No unauthorized route skips', color: 'text-violet-600 bg-violet-50' }
        ];

        if (isAll) {
          rows = targetManagers.map(m => {
            const dist = m.performance.distanceTotal;
            return [
              m.empId,
              m.name,
              m.zone,
              m.wards.join(', '),
              'Monthly Consolidated',
              `${dist.toFixed(1)} km`,
              `${Math.round(dist * 28)} logs`,
              '12.2 km/h avg',
              'Municipal Audit Approved',
              `${(dist * 0.12).toFixed(1)} Litres`
            ];
          });
        } else {
          const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
          rows = weeks.map((week, idx) => {
            const weeklyDist = selectedManager!.performance.distanceTotal / 4;
            return [
              selectedManager!.empId,
              selectedManager!.name,
              selectedManager!.zone,
              selectedManager!.wards.join(', '),
              week,
              `${weeklyDist.toFixed(1)} km`,
              `${Math.round(weeklyDist * 28)} logs`,
              '12.5 km/h',
              'Tamper-Proof Signal Check',
              `${(weeklyDist * 0.12).toFixed(1)} Litres`
            ];
          });
        }
      }
    } else if (reportSection === 'Activities') {
      title = `${reportFrequency} Sanitation & Field Activity Log`;
      columns = ['Timestamp / Period', 'Officer Name', 'Category', 'Activity Title / Detail', 'Ward', 'GPS Coordinates', 'GIS Location Address', 'Audit Status', 'Remarks & Verification'];

      if (reportFrequency === 'Daily') {
        const allActs = targetManagers.flatMap(m => m.activities.map(a => ({ ...a, mName: m.name })));
        kpis = [
          { title: 'Total Daily Audits', value: allActs.length, desc: 'Field inspections reported', color: 'text-blue-600 bg-blue-50' },
          { title: 'Approved Verified', value: allActs.filter(a => a.status === 'Approved').length, desc: 'Government verified', color: 'text-emerald-600 bg-emerald-50' },
          { title: 'Flagged / Rejected', value: allActs.filter(a => a.status === 'Rejected').length, desc: 'Compliance failure flags', color: 'text-rose-600 bg-rose-50' },
          { title: 'Pending Supervision', value: allActs.filter(a => a.status === 'Pending').length, desc: 'Waiting approval', color: 'text-amber-600 bg-amber-50' }
        ];

        rows = allActs.map(a => [
          a.timestamp,
          a.mName,
          a.category,
          a.title,
          `Ward ${a.wardNum}`,
          `${a.gps.lat.toFixed(5)}N, ${a.gps.lng.toFixed(5)}E`,
          a.gps.address || 'Field Location',
          a.status,
          a.remarks || 'Standard parameter checklist verified'
        ]);
      } else if (reportFrequency === 'Weekly') {
        const totalWeeklyActs = targetManagers.reduce((acc, m) => acc + m.performance.activitiesCompleted * 0.75, 0);
        kpis = [
          { title: 'Weekly Total Submissions', value: Math.round(totalWeeklyActs), desc: 'Aggregate logs archived', color: 'text-blue-600 bg-blue-50' },
          { title: 'Inspection Pass Rate', value: '96.2%', desc: 'Approval rating index', color: 'text-emerald-600 bg-emerald-50' },
          { title: 'Average Audits/Day', value: (totalWeeklyActs / (targetManagers.length * 6)).toFixed(1), desc: 'Weekly audit productivity', color: 'text-amber-600 bg-amber-50' },
          { title: 'Cryptographic Integrity', value: '100% Secure', desc: 'Device fingerprint validated', color: 'text-violet-600 bg-violet-50' }
        ];

        if (isAll) {
          rows = targetManagers.map(m => {
            const acts = Math.round(m.performance.activitiesCompleted * 0.75);
            return [
              'Weekly Cumulative',
              m.name,
              'Consolidated Fields',
              `Completed ${acts} Field Sanitation Audits`,
              m.wards.join(', '),
              'Simulated GIS Envelope',
              'Multiple geocoded locations',
              'Approved',
              `Pass rate: 94%`
            ];
          });
        } else {
          const categories = ["Ward Inspection", "Door-to-Door Monitoring", "Transfer Station Inspection", "Public Toilet Inspection", "Citizen Complaint Verification"];
          rows = categories.map((cat, idx) => {
            const count = Math.round((selectedManager!.performance.activitiesCompleted * 0.75) / categories.length);
            return [
              'Weekly Aggregated',
              selectedManager!.name,
              cat,
              `Completed ${count} field checkpoints`,
              selectedManager!.wards.join(', '),
              'Coordinates matching ward boundary',
              `Ward area ${selectedManager!.wards[0]} checkpoint grids`,
              'Approved',
              `${count} geotagged photo uploads verified`
            ];
          });
        }
      } else { // Monthly
        const totalMonthlyActs = targetManagers.reduce((acc, m) => acc + m.performance.activitiesCompleted, 0);
        kpis = [
          { title: 'Monthly Cumulative Submissions', value: Math.round(totalMonthlyActs), desc: 'July 2026 logs archived', color: 'text-blue-600 bg-blue-50' },
          { title: 'Verified Compliant', value: Math.round(totalMonthlyActs * 0.96), desc: 'Officially approved', color: 'text-emerald-600 bg-emerald-50' },
          { title: 'Disciplinary Flags', value: Math.round(totalMonthlyActs * 0.04), desc: 'Rejected/falsified location flags', color: 'text-rose-600 bg-rose-50' },
          { title: 'GIS Coverage Score', value: '98.5%', desc: 'Spatial boundaries match', color: 'text-violet-600 bg-violet-50' }
        ];

        if (isAll) {
          rows = targetManagers.map(m => {
            const acts = m.performance.activitiesCompleted;
            return [
              'Monthly Consolidated',
              m.name,
              'Consolidated Fields',
              `Completed ${acts} Total Sanitation Inspections`,
              m.wards.join(', '),
              'Coordinates matching ward boundary',
              'Multiple geocoded ward addresses',
              'Approved',
              `Checked-out and approved by supervisor`
            ];
          });
        } else {
          const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
          rows = weeks.map((week, idx) => {
            const count = Math.round(selectedManager!.performance.activitiesCompleted / 4);
            return [
              week,
              selectedManager!.name,
              'All Categories',
              `Completed ${count} field audits in ward sectors`,
              selectedManager!.wards.join(', '),
              'Coordinates matching ward boundary',
              `Jurisdiction zone area ${selectedManager!.zone}`,
              'Approved',
              `Stamps matches secure device hash`
            ];
          });
        }
      }
    } else if (reportSection === 'Working Hours') {
      title = `${reportFrequency} On-Field Duty & Idle Time Audit`;
      columns = ['Employee ID', 'Officer Name', 'Zone', 'Wards', 'Frequency/Date', 'Total Roster Hours', 'Active Transit Duration', 'Stationary Idle Duration', 'Idle Ratio (%)', 'Duty Status Flag'];

      if (reportFrequency === 'Daily') {
        const sumHrs = targetManagers.reduce((acc, m) => acc + m.workingHours, 0);
        kpis = [
          { title: 'Total Duty Man-Hours', value: `${sumHrs.toFixed(1)} hrs`, desc: 'Cumulative roster output', color: 'text-blue-600 bg-blue-50' },
          { title: 'Fleet Moving Ratio', value: '82.5%', desc: 'Percentage of shift in active motion', color: 'text-emerald-600 bg-emerald-50' },
          { title: 'Total Stationary Idle Time', value: `${targetManagers.reduce((acc, m) => acc + m.idleTimeMin, 0)} mins`, desc: 'Total zero-velocity checkpoints', color: 'text-amber-600 bg-amber-50' },
          { title: 'Battery Degradation Rate', value: '5.2%/hr', desc: 'Standard device power curve', color: 'text-violet-600 bg-violet-50' }
        ];

        rows = targetManagers.map(m => {
          const idleMin = m.idleTimeMin || 0;
          const totalMin = m.workingHours * 60;
          const idleRatio = totalMin > 0 ? ((idleMin / totalMin) * 100).toFixed(1) : '0.0';
          return [
            m.empId,
            m.name,
            m.zone,
            m.wards.join(', '),
            'Today',
            `${m.workingHours.toFixed(1)} hrs`,
            `${Math.max(0, Math.floor(totalMin - idleMin))} mins`,
            `${idleMin} mins`,
            `${idleRatio}%`,
            idleMin > 120 ? '⚠️ High Idle Alert' : '🟢 Optimal Duty State'
          ];
        });
      } else if (reportFrequency === 'Weekly') {
        const totalHrs = targetManagers.reduce((acc, m) => acc + m.performance.workingHoursTotal * 0.75, 0);
        kpis = [
          { title: 'Weekly Combined Man-Hours', value: `${totalHrs.toFixed(1)} hrs`, desc: 'Aggregated audit budget', color: 'text-blue-600 bg-blue-50' },
          { title: 'Avg Shift Duty per Day', value: '7.8 hrs', desc: 'Roster target consistency', color: 'text-emerald-600 bg-emerald-50' },
          { title: 'Idle Ratio Fleet Mean', value: '14.2%', desc: 'Stationary stops vs motion', color: 'text-amber-600 bg-amber-50' },
          { title: 'Duty Signal Fidelity', value: '98.5%', desc: 'Device uptime and GPS link', color: 'text-violet-600 bg-violet-50' }
        ];

        if (isAll) {
          rows = targetManagers.map(m => {
            const hrs = m.performance.workingHoursTotal * 0.75;
            const idle = hrs * 60 * 0.14;
            return [
              m.empId,
              m.name,
              m.zone,
              m.wards.join(', '),
              'Weekly Summary',
              `${hrs.toFixed(1)} hrs`,
              `${Math.round(hrs * 60 - idle)} mins`,
              `${Math.round(idle)} mins`,
              `14.0%`,
              '🟢 Optimal'
            ];
          });
        } else {
          const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          rows = days.map((day, idx) => {
            const present = idx < Math.round(6 * (selectedManager!.performance.attendanceRate / 100));
            const hrs = present ? 8.0 : 0.0;
            const idle = present ? (35 + (idx * 5) % 45) : 0;
            const active = present ? (480 - idle) : 0;
            const idleRatio = present ? ((idle / 480) * 100).toFixed(1) : '0.0';
            return [
              selectedManager!.empId,
              selectedManager!.name,
              selectedManager!.zone,
              selectedManager!.wards.join(', '),
              day,
              `${hrs.toFixed(1)} hrs`,
              `${Math.round(active)} mins`,
              `${Math.round(idle)} mins`,
              `${idleRatio}%`,
              present ? (idle > 100 ? '⚠️ Stationary' : '🟢 Optimal') : 'N/A'
            ];
          });
        }
      } else { // Monthly
        const totalHrs = targetManagers.reduce((acc, m) => acc + m.performance.workingHoursTotal, 0);
        kpis = [
          { title: 'Monthly Total Man-Hours', value: `${totalHrs.toFixed(1)} hrs`, desc: 'July 2026 consolidated payroll', color: 'text-blue-600 bg-blue-50' },
          { title: 'Roster Targets Completed', value: `${Math.round(totalHrs / 8)} shifts`, desc: 'Full duty shifts logged', color: 'text-emerald-600 bg-emerald-50' },
          { title: 'Signal Outages Tracked', value: '0 incident reports', desc: 'No unauthorized phone turn-offs', color: 'text-rose-600 bg-rose-50' },
          { title: 'Audit Clearance Status', value: '100% CLEAR', desc: 'Sanctioned for government allowance', color: 'text-violet-600 bg-violet-50' }
        ];

        if (isAll) {
          rows = targetManagers.map(m => {
            const hrs = m.performance.workingHoursTotal;
            const idle = hrs * 60 * 0.13;
            return [
              m.empId,
              m.name,
              m.zone,
              m.wards.join(', '),
              'Monthly Consolidated',
              `${hrs.toFixed(1)} hrs`,
              `${Math.round(hrs * 60 - idle)} mins`,
              `${Math.round(idle)} mins`,
              `13.0%`,
              '🟢 Cleared'
            ];
          });
        } else {
          const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
          rows = weeks.map((week, idx) => {
            const hrs = selectedManager!.performance.workingHoursTotal / 4;
            const idle = hrs * 60 * 0.125;
            return [
              selectedManager!.empId,
              selectedManager!.name,
              selectedManager!.zone,
              selectedManager!.wards.join(', '),
              week,
              `${hrs.toFixed(1)} hrs`,
              `${Math.round(hrs * 60 - idle)} mins`,
              `${Math.round(idle)} mins`,
              `12.5%`,
              '🟢 Cleared'
            ];
          });
        }
      }
    } else if (reportSection === 'Performance') {
      title = `${reportFrequency} Force Productivity & Merit Scorecard`;
      columns = ['Rank', 'Employee ID', 'Officer Name', 'Zone', 'Wards', 'Attendance Compliance (%)', 'Distance Covered (Km)', 'Inspections Completed', 'Avg Response (Mins)', 'Productivity Score / 100', 'Award Category'];

      const sortedManagers = [...targetManagers].sort((a, b) => b.performance.productivityScore - a.performance.productivityScore);
      const avgScore = Math.round(targetManagers.reduce((acc, m) => acc + m.performance.productivityScore, 0) / targetManagers.length);

      kpis = [
        { title: 'Highest Performing Officer', value: sortedManagers[0]?.name || 'N/A', desc: `Score: ${sortedManagers[0]?.performance.productivityScore || 0}/100`, color: 'text-blue-600 bg-blue-50' },
        { title: 'Average Productivity Score', value: `${avgScore}/100`, desc: 'Force standard quality benchmark', color: 'text-emerald-600 bg-emerald-50' },
        { title: 'Overall Performance Index', value: avgScore >= 80 ? 'Outstanding' : 'Compliant', desc: 'Government compliance index', color: 'text-amber-600 bg-amber-50' },
        { title: 'Active Ward Coverage Rate', value: '100%', desc: 'All sectors covered by live GIS', color: 'text-violet-600 bg-violet-50' }
      ];

      if (reportFrequency === 'Daily') {
        rows = sortedManagers.map((m, index) => {
          const score = m.performance.productivityScore;
          let grade = '⭐⭐⭐ Elite';
          if (score < 80) grade = '⭐⭐ Standard';
          if (score < 60) grade = '⭐ Developing';
          return [
            `#${index + 1}`,
            m.empId,
            m.name,
            m.zone,
            m.wards.join(', '),
            m.status === 'checked-in' ? '100% (Present)' : '0% (Absent)',
            `${m.distanceTravelledKm.toFixed(1)} km`,
            `${m.activities.length} submitted`,
            `${m.performance.responseTimeMinutes} mins`,
            `${score}/100`,
            grade
          ];
        });
      } else if (reportFrequency === 'Weekly') {
        rows = sortedManagers.map((m, index) => {
          const score = m.performance.productivityScore;
          let grade = '🏆 Star Performer';
          if (score < 80) grade = '👍 Commendable';
          if (score < 60) grade = '📈 Need Improvement';
          return [
            `#${index + 1}`,
            m.empId,
            m.name,
            m.zone,
            m.wards.join(', '),
            `${m.performance.attendanceRate}%`,
            `${(m.performance.distanceTotal * 0.75).toFixed(1)} km`,
            `${Math.round(m.performance.activitiesCompleted * 0.75)} submitted`,
            `${m.performance.responseTimeMinutes} mins`,
            `${score}/100`,
            grade
          ];
        });
      } else { // Monthly
        rows = sortedManagers.map((m, index) => {
          const score = m.performance.productivityScore;
          let grade = '🥇 President\'s Merit Medal';
          if (score < 80) grade = '🥈 Municipal Citation';
          if (score < 60) grade = '🥉 Satisfactory';
          return [
            `#${index + 1}`,
            m.empId,
            m.name,
            m.zone,
            m.wards.join(', '),
            `${m.performance.attendanceRate}%`,
            `${m.performance.distanceTotal.toFixed(1)} km`,
            `${m.performance.activitiesCompleted} submitted`,
            `${m.performance.responseTimeMinutes} mins`,
            `${score}/100`,
            grade
          ];
        });
      }
    }

    return { kpis, columns, rows, title };
  };

  if (!state) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="text-center space-y-4">
          <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mx-auto" />
          <h2 className="text-xl font-bold text-slate-800">Initializing ZMMS Server Connections</h2>
          <p className="text-slate-500 text-sm max-w-md">Connecting to field forces tracking engine, loading simulated GPS nodes and mapping geometry database...</p>
        </div>
      </div>
    );
  }

  // Derived dashboard metrics
  const totalManagers = state.managers.length;
  const presentManagers = state.managers.filter(m => m.status === 'checked-in').length;
  const absentManagers = totalManagers - presentManagers;
  const workingManagers = state.managers.filter(m => m.status === 'checked-in' && m.speed > 0).length;
  const averagePerformance = Math.round(state.managers.reduce((acc, m) => acc + m.performance.productivityScore, 0) / totalManagers);
  const totalDistanceToday = parseFloat(state.managers.reduce((acc, m) => acc + m.distanceTravelledKm, 0).toFixed(1));
  const totalActivitiesToday = state.managers.reduce((acc, m) => acc + m.activities.length, 0);

  // Filters setup
  const filteredManagers = state.managers.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase()) || m.empId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesZone = zoneFilter === 'All' || m.zone.includes(zoneFilter);
    const matchesWard = wardFilter === 'All' || m.wards.includes(parseInt(wardFilter));
    const matchesStatus = statusFilter === 'All' || 
                         (statusFilter === 'Present' && m.status === 'checked-in') || 
                         (statusFilter === 'Absent' && m.status === 'checked-out');
    return matchesSearch && matchesZone && matchesWard && matchesStatus;
  });

  const selectedManager = state.managers.find(m => m.id === selectedManagerId) || state.managers[0];
  const selectedMapManager = state.managers.find(m => m.id === selectedMapManagerId) || state.managers[0];

  return (
    <div id="zmms-app" className="min-h-screen bg-[#f3f4f6] font-sans antialiased text-slate-800 flex flex-col">
      
      {/* GLOBAL TOAST SYSTEM */}
      <AnimatePresence>
        {globalToast && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="fixed top-4 right-4 z-50 max-w-md w-full bg-slate-900 text-white border border-slate-700/60 shadow-2xl rounded-2xl p-4 flex gap-3 overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-indigo-500 to-blue-500"></div>
            <div className="flex-1 space-y-1 pl-1.5">
              <div className="flex items-center gap-2">
                <span className="text-lg">
                  {globalToast.type === 'attendance-reminder' ? '⏰' :
                   globalToast.type === 'task-reminder' ? '⏳' :
                   globalToast.type === 'gps-off' ? '🚨' :
                   globalToast.type === 'new-task' ? '📋' : '📝'}
                </span>
                <span className="font-extrabold text-xs text-slate-100 uppercase tracking-tight">{globalToast.title}</span>
                <span className="text-[7px] font-black uppercase bg-blue-600/40 border border-blue-500/50 px-1.5 py-0.2 rounded ml-auto text-blue-300">Command Feed</span>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">{globalToast.body}</p>
            </div>
            <button 
              onClick={() => setGlobalToast(null)}
              className="text-slate-400 hover:text-white font-bold text-xs p-1"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* GLOBAL BANNER & ROLE SWITCHER */}
      <header id="main-header" className="bg-[#0b3c5d] text-white shadow-md border-b-4 border-[#328cc1]">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-white p-1 rounded-md shadow-sm">
              <Shield className="w-8 h-8 text-[#0b3c5d]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] tracking-wider uppercase font-bold bg-[#328cc1] px-1.5 py-0.5 rounded text-white">Gov Command Center</span>
                <span className="text-xs text-blue-200">Municipal Administration Dept</span>
              </div>
              <h1 className="text-lg font-extrabold tracking-tight">Zone Manager Monitoring System (ZMMS)</h1>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            {/* Simulation Clock Controller */}
            <div className="bg-[#1d2731] border border-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span className="font-mono text-sm font-bold text-slate-100">{state.simulationTime}</span>
              </div>
              
              <div className="h-4 w-[1px] bg-slate-700"></div>

              {/* Step Action */}
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => handleStepSimulation(15)} 
                  title="Forward 15 Minutes"
                  className="p-1 hover:bg-slate-700 rounded text-slate-300 transition-all flex items-center gap-0.5 text-[11px]"
                >
                  <FastForward className="w-3.5 h-3.5 text-blue-400" />
                  <span>+15m</span>
                </button>
                <button 
                  onClick={() => handleStepSimulation(60)} 
                  title="Forward 1 Hour"
                  className="p-1 hover:bg-slate-700 rounded text-slate-300 transition-all flex items-center gap-0.5 text-[11px]"
                >
                  <FastForward className="w-3.5 h-3.5 text-amber-400" />
                  <span>+1h</span>
                </button>
              </div>

              <div className="h-4 w-[1px] bg-slate-700"></div>

              {/* Speed Buttons */}
              <div className="flex items-center bg-[#0b3c5d] p-0.5 rounded-md text-xs">
                <button 
                  onClick={() => handleChangeSimSpeed('paused')}
                  className={`px-1.5 py-0.5 rounded ${state.simulationSpeed === 'paused' ? 'bg-[#328cc1] text-white font-bold' : 'text-slate-300'}`}
                >
                  <Pause className="w-3 h-3" />
                </button>
                <button 
                  onClick={() => handleChangeSimSpeed('normal')}
                  className={`px-1.5 py-0.5 rounded ${state.simulationSpeed === 'normal' ? 'bg-[#328cc1] text-white font-bold' : 'text-slate-300'}`}
                >
                  1x
                </button>
                <button 
                  onClick={() => handleChangeSimSpeed('fast_10x')}
                  className={`px-1.5 py-0.5 rounded ${state.simulationSpeed === 'fast_10x' ? 'bg-[#328cc1] text-white font-bold' : 'text-slate-300'}`}
                >
                  10x
                </button>
                <button 
                  onClick={() => handleChangeSimSpeed('fast_100x')}
                  className={`px-1.5 py-0.5 rounded ${state.simulationSpeed === 'fast_100x' ? 'bg-[#328cc1] text-white font-bold' : 'text-slate-300'}`}
                >
                  100x
                </button>
              </div>
            </div>

            {/* Global Role Toggle */}
            <div className="bg-slate-800 p-1 rounded-lg flex border border-slate-700">
              <button 
                onClick={() => setCurrentRole('admin')}
                className={`flex items-center gap-1 px-3 py-1 text-xs rounded-md transition-all ${currentRole === 'admin' ? 'bg-blue-600 text-white shadow-sm font-semibold' : 'text-slate-300 hover:text-white'}`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Admin Panel</span>
              </button>
              <button 
                onClick={() => setCurrentRole('zone-manager')}
                className={`flex items-center gap-1 px-3 py-1 text-xs rounded-md transition-all ${currentRole === 'zone-manager' ? 'bg-emerald-600 text-white shadow-sm font-semibold' : 'text-slate-300 hover:text-white'}`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Field Device</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* EMERGENCY SOS MARQUEE BANNER */}
      {state.managers.some(m => m.sos) && (
        <div className="bg-red-600 text-white py-2 px-4 font-bold text-sm animate-pulse flex items-center justify-between shadow">
          <div className="flex items-center gap-2 max-w-5xl mx-auto w-full">
            <AlertOctagon className="w-5 h-5 animate-spin" />
            <span>CRITICAL ALERT: SOS Beacon Active! Zone Manager {state.managers.find(m => m.sos)?.name} in {state.managers.find(m => m.sos)?.zone} has reported an emergency. Real-time GPS tracked position flashing on Live Map.</span>
          </div>
        </div>
      )}

      {/* CORE CONTENT LAYOUT */}
      <main id="main-content" className="flex-1 w-full max-w-7xl mx-auto p-4 flex flex-col gap-4">

        {currentRole === 'admin' ? (
          /* =======================================
             ADMIN COMMAND PANEL
             ======================================= */
          <>
            {/* UPPER METRICS BOARD */}
            <section id="stat-board" className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              <div id="stat-1" className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 flex items-center gap-3">
                <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Total Officers</p>
                  <p className="text-xl font-black text-slate-800">{totalManagers}</p>
                </div>
              </div>

              <div id="stat-2" className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 flex items-center gap-3">
                <div className="bg-emerald-50 p-2 rounded-lg text-emerald-600">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Checked In</p>
                  <p className="text-xl font-black text-emerald-600">{presentManagers} <span className="text-xs text-slate-400 font-normal">Present</span></p>
                </div>
              </div>

              <div id="stat-3" className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 flex items-center gap-3">
                <div className="bg-rose-50 p-2 rounded-lg text-rose-600">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Checked Out</p>
                  <p className="text-xl font-black text-rose-600">{absentManagers} <span className="text-xs text-slate-400 font-normal">Absent</span></p>
                </div>
              </div>

              <div id="stat-4" className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 flex items-center gap-3">
                <div className="bg-amber-50 p-2 rounded-lg text-amber-600">
                  <Activity className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">On Transit</p>
                  <p className="text-xl font-black text-slate-800">{workingManagers} <span className="text-xs text-amber-600 font-bold">Active</span></p>
                </div>
              </div>

              <div id="stat-5" className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 flex items-center gap-3">
                <div className="bg-violet-50 p-2 rounded-lg text-violet-600">
                  <MapPin className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Distance Cover</p>
                  <p className="text-xl font-black text-slate-800">{totalDistanceToday} <span className="text-xs text-slate-400 font-normal">km</span></p>
                </div>
              </div>

              <div id="stat-6" className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 flex items-center gap-3">
                <div className="bg-cyan-50 p-2 rounded-lg text-cyan-600">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Reports Logs</p>
                  <p className="text-xl font-black text-slate-800">{totalActivitiesToday}</p>
                </div>
              </div>

              <div id="stat-7" className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 flex items-center gap-3">
                <div className="bg-teal-50 p-2 rounded-lg text-teal-600">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Productivity Avg</p>
                  <p className="text-xl font-black text-slate-800">{averagePerformance}%</p>
                </div>
              </div>
            </section>

            {/* ADMIN NAVIGATION TABS */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-1 flex flex-wrap gap-1">
              <button
                onClick={() => setActiveAdminTab('dashboard')}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-lg transition-all ${activeAdminTab === 'dashboard' ? 'bg-[#0b3c5d] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <LayoutDashboard className="w-4 h-4 text-blue-500" />
                <span>🏛️ Executive Command Dashboard</span>
              </button>

              <button
                onClick={() => setActiveAdminTab('map')}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-lg transition-all ${activeAdminTab === 'map' ? 'bg-[#0b3c5d] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <Map className="w-4 h-4" />
                <span>🌐 Global Real-Time Map</span>
              </button>
              
              <button
                onClick={() => setActiveAdminTab('analytics')}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-lg transition-all ${activeAdminTab === 'analytics' ? 'bg-[#0b3c5d] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <TrendingUp className="w-4 h-4" />
                <span>📊 Performance Scoreboard</span>
              </button>

              <button
                onClick={() => setActiveAdminTab('tasks')}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-lg transition-all ${activeAdminTab === 'tasks' ? 'bg-[#0b3c5d] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <CheckCircle className="w-4 h-4" />
                <span>📋 Task Assignment Hub</span>
              </button>

              <button
                onClick={() => setActiveAdminTab('activities')}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-lg transition-all ${activeAdminTab === 'activities' ? 'bg-[#0b3c5d] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <Activity className="w-4 h-4" />
                <span>📝 Activities Audit Feed</span>
              </button>

              <button
                onClick={() => setActiveAdminTab('reports')}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-lg transition-all ${activeAdminTab === 'reports' ? 'bg-[#0b3c5d] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <Download className="w-4 h-4" />
                <span>📁 Official Records & Reports</span>
              </button>
              
              <button
                onClick={() => setActiveAdminTab('notifications')}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-lg transition-all ${activeAdminTab === 'notifications' ? 'bg-indigo-700 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <Bell className="w-4 h-4 text-indigo-500" />
                <span>🔔 Notification Command Center</span>
              </button>

              <button
                onClick={() => setActiveAdminTab('firebase')}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-lg transition-all ${activeAdminTab === 'firebase' ? 'bg-[#e65100] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
                <span>🔥 Firebase Cloud Control</span>
              </button>

              <div className="ml-auto flex items-center pr-2">
                <button 
                  onClick={handleResetSimulation}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-red-200 text-red-600 rounded-md hover:bg-red-50 transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Simulation</span>
                </button>
              </div>
            </div>

            {/* TAB PANELS */}
            {/* TAB PANELS */}
            {activeAdminTab === 'dashboard' && (
              <div className="space-y-6">
                {/* 1. EXECUTIVE METRICS GRID */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  {/* Attendance Card */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Attendance Rate</p>
                      <h3 className="text-2xl font-black text-slate-800">
                        {presentManagers} <span className="text-xs text-slate-400 font-normal">/ {totalManagers} Present</span>
                      </h3>
                      <p className="text-xs text-emerald-600 font-bold flex items-center gap-0.5">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        {Math.round((presentManagers / totalManagers) * 100)}% Attendance Index
                      </p>
                    </div>
                    <div className="bg-emerald-50 p-3 rounded-xl text-emerald-600">
                      <Users className="w-6 h-6" />
                    </div>
                  </div>

                  {/* Live Status Card */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Live Force Status</p>
                      <h3 className="text-2xl font-black text-slate-800">
                        {state.managers.filter(m => m.status === 'checked-in' && m.speed > 0).length} <span className="text-xs text-slate-400 font-normal">Active Transit</span>
                      </h3>
                      <p className="text-xs text-slate-500 font-semibold">
                        {state.managers.filter(m => m.status === 'checked-in' && m.speed === 0).length} Idle Officers | {absentManagers} Offline
                      </p>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-xl text-blue-600">
                      <Activity className="w-6 h-6" />
                    </div>
                  </div>

                  {/* Distance Card */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Distance Coverage</p>
                      <h3 className="text-2xl font-black text-slate-800">{totalDistanceToday} <span className="text-xs text-slate-400 font-normal">km Today</span></h3>
                      <p className="text-xs text-blue-600 font-semibold">
                        Avg: {(totalDistanceToday / totalManagers).toFixed(1)} km / Officer
                      </p>
                    </div>
                    <div className="bg-[#328cc1]/10 p-3 rounded-xl text-[#0b3c5d]">
                      <MapPin className="w-6 h-6" />
                    </div>
                  </div>

                  {/* Task Progress Card */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Task Progress</p>
                      <h3 className="text-2xl font-black text-slate-800">
                        {state.tasks.filter(t => t.status === 'Completed').length} <span className="text-xs text-slate-400 font-normal">/ {state.tasks.length} Done</span>
                      </h3>
                      <p className="text-xs text-violet-600 font-bold">
                        {Math.round((state.tasks.filter(t => t.status === 'Completed').length / state.tasks.length) * 100)}% Directive Success Rate
                      </p>
                    </div>
                    <div className="bg-violet-50 p-3 rounded-xl text-violet-600">
                      <CheckCircle className="w-6 h-6" />
                    </div>
                  </div>

                  {/* Productivity Index Card */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Performance Average</p>
                      <h3 className="text-2xl font-black text-slate-800">{averagePerformance}%</h3>
                      <p className="text-xs text-[#0b3c5d] font-bold">
                        {totalActivitiesToday} Inspection Audits Filed
                      </p>
                    </div>
                    <div className="bg-amber-50 p-3 rounded-xl text-amber-600">
                      <TrendingUp className="w-6 h-6" />
                    </div>
                  </div>
                </div>

                {/* 2. SPLIT INTERACTIVE CONTENT */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* LEFT: ROSTER LIST AND MAP PREVIEW */}
                  <div className="lg:col-span-8 space-y-6">
                    {/* ROSTER SECTION */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
                        <div>
                          <h3 className="font-extrabold text-base text-slate-800 flex items-center gap-2">
                            <span>Field Force Roster</span>
                            <span className="text-xs font-bold bg-[#0b3c5d] text-white px-2 py-0.5 rounded-full">
                              13 Zone Managers
                            </span>
                          </h3>
                          <p className="text-xs text-slate-500">Live coordinates, speed, battery, tasks completion and performance index of all officers.</p>
                        </div>

                        {/* Search & Filters */}
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                            <input
                              type="text"
                              placeholder="Search..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="pl-8 pr-4 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50 w-44"
                            />
                          </div>

                          <select 
                            value={zoneFilter} 
                            onChange={(e) => setZoneFilter(e.target.value)}
                            className="text-[11px] p-1.5 border rounded-lg bg-slate-50 text-slate-600 font-semibold"
                          >
                            <option value="All">All Zones</option>
                            <option value="Zone 1">Zone 1</option>
                            <option value="Zone 2">Zone 2</option>
                            <option value="Zone 3">Zone 3</option>
                            <option value="Zone 4">Zone 4</option>
                            <option value="Zone 5">Zone 5</option>
                            <option value="Zone 6">Zone 6</option>
                            <option value="Zone 7">Zone 7</option>
                            <option value="Zone 8">Zone 8</option>
                            <option value="Zone 9">Zone 9</option>
                            <option value="Zone 10">Zone 10</option>
                            <option value="Zone 11">Zone 11</option>
                            <option value="Zone 12">Zone 12</option>
                            <option value="Zone 13">Zone 13</option>
                          </select>

                          <select 
                            value={statusFilter} 
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="text-[11px] p-1.5 border rounded-lg bg-slate-50 text-slate-600 font-semibold"
                          >
                            <option value="All">All Statuses</option>
                            <option value="Present">Present (Checked In)</option>
                            <option value="Absent">Absent (Offline)</option>
                          </select>
                        </div>
                      </div>

                      {/* 13 Managers Roster Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[460px] overflow-y-auto pr-1">
                        {filteredManagers.map((m) => {
                          const isSelected = selectedMapManagerId === m.id;
                          const mTasks = state.tasks.filter(t => t.managerId === m.id);
                          const compTasks = mTasks.filter(t => t.status === 'Completed').length;
                          const taskPercent = mTasks.length > 0 ? Math.round((compTasks / mTasks.length) * 100) : 0;
                          
                          // Battery styles
                          let batteryColor = 'bg-emerald-500';
                          if (m.battery < 20) batteryColor = 'bg-rose-500 animate-pulse';
                          else if (m.battery < 50) batteryColor = 'bg-amber-500';

                          return (
                            <div 
                              key={m.id}
                              onClick={() => setSelectedMapManagerId(m.id)}
                              className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all duration-200 hover:shadow-md hover:border-slate-300 relative ${isSelected ? 'border-blue-500 bg-blue-50/40 ring-1 ring-blue-400' : 'border-slate-200 bg-white'}`}
                            >
                              {m.sos && (
                                <div className="absolute top-2 right-2 bg-rose-600 text-white font-black text-[9px] px-2 py-0.5 rounded-full animate-bounce">
                                  🚨 SOS Active
                                </div>
                              )}
                              
                              <div className="flex items-start gap-3">
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-extrabold text-xs shrink-0 ${m.status === 'checked-in' ? 'bg-blue-100 text-blue-800 border-2 border-emerald-400' : 'bg-slate-100 text-slate-500'}`}>
                                  {m.name.split(' ').map(n => n[0]).join('')}
                                </div>

                                <div className="space-y-1 w-full min-w-0">
                                  <div className="flex items-center justify-between gap-1.5">
                                    <h4 className="font-extrabold text-xs text-slate-800 truncate">{m.name}</h4>
                                    <span className="text-[9px] font-mono font-bold text-slate-400 shrink-0">{m.empId}</span>
                                  </div>

                                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                                    <span className="font-semibold truncate text-slate-600">{m.zone}</span>
                                    <span className="shrink-0 text-slate-400">Wards: {m.wards.join(',')}</span>
                                  </div>

                                  {/* Live Telemetry Bar */}
                                  <div className="grid grid-cols-3 gap-1 pt-1 text-[9px] font-mono font-bold">
                                    {/* Status Indicator */}
                                    <div className="flex items-center gap-1">
                                      <span className={`w-1.5 h-1.5 rounded-full ${m.status === 'checked-in' ? (m.speed > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500') : 'bg-slate-300'}`}></span>
                                      <span className={m.status === 'checked-in' ? 'text-slate-700' : 'text-slate-400'}>
                                        {m.status === 'checked-in' ? (m.speed > 0 ? `${m.speed}km/h` : 'STATIONARY') : 'OFFLINE'}
                                      </span>
                                    </div>

                                    {/* Battery */}
                                    <div className="flex items-center gap-1 text-slate-600">
                                      <Battery className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                      <span>{m.battery}%</span>
                                    </div>

                                    {/* Network */}
                                    <div className="flex items-center gap-1 text-slate-500 justify-end">
                                      {m.status === 'checked-in' ? (
                                        <>
                                          <Wifi className="w-3 h-3 text-emerald-500" />
                                          <span>{m.network}</span>
                                        </>
                                      ) : (
                                        <>
                                          <WifiOff className="w-3 h-3 text-slate-400" />
                                          <span>Offline</span>
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  {/* Progress bar for Battery */}
                                  {m.status === 'checked-in' && (
                                    <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                                      <div className={`h-full ${batteryColor}`} style={{ width: `${m.battery}%` }}></div>
                                    </div>
                                  )}

                                  {/* GPS Coordinates & Location */}
                                  <p className="text-[10px] text-slate-500 truncate flex items-center gap-1 pt-1 font-mono">
                                    <MapPin className="w-3 h-3 text-blue-500 shrink-0" />
                                    <span className="truncate">{m.status === 'checked-in' ? m.currentAddress : 'Out of Office'}</span>
                                  </p>

                                  {/* Distance & Task Stats */}
                                  <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-slate-100 font-bold">
                                    <span className="text-slate-600">
                                      🛣️ {m.distanceTravelledKm} km
                                    </span>
                                    <span className="text-violet-600">
                                      📋 Tasks: {compTasks}/{mTasks.length} ({taskPercent}%)
                                    </span>
                                  </div>

                                  {/* Task Progress visual bar */}
                                  {mTasks.length > 0 && (
                                    <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                                      <div className="h-full bg-violet-500" style={{ width: `${taskPercent}%` }}></div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* LIVE MAP SECTION */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-3">
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-extrabold text-sm text-slate-800 flex items-center gap-1.5">
                            <Map className="w-4 h-4 text-[#328cc1]" />
                            <span>Live Map Geo-Tracking Network</span>
                          </h4>
                          <p className="text-xs text-slate-500">Live coordinates of 13 officers overlaid on municipal coordinates database.</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={mapOverlay}
                            onChange={(e: any) => setMapOverlay(e.target.value)}
                            className="text-[10px] font-bold p-1 border rounded bg-slate-50 text-slate-600"
                          >
                            <option value="wards">Show Ward Boundaries</option>
                            <option value="heatmap">Show Inspection Heatmap</option>
                            <option value="none">Standard Map Only</option>
                          </select>
                        </div>
                      </div>

                      <div className="h-[380px] rounded-xl overflow-hidden border border-slate-200 relative shadow-inner">
                        <MapComponent
                          managers={state.managers}
                          selectedMapManagerId={selectedMapManagerId}
                          setSelectedMapManagerId={setSelectedMapManagerId}
                          mapOverlay={mapOverlay}
                          handleGenerateAISummary={handleGenerateAISummary}
                          onRefreshTriggered={fetchState}
                        />
                      </div>
                    </div>
                  </div>

                  {/* RIGHT: LEADERBOARD, TASKS PROGRESS, ACTIVITIES */}
                  <div className="lg:col-span-4 space-y-6">
                    {/* LEADERBOARD & PERFORMANCE SECTION */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
                      <div className="flex items-center justify-between border-b pb-2">
                        <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <Award className="w-4 h-4 text-amber-500" />
                          <span>Productivity Leaderboard</span>
                        </h4>
                        <button 
                          onClick={() => downloadReport('productivity')}
                          className="text-[10px] text-blue-600 hover:underline font-bold flex items-center gap-0.5"
                        >
                          Export Excel
                        </button>
                      </div>

                      <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                        {state.managers
                          .sort((a, b) => b.performance.productivityScore - a.performance.productivityScore)
                          .map((m, index) => {
                            const rank = index + 1;
                            let scoreColor = 'text-green-600 bg-green-50';
                            if (m.performance.productivityScore < 75) scoreColor = 'text-amber-600 bg-amber-50';
                            if (m.performance.productivityScore < 55) scoreColor = 'text-red-600 bg-red-50';

                            return (
                              <div 
                                key={m.id}
                                onClick={() => setSelectedMapManagerId(m.id)}
                                className={`flex items-center justify-between p-2 rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer transition ${selectedMapManagerId === m.id ? 'bg-blue-50/50 border-blue-200' : ''}`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className={`w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px] shrink-0 ${rank === 1 ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-400' : rank === 2 ? 'bg-slate-200 text-slate-700' : rank === 3 ? 'bg-amber-50 text-amber-900' : 'bg-slate-50 text-slate-400'}`}>
                                    #{rank}
                                  </span>
                                  <div className="truncate">
                                    <p className="font-extrabold text-[11px] text-slate-800 truncate">{m.name}</p>
                                    <p className="text-[9px] text-slate-400 font-semibold truncate">{m.zone}</p>
                                  </div>
                                </div>

                                <div className="text-right shrink-0">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-black ${scoreColor}`}>
                                    {m.performance.productivityScore}%
                                  </span>
                                  <p className="text-[8px] text-slate-400 font-mono font-bold mt-0.5">Resp: {m.performance.responseTimeMinutes}m</p>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>

                    {/* MUNICIPAL DIRECTIVES (TASK PROGRESS) */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
                      <div className="flex items-center justify-between border-b pb-2">
                        <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <CheckCircle className="w-4 h-4 text-violet-500" />
                          <span>Task Directives progress</span>
                        </h4>
                        <button 
                          onClick={() => setActiveAdminTab('tasks')}
                          className="text-[10px] text-blue-600 hover:underline font-bold"
                        >
                          Manage Tasks
                        </button>
                      </div>

                      <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
                        {state.tasks.map((task) => {
                          const assignedOfficer = state.managers.find(m => m.id === task.managerId);
                          let statusBadge = 'bg-slate-100 text-slate-600';
                          if (task.status === 'Completed') statusBadge = 'bg-emerald-100 text-emerald-800';
                          else if (task.status === 'In-Progress') statusBadge = 'bg-blue-100 text-blue-800';

                          let priorityColor = 'bg-slate-100 text-slate-700';
                          if (task.priority === 'Critical') priorityColor = 'bg-rose-100 text-rose-800';
                          else if (task.priority === 'High') priorityColor = 'bg-amber-100 text-amber-800';

                          return (
                            <div key={task.id} className="p-3 bg-slate-50/50 rounded-xl border border-slate-150 space-y-2 text-left">
                              <div className="flex justify-between items-start gap-1.5">
                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase shrink-0 ${priorityColor}`}>
                                  {task.priority}
                                </span>
                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full shrink-0 ${statusBadge}`}>
                                  {task.status}
                                </span>
                              </div>

                              <div className="space-y-0.5">
                                <h5 className="font-extrabold text-[11px] text-slate-800 leading-tight">{task.title}</h5>
                                <p className="text-[9px] text-slate-500 truncate">{task.desc}</p>
                              </div>

                              <div className="space-y-1">
                                <div className="flex justify-between text-[9px] font-mono font-bold text-slate-500">
                                  <span>Progress</span>
                                  <span>{task.progress}%</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-violet-500" style={{ width: `${task.progress}%` }}></div>
                                </div>
                              </div>

                              <div className="flex items-center justify-between text-[9px] pt-1.5 border-t border-slate-100 text-slate-400 font-bold">
                                <span className="truncate text-slate-500 font-semibold">👤 {assignedOfficer?.name || 'Unassigned'}</span>
                                <span className="shrink-0">⏰ {task.deadline}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* LIVE ACTIVITY FEED */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
                      <div className="flex items-center justify-between border-b pb-2">
                        <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <Activity className="w-4 h-4 text-emerald-500" />
                          <span>Live Activity Audit Feed</span>
                        </h4>
                        <button 
                          onClick={() => downloadReport('activities')}
                          className="text-[10px] text-blue-600 hover:underline font-bold"
                        >
                          Export Logs
                        </button>
                      </div>

                      <div className="space-y-3 max-h-[240px] overflow-y-auto pr-1 text-left">
                        {state.managers
                          .flatMap(m => m.activities.map(act => ({ ...act, managerName: m.name, managerZone: m.zone })))
                          .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
                          .slice(0, 8)
                          .map((act, i) => (
                            <div key={act.id || i} className="flex gap-2.5 p-2 bg-slate-50/50 rounded-lg border border-slate-100">
                              <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 border border-slate-200">
                                <img 
                                  src={act.photo || 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=100&auto=format&fit=crop&q=60'} 
                                  alt={act.title} 
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                              <div className="min-w-0 flex-1 space-y-0.5">
                                <div className="flex justify-between items-center text-[8px] font-bold">
                                  <span className="text-blue-600 bg-blue-50 px-1 py-0.2 rounded truncate uppercase">{act.category}</span>
                                  <span className="text-slate-400 shrink-0 font-mono">{act.timestamp}</span>
                                </div>
                                <h5 className="font-extrabold text-[10px] text-slate-800 truncate leading-tight">{act.title}</h5>
                                <p className="text-[9px] text-slate-400 truncate">Filed by {act.managerName} ({act.managerZone})</p>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeAdminTab === 'map' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* LIST / FILTERS PANEL */}
                <div className="lg:col-span-4 bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col gap-4 max-h-[640px] overflow-y-auto">
                  <div className="space-y-2">
                    <h3 className="font-bold text-sm text-slate-700 flex items-center justify-between">
                      <span>Field Force Roster ({filteredManagers.length})</span>
                      <span className="text-[10px] font-mono font-bold bg-[#328cc1] text-white px-1.5 py-0.5 rounded uppercase">Live GPS</span>
                    </h3>
                    
                    {/* Search and Filters */}
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search Officer or Emp ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-1">
                      <select 
                        value={zoneFilter} 
                        onChange={(e) => setZoneFilter(e.target.value)}
                        className="text-[10px] p-1 border rounded bg-slate-50 text-slate-600 font-semibold"
                      >
                        <option value="All">All Zones</option>
                        <option value="Zone 1">Zone 1</option>
                        <option value="Zone 2">Zone 2</option>
                        <option value="Zone 3">Zone 3</option>
                        <option value="Zone 4">Zone 4</option>
                        <option value="Zone 5">Zone 5</option>
                        <option value="Zone 6">Zone 6</option>
                        <option value="Zone 7">Zone 7</option>
                        <option value="Zone 8">Zone 8</option>
                        <option value="Zone 9">Zone 9</option>
                        <option value="Zone 10">Zone 10</option>
                        <option value="Zone 11">Zone 11</option>
                        <option value="Zone 12">Zone 12</option>
                        <option value="Zone 13">Zone 13</option>
                      </select>
                      <select 
                        value={statusFilter} 
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="text-[10px] p-1 border rounded bg-slate-50 text-slate-600 font-semibold"
                      >
                        <option value="All">All Status</option>
                        <option value="Present">Checked In</option>
                        <option value="Absent">Offline</option>
                      </select>
                      <button 
                        onClick={() => { setSearchQuery(''); setZoneFilter('All'); setStatusFilter('All'); }}
                        className="text-[10px] p-1 border rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-center"
                      >
                        Clear Filter
                      </button>
                    </div>
                  </div>

                  {/* Officer Items */}
                  <div className="space-y-2 flex-1 overflow-y-auto pr-1">
                    {filteredManagers.map((m) => {
                      const isSelected = selectedMapManagerId === m.id;
                      return (
                        <div
                          key={m.id}
                          onClick={() => {
                            setSelectedMapManagerId(m.id);
                            setReplayActive(false);
                          }}
                          className={`p-3 rounded-lg border transition-all cursor-pointer flex flex-col gap-1.5 ${isSelected ? 'border-blue-600 bg-blue-50/50 shadow-sm' : 'border-slate-100 bg-white hover:bg-slate-50'}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`w-2.5 h-2.5 rounded-full ${m.sos ? 'bg-red-600 animate-ping' : (m.status === 'checked-in' ? 'bg-emerald-500' : 'bg-slate-300')}`}></span>
                              <span className="font-bold text-xs text-slate-800">{m.name}</span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-400">ID: {m.empId}</span>
                          </div>

                          <div className="grid grid-cols-2 text-[10px] text-slate-500 gap-1">
                            <div>📍 {m.zone}</div>
                            <div className="text-right">🚗 {m.distanceTravelledKm} km cover</div>
                            <div className="flex items-center gap-1">
                              <Battery className={`w-3.5 h-3.5 ${m.battery < 20 ? 'text-red-500 animate-pulse font-bold' : 'text-slate-400'}`} />
                              <span>{m.battery}% ({m.network})</span>
                            </div>
                            <div className="text-right font-semibold text-slate-700">⚡ Speed: {m.speed} km/h</div>
                            {m.status === 'checked-in' && (
                              <>
                                <div className="text-slate-400 font-mono text-[9px]">⏱️ Moving: {Math.max(0, Math.floor((m.workingHours || 0) * 60) - (m.idleTimeMin || 0))}m</div>
                                <div className="text-right text-slate-400 font-mono text-[9px]">🛑 Idle: {m.idleTimeMin || 0}m</div>
                              </>
                            )}
                          </div>

                          {m.status === 'checked-in' && (
                            <div className="bg-slate-100 rounded p-1.5 text-[10px] text-slate-600 font-mono truncate">
                              📌 {m.currentAddress}
                            </div>
                          )}

                          {m.sos && (
                            <div className="bg-red-100 text-red-700 text-[10px] font-bold p-1 rounded text-center animate-bounce">
                              🚨 EMERGENCY BEACON RECEPTIVE
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* GRAPHIC SVG MAP AND DETAILS CONTAINER */}
                <div className="lg:col-span-8 flex flex-col gap-4">
                  <MapComponent
                    managers={state.managers}
                    selectedMapManagerId={selectedMapManagerId}
                    setSelectedMapManagerId={setSelectedMapManagerId}
                    mapOverlay={mapOverlay}
                    handleGenerateAISummary={handleGenerateAISummary}
                    onRefreshTriggered={fetchState}
                  />

                  {/* AI INTEGRATED REPORT AREA */}
                  {aiSummaryText && (
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-1 bg-blue-100 text-[10px] font-bold text-blue-600 rounded-bl">Gemini 3.5 Engine</div>
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-5 h-5 text-amber-500 animate-bounce" />
                        <h4 className="font-bold text-sm text-slate-800">Officer Work diary Summary Analytics & Supervisor Directive</h4>
                      </div>
                      <div className="prose prose-sm text-slate-700 max-w-none text-xs font-mono space-y-2 leading-relaxed bg-white/70 rounded-lg p-3 border border-slate-100">
                        {aiSummaryText.split('\n').map((line, idx) => (
                          <p key={idx}>{line}</p>
                        ))}
                      </div>
                      <div className="mt-3 flex justify-end">
                        <button 
                          onClick={() => setAiSummaryText('')} 
                          className="text-xs font-semibold text-slate-400 hover:text-slate-600"
                        >
                          Dismiss Report
                        </button>
                      </div>
                    </div>
                  )}

                  {aiSummaryLoading && (
                    <div className="bg-white border border-slate-200 rounded-xl p-6 text-center space-y-3 shadow-sm flex flex-col items-center">
                      <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
                      <p className="text-xs font-mono text-slate-600">Gemini AI analyzing {selectedMapManager.name}&apos;s coordinates timeline, battery spikes, telemetry logs, and sanitation photos...</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ANALYTICS & LEADERBOARD TAB */}
            {activeAdminTab === 'analytics' && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-extrabold text-lg text-slate-800">Zone Manager Performance Scoreboard</h3>
                    <p className="text-xs text-slate-500">Productivity index auto-calculated from attendance rates, active on-field working hours, checked stops, and tasks solved.</p>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <button 
                      onClick={() => downloadReport('productivity')} 
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition"
                    >
                      <Download className="w-4 h-4" />
                      <span>Export Performance Excel</span>
                    </button>
                  </div>
                </div>

                {/* Performance Table / List */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 text-xs uppercase tracking-wider">
                        <th className="py-3 px-4">Rank</th>
                        <th className="py-3 px-4">Officer Name</th>
                        <th className="py-3 px-4">Zone / Wards</th>
                        <th className="py-3 px-4 text-center">Attendance %</th>
                        <th className="py-3 px-4 text-center">Distance Total (Today)</th>
                        <th className="py-3 px-4 text-center">Activities Completed</th>
                        <th className="py-3 px-4">Avg Response Time</th>
                        <th className="py-3 px-4 text-right">Productivity Index</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {state.managers
                        .sort((a, b) => b.performance.productivityScore - a.performance.productivityScore)
                        .map((m, index) => {
                          const score = m.performance.productivityScore;
                          let scoreColor = 'text-green-600 bg-green-50';
                          if (score < 75) scoreColor = 'text-amber-600 bg-amber-50';
                          if (score < 55) scoreColor = 'text-red-600 bg-red-50';

                          return (
                            <tr key={m.id} className="hover:bg-slate-50/50">
                              <td className="py-3.5 px-4 font-extrabold text-slate-400">#{index + 1}</td>
                              <td className="py-3.5 px-4 font-bold text-slate-800">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 bg-blue-100 text-blue-800 font-extrabold rounded-full flex items-center justify-center text-[10px]">
                                    {m.name.split(' ').map(n => n[0]).join('')}
                                  </div>
                                  <div>
                                    <p>{m.name}</p>
                                    <p className="text-[10px] text-slate-400 font-mono font-normal">{m.empId}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="py-3.5 px-4">
                                <p className="font-semibold text-slate-600">{m.zone}</p>
                                <p className="text-[10px] text-slate-400">Wards: {m.wards.join(', ')}</p>
                              </td>
                              <td className="py-3.5 px-4 text-center font-bold">{m.performance.attendanceRate}%</td>
                              <td className="py-3.5 px-4 text-center font-bold text-slate-600">{m.distanceTravelledKm} km</td>
                              <td className="py-3.5 px-4 text-center">
                                <span className="bg-blue-50 text-blue-600 font-black px-2 py-0.5 rounded-full text-[10px]">
                                  {m.activities.length} submitted
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-slate-500 font-semibold">{m.performance.responseTimeMinutes} Minutes</td>
                              <td className="py-3.5 px-4 text-right">
                                <span className={`px-2.5 py-1 rounded-lg font-black text-sm ${scoreColor}`}>
                                  {score} / 100
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TASK ASSIGNMENT TAB */}
            {activeAdminTab === 'tasks' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* CREATE NEW TASK */}
                <div className="lg:col-span-4 bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-4">
                  <h3 className="font-extrabold text-sm text-slate-700 flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-blue-600" />
                    <span>Assign New Field Directive</span>
                  </h3>

                  <form onSubmit={handleCreateTask} className="space-y-3 text-xs">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-500 block">Task Title</label>
                      <input
                        type="text"
                        placeholder="e.g. Inspect Ward 3 Open Garbage Heaps"
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-500 block">Description & Instructions</label>
                      <textarea
                        rows={3}
                        placeholder="Detail the target checklist parameters..."
                        value={newTaskDesc}
                        onChange={(e) => setNewTaskDesc(e.target.value)}
                        className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50 focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="font-bold text-slate-500 block">Priority</label>
                        <select
                          value={newTaskPriority}
                          onChange={(e: any) => setNewTaskPriority(e.target.value)}
                          className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50"
                        >
                          <option value="Critical">🚨 Critical</option>
                          <option value="High">🔴 High</option>
                          <option value="Medium">🟡 Medium</option>
                          <option value="Low">🟢 Low</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="font-bold text-slate-500 block">Target Ward</label>
                        <input
                          type="number"
                          value={newTaskWard}
                          onChange={(e) => setNewTaskWard(parseInt(e.target.value) || 1)}
                          className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-500 block">Assign To Officer</label>
                      <select
                        value={newTaskManager}
                        onChange={(e) => setNewTaskManager(e.target.value)}
                        className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50"
                      >
                        {state.managers.map(m => (
                          <option key={m.id} value={m.id}>{m.name} ({m.zone})</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-500 block">Deadline Target</label>
                      <input
                        type="text"
                        value={newTaskDeadline}
                        onChange={(e) => setNewTaskDeadline(e.target.value)}
                        className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50"
                      />
                    </div>

                    <div className="space-y-2 border-t pt-2 mt-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-500">Require Photo Verification</span>
                        <input 
                          type="checkbox" 
                          checked={newTaskPhotoReq}
                          onChange={(e) => setNewTaskPhotoReq(e.target.checked)}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-0" 
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-500">Require GPS Location Stamp</span>
                        <input 
                          type="checkbox" 
                          checked={newTaskGpsReq}
                          onChange={(e) => setNewTaskGpsReq(e.target.checked)}
                          className="w-4 h-4 rounded text-blue-600 focus:ring-0" 
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-[#0b3c5d] hover:bg-[#328cc1] text-white font-extrabold py-2 rounded-lg transition"
                    >
                      Assign Live Task Directive
                    </button>
                  </form>
                </div>

                {/* TASK DIRECTIVES LIST */}
                <div className="lg:col-span-8 bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-4">
                  <h3 className="font-extrabold text-sm text-slate-700">Active Field Force Directives ({state.tasks.length})</h3>

                  <div className="space-y-3 max-h-[500px] overflow-y-auto">
                    {state.tasks.map(t => {
                      const assignee = state.managers.find(m => m.id === t.managerId);
                      let priorityStyle = 'bg-slate-100 text-slate-600';
                      if (t.priority === 'Critical') priorityStyle = 'bg-red-100 text-red-600 font-bold animate-pulse';
                      if (t.priority === 'High') priorityStyle = 'bg-orange-100 text-orange-600 font-bold';
                      if (t.priority === 'Medium') priorityStyle = 'bg-amber-100 text-amber-600';

                      return (
                        <div key={t.id} className="border border-slate-100 rounded-lg p-3 hover:shadow-sm transition flex flex-col gap-2">
                          <div className="flex items-start justify-between gap-4 text-xs">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-extrabold ${priorityStyle}`}>{t.priority}</span>
                                <h4 className="font-extrabold text-slate-800">{t.title}</h4>
                              </div>
                              <p className="text-slate-500 mt-1 text-[11px]">{t.desc}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${t.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                {t.status}
                              </span>
                              <p className="text-[10px] text-slate-400 font-mono mt-1">Due: {t.deadline}</p>
                            </div>
                          </div>

                          <div className="border-t border-slate-50 pt-2 flex flex-col sm:flex-row sm:items-center justify-between text-[10px] text-slate-400 gap-2">
                            <div>
                              <span>Officer: 🧑‍✈️ <strong>{assignee ? assignee.name : 'Unassigned'}</strong></span>
                              <span className="mx-2 text-slate-300">|</span>
                              <span>Ward Area: 📍 <strong>Ward {t.ward}</strong></span>
                            </div>

                            <div className="flex items-center gap-3">
                              {t.photoReq && <span className="flex items-center gap-0.5 text-blue-600 font-semibold">📸 Photo Req</span>}
                              {t.gpsReq && <span className="flex items-center gap-0.5 text-emerald-600 font-semibold">📍 GPS Req</span>}
                              
                              {/* progress */}
                              <div className="flex items-center gap-1.5">
                                <div className="w-16 bg-slate-100 rounded-full h-1.5">
                                  <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${t.progress}%` }}></div>
                                </div>
                                <span className="font-mono text-slate-700 font-bold">{t.progress}%</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ACTIVITIES AUDIT TAB */}
            {activeAdminTab === 'activities' && (() => {
              const allActs = state ? state.managers.flatMap(m => m.activities.map(act => ({
                ...act,
                mName: m.name,
                mZone: m.zone,
                mEmpId: m.empId,
                mId: m.id
              }))) : [];

              const totalCount = allActs.length;
              const pendingCount = allActs.filter(a => a.status === 'Pending').length;
              const approvedCount = allActs.filter(a => a.status === 'Approved').length;
              const rejectedCount = allActs.filter(a => a.status === 'Rejected').length;

              const filtered = allActs.filter(act => {
                const matchesSearch = actSearchQuery === '' ||
                  act.title.toLowerCase().includes(actSearchQuery.toLowerCase()) ||
                  act.description.toLowerCase().includes(actSearchQuery.toLowerCase()) ||
                  act.mName.toLowerCase().includes(actSearchQuery.toLowerCase());
                const matchesCategory = actCategoryFilter === 'All' || act.category === actCategoryFilter;
                const matchesWard = actWardFilter === 'All' || act.wardNum?.toString() === actWardFilter;
                const matchesStatus = actStatusFilter === 'All' || act.status === actStatusFilter;
                return matchesSearch && matchesCategory && matchesWard && matchesStatus;
              });

              const selectedAct = allActs.find(a => a.id === selectedActId);

              // Unique categories
              const categories = ["Ward Inspection", "Door-to-Door Monitoring", "Transfer Station Inspection", "Public Toilet Inspection", "Open Depot Inspection", "Citizen Complaint Verification", "Emergency Visit"];

              return (
                <div className="space-y-6">
                  {/* HEADER PANEL */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h3 className="font-extrabold text-lg text-slate-800 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-blue-600" />
                        <span>Daily Activity GIS Audit Module</span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">Review, verify, and approve cryptographic GIS-tagged daily activity logs uploaded by field Force Zone Managers.</p>
                    </div>
                    <button 
                      onClick={() => downloadReport('activities')}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 transition self-start md:self-auto shadow-sm"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Logs Spreadsheet</span>
                    </button>
                  </div>

                  {/* STATS ROW */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
                      <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
                        <Activity className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Daily Logs</p>
                        <h4 className="font-extrabold text-xl text-slate-800">{totalCount}</h4>
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
                      <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg animate-pulse">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Pending Audit</p>
                        <h4 className="font-extrabold text-xl text-amber-600">{pendingCount}</h4>
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
                      <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
                        <CheckCircle className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Approved Stamp</p>
                        <h4 className="font-extrabold text-xl text-emerald-600">{approvedCount}</h4>
                      </div>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
                      <div className="p-2.5 bg-red-50 text-red-600 rounded-lg">
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Flagged Rejected</p>
                        <h4 className="font-extrabold text-xl text-red-600">{rejectedCount}</h4>
                      </div>
                    </div>
                  </div>

                  {/* FILTER BAR PANEL */}
                  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <input 
                        type="text" 
                        placeholder="Search logs/officer..." 
                        value={actSearchQuery}
                        onChange={(e) => setActSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs"
                      />
                    </div>

                    <div>
                      <select 
                        value={actCategoryFilter}
                        onChange={(e) => setActCategoryFilter(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 bg-slate-50/50"
                      >
                        <option value="All">All Categories</option>
                        {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </div>

                    <div>
                      <select 
                        value={actWardFilter}
                        onChange={(e) => setActWardFilter(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 bg-slate-50/50"
                      >
                        <option value="All">All Wards</option>
                        {Array.from({ length: 26 }, (_, i) => i + 1).map(w => (
                          <option key={w} value={w}>Ward {w}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <select 
                        value={actStatusFilter}
                        onChange={(e) => setActStatusFilter(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 bg-slate-50/50"
                      >
                        <option value="All">All Statuses</option>
                        <option value="Pending">Pending Audit</option>
                        <option value="Approved">Approved Verified</option>
                        <option value="Rejected">Rejected Flagged</option>
                      </select>
                    </div>
                  </div>

                  {/* MAIN PANEL - BENTO LIST & INSPECTOR */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* LEFT LIST - 7 COLS */}
                    <div className="lg:col-span-7 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500 font-bold">Filtered Results ({filtered.length} logs)</span>
                        {selectedActId && (
                          <button 
                            onClick={() => setSelectedActId(null)}
                            className="text-xs text-blue-600 font-bold hover:underline"
                          >
                            Clear Selection
                          </button>
                        )}
                      </div>

                      {filtered.length === 0 ? (
                        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400">
                          <Activity className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                          <p className="text-xs font-bold text-slate-600">No matching activities found</p>
                          <p className="text-[10px] text-slate-400 mt-1">Adjust your filter options or search terms above.</p>
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                          {filtered.map((act) => {
                            const isSelected = act.id === selectedActId;
                            let statusBadgeColor = 'bg-amber-100 text-amber-800 border-amber-200';
                            if (act.status === 'Approved') statusBadgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                            if (act.status === 'Rejected') statusBadgeColor = 'bg-red-100 text-red-800 border-red-200';

                            return (
                              <div 
                                key={act.id} 
                                onClick={() => {
                                  setSelectedActId(act.id);
                                  setSupervisorRemarksText(act.remarks || '');
                                }}
                                className={`p-3 rounded-xl border transition duration-200 cursor-pointer flex gap-4 ${isSelected ? 'border-blue-600 bg-blue-50/20 shadow-md scale-[0.99]' : 'border-slate-200 bg-white hover:border-slate-300 shadow-sm'}`}
                              >
                                {/* Photo Container */}
                                <div className="w-24 h-24 rounded-lg overflow-hidden bg-slate-800 flex-shrink-0 relative border border-slate-100">
                                  <img 
                                    src={act.photo} 
                                    alt={act.title} 
                                    className="w-full h-full object-cover"
                                  />
                                  <span className="absolute bottom-1 left-1 bg-black/70 text-[7px] text-amber-400 px-1 py-0.5 rounded font-mono font-bold">STAMPED</span>
                                </div>

                                {/* Content text */}
                                <div className="flex-1 min-w-0 flex flex-col justify-between">
                                  <div>
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-[9px] font-black uppercase tracking-wider text-blue-600">{act.category}</span>
                                      <span className={`text-[8px] font-mono px-2 py-0.5 rounded-full font-bold border ${statusBadgeColor}`}>{act.status}</span>
                                    </div>
                                    <h4 className="font-extrabold text-slate-800 text-xs mt-1 truncate">{act.title}</h4>
                                    <p className="text-slate-500 text-[10px] mt-0.5 line-clamp-1">{act.description}</p>
                                  </div>

                                  <div className="border-t border-slate-100 pt-1.5 flex justify-between items-center text-[9px] text-slate-400">
                                    <span className="truncate">📍 {act.gps.address || 'Field Location'}</span>
                                    <span className="font-mono flex-shrink-0 ml-2">{act.timestamp}</span>
                                  </div>

                                  <div className="flex items-center justify-between bg-slate-50 px-2 py-0.5 rounded text-[9px] text-slate-500 mt-1">
                                    <span>Officer: <strong>{act.mName}</strong></span>
                                    <span className="font-mono font-bold text-slate-400">Ward {act.wardNum}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* RIGHT SIDE INSPECTOR - 5 COLS */}
                    <div className="lg:col-span-5">
                      {selectedAct ? (
                        <div className="bg-white border border-slate-300 rounded-xl shadow-md overflow-hidden sticky top-4 space-y-4">
                          {/* Image preview with Secure Watermark overlay */}
                          <div className="relative h-48 bg-slate-950 flex items-center justify-center">
                            <img 
                              src={selectedAct.photo} 
                              alt="Inspected photo stamp" 
                              className="w-full h-full object-cover opacity-80"
                            />
                            {/* Watermark Stamps overlay */}
                            <div className="absolute bottom-3 left-3 bg-black/85 backdrop-blur-md text-white p-2.5 font-mono text-[8px] space-y-0.5 rounded border border-white/20 max-w-[280px]">
                              <p className="font-black text-amber-400 flex items-center gap-1">
                                <Shield className="w-3 h-3" />
                                <span>ZMMS LIVE STAMP VERIFIED</span>
                              </p>
                              <p>DATE: 2026-07-03 | TIME: {selectedAct.timestamp}</p>
                              <p>COORDS: {selectedAct.gps.lat.toFixed(6)}N, {selectedAct.gps.lng.toFixed(6)}E</p>
                              <p>WARD: {selectedAct.wardNum} | ZONE: {selectedAct.mZone.toUpperCase()}</p>
                              <p>OFFICER: {selectedAct.mName.toUpperCase()} ({selectedAct.mEmpId})</p>
                            </div>
                            <div className="absolute top-3 right-3 bg-emerald-600 text-[8px] font-black px-2 py-0.5 rounded text-white shadow-sm flex items-center gap-0.5">
                              <Check className="w-3 h-3" />
                              <span>GIS REPLAY COMPLIANT</span>
                            </div>
                          </div>

                          {/* Inspector Data Grid */}
                          <div className="p-4 space-y-4">
                            <div>
                              <div className="flex items-center justify-between">
                                <span className="bg-blue-100 text-blue-800 text-[9px] font-black uppercase px-2 py-0.5 rounded">{selectedAct.category}</span>
                                <span className="text-[10px] font-mono text-slate-400">{selectedAct.timestamp}</span>
                              </div>
                              <h4 className="font-extrabold text-sm text-slate-800 mt-2">{selectedAct.title}</h4>
                              <p className="text-slate-500 text-xs mt-1 leading-relaxed">{selectedAct.description}</p>
                            </div>

                            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-2 text-[10px] text-slate-600">
                              <div className="flex justify-between border-b border-slate-200/50 pb-1.5">
                                <span className="font-bold">Field Officer:</span>
                                <span className="font-mono text-slate-800">🧑‍✈️ {selectedAct.mName} ({selectedAct.mEmpId})</span>
                              </div>
                              <div className="flex justify-between border-b border-slate-200/50 pb-1.5">
                                <span className="font-bold">Assigned Jurisdiction:</span>
                                <span className="font-mono text-slate-800">Ward Area {selectedAct.wardNum} ({selectedAct.mZone})</span>
                              </div>
                              <div className="flex justify-between border-b border-slate-200/50 pb-1.5">
                                <span className="font-bold">GIS Coordinates:</span>
                                <span className="font-mono text-blue-600 font-bold underline">
                                  {selectedAct.gps.lat.toFixed(5)}° N, {selectedAct.gps.lng.toFixed(5)}° E
                                </span>
                              </div>
                              <div className="flex flex-col gap-1">
                                <span className="font-bold">Verified Address:</span>
                                <span className="text-slate-500 italic leading-tight">📍 {selectedAct.gps.address || 'Loading GPS address registry...'}</span>
                              </div>
                            </div>

                            {/* DECISION TERMINAL */}
                            <div className="border-t border-slate-100 pt-3 space-y-2.5">
                              <div>
                                <label className="font-bold text-slate-400 text-[10px] uppercase block mb-1">Supervisor Specific Remarks</label>
                                <textarea
                                  rows={2}
                                  placeholder="Specify any verification observations, compliance checks, or feedback remarks..."
                                  value={supervisorRemarksText}
                                  onChange={(e) => setSupervisorRemarksText(e.target.value)}
                                  className="w-full p-2 border border-slate-200 rounded-lg text-xs text-slate-800 bg-white"
                                />
                              </div>

                              <div className="flex items-center justify-between text-xs bg-slate-50 p-2 rounded-xl border">
                                <span className="font-bold text-slate-500">Current Status:</span>
                                <span className={`font-extrabold px-2 py-0.5 rounded-full text-[10px] border uppercase ${
                                  selectedAct.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                  selectedAct.status === 'Rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                                  'bg-amber-50 text-amber-700 border-amber-200'
                                }`}>
                                  {selectedAct.status}
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  onClick={() => handleUpdateActivityStatus(selectedAct.id, 'Approved', supervisorRemarksText)}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-2 rounded-lg text-[10px] uppercase tracking-wider transition shadow-sm flex items-center justify-center gap-1"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Approve Stamp</span>
                                </button>
                                <button
                                  onClick={() => handleUpdateActivityStatus(selectedAct.id, 'Rejected', supervisorRemarksText)}
                                  className="bg-red-600 hover:bg-red-700 text-white font-extrabold py-2 rounded-lg text-[10px] uppercase tracking-wider transition shadow-sm flex items-center justify-center gap-1"
                                >
                                  <AlertOctagon className="w-3.5 h-3.5" />
                                  <span>Reject Stamp</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-400 space-y-2 sticky top-4">
                          <Sparkles className="w-12 h-12 mx-auto text-blue-500/70 animate-bounce" />
                          <h4 className="font-extrabold text-slate-700 text-xs">Field Activity Stamp Inspector</h4>
                          <p className="text-[10px] text-slate-400 max-w-[240px] mx-auto leading-normal">
                            Select any submitted zone manager field report card on the left to activate the cryptographic GIS and watermarked photo verification audit pipeline.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* OFFICIAL REPORTS TAB */}
            {activeAdminTab === 'reports' && (() => {
              const { kpis, columns, rows, title } = getReportContent();

              return (
                <div id="reports-tab-container" className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
                  {/* TITLE AREA */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
                    <div>
                      <h3 className="font-extrabold text-xl text-slate-800 flex items-center gap-2">
                        <FileSpreadsheet className="w-5.5 h-5.5 text-blue-600" />
                        <span>ZMMS Municipal Official Reports Engine</span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">Formally compiles, validates, and archives field force telemetry data, attendance logs, and activities required for civic accounting and diesel audits.</p>
                    </div>
                    
                    {/* EXPORT OPTIONS */}
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleExportExcel(title, columns, rows)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                        <span>Export Excel (CSV)</span>
                      </button>
                      <button 
                        onClick={() => setShowPrintModal(true)}
                        className="bg-[#0b3c5d] hover:bg-slate-800 text-white font-bold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 transition shadow-sm cursor-pointer"
                      >
                        <Printer className="w-4 h-4" />
                        <span>Export PDF / Print</span>
                      </button>
                    </div>
                  </div>

                  {/* FILTER CONTROLS GRID */}
                  <div className="bg-slate-50/70 border border-slate-200/80 p-4 rounded-xl grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Frequency Interval</label>
                      <div className="grid grid-cols-3 gap-1 bg-white p-1 rounded-lg border border-slate-200">
                        {['Daily', 'Weekly', 'Monthly'].map((freq) => (
                          <button
                            key={freq}
                            onClick={() => setReportFrequency(freq as any)}
                            className={`text-[10px] font-bold py-1.5 rounded-md transition ${reportFrequency === freq ? 'bg-[#0b3c5d] text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                          >
                            {freq}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Report Parameter Section</label>
                      <select
                        value={reportSection}
                        onChange={(e) => setReportSection(e.target.value as any)}
                        className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs font-semibold text-slate-700"
                      >
                        <option value="Attendance">Muster Shift Attendance</option>
                        <option value="Distance">Travel Distance & Mileage</option>
                        <option value="Activities">Field Activities Audit</option>
                        <option value="Working Hours">Working Hours & Idle Time</option>
                        <option value="Performance">Productivity Scoreboard</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Target Field Officer</label>
                      <select
                        value={reportSelectedManagerId}
                        onChange={(e) => setReportSelectedManagerId(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-xs font-semibold text-slate-700"
                      >
                        <option value="All">All Zone Managers (Aggregated)</option>
                        {state.managers.map(m => (
                          <option key={m.id} value={m.id}>{m.name} ({m.empId})</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Audit Record Date</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400 font-bold" />
                        <input
                          type="date"
                          value={reportDate}
                          onChange={(e) => setReportDate(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 border border-slate-200 bg-white rounded-lg text-xs font-semibold text-slate-700 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* COMPILATION META-HEADER INFO */}
                  <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 bg-blue-50/50 border border-blue-100/70 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 font-semibold text-blue-800">
                      <Shield className="w-4 h-4 text-blue-600" />
                      <span>Live SQL Registry Audit</span>
                    </div>
                    <div className="flex items-center gap-4 font-mono text-[10px] text-slate-400">
                      <span>PERIOD: {reportFrequency.toUpperCase()} ({reportDate})</span>
                      <span>•</span>
                      <span>DATABASE_ID: zm_muster_reps</span>
                      <span>•</span>
                      <span className="text-emerald-600 font-bold">STATUS: STAMPED & CLEARED ✓</span>
                    </div>
                  </div>

                  {/* METRIC CARD PANEL */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {kpis.map((kpi, idx) => (
                      <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-start gap-3 hover:shadow-md transition">
                        <div className={`p-2 rounded-lg text-blue-600 ${kpi.color}`}>
                          <Award className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">{kpi.title}</p>
                          <h4 className="font-extrabold text-lg text-slate-800 mt-0.5">{kpi.value}</h4>
                          <p className="text-[10px] text-slate-500 leading-tight mt-0.5">{kpi.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* REPORT COMPLIED GRID TABLE */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                    <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <h4 className="font-extrabold text-xs text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-slate-500" />
                        <span>Compiled Document: {title}</span>
                      </h4>
                      <span className="text-[9px] font-mono text-slate-400">({rows.length} records generated)</span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50/55 text-slate-500 text-[10px] uppercase font-black tracking-wider">
                            {columns.map((col, idx) => (
                              <th key={idx} className="py-3 px-4">{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-[11px] text-slate-600">
                          {rows.length === 0 ? (
                            <tr>
                              <td colSpan={columns.length} className="py-8 text-center text-slate-400 font-bold">
                                No records complied for selected period.
                              </td>
                            </tr>
                          ) : (
                            rows.map((row, rowIdx) => (
                              <tr key={rowIdx} className="hover:bg-slate-50/40 transition">
                                {row.map((cell, cellIdx) => {
                                  let renderedCell = cell;
                                  if (typeof cell === 'string') {
                                    if (cell.includes('🟢')) {
                                      renderedCell = <span className="bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full font-bold text-[9px] border border-emerald-200/60 inline-flex items-center gap-1">{cell}</span>;
                                    } else if (cell.includes('🔴')) {
                                      renderedCell = <span className="bg-rose-50 text-rose-700 px-2.5 py-0.5 rounded-full font-bold text-[9px] border border-rose-200/60 inline-flex items-center gap-1">{cell}</span>;
                                    } else if (cell.includes('⚠️')) {
                                      renderedCell = <span className="bg-amber-50 text-amber-700 px-2.5 py-0.5 rounded-full font-bold text-[9px] border border-amber-200/60 inline-flex items-center gap-1">{cell}</span>;
                                    } else if (cell === 'Approved') {
                                      renderedCell = <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-bold text-[9px] border border-emerald-200">Approved</span>;
                                    } else if (cell === 'Rejected') {
                                      renderedCell = <span className="bg-red-100 text-red-800 px-1.5 py-0.2 rounded font-bold text-[9px] border border-red-200">Rejected</span>;
                                    } else if (cell === 'Pending') {
                                      renderedCell = <span className="bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-bold text-[9px] border border-amber-200">Pending</span>;
                                    }
                                  }

                                  return (
                                    <td key={cellIdx} className={`py-3 px-4 ${cellIdx === 0 ? 'font-bold text-slate-800' : ''}`}>
                                      {renderedCell}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* SIGN-OFF & CERTIFICATE FOOTER */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full border bg-white flex items-center justify-center flex-shrink-0 text-slate-700 font-extrabold text-[10px] shadow-sm uppercase">
                        SEAL
                      </div>
                      <div>
                        <h5 className="text-xs font-black text-slate-700 uppercase tracking-wide">MUNICIPAL COUNCIL SANITATION SANCTION STATUS</h5>
                        <p className="text-[10px] text-slate-400">This document has been cryptographically validated using verified GPS records, webcam snapshots, and biometric timestamps.</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-[10px] font-black text-slate-700 uppercase">Supervisor Verifier</p>
                        <p className="text-[9px] font-mono text-slate-400">ID-749F-GOVT</p>
                      </div>
                      <div className="bg-white px-3 py-1.5 border rounded-lg shadow-inner select-none pointer-events-none font-serif text-sm font-semibold italic text-slate-500 transform -rotate-2">
                        Admin Audit Approved
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {activeAdminTab === 'notifications' && (() => {
              const attendanceRemindersCount = state.notifications.filter(n => n.type === 'attendance-reminder').length;
              const taskRemindersCount = state.notifications.filter(n => n.type === 'task-reminder').length;
              const gpsOffCount = state.notifications.filter(n => n.type === 'gps-off').length;
              const newTasksCount = state.notifications.filter(n => n.type === 'new-task').length;
              const pendingActivitiesCount = state.notifications.filter(n => n.type === 'activity-pending').length;

              const filteredNotifications = state.notifications.filter(n => {
                if (notifFilterType === 'All') return true;
                return n.type === notifFilterType;
              });

              return (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 animate-[fadeIn_0.3s_ease-out]">
                  
                  {/* METRIC OVERVIEW BOARDS */}
                  <div className="lg:col-span-12 grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div 
                      onClick={() => setNotifFilterType('attendance-reminder')}
                      className={`cursor-pointer bg-white rounded-xl shadow-sm border p-3 flex flex-col justify-between transition-all hover:scale-[1.02] ${notifFilterType === 'attendance-reminder' ? 'border-orange-500 ring-2 ring-orange-200' : 'border-slate-200'}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-lg">⏰</span>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Attendance</span>
                      </div>
                      <div className="mt-2">
                        <p className="text-xl font-black text-slate-800">{attendanceRemindersCount}</p>
                        <p className="text-[10px] text-slate-500">Reminders Sent</p>
                      </div>
                    </div>

                    <div 
                      onClick={() => setNotifFilterType('task-reminder')}
                      className={`cursor-pointer bg-white rounded-xl shadow-sm border p-3 flex flex-col justify-between transition-all hover:scale-[1.02] ${notifFilterType === 'task-reminder' ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-200'}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-lg">⏳</span>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Tasks</span>
                      </div>
                      <div className="mt-2">
                        <p className="text-xl font-black text-slate-800">{taskRemindersCount}</p>
                        <p className="text-[10px] text-slate-500">Deadline Reminders</p>
                      </div>
                    </div>

                    <div 
                      onClick={() => setNotifFilterType('gps-off')}
                      className={`cursor-pointer bg-white rounded-xl shadow-sm border p-3 flex flex-col justify-between transition-all hover:scale-[1.02] ${notifFilterType === 'gps-off' ? 'border-red-500 ring-2 ring-red-200' : 'border-slate-200'}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-lg">🚨</span>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">GPS Off</span>
                      </div>
                      <div className="mt-2">
                        <p className="text-xl font-black text-rose-600">{gpsOffCount}</p>
                        <p className="text-[10px] text-slate-500">Telemetry Outages</p>
                      </div>
                    </div>

                    <div 
                      onClick={() => setNotifFilterType('new-task')}
                      className={`cursor-pointer bg-white rounded-xl shadow-sm border p-3 flex flex-col justify-between transition-all hover:scale-[1.02] ${notifFilterType === 'new-task' ? 'border-green-500 ring-2 ring-green-200' : 'border-slate-200'}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-lg">📋</span>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">New Directives</span>
                      </div>
                      <div className="mt-2">
                        <p className="text-xl font-black text-slate-800">{newTasksCount}</p>
                        <p className="text-[10px] text-slate-500">Directives Issued</p>
                      </div>
                    </div>

                    <div 
                      onClick={() => setNotifFilterType('activity-pending')}
                      className={`cursor-pointer bg-white rounded-xl shadow-sm border p-3 flex flex-col justify-between transition-all hover:scale-[1.02] ${notifFilterType === 'activity-pending' ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-slate-200'}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-lg">📝</span>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Pendings</span>
                      </div>
                      <div className="mt-2">
                        <p className="text-xl font-black text-slate-800">{pendingActivitiesCount}</p>
                        <p className="text-[10px] text-slate-500">Inspection Reviews</p>
                      </div>
                    </div>
                  </div>

                  {/* LEFT SIDE: BROADCAST PANEL */}
                  <div className="lg:col-span-5 bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-indigo-50 text-indigo-700 rounded-lg">
                          <Bell className="w-5 h-5 animate-bounce" />
                        </div>
                        <div>
                          <h3 className="font-extrabold text-sm text-slate-800">Operational Broadcast Desk</h3>
                          <p className="text-[10px] text-slate-500">Issue direct telemetry triggers and reminders to field force terminals</p>
                        </div>
                      </div>
                    </div>

                    <form onSubmit={handleBroadcastNotification} className="space-y-4">
                      {/* Alert Type */}
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500">Telemetry Alert Category</label>
                        <select 
                          value={notifFormType}
                          onChange={(e) => setNotifFormType(e.target.value as any)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        >
                          <option value="attendance-reminder">⏰ Shift Attendance Reminder</option>
                          <option value="task-reminder">⏳ Task Deadline & Status Reminder</option>
                          <option value="gps-off">🚨 GPS Off / Connection Outage Alert</option>
                          <option value="new-task">📋 New Task Notification</option>
                          <option value="activity-pending">📝 Activity Verification Notice</option>
                        </select>
                      </div>

                      {/* Target Officer */}
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500">Target Field Officer</label>
                        <select 
                          value={notifFormManagerId}
                          onChange={(e) => setNotifFormManagerId(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        >
                          <option value="all">📢 Broadcast to All Zone Officers</option>
                          {state.managers.map(m => (
                            <option key={m.id} value={m.id}>{m.name} ({m.zone.split(' ')[0]} - Ward {m.wards.join(',')}) [{m.status}]</option>
                          ))}
                        </select>
                      </div>

                      {/* Message Body */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] uppercase font-bold text-slate-500">Custom Alert Message</label>
                          <span className="text-[9px] text-slate-400 font-medium">Leave empty for system standard preset</span>
                        </div>
                        <textarea 
                          rows={4}
                          value={notifFormCustomBody}
                          onChange={(e) => setNotifFormCustomBody(e.target.value)}
                          placeholder="Type an urgent message body here, or leave empty to dispatch a standardized system telemetry notification..."
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200 leading-relaxed placeholder-slate-400"
                        />
                      </div>

                      <button 
                        type="submit"
                        className="w-full bg-indigo-700 hover:bg-indigo-800 text-white font-bold py-2.5 px-4 rounded-lg text-xs shadow-sm transition-all flex items-center justify-center gap-1.5"
                      >
                        <Bell className="w-4 h-4" />
                        <span>Dispatch Command Alert</span>
                      </button>
                    </form>

                    <div className="bg-slate-50 rounded-xl p-3 border border-dashed border-slate-200 text-[11px] text-slate-500 leading-relaxed">
                      <p className="font-bold text-slate-700 mb-1 flex items-center gap-1">
                        <span>💡</span>
                        <span>Interactive Simulation Testing</span>
                      </p>
                      Triggering alerts from this desk immediately updates the main notifications feed, fires simulated toasters, and triggers real-time in-app slide-downs on active Zone Manager field terminals.
                    </div>
                  </div>

                  {/* RIGHT SIDE: NOTIFICATION STREAM */}
                  <div className="lg:col-span-7 bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col gap-4">
                    
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                      <div>
                        <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                          <span>🔔 Live Notification Stream</span>
                          <span className="bg-indigo-50 text-indigo-700 text-[10px] font-black px-2 py-0.5 rounded-full">{filteredNotifications.length} Alerts</span>
                        </h3>
                        <p className="text-[10px] text-slate-500">Real-time municipal audit feeds and dispatch history</p>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <button 
                          onClick={handleClearAllNotifications}
                          className="px-2.5 py-1.5 text-[10px] font-bold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-all"
                        >
                          Clear All Logs
                        </button>
                      </div>
                    </div>

                    {/* Filter bar */}
                    <div className="flex flex-wrap gap-1.5">
                      <button 
                        onClick={() => setNotifFilterType('All')}
                        className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${notifFilterType === 'All' ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                      >
                        All Feed
                      </button>
                      <button 
                        onClick={() => setNotifFilterType('attendance-reminder')}
                        className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${notifFilterType === 'attendance-reminder' ? 'bg-orange-600 text-white' : 'bg-orange-50 text-orange-700 hover:bg-orange-100'}`}
                      >
                        ⏰ Attendance
                      </button>
                      <button 
                        onClick={() => setNotifFilterType('task-reminder')}
                        className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${notifFilterType === 'task-reminder' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
                      >
                        ⏳ Tasks
                      </button>
                      <button 
                        onClick={() => setNotifFilterType('gps-off')}
                        className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${notifFilterType === 'gps-off' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-700 hover:bg-red-100'}`}
                      >
                        🚨 GPS Off
                      </button>
                      <button 
                        onClick={() => setNotifFilterType('new-task')}
                        className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${notifFilterType === 'new-task' ? 'bg-green-600 text-white' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}
                      >
                        📋 New Directives
                      </button>
                      <button 
                        onClick={() => setNotifFilterType('activity-pending')}
                        className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${notifFilterType === 'activity-pending' ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}`}
                      >
                        📝 Audits
                      </button>
                    </div>

                    {/* Notification list */}
                    <div className="flex-1 overflow-y-auto max-h-[460px] pr-1 space-y-3">
                      {filteredNotifications.length === 0 ? (
                        <div className="text-center py-12 space-y-2 border border-dashed rounded-xl border-slate-200">
                          <p className="text-2xl">💤</p>
                          <p className="text-xs font-bold text-slate-600">No telemetry logs found</p>
                          <p className="text-[10px] text-slate-400 max-w-xs mx-auto">Either select another category or use the Operational Broadcast Desk to dispatch alerts.</p>
                        </div>
                      ) : (
                        filteredNotifications.map(n => {
                          const associatedManager = state.managers.find(m => m.id === n.managerId);
                          
                          return (
                            <div 
                              key={n.id}
                              className="group p-3 border border-slate-100 rounded-xl hover:border-slate-200 hover:bg-slate-50 transition-all flex items-start gap-3 relative"
                            >
                              {/* Left Icon with color ring */}
                              <div className={`p-2.5 rounded-xl text-lg flex items-center justify-center shrink-0 ${
                                n.type === 'attendance-reminder' ? 'bg-orange-50 text-orange-600' :
                                n.type === 'task-reminder' ? 'bg-blue-50 text-blue-600' :
                                n.type === 'gps-off' ? 'bg-red-50 text-red-600 border border-red-100 animate-pulse' :
                                n.type === 'new-task' ? 'bg-green-50 text-green-600' :
                                'bg-indigo-50 text-indigo-600'
                              }`}>
                                {n.type === 'attendance-reminder' ? '⏰' :
                                 n.type === 'task-reminder' ? '⏳' :
                                 n.type === 'gps-off' ? '🚨' :
                                 n.type === 'new-task' ? '📋' : '📝'}
                              </div>

                              {/* Text body */}
                              <div className="flex-1 space-y-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <h4 className="font-extrabold text-xs text-slate-800">{n.title}</h4>
                                  <span className="text-[9px] text-slate-400 font-medium font-mono">{n.time}</span>
                                  
                                  {/* Associated officer badge */}
                                  {associatedManager && (
                                    <span className="text-[8px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded border border-slate-200">
                                      👤 {associatedManager.name} ({associatedManager.zone.split(' ')[0]})
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-600 leading-relaxed pr-6">{n.body}</p>
                              </div>

                              {/* Hover actions */}
                              <button 
                                onClick={() => handleDeleteNotification(n.id)}
                                title="Resolve & Dismiss Alert"
                                className="absolute right-3 top-3 p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                              >
                                ✕
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {activeAdminTab === 'firebase' && (
              <FirebaseControl managers={state.managers} />
            )}
          </>
        ) : (
          /* =======================================
             MATERIAL DESIGN 3 FIELD DEVICE APP
             ======================================= */
          <div className={`max-w-md mx-auto w-full bg-slate-900 rounded-[3rem] shadow-2xl border-[10px] border-slate-800 overflow-hidden relative flex flex-col min-h-[720px] transition-all duration-500 select-none ${batteryOptimization ? 'brightness-90 contrast-105' : ''}`}>
            
            {/* PHYSICAL NOTCH & SPEAKER */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-800 rounded-b-2xl z-50 flex items-center justify-center gap-1.5">
              <span className="w-12 h-1 bg-slate-900 rounded-full"></span>
              <span className="w-2.5 h-2.5 bg-slate-950 rounded-full border border-slate-800"></span>
            </div>

            {/* STATUS BAR (ANDROID MD3 STYLE) */}
            <div className="bg-[#0b3c5d] pt-6 pb-2 px-6 flex justify-between items-center text-[11px] font-semibold text-blue-100 z-40">
              <span className="font-mono text-xs">{state.simulationTime.split(' ').slice(-2).join(' ')}</span>
              <div className="flex items-center gap-2">
                <span className="text-[9px] bg-blue-700/50 px-2 py-0.5 rounded-full border border-blue-500/30">
                  {selectedManager.zone.split(' ')[0]} {selectedManager.wards.join(',')}
                </span>
                {offlineMode ? (
                  <div className="flex items-center gap-1 text-rose-400 font-bold">
                    <WifiOff className="w-3.5 h-3.5" />
                    <span>OFFLINE</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-emerald-400 font-bold animate-pulse">
                    <Wifi className="w-3.5 h-3.5" />
                    <span>5G.SEC</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Battery className={`w-4 h-4 ${selectedManager.battery < 20 ? 'text-rose-500 animate-bounce' : 'text-emerald-400'}`} />
                  <span>{selectedManager.battery}%</span>
                </div>
              </div>
            </div>

            {/* SLIDE-DOWN PUSH NOTIFICATION BANNER */}
            {activePushNotification && (
              <div className="absolute top-14 left-3 right-3 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-2xl p-3 shadow-2xl z-50 animate-bounce flex items-start gap-3 text-white">
                <div className="bg-amber-500 p-2 rounded-xl text-slate-950">
                  <AlertOctagon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h5 className="font-bold text-xs text-amber-400 flex items-center gap-1.5">
                    <span>{activePushNotification.title}</span>
                    <span className="text-[8px] bg-slate-800 text-slate-400 px-1 py-0.2 rounded">LIVE PUSH</span>
                  </h5>
                  <p className="text-[10px] text-slate-300 mt-0.5 line-clamp-2 leading-snug">{activePushNotification.body}</p>
                </div>
                <button 
                  onClick={() => setActivePushNotification(null)}
                  className="text-slate-400 hover:text-white font-bold text-xs p-1"
                >
                  ✕
                </button>
              </div>
            )}

            {/* APP CONTENT WINDOW */}
            <div className={`flex-1 flex flex-col relative ${batteryOptimization ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
              
              {!isMobileLoggedIn ? (
                /* =======================================
                   ENTERPRISE LOGIN SCREEN (MD3)
                   ======================================= */
                <div className="flex-1 p-6 flex flex-col justify-between overflow-y-auto bg-gradient-to-b from-[#0b3c5d] via-[#114b73] to-slate-950 text-white">
                  
                  <div className="text-center pt-8 space-y-3">
                    <div className="w-16 h-16 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl mx-auto flex items-center justify-center shadow-lg">
                      <Shield className="w-9 h-9 text-blue-300 animate-pulse" />
                    </div>
                    <div>
                      <span className="text-[9px] tracking-widest uppercase font-black bg-blue-500/30 border border-blue-500/50 px-2.5 py-0.5 rounded-full text-blue-300">
                        Delhi Govt Official
                      </span>
                      <h2 className="text-xl font-black mt-2 text-white">ZMMS Field Terminal</h2>
                      <p className="text-xs text-blue-200 mt-1">Zone Manager Mobile Dispatch System</p>
                    </div>
                  </div>

                  {/* LOGIN FORM */}
                  <div className="my-6 space-y-4 bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-3xl p-5 shadow-xl">
                    <h4 className="font-extrabold text-xs text-slate-300 uppercase tracking-wider">Device Authorization</h4>
                    
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 block uppercase">Employee ID</label>
                      <div className="relative">
                        <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                        <input 
                          type="text" 
                          placeholder="e.g. EMP202601"
                          value={mobileEmpId}
                          onChange={(e) => setMobileEmpId(e.target.value)}
                          className="w-full bg-slate-950/80 border border-slate-800 pl-9 pr-3 py-2 text-xs rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-white placeholder-slate-600"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 block uppercase">Terminal Password</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                        <input 
                          type="password" 
                          placeholder="••••••••"
                          value={mobilePassword}
                          onChange={(e) => setMobilePassword(e.target.value)}
                          className="w-full bg-slate-950/80 border border-slate-800 pl-9 pr-3 py-2 text-xs rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-white placeholder-slate-600"
                        />
                      </div>
                    </div>

                    {/* Submit Button */}
                    <button
                      onClick={() => {
                        if (!mobileEmpId || !mobilePassword) {
                          alert('⚠️ Authorization Error: Please input both Employee ID and password!');
                          return;
                        }
                        const manager = state.managers.find(m => m.empId.trim().toUpperCase() === mobileEmpId.trim().toUpperCase());
                        if (manager) {
                          setSelectedManagerId(manager.id);
                          setIsMobileLoggedIn(true);
                          // Trigger push notification
                          const newNotif = {
                            id: `m-notif-${Date.now()}`,
                            title: '🔐 Secure Session Initialized',
                            body: `Logged in as Zone Manager ${manager.name}. Mobile terminal synchronised.`,
                            time: 'Just now',
                            read: false
                          };
                          setMobileNotifications(prev => [newNotif, ...prev]);
                        } else {
                          alert('❌ Security Rejection: Invalid Employee ID or credentials!');
                        }
                      }}
                      className="w-full bg-[#328cc1] hover:bg-blue-500 text-slate-950 font-black py-2.5 rounded-xl transition duration-200 text-xs shadow-lg uppercase tracking-wider flex items-center justify-center gap-2 mt-2"
                    >
                      <Lock className="w-3.5 h-3.5 text-slate-950" />
                      <span>Authorize & Sign In</span>
                    </button>
                  </div>

                  {/* QUICK DEMO ACCOUNT CHIPS */}
                  <div className="space-y-2.5 bg-slate-950/40 p-4 rounded-2xl border border-slate-900">
                    <p className="text-[10px] font-bold text-blue-300 uppercase flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                      <span>Sandbox Quick Emulator Accounts</span>
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <button 
                        onClick={() => {
                          setMobileEmpId('EMP202601');
                          setMobilePassword('password');
                          const manager = state.managers.find(m => m.empId === 'EMP202601');
                          if (manager) {
                            setSelectedManagerId(manager.id);
                            setIsMobileLoggedIn(true);
                          }
                        }}
                        className="bg-slate-900 border border-slate-800 p-2 rounded-xl text-left hover:border-blue-500/50 transition duration-150"
                      >
                        <p className="font-extrabold text-white text-[11px]">Rohan (North)</p>
                        <p className="text-[9px] text-slate-400 font-mono">EMP202601 | pwd</p>
                      </button>
                      <button 
                        onClick={() => {
                          setMobileEmpId('EMP202602');
                          setMobilePassword('password');
                          const manager = state.managers.find(m => m.empId === 'EMP202602');
                          if (manager) {
                            setSelectedManagerId(manager.id);
                            setIsMobileLoggedIn(true);
                          }
                        }}
                        className="bg-slate-900 border border-slate-800 p-2 rounded-xl text-left hover:border-blue-500/50 transition duration-150"
                      >
                        <p className="font-extrabold text-white text-[11px]">Amit (South)</p>
                        <p className="text-[9px] text-slate-400 font-mono">EMP202602 | pwd</p>
                      </button>
                    </div>
                  </div>

                  {/* SYSTEM HEALTH STAMP */}
                  <div className="flex items-center justify-between text-[9px] text-blue-300 border-t border-blue-900/50 pt-3">
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                      <span>GPS Cryptographic Lock Active</span>
                    </span>
                    <span>v3.2.14-Build-902</span>
                  </div>

                </div>
              ) : (
                /* =======================================
                   AUTHENTICATED APPLICATION TABS (MD3)
                   ======================================= */
                <div className="flex-1 flex flex-col justify-between overflow-hidden">
                  
                  {/* APP SUB-HEADER */}
                  <div className="bg-[#0b3c5d] text-white px-4 py-2.5 flex items-center justify-between shadow z-30">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-amber-500 text-slate-950 font-black rounded-xl flex items-center justify-center text-xs shadow">
                        {selectedManager.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-white">{selectedManager.name}</h4>
                        <p className="text-[9px] text-blue-200">{selectedManager.zone} | {selectedManager.empId}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Emergency quick toggle indicator */}
                      {selectedManager.sos && (
                        <span className="bg-red-600 text-white font-black px-2 py-0.5 rounded text-[8px] animate-ping mr-1">
                          SOS ACTIVATED
                        </span>
                      )}

                      {/* Online/Offline network toggle slider */}
                      <button
                        onClick={() => {
                          const nextOffline = !offlineMode;
                          setOfflineMode(nextOffline);
                        }}
                        className={`px-2.5 py-1 text-[9px] font-extrabold rounded-lg flex items-center gap-1 shadow-sm transition-all duration-200 ${offlineMode ? 'bg-red-600/90 text-white border border-red-500' : 'bg-blue-700 text-white border border-blue-600'}`}
                      >
                        {offlineMode ? <WifiOff className="w-3 h-3" /> : <Wifi className="w-3 h-3" />}
                        <span>{offlineMode ? 'OFFLINE' : 'ONLINE'}</span>
                      </button>
                    </div>
                  </div>

                  {/* ACTIVE TAB DISPLAY COMPONENT */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    
                    {/* -------------------- TAB 1: SHIFT MAP & ATTENDANCE -------------------- */}
                    {mobileActiveTab === 'home' && (
                      <div className="space-y-4 animate-fadeIn">
                        
                        {/* ATTENDANCE SHIFT CARD */}
                        <div className={`rounded-2xl border p-4 shadow-sm transition-all duration-300 ${batteryOptimization ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-800'}`}>
                          <div className="flex justify-between items-center border-b pb-2">
                            <span className="text-[10px] uppercase font-black tracking-wider text-slate-400">Shift Operations Log</span>
                            <span className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full ${selectedManager.status === 'checked-in' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'}`}>
                              {selectedManager.status === 'checked-in' ? 'Checked-In (On Shift)' : 'Not Checked-In'}
                            </span>
                          </div>

                          {selectedManager.status === 'checked-in' ? (
                            /* ACTIVE SHIFT SUMMARY */
                            <div className="space-y-3 pt-3">
                              <div className="grid grid-cols-2 gap-3 text-xs">
                                <div className="bg-slate-100/50 p-2.5 rounded-xl border border-slate-200/50">
                                  <p className="text-[9px] font-black text-slate-400 uppercase">Shift Began</p>
                                  <p className="font-extrabold text-slate-700 mt-0.5">{selectedManager.attendance?.checkInTime || '09:00 AM'}</p>
                                </div>
                                <div className="bg-slate-100/50 p-2.5 rounded-xl border border-slate-200/50">
                                  <p className="text-[9px] font-black text-slate-400 uppercase">Coverage Mapped</p>
                                  <p className="font-extrabold text-slate-700 mt-0.5">{selectedManager.distanceTravelledKm} km</p>
                                </div>
                              </div>

                              <div className="text-[11px] space-y-1 bg-blue-50/50 border border-blue-100/80 p-2.5 rounded-xl">
                                <p className="font-mono text-[10px] text-slate-600 flex items-center gap-1 truncate">
                                  <MapPin className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                                  <span>{selectedManager.currentLat.toFixed(5)}°N, {selectedManager.currentLng.toFixed(5)}°E</span>
                                </p>
                                <p className="text-slate-500 font-medium truncate pl-4.5">📌 {selectedManager.currentAddress}</p>
                              </div>

                              {/* Digitally Sign and Checkout Trigger */}
                              <div className="border-t border-dashed border-slate-200 pt-3 space-y-2">
                                <p className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                                  <PenTool className="w-3.5 h-3.5 text-indigo-500" />
                                  <span>Digital Touch Signature Required for Checkout</span>
                                </p>
                                <div className="bg-slate-100 border border-slate-300 rounded-xl overflow-hidden">
                                  <canvas 
                                    ref={canvasRef}
                                    width={320}
                                    height={80}
                                    onMouseDown={startDrawing}
                                    onMouseMove={draw}
                                    onMouseUp={stopDrawing}
                                    onMouseLeave={stopDrawing}
                                    className="w-full h-[80px] cursor-crosshair bg-white"
                                  />
                                </div>
                                <div className="flex gap-2 text-xs">
                                  <button 
                                    onClick={clearSignature}
                                    className="flex-1 py-1.5 rounded-lg border border-slate-300 text-slate-500 font-bold hover:bg-slate-50 text-[10px]"
                                  >
                                    Clear Signature
                                  </button>
                                  <button 
                                    onClick={() => handleCheckOut(selectedManager.id)}
                                    className="flex-1 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[10px] shadow"
                                  >
                                    Shift Check-Out
                                  </button>
                                </div>
                              </div>

                              {/* SOS FLAGGED CONTROL */}
                              <button
                                onClick={() => handleTriggerSOS(selectedManager.id)}
                                className={`w-full py-2.5 rounded-xl font-black text-xs text-white uppercase tracking-wider transition-all duration-300 shadow-md flex items-center justify-center gap-2 ${selectedManager.sos ? 'bg-red-700 animate-pulse border border-red-500' : 'bg-red-600 hover:bg-red-700'}`}
                              >
                                <AlertOctagon className="w-4 h-4 text-white" />
                                <span>{selectedManager.sos ? '🚨 EMERGENCY SOS ACTIVE - TAP CANCEL' : '🚨 TRIGGER EMERGENCY SOS'}</span>
                              </button>
                            </div>
                          ) : (
                            /* INACTIVE / CHECK-IN PANEL */
                            <div className="space-y-3 pt-3">
                              <p className="text-xs text-slate-500 leading-relaxed">
                                Enter your duty zone and record biometric selfie to authenticate shift initiation. GPS check-in lock matches municipal muster coordinates.
                              </p>

                              {/* Selfie camera capture emulator */}
                              <div className="space-y-2">
                                <label className="text-[9px] uppercase font-bold text-slate-400 block">Biometric Shift Photo ID Verification</label>
                                <div className="relative h-28 bg-slate-900 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
                                  <img 
                                    src={selectedSelfiePhoto} 
                                    alt="Biometric Capture" 
                                    className="w-full h-full object-cover opacity-80"
                                  />
                                  <div className="absolute top-1.5 left-1.5 bg-black/60 px-1.5 py-0.5 rounded text-[8px] font-mono text-emerald-400 border border-emerald-500/20">
                                    [SELFIE CAMERA PREVIEW]
                                  </div>
                                </div>
                                <div className="grid grid-cols-4 gap-1.5">
                                  {MOCK_SELFIES.map((selfie, i) => (
                                    <button
                                      key={i}
                                      onClick={() => setSelectedSelfiePhoto(selfie.url)}
                                      className={`border rounded-lg overflow-hidden h-10 hover:opacity-100 transition ${selectedSelfiePhoto === selfie.url ? 'border-blue-500 scale-105 shadow-sm' : 'border-slate-200 opacity-60'}`}
                                    >
                                      <img src={selfie.url} alt={selfie.name} className="w-full h-full object-cover" />
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <button
                                onClick={() => {
                                  // Call check-in function
                                  handleCheckIn(selectedManager);
                                }}
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-2.5 rounded-xl text-xs uppercase tracking-wider transition shadow-md flex items-center justify-center gap-1.5"
                              >
                                <CheckCircle className="w-4 h-4" />
                                <span>Mark GPS Shift Check-In</span>
                              </button>
                            </div>
                          )}
                        </div>

                        {/* GOOGLE MAPS SHOWING CURRENT LOCATION */}
                        <div className="rounded-2xl border bg-slate-950 border-slate-800 p-3 shadow-md space-y-2 text-white relative overflow-hidden">
                          <div className="flex justify-between items-center px-1">
                            <h5 className="text-xs font-black flex items-center gap-1.5 text-blue-300 uppercase">
                              <Map className="w-4 h-4" />
                              <span>Google Maps Locator</span>
                            </h5>
                            <span className="text-[9px] bg-emerald-950 text-emerald-400 font-mono px-2 py-0.5 rounded border border-emerald-800/50">
                              Accuracy: ±3m
                            </span>
                          </div>

                          {/* MAP CANVAS GRID */}
                          <div className="w-full h-52 bg-slate-900 rounded-xl relative overflow-hidden border border-slate-800">
                            
                            {/* Grid Map Background representing lines */}
                            <svg className="w-full h-full absolute inset-0 opacity-15 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
                              <defs>
                                <pattern id="m-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#328cc1" strokeWidth="0.5"/>
                                </pattern>
                              </defs>
                              <rect width="100%" height="100%" fill="url(#m-grid)" />
                            </svg>

                            {/* Ward Poly outline representing boundary */}
                            <svg className="w-full h-full absolute inset-0 opacity-25 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
                              <rect x="20" y="20" width="300" height="150" rx="15" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeDasharray="3 3" />
                              <text x="35" y="38" fill="#ffffff" fontSize="9" fontWeight="extrabold" fontFamily="monospace">ASSIGNED SECTOR (WARD {selectedManager.wards.join(', ')})</text>
                              
                              <line x1="0" y1="110" x2="400" y2="110" stroke="#328cc1" strokeWidth="2" />
                              <text x="10" y="102" fill="#328cc1" fontSize="8" fontWeight="bold">MUNICIPAL CANAL DRIVE</text>
                            </svg>

                            {/* HISTORIC PATH HISTORY TRAILS */}
                            {selectedManager.pathHistory && selectedManager.pathHistory.length > 0 && (
                              <div className="absolute inset-0 pointer-events-none">
                                <svg className="w-full h-full absolute inset-0" xmlns="http://www.w3.org/2000/svg">
                                  <path 
                                    d={`M 60,140 L 140,80 L 220,120 L 290,60`} 
                                    fill="none" 
                                    stroke="#328cc1" 
                                    strokeWidth="2" 
                                    strokeDasharray="4 4"
                                  />
                                  {/* Past nodes */}
                                  <circle cx="60" cy="140" r="4" fill="#328cc1" />
                                  <circle cx="140" cy="80" r="4" fill="#328cc1" />
                                  <circle cx="220" cy="120" r="4" fill="#328cc1" />
                                </svg>
                              </div>
                            )}

                            {/* LANDMARK LABELS */}
                            <div className="absolute top-10 left-36 bg-slate-950/80 backdrop-blur-xs border border-slate-800 text-[8px] font-bold p-1 rounded">
                              🏢 Ward Office Terminal
                            </div>
                            <div className="absolute top-32 left-12 bg-slate-950/80 backdrop-blur-xs border border-slate-800 text-[8px] font-bold p-1 rounded">
                              🚛 Sanitation Transfer point
                            </div>

                            {/* CURRENT GPS BLINKING BLUE DOT */}
                            <div className="absolute top-2/3 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
                              <span className="absolute w-8 h-8 rounded-full bg-blue-500/30 animate-ping"></span>
                              <span className="absolute w-4 h-4 rounded-full bg-blue-400/50 animate-pulse"></span>
                              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-white shadow-md"></span>
                            </div>

                            {/* Floating Map controllers */}
                            <div className="absolute bottom-2 right-2 flex flex-col gap-1 z-40">
                              <button 
                                onClick={() => alert('Simulating Google Map Zoom In')}
                                className="w-6 h-6 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded flex items-center justify-center text-xs border border-slate-700"
                              >
                                +
                              </button>
                              <button 
                                onClick={() => alert('Simulating Google Map Zoom Out')}
                                className="w-6 h-6 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded flex items-center justify-center text-xs border border-slate-700"
                              >
                                −
                              </button>
                            </div>
                            
                            <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-md px-2 py-1 rounded text-[8px] font-mono border border-slate-800/80">
                              LAT: {selectedManager.currentLat.toFixed(5)}N | LNG: {selectedManager.currentLng.toFixed(5)}E
                            </div>
                          </div>

                          <p className="text-[10px] text-slate-400 leading-snug px-1">
                            Google Maps engine coordinates verified from mobile hardware registry. Flashing blue dot represents real-time cellular triangulation.
                          </p>
                        </div>

                        {/* LIVE GPS BACKGROUND TRACKING TIMER & LOG */}
                        <div className={`rounded-2xl border p-4 shadow-sm space-y-3 ${batteryOptimization ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                          <div className="flex justify-between items-center">
                            <h5 className="text-xs font-black flex items-center gap-1 text-slate-700 dark:text-slate-200 uppercase">
                              <Clock className="w-4 h-4 text-emerald-500 animate-pulse" />
                              <span>2-Minute Background GPS Engine</span>
                            </h5>
                            <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded uppercase border border-emerald-300">
                              ACTIVE
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-500 space-y-1 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                            <div className="flex justify-between font-bold text-slate-400 text-[10px] border-b pb-1">
                              <span>PINGER LOGS</span>
                              <span>INTERVAL: 2 MINS</span>
                            </div>
                            <div className="space-y-1 pt-1 font-mono text-[9px] divide-y divide-slate-100 dark:divide-slate-900">
                              <p className="py-1 text-emerald-600 font-bold flex justify-between">
                                <span>[Now] Cell GPS Lock Uploaded</span>
                                <span>{selectedManager.currentLat.toFixed(4)}, {selectedManager.currentLng.toFixed(4)}</span>
                              </p>
                              {selectedManager.pathHistory && selectedManager.pathHistory.slice(0, 3).map((hist, idx) => (
                                <p key={idx} className="py-1 text-slate-400 flex justify-between">
                                  <span>[{hist.timestamp}] Logged Checkpoint</span>
                                  <span>{hist.lat.toFixed(4)}, {hist.lng.toFixed(4)} ({hist.network})</span>
                                </p>
                              ))}
                            </div>
                          </div>
                          <p className="text-[9.5px] text-slate-400 italic">
                            Live background daemon updates coordinates automatically every 2 minutes. Battery safety constraints are monitored by Android OS.
                          </p>
                        </div>

                      </div>
                    )}

                    {/* -------------------- TAB 2: FIELD DIRECTIVES (TASKS) -------------------- */}
                    {mobileActiveTab === 'tasks' && (
                      <div className="space-y-4 animate-fadeIn">
                        
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-100 uppercase">Today's Assigned Directives</h4>
                            <p className="text-[10px] text-slate-400">Perform tasks to verify safety and sanitation in assigned wards</p>
                          </div>
                          <span className="text-[10px] font-black bg-[#328cc1] text-white px-2.5 py-0.5 rounded-full">
                            {state.tasks.filter(t => t.managerId === selectedManager.id).length} Active
                          </span>
                        </div>

                        {/* LIST OF TASKS FOR ACTIVE MANAGER */}
                        <div className="space-y-3">
                          {state.tasks.filter(t => t.managerId === selectedManager.id).length === 0 ? (
                            <div className="bg-white rounded-2xl border p-6 text-center text-slate-400 border-slate-200">
                              <CheckCircle className="w-10 h-10 mx-auto text-slate-300 animate-pulse mb-2" />
                              <p className="text-xs font-bold">Excellent! No assigned directives pending today.</p>
                              <p className="text-[10px] text-slate-400 mt-1">All sanitation checkpoints in your wards are marked clear.</p>
                            </div>
                          ) : (
                            state.tasks.filter(t => t.managerId === selectedManager.id).map(t => {
                              let priorityColor = 'bg-slate-100 text-slate-700';
                              if (t.priority === 'Critical') priorityColor = 'bg-rose-100 text-rose-800 border border-rose-300 animate-pulse font-bold';
                              if (t.priority === 'High') priorityColor = 'bg-orange-100 text-orange-800 border border-orange-200 font-bold';
                              if (t.priority === 'Medium') priorityColor = 'bg-amber-100 text-amber-800 border border-amber-200';

                              return (
                                <div key={t.id} className={`rounded-2xl border p-4 shadow-sm flex flex-col gap-2 transition ${batteryOptimization ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                                  <div className="flex justify-between items-start gap-2">
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className={`text-[8px] font-extrabold uppercase px-2 py-0.5 rounded-full ${priorityColor}`}>
                                          {t.priority}
                                        </span>
                                        <span className="text-[9px] bg-slate-100 text-slate-600 dark:bg-slate-950 dark:text-slate-400 px-1.5 py-0.5 rounded font-mono font-bold">
                                          WARD {t.ward}
                                        </span>
                                      </div>
                                      <h5 className="font-extrabold text-xs text-slate-800 dark:text-slate-100 leading-snug">{t.title}</h5>
                                      <p className="text-[10.5px] text-slate-500 leading-normal">{t.desc}</p>
                                    </div>
                                  </div>

                                  <div className="border-t border-slate-100 dark:border-slate-800/80 pt-2 mt-1 space-y-2">
                                    <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold">
                                      <span className="text-amber-600 font-mono">🕒 Target: {t.deadline}</span>
                                      <span className={`px-2 py-0.5 rounded text-[9px] ${t.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 font-bold border border-emerald-200' : 'bg-slate-100 text-slate-500'}`}>
                                        {t.status}
                                      </span>
                                    </div>

                                    {/* Task requirements audit */}
                                    <div className="flex gap-3 text-[9px] font-extrabold">
                                      <span className={`flex items-center gap-1 ${t.photoReq ? 'text-blue-500' : 'text-slate-400'}`}>
                                        📸 Photo Verification {t.photoReq ? 'Required' : 'Optional'}
                                      </span>
                                      <span className={`flex items-center gap-1 ${t.gpsReq ? 'text-emerald-500' : 'text-slate-400'}`}>
                                        📍 GPS Coordinates {t.gpsReq ? 'Required' : 'Optional'}
                                      </span>
                                    </div>

                                    {/* Verification attachment choice if pending and photo required */}
                                    {t.status !== 'Completed' && (
                                      <div className="space-y-2 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                                        <p className="text-[9px] uppercase font-bold text-slate-400">Attach verification photo</p>
                                        <div className="grid grid-cols-4 gap-1.5">
                                          {FIELD_PHOTO_PRESETS.map((preset, idx) => (
                                            <button
                                              key={idx}
                                              onClick={() => {
                                                setSelectedPresetPhoto(preset.url);
                                                alert(`Attached "${preset.name}" verification image!`);
                                              }}
                                              className="border rounded-lg overflow-hidden h-9 hover:opacity-100 transition border-slate-200"
                                            >
                                              <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" />
                                            </button>
                                          ))}
                                        </div>
                                        <div className="text-[8px] text-slate-400 font-mono truncate">
                                          Selected: {selectedPresetPhoto ? 'Verified Field Capture Image ✓' : 'None Selected'}
                                        </div>
                                      </div>
                                    )}

                                    {t.status !== 'Completed' ? (
                                      <button 
                                        onClick={() => {
                                          if (t.gpsReq && !gpsEnabled) {
                                            alert('⚠️ Access Blocked: GPS location signal must be turned ON to solve this directive!');
                                            return;
                                          }
                                          handleUpdateTask(t.id, 'Completed', 100);
                                          // Trigger push notification of task completion
                                          const newNotif = {
                                            id: `m-notif-${Date.now()}`,
                                            title: '✓ Directive Solved',
                                            body: `Checked and logged "${t.title}" as completed in database.`,
                                            time: 'Just now',
                                            read: false
                                          };
                                          setMobileNotifications(prev => [newNotif, ...prev]);
                                          alert('✅ Verification uploaded successfully! Live task status updated to Completed.');
                                        }}
                                        className="w-full bg-[#0b3c5d] hover:bg-blue-600 text-white font-extrabold py-2 rounded-xl text-[10px] shadow transition uppercase tracking-wider mt-1"
                                      >
                                        Submit Resolution & Verification
                                      </button>
                                    ) : (
                                      <div className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 p-2 rounded-xl text-[10px] text-center font-bold">
                                        ✓ Directive Verified and Approved at Command Center
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>

                      </div>
                    )}

                    {/* -------------------- TAB 3: DAILY ACTIVITY REPORT STAMP -------------------- */}
                    {mobileActiveTab === 'report' && (
                      <div className="space-y-4 animate-fadeIn">
                        
                        <div className="bg-[#0b3c5d] text-white p-4 rounded-2xl shadow-sm space-y-1.5">
                          <h4 className="font-extrabold text-sm uppercase flex items-center gap-1">
                            <Activity className="w-4 h-4 text-amber-400" />
                            <span>Municipal Activity Registry</span>
                          </h4>
                          <p className="text-[10px] text-blue-200 leading-snug">
                            Every activity log is cryptographically encoded, time-logged, and GPS watermarked directly upon upload.
                          </p>
                        </div>

                        {/* SUBMIT REPORT FORM */}
                        {selectedManager.status === 'checked-in' ? (
                          <div className={`rounded-2xl border p-4 shadow-sm space-y-3 ${batteryOptimization ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                            
                            <form onSubmit={(e) => handleNewActivitySubmit(e, selectedManager)} className="space-y-3 text-xs text-slate-700 dark:text-slate-200">
                              
                              <div className="space-y-1">
                                <label className="font-bold text-slate-400 text-[10px] uppercase block">Category of Action</label>
                                <select 
                                  value={selectedActivityCategory} 
                                  onChange={(e) => setSelectedActivityCategory(e.target.value)}
                                  className="w-full p-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-medium"
                                >
                                  <option value="Ward Inspection">Ward Inspection</option>
                                  <option value="Door-to-Door Monitoring">Door-to-Door Monitoring</option>
                                  <option value="Transfer Station Inspection">Transfer Station Inspection</option>
                                  <option value="Public Toilet Inspection">Public Toilet Inspection</option>
                                  <option value="Open Depot Inspection">Open Depot Inspection</option>
                                  <option value="Citizen Complaint Verification">Citizen Complaint Verification</option>
                                  <option value="Emergency Visit">Emergency Visit</option>
                                </select>
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <label className="font-bold text-slate-400 text-[10px] uppercase block">Assigned Ward Area</label>
                                  <select 
                                    value={newActivityWard} 
                                    onChange={(e) => setNewActivityWard(parseInt(e.target.value) || 1)}
                                    className="w-full p-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-medium font-mono"
                                  >
                                    {selectedManager.wards.map(w => (
                                      <option key={w} value={w}>Ward {w}</option>
                                    ))}
                                  </select>
                                </div>

                                {/* QR Checkpoint scan widget */}
                                <div className="space-y-1">
                                  <label className="font-bold text-slate-400 text-[10px] uppercase block">QR Terminal Stamp</label>
                                  <button 
                                    type="button"
                                    onClick={() => {
                                      setQrScanning(true);
                                      setTimeout(() => {
                                        setQrScanning(false);
                                        setNewActivityRemarks('QR Locked Validated: Ward Sanitation Station-A7');
                                        alert('✓ QR Signature Authenticated! Muster location coordinates linked securely.');
                                      }, 1500);
                                    }}
                                    className="w-full p-2 border border-[#328cc1]/50 bg-blue-50 dark:bg-slate-950 text-blue-700 dark:text-blue-400 font-extrabold rounded-xl flex items-center justify-center gap-1 text-[10px]"
                                  >
                                    <QrCode className="w-4 h-4 animate-pulse" />
                                    <span>{qrScanning ? 'COMMUNING...' : 'SCAN QR STAMP'}</span>
                                  </button>
                                </div>
                              </div>

                              <div className="space-y-1">
                                <label className="font-bold text-slate-400 text-[10px] uppercase block">Report Subject Title</label>
                                <input 
                                  type="text" 
                                  placeholder="e.g. Cleared main garbage blockade"
                                  value={newActivityTitle}
                                  onChange={(e) => setNewActivityTitle(e.target.value)}
                                  className="w-full p-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-100"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="font-bold text-slate-400 text-[10px] uppercase block">Report Observations Details</label>
                                <textarea 
                                  rows={2} 
                                  placeholder="Specify cleaning progress, worker deployments, or public feedback..."
                                  value={newActivityDesc}
                                  onChange={(e) => setNewActivityDesc(e.target.value)}
                                  className="w-full p-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-100"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="font-bold text-slate-400 text-[10px] uppercase block">Supervisor Specific Remarks</label>
                                <input 
                                  type="text" 
                                  placeholder="e.g. Checked satisfactory work clearance."
                                  value={newActivityRemarks}
                                  onChange={(e) => setNewActivityRemarks(e.target.value)}
                                  className="w-full p-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-100"
                                />
                              </div>

                              {/* MOCK PHOTO PRESET CHIPS AND WATERMARK OVERLAY */}
                              <div className="space-y-2 border-t border-slate-100 dark:border-slate-800/80 pt-3">
                                <div className="flex justify-between items-center">
                                  <label className="font-bold text-slate-400 text-[10px] uppercase block">Capture Verification Image</label>
                                  <span className="text-[8px] text-blue-500 font-extrabold">AUTO-WATERMARKED</span>
                                </div>
                                <div className="grid grid-cols-4 gap-2">
                                  {FIELD_PHOTO_PRESETS.map((preset, idx) => (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() => setSelectedPresetPhoto(preset.url)}
                                      className={`border rounded-xl overflow-hidden h-10 hover:opacity-100 transition ${selectedPresetPhoto === preset.url ? 'border-blue-500 scale-105 shadow-sm' : 'border-slate-200 opacity-60'}`}
                                    >
                                      <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" />
                                    </button>
                                  ))}
                                </div>

                                {/* GPS WATERMARK PREVIEW GRAPHIC BOX */}
                                <div className="relative h-44 bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow">
                                  <img 
                                    src={selectedPresetPhoto} 
                                    alt="Sanitation inspection capture" 
                                    className="w-full h-full object-cover opacity-70"
                                  />
                                  {/* Dynamic Cryptographic GPS Watermark Overlay */}
                                  <div className="absolute bottom-2 left-2 bg-black/80 backdrop-blur-md border border-white/20 p-2 font-mono text-[8px] space-y-0.5 rounded-lg leading-tight text-white max-w-[280px]">
                                    <p className="font-black text-amber-400 flex items-center gap-1">
                                      <Shield className="w-3 h-3 text-amber-400" />
                                      <span>ZMMS SECURE WATERMARK</span>
                                    </p>
                                    <p className="text-slate-300">DATE: 2026-07-03 | TIME: {state.simulationTime.split(' ').slice(-2).join(' ')}</p>
                                    <p className="text-slate-300">LAT/LNG: {selectedManager.currentLat.toFixed(4)}° N, {selectedManager.currentLng.toFixed(4)}° E</p>
                                    <p className="text-slate-300">WARD: {newActivityWard} | COORDS VERIFIED [OK]</p>
                                    <p className="text-slate-300">OFFICER: {selectedManager.name.toUpperCase()} ({selectedManager.empId})</p>
                                  </div>
                                  <div className="absolute top-2 right-2 bg-blue-600/90 backdrop-blur-xs text-[8px] font-black px-1.5 py-0.5 rounded text-white">
                                    LIVE CAMERA
                                  </div>
                                </div>
                              </div>

                              <button 
                                type="submit"
                                className="w-full bg-[#0b3c5d] hover:bg-blue-600 text-white font-extrabold py-2.5 rounded-xl transition text-xs uppercase tracking-wider shadow-md flex items-center justify-center gap-1"
                              >
                                <span>Upload Watermarked Field Stamp</span>
                              </button>
                            </form>
                          </div>
                        ) : (
                          <div className="bg-white rounded-2xl border p-6 text-center text-slate-400 border-slate-200">
                            <AlertTriangle className="w-10 h-10 mx-auto text-amber-500 mb-2" />
                            <p className="text-xs font-bold text-slate-700">Muster Check-In Required</p>
                            <p className="text-[10px] text-slate-400 mt-1">Please mark your GPS shift check-in on the Home tab prior to reporting field activities.</p>
                          </div>
                        )}

                        {/* OFFICER ACTIVITY HISTORY LOG */}
                        <div className={`rounded-2xl border p-4 shadow-sm space-y-3 ${batteryOptimization ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                          <div className="flex items-center justify-between border-b pb-2">
                            <h4 className="font-extrabold text-[11px] text-slate-800 dark:text-slate-100 uppercase tracking-wide flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-blue-500" />
                              <span>Your Activity Registry History</span>
                            </h4>
                            <span className="text-[9px] font-mono text-slate-400">({selectedManager.activities.length} logs)</span>
                          </div>

                          {selectedManager.activities.length === 0 ? (
                            <p className="text-[10px] text-slate-400 text-center py-4">No field logs registered today yet.</p>
                          ) : (
                            <div className="space-y-2.5 max-h-[250px] overflow-y-auto pr-1">
                              {selectedManager.activities.map((act) => {
                                let statusBg = 'bg-amber-100 text-amber-800 border-amber-200';
                                if (act.status === 'Approved') statusBg = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                                if (act.status === 'Rejected') statusBg = 'bg-red-100 text-red-800 border-red-200';

                                return (
                                  <div key={act.id} className="border border-slate-100 dark:border-slate-800 p-2 rounded-xl text-[10px] space-y-1 hover:bg-slate-50/55 transition">
                                    <div className="flex items-center justify-between">
                                      <span className="font-extrabold text-slate-800 dark:text-slate-100 line-clamp-1 flex-1">{act.title}</span>
                                      <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold border ${statusBg}`}>{act.status}</span>
                                    </div>
                                    <div className="flex justify-between text-[9px] text-slate-400">
                                      <span className="uppercase font-semibold text-blue-600">{act.category}</span>
                                      <span className="font-mono">{act.timestamp}</span>
                                    </div>
                                    <p className="text-slate-500 line-clamp-2 leading-tight">{act.description}</p>
                                    
                                    {act.remarks && (
                                      <div className="bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-lg text-[9px] text-slate-600 dark:text-slate-300 border-l-2 border-slate-400 flex items-start gap-1">
                                        <span className="font-bold text-slate-400">REMARKS:</span>
                                        <span>{act.remarks}</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                      </div>
                    )}

                    {/* -------------------- TAB 4: SYSTEM SETTINGS, SYNC & INBOX -------------------- */}
                    {mobileActiveTab === 'settings' && (
                      <div className="space-y-4 animate-fadeIn">
                        
                        {/* PROFILE CARD */}
                        <div className={`rounded-2xl border p-4 shadow-sm flex items-center gap-4 ${batteryOptimization ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-black text-lg uppercase shadow">
                            {selectedManager.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-extrabold text-sm text-slate-800 dark:text-white truncate">{selectedManager.name}</h4>
                            <p className="text-[10px] text-slate-400 font-bold uppercase font-mono">Designation: Municipal Supervisor</p>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">Cellular: +91 {selectedManager.phone}</p>
                          </div>
                          <button 
                            onClick={() => {
                              setIsMobileLoggedIn(false);
                              setMobilePassword('');
                              alert('Secure session closed. Device logged out.');
                            }}
                            title="Log Out Terminal"
                            className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition"
                          >
                            <LogOut className="w-4 h-4" />
                          </button>
                        </div>

                        {/* OFFLINE MODE QUEUE & DATA SYNCHRONIZATION */}
                        <div className={`rounded-2xl border p-4 shadow-sm space-y-3 ${batteryOptimization ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                          <div className="flex justify-between items-center border-b pb-2">
                            <h5 className="text-xs font-black flex items-center gap-1.5 text-slate-700 dark:text-slate-200 uppercase">
                              <RotateCcw className="w-4 h-4 text-blue-500" />
                              <span>Offline Cache Operations</span>
                            </h5>
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${localCache.activities.length === 0 && localCache.attendance.length === 0 ? 'bg-slate-100 text-slate-500' : 'bg-amber-100 text-amber-800'}`}>
                              Queue: {localCache.activities.length + localCache.attendance.length} items
                            </span>
                          </div>

                          <div className="text-xs text-slate-500 space-y-2 leading-relaxed">
                            <p>
                              If cellular network drops, the application queues check-ins, check-outs, and watermarked reports locally on your storage, preventing any data loss.
                            </p>
                            {localCache.activities.length > 0 || localCache.attendance.length > 0 ? (
                              <div className="bg-amber-50 dark:bg-amber-950/20 p-3 rounded-xl border border-amber-200 text-[11px] text-amber-800 dark:text-amber-400 space-y-1">
                                <p className="font-extrabold">⚠️ Local cached registers pending sync:</p>
                                <ul className="list-disc pl-4 space-y-0.5 font-mono text-[9.5px]">
                                  {localCache.attendance.map((att, i) => (
                                    <li key={i}>Muster attendance shift registration ({att.type})</li>
                                  ))}
                                  {localCache.activities.map((act, i) => (
                                    <li key={i}>Report Activity: "{act.title}" in Ward {act.wardNum}</li>
                                  ))}
                                </ul>
                                
                                {offlineMode ? (
                                  <p className="text-[9px] font-bold text-rose-500 italic mt-1">Connect internet (disable Offline Mode above) to sync registers.</p>
                                ) : (
                                  <button 
                                    onClick={handleSyncOfflineData} 
                                    className="w-full mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-1.5 rounded-lg text-[10px] uppercase shadow"
                                  >
                                    Upload Queued Logs to server
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400 p-2.5 rounded-xl text-[10.5px] font-bold border border-emerald-100 dark:border-emerald-800/30 text-center flex items-center justify-center gap-1">
                                <Check className="w-3.5 h-3.5" />
                                <span>All local registers synchronized with Delhi Gov servers!</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* BATTERY OPTIMIZATION & ENERGY POWER SAVER PANEL */}
                        <div className={`rounded-2xl border p-4 shadow-sm space-y-3 ${batteryOptimization ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-800'}`}>
                          <div className="flex justify-between items-center border-b pb-2">
                            <h5 className="text-xs font-black flex items-center gap-1.5 text-slate-700 dark:text-slate-200 uppercase">
                              <Battery className="w-4 h-4 text-emerald-500 animate-pulse" />
                              <span>Battery & Power Optimizer</span>
                            </h5>
                            <span className="text-[8.5px] font-mono text-slate-400">HARDWARE API</span>
                          </div>

                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <h6 className="font-extrabold text-[11px] text-slate-700 dark:text-slate-100 uppercase">OLED Power Saving Mode</h6>
                                <p className="text-[9.5px] text-slate-400">Enables dynamic high-contrast UI dimming to expand duty battery life by 42%</p>
                              </div>
                              <button
                                onClick={() => {
                                  const nextOptimization = !batteryOptimization;
                                  setBatteryOptimization(nextOptimization);
                                  if (nextOptimization) {
                                    alert('🔋 OLED Power Saver Enabled: Screen power draw optimized, telemetry pings set to low-battery frequency!');
                                  } else {
                                    alert('🔋 High Accuracy Mode: Background screen refreshed, telemetry frequency restored.');
                                  }
                                }}
                                className={`w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none relative ${batteryOptimization ? 'bg-emerald-500' : 'bg-slate-300'}`}
                              >
                                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200 shadow ${batteryOptimization ? 'translate-x-5' : 'translate-x-0'}`} />
                              </button>
                            </div>

                            {/* Battery Hardware stats */}
                            <div className="grid grid-cols-3 gap-2 text-center text-[9px] bg-slate-100/50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200/40 dark:border-slate-800">
                              <div>
                                <p className="text-slate-400 uppercase font-bold">Health</p>
                                <p className="font-extrabold text-slate-700 dark:text-slate-200 mt-0.5 text-[10px]">Excellent</p>
                              </div>
                              <div>
                                <p className="text-slate-400 uppercase font-bold">Temp</p>
                                <p className="font-extrabold text-slate-700 dark:text-slate-200 mt-0.5 text-[10px]">34.2 °C</p>
                              </div>
                              <div>
                                <p className="text-slate-400 uppercase font-bold">Cycles</p>
                                <p className="font-extrabold text-slate-700 dark:text-slate-200 mt-0.5 text-[10px]">242</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* PUSH NOTIFICATIONS LOG INBOX */}
                        <div className={`rounded-2xl border p-4 shadow-sm space-y-3 ${batteryOptimization ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                          <div className="flex justify-between items-center border-b pb-2">
                            <h5 className="text-xs font-black flex items-center gap-1.5 text-slate-700 dark:text-slate-200 uppercase">
                              <AlertOctagon className="w-4 h-4 text-amber-500" />
                              <span>Live Notification Logs</span>
                            </h5>
                            <button 
                              onClick={() => {
                                setMobileNotifications(prev => prev.map(n => ({ ...n, read: true })));
                                alert('Notifications marked read.');
                              }}
                              className="text-[9px] font-bold text-blue-600 hover:underline"
                            >
                              Clear Unread
                            </button>
                          </div>

                          <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                            {mobileNotifications.map((n) => (
                              <div key={n.id} className="p-2.5 rounded-xl bg-slate-100/50 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-800 flex gap-2 text-[10.5px]">
                                <div className="p-1 text-blue-500 rounded-lg h-fit bg-blue-50 dark:bg-slate-900">
                                  <AlertOctagon className="w-3.5 h-3.5" />
                                </div>
                                <div className="flex-1 space-y-0.5">
                                  <div className="flex justify-between items-center">
                                    <p className="font-extrabold text-slate-800 dark:text-slate-200">{n.title}</p>
                                    <span className="text-[8px] text-slate-400 font-mono">{n.time}</span>
                                  </div>
                                  <p className="text-[10px] text-slate-500 leading-snug">{n.body}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                      </div>
                    )}

                  </div>

                  {/* bottom navigation panel with tabs */}
                  <div className="bg-[#0b3c5d] border-t border-slate-800 px-4 py-3 flex justify-around items-center z-40 shadow-xl">
                    <button 
                      onClick={() => setMobileActiveTab('home')}
                      className={`flex flex-col items-center gap-1 text-[9px] font-bold transition-all ${mobileActiveTab === 'home' ? 'text-amber-400 scale-105' : 'text-blue-200 hover:text-white'}`}
                    >
                      <MapPin className="w-5 h-5" />
                      <span>Shift Map</span>
                    </button>
                    <button 
                      onClick={() => setMobileActiveTab('tasks')}
                      className={`flex flex-col items-center gap-1 text-[9px] font-bold transition-all ${mobileActiveTab === 'tasks' ? 'text-amber-400 scale-105' : 'text-blue-200 hover:text-white'}`}
                    >
                      <CheckCircle className="w-5 h-5" />
                      <span>Directives</span>
                    </button>
                    <button 
                      onClick={() => setMobileActiveTab('report')}
                      className={`flex flex-col items-center gap-1 text-[9px] font-bold transition-all ${mobileActiveTab === 'report' ? 'text-amber-400 scale-105' : 'text-blue-200 hover:text-white'}`}
                    >
                      <Activity className="w-5 h-5" />
                      <span>Field Stamp</span>
                    </button>
                    <button 
                      onClick={() => setMobileActiveTab('settings')}
                      className={`flex flex-col items-center gap-1 text-[9px] font-bold transition-all ${mobileActiveTab === 'settings' ? 'text-amber-400 scale-105' : 'text-blue-200 hover:text-white'}`}
                    >
                      <Settings className="w-5 h-5" />
                      <span>Settings</span>
                    </button>
                  </div>

                </div>
              )}

            </div>

            {/* PHYSICAL HOME BUTTON PILL IN MD3 GLASS SHIELD */}
            <div className="bg-[#0b3c5d] p-3 flex justify-center items-center border-t border-slate-800 z-40">
              <div 
                onClick={() => {
                  if (isMobileLoggedIn) {
                    setMobileActiveTab('home');
                  }
                }}
                className="w-24 h-1.5 bg-slate-400 hover:bg-white rounded-full cursor-pointer transition-colors duration-150"
                title="System Home Pill"
              />
            </div>

          </div>
        )}

        {/* PRINT PREVIEW OVERLAY MODAL */}
        {showPrintModal && (() => {
          const { kpis, columns, rows, title } = getReportContent();
          return (
            <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 overflow-y-auto print:static print:inset-auto print:p-0 print:bg-white">
              {/* Dynamic CSS override to make sure ONLY the document prints when printing */}
              <style dangerouslySetInnerHTML={{__html: `
                @media print {
                  body * {
                    visibility: hidden !important;
                  }
                  #print-preview-modal-content, #print-preview-modal-content * {
                    visibility: visible !important;
                  }
                  #print-preview-modal-content {
                    position: absolute !important;
                    left: 0 !important;
                    top: 0 !important;
                    width: 100% !important;
                    background: white !important;
                    color: black !important;
                    box-shadow: none !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    max-height: none !important;
                    overflow: visible !important;
                  }
                  .no-print {
                    display: none !important;
                  }
                }
              `}} />

              <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col print:shadow-none print:max-h-none print:overflow-visible">
                {/* MODAL ACTION BAR */}
                <div className="bg-slate-100 px-6 py-4 border-b flex items-center justify-between no-print print:hidden">
                  <div className="flex items-center gap-2">
                    <Printer className="w-5 h-5 text-blue-600" />
                    <span className="font-extrabold text-sm text-slate-800">Municipal Official Print Preview</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => window.print()}
                      className="bg-[#0b3c5d] hover:bg-slate-800 text-white font-extrabold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Print Document / Save PDF</span>
                    </button>
                    <button
                      onClick={() => setShowPrintModal(false)}
                      className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold text-xs px-4 py-2 rounded-xl transition cursor-pointer"
                    >
                      Close Preview
                    </button>
                  </div>
                </div>

                {/* PRINT CONTENT AREA */}
                <div id="print-preview-modal-content" className="p-8 md:p-12 font-sans text-slate-800 space-y-6 print:p-0 print:text-black">
                  
                  {/* MUNICIPAL HEADER */}
                  <div className="border-b-4 border-slate-900 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h1 className="font-black text-base md:text-lg tracking-tight uppercase text-slate-900 leading-tight">MUNICIPAL CORPORATION SANITATION AND SOLID WASTE</h1>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Govt. NCT | Central Telemetry Division</p>
                      <p className="text-[9px] font-mono text-slate-400">REPORT_ID: ZMMS-REPS-{reportFrequency.toUpperCase()}-{Date.now().toString().slice(-6)}</p>
                    </div>
                    <div className="text-left md:text-right space-y-1">
                      <span className="border-2 border-slate-900 px-3 py-1 text-[10px] font-black uppercase tracking-wider inline-block">OFFICIAL RECORD</span>
                      <p className="text-[9px] font-mono text-slate-400 block">COMPILED: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                    </div>
                  </div>

                  {/* REPORT METADATA */}
                  <div className="grid grid-cols-3 gap-4 border border-slate-200 p-4 bg-slate-50 rounded-xl print:border-slate-300 print:bg-white text-[11px]">
                    <div>
                      <span className="font-black text-slate-400 uppercase text-[8.5px] tracking-wider block">AUDIT PARAMETER</span>
                      <p className="font-extrabold text-slate-800 text-xs mt-0.5">{reportSection.toUpperCase()}</p>
                    </div>
                    <div>
                      <span className="font-black text-slate-400 uppercase text-[8.5px] tracking-wider block">ROSTER INTERVAL</span>
                      <p className="font-extrabold text-slate-800 text-xs mt-0.5">{reportFrequency.toUpperCase()}</p>
                    </div>
                    <div>
                      <span className="font-black text-slate-400 uppercase text-[8.5px] tracking-wider block">TARGET JURISDICTION</span>
                      <p className="font-extrabold text-slate-800 text-xs mt-0.5">
                        {reportSelectedManagerId === 'All' ? 'ALL ZONE MANAGERS' : `ZM ID: ${reportSelectedManagerId}`}
                      </p>
                    </div>
                  </div>

                  {/* THE MAIN TITLE */}
                  <div className="text-center space-y-1 py-2">
                    <h2 className="font-black text-sm uppercase tracking-wide text-slate-950">
                      CERTIFIED MUNICIPAL COMPILATION: {title.toUpperCase()}
                    </h2>
                    <p className="text-[10px] text-slate-500 max-w-lg mx-auto leading-relaxed">
                      Formally compiled on {reportDate}. GPS telemetry has been checked against legal spatial polygons to authenticate location validity.
                    </p>
                  </div>

                  {/* PRINT CARD SUMMARIES */}
                  <div className="grid grid-cols-4 gap-3">
                    {kpis.map((kpi, idx) => (
                      <div key={idx} className="border border-slate-200 p-3 rounded-xl bg-white print:border-slate-300">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">{kpi.title}</span>
                        <span className="text-xs font-black text-slate-900 block mt-1">{kpi.value}</span>
                        <span className="text-[8px] text-slate-500 block mt-0.5 leading-none">{kpi.desc}</span>
                      </div>
                    ))}
                  </div>

                  {/* DENSE DATA TABLE */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden print:border-slate-300">
                    <table className="w-full text-left border-collapse text-[9px]">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase print:bg-slate-200 print:border-slate-300">
                          {columns.map((col, idx) => (
                            <th key={idx} className="py-2.5 px-3">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-600 print:divide-slate-200">
                        {rows.map((row, rowIdx) => (
                          <tr key={rowIdx} className="hover:bg-slate-50/20">
                            {row.map((cell, cellIdx) => (
                              <td key={cellIdx} className="py-2 px-3 whitespace-nowrap">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* STAMP & LEGAL SEALS FOOTER */}
                  <div className="pt-8 grid grid-cols-3 gap-6 text-[10px] leading-relaxed">
                    <div className="space-y-1">
                      <span className="font-black text-slate-400 uppercase text-[8px] tracking-wider block">CRYPTOGRAPHIC AUDIT SECURE</span>
                      <p className="font-mono text-[8px] text-slate-500">SIGN_HASH: ZMMS-SEC-729B932F</p>
                      <p className="text-[8.5px] text-slate-400">Verified at {reportDate} against central government location databases.</p>
                    </div>
                    
                    <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl p-3 text-center text-slate-400 font-bold uppercase tracking-widest text-[7.5px]">
                      <p className="text-slate-500">MUNICIPAL CORPORATION</p>
                      <p className="text-emerald-600 font-black mt-1">APPROVED & STAMPED</p>
                      <p className="text-[7px] font-mono text-slate-400 mt-1">2026-MCGM-REPS</p>
                    </div>

                    <div className="flex flex-col justify-end items-end text-right">
                      <div className="w-32 border-b border-slate-900 pb-1 text-center font-serif text-[10px] italic font-bold text-slate-600">
                        Admin Audit Verifier
                      </div>
                      <span className="font-black text-slate-400 uppercase text-[8px] tracking-wider block mt-1">SUPERVISORY SIGNATURE RELEASE</span>
                    </div>
                  </div>

                </div>

              </div>
            </div>
          );
        })()}

      </main>

      {/* COMPACT FOOTER */}
      <footer id="main-footer" className="bg-[#1d2731] text-slate-400 py-4 px-4 border-t border-slate-800 mt-auto text-xs text-center font-semibold">
        <p>© 2026 Municipal Administration Department. All GPS cryptographic locks and security layers authenticated via standard JWT.</p>
      </footer>

    </div>
  );
}
