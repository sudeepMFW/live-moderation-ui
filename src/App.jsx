import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Activity,
  Shield,
  Clock,
  Search,
  RefreshCw,
  Play,
  Pause,
  AlertTriangle,
  CheckCircle,
  Copy,
  ExternalLink,
  Maximize2,
  Terminal,
  User,
  Layers,
  X,
  Database,
  Filter,
  Check,
  FileJson
} from 'lucide-react';
import './App.css';

// Configured list of MFW features (to ensure consistent order and display)
const FEATURE_KEYS = [
  "AgeGender", "Nudity",
  "AIGeneratedImage", "ProfilePicture", "ObsceneGesture", "CelebrityDetection",
  "Screenshot", "Watermark", "ScamsterDB", "ImageSearch"
];

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

function App() {
  // App state variables
  const [mode, setMode] = useState('live'); // 'live', 'query', 'find', 'findMod'
  const [timeAnchor, setTimeAnchor] = useState('system'); // 'system', 'db'
  const [webhookFilter, setWebhookFilter] = useState('true'); // 'true', 'false', 'all'
  const [queryStartTime, setQueryStartTime] = useState('');
  const [queryEndTime, setQueryEndTime] = useState('');
  const [userId, setUserId] = useState('');
  const [mediaId, setMediaId] = useState('');
  const [customId, setCustomId] = useState('');
  const [findMediaId, setFindMediaId] = useState('');
  const [findUserId, setFindUserId] = useState('');
  const [findCustomId, setFindCustomId] = useState('');
  const [findModMediaId, setFindModMediaId] = useState('');
  const [findModResult, setFindModResult] = useState(null);
  const [findModLoading, setFindModLoading] = useState(false);
  const [findModError, setFindModError] = useState(null);
  const [limit] = useState(50);

  // Auto-refresh properties
  const [autoRefreshInterval] = useState(5); // seconds
  const [countdownSeconds, setCountdownSeconds] = useState(5);
  const [isPaused, setIsPaused] = useState(false);
  const [referenceNow, setReferenceNow] = useState(null);

  // UI states
  const [expandAllJson, setExpandAllJson] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [expandedCards, setExpandedCards] = useState({});
  const [activeModalJson, setActiveModalJson] = useState(null);
  const [copiedText, setCopiedText] = useState('');
  const [status, setStatus] = useState({
    connected: false,
    database: 'DB1',
    collection: '935',
    countToday: 0,
    latestDocumentTime: null,
    systemTime: null
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Ref for timer
  const timerRef = useRef(null);

  // Initialize queryStartTime/queryEndTime with today's range
  useEffect(() => {
    const now = new Date();
    const offsetMs = now.getTimezoneOffset() * 60 * 1000;
    const endISO = new Date(now.getTime() - offsetMs).toISOString().slice(0, 16);
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const startISO = new Date(startOfDay.getTime() - offsetMs).toISOString().slice(0, 16);
    setQueryStartTime(startISO);
    setQueryEndTime(endISO);
  }, []);

  // Format date helpers
  const formatLocalTime = (dateObj) => {
    if (!dateObj) return '--:--:--';
    const d = new Date(dateObj);
    if (isNaN(d.getTime())) return '--:--:--';
    return d.toLocaleTimeString([], { hour12: false });
  };

  const formatDateFull = (dateObj) => {
    if (!dateObj) return 'N/A';
    const d = new Date(dateObj);
    if (isNaN(d.getTime())) return 'N/A';

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hour = String(d.getHours()).padStart(2, '0');
    const minute = String(d.getMinutes()).padStart(2, '0');
    const second = String(d.getSeconds()).padStart(2, '0');
    const ms = String(d.getMilliseconds()).padStart(3, '0');

    return `${year}-${month}-${day} ${hour}:${minute}:${second}.${ms}`;
  };

  const calculateDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return null;
    const start = new Date(startTime);
    const end = new Date(endTime);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
    return (end.getTime() - start.getTime()) / 1000;
  };

  // Model owners fetch
  const fetchModerator = useCallback(async (mid) => {
    if (!mid.trim()) { setFindModResult(null); return; }
    setFindModLoading(true);
    setFindModError(null);
    try {
      const url = new URL(`${API_BASE}/api/find-moderator`, window.location.origin);
      url.searchParams.append('mediaId', mid.trim());
      const res = await fetch(url);
      const data = await res.json();
      setFindModResult(data);
    } catch (err) {
      setFindModError(err.message);
    } finally {
      setFindModLoading(false);
    }
  }, []);

  // Fetch status and documents
  const fetchAllData = useCallback(async () => {
    if (mode === 'findMod') return;
    try {
      // 1. Fetch system status
      const statusRes = await fetch(`${API_BASE}/api/status`);
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setStatus({
          connected: statusData.connected,
          database: statusData.database || 'webhook_logs',
          collection: statusData.collection || '935',
          countToday: statusData.countToday || 0,
          latestDocumentTime: statusData.latestDocumentTime,
          systemTime: statusData.systemTime
        });
      } else {
        setStatus(prev => ({ ...prev, connected: false }));
      }

      // 2. Build Document Query
      const url = new URL(`${API_BASE}/api/documents`, window.location.origin);
      url.searchParams.append('mode', mode);
      url.searchParams.append('timeAnchor', timeAnchor);
      url.searchParams.append('webhookSent', webhookFilter);
      url.searchParams.append('limit', limit);

      if (mode === 'query') {
        if (queryStartTime) url.searchParams.append('queryStartTime', new Date(queryStartTime).toISOString());
        if (queryEndTime) url.searchParams.append('queryEndTime', new Date(queryEndTime).toISOString());
        if (userId.trim()) url.searchParams.append('userId', userId.trim());
        if (mediaId.trim()) url.searchParams.append('mediaId', mediaId.trim());
        if (customId.trim()) url.searchParams.append('customId', customId.trim());
      }

      if (mode === 'find') {
        if (findMediaId.trim()) url.searchParams.append('mediaId', findMediaId.trim());
        if (findUserId.trim()) url.searchParams.append('userId', findUserId.trim());
        if (findCustomId.trim()) url.searchParams.append('customId', findCustomId.trim());
      }

      const docsRes = await fetch(url);
      if (!docsRes.ok) throw new Error(`HTTP error ${docsRes.status}`);

      const docsData = await docsRes.json();
      setDocuments(docsData.documents || []);
      setReferenceNow(docsData.referenceNow);
      setError(null);
    } catch (err) {
      console.error("Fetch failed:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [mode, timeAnchor, webhookFilter, queryStartTime, queryEndTime, userId, mediaId, customId, findMediaId, findUserId, findCustomId, limit]);

  // Handle countdown tick
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    // Set timer interval
    timerRef.current = setInterval(() => {
      if (!isPaused) {
        setCountdownSeconds(prev => {
          if (prev <= 1) {
            fetchAllData();
            return autoRefreshInterval;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [isPaused, autoRefreshInterval, fetchAllData]);

  // Fetch immediately on config changes
  useEffect(() => {
    setLoading(true);
    fetchAllData();
    setCountdownSeconds(autoRefreshInterval);
  }, [mode, timeAnchor, webhookFilter, fetchAllData, autoRefreshInterval]);

  // Debounced fetch for text inputs
  useEffect(() => {
    if (mode !== 'query' && mode !== 'find') return;
    const delayDebounce = setTimeout(() => {
      fetchAllData();
      setCountdownSeconds(autoRefreshInterval);
    }, 600);
    return () => clearTimeout(delayDebounce);
  }, [userId, mediaId, customId, queryStartTime, queryEndTime, findMediaId, findUserId, findCustomId, mode, fetchAllData, autoRefreshInterval]);

  // Manual trigger
  const handleForceRefresh = () => {
    setCountdownSeconds(autoRefreshInterval);
    setLoading(true);
    fetchAllData();
  };

  // Toggle play/pause
  const handleTogglePlayPause = () => {
    setIsPaused(!isPaused);
  };

  // Toggle card JSON view
  const toggleCardJson = (id) => {
    setExpandedCards(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Copy to clipboard helper
  const handleCopyToClipboard = (text, type) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        setCopiedText(type);
        setTimeout(() => setCopiedText(''), 1500);
      }).catch(() => { });
    } else {
      // Fallback for non-HTTPS
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopiedText(type);
      setTimeout(() => setCopiedText(''), 1500);
    }
  };

  // Calculate statistics
  const totalDocs = documents.length;
  let violationRate = 0;
  let avgLatency = 0;

  if (totalDocs > 0) {
    let violationCount = 0;
    let totalLatency = 0;
    let latencyCount = 0;

    documents.forEach(doc => {
      const featureStatus = doc.mfwEvent?.processStatus?.featureStatus || {};
      const hasViolation = Object.values(featureStatus).some(val => val === true);
      if (hasViolation) violationCount++;

      const duration = calculateDuration(doc.mfwEvent?.eventStartTime, doc.mfwEvent?.eventEndTime);
      if (duration !== null) {
        totalLatency += duration;
        latencyCount++;
      }
    });

    violationRate = Math.round((violationCount / totalDocs) * 100);
    avgLatency = latencyCount > 0 ? (totalLatency / latencyCount).toFixed(2) : "0.00";
  }

  // Countdown circle calculations
  const circleRadius = 12;
  const circleCircumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circleCircumference * (1 - countdownSeconds / autoRefreshInterval);

  return (
    <div className="app-container">
      {/* Background glow effects */}
      <div className="glow-container">
        <div className="glow-orb glow-orb-1"></div>
        <div className="glow-orb glow-orb-2"></div>
      </div>

      {/* Sidebar Navigation & Controls */}
      <aside className="sidebar glass-panel">
        <div className="brand">
          <div className="brand-icon">
            <Shield className="shield-icon" />
          </div>
          <div>
            <h1>MFW Analysis Board</h1>
            <span className="sub-brand">Live Monitor (Col: {status.collection})</span>
          </div>
        </div>

        {/* Status Widget */}
        <div className={`status-card glass-panel-inner ${status.connected ? 'status-online' : 'status-offline'}`}>
          <div className="status-indicator">
            <div className={`status-dot ${status.connected ? 'connected' : 'error'} pulsing`}></div>
            <span>{status.connected ? 'Live Pipeline Connected' : 'Pipeline Offline'}</span>
          </div>
          <div className="status-detail">
            <div>DB: <span>{status.database}</span></div>
            <div>Collection: <span>{status.collection}</span></div>
            <div>Today: <span>{status.countToday}</span> docs</div>
          </div>
        </div>

        {/* Modes Section */}
        <div className="control-group">
          <h3>Monitoring Mode</h3>
          <div className="tabs">
            <button
              className={`tab-btn ${mode === 'live' ? 'active' : ''}`}
              onClick={() => setMode('live')}
            >
              <span className="tab-icon live-icon">●</span>
              <div className="tab-label">
                <span className="tab-title">Live Mode</span>
                <span className="tab-desc">1m window, 1m lag</span>
              </div>
            </button>

            <button
              className={`tab-btn ${mode === 'query' ? 'active' : ''}`}
              onClick={() => setMode('query')}
            >
              <span className="tab-icon">🔍</span>
              <div className="tab-label">
                <span className="tab-title">Custom Query</span>
                <span className="tab-desc">Start &amp; End date range</span>
              </div>
            </button>

            <button
              className={`tab-btn ${mode === 'find' ? 'active' : ''}`}
              onClick={() => setMode('find')}
            >
              <span className="tab-icon">🗂️</span>
              <div className="tab-label">
                <span className="tab-title">Find Document</span>
                <span className="tab-desc">Search by ID fields</span>
              </div>
            </button>

            <button
              className={`tab-btn ${mode === 'findMod' ? 'active' : ''}`}
              onClick={() => setMode('findMod')}
            >
              <span className="tab-icon">👤</span>
              <div className="tab-label">
                <span className="tab-title">Model owners</span>
                <span className="tab-desc">Lookup model owners</span>
              </div>
            </button>
          </div>
        </div>

        {/* Time Anchor Toggles */}
        <div className="control-group">
          <h3>Time Anchor Reference</h3>
          <div className="toggle-group">
            <button
              className={`toggle-btn ${timeAnchor === 'system' ? 'active' : ''}`}
              onClick={() => setTimeAnchor('system')}
            >
              System Clock
            </button>
            <button
              className={`toggle-btn ${timeAnchor === 'db' ? 'active' : ''}`}
              onClick={() => setTimeAnchor('db')}
            >
              DB Latest Doc
            </button>
          </div>
          <p className="help-text">
            "DB Latest Doc" locks "now" reference to the latest transaction in MongoDB. Excellent for review and local testing!
          </p>
        </div>

        {/* Custom Query Options – explicit start/end date range */}
        {mode === 'query' && (
          <div className="control-group animate-slide-in">
            <h3 className="section-title-divider">Date Range</h3>

            <div className="input-field">
              <label>Start Date &amp; Time</label>
              <input
                type="datetime-local"
                value={queryStartTime}
                onChange={(e) => setQueryStartTime(e.target.value)}
              />
            </div>

            <div className="input-field">
              <label>End Date &amp; Time</label>
              <input
                type="datetime-local"
                value={queryEndTime}
                onChange={(e) => setQueryEndTime(e.target.value)}
              />
            </div>

            <div className="divider"></div>
            <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.075em', marginBottom: '12px' }}>Optional ID Filters</h3>

            <div className="input-field">
              <label>Media ID</label>
              <input
                type="text"
                placeholder="e.g. V7436264329..."
                value={mediaId}
                onChange={(e) => setMediaId(e.target.value)}
              />
            </div>

            <div className="input-field">
              <label>User ID</label>
              <input
                type="text"
                placeholder="e.g. 935"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
              />
            </div>

            <div className="input-field">
              <label>Custom Client UUID</label>
              <input
                type="text"
                placeholder="e.g. d1db57f5..."
                value={customId}
                onChange={(e) => setCustomId(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Find Document – ID-only search, no time window */}
        {mode === 'find' && (
          <div className="control-group animate-slide-in">
            <h3 className="section-title-divider">Find by ID</h3>
            <p className="help-text" style={{ marginBottom: '12px' }}>Search the entire collection by any combination of IDs. No time window is applied.</p>

            <div className="input-field">
              <label>Media ID</label>
              <input
                type="text"
                placeholder="e.g. V7436264329..."
                value={findMediaId}
                onChange={(e) => setFindMediaId(e.target.value)}
              />
            </div>

            <div className="input-field">
              <label>User ID</label>
              <input
                type="text"
                placeholder="e.g. 935"
                value={findUserId}
                onChange={(e) => setFindUserId(e.target.value)}
              />
            </div>

            <div className="input-field">
              <label>Custom Client UUID</label>
              <input
                type="text"
                placeholder="e.g. d1db57f5..."
                value={findCustomId}
                onChange={(e) => setFindCustomId(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Model owners – lookup moderation/batch by mediaId */}
        {mode === 'findMod' && (
          <div className="control-group animate-slide-in">
            <h3 className="section-title-divider">Model owners</h3>
            <p className="help-text" style={{ marginBottom: '12px' }}>Enter a Media ID to find the assigned model owners</p>
            <div className="input-field">
              <label>Media ID</label>
              <input
                type="text"
                placeholder="e.g. V694229566326829..."
                value={findModMediaId}
                onChange={(e) => { setFindModMediaId(e.target.value); setFindModResult(null); }}
              />
            </div>
            <button
              className="primary-btn"
              style={{ width: '100%', marginTop: '8px' }}
              onClick={() => fetchModerator(findModMediaId)}
              disabled={findModLoading || !findModMediaId.trim()}
            >
              {findModLoading ? 'Searching...' : 'Search Moderator'}
            </button>
          </div>
        )}

        {/* Webhook Filter dropdown */}
        <div className="control-group">
          <h3>Webhook Filter</h3>
          <div className="select-wrapper">
            <select value={webhookFilter} onChange={(e) => setWebhookFilter(e.target.value)}>
              <option value="true">Webhook Sent Only (true)</option>
              <option value="false">Webhook Not Sent (false)</option>
              <option value="all">Show All Documents</option>
            </select>
          </div>
        </div>

        {/* Refresh controls footer */}
        <div className="sidebar-footer">
          <div className="refresh-status">
            <div className="refresh-countdown-container">
              <svg className="progress-ring" width="30" height="30">
                <circle
                  className="progress-ring__circle-bg"
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth="3"
                  fill="transparent"
                  r={circleRadius}
                  cx="15"
                  cy="15"
                />
                <circle
                  className="progress-ring__circle"
                  stroke="var(--accent-primary)"
                  strokeWidth="3"
                  fill="transparent"
                  r={circleRadius}
                  cx="15"
                  cy="15"
                  style={{
                    strokeDasharray: `${circleCircumference} ${circleCircumference}`,
                    strokeDashoffset: strokeDashoffset
                  }}
                />
              </svg>
              <span className="countdown-text">{countdownSeconds}s</span>
            </div>

            <button
              className="icon-btn"
              onClick={handleForceRefresh}
              title="Force Refresh"
              disabled={loading}
            >
              <RefreshCw className={loading ? 'spinning' : ''} size={16} />
            </button>

            <button
              className="icon-btn"
              onClick={handleTogglePlayPause}
              title={isPaused ? "Resume Auto-Refresh" : "Pause Auto-Refresh"}
            >
              {isPaused ? <Play size={16} /> : <Pause size={16} />}
            </button>
          </div>

          <div className="ref-clock">
            <div>Reference Now:</div>
            <div className="clock-time">{formatLocalTime(referenceNow)}</div>
          </div>
        </div>
      </aside>

      {/* Main Panel Content */}
      <main className="main-content">
        {/* Header Stats */}
        <header className="main-header glass-panel">
          <div className="header-info">
            <h2>
              {mode === 'live' && 'Live Feed (Real-Time)'}
              {mode === 'query' && 'Custom Date Range Query'}
              {mode === 'find' && 'Find Document'}
              {mode === 'findMod' && 'Model owners'}
            </h2>
            <p>
              {mode === 'live' && 'Displaying documents processed between [now − 2m] and [now − 1m].'}
              {mode === 'query' && `Showing records from ${queryStartTime || '…'} to ${queryEndTime || '…'}.`}
              {mode === 'find' && 'ID-only search across the full collection — no time filter applied.'}
              {mode === 'findMod' && 'Lookup the assigned model owners'}
            </p>
          </div>

          <div className="header-stats">
            <div className="header-stat-box">
              <div className="stat-value">{totalDocs}</div>
              <div className="stat-label">Matching Docs</div>
            </div>
            <div className="header-stat-box">
              <div className="stat-value">{violationRate}%</div>
              <div className="stat-label">Violation Rate</div>
            </div>
            <div className="header-stat-box">
              <div className="stat-value">{avgLatency}s</div>
              <div className="stat-label">Avg Process Latency</div>
            </div>
          </div>
        </header>

        {/* Documents Feed */}
        <section className="feed-section">
          <div className="feed-header">
            <h3>
              Document Feed <span className="badge">{totalDocs}</span>
            </h3>
            <div className="feed-actions">
              <label className="compact-toggle">
                <input
                  type="checkbox"
                  checked={expandAllJson}
                  onChange={(e) => setExpandAllJson(e.target.checked)}
                />
                <span>Expand JSON Details</span>
              </label>
            </div>
          </div>

          {/* Loader */}
          {loading && documents.length === 0 && (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Connecting to database pipeline...</p>
            </div>
          )}

          {/* Query Fail / Error State */}
          {error && (
            <div className="empty-state card-error animate-fade-in">
              <AlertTriangle className="empty-icon error-color" />
              <h4>Pipeline Query Failed</h4>
              <p>{error}</p>
              <button className="primary-btn" onClick={handleForceRefresh}>Retry Connection</button>
            </div>
          )}

          {/* Empty State Banner */}
          {!loading && !error && totalDocs === 0 && (
            <div className="alert-banner animate-fade-in">
              <div className="alert-icon">💡</div>
              <div className="alert-content">
                <h4>No Documents Found</h4>
                <p>
                  {mode === 'live' && (
                    <span>
                      No documents processed in the 1-minute window [now − 2m to now − 1m].
                      Toggle <strong>"DB Latest Doc"</strong> in the sidebar to use the last available record as the reference point.
                    </span>
                  )}
                  {mode === 'lag' && (
                    <span>
                      No documents in the 5-minute window [now − 7m to now − 2m].
                      Try <strong>"DB Latest Doc"</strong> anchor or switch to <strong>Custom Query</strong> with a wider range.
                    </span>
                  )}
                  {mode === 'query' && (
                    <span>
                      No documents found in the selected date range. Try widening the start/end times or removing optional ID filters.
                    </span>
                  )}
                  {mode === 'find' && (
                    <span>
                      No document matched those IDs. Double-check the Media ID, User ID, or Client UUID and try again.
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Model owners Result Panel */}
          {mode === 'findMod' && (
            <div style={{ padding: '0 0 24px 0' }}>
              {findModError && (
                <div className="empty-state card-error animate-fade-in">
                  <AlertTriangle className="empty-icon error-color" />
                  <h4>Lookup Failed</h4><p>{findModError}</p>
                </div>
              )}
              {findModResult && !findModResult.found && (
                <div className="alert-banner animate-fade-in">
                  <div className="alert-icon">🔍</div>
                  <div className="alert-content"><h4>No batch found</h4><p>No batch document matched media ID: <strong>{findModMediaId}</strong></p></div>
                </div>
              )}
              {findModResult && findModResult.found && (
                <div className="doc-card animate-fade-in" style={{ border: '1px solid var(--accent-primary)', boxShadow: '0 0 24px rgba(99,102,241,0.2)' }}>
                  <div className="doc-card-main" style={{ flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <div style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', borderRadius: '12px', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <User size={22} style={{ color: '#fff' }} />
                        <div>
                          <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Assigned Moderator</div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>{findModResult.assignedModerator || 'Unassigned'}</div>
                        </div>
                      </div>
                      <div className={`latency-badge ${findModResult.batchStatus === 'COMPLETE' ? '' : 'latency-high'}`} style={{ fontSize: '0.85rem', padding: '6px 14px' }}>
                        {findModResult.batchStatus}
                      </div>
                    </div>
                    <div className="doc-ids">
                      <div className="doc-id-row"><span className="id-label">BATCH ID</span><span className="id-value">{findModResult.batchId}</span></div>
                      <div className="doc-id-row"><span className="id-label">ORG ID</span><span className="id-value">{findModResult.orgId || 'N/A'}</span></div>
                      <div className="doc-id-row"><span className="id-label">MEDIA TYPE</span><span className="id-value">{findModResult.mediaType || 'N/A'}</span></div>
                      <div className="doc-id-row"><span className="id-label">EVENTS IN BATCH</span><span className="id-value">{findModResult.eventCount}</span></div>
                      <div className="doc-id-row"><span className="id-label">COMPLETE TIME</span><span className="id-value">{findModResult.completeTime != null ? `${findModResult.completeTime}s` : 'N/A'}</span></div>
                      <div className="doc-id-row"><span className="id-label">RETRY COUNT</span><span className="id-value">{findModResult.retryCount ?? 'N/A'}</span></div>
                    </div>
                    <div className="doc-times">
                      <div className="time-box"><span>BATCH START</span><strong>{formatDateFull(findModResult.batchStartTime)}</strong></div>
                      <div className="time-box"><span>BATCH END</span><strong>{formatDateFull(findModResult.batchEndTime)}</strong></div>
                    </div>
                  </div>
                </div>
              )}
              {!findModResult && !findModLoading && !findModError && (
                <div className="alert-banner"><div className="alert-icon">👤</div><div className="alert-content"><h4>Enter a Media ID above</h4><p>Type a Media ID and click Search Moderator to look up the assigned model owners.</p></div></div>
              )}
            </div>
          )}

          {/* Feed Content */}
          {mode !== 'findMod' && <div className="feed-container">
            {documents.map(doc => {
              const docId = doc._id || 'N/A';
              const mfw = doc.mfwEvent || {};
              const uId = mfw.userId || 'N/A';
              const oId = mfw.orgId || 'N/A';
              const cId = mfw.customId || 'N/A';

              const rawMediaUrl = mfw.media?.inputMediaURL || mfw.media?.inputMediaUrl || '';
              const mediaType = mfw.media?.type || 'IMAGE';

              const startTimeStr = formatDateFull(mfw.eventStartTime);
              const endTimeStr = formatDateFull(mfw.eventEndTime);
              const latency = calculateDuration(mfw.eventStartTime, mfw.eventEndTime);
              const latencyDisplay = latency !== null ? `${latency.toFixed(2)}s` : 'Pending/N/A';

              const featureStatus = mfw.processStatus?.featureStatus || {};
              const errorStatus = mfw.processStatus?.errorStatus || {};
              const isExpanded = expandAllJson || !!expandedCards[docId];
              const prettyJson = JSON.stringify(doc, null, 2);

              return (
                <article key={docId} className="doc-card" id={`card-${docId}`}>
                  <div className="doc-card-main">
                    {/* Media Preview Box */}
                    <div className="media-container">
                      {rawMediaUrl ? (
                        <img
                          className="media-preview"
                          src={rawMediaUrl}
                          alt="Moderation Resource"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div
                        className="media-placeholder"
                        style={{ display: rawMediaUrl ? 'none' : 'flex' }}
                      >
                        <Layers size={32} />
                        <span>{mediaType}</span>
                      </div>
                      <div className="media-type-badge">{mediaType.toLowerCase()}</div>
                    </div>

                    {/* Metadata Box */}
                    <div className="doc-info">
                      <div className="doc-info-header">
                        <div className="doc-ids">
                          <div className="doc-id-row">
                            <span className="id-label">MEDIA ID</span>
                            <span className="id-value" title={docId}>{docId}</span>
                            <button
                              className="copy-btn-inline"
                              onClick={() => handleCopyToClipboard(docId, `media-${docId}`)}
                              title="Copy Media ID"
                            >
                              {copiedText === `media-${docId}` ? <Check size={10} className="success-color" /> : <Copy size={10} />}
                            </button>
                          </div>
                          <div className="doc-id-row">
                            <span className="id-label">USER ID</span>
                            <span className="id-value">{uId}</span>
                          </div>
                          <div className="doc-id-row">
                            <span className="id-label">ORG ID</span>
                            <span className="id-value">{oId}</span>
                          </div>
                          <div className="doc-id-row">
                            <span className="id-label">CLIENT ID</span>
                            <span className="id-value" title={cId}>{cId}</span>
                          </div>
                        </div>
                        <div className={`latency-badge ${latency && latency > 2.0 ? 'latency-high' : ''}`}>
                          Latency: {latencyDisplay}
                        </div>
                      </div>

                      <div className="doc-times">
                        <div className="time-box">
                          <span>START TIME</span>
                          <strong>{startTimeStr}</strong>
                        </div>
                        <div className="time-box">
                          <span>END TIME</span>
                          <strong>{endTimeStr}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Feature Badge Grid */}
                    <div className="features-container">
                      <div className="features-grid">
                        {FEATURE_KEYS.map(key => {
                          let statusClass = 'status-error';
                          let statusText = 'N/A';

                          if (key in featureStatus) {
                            const val = featureStatus[key];
                            // Rule: false = clean (green), true = violation (red)
                            if (val === true) {
                              statusClass = 'status-false';
                              statusText = 'True';
                            } else {
                              statusClass = 'status-true';
                              statusText = 'False';
                            }
                          } else if (key in errorStatus) {
                            statusClass = 'status-error';
                            statusText = 'Error';
                          }

                          return (
                            <div
                              key={key}
                              className={`feature-badge ${statusClass}`}
                              title={`${key}: ${statusText}`}
                            >
                              <span className="feature-name">{key}</span>
                              <span className="feature-dot"></span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Card Footer Operations */}
                  <div className="doc-card-footer">
                    <div className="footer-meta">
                      Webhook Status: <span className={mfw.processStatus?.webhookSent ? 'meta-active' : 'meta-inactive'}>
                        {mfw.processStatus?.webhookSent ? 'SENT' : 'NOT SENT'}
                      </span> | Complete: <span className={mfw.processStatus?.complete ? 'meta-active' : 'meta-inactive'}>
                        {mfw.processStatus?.complete ? 'YES' : 'NO'}
                      </span>
                    </div>
                    <div className="footer-actions">
                      <button className="text-btn" onClick={() => toggleCardJson(docId)}>
                        <Terminal size={12} />
                        <span>Toggle JSON</span>
                      </button>
                      <button className="text-btn" onClick={() => setActiveModalJson(prettyJson)}>
                        <Maximize2 size={12} />
                        <span>Maximize JSON</span>
                      </button>
                    </div>
                  </div>

                  {/* Expandable JSON Drawer */}
                  {isExpanded && (
                    <div className="doc-card-json expanded animate-slide-down">
                      <div className="json-header">
                        <span>MongoDB Document</span>
                        <button
                          className="copy-btn"
                          onClick={() => handleCopyToClipboard(prettyJson, `json-${docId}`)}
                        >
                          {copiedText === `json-${docId}` ? 'Copied Object!' : 'Copy Full Object'}
                        </button>
                      </div>
                      <pre className="json-pre"><code>{prettyJson}</code></pre>
                    </div>
                  )}
                </article>
              );
            })}
          </div>}
        </section>
      </main>

      {/* Maximize JSON Modal */}
      {activeModalJson && (
        <div className="modal animate-fade-in" onClick={() => setActiveModalJson(null)}>
          <div className="modal-content glass-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-area">
                <FileJson size={18} className="modal-title-icon" />
                <h3>Document Raw JSON</h3>
              </div>
              <button className="close-btn" onClick={() => setActiveModalJson(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <pre><code className="language-json">{activeModalJson}</code></pre>
            </div>
            <div className="modal-footer">
              <button
                className="primary-btn"
                onClick={() => handleCopyToClipboard(activeModalJson, 'modal-copy')}
              >
                {copiedText === 'modal-copy' ? 'Copied Successfully!' : 'Copy Content'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
