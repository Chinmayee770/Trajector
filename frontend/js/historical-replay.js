// Historical Replay System — dynamic event selection

const REPLAY_DATA = {
  'iss-starlink': {
    objA: 'ISS', objB: 'STARLINK-1142', date: '2026-05-15',
    timeline: [
      { label: 'T-72h: Initial Detection',  desc: 'TLE data shows potential conjunction risk. Pc = 1.2e-5', state: 'past' },
      { label: 'T-48h: Risk Assessment',    desc: 'Monte Carlo analysis. Pc increased to 2.8e-4. Action required.', state: 'past' },
      { label: 'T-24h: Maneuver Planning',  desc: 'AI recommends 0.42 m/s prograde burn. Fuel analysis complete.', state: 'past' },
      { label: 'T-4h: Maneuver Execution',  desc: 'Prograde burn executed. New Pc predicted: 3.2e-7', state: 'past' },
      { label: 'TCA (Time of Closest Approach)', desc: '2026-05-15 14:32:41 UTC | Miss Distance: 4.12 km', state: 'current' },
      { label: 'T+24h: Post-Event Analysis', desc: 'Maneuver effectiveness confirmed. Conjunction successfully avoided.', state: 'future' },
    ],
    ai: { type: 'Prograde Burn', dv: '0.42 m/s', burnTime: '2026-05-15 10:15 UTC', expected: 'Pc → 3.2e-7 (87% reduction)', confidence: '94%' },
    ground: { status: 'APPROVED', decisionTime: '2026-05-14 22:30 UTC', authority: 'Mission Control Houston', notes: 'Maneuver deemed necessary. No conflicts with ISS operations.', fuelMargin: '472 kg available' },
    outcome: { actualPc: '2.1e-7', missDist: '4.12 km', success: 'SUCCESSFUL', fuelUsed: '27 kg (within prediction)', accuracy: '99.2%' },
    history: [
      { date: '2026-05-15', objs: 'ISS / STARLINK-1142',      initPc: '2.1e-4', finalPc: '2.1e-7', maneuver: 'Prograde Burn (0.42 m/s)',     outcome: 'AVOIDED',      selected: true  },
      { date: '2026-04-28', objs: 'NOAA-18 / SENTINEL-3B',    initPc: '8.3e-5', finalPc: '1.2e-6', maneuver: 'Normal Maneuver (0.18 m/s)',   outcome: 'AVOIDED',      selected: false },
      { date: '2026-04-10', objs: 'HIMAWARI-8 / Debris-39084',initPc: '3.2e-6', finalPc: '3.2e-6', maneuver: 'No Maneuver (Low risk)',        outcome: 'SAFE PASSAGE', selected: false },
      { date: '2026-03-15', objs: 'COPERNICUS / Debris-44713', initPc: '1.5e-4', finalPc: '8.2e-6', maneuver: 'Retrograde Burn (0.58 m/s)',   outcome: 'AVOIDED',      selected: false },
    ],
    orbit: { aRx: 0.38, aRy: 0.30, bRx: 0.40, bRy: 0.32, bPhase: 0.35, aColor: '#3b82f6', bColor: '#ef4444', aLabel: 'ISS', bLabel: 'SLK-1142' }
  },
  'noaa-sentinel': {
    objA: 'NOAA-18', objB: 'SENTINEL-3B', date: '2026-05-16',
    timeline: [
      { label: 'T-96h: Initial Detection',   desc: 'TLE analysis reveals close approach risk. Pc = 3.4e-6', state: 'past' },
      { label: 'T-60h: Risk Assessment',     desc: 'Refined orbit determination. Pc elevated to 1.8e-5. Monitoring.', state: 'past' },
      { label: 'T-36h: Maneuver Planning',   desc: 'AI recommends 0.31 m/s retrograde burn. Mission ops notified.', state: 'past' },
      { label: 'T-14h: Maneuver Execution',  desc: 'Retrograde burn executed on NOAA-18. New Pc: 8.4e-8', state: 'past' },
      { label: 'TCA (Time of Closest Approach)', desc: '2026-05-16 09:15:22 UTC | Miss Distance: 12.3 km', state: 'current' },
      { label: 'T+24h: Post-Event Analysis', desc: 'Safe passage confirmed. Maneuver efficiency validated at 99.5%.', state: 'future' },
    ],
    ai: { type: 'Retrograde Burn', dv: '0.31 m/s', burnTime: '2026-05-15 19:15 UTC', expected: 'Pc → 8.4e-8 (99.5% reduction)', confidence: '87%' },
    ground: { status: 'APPROVED', decisionTime: '2026-05-15 14:00 UTC', authority: 'NOAA Mission Ops', notes: 'Maneuver approved within scheduled maintenance window.', fuelMargin: '145 kg available' },
    outcome: { actualPc: '7.2e-8', missDist: '12.3 km', success: 'SUCCESSFUL', fuelUsed: '20 kg (within prediction)', accuracy: '97.8%' },
    history: [
      { date: '2026-05-16', objs: 'NOAA-18 / SENTINEL-3B',    initPc: '1.8e-5', finalPc: '7.2e-8', maneuver: 'Retrograde Burn (0.31 m/s)', outcome: 'AVOIDED',      selected: true  },
      { date: '2026-04-28', objs: 'NOAA-18 / SENTINEL-3B',    initPc: '8.3e-5', finalPc: '1.2e-6', maneuver: 'Normal Maneuver (0.18 m/s)', outcome: 'AVOIDED',      selected: false },
      { date: '2026-03-12', objs: 'NOAA-18 / Debris-41229',   initPc: '2.1e-5', finalPc: '9.4e-8', maneuver: 'Prograde Burn (0.22 m/s)',   outcome: 'AVOIDED',      selected: false },
      { date: '2026-02-20', objs: 'NOAA-19 / METOP-B',        initPc: '4.8e-5', finalPc: '1.1e-7', maneuver: 'Normal Maneuver (0.29 m/s)', outcome: 'AVOIDED',      selected: false },
    ],
    orbit: { aRx: 0.36, aRy: 0.28, bRx: 0.37, bRy: 0.29, bPhase: 0.28, aColor: '#3b82f6', bColor: '#f59e0b', aLabel: 'NOAA-18', bLabel: 'SEN-3B' }
  },
  'himawari-debris': {
    objA: 'HIMAWARI-8', objB: 'DEBRIS-39084', date: '2026-05-17',
    timeline: [
      { label: 'T-120h: Debris Detection',   desc: 'Catalogued debris on intersecting GEO arc. Pc = 2.1e-7', state: 'past' },
      { label: 'T-72h: Risk Assessment',     desc: 'Space-Track conjunction data confirms approach. Pc = 8.3e-6.', state: 'past' },
      { label: 'T-48h: Maneuver Planning',   desc: 'AI recommends 0.18 m/s station-keeping burn. Low fuel cost.', state: 'past' },
      { label: 'T-24h: Maneuver Execution',  desc: 'Station-keeping burn executed. New Pc: 4.1e-8', state: 'past' },
      { label: 'TCA (Time of Closest Approach)', desc: '2026-05-17 11:45:30 UTC | Miss Distance: 18.7 km', state: 'current' },
      { label: 'T+24h: Post-Event Analysis', desc: 'Debris passed safely. GEO slot restored within tolerance.', state: 'future' },
    ],
    ai: { type: 'Station-Keeping Burn', dv: '0.18 m/s', burnTime: '2026-05-16 18:00 UTC', expected: 'Pc → 4.1e-8 (99.5% reduction)', confidence: '71%' },
    ground: { status: 'APPROVED', decisionTime: '2026-05-16 10:30 UTC', authority: 'JMA Operations Center', notes: 'Low-risk maneuver approved. Minimal operational impact to imaging schedule.', fuelMargin: '712 kg available' },
    outcome: { actualPc: '3.8e-8', missDist: '18.7 km', success: 'SUCCESSFUL', fuelUsed: '11 kg (within prediction)', accuracy: '98.1%' },
    history: [
      { date: '2026-05-17', objs: 'HIMAWARI-8 / DEBRIS-39084', initPc: '8.3e-6', finalPc: '3.8e-8', maneuver: 'Station-Keeping (0.18 m/s)',    outcome: 'AVOIDED',      selected: true  },
      { date: '2026-04-10', objs: 'HIMAWARI-8 / Debris-39084', initPc: '3.2e-6', finalPc: '3.2e-6', maneuver: 'No Maneuver (Low risk)',         outcome: 'SAFE PASSAGE', selected: false },
      { date: '2026-02-05', objs: 'HIMAWARI-9 / BEIDOU-G6',    initPc: '5.1e-6', finalPc: '2.2e-8', maneuver: 'E-W Station-Keeping (0.12 m/s)', outcome: 'AVOIDED',      selected: false },
      { date: '2025-11-18', objs: 'HIMAWARI-8 / Debris-36037', initPc: '1.3e-6', finalPc: '1.3e-6', maneuver: 'No Maneuver (Low risk)',         outcome: 'SAFE PASSAGE', selected: false },
    ],
    orbit: { aRx: 0.42, aRy: 0.41, bRx: 0.43, bRy: 0.42, bPhase: 0.05, aColor: '#8b5cf6', bColor: '#6b7280', aLabel: 'HIMAWARI-8', bLabel: 'Debris' }
  }
};

let animFrame    = null;
let animRunning  = false;
let animProgress = 0;
let activeOrbit  = REPLAY_DATA['iss-starlink'].orbit;

document.addEventListener('DOMContentLoaded', function () {
  drawReplayCanvas(0);
  setupReplayControls();
});

// ── Controls ─────────────────────────────────────────────────────────────────

function setupReplayControls() {
  document.getElementById('btn-play-replay')?.addEventListener('click', playReplay);
  document.getElementById('btn-anim-play')?.addEventListener('click', playAnimation);
  document.getElementById('btn-anim-pause')?.addEventListener('click', pauseAnimation);
}

function playReplay() {
  const sel = document.getElementById('event-select')?.value;
  if (!sel) { showNotification('Please select an event to replay.', 'warning'); return; }

  const data = REPLAY_DATA[sel];
  if (!data) return;

  updateFromEvent(data);
  activeOrbit = data.orbit;

  const label = document.getElementById('event-select').options[document.getElementById('event-select').selectedIndex].text;
  showNotification('Starting replay: ' + label, 'info');

  resetAnimation();
  playAnimation();
}

// ── Dynamic updates from selected event ──────────────────────────────────────

function updateFromEvent(data) {
  updateTimeline(data.timeline);
  updateDecisionCards(data);
  updateHistoryTable(data.history);
}

function updateTimeline(items) {
  const el = document.querySelector('.timeline');
  if (!el) return;
  el.innerHTML = items.map(item => `
    <div class="timeline-item ${item.state === 'current' ? 'current' : item.state === 'future' ? 'future' : 'past'}">
      <div class="timeline-dot${item.state === 'current' ? ' current' : ''}"></div>
      <div class="timeline-content">
        <h4>${item.label}</h4>
        <p>${item.desc}</p>
      </div>
    </div>`).join('');
}

function updateDecisionCards(data) {
  const grid = document.querySelector('.decision-grid');
  if (!grid) return;
  grid.innerHTML = `
    <div class="decision-card">
      <h4>AI Recommendation</h4>
      <div class="decision-content">
        <p><strong>Type:</strong> ${data.ai.type}</p>
        <p><strong>ΔV:</strong> ${data.ai.dv}</p>
        <p><strong>Burn Time:</strong> ${data.ai.burnTime}</p>
        <p><strong>Expected Result:</strong> ${data.ai.expected}</p>
        <p><strong>Confidence:</strong> ${data.ai.confidence}</p>
      </div>
    </div>
    <div class="decision-card">
      <h4>Ground Station Decision</h4>
      <div class="decision-content">
        <p><strong>Status:</strong> ${data.ground.status}</p>
        <p><strong>Decision Time:</strong> ${data.ground.decisionTime}</p>
        <p><strong>Approving Authority:</strong> ${data.ground.authority}</p>
        <p><strong>Review Notes:</strong> ${data.ground.notes}</p>
        <p><strong>Fuel Margin:</strong> ${data.ground.fuelMargin}</p>
      </div>
    </div>
    <div class="decision-card">
      <h4>Actual Outcome</h4>
      <div class="decision-content">
        <p><strong>Actual Pc:</strong> ${data.outcome.actualPc}</p>
        <p><strong>Miss Distance:</strong> ${data.outcome.missDist}</p>
        <p><strong>Maneuver Success:</strong> ✓ ${data.outcome.success}</p>
        <p><strong>Fuel Used:</strong> ${data.outcome.fuelUsed}</p>
        <p><strong>Prediction Accuracy:</strong> ${data.outcome.accuracy}</p>
      </div>
    </div>`;
}

function updateHistoryTable(rows) {
  const tbody = document.querySelector('.comparison-section table tbody');
  if (!tbody) return;
  tbody.innerHTML = rows.map(r => `
    <tr class="${r.selected ? 'selected' : ''}">
      <td>${r.date}</td>
      <td>${r.objs}</td>
      <td>${r.initPc}</td>
      <td>${r.finalPc}</td>
      <td>${r.maneuver}</td>
      <td><span class="badge success">${r.outcome}</span></td>
    </tr>`).join('');
}

// ── Animation ─────────────────────────────────────────────────────────────────

function playAnimation() {
  if (animRunning) return;
  animRunning = true;
  const btn = document.getElementById('btn-anim-play');
  if (btn) btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Playing';
  animLoop();
}

function pauseAnimation() {
  animRunning = false;
  cancelAnimationFrame(animFrame);
  const btn = document.getElementById('btn-anim-play');
  if (btn) btn.innerHTML = '<i class="fas fa-play"></i> Play';
  showNotification('Animation paused.', 'info');
}

function resetAnimation() {
  animProgress = 0;
  pauseAnimation();
  drawReplayCanvas(0);
  setProgressUI(0);
}

function animLoop() {
  if (!animRunning) return;
  animProgress = Math.min(animProgress + 0.003, 1.0);
  drawReplayCanvas(animProgress);
  setProgressUI(animProgress);
  if (animProgress >= 1.0) {
    animRunning = false;
    const btn = document.getElementById('btn-anim-play');
    if (btn) btn.innerHTML = '<i class="fas fa-play"></i> Play';
    showNotification('Replay complete. Conjunction successfully avoided!', 'success');
    return;
  }
  animFrame = requestAnimationFrame(animLoop);
}

function setProgressUI(t) {
  const fill = document.getElementById('progress-fill');
  if (fill) fill.style.width = (t * 100).toFixed(1) + '%';
  const timeEl = document.getElementById('anim-time');
  if (timeEl) {
    const total = 120 * t;
    timeEl.textContent = Math.floor(total) + ':' + String(Math.floor((total % 1) * 60)).padStart(2, '0');
  }
}

// ── Canvas draw ───────────────────────────────────────────────────────────────

function drawReplayCanvas(t) {
  const canvas = document.getElementById('trajectoryAnimation');
  if (!canvas) return;
  const orbit = activeOrbit;

  const W   = canvas.offsetWidth  || 640;
  const H   = canvas.offsetHeight || 360;
  const dpr = window.devicePixelRatio || 1;
  if (canvas.width !== W * dpr) { canvas.width = W * dpr; canvas.height = H * dpr; }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const cx = W / 2, cy = H / 2;
  const aRx = orbit.aRx * W / 2, aRy = orbit.aRy * H / 2;
  const bRx = orbit.bRx * W / 2, bRy = orbit.bRy * H / 2;

  // Background
  ctx.fillStyle = '#f0f7ff';
  ctx.fillRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = 'rgba(0,0,0,0.05)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 50) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (let y = 0; y < H; y += 50) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

  // Object A orbit path
  ctx.strokeStyle = orbit.aColor + '66';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(cx, cy, aRx, aRy, 0.1, 0, Math.PI * 2); ctx.stroke();

  // Object B orbit path
  ctx.strokeStyle = orbit.bColor + '66';
  ctx.beginPath(); ctx.ellipse(cx, cy, bRx, bRy, 0.1, 0, Math.PI * 2); ctx.stroke();

  // Post-maneuver orbit (after t > 0.45)
  if (t > 0.45) {
    const alpha = Math.min((t - 0.45) / 0.15, 1);
    ctx.strokeStyle = `rgba(34,197,94,${alpha})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.ellipse(cx, cy, aRx * 1.06, aRy * 1.06, 0.1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Satellite positions
  const aAngle = 2 * Math.PI * t * 1.1;
  const aX = cx + aRx * Math.cos(aAngle), aY = cy + aRy * Math.sin(aAngle);
  const bAngle = 2 * Math.PI * t * 0.93 + orbit.bPhase;
  const bX = cx + bRx * Math.cos(bAngle), bY = cy + bRy * Math.sin(bAngle);

  // Conjunction zone
  const dist = Math.hypot(bX - aX, bY - aY);
  if (dist < 80) {
    const alpha = Math.max(0, 1 - dist / 80);
    ctx.fillStyle = `rgba(239,68,68,${alpha * 0.2})`;
    ctx.beginPath(); ctx.arc((aX+bX)/2, (aY+bY)/2, 50, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(239,68,68,${alpha * 0.8})`;
    ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(aX, aY); ctx.lineTo(bX, bY); ctx.stroke();
    ctx.setLineDash([]);
    if (dist < 60) {
      const midX = (aX+bX)/2, midY = (aY+bY)/2;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(midX - 35, midY - 14, 70, 16);
      ctx.fillStyle = '#dc2626'; ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(`~${(dist / 40).toFixed(2)} km`, midX, midY - 2);
    }
  }

  // Draw satellites
  drawSatellite(ctx, aX, aY, orbit.aColor, orbit.aLabel, t > 0.45);
  drawSatellite(ctx, bX, bY, orbit.bColor, orbit.bLabel, false);

  // Earth
  const earthR = Math.min(W, H) * 0.11;
  const grad = ctx.createRadialGradient(cx - earthR*0.3, cy - earthR*0.3, earthR*0.1, cx, cy, earthR);
  grad.addColorStop(0, '#60a5fa'); grad.addColorStop(0.6, '#1d6fa8'); grad.addColorStop(1, '#0c4a6e');
  ctx.beginPath(); ctx.arc(cx, cy, earthR, 0, Math.PI * 2);
  ctx.fillStyle = grad; ctx.fill();
  ctx.strokeStyle = '#93c5fd'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 12px system-ui';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('Earth', cx, cy); ctx.textBaseline = 'alphabetic';

  // Phase annotation
  const phase = t < 0.3  ? 'Pre-detection'
              : t < 0.5  ? 'Conjunction Approach'
              : t < 0.65 ? 'Maneuver Executed'
              : t < 0.85 ? 'Separation Achieved'
              :             'Safe Passage Confirmed';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillRect(W - 210, 10, 200, 28);
  ctx.fillStyle = t > 0.64 ? '#16a34a' : t > 0.29 ? '#dc2626' : '#374151';
  ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center';
  ctx.fillText(phase, W - 110, 26);

  // Legend
  const ly = H - 22;
  drawLegLine(ctx, 12, ly, orbit.aColor, orbit.aLabel);
  drawLegLine(ctx, 130, ly, orbit.bColor, orbit.bLabel);
  if (t > 0.45) drawLegLine(ctx, 250, ly, '#22c55e', 'Post-maneuver');
}

function drawSatellite(ctx, x, y, color, label, maneuvered) {
  if (maneuvered) { ctx.shadowColor = '#22c55e'; ctx.shadowBlur = 10; }
  ctx.fillStyle = maneuvered ? '#22c55e' : color;
  ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#1f2937'; ctx.font = '10px system-ui'; ctx.textAlign = 'center';
  ctx.fillText(label, x, y + 18);
}

function drawLegLine(ctx, x, y, color, label) {
  ctx.fillStyle = color; ctx.fillRect(x, y - 2, 20, 4);
  ctx.fillStyle = '#374151'; ctx.font = '10px system-ui';
  ctx.textAlign = 'left'; ctx.fillText(label, x + 24, y + 3);
}

// ── Export ────────────────────────────────────────────────────────────────────

function exportReplayData() {
  const sel = document.getElementById('event-select')?.value || 'iss-starlink';
  const data = REPLAY_DATA[sel] || REPLAY_DATA['iss-starlink'];
  const payload = {
    event:  `${data.objA}_${data.objB}_Conjunction_${data.date}`,
    date:   data.date,
    objectA: data.objA, objectB: data.objB,
    initialPc: data.history[0]?.initPc,
    finalPc:   data.outcome.actualPc,
    maneuver:  data.ai.type,
    deltaV:    data.ai.dv,
    fuelUsed:  data.outcome.fuelUsed,
    outcome:   'SUCCESSFUL_AVOIDANCE',
    accuracy:  data.outcome.accuracy
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  downloadFile(blob, `historical_replay_${data.objA}_${data.date}.json`);
  showNotification('Replay data exported.', 'success');
}

function generateAnalysisReport() {
  showNotification('Generating historical analysis report…', 'info');
  setTimeout(() => showNotification('Analysis report generated!', 'success'), 2000);
}
