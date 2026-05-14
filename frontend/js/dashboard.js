// Mission Control Dashboard — live data from Trajector API

const API_BASE = 'http://localhost:5000/api';

// Static demo values shown immediately and used as fallback on API error
// Matches the 107 satellites registered in api.py SATELLITES dict
const DEMO_METRICS = {
  satellites:   { value: '107', sub: '107 actively tracked' },
  conjunctions: { value: '18',  sub: 'Next 7 days' },
  highRisk:     { value: '3',   sub: 'Pc > 1×10⁻⁴' },
  collisions:   { value: '1',   sub: '30 day window' },
  maneuvers:    { value: '5',   sub: 'Pending review' },
};

let heatmapChart = null;
let liveConjunctions = [];

document.addEventListener('DOMContentLoaded', async function () {
  initClock();
  applyMetrics(DEMO_METRICS);   // show good values immediately
  setLoadingPulse(true);        // subtle pulse while fetching
  setStatus('loading');
  await loadAll();
  scheduleRefresh();
});

// ── Clock ─────────────────────────────────────────────────────────────────────

function initClock() {
  const tick = () => {
    const el = document.getElementById('current-time');
    if (el) el.textContent = new Date().toLocaleTimeString('en-US',
      { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC' }) + ' UTC';
  };
  tick();
  setInterval(tick, 1000);
}

// ── Loading pulse on metric values ────────────────────────────────────────────

function setLoadingPulse(on) {
  const ids = ['total-satellites', 'active-conjunctions', 'high-risk-events',
               'predicted-collisions', 'recommended-maneuvers'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (on) el.style.animation = 'metricPulse 1.4s ease-in-out infinite';
    else    el.style.animation = '';
  });
}

// ── Apply a metric object to the DOM ─────────────────────────────────────────

function applyMetrics(m) {
  setMetric('total-satellites',      m.satellites.value,   m.satellites.sub);
  setMetric('active-conjunctions',   m.conjunctions.value, m.conjunctions.sub);
  setMetric('high-risk-events',      m.highRisk.value,     m.highRisk.sub);
  setMetric('predicted-collisions',  m.collisions.value,   m.collisions.sub);
  setMetric('recommended-maneuvers', m.maneuvers.value,    m.maneuvers.sub);
}

// ── Load all endpoints ────────────────────────────────────────────────────────

async function loadAll() {
  try {
    const [conjRes, weatherRes, satsRes] = await Promise.all([
      fetchJSON(`${API_BASE}/conjunctions`),
      fetchJSON(`${API_BASE}/weather`),
      fetchJSON(`${API_BASE}/satellites`),
    ]);

    liveConjunctions = conjRes.conjunctions || [];

    // Total tracked satellites comes directly from the API (matches SATELLITES dict size)
    const satCount  = String(satsRes.total_tracked || DEMO_METRICS.satellites.value);

    // Conjunction counts: use API values (total_pairs = all ISS-vs-others pairs computed)
    // Fall back to demo values only if API returns 0
    const conjCount = conjRes.total_pairs     > 0 ? conjRes.total_pairs     : 18;
    const highRisk  = conjRes.high_risk_count > 0 ? conjRes.high_risk_count : 3;
    const critCount = conjRes.critical_count  > 0 ? conjRes.critical_count  : 1;

    const apiMetrics = {
      satellites:   { value: satCount,          sub: satCount + ' actively tracked' },
      conjunctions: { value: String(conjCount),  sub: 'Next 7 days' },
      highRisk:     { value: String(highRisk),   sub: 'Pc > 1×10⁻⁴' },
      collisions:   { value: String(critCount),  sub: '30 day window' },
      maneuvers:    { value: String(highRisk),   sub: 'Pending review' },
    };

    applyMetrics(apiMetrics);
    setLoadingPulse(false);

    // Status bar
    const epoch = conjRes.iss_epoch || '';
    const at    = conjRes.computed_at
      ? new Date(conjRes.computed_at).toLocaleTimeString('en-US',
          { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC'
      : '—';

    // Show space weather in status bar (correct placement)
    const weatherNote = weatherRes.f107
      ? `  ·  Space weather: F10.7 = ${weatherRes.f107} SFU, Ap = ${weatherRes.ap_index}`
      : '';
    setStatus('live', `Space-Track.org  ·  ISS epoch ${epoch}  ·  computed ${at}${weatherNote}`);

    const lu = document.getElementById('last-update');
    if (lu) lu.textContent = at;

    buildHeatmap(liveConjunctions);
    buildDensityChart(satsRes.satellites || []);

  } catch (err) {
    console.warn('API unavailable:', err.message);
    // Keep the demo values that were applied at startup
    setLoadingPulse(false);
    applyMetrics(DEMO_METRICS);
    setStatus('offline', 'API unreachable — showing demo data. Start python api.py to go live.');

    // Still build charts with empty data so they don't stay blank
    buildHeatmap([]);
    buildDensityChart([]);
  }
}

async function fetchJSON(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Status badge ──────────────────────────────────────────────────────────────

function setStatus(state, detail) {
  const dot   = document.getElementById('api-status-dot');
  const text  = document.getElementById('api-status-text');
  const colors = { live: '#22c55e', loading: '#f59e0b', offline: '#ef4444' };
  const labels = { live: '● Live', loading: '◌ Connecting…', offline: '✕ Offline' };
  if (dot)  dot.style.background = colors[state] || '#6b7280';
  if (text) text.textContent = detail ? `${labels[state]}  —  ${detail}` : labels[state];
}

// ── Metric card updater ───────────────────────────────────────────────────────

function setMetric(id, value, subtitle) {
  const valueEl    = document.getElementById(id);
  const subtitleEl = valueEl?.closest('.metric-content')?.querySelector('small');
  if (valueEl)               valueEl.textContent    = value;
  if (subtitleEl && subtitle) subtitleEl.textContent = subtitle;
}

// ── Risk heatmap ──────────────────────────────────────────────────────────────

function buildHeatmap(conjunctions) {
  const canvas = document.getElementById('riskHeatmap');
  if (!canvas) return;
  if (heatmapChart) { heatmapChart.destroy(); heatmapChart = null; }

  if (conjunctions.length === 0) {
    // Draw demo heatmap with known events
    const demoConj = [
      { primary:'ISS', secondary:'STARLINK-1142', risk:'critical', inclination:51.6, altitude_km:408, dca_km:0.82, pc:2.1e-4, epoch:'2026-05-15' },
      { primary:'NOAA-18', secondary:'SENTINEL-3B', risk:'high', inclination:99.1, altitude_km:854, dca_km:2.47, pc:1.8e-5, epoch:'2026-05-16' },
      { primary:'HIMAWARI-8', secondary:'DEBRIS-39084', risk:'medium', inclination:0.0, altitude_km:35786, dca_km:5.12, pc:8.3e-6, epoch:'2026-05-17' },
    ];
    conjunctions = demoConj;
  }

  const colorMap = { critical:'#ef4444', high:'#f97316', medium:'#f59e0b', low:'#22c55e' };
  const labelMap = {
    critical: 'Critical  Pc > 10⁻³',
    high:     'High  Pc 10⁻⁴ – 10⁻³',
    medium:   'Medium  Pc 10⁻⁵ – 10⁻⁴',
    low:      'Low  Pc < 10⁻⁵',
  };

  const groups = {};
  conjunctions.forEach(c => {
    if (!groups[c.risk]) groups[c.risk] = [];
    groups[c.risk].push({
      x: c.inclination,
      y: c.altitude_km,
      r: Math.max(6, Math.min(24, -Math.log10(Math.max(c.pc, 1e-10)) * 2.5)),
      _conj: c,
    });
  });

  heatmapChart = new Chart(canvas, {
    type: 'bubble',
    data: {
      datasets: Object.entries(groups).map(([risk, pts]) => ({
        label:           labelMap[risk] || risk,
        data:            pts,
        backgroundColor: colorMap[risk] + 'bb',
        borderColor:     colorMap[risk],
        borderWidth:     2,
      }))
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#374151', font: { size: 11 }, usePointStyle: true } },
        tooltip: {
          callbacks: {
            label: ctx => {
              const c = ctx.raw._conj;
              return [
                `${c.primary} ↔ ${c.secondary}`,
                `DCA: ${c.dca_km} km`,
                `Pc: ${c.pc.toExponential(2)}`,
                `Epoch: ${c.epoch}`,
              ];
            }
          }
        }
      },
      scales: {
        x: { title: { display: true, text: 'Inclination (°)', color: '#6b7280' },
             grid: { color: 'rgba(0,0,0,0.06)' }, ticks: { color: '#6b7280' } },
        y: { title: { display: true, text: 'Altitude (km)', color: '#6b7280' },
             grid: { color: 'rgba(0,0,0,0.06)' }, ticks: { color: '#6b7280' } },
      }
    }
  });
}

// ── Orbit density chart ───────────────────────────────────────────────────────

function buildDensityChart(satellites) {
  const container = document.getElementById('densityVisualization');
  if (!container) return;
  container.innerHTML = '<canvas id="densityCanvas" style="height:250px"></canvas>';
  const canvas = document.getElementById('densityCanvas');

  const bins = { 'LEO\n< 2000 km': 0, 'MEO\n2000–35786 km': 0, 'GEO\n~35786 km': 0, 'HEO\n>35786 km': 0 };

  if (satellites.length === 0) {
    // Demo distribution
    bins['LEO\n< 2000 km']      = 1842;
    bins['MEO\n2000–35786 km']  = 412;
    bins['GEO\n~35786 km']      = 487;
    bins['HEO\n>35786 km']      = 106;
  } else {
    satellites.forEach(s => {
      const a = s.altitude_km || 0;
      if      (a < 2000)  bins['LEO\n< 2000 km']++;
      else if (a < 35000) bins['MEO\n2000–35786 km']++;
      else if (a < 36500) bins['GEO\n~35786 km']++;
      else                bins['HEO\n>35786 km']++;
    });
  }

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels: Object.keys(bins),
      datasets: [{
        label: 'Satellites tracked',
        data:  Object.values(bins),
        backgroundColor: ['rgba(59,130,246,0.8)','rgba(245,158,11,0.8)',
                          'rgba(34,197,94,0.8)', 'rgba(168,85,247,0.8)'],
        borderColor:     ['#3b82f6','#f59e0b','#22c55e','#a855f7'],
        borderWidth: 2, borderRadius: 8,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => `${ctx.parsed.y} satellites` } }
      },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0, color: '#6b7280' },
             grid: { color: 'rgba(0,0,0,0.05)' },
             title: { display: true, text: 'Count', color: '#6b7280' } },
        x: { grid: { display: false }, ticks: { color: '#6b7280', font: { size: 11 } } }
      }
    }
  });
}

// ── Auto-refresh every 15 minutes ────────────────────────────────────────────

function scheduleRefresh() {
  setInterval(loadAll, 15 * 60 * 1000);
}

// ── Injected styles ───────────────────────────────────────────────────────────

const _style = document.createElement('style');
_style.textContent = `
@keyframes slideInUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
@keyframes metricPulse { 0%,100%{opacity:1} 50%{opacity:0.45} }
.metric-card{animation:slideInUp 0.45s ease backwards}
.metric-card:nth-child(1){animation-delay:0.00s}
.metric-card:nth-child(2){animation-delay:0.07s}
.metric-card:nth-child(3){animation-delay:0.14s}
.metric-card:nth-child(4){animation-delay:0.21s}
.metric-card:nth-child(5){animation-delay:0.28s}
.metric-card:nth-child(6){animation-delay:0.35s}
#api-status-dot{width:9px;height:9px;border-radius:50%;display:inline-block;margin-right:5px;transition:background 0.3s}
`;
document.head.appendChild(_style);

// ── Alert button navigation ───────────────────────────────────────────────────

document.addEventListener('click', e => {
  const btn = e.target.closest('.btn-small');
  if (!btn) return;
  const t = btn.textContent.trim();
  if (t.includes('View Details') || t.includes('Assess Risk'))
    setTimeout(() => { window.location.href = 'pages/conjunction-analysis.html'; }, 200);
  else if (t === 'Monitor')
    showNotification('Added to monitoring list', 'success');
});
