// Conjunction Analysis — dynamic event selection

const EVENTS = {
  'iss-starlink': {
    risk: 'critical', riskLabel: 'CRITICAL',
    tca: '2026-05-15 14:32:41 UTC', pc: 2.1e-4, missKm: 0.82, relVel: 13.2,
    ttc: '4h 23m', uncertainty: '245 km³', pcDetail: '1 in 4,762 chance',
    riskAssessment: 'ACTION REQUIRED',
    objA: { name:'ISS',          norad:'25544', alt:'408 km',    incl:'51.6°', mass:'420,000 kg', period:'90.2 min' },
    objB: { name:'STARLINK-1142',norad:'44713', alt:'550 km',    incl:'53.0°', mass:'260 kg',     period:'96.3 min' },
    cov: { overlap:'YES', growth:'Increasing', uncert:'0.245 km (1σ)' },
    maneuver: {
      type:'Prograde Burn (Raise Perigee)', dv:'0.42 m/s',
      exec:'2026-05-15 10:15 UTC', fuel:'28 kg',
      pcAfter:'3.2 × 10⁻⁷', riskRed:'87%', altChange:'±3.2 km', dur:'12+ days',
      rationale:'Performing a 0.42 m/s prograde burn will raise the ISS perigee by approximately 3 km, creating sufficient separation from STARLINK-1142\'s predicted trajectory at time of conjunction.'
    },
    conf: { model:92, reliability:87, tleW:45, tleLabel:'45% (3 days old)', atm:68 },
    chart: { minDist:0.82, minPc:2.1e-4, sigma:2 }
  },
  'noaa-sentinel': {
    risk: 'high', riskLabel: 'HIGH',
    tca: '2026-05-16 09:15:22 UTC', pc: 1.8e-5, missKm: 2.47, relVel: 7.8,
    ttc: '28h 6m', uncertainty: '180 km³', pcDetail: '1 in 55,556 chance',
    riskAssessment: 'MONITOR & PLAN',
    objA: { name:'NOAA-18',     norad:'28654', alt:'854 km',    incl:'99.1°', mass:'1,457 kg',   period:'102.1 min' },
    objB: { name:'SENTINEL-3B', norad:'43437', alt:'814 km',    incl:'98.6°', mass:'1,250 kg',   period:'100.9 min' },
    cov: { overlap:'PARTIAL', growth:'Stable', uncert:'0.412 km (1σ)' },
    maneuver: {
      type:'Retrograde Burn (Lower Perigee)', dv:'0.31 m/s',
      exec:'2026-05-15 22:00 UTC', fuel:'21 kg',
      pcAfter:'8.4 × 10⁻⁸', riskRed:'99.5%', altChange:'−2.8 km', dur:'8+ days',
      rationale:'A 0.31 m/s retrograde burn on NOAA-18 will lower its perigee by 2.8 km, increasing the miss distance from 2.47 km to over 12 km at time of conjunction.'
    },
    conf: { model:87, reliability:82, tleW:62, tleLabel:'62% (2 days old)', atm:74 },
    chart: { minDist:2.47, minPc:1.8e-5, sigma:3.5 }
  },
  'himawari-debris': {
    risk: 'medium', riskLabel: 'MEDIUM',
    tca: '2026-05-17 11:45:30 UTC', pc: 8.3e-6, missKm: 5.12, relVel: 9.1,
    ttc: '51h 30m', uncertainty: '520 km³', pcDetail: '1 in 120,482 chance',
    riskAssessment: 'MONITORING',
    objA: { name:'HIMAWARI-8',   norad:'40267', alt:'35,786 km', incl:'0.0°',  mass:'4,700 kg',  period:'1,436 min' },
    objB: { name:'DEBRIS-39084', norad:'39084', alt:'35,620 km', incl:'0.3°',  mass:'—',         period:'1,430 min' },
    cov: { overlap:'NO', growth:'Decreasing', uncert:'0.891 km (1σ)' },
    maneuver: {
      type:'Station-Keeping Burn', dv:'0.18 m/s',
      exec:'2026-05-16 18:00 UTC', fuel:'12 kg',
      pcAfter:'4.1 × 10⁻⁸', riskRed:'99.5%', altChange:'±0.8 km', dur:'30+ days',
      rationale:'A minor station-keeping burn of 0.18 m/s will adjust HIMAWARI-8\'s GEO slot, moving it out of the predicted debris corridor with minimal fuel expenditure.'
    },
    conf: { model:71, reliability:65, tleW:28, tleLabel:'28% (5 days old)', atm:52 },
    chart: { minDist:5.12, minPc:8.3e-6, sigma:5 }
  }
};

let dcaChart = null;
let activeEventKey = 'iss-starlink';

document.addEventListener('DOMContentLoaded', function () {
  initChart(EVENTS['iss-starlink']);
  drawCovariance(EVENTS['iss-starlink']);
});

// ── Event selection ───────────────────────────────────────────────────────────

function selectConjunction(el) {
  document.querySelectorAll('.conjunction-item').forEach(i => i.classList.remove('active'));
  el.classList.add('active');
  const key = el.dataset.event;
  if (key && EVENTS[key]) {
    activeEventKey = key;
    updateAll(EVENTS[key]);
  }
}

function updateAll(ev) {
  updateSatellitePair(ev);
  updateMetrics(ev);
  drawCovariance(ev);
  updateManeuver(ev);
  updateConfidence(ev);
  updateChart(ev);
}

// ── Satellite pair ────────────────────────────────────────────────────────────

function updateSatellitePair(ev) {
  const el = document.querySelector('.satellite-pair');
  if (!el) return;
  el.innerHTML = `
    <div class="satellite-box">
      <h4>Object A</h4>
      <p class="sat-name">${ev.objA.name}</p>
      <p class="sat-number">(NORAD: ${ev.objA.norad})</p>
      <div class="sat-info">
        <div class="info-row"><span>Altitude:</span><strong>${ev.objA.alt}</strong></div>
        <div class="info-row"><span>Inclination:</span><strong>${ev.objA.incl}</strong></div>
        <div class="info-row"><span>Mass:</span><strong>${ev.objA.mass}</strong></div>
        <div class="info-row"><span>Period:</span><strong>${ev.objA.period}</strong></div>
      </div>
    </div>
    <div class="vs-indicator">↔</div>
    <div class="satellite-box">
      <h4>Object B</h4>
      <p class="sat-name">${ev.objB.name}</p>
      <p class="sat-number">(NORAD: ${ev.objB.norad})</p>
      <div class="sat-info">
        <div class="info-row"><span>Altitude:</span><strong>${ev.objB.alt}</strong></div>
        <div class="info-row"><span>Inclination:</span><strong>${ev.objB.incl}</strong></div>
        <div class="info-row"><span>Mass:</span><strong>${ev.objB.mass}</strong></div>
        <div class="info-row"><span>Period:</span><strong>${ev.objB.period}</strong></div>
      </div>
    </div>`;
}

// ── Risk metrics ──────────────────────────────────────────────────────────────

function updateMetrics(ev) {
  const el = document.querySelector('.metrics-display');
  if (!el) return;
  const missClass  = ev.missKm < 2 ? 'critical' : ev.missKm < 5 ? 'warning' : '';
  const pcClass    = ev.risk === 'critical' ? 'critical' : '';
  const riskClass  = ev.risk === 'critical' ? 'critical' : '';
  el.innerHTML = `
    <div class="metric-item">
      <div class="metric-label"><i class="fas fa-crosshairs"></i> Miss Distance</div>
      <div class="metric-value ${missClass}">${ev.missKm} km</div>
      <div class="metric-detail">${ev.missKm < 10 ? 'Below threshold of 10 km' : 'Within monitoring range'}</div>
    </div>
    <div class="metric-item">
      <div class="metric-label"><i class="fas fa-random"></i> Relative Velocity</div>
      <div class="metric-value">${ev.relVel} km/s</div>
      <div class="metric-detail">High relative speed</div>
    </div>
    <div class="metric-item">
      <div class="metric-label"><i class="fas fa-bomb"></i> Collision Probability</div>
      <div class="metric-value ${pcClass}">${formatPc(ev.pc)}</div>
      <div class="metric-detail">${ev.pcDetail}</div>
    </div>
    <div class="metric-item">
      <div class="metric-label"><i class="fas fa-clock"></i> Time to Conjunction</div>
      <div class="metric-value">${ev.ttc}</div>
      <div class="metric-detail">Conjunction TCA soon</div>
    </div>
    <div class="metric-item">
      <div class="metric-label"><i class="fas fa-check-circle"></i> Uncertainty Volume</div>
      <div class="metric-value">${ev.uncertainty}</div>
      <div class="metric-detail">Covariance 3-sigma</div>
    </div>
    <div class="metric-item">
      <div class="metric-label"><i class="fas fa-exclamation-circle"></i> Risk Assessment</div>
      <div class="metric-value ${riskClass}">${ev.riskAssessment}</div>
      <div class="metric-detail">${ev.risk === 'critical' ? 'Recommend maneuver' : ev.risk === 'high' ? 'Plan maneuver' : 'Continue monitoring'}</div>
    </div>`;
}

// ── Covariance canvas ─────────────────────────────────────────────────────────

function drawCovariance(ev) {
  const covInfo = document.querySelector('.cov-info');
  if (covInfo) {
    covInfo.innerHTML = `
      <p><strong>1-sigma overlap:</strong> ${ev.cov.overlap}</p>
      <p><strong>Covariance growth:</strong> ${ev.cov.growth}</p>
      <p><strong>Uncertainty dimension:</strong> ${ev.cov.uncert}</p>`;
  }

  const canvas = document.getElementById('covarianceCanvas');
  if (!canvas) return;

  const { ctx, width: W, height: H } = createCanvasContext(canvas);
  const scale = ev.risk === 'critical' ? 1.0 : ev.risk === 'high' ? 0.65 : 0.42;
  const sep   = ev.risk === 'critical' ? 50  : ev.risk === 'high' ? 90  : 130;
  const cx = W / 2, cy = H / 2;

  ctx.clearRect(0, 0, W, H);

  ctx.strokeStyle = 'rgba(176,188,196,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W, cy); ctx.stroke();

  drawEllipse(ctx, cx, cy, 80*scale, 60*scale, 0, 'rgba(0,212,255,0.2)', 'rgba(0,212,255,0.5)', 2);
  drawEllipse(ctx, cx, cy, 160*scale, 120*scale, 0, 'rgba(255,170,0,0.1)', 'rgba(255,170,0,0.4)', 1.5);
  drawEllipse(ctx, cx, cy, 240*scale, 180*scale, 0, 'rgba(255,68,68,0.05)', 'rgba(255,68,68,0.3)', 1);

  ctx.fillStyle = '#00d4ff';
  ctx.beginPath(); ctx.arc(cx - sep, cy, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffaa00';
  ctx.beginPath(); ctx.arc(cx + sep * 0.8, cy + sep * 0.6, 5, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = '#6c757d';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('A', cx - sep + 8, cy - 10);
  ctx.fillText('B', cx + sep * 0.8 + 7, cy + sep * 0.6 + 4);

  const lx = W - 145;
  [
    [10,  'rgba(0,212,255,0.2)',   '1-σ (68%)'],
    [35,  'rgba(255,170,0,0.1)',  '2-σ (95%)'],
    [60,  'rgba(255,68,68,0.05)', '3-σ (99.7%)']
  ].forEach(([y, fill, label]) => {
    ctx.fillStyle = fill; ctx.fillRect(lx, y, 20, 20);
    ctx.fillStyle = '#6c757d'; ctx.font = '10px sans-serif';
    ctx.textAlign = 'left'; ctx.fillText(label, lx + 24, y + 14);
  });
}

function drawEllipse(ctx, x, y, rx, ry, rot, fill, stroke, lw) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.restore();
}

// ── Maneuver recommendation ───────────────────────────────────────────────────

function updateManeuver(ev) {
  const el = document.querySelector('.maneuver-box');
  if (!el) return;
  el.innerHTML = `
    <div class="maneuver-summary">
      <div class="maneuver-item"><span class="label">Maneuver Type:</span><span class="value">${ev.maneuver.type}</span></div>
      <div class="maneuver-item"><span class="label">Δv Required:</span><span class="value highlight">${ev.maneuver.dv}</span></div>
      <div class="maneuver-item"><span class="label">Execution Time:</span><span class="value">${ev.maneuver.exec}</span></div>
      <div class="maneuver-item"><span class="label">Estimated Fuel:</span><span class="value highlight">${ev.maneuver.fuel}</span></div>
    </div>
    <div class="maneuver-rationale">
      <h4>Maneuver Rationale</h4>
      <p>${ev.maneuver.rationale}</p>
      <ul>
        <li><strong>Predicted Pc after maneuver:</strong> ${ev.maneuver.pcAfter}</li>
        <li><strong>Risk reduction:</strong> ${ev.maneuver.riskRed}</li>
        <li><strong>Orbital altitude change:</strong> ${ev.maneuver.altChange}</li>
        <li><strong>Duration of effect:</strong> ${ev.maneuver.dur}</li>
      </ul>
    </div>
    <button class="btn-primary" onclick="simulateManeuver()">
      <i class="fas fa-rocket"></i> Simulate Maneuver
    </button>`;
}

// ── Confidence bars ───────────────────────────────────────────────────────────

function updateConfidence(ev) {
  const el = document.querySelector('.confidence-metrics');
  if (!el) return;
  el.innerHTML = `
    <div class="confidence-item">
      <label>AI Model Confidence</label>
      <div class="confidence-bar"><div class="confidence-fill" style="width:${ev.conf.model}%"></div></div>
      <span class="confidence-value">${ev.conf.model}%</span>
    </div>
    <div class="confidence-item">
      <label>Prediction Reliability</label>
      <div class="confidence-bar"><div class="confidence-fill" style="width:${ev.conf.reliability}%"></div></div>
      <span class="confidence-value">${ev.conf.reliability}%</span>
    </div>
    <div class="confidence-item">
      <label>TLE Age Uncertainty</label>
      <div class="confidence-bar">
        <div class="confidence-fill" style="width:${ev.conf.tleW}%;background:var(--warning-color);"></div>
      </div>
      <span class="confidence-value">${ev.conf.tleLabel}</span>
    </div>
    <div class="confidence-item">
      <label>Atmospheric Model Confidence</label>
      <div class="confidence-bar"><div class="confidence-fill" style="width:${ev.conf.atm}%"></div></div>
      <span class="confidence-value">${ev.conf.atm}%</span>
    </div>`;
}

// ── DCA chart ─────────────────────────────────────────────────────────────────

function updateChart(ev) {
  if (dcaChart) { dcaChart.destroy(); dcaChart = null; }
  initChart(ev);
}

function initChart(ev) {
  const canvas = document.getElementById('dcaChart');
  if (!canvas) return;
  const ctx2d = canvas.getContext('2d');
  const { minDist, minPc, sigma } = ev.chart;
  const timeData = [], distData = [], pcData = [];
  for (let i = -48; i <= 48; i++) {
    timeData.push(i);
    distData.push(minDist + minDist * 5 * Math.exp(-i * i / (2 * sigma * sigma)));
    pcData.push(minPc * Math.exp(-i * i / (2 * sigma * sigma)) * 2);
  }
  const pcScale = minPc >= 1e-4 ? 1e4 : minPc >= 1e-5 ? 1e5 : 1e6;
  const pcLabel = minPc >= 1e-4 ? '×10⁻⁴' : minPc >= 1e-5 ? '×10⁻⁵' : '×10⁻⁶';

  dcaChart = new Chart(ctx2d, {
    type: 'line',
    data: {
      labels: timeData.map(t => t === 0 ? 'TCA' : (t > 0 ? '+' + t + 'h' : t + 'h')),
      datasets: [
        {
          label: 'Miss Distance (km)', data: distData,
          borderColor: '#00d4ff', backgroundColor: 'rgba(0,212,255,0.1)',
          borderWidth: 2, fill: true, tension: 0.4, yAxisID: 'y',
          pointRadius: 0, pointHoverRadius: 6
        },
        {
          label: `Collision Probability (${pcLabel})`, data: pcData.map(p => p * pcScale),
          borderColor: '#ff4444', backgroundColor: 'rgba(255,68,68,0.1)',
          borderWidth: 2, fill: true, tension: 0.4, yAxisID: 'y1',
          pointRadius: 0, pointHoverRadius: 6
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          labels: { color: '#6c757d', font: { size: 12 }, usePointStyle: true, padding: 15 }
        },
        tooltip: {
          backgroundColor: 'rgba(10,14,39,0.95)', titleColor: '#212529',
          bodyColor: '#6c757d', borderColor: '#00d4ff', borderWidth: 1, padding: 12,
          callbacks: {
            label: function (c) {
              return (c.dataset.label || '') + ': ' +
                (c.yAxisID === 'y'
                  ? c.parsed.y.toFixed(2) + ' km'
                  : c.parsed.y.toFixed(3) + ' ' + pcLabel);
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(222,226,230,0.5)' },
          ticks: { color: '#6c757d', font: { size: 11 }, maxRotation: 0 }
        },
        y: {
          type: 'linear', position: 'left',
          title: { display: true, text: 'Miss Distance (km)', color: '#00d4ff', font: { weight: 'bold' } },
          grid: { color: 'rgba(222,226,230,0.5)' },
          ticks: { color: '#6c757d', font: { size: 11 } }
        },
        y1: {
          type: 'linear', position: 'right',
          title: { display: true, text: `Collision Probability (${pcLabel})`, color: '#ff4444', font: { weight: 'bold' } },
          grid: { drawOnChartArea: false },
          ticks: { color: '#6c757d', font: { size: 11 } }
        }
      }
    }
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPc(pc) {
  if (pc >= 1e-3) return (pc * 1e3).toFixed(1) + ' × 10⁻³';
  if (pc >= 1e-4) return (pc * 1e4).toFixed(1) + ' × 10⁻⁴';
  if (pc >= 1e-5) return (pc * 1e5).toFixed(1) + ' × 10⁻⁵';
  return (pc * 1e6).toFixed(1) + ' × 10⁻⁶';
}

// ── Actions ───────────────────────────────────────────────────────────────────

function simulateManeuver() {
  showNotification('Simulating maneuver trajectory...', 'info');
  setTimeout(() => {
    showNotification('Simulation complete! Collision probability reduced.', 'success');
    setTimeout(() => { window.location.href = 'maneuver-simulator.html'; }, 1000);
  }, 2000);
}

function exportCDM() {
  const ev = EVENTS[activeEventKey];
  const cdmData = `CCSDS_CDM_VERS = 1.0
CREATION_DATE = ${new Date().toISOString()}
ORIGINATOR = Trajector System
MESSAGE_FOR = ${ev.objA.name} ${ev.objB.name}

CONJUNCTION_DATA
TCA = ${ev.tca}
MISS_DISTANCE = ${ev.missKm}
COLLISION_PROBABILITY = ${ev.pc}
RELATIVE_SPEED = ${ev.relVel}`;
  const blob = new Blob([cdmData], { type: 'text/plain' });
  downloadFile(blob, `conjunction_cdm_${ev.objA.name.replace(/\s/g,'_')}.txt`);
  showNotification('CDM exported.', 'success');
}

function exportJSON() {
  const ev = EVENTS[activeEventKey];
  const data = {
    conjunction: {
      objectA: ev.objA.name, objectB: ev.objB.name,
      tca: ev.tca, missDistance: ev.missKm,
      collisionProbability: ev.pc, relativeVelocity: ev.relVel
    },
    recommendation: {
      maneuverType: ev.maneuver.type, deltaV: ev.maneuver.dv,
      fuel: ev.maneuver.fuel, expectedPcAfter: ev.maneuver.pcAfter
    }
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadFile(blob, `conjunction_${ev.objA.name.replace(/\s/g,'_')}.json`);
  showNotification('JSON exported.', 'success');
}

function generateReport() {
  showNotification('Generating PDF report...', 'info');
  setTimeout(() => showNotification('Report generated successfully!', 'success'), 2000);
}

function sharePrediction() {
  showNotification('Sharing prediction data...', 'info');
}
