import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  BarChart3,
  Bot,
  ChevronLeft,
  Clock,
  HeartPulse,
  LayoutDashboard,
  Map as MapIcon,
  Maximize2,
  Menu,
  MessageSquare,
  Network,
  Play,
  Radio,
  RefreshCw,
  Settings,
  Shield,
  ShieldAlert,
  SlidersHorizontal,
  Terminal,
  Zap,
} from 'lucide-react';
import { useWebSocket } from '../hooks/useWebSocket';
import AirspaceMap from './Map';
import AlertPanel from './AlertPanel';
import EventTimeline from './EventTimeline';
import SensorActivity from './SensorActivity';
import ThreatPanel from './ThreatPanel';
import SystemHealth from './SystemHealth';
import LiveSensorFeed from './LiveSensorFeed';
import ExplainabilityPanel from './ExplainabilityPanel';

const frameClass = 'ops-panel';
const SCENARIOS = ['normal', 'suspicious', 'restricted_intrusion'];
const ZONE_PRESETS = {
  'Dodoma Center': { center: [-6.1748, 35.7384], radiusKM: 50, zoneName: 'Dodoma Core' },
  'Kigoma Frontier': { center: [-4.8769, 29.6262], radiusKM: 80, zoneName: 'Kigoma Frontier' },
  'Tanzania National Shield': { center: [-6.369, 34.8888], radiusKM: 600, zoneName: 'Tanzania National Shield' },
};

const cloneForHistory = value => JSON.parse(JSON.stringify(value ?? []));

const extractTargetId = query => {
  const match = query.match(/\b[A-Z]{2,}(?:-[A-Z0-9]+)+\b/);
  return match ? match[0] : null;
};

const haversineDistanceKM = (from, to) => {
  if (!from || !to) return null;
  const toRadians = degrees => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(to.lat - from.lat);
  const deltaLon = toRadians(to.lon - from.lon);
  const startLat = toRadians(from.lat);
  const endLat = toRadians(to.lat);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(deltaLon / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'live-airspace', label: 'Live Airspace', icon: MapIcon },
  { id: 'threat-intelligence', label: 'Threat Intelligence', icon: ShieldAlert },
  { id: 'sensor-activity', label: 'Sensor Activity', icon: Activity },
  { id: 'event-timeline', label: 'Event Timeline', icon: Clock },
  { id: 'llm-copilot', label: 'LLM Copilot', icon: Bot },
  { id: 'system-health', label: 'System Health', icon: HeartPulse },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'demo-controls', label: 'Demo Controls', icon: SlidersHorizontal },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const ROUTE_TITLES = NAV_ITEMS.reduce((acc, item) => ({ ...acc, [item.id]: item.label }), {});

const routeFromHash = () => {
  const route = window.location.hash.replace('#/', '') || 'overview';
  return NAV_ITEMS.some(item => item.id === route) ? route : 'overview';
};

const MiniMetric = ({ label, value, tone = 'cyan' }) => {
  const toneClass = {
    cyan: 'text-cyan-300',
    emerald: 'text-emerald-300',
    amber: 'text-amber-300',
    rose: 'text-rose-300',
    zinc: 'text-zinc-200',
  }[tone];

  return (
    <div className="ops-stat">
      <span>{label}</span>
      <strong className={toneClass}>{value}</strong>
    </div>
  );
};

const PageShell = ({ children, className = '' }) => (
  <section className={`ops-page-scroll ${className}`}>{children}</section>
);

const Panel = ({ title, subtitle, action, children, className = '' }) => (
  <section className={`ops-panel flex min-h-0 flex-col ${className}`}>
    {(title || subtitle || action) && (
      <div className="ops-panel-header">
        <div className="min-w-0">
          {title ? <h2 className="truncate text-[11px] font-black uppercase tracking-[0.16em] text-white">{title}</h2> : null}
          {subtitle ? <p className="mt-1 truncate text-[11px] text-zinc-500">{subtitle}</p> : null}
        </div>
        {action}
      </div>
    )}
    {children}
  </section>
);

const ResponsiveChart = ({ title, points = [], tone = '#22d3ee' }) => {
  const safePoints = points.length ? points : [12, 18, 15, 26, 24, 34, 31, 46, 40, 52, 48, 63];
  const max = Math.max(...safePoints, 1);
  const path = safePoints
    .map((value, index) => {
      const x = (index / Math.max(safePoints.length - 1, 1)) * 100;
      const y = 88 - (value / max) * 72;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <div className="ops-chart">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">{title}</span>
        <button className="ops-icon-btn" type="button" title="Expand chart" aria-label={`Expand ${title}`}>
          <Maximize2 size={13} />
        </button>
      </div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="mt-3 h-full min-h-0 w-full">
        <path d={path} fill="none" stroke={tone} strokeWidth="2.6" vectorEffect="non-scaling-stroke" />
        <path d={`${path} L 100 100 L 0 100 Z`} fill={tone} opacity="0.08" />
      </svg>
    </div>
  );
};

const TrackTable = ({ tracks, selectedTargetId, onSelectTarget }) => (
  <div className="ops-scroll h-full">
    <table className="ops-table w-full text-left text-[11px]">
      <thead className="sticky top-0 z-10 bg-[#111318] text-zinc-500">
        <tr>
          <th className="px-4 py-3 font-bold uppercase tracking-[0.12em]">Track</th>
          <th className="px-4 py-3 font-bold uppercase tracking-[0.12em]">Threat</th>
          <th className="px-4 py-3 font-bold uppercase tracking-[0.12em]">Class</th>
          <th className="px-4 py-3 font-bold uppercase tracking-[0.12em]">Altitude</th>
          <th className="px-4 py-3 font-bold uppercase tracking-[0.12em]">Speed</th>
          <th className="px-4 py-3 font-bold uppercase tracking-[0.12em]">Zone Dist.</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-zinc-800 text-zinc-300">
        {tracks.length === 0 ? (
          <tr>
            <td colSpan="6" className="px-4 py-8 text-center text-zinc-500">No tracks available.</td>
          </tr>
        ) : (
          tracks.map(track => (
            <tr
              key={track.target_id}
              onClick={() => onSelectTarget(track.target_id)}
              className={`cursor-pointer transition ${selectedTargetId === track.target_id ? 'bg-cyan-500/10 text-cyan-100' : track.threat_level === 'red' ? 'bg-rose-500/5' : 'bg-[#0b0d10]'}`}
            >
              <td className="px-4 py-3 font-semibold text-white">{track.target_id}</td>
              <td className="px-4 py-3 uppercase">
                <span className={track.threat_level === 'red' ? 'font-black text-rose-400' : ''}>{track.threat_level}</span>
              </td>
              <td className="px-4 py-3 uppercase">{track.classification}</td>
              <td className="px-4 py-3">{track.position?.altitude_m ?? '--'} m</td>
              <td className="px-4 py-3">{track.position?.speed_mps ?? '--'} m/s</td>
              <td className="px-4 py-3">{track.evidence?.distance_to_zone_km ?? '--'} km</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
);

const Dashboard = () => {
  const { data, status } = useWebSocket(`ws://${window.location.hostname}:8000/ws`);
  const [tracks, setTracks] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [sensorEvents, setSensorEvents] = useState([]);
  const [history, setHistory] = useState({});
  const [restrictedZone, setRestrictedZone] = useState(null);
  const [tick, setTick] = useState(0);
  const [scenario, setScenario] = useState('normal');
  const [autoTick, setAutoTick] = useState(false);
  const [copilotQuery, setCopilotQuery] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [isQuerying, setIsQuerying] = useState(false);
  const [selectedTargetId, setSelectedTargetId] = useState(null);
  const [eventTimeline, setEventTimeline] = useState([]);
  const [sensorFeed, setSensorFeed] = useState([]);
  const [systemHealth, setSystemHealth] = useState(null);
  const [platformHealth, setPlatformHealth] = useState(null);
  const [operationalMetrics, setOperationalMetrics] = useState(null);
  const [replaySession, setReplaySession] = useState(null);
  const [availableRegions, setAvailableRegions] = useState([]);
  const [snapshotHistory, setSnapshotHistory] = useState([]);
  const [selectedScenario, setSelectedScenario] = useState('restricted_intrusion');
  const [zoneCenter, setZoneCenter] = useState([-6.1748, 35.7384]);
  const [zoneRadiusKM, setZoneRadiusKM] = useState(50);
  const [zoneName, setZoneName] = useState('Dodoma Core');
  const [route, setRoute] = useState(routeFromHash);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    const syncRoute = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', syncRoute);
    if (!window.location.hash) {
      window.history.replaceState(null, '', '#/overview');
    }
    return () => window.removeEventListener('hashchange', syncRoute);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const recordSnapshot = useCallback(snapshot => {
    const normalized = {
      tick: snapshot.tick ?? 0,
      scenario: snapshot.scenario ?? 'normal',
      tracks: cloneForHistory(snapshot.tracks ?? snapshot.fused_tracks ?? snapshot.latest_tracks),
      alerts: cloneForHistory(snapshot.alerts ?? []),
      sensorEvents: cloneForHistory(snapshot.sensorEvents ?? snapshot.sensor_events ?? snapshot.recent_sensor_events),
    };

    setSnapshotHistory(prev => {
      if (prev.some(entry => entry.tick === normalized.tick && entry.scenario === normalized.scenario)) {
        return prev;
      }
      return [...prev.slice(-39), normalized];
    });
  }, []);

  useEffect(() => {
    console.log('Testing backend connection...');
    fetch(`http://${window.location.hostname}:8000/health`)
      .then(res => res.json())
      .then(data => {
        console.log('Backend health check:', data);
        setPlatformHealth(data);
      })
      .catch(err => console.error('Backend health check failed:', err));

    fetch(`http://${window.location.hostname}:8000/state`)
      .then(res => res.json())
      .then(state => {
        setTracks(state.latest_tracks || []);
        setAlerts(state.alerts || []);
        setSensorEvents(state.recent_sensor_events || []);
        setHistory(state.history || {});
        setEventTimeline(state.event_timeline || []);
        setSensorFeed(state.sensor_feed || []);
        setSystemHealth(state.system_health || null);
        setRestrictedZone(state.restricted_zone);
        setTick(state.tick || 0);
        setScenario(state.scenario || 'normal');
        recordSnapshot({
          tick: state.tick || 0,
          scenario: state.scenario || 'normal',
          latest_tracks: state.latest_tracks || [],
          alerts: state.alerts || [],
          recent_sensor_events: state.recent_sensor_events || [],
        });
      });

    fetch(`http://${window.location.hostname}:8000/regions`)
      .then(res => res.json())
      .then(data => setAvailableRegions(data.regions || []))
      .catch(() => {});

    // Synchronize initial zone with backend
    fetch(`http://${window.location.hostname}:8000/simulation/update_zone?lat=${zoneCenter[0]}&lon=${zoneCenter[1]}&radius_km=${zoneRadiusKM}&name=${encodeURIComponent(zoneName)}`, {
      method: 'POST'
    }).catch(err => console.error('Failed to sync initial zone:', err));
  }, [recordSnapshot]);

  useEffect(() => {
    const loadMetrics = () => {
      fetch(`http://${window.location.hostname}:8000/metrics`)
        .then(res => res.json())
        .then(setOperationalMetrics)
        .catch(() => {});
      fetch(`http://${window.location.hostname}:8000/health`)
        .then(res => res.json())
        .then(setPlatformHealth)
        .catch(() => {});
    };
    loadMetrics();
    const interval = setInterval(loadMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let interval;
    if (autoTick && status === 'connected') {
      interval = setInterval(() => {
        handleStep();
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [autoTick, status]);

  useEffect(() => {
    if (!data) {
      return;
    }

    if (data.type === 'simulation_step') {
      const { tick: nextTick, fused_tracks, alerts: newAlerts, sensor_events, scenario: nextScenario, ended: isEnded } = data.data;
      if (isEnded) setAutoTick(false);
      
      if (nextTick !== undefined) setTick(nextTick);
      if (nextScenario) setScenario(nextScenario);
      if (fused_tracks) setTracks(fused_tracks);
      if (sensor_events) setSensorEvents(prev => [...sensor_events, ...prev].slice(0, 50));
      if (data.data.sensor_feed) setSensorFeed(prev => [...data.data.sensor_feed, ...prev].slice(0, 80));
      if (data.data.system_health) setSystemHealth(data.data.system_health);
      if (newAlerts && newAlerts.length > 0) processNewAlerts(newAlerts);
      if (fused_tracks) updateTrackHistory(fused_tracks);
      recordSnapshot({
        tick: nextTick,
        scenario: nextScenario || scenario,
        fused_tracks: fused_tracks || [],
        alerts: newAlerts || [],
        sensor_events: sensor_events || [],
      });
    } else if (data.type === 'simulation_reset') {
      resetUIState();
      if (data.restricted_zone) setRestrictedZone(data.restricted_zone);
      if (data.scenario) setScenario(data.scenario);
    } else if (data.type === 'livefeed_event') {
      const event = data.data || {};
      const feedEvent = {
        tick,
        type: event.source || event.sensor_type || 'livefeed',
        target_id: event.target_id,
        sensor_type: event.sensor_type,
        message: event.message || 'Live feed event received',
        timestamp: event.timestamp,
        confidence: event.confidence,
      };
      setSensorFeed(prev => [feedEvent, ...prev].slice(0, 120));
      setEventTimeline(prev => [
        {
          tick,
          target_id: event.target_id,
          event: 'livefeed_update',
          sensor_type: event.sensor_type,
          source: event.source,
        },
        ...prev,
      ].slice(0, 300));
    } else if (data.type === 'region_changed') {
      const payload = data.data || {};
      if (payload.restricted_zone) setRestrictedZone(payload.restricted_zone);
      if (payload.restricted_zone?.center) setZoneCenter([payload.restricted_zone.center.lat, payload.restricted_zone.center.lon]);
      if (payload.restricted_zone?.radius_km) setZoneRadiusKM(payload.restricted_zone.radius_km);
      if (payload.restricted_zone?.name) setZoneName(payload.restricted_zone.name);
    }
  }, [data, recordSnapshot, scenario]);

  const processNewAlerts = newAlerts => {
    setAlerts(prev => {
      const alertMap = new Map();
      [...prev].reverse().forEach(alert => alertMap.set(alert.level, alert));
      newAlerts.forEach(alert => alertMap.set(alert.level, alert));

      const unique = Array.from(alertMap.values());
      const priorityOrder = { red: 3, orange: 2, yellow: 1, green: 0, info: 0 };
      return unique.sort((a, b) => priorityOrder[b.level] - priorityOrder[a.level]);
    });
  };

  const updateTrackHistory = fusedTracks => {
    setHistory(prev => {
      const nextHistory = { ...prev };
      fusedTracks.forEach(track => {
        if (track.position) {
          const position = { lat: track.position.lat, lon: track.position.lon };
          nextHistory[track.target_id] = [...(nextHistory[track.target_id] || []), position].slice(-20);
        }
      });
      return nextHistory;
    });
  };

  const resetUIState = () => {
    setTracks([]);
    setAlerts([]);
    setSensorEvents([]);
    setHistory({});
    setEventTimeline([]);
    setSensorFeed([]);
    setSnapshotHistory([]);
    setSelectedTargetId(null);
    setTick(0);
  };

  const handleReset = async (scenarioName = selectedScenario) => {
    try {
      await fetch(`http://${window.location.hostname}:8000/simulation/reset?scenario=${scenarioName}`, { method: 'POST' });
      resetUIState();
      fetch(`http://${window.location.hostname}:8000/state`)
        .then(res => res.json())
        .then(state => {
          setTracks(state.latest_tracks || []);
          setAlerts(state.alerts || []);
          setSensorEvents(state.recent_sensor_events || []);
          setHistory(state.history || {});
          setRestrictedZone(state.restricted_zone);
          setTick(state.tick || 0);
          setScenario(state.scenario || scenarioName);
          setEventTimeline(state.event_timeline || []);
          recordSnapshot({
            tick: state.tick || 0,
            scenario: state.scenario || scenarioName,
            latest_tracks: state.latest_tracks || [],
            alerts: state.alerts || [],
            recent_sensor_events: state.recent_sensor_events || [],
          });
        });
    } catch (err) {
      console.error('Simulation reset failed:', err);
    }
  };

  const handleJudgeDemo = async () => {
    try {
      setAutoTick(false);
      resetUIState();
      const res = await fetch(`http://${window.location.hostname}:8000/simulation/judge-demo`, { method: 'POST' });
      const data = await res.json();
      const stateRes = await fetch(`http://${window.location.hostname}:8000/state`);
      const state = await stateRes.json();
      setTracks(state.latest_tracks || data.latest_tracks || []);
      setAlerts(state.alerts || data.latest_alerts || []);
      setSensorEvents(state.recent_sensor_events || []);
      setEventTimeline(state.event_timeline || []);
      setSensorFeed(state.sensor_feed || []);
      setSystemHealth(state.system_health || null);
      setHistory(state.history || {});
      setTick(state.tick || 0);
      setScenario(state.scenario || 'restricted_intrusion');
      setSelectedScenario('restricted_intrusion');
    } catch (err) {
      console.error('Judge demo failed:', err);
    }
  };

  const handleStep = async () => {
    try {
      const res = await fetch(`http://${window.location.hostname}:8000/simulation/step`, { method: 'POST' });
      const stepData = await res.json();
      
      if (stepData.ended) {
        setAutoTick(false);
      }

      if (stepData.fused_tracks) setTracks(stepData.fused_tracks);
      if (stepData.tick !== undefined) setTick(stepData.tick);
      if (stepData.scenario) setScenario(stepData.scenario);
      if (stepData.alerts) processNewAlerts(stepData.alerts);
      if (stepData.fused_tracks) updateTrackHistory(stepData.fused_tracks);
      fetch(`http://${window.location.hostname}:8000/state`)
        .then(res => res.json())
        .then(state => {
          setEventTimeline(state.event_timeline || []);
          setSensorFeed(state.sensor_feed || []);
          setSystemHealth(state.system_health || null);
        })
        .catch(() => {});
      recordSnapshot({
        tick: stepData.tick,
        scenario: stepData.scenario || scenario,
        fused_tracks: stepData.fused_tracks || [],
        alerts: stepData.alerts || [],
        sensor_events: stepData.sensor_events || [],
      });
    } catch (err) {
      console.error('Step execution failed:', err);
    }
  };

  const displayedTracks = tracks;

  useEffect(() => {
    if (!selectedTargetId && displayedTracks.length > 0) {
      setSelectedTargetId(displayedTracks[0].target_id);
    }
  }, [displayedTracks, selectedTargetId]);

  const selectedTrack =
    displayedTracks.find(track => track.target_id === selectedTargetId) || displayedTracks[0] || null;

  const buildHistoricalAnswer = useCallback(
    query => {
      const lowerQuery = query.toLowerCase();
      const targetId = extractTargetId(query) || selectedTargetId || tracks[0]?.target_id;

      if (!snapshotHistory.length) {
        return null;
      }

      const targetSnapshots = targetId
        ? snapshotHistory.filter(entry => entry.tracks.some(track => track.target_id === targetId))
        : snapshotHistory;

      const ticksAgoMatch = lowerQuery.match(/(\d+)\s*ticks?\s+ago/);
      if (ticksAgoMatch) {
        const ticksAgo = Number(ticksAgoMatch[1]);
        const targetTick = Math.max(0, tick - ticksAgo);
        const snapshot =
          [...snapshotHistory].reverse().find(entry => entry.tick === targetTick) ||
          [...snapshotHistory].reverse().find(entry => entry.tick <= targetTick);

        if (!snapshot) {
          return `Historical replay unavailable for ${ticksAgo} ticks ago because no retained snapshot matches that time window.`;
        }

        const track = targetId
          ? snapshot.tracks.find(item => item.target_id === targetId)
          : snapshot.tracks[0];

        if (!track) {
          return `At T-${String(snapshot.tick).padStart(4, '0')}, ${targetId || 'the requested target'} was not present in the retained snapshot history.`;
        }

        return `Historical snapshot T-${String(snapshot.tick).padStart(4, '0')}: ${track.target_id} was ${String(
          track.threat_level || 'unknown'
        ).toUpperCase()}, classified as ${track.classification || 'unknown'}, ${track.evidence?.distance_to_zone_km ?? '--'} km from the zone, and transponder status was ${
          track.evidence?.transponder_present ? 'PRESENT' : 'MISSING'
        }.`;
      }

      if (
        lowerQuery.includes('before target exited') ||
        lowerQuery.includes('before target exited the region') ||
        lowerQuery.includes('before target exited region') ||
        lowerQuery.includes('before it exited')
      ) {
        if (!targetId || !targetSnapshots.length) {
          return 'No retained exit record exists for that target yet.';
        }

        const finalSnapshot = targetSnapshots[targetSnapshots.length - 1];
        const finalTrack = finalSnapshot.tracks.find(track => track.target_id === targetId);

        if (!finalTrack) {
          return `No retained pre-exit state was found for ${targetId}.`;
        }

        return `Final in-region record for ${targetId} occurred at T-${String(finalSnapshot.tick).padStart(4, '0')}. Threat level was ${String(
          finalTrack.threat_level || 'unknown'
        ).toUpperCase()}, class was ${finalTrack.classification || 'unknown'}, distance to zone was ${
          finalTrack.evidence?.distance_to_zone_km ?? '--'
        } km, and the recommended action was "${finalTrack.recommended_action || finalTrack.explanation || 'continue observation'}".`;
      }

      if (lowerQuery.includes('show logs') || lowerQuery.includes('historical') || lowerQuery.includes('previous')) {
        const recentSnapshots = targetSnapshots.slice(-3);
        if (!recentSnapshots.length) {
          return null;
        }

        const lines = recentSnapshots.map(entry => {
          const track = targetId ? entry.tracks.find(item => item.target_id === targetId) : entry.tracks[0];
          if (!track) {
            return `T-${String(entry.tick).padStart(4, '0')}: target not present in snapshot.`;
          }
          return `T-${String(entry.tick).padStart(4, '0')}: ${track.target_id} ${String(
            track.threat_level || 'unknown'
          ).toUpperCase()} at ${track.position?.altitude_m ?? '--'} m, ${track.position?.speed_mps ?? '--'} m/s, ${track.evidence?.distance_to_zone_km ?? '--'} km from zone.`;
        });

        return `Historical track log for ${targetId || 'current focus'}:\n${lines.join('\n')}`;
      }

      return null;
    },
    [tracks, selectedTargetId, snapshotHistory, tick]
  );

  const handleCopilotQuery = async e => {
    e.preventDefault();
    const query = copilotQuery.trim();
    if (!query) return;

    setCopilotQuery('');
    setIsQuerying(true);
    setChatHistory(prev => [...prev, { role: 'user', content: query }]);

    try {
      const historicalAnswer = buildHistoricalAnswer(query);
      if (historicalAnswer) {
        setChatHistory(prev => [...prev, { role: 'assistant', content: historicalAnswer }]);
        return;
      }

      const recentHistoryContext = snapshotHistory
        .slice(-5)
        .map(entry => ({
          tick: entry.tick,
          scenario: entry.scenario,
          tracks: entry.tracks.map(track => ({
            target_id: track.target_id,
            threat_level: track.threat_level,
            classification: track.classification,
            distance_to_zone_km: track.evidence?.distance_to_zone_km,
          })),
        }));

      const enrichedQuestion = [
        query,
        selectedTrack ? `Selected target: ${selectedTrack.target_id}` : null,
        recentHistoryContext.length ? `Historical snapshots: ${JSON.stringify(recentHistoryContext)}` : null,
      ]
        .filter(Boolean)
        .join('\n\n');

      const response = await fetch(`http://${window.location.hostname}:8000/assistant/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: enrichedQuestion }),
      });
      const result = await response.json();
      if (response.ok) {
        setChatHistory(prev => [...prev, { role: 'assistant', content: result.answer }]);
      } else {
        setChatHistory(prev => [
          ...prev,
          { role: 'assistant', content: `Defensive Copilot unavailable: ${result.detail || 'Unknown error'}` },
        ]);
      }
    } catch (err) {
      setChatHistory(prev => [
        ...prev,
        { role: 'assistant', content: 'Defensive Copilot is offline. Live explanation will resume once the backend is reachable.' },
      ]);
    } finally {
      setIsQuerying(false);
    }
  };

  const topTrack = selectedTrack || tracks[0] || null;
  const latestAssistantMessage = [...chatHistory].reverse().find(message => message.role === 'assistant');
  const latestExplanation =
    latestAssistantMessage?.content ||
    alerts.find(alert => alert.target_id === topTrack?.target_id)?.explanation ||
    alerts[0]?.explanation ||
    topTrack?.explanation ||
    topTrack?.recommended_action ||
    'Awaiting defensive intelligence from the live mock backend stream.';

  const liveTelemetryTrack = selectedTrack || tracks[0] || null;
  const liveGeoLabel = liveTelemetryTrack?.position
    ? `${liveTelemetryTrack.position.lat.toFixed(4)}°, ${liveTelemetryTrack.position.lon.toFixed(4)}°`
    : 'NO ACTIVE LOCK';
  const liveSpeed = liveTelemetryTrack?.position?.speed_mps ?? '--';
  const liveLatitude = liveTelemetryTrack?.position?.lat?.toFixed(4) ?? '--';

  const metrics = useMemo(
    () => [
      { label: 'TICK', value: `T-${String(tick).padStart(4, '0')}` },
      { label: 'SCENARIO', value: scenario },
      { label: 'TRACKS', value: String(tracks.length).padStart(2, '0') },
      { label: 'ALERTS', value: String(alerts.length).padStart(2, '0') },
    ],
    [tick, scenario, tracks.length, alerts.length]
  );

  const criticalAlerts = alerts.filter(alert => ['red', 'orange'].includes(alert.level)).length;
  const elevatedTracks = tracks.filter(track => ['red', 'orange'].includes(track.threat_level)).length;
  const sensorCount = sensorEvents.length;
  const activeMode = platformHealth?.mode || systemHealth?.mode || 'demo';
  const streamStatus = platformHealth?.streaming?.status || 'ONLINE';
  const liveFeedStatus = operationalMetrics?.livefeeds || platformHealth?.livefeeds || {};
  const eventThroughput = operationalMetrics?.livefeeds?.events_per_second ?? operationalMetrics?.websocket?.delivered ?? 0;
  const anomalyPerMinute = snapshotHistory.length
    ? (snapshotHistory.slice(-12).reduce((sum, entry) => sum + entry.tracks.filter(track => track.anomaly?.anomaly_label && track.anomaly.anomaly_label !== 'normal').length, 0) * 5).toFixed(1)
    : '0.0';
  const pipelineLabel = 'detect -> fuse -> score -> alert -> explain';
  const chartPoints = snapshotHistory.map(entry => Math.max(entry.alerts.length * 18, entry.tracks.length * 8, 5));
  const confidencePoints = snapshotHistory.map(entry => {
    const confidences = entry.tracks.map(track => (track.fusion_confidence || 0) * 100);
    return confidences.length ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length : 5;
  });

  const navigate = nextRoute => {
    window.location.hash = `/${nextRoute}`;
    setRoute(nextRoute);
  };

  const toggleLiveFeed = async (feedName, enabled) => {
    try {
      const res = await fetch(`http://${window.location.hostname}:8000/livefeeds/${feedName}/${enabled ? 'disable' : 'enable'}`, {
        method: 'POST',
      });
      if (res.ok) {
        const healthRes = await fetch(`http://${window.location.hostname}:8000/metrics`);
        setOperationalMetrics(await healthRes.json());
      }
    } catch (err) {
      console.error('Live feed toggle failed:', err);
    }
  };

  const loadReplaySession = async () => {
    try {
      const targetQuery = topTrack?.target_id ? `?target_id=${encodeURIComponent(topTrack.target_id)}` : '';
      const res = await fetch(`http://${window.location.hostname}:8000/replay/session${targetQuery}`);
      if (res.ok) setReplaySession(await res.json());
    } catch (err) {
      console.error('Replay session load failed:', err);
    }
  };

  const switchRegion = async regionName => {
    try {
      const res = await fetch(`http://${window.location.hostname}:8000/regions/switch?region=${encodeURIComponent(regionName)}`, {
        method: 'POST',
      });
      if (!res.ok) return;
      const data = await res.json();
      const zone = data.restricted_zones?.[0];
      if (zone?.center) setZoneCenter([zone.center.lat, zone.center.lon]);
      if (zone?.radius_km) setZoneRadiusKM(zone.radius_km);
      if (zone?.name) setZoneName(zone.name);
    } catch (err) {
      console.error('Region switch failed:', err);
    }
  };

  const mapPanel = (className = '') => (
    <Panel
      title="Tactical Airspace"
      subtitle={`${zoneName} restricted zone / ${zoneRadiusKM} km radius`}
      className={className}
      action={
        <button className="ops-icon-btn" onClick={() => setMapFullscreen(true)} type="button" title="Fullscreen map" aria-label="Fullscreen map">
          <Maximize2 size={14} />
        </button>
      }
    >
      <div className="min-h-0 flex-1 p-3">
        <AirspaceMap
          tracks={tracks}
          restrictedZone={restrictedZone}
          history={history}
          selectedTargetId={selectedTargetId}
          onSelectTarget={setSelectedTargetId}
          zoneCenter={zoneCenter}
          zoneRadiusKM={zoneRadiusKM}
          zoneName={zoneName}
          onZoneCenterChange={setZoneCenter}
        />
      </div>
    </Panel>
  );

  const copilotPanel = (
    <Panel title="LLM Copilot" subtitle="Operator Q&A, incident explanations, and reasoning logs" className="h-full min-h-0">
      <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)_auto] gap-3 p-3">
        <div className="ops-scroll max-h-[180px] rounded-md border border-zinc-800 bg-zinc-950/50 p-3 font-mono text-[11px]">
          <div className="mb-1 flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-500">
            <Terminal size={10} className="text-cyan-400" />
            Current explanation
          </div>
          <p className="leading-5 text-zinc-300">{latestExplanation}</p>
        </div>
        <div className="ops-scroll rounded-md border border-zinc-800 bg-[#08090b] p-3">
          {chatHistory.length === 0 ? (
            <div className="ops-empty-state">
              <MessageSquare size={24} />
              <span>Awaiting defensive intelligence</span>
            </div>
          ) : (
            chatHistory.map((message, idx) => (
              <div key={`${message.role}-${idx}`} className={`mb-3 flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[760px] rounded-md border px-3 py-2 ${message.role === 'user' ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-100' : 'border-zinc-800 bg-[#0f1115] text-zinc-300'}`}>
                  <div className="mb-1 text-[8px] font-black uppercase tracking-[0.14em] text-zinc-500">
                    {message.role === 'user' ? 'Operator Comms' : 'Defensive Copilot'}
                  </div>
                  <p className="whitespace-pre-wrap text-[11px] leading-5">{message.content}</p>
                </div>
              </div>
            ))
          )}
          <div ref={chatEndRef} />
        </div>
        <form onSubmit={handleCopilotQuery} className="flex shrink-0 gap-2">
          <input
            type="text"
            value={copilotQuery}
            onChange={e => setCopilotQuery(e.target.value)}
            placeholder="Ask about the current incident, target history, or escalation path..."
            className="min-h-10 min-w-0 flex-1 rounded-md border border-zinc-800 bg-[#08090b] px-3 text-[12px] text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-cyan-500/50"
            disabled={isQuerying}
          />
          <button type="submit" className="ops-btn ops-btn-primary px-3" disabled={isQuerying}>
            <Play size={11} />
            {isQuerying ? 'Sending' : 'Send'}
          </button>
        </form>
      </div>
    </Panel>
  );

  const routeContent = {
    overview: (
      <PageShell className="grid grid-rows-[auto_minmax(0,1fr)] gap-3">
        <div className="grid gap-3 lg:grid-cols-4">
          <MiniMetric label="Threat posture" value={criticalAlerts ? `${criticalAlerts} elevated` : 'nominal'} tone={criticalAlerts ? 'rose' : 'emerald'} />
          <MiniMetric label="Live tracks" value={String(tracks.length).padStart(2, '0')} />
          <MiniMetric label="Sensor events" value={sensorCount} tone="amber" />
          <MiniMetric label="Events/sec" value={eventThroughput} tone="cyan" />
        </div>
        <div className="grid min-h-0 gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.8fr)]">
          <div className="grid min-h-0 grid-rows-[minmax(280px,1fr)_minmax(170px,0.48fr)] gap-3">
            {mapPanel('min-h-[280px]')}
            <Panel title="Recent Anomalies" subtitle="Latest scored target states">
              <div className="ops-scroll flex-1 p-3">
                <TrackTable tracks={displayedTracks.slice(0, 6)} selectedTargetId={selectedTargetId} onSelectTarget={setSelectedTargetId} />
              </div>
            </Panel>
          </div>
          <div className="grid min-h-0 grid-rows-[minmax(220px,1fr)_minmax(180px,0.75fr)] gap-3">
            <AlertPanel alerts={alerts} onAcknowledge={id => setAlerts(prev => prev.filter(alert => alert.alert_id !== id))} />
            <SystemHealth health={systemHealth} />
          </div>
        </div>
      </PageShell>
    ),
    'live-airspace': (
      <PageShell className="grid grid-rows-[minmax(360px,1fr)_minmax(190px,0.38fr)] gap-3">
        {mapPanel('min-h-[360px]')}
        <div className="grid min-h-0 gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Panel title="Live Tracks" subtitle="Fused targets and restricted-zone proximity">
            <TrackTable tracks={displayedTracks} selectedTargetId={selectedTargetId} onSelectTarget={setSelectedTargetId} />
          </Panel>
          <AlertPanel alerts={alerts} onAcknowledge={id => setAlerts(prev => prev.filter(alert => alert.alert_id !== id))} />
        </div>
      </PageShell>
    ),
    'threat-intelligence': (
      <PageShell className="grid gap-3 xl:grid-cols-[minmax(320px,0.62fr)_minmax(0,1fr)]">
        <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
          <ThreatPanel track={topTrack} />
          <ExplainabilityPanel track={topTrack} />
        </div>
        <div className="grid min-h-0 grid-rows-[minmax(210px,0.45fr)_minmax(0,1fr)] gap-3">
          <div className="grid min-h-0 gap-3 lg:grid-cols-2">
            <ResponsiveChart title="Threat score trend" points={chartPoints} tone="#fb7185" />
            <ResponsiveChart title="Fusion confidence" points={confidencePoints} tone="#22d3ee" />
          </div>
          <Panel title="Escalation History" subtitle="Retained operational snapshots">
            <div className="ops-scroll flex-1 p-3">
              {snapshotHistory.slice(-18).reverse().map(entry => (
                <div key={`${entry.scenario}-${entry.tick}`} className="mb-2 rounded-md border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-[11px]">
                  <div className="font-black uppercase tracking-[0.12em] text-cyan-300">T-{String(entry.tick).padStart(4, '0')} / {entry.scenario}</div>
                  <p className="mt-1 text-zinc-400">{entry.tracks.length} tracks, {entry.alerts.length} alerts retained in snapshot.</p>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </PageShell>
    ),
    'sensor-activity': (
      <PageShell className="grid gap-3 xl:grid-cols-[minmax(330px,0.7fr)_minmax(0,1fr)]">
        <SensorActivity events={sensorEvents} />
        <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_minmax(190px,0.42fr)] gap-3">
          <LiveSensorFeed feed={sensorFeed} />
          <ResponsiveChart title="Incoming detections" points={snapshotHistory.map(entry => entry.sensorEvents.length || 1)} tone="#f59e0b" />
        </div>
      </PageShell>
    ),
    'event-timeline': (
      <PageShell className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
        <EventTimeline entries={eventTimeline} />
        <Panel title="Timeline Context" subtitle="Current target and scenario">
          <div className="space-y-3 p-3 text-[12px] text-zinc-400">
            <MiniMetric label="Scenario" value={scenario} />
            <MiniMetric label="Selected target" value={topTrack?.target_id || 'none'} tone="amber" />
            <MiniMetric label="Pipeline" value={pipelineLabel} tone="zinc" />
          </div>
        </Panel>
      </PageShell>
    ),
    'llm-copilot': <PageShell>{copilotPanel}</PageShell>,
    'system-health': (
      <PageShell className="grid gap-3 xl:grid-cols-[minmax(340px,0.72fr)_minmax(0,1fr)]">
        <SystemHealth health={systemHealth} />
        <Panel title="Platform Services" subtitle="Backend API, fusion, threat, LLM, and UI service posture">
          <div className="grid content-start gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
            {['Radar', 'RF', 'Camera', 'Thermal', 'ADS-B', 'Backend API', 'Fusion engine', 'Threat engine', 'Streaming engine', 'Ingestion layer', 'LLM status'].map((name, index) => (
              <div key={name} className="rounded-md border border-zinc-800 bg-zinc-950/60 p-4">
                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">{name}</span>
                <p className={`mt-3 text-sm font-black uppercase ${index >= 8 ? 'text-cyan-300' : 'text-emerald-300'}`}>
                  {index === 8 ? streamStatus : index === 9 ? (operationalMetrics?.ingestion?.status || 'ONLINE') : index === 10 ? 'Ready' : 'Operational'}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </PageShell>
    ),
    analytics: (
      <PageShell className="grid grid-rows-[auto_minmax(0,1fr)] gap-3">
        <div className="grid gap-3 md:grid-cols-3">
          <MiniMetric label="Retained snapshots" value={snapshotHistory.length} />
          <MiniMetric label="Elevated tracks" value={elevatedTracks} tone={elevatedTracks ? 'rose' : 'emerald'} />
          <MiniMetric label="Anomaly/min" value={anomalyPerMinute} tone="amber" />
        </div>
        <div className="grid min-h-0 gap-3 xl:grid-cols-2">
          <ResponsiveChart title="Alert density" points={chartPoints} tone="#fb7185" />
          <ResponsiveChart title="Confidence evolution" points={confidencePoints} tone="#22d3ee" />
          <ResponsiveChart title="Sensor activity timeline" points={snapshotHistory.map(entry => entry.sensorEvents.length || 1)} tone="#f59e0b" />
          <Panel title="Ingestion Statistics" subtitle="Live public feed and streaming throughput">
            <div className="ops-scroll grid content-start gap-3 p-3 md:grid-cols-2">
              <MiniMetric label="WebSocket delivered" value={operationalMetrics?.websocket?.delivered ?? 0} />
              <MiniMetric label="Queue depth" value={operationalMetrics?.websocket?.queue_depth ?? 0} tone="zinc" />
              <MiniMetric label="Live feed events" value={liveFeedStatus?.events_total ?? 0} tone="amber" />
              <MiniMetric label="EPS" value={liveFeedStatus?.events_per_second ?? 0} tone="emerald" />
            </div>
          </Panel>
          <Panel
            title="Incident Replay"
            subtitle="Historical playback dataset for selected target"
            action={<button className="ops-btn" onClick={loadReplaySession} type="button">Load Replay</button>}
          >
            <div className="ops-scroll flex-1 p-3">
              {(replaySession?.tracks || []).slice(-24).map(row => (
                <div key={`${row.target_id}-${row.tick}-${row.created_at}`} className="mb-2 rounded-md border border-zinc-800 bg-zinc-950/50 px-3 py-2 text-[11px]">
                  <div className="font-black uppercase tracking-[0.12em] text-cyan-300">T-{String(row.tick).padStart(4, '0')} / {row.target_id}</div>
                  <p className="mt-1 text-zinc-400">{row.threat_level.toUpperCase()} score {row.threat_score} at {row.position.lat.toFixed(4)}, {row.position.lon.toFixed(4)}</p>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </PageShell>
    ),
    'demo-controls': (
      <PageShell className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel title="Demo Controls" subtitle="Scenario resets, judge demo, and simulation stepping">
          <div className="space-y-4 p-4">
            <div className="flex flex-wrap gap-2">
              {SCENARIOS.map(name => (
                <button key={name} className={`ops-btn ${selectedScenario === name ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-300' : ''}`} onClick={() => { setSelectedScenario(name); handleReset(name); }} type="button">
                  {name.replace('_', ' ')}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="ops-btn" onClick={() => setAutoTick(!autoTick)} type="button">{autoTick ? 'Stop auto' : 'Start auto'}</button>
              <button className="ops-btn" onClick={() => handleReset(selectedScenario)} type="button"><RefreshCw size={14} /> Reset</button>
              <button className="ops-btn border-amber-500/40 bg-amber-500/10 text-amber-200" onClick={handleJudgeDemo} type="button">Judge Demo</button>
              <button className="ops-btn ops-btn-primary" onClick={handleStep} type="button"><Zap size={13} /> Step</button>
            </div>
          </div>
        </Panel>
        <Panel title="Zone Presets" subtitle={`${zoneName} / ${zoneRadiusKM} km`}>
          <div className="space-y-2 p-3">
            {Object.keys(ZONE_PRESETS).map(presetName => (
              <button key={presetName} className="ops-btn w-full justify-start" onClick={async () => {
                const preset = ZONE_PRESETS[presetName];
                setZoneCenter(preset.center);
                setZoneRadiusKM(preset.radiusKM);
                setZoneName(preset.zoneName);
                await fetch(`http://${window.location.hostname}:8000/simulation/update_zone?lat=${preset.center[0]}&lon=${preset.center[1]}&radius_km=${preset.radiusKM}&name=${encodeURIComponent(preset.zoneName)}`, { method: 'POST' });
              }} type="button">{presetName}</button>
            ))}
          </div>
        </Panel>
        <Panel title="Region Switching" subtitle="Runtime deployment regions">
          <div className="space-y-2 p-3">
            {availableRegions.map(regionName => (
              <button key={regionName} className="ops-btn w-full justify-start" onClick={() => switchRegion(regionName)} type="button">
                {regionName.replaceAll('_', ' ')}
              </button>
            ))}
          </div>
        </Panel>
        <Panel title="Live Feed Controls" subtitle="Public telemetry connectors">
          <div className="space-y-2 p-3">
            {Object.entries(liveFeedStatus?.feeds || {}).map(([name, feed]) => (
              <button key={name} className={`ops-btn w-full justify-between ${feed.enabled ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : ''}`} onClick={() => toggleLiveFeed(name, feed.enabled)} type="button">
                <span>{name}</span>
                <span>{feed.enabled ? 'ACTIVE' : 'ENABLE'}</span>
              </button>
            ))}
          </div>
        </Panel>
      </PageShell>
    ),
    settings: (
      <PageShell>
        <Panel title="Settings" subtitle="Interface preferences and operational display options">
          <div className="grid content-start gap-3 p-4 md:grid-cols-2">
            <button className="ops-btn justify-start" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} type="button">
              {sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            </button>
            <div className="rounded-md border border-zinc-800 bg-zinc-950/60 p-4 text-[12px] text-zinc-400">
              Data source: live backend on port 8000 with local UI routing.
            </div>
            <button className="ops-btn justify-start" onClick={loadReplaySession} type="button">
              Load incident replay for selected target
            </button>
            <div className="rounded-md border border-zinc-800 bg-zinc-950/60 p-4 text-[12px] text-zinc-400">
              Replay samples: {replaySession?.samples ?? 0}
            </div>
          </div>
        </Panel>
      </PageShell>
    ),
  };

  return (
    <div className={`ops-app-shell ${sidebarCollapsed ? 'is-collapsed' : ''}`}>
      <aside className="ops-sidebar">
        <div className="flex h-16 items-center gap-3 border-b border-zinc-800 px-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-cyan-500/30 bg-cyan-500/10">
            <Shield size={18} className="text-cyan-300" />
          </div>
          {!sidebarCollapsed && (
            <div className="min-w-0">
              <div className="truncate text-sm font-black uppercase tracking-[0.14em] text-white">SkyShield AI</div>
              <div className="truncate text-[10px] text-zinc-500">Operations Center</div>
            </div>
          )}
        </div>

        <nav className="ops-nav ops-scroll">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const active = route === item.id;
            return (
              <button key={item.id} className={`ops-nav-item ${active ? 'is-active' : ''}`} onClick={() => navigate(item.id)} type="button" title={item.label}>
                <Icon size={17} />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <button className="ops-sidebar-toggle" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} type="button">
          {sidebarCollapsed ? <Menu size={16} /> : <ChevronLeft size={16} />}
          {!sidebarCollapsed && <span>Collapse</span>}
        </button>
      </aside>

      <div className="ops-main">
        <header className="ops-topbar">
          <div className="min-w-0">
            <h1>{ROUTE_TITLES[route]}</h1>
            <p>{activeMode} mode / {scenario} / {zoneName} / {pipelineLabel}</p>
          </div>
          <div className="ops-topbar-actions">
            <span className={`ops-status-pill ${status === 'connected' ? 'is-online' : 'is-offline'}`}>
              <span />
              NET {status}
            </span>
            <span className="ops-status-pill is-online"><Network size={13} /> {streamStatus}</span>
            <span className="ops-status-pill">{activeMode}</span>
            <button className={`ops-btn ${autoTick ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : ''}`} onClick={() => setAutoTick(!autoTick)} type="button">
              {autoTick ? 'Auto' : 'Manual'}
            </button>
            <button className="ops-btn" onClick={() => handleReset(selectedScenario)} type="button"><RefreshCw size={14} /></button>
            <button className="ops-btn ops-btn-primary" onClick={handleStep} type="button"><Zap size={13} /> Step</button>
          </div>
        </header>

        <main className="ops-route-viewport">
          {routeContent[route] || routeContent.overview}
        </main>

        <footer className="ops-footer">
          <span>Geo: {liveGeoLabel}</span>
          <span>Speed: {liveSpeed === '--' ? '--' : `${liveSpeed} m/s`}</span>
          <span>Latitude: {liveLatitude}</span>
          <span className="text-cyan-400">{liveTelemetryTrack?.target_id ? `Tracking ${liveTelemetryTrack.target_id}` : 'Awaiting target lock'}</span>
        </footer>
      </div>

      {mapFullscreen && (
        <div className="ops-fullscreen">
          <div className="ops-fullscreen-header">
            <div>
              <h2>Tactical Airspace</h2>
              <p>{zoneName} / {zoneRadiusKM} km radius</p>
            </div>
            <button className="ops-btn" onClick={() => setMapFullscreen(false)} type="button">Close</button>
          </div>
          <div className="min-h-0 flex-1 p-3">
            <AirspaceMap
              tracks={tracks}
              restrictedZone={restrictedZone}
              history={history}
              selectedTargetId={selectedTargetId}
              onSelectTarget={setSelectedTargetId}
              zoneCenter={zoneCenter}
              zoneRadiusKM={zoneRadiusKM}
              zoneName={zoneName}
              onZoneCenterChange={setZoneCenter}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
