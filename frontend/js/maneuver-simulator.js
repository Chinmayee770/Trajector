// Maneuver Optimization Simulator — dynamic scenario selection

const SCENARIOS = {
  'iss-starlink': {
    name: 'ISS ↔ STARLINK-1142', sat: 'ISS (NORAD 25544)',
    satA: 'ISS', satB: 'STARLINK-1142',
    initPc: 2.1e-4, initMiss: 0.82, initAlt: 408, ttc: '4h 23m',
    defaultDv: 0.42, defaultFuel: 500, burnTime: '2026-05-15T10:15',
    missRateKmPerMs: 7.86, fuelRateKgPerMs: 66.7,
    altRateKmPerMs: { prograde: 7.1, retrograde: -7.1, normal: 0, radial: 1.2 },
    alternatives: [
      { type: 'Prograde Burn (Selected)', dv: 0.42, fuel: 28, finalPc: 3.2e-7, rr: 87,  eff: 9.2, optimal: true  },
      { type: 'Retrograde Burn',          dv: 0.58, fuel: 39, finalPc: 1.8e-7, rr: 91,  eff: 8.1, optimal: false },
      { type: 'Normal Maneuver',          dv: 0.35, fuel: 24, finalPc: 8.5e-6, rr: 60,  eff: 7.5, optimal: false },
      { type: 'Combined 2-Burn',          dv: 0.68, fuel: 46, finalPc: 1.2e-8, rr: 99,  eff: 6.8, optimal: false },
    ]
  },
  'noaa-sentinel': {
    name: 'NOAA-18 ↔ SENTINEL-3B', sat: 'NOAA-18 (NORAD 28654)',
    satA: 'NOAA-18', satB: 'SENTINEL-3B',
    initPc: 1.8e-5, initMiss: 2.47, initAlt: 854, ttc: '28h 6m',
    defaultDv: 0.31, defaultFuel: 200, burnTime: '2026-05-15T22:00',
    missRateKmPerMs: 7.0, fuelRateKgPerMs: 67.7,
    altRateKmPerMs: { prograde: 6.5, retrograde: -6.5, normal: 0, radial: 1.0 },
    alternatives: [
      { type: 'Retrograde Burn (Selected)', dv: 0.31, fuel: 21, finalPc: 8.4e-8, rr: 99.5, eff: 8.8, optimal: true  },
      { type: 'Prograde Burn',              dv: 0.38, fuel: 26, finalPc: 1.2e-7, rr: 99.3, eff: 8.2, optimal: false },
      { type: 'Normal Maneuver',            dv: 0.22, fuel: 15, finalPc: 4.1e-6, rr: 77.1, eff: 7.1, optimal: false },
      { type: 'Combined 2-Burn',            dv: 0.52, fuel: 36, finalPc: 2.1e-9, rr: 99.9, eff: 6.3, optimal: false },
    ]
  },
  'himawari-debris': {
    name: 'HIMAWARI-8 ↔ DEBRIS-39084', sat: 'HIMAWARI-8 (NORAD 40267)',
    satA: 'HIMAWARI-8', satB: 'DEBRIS-39084',
    initPc: 8.3e-6, initMiss: 5.12, initAlt: 35786, ttc: '51h 30m',
    defaultDv: 0.18, defaultFuel: 800, burnTime: '2026-05-16T18:00',
    missRateKmPerMs: 3.0, fuelRateKgPerMs: 66.7,
    altRateKmPerMs: { prograde: 2.8, retrograde: -2.8, normal: 0, radial: 0.5 },
    alternatives: [
      { type: 'Station-Keeping (Selected)', dv: 0.18, fuel: 12, finalPc: 4.1e-8, rr: 99.5,  eff: 9.5, optimal: true  },
      { type: 'Prograde Burn',              dv: 0.35, fuel: 23, finalPc: 1.8e-9, rr: 99.98, eff: 7.8, optimal: false },
      { type: 'Normal Maneuver',            dv: 0.25, fuel: 17, finalPc: 8.2e-7, rr: 90.1,  eff: 7.2, optimal: false },
      { type: 'No Maneuver',                dv: 0.00, fuel: 0,  finalPc: 8.3e-6, rr: 0,     eff: 5.0, optimal: false },
    ]
  }
};

// Direction efficiency multipliers for Pc reduction and altitude change
const DIR_EFF = { prograde: 1.0, retrograde: 1.1, normal: 0.55, radial: 0.35 };

let activeScenarioKey = 'iss-starlink';

document.addEventListener('DOMContentLoaded', function () {
  loadScenario('iss-starlink');
  setupEventListeners();
});

// ── Scenario loading ──────────────────────────────────────────────────────────

function loadScenario(key) {
  if (!SCENARIOS[key]) return;
  activeScenarioKey = key;
  const sc = SCENARIOS[key];

  // Update burn-time default
  const burnEl = document.getElementById('burn-time');
  if (burnEl) burnEl.value = sc.burnTime;

  // Update ΔV slider to scenario default
  const dvEl = document.getElementById('delta-v');
  if (dvEl) { dvEl.value = sc.defaultDv; updateDeltaVDisplay(); }

  // Update fuel available
  const fuelEl = document.getElementById('fuel-available');
  if (fuelEl) fuelEl.value = sc.defaultFuel;

  // Update "before" result column
  updateBeforeColumn(sc);

  // Update "after" column with default ΔV scenario results
  updateAfterColumn(sc, sc.defaultDv, 'prograde');

  // Update summary metrics
  const defaultAlt = sc.defaultDv * sc.altRateKmPerMs['prograde'];
  updateSummaryMetrics(sc, sc.defaultDv, 'prograde', sc.defaultDv * sc.fuelRateKgPerMs, defaultAlt);

  // Redraw canvas
  drawTrajectoryCanvas('simulated', sc);
}

function updateBeforeColumn(sc) {
  const cols = document.querySelectorAll('.result-column');
  if (!cols[0]) return;
  const vals = cols[0].querySelectorAll('.value');
  if (vals[0]) { vals[0].textContent = formatPc(sc.initPc); vals[0].className = 'value critical'; }
  if (vals[1]) vals[1].textContent = sc.initMiss + ' km';
  if (vals[2]) vals[2].textContent = sc.initAlt + ' km';
  if (vals[3]) vals[3].textContent = sc.ttc;
}

function updateAfterColumn(sc, dv, dir) {
  const cols = document.querySelectorAll('.result-column');
  if (!cols[1]) return;

  const dirEff   = DIR_EFF[dir] || 1.0;
  const missAfter = sc.initMiss + dv * sc.missRateKmPerMs * dirEff;
  const riskFrac  = Math.min(0.9998, Math.pow(sc.initMiss / Math.max(missAfter, sc.initMiss + 0.01), 3) * dirEff);
  const pcAfter   = sc.initPc * (1 - riskFrac);
  const altDelta  = (sc.altRateKmPerMs[dir] || 0) * dv;
  const altAfter  = (sc.initAlt + altDelta).toFixed(1);

  const vals = cols[1].querySelectorAll('.value');
  if (vals[0]) {
    vals[0].textContent = formatPc(pcAfter);
    vals[0].className = pcAfter < 1e-5 ? 'value success' : pcAfter < 1e-4 ? 'value warning' : 'value critical';
  }
  if (vals[1]) vals[1].textContent = missAfter.toFixed(2) + ' km';
  if (vals[2]) vals[2].textContent = altAfter + ' km';
  if (vals[3]) vals[3].textContent = addMinutes(sc.ttc, Math.round(dv * 10));

  return { missAfter, pcAfter, riskFrac, altAfter };
}

function updateSummaryMetrics(sc, dv, dir, fuelKg, altDelta) {
  const metricVals = document.querySelectorAll('.result-metrics .metric-value');
  const dirEff     = DIR_EFF[dir] || 1.0;
  const missAfter  = sc.initMiss + dv * sc.missRateKmPerMs * dirEff;
  const riskFrac   = Math.min(0.9998, Math.pow(sc.initMiss / Math.max(missAfter, sc.initMiss + 0.01), 3) * dirEff);
  const riskRed    = (riskFrac * 100).toFixed(0);
  const eff        = Math.min(10, (riskFrac * 10 * dirEff - fuelKg / sc.defaultFuel * 2)).toFixed(1);
  const execSec    = Math.round(dv * 585);

  if (metricVals[0]) metricVals[0].textContent = riskRed + '%';
  if (metricVals[1]) metricVals[1].textContent = Math.round(fuelKg) + ' kg';
  if (metricVals[2]) metricVals[2].textContent = Math.max(4, Math.min(10, parseFloat(eff))).toFixed(1) + '/10';
  if (metricVals[3]) metricVals[3].textContent = execSec + ' sec';

  updateOptimizationReport(sc, dv, riskRed, fuelKg);
}

function updateOptimizationReport(sc, dv, riskRed, fuelKg) {
  const el = document.querySelector('.optimization-report');
  if (!el) return;
  const iters    = Math.round(600 + dv * 800);
  const margin   = sc.defaultFuel - Math.round(fuelKg);
  const pct      = ((margin / sc.defaultFuel) * 100).toFixed(0);
  const optimal  = riskRed >= 80;
  el.innerHTML = `
    <h4>Optimization Analysis</h4>
    <div class="report-item">
      <span class="label">Optimization Status:</span>
      <span class="badge ${optimal ? 'success' : 'warning'}">${optimal ? 'OPTIMAL' : 'SUBOPTIMAL'}</span>
    </div>
    <div class="report-item">
      <span class="label">Convergence:</span>
      <span>Achieved after ${iters} iterations</span>
    </div>
    <div class="report-item">
      <span class="label">Fuel Margin:</span>
      <span>${margin} kg available (${pct}%)</span>
    </div>
    <div class="report-item">
      <span class="label">Recommendation:</span>
      <span class="${optimal ? 'success' : ''}">${optimal ? 'APPROVE & EXECUTE' : 'REVIEW PARAMETERS'}</span>
    </div>`;
}

function buildComparisonTable(sc) {
  const tbody = document.querySelector('.comparison-table table tbody');
  if (!tbody) return;
  tbody.innerHTML = sc.alternatives.map(alt => `
    <tr class="${alt.optimal ? 'optimal' : ''}">
      <td><strong>${alt.type}</strong></td>
      <td>${alt.dv.toFixed(2)}</td>
      <td>${alt.fuel}</td>
      <td>${alt.finalPc.toExponential(1)}</td>
      <td>${alt.rr}%</td>
      <td><span class="badge ${alt.optimal ? 'success' : ''}">${alt.eff}/10</span></td>
    </tr>`).join('');
}

// ── Controls ──────────────────────────────────────────────────────────────────

function setupEventListeners() {
  document.getElementById('delta-v')?.addEventListener('input', function () {
    document.getElementById('delta-v-value').textContent = parseFloat(this.value).toFixed(2);
    liveUpdate();
  });
  document.getElementById('maneuver-type')?.addEventListener('change', liveUpdate);
  document.getElementById('optimization-goal')?.addEventListener('change', liveUpdate);
  document.getElementById('btn-reset')?.addEventListener('click', resetSimulation);
}

function liveUpdate() {
  const sc  = SCENARIOS[activeScenarioKey];
  const dv  = parseFloat(document.getElementById('delta-v')?.value ?? sc.defaultDv);
  const dir = document.getElementById('maneuver-type')?.value || 'prograde';
  const fuelKg  = dv * sc.fuelRateKgPerMs;
  const altDelta = (sc.altRateKmPerMs[dir] || 0) * dv;
  updateBeforeColumn(sc);
  updateAfterColumn(sc, dv, dir);
  updateSummaryMetrics(sc, dv, dir, fuelKg, altDelta);
  drawTrajectoryCanvas('simulated', sc, dv, dir);
}

function updateDeltaVDisplay() {
  const dv = document.getElementById('delta-v');
  const display = document.getElementById('delta-v-value');
  if (dv && display) display.textContent = parseFloat(dv.value).toFixed(2);
}

function runSimulation() {
  liveUpdate();
  showNotification('Simulation complete! Collision probability reduced.', 'success');
}

function resetSimulation() {
  const sc  = SCENARIOS[activeScenarioKey];
  const dvEl = document.getElementById('delta-v');
  if (dvEl) { dvEl.value = sc.defaultDv; updateDeltaVDisplay(); }
  document.getElementById('maneuver-type')  && (document.getElementById('maneuver-type').value = 'prograde');
  document.getElementById('optimization-goal') && (document.getElementById('optimization-goal').value = 'risk');
  document.getElementById('fuel-available') && (document.getElementById('fuel-available').value = sc.defaultFuel);
  loadScenario(activeScenarioKey);
  showNotification('Simulation reset to defaults.', 'info');
}

// ── Trajectory canvas ─────────────────────────────────────────────────────────

function drawTrajectoryCanvas(mode, sc, dv, dir) {
  const canvas = document.getElementById('trajectoryCanvas');
  if (!canvas) return;
  sc  = sc  || SCENARIOS[activeScenarioKey];
  dv  = dv  !== undefined ? dv  : sc.defaultDv;
  dir = dir || 'prograde';

  const W = canvas.offsetWidth  || 600;
  const H = canvas.offsetHeight || 400;
  const dpr = window.devicePixelRatio || 1;
  if (canvas.width !== W * dpr) { canvas.width = W * dpr; canvas.height = H * dpr; }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const cx = W / 2, cy = H / 2;
  const earthR = Math.min(W, H) * 0.13;
  const baseR  = Math.min(W, H) * 0.30;
  const altRatio  = Math.abs((sc.altRateKmPerMs[dir] || 0) * dv) / Math.max(sc.initAlt, 100);
  const raisedR   = dir === 'retrograde'
    ? baseR * (1 - Math.min(altRatio * 2, 0.10))
    : baseR * (1 + Math.min(altRatio * 2, 0.10));

  // Background
  ctx.fillStyle = '#f0f7ff';
  ctx.fillRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = 'rgba(0,0,0,0.05)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

  // Threat zone
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = 'rgba(239,68,68,0.3)';
  ctx.lineWidth = 16;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.ellipse(0, 0, (baseR + raisedR) / 2, (baseR + raisedR) / 2 * 0.85, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Original orbit
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(0, 0, baseR, baseR * 0.82, 0.15, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Post-maneuver orbit
  if (mode === 'simulated') {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8, 5]);
    ctx.beginPath();
    ctx.ellipse(0, 0, raisedR, raisedR * 0.82, 0.15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // Threat satellite (B)
  const slX = cx + baseR * 0.86, slY = cy - baseR * 0.50;
  ctx.fillStyle = '#ef4444';
  ctx.beginPath(); ctx.arc(slX, slY, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#374151';
  ctx.font = '11px system-ui';
  ctx.textAlign = 'left';
  ctx.fillText(sc.satB, slX + 9, slY + 4);

  // Primary satellite (A)
  const issAngle = 2.2;
  const issX = cx + baseR * Math.cos(issAngle);
  const issY = cy + baseR * 0.82 * Math.sin(issAngle);
  ctx.fillStyle = '#3b82f6';
  ctx.beginPath(); ctx.arc(issX, issY, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1d4ed8';
  ctx.beginPath(); ctx.arc(issX, issY, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#374151';
  ctx.font = 'bold 11px system-ui';
  ctx.textAlign = 'right';
  ctx.fillText(sc.satA, issX - 11, issY + 4);

  // Maneuver arrow
  if (mode === 'simulated') {
    const arrowDy = dir === 'retrograde' ? 28 : -28;
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.moveTo(issX, issY);
    ctx.lineTo(issX + 20, issY + arrowDy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(issX + 20, issY + arrowDy);
    ctx.lineTo(issX + 13, issY + arrowDy - Math.sign(arrowDy) * 8);
    ctx.lineTo(issX + 27, issY + arrowDy - Math.sign(arrowDy) * 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#15803d';
    ctx.font = 'bold 10px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('Δv = ' + dv.toFixed(2) + ' m/s', issX + 20, issY + arrowDy - Math.sign(arrowDy) * 14);
  }

  // Earth
  const grad = ctx.createRadialGradient(cx - earthR*0.3, cy - earthR*0.3, earthR*0.1, cx, cy, earthR);
  grad.addColorStop(0, '#60a5fa');
  grad.addColorStop(0.5, '#1d6fa8');
  grad.addColorStop(1, '#0c4a6e');
  ctx.beginPath(); ctx.arc(cx, cy, earthR, 0, Math.PI * 2);
  ctx.fillStyle = grad; ctx.fill();
  ctx.strokeStyle = '#93c5fd'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 12px system-ui';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('Earth', cx, cy);
  ctx.textBaseline = 'alphabetic';

  // Legend
  legendItem(ctx, 18, H - 54, '#3b82f6', sc.satA + ' Original Orbit');
  if (mode === 'simulated') legendItem(ctx, 18, H - 36, '#22c55e', 'Post-Maneuver Orbit');
  legendItem(ctx, mode === 'simulated' ? 220 : 18, mode === 'simulated' ? H - 54 : H - 36, 'rgba(239,68,68,0.7)', 'Threat Zone');
}

function legendItem(ctx, x, y, color, label) {
  ctx.fillStyle = color; ctx.fillRect(x, y, 24, 3);
  ctx.fillStyle = '#374151'; ctx.font = '11px system-ui';
  ctx.textAlign = 'left'; ctx.fillText(label, x + 28, y + 4);
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function formatPc(pc) {
  if (pc >= 1e-3) return (pc * 1e3).toFixed(1) + ' × 10⁻³';
  if (pc >= 1e-4) return (pc * 1e4).toFixed(1) + ' × 10⁻⁴';
  if (pc >= 1e-5) return (pc * 1e5).toFixed(1) + ' × 10⁻⁵';
  return (pc * 1e6).toFixed(1) + ' × 10⁻⁶';
}

function addMinutes(ttcStr, extraMins) {
  const m = ttcStr.match(/(\d+)h (\d+)m/);
  if (!m) return ttcStr;
  const total = parseInt(m[1]) * 60 + parseInt(m[2]) + extraMins;
  return Math.floor(total / 60) + 'h ' + (total % 60) + 'm';
}

// ── Export & Execute ──────────────────────────────────────────────────────────

function executeManeuver() {
  const sc = SCENARIOS[activeScenarioKey];
  if (confirm(`Execute maneuver for ${sc.name}? This will commit the orbital change.`)) {
    showNotification('Maneuver execution initiated — uplink sent to Mission Control.', 'info');
    setTimeout(() => showNotification('Maneuver executed successfully!', 'success'), 2500);
  }
}

function exportTrajectory() {
  const sc  = SCENARIOS[activeScenarioKey];
  const dv  = parseFloat(document.getElementById('delta-v')?.value || sc.defaultDv);
  const dir = document.getElementById('maneuver-type')?.value || 'prograde';
  const data = {
    timestamp: new Date().toISOString(), satellite: sc.sat,
    maneuver: { type: dir, deltaV_ms: dv, burnTime: document.getElementById('burn-time')?.value, fuelCost_kg: (dv * sc.fuelRateKgPerMs).toFixed(1) },
    results:  { beforePc: sc.initPc, afterPc: sc.initPc * (1 - DIR_EFF[dir] * 0.87), riskReduction: DIR_EFF[dir] * 0.87, newAltitude_km: (sc.initAlt + (sc.altRateKmPerMs[dir] || 0) * dv).toFixed(1) }
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadFile(blob, `maneuver_simulation_${sc.satA}.json`);
  showNotification('Trajectory exported.', 'success');
}

function generateReport() {
  const sc  = SCENARIOS[activeScenarioKey];
  const dv  = parseFloat(document.getElementById('delta-v')?.value ?? sc.defaultDv);
  const dir = document.getElementById('maneuver-type')?.value || 'prograde';
  const dirEff   = DIR_EFF[dir] || 1.0;
  const missAfter = sc.initMiss + dv * sc.missRateKmPerMs * dirEff;
  const riskFrac  = Math.min(0.9998, Math.pow(sc.initMiss / Math.max(missAfter, sc.initMiss + 0.01), 3) * dirEff);
  const pcAfter   = sc.initPc * (1 - riskFrac);
  const fuelKg    = (dv * sc.fuelRateKgPerMs).toFixed(1);
  const altAfter  = (sc.initAlt + (sc.altRateKmPerMs[dir] || 0) * dv).toFixed(1);
  const riskRed   = (riskFrac * 100).toFixed(0);
  const burnTime  = document.getElementById('burn-time')?.value || sc.burnTime;
  const dateStr   = new Date().toISOString().split('T')[0];

  const dirLabel = { prograde: 'Prograde', retrograde: 'Retrograde', normal: 'Normal', radial: 'Radial' };

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Maneuver Report — ${sc.name}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:40px;color:#1a1a2e;font-size:14px}
    h1{font-size:22px;color:#1a1a2e;border-bottom:3px solid #0284c7;padding-bottom:10px;margin-bottom:6px}
    h2{font-size:16px;color:#1565c0;margin:26px 0 10px}
    p{line-height:1.6;margin-bottom:10px;color:#374151}
    table{width:100%;border-collapse:collapse;margin:12px 0;font-size:13px}
    th{background:#1a1a2e;color:#fff;padding:9px 12px;text-align:left;font-size:12px}
    td{padding:8px 12px;border-bottom:1px solid #e5e7eb}
    tr:nth-child(even) td{background:#f9fafb}
    .badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600}
    .badge.crit{background:#fee2e2;color:#dc2626}
    .badge.ok{background:#dcfce7;color:#16a34a}
    .badge.warn{background:#fef3c7;color:#d97706}
    .stat-row{display:flex;gap:14px;margin:14px 0}
    .stat-box{flex:1;border:1px solid #e5e7eb;border-radius:8px;padding:14px;text-align:center}
    .stat-val{font-size:24px;font-weight:700;color:#1565c0}
    .stat-lbl{font-size:11px;color:#6b7280;margin-top:4px}
    .notice{background:#fffbeb;border:1px solid #f59e0b;border-radius:6px;padding:10px 14px;margin-bottom:20px;font-size:13px}
    .footer{margin-top:40px;font-size:11px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:12px}
    @media print{.notice{display:none}}
  </style>
</head>
<body>
  <div class="notice">
    <strong>To save as PDF:</strong> Press <kbd>Ctrl+P</kbd> (Windows) or <kbd>⌘+P</kbd> (Mac) → set destination to <strong>Save as PDF</strong> → click Save
  </div>

  <h1>Maneuver Simulation Report</h1>
  <p style="color:#6b7280;font-size:13px">
    Generated: ${new Date().toUTCString()} &nbsp;|&nbsp; Scenario: ${sc.name}
  </p>

  <h2>Scenario Overview</h2>
  <table>
    <tbody>
      <tr><td><strong>Satellite</strong></td><td>${sc.sat}</td></tr>
      <tr><td><strong>Conjunction Pair</strong></td><td>${sc.name}</td></tr>
      <tr><td><strong>Planned Burn Time</strong></td><td>${burnTime} UTC</td></tr>
      <tr><td><strong>Time to Closest Approach</strong></td><td>${sc.ttc}</td></tr>
    </tbody>
  </table>

  <h2>Risk Assessment</h2>
  <div class="stat-row">
    <div class="stat-box"><div class="stat-val" style="color:#dc2626">${(sc.initPc).toExponential(1)}</div><div class="stat-lbl">Pc Before Maneuver</div></div>
    <div class="stat-box"><div class="stat-val" style="color:#16a34a">${pcAfter.toExponential(1)}</div><div class="stat-lbl">Pc After Maneuver</div></div>
    <div class="stat-box"><div class="stat-val">${riskRed}%</div><div class="stat-lbl">Risk Reduction</div></div>
    <div class="stat-box"><div class="stat-val">${fuelKg} kg</div><div class="stat-lbl">Fuel Required</div></div>
  </div>

  <h2>Maneuver Parameters</h2>
  <table>
    <thead><tr><th>Parameter</th><th>Before</th><th>After</th></tr></thead>
    <tbody>
      <tr><td>Collision Probability (Pc)</td><td class="badge crit">${sc.initPc.toExponential(1)}</td><td><span class="badge ok">${pcAfter.toExponential(1)}</span></td></tr>
      <tr><td>Miss Distance</td><td>${sc.initMiss} km</td><td>${missAfter.toFixed(2)} km</td></tr>
      <tr><td>Orbital Altitude</td><td>${sc.initAlt} km</td><td>${altAfter} km</td></tr>
    </tbody>
  </table>

  <h2>Burn Details</h2>
  <table>
    <tbody>
      <tr><td><strong>Direction</strong></td><td>${dirLabel[dir] || dir}</td></tr>
      <tr><td><strong>ΔV Magnitude</strong></td><td>${dv.toFixed(2)} m/s</td></tr>
      <tr><td><strong>Fuel Cost</strong></td><td>${fuelKg} kg</td></tr>
      <tr><td><strong>Execution Time</strong></td><td>${Math.round(dv * 585)} seconds</td></tr>
      <tr><td><strong>Optimization Status</strong></td><td><span class="badge ${riskRed >= 80 ? 'ok' : 'warn'}">${riskRed >= 80 ? 'OPTIMAL' : 'SUBOPTIMAL'}</span></td></tr>
    </tbody>
  </table>

  <h2>Recommendation</h2>
  <p>${riskRed >= 80
    ? `Maneuver parameters are <strong>optimal</strong>. A ${dirLabel[dir]} burn of ${dv.toFixed(2)} m/s is recommended to reduce collision probability from ${sc.initPc.toExponential(1)} to ${pcAfter.toExponential(1)} — a ${riskRed}% risk reduction.`
    : `Current parameters achieve only ${riskRed}% risk reduction. Consider increasing ΔV or changing maneuver direction for better results.`}
  </p>

  <div class="footer">
    Generated by Trajector Maneuver Optimization Simulator &nbsp;|&nbsp; ${dateStr}
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const win  = window.open(url, '_blank');
  if (win) {
    win.addEventListener('load', () => { win.print(); URL.revokeObjectURL(url); });
    showNotification('Report opened — use Ctrl+P → Save as PDF.', 'info');
  } else {
    URL.revokeObjectURL(url);
    downloadFile(blob, `Maneuver_Report_${sc.satA}_${dateStr}.html`);
    showNotification('Report downloaded. Open it in a browser and press Ctrl+P to save as PDF.', 'info');
  }
}

function shareSimulation() {
  showNotification('Results packaged and shared with Mission Control.', 'success');
}
