import React, { useEffect, useState, useRef } from 'react';
import L from 'leaflet';
import { 
  Sparkles, 
  Battery, 
  Activity, 
  MapPin, 
  Clock, 
  RefreshCw, 
  Compass,
  Navigation
} from 'lucide-react';

interface PathPoint {
  lat: number;
  lng: number;
  timestamp: string;
  speed: number;
  battery: number;
  network: string;
}

interface VisitedPlace {
  name: string;
  arrival: string;
  departure: string;
  durationMin: number;
  distancePrev: number;
}

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
  pathHistory: PathPoint[];
  visitedPlaces: VisitedPlace[];
  sos: boolean;
}

interface MapComponentProps {
  managers: ZoneManager[];
  selectedMapManagerId: string;
  setSelectedMapManagerId: (id: string) => void;
  mapOverlay: 'wards' | 'heatmap' | 'none';
  handleGenerateAISummary: (managerId: string) => void;
  onRefreshTriggered: () => void;
}

export default function MapComponent({
  managers,
  selectedMapManagerId,
  setSelectedMapManagerId,
  mapOverlay,
  handleGenerateAISummary,
  onRefreshTriggered
}: MapComponentProps) {
  const [countdown, setCountdown] = useState(120); // 2 minutes auto-refresh countdown
  const [isRefreshing, setIsRefreshing] = useState(false);
  const selectedManager = managers.find(m => m.id === selectedMapManagerId);
  
  const formatDuration = (mins: number) => {
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const remainingMins = Math.floor(mins % 60);
    return `${hrs}h ${remainingMins}m`;
  };

  const movingTimeMin = selectedManager 
    ? Math.max(0, Math.floor((selectedManager.workingHours || 0) * 60) - (selectedManager.idleTimeMin || 0))
    : 0;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const pathGroupRef = useRef<L.LayerGroup | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Delhi central default coordinate center
    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView([28.6139, 77.2090], 11);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    markersGroupRef.current = L.layerGroup().addTo(map);
    pathGroupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    // Fit bounds initially if there are checked-in managers
    const checkedIn = managers.filter(m => m.status === 'checked-in');
    if (checkedIn.length > 0) {
      const coords = checkedIn.map(m => [m.currentLat, m.currentLng] as L.LatLngTuple);
      map.fitBounds(L.latLngBounds(coords), { padding: [40, 40], maxZoom: 13 });
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update map markers & polylines on data change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !markersGroupRef.current || !pathGroupRef.current) return;

    // Clear previous elements
    markersGroupRef.current.clearLayers();
    pathGroupRef.current.clearLayers();

    // 1. Draw Polyline Route History and checkpoint nodes for selected manager
    if (selectedManager && selectedManager.status === 'checked-in') {
      const history = selectedManager.pathHistory || [];
      if (history.length >= 2) {
        const latlngs = history.map(p => [p.lat, p.lng] as L.LatLngTuple);
        
        // Primary route path line
        L.polyline(latlngs, {
          color: '#2563eb',
          weight: 4,
          opacity: 0.85,
          lineJoin: 'round'
        }).addTo(pathGroupRef.current);

        // Historical stops/checkpoints as small circles
        history.forEach((pt, idx) => {
          const checkpoint = L.circleMarker([pt.lat, pt.lng], {
            radius: 5,
            fillColor: '#3b82f6',
            color: '#ffffff',
            weight: 1.5,
            fillOpacity: 1.0
          });

          checkpoint.bindTooltip(
            `Checkpoint ${idx + 1}<br/>⏱️ ${pt.timestamp}<br/>⚡ Speed: ${pt.speed} km/h<br/>🔋 Battery: ${pt.battery}%`,
            {
              direction: 'top',
              className: 'bg-slate-900 text-white font-mono text-[9px] p-1.5 rounded border border-slate-700 shadow-xl'
            }
          );
          
          checkpoint.addTo(pathGroupRef.current);
        });
      }
    }

    // 2. Draw Live Markers for all active on-shift managers
    managers.forEach(m => {
      if (m.status !== 'checked-in') return;

      const isSelected = m.id === selectedMapManagerId;
      const hasSOS = m.sos;
      const badgeColorClass = hasSOS ? 'bg-red-600 animate-bounce' : m.speed > 0 ? 'bg-emerald-600' : 'bg-amber-500';
      const pulseColorClass = hasSOS ? 'bg-red-500 animate-ping' : m.speed > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500 animate-pulse';

      // Elegant HTML layout styled purely using Tailwind
      const markerHtml = `
        <div class="relative flex items-center justify-center cursor-pointer">
          <!-- Outer Pulsing Ring -->
          <div class="absolute -inset-2.5 rounded-full opacity-40 ${pulseColorClass}"></div>
          
          <!-- Inner Pin bubble -->
          <div class="w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white text-xs font-black select-none ${isSelected ? 'scale-110 ring-2 ring-blue-600 ring-offset-1' : ''} ${badgeColorClass}">
            ${m.name.charAt(0)}
          </div>

          <!-- Speed Indicator overlay flag -->
          ${m.speed > 0 ? `
            <div class="absolute -top-3 -right-3 bg-emerald-700 text-white text-[7px] font-mono font-black px-1 py-0.5 rounded border border-white shadow-sm whitespace-nowrap">
              ${m.speed} KM/H
            </div>
          ` : ''}
        </div>
      `;

      const customIcon = L.divIcon({
        html: markerHtml,
        className: 'custom-leaflet-marker-node',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const marker = L.marker([m.currentLat, m.currentLng], { icon: customIcon });
      
      // Select manager when clicking map pin
      marker.on('click', () => {
        setSelectedMapManagerId(m.id);
      });

      // Bind rich descriptive hover tooltip
      marker.bindTooltip(
        `<div class="font-sans p-1">
          <p class="font-extrabold text-blue-600 m-0">${m.name}</p>
          <p class="text-[9px] text-slate-500 m-0">📍 ${m.zone} • Emp ID: ${m.empId}</p>
          <p class="text-[9px] text-slate-700 m-0 font-mono">Speed: ${m.speed} km/h • Battery: ${m.battery}%</p>
         </div>`,
        {
          direction: 'top',
          className: 'bg-white rounded-lg shadow-lg border border-slate-200'
        }
      );

      marker.addTo(markersGroupRef.current);
    });

    // 3. Auto center/pan map to the selected manager
    if (selectedManager && selectedManager.status === 'checked-in') {
      map.setView([selectedManager.currentLat, selectedManager.currentLng], map.getZoom() || 13);
    }
  }, [managers, selectedMapManagerId, selectedManager]);

  // Auto-refresh countdown effect (2 minutes)
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          handleManualRefresh();
          return 120;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await onRefreshTriggered();
    setTimeout(() => {
      setIsRefreshing(false);
      setCountdown(120);
    }, 800);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col gap-4">
      
      {/* Map Control Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-3">
          <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
            <Compass className="w-5 h-5 animate-spin" style={{ animationDuration: '6s' }} />
          </div>
          <div>
            <h4 className="font-extrabold text-sm text-slate-800">Global Command GPS Tracking Monitor</h4>
            <p className="text-[11px] text-slate-400 flex items-center gap-1">
              <span>National Capital Territory (Delhi) Precision Grid Layer</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            </p>
          </div>
        </div>

        {/* 2-Minute Countdown Auto Refresh Timer Controls */}
        <div className="flex items-center gap-3 self-end sm:self-auto">
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 flex items-center gap-2 text-xs font-mono">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-500">Auto-refresh in:</span>
            <span className="font-bold text-blue-600">{formatTime(countdown)}</span>
          </div>

          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs px-3 py-1.5 rounded-lg border border-blue-200 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-500' : ''}`} />
            <span>Sync GPS</span>
          </button>
        </div>
      </div>

      {/* Main Map Box */}
      <div className="relative w-full h-[440px] bg-slate-100 rounded-xl overflow-hidden border border-slate-200 shadow-inner z-0">
        
        {/* Leaflet Map DOM Target */}
        <div ref={containerRef} className="w-full h-full" />

        {/* Map Legend Indicator */}
        <div className="absolute bottom-3 left-3 bg-slate-900/90 backdrop-blur-xs border border-slate-800 text-slate-300 rounded-lg p-2.5 text-[10px] space-y-1.5 shadow-lg z-10 font-sans pointer-events-none">
          <div className="font-bold border-b border-slate-800 pb-1 text-white uppercase tracking-wider text-[9px]">Status Indicator</div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50"></span>
            <span>Checked In / On Transit (Active)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50"></span>
            <span>Checked In / Stationary (Stopped)</span>
          </div>
          <div className="flex items-center gap-2 text-red-400 font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse shadow-sm shadow-red-600/50"></span>
            <span>SOS Beacon Active (Emergency)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
            <span>Historical Path Waypoint</span>
          </div>
        </div>

        {/* Selected Officer Telemetry Overlay Card */}
        {selectedManager && selectedManager.status === 'checked-in' && (
          <div className="absolute top-3 right-3 bg-slate-950/95 backdrop-blur-md border border-slate-800 text-white rounded-xl p-3.5 w-72 shadow-2xl z-10 space-y-3 font-sans leading-relaxed border-t-4 border-t-blue-500">
            <div className="flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-black text-blue-400 block">{selectedManager.name}</span>
                <span className="text-[9px] text-slate-400 font-mono uppercase">ID: {selectedManager.empId} • {selectedManager.zone}</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[8px] font-bold ${selectedManager.sos ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-800 text-slate-300'}`}>
                {selectedManager.sos ? 'EMERGENCY' : 'ONLINE'}
              </span>
            </div>

            <div className="border-t border-slate-900 pt-2.5 space-y-2 text-[10px]">
              <div className="flex items-center gap-1 text-emerald-400 font-medium bg-emerald-950/30 p-1.5 rounded border border-emerald-900/30">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{selectedManager.currentAddress}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-300 font-mono bg-slate-900/50 p-2 rounded">
                <div>
                  <span className="text-slate-500 block text-[8px] uppercase">Current Speed</span>
                  <span className="font-bold text-slate-100">{selectedManager.speed} km/h</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[8px] uppercase">Distance Today</span>
                  <span className="font-bold text-slate-100">{selectedManager.distanceTravelledKm} km</span>
                </div>
                <div className="mt-1">
                  <span className="text-slate-500 block text-[8px] uppercase">Moving Time</span>
                  <span className="font-bold text-emerald-400">{formatDuration(movingTimeMin)}</span>
                </div>
                <div className="mt-1">
                  <span className="text-slate-500 block text-[8px] uppercase">Idle Time</span>
                  <span className="font-bold text-amber-400">{formatDuration(selectedManager.idleTimeMin || 0)}</span>
                </div>
                <div className="mt-1">
                  <span className="text-slate-500 block text-[8px] uppercase">Telemetry Batt</span>
                  <span className="flex items-center gap-1 font-bold text-slate-100">
                    <Battery className="w-3 h-3 text-slate-400" />
                    <span>{selectedManager.battery}%</span>
                  </span>
                </div>
                <div className="mt-1">
                  <span className="text-slate-500 block text-[8px] uppercase">GPS Ping Latency</span>
                  <span className="font-bold text-slate-100">0.02s (Healthy)</span>
                </div>
              </div>
            </div>

            <div className="pt-1.5 flex gap-2">
              <button
                onClick={() => handleGenerateAISummary(selectedManager.id)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-extrabold py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                <span>AI supervisor telemetry log audit</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Selected Officer Visited Stop Checklist timeline */}
      {selectedManager && (
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <h5 className="font-extrabold text-xs text-slate-700 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-blue-600" />
              <span>Visited Checkpoint timeline Tracker: {selectedManager.name}</span>
            </h5>
            <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-bold">
              Total Stops Today: {selectedManager.totalStops}
            </span>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-1 mt-1 scrollbar-thin">
            {selectedManager.visitedPlaces.length === 0 ? (
              <div className="text-[11px] text-slate-400 py-3 text-center w-full">
                No stops logged today yet. Standard shift begins upon check-in and GPS activation.
              </div>
            ) : (
              selectedManager.visitedPlaces.map((place, idx) => (
                <div key={`stop-timeline-${idx}`} className="bg-white border border-slate-200 rounded-lg p-2.5 min-w-[150px] max-w-[180px] flex-shrink-0 flex flex-col justify-between shadow-xs hover:border-blue-200 transition-colors">
                  <div>
                    <span className="text-[8px] font-bold font-mono bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded uppercase">
                      Stop #{idx + 1}
                    </span>
                    <h6 className="text-[10px] font-black text-slate-800 truncate mt-1.5" title={place.name}>
                      {place.name}
                    </h6>
                    <p className="text-[9px] text-slate-400 font-mono mt-0.5">
                      ⏱️ {place.arrival} - {place.departure || 'Present'}
                    </p>
                  </div>
                  <div className="border-t border-slate-100 pt-1.5 mt-2 flex items-center justify-between text-[9px] text-slate-500 font-mono">
                    <span>Stay: {place.durationMin || 'Ongoing'}m</span>
                    <span className="text-blue-600 font-bold">+{place.distancePrev} km</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
