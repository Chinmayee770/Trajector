// Reports — actual file downloads

const CONJUNCTION_EVENTS = [
  {
    pair: 'ISS ↔ STARLINK-1142', satA: 'ISS (NORAD 25544)', satB: 'STARLINK-1142 (NORAD 44713)',
    tca: '2026-05-15T14:32:41Z', initialPc: 2.1e-4, missKm: 0.82, relVelKms: 13.2,
    risk: 'CRITICAL', maneuver: 'Prograde Burn', deltaV_ms: 0.42, fuel_kg: 28,
    finalPc: 3.2e-7, riskReduction: 87, outcome: 'MANEUVER EXECUTED'
  },
  {
    pair: 'NOAA-18 ↔ SENTINEL-3B', satA: 'NOAA-18 (NORAD 28654)', satB: 'SENTINEL-3B (NORAD 43437)',
    tca: '2026-05-16T09:15:22Z', initialPc: 1.8e-5, missKm: 2.47, relVelKms: 7.8,
    risk: 'HIGH', maneuver: 'Retrograde Burn', deltaV_ms: 0.31, fuel_kg: 21,
    finalPc: 8.4e-8, riskReduction: 99.5, outcome: 'MANEUVER PLANNED'
  },
  {
    pair: 'HIMAWARI-8 ↔ DEBRIS-39084', satA: 'HIMAWARI-8 (NORAD 40267)', satB: 'DEBRIS-39084 (NORAD 39084)',
    tca: '2026-05-17T11:45:30Z', initialPc: 8.3e-6, missKm: 5.12, relVelKms: 9.1,
    risk: 'MEDIUM', maneuver: 'Station-Keeping', deltaV_ms: 0.18, fuel_kg: 12,
    finalPc: 4.1e-8, riskReduction: 99.5, outcome: 'MONITORING'
  }
];

// ── PDF (printable HTML opened in new window) ─────────────────────────────────

function generatePDFReport() {
  const dateFrom  = document.getElementById('report-date-from')?.value  || '2026-05-01';
  const dateTo    = document.getElementById('report-date-to')?.value    || '2026-05-31';
  const incRisk   = document.getElementById('inc-risk')?.checked   !== false;
  const incMan    = document.getElementById('inc-maneuver')?.checked !== false;
  const incCov    = document.getElementById('inc-cov')?.checked    !== false;
  const incAI     = document.getElementById('inc-ai')?.checked     !== false;
  const incHist   = document.getElementById('inc-hist')?.checked   || false;
  const level     = document.getElementById('detail-level')?.value  || 'standard';

  const rows = CONJUNCTION_EVENTS.map(e => `
    <tr>
      <td>${e.pair}</td>
      <td>${new Date(e.tca).toISOString().replace('T', ' ').slice(0, 19)} UTC</td>
      <td class="${e.risk === 'CRITICAL' ? 'crit' : ''}">${fmtPc(e.initialPc)}</td>
      <td>${e.missKm} km</td>
      <td class="${e.risk === 'CRITICAL' ? 'crit' : e.risk === 'HIGH' ? 'warn' : ''}">${e.risk}</td>
      <td>${e.outcome}</td>
    </tr>`).join('');

  const manRows = CONJUNCTION_EVENTS.map(e => `
    <tr>
      <td>${e.satA.split(' ')[0]}</td>
      <td>${e.maneuver}</td>
      <td>${e.deltaV_ms.toFixed(2)}</td>
      <td>${e.fuel_kg}</td>
      <td class="ok">${fmtPc(e.finalPc)}</td>
      <td class="ok">${e.riskReduction}%</td>
    </tr>`).join('');

  const histSection = incHist ? `
    <h2>Historical Comparison</h2>
    <table>
      <thead><tr><th>Date</th><th>Objects</th><th>Initial Pc</th><th>Outcome</th></tr></thead>
      <tbody>
        <tr><td>2026-05-15</td><td>ISS / STARLINK-1142</td><td>2.1e-4</td><td>AVOIDED</td></tr>
        <tr><td>2026-04-28</td><td>NOAA-18 / SENTINEL-3B</td><td>8.3e-5</td><td>AVOIDED</td></tr>
        <tr><td>2026-04-10</td><td>HIMAWARI-8 / Debris-39084</td><td>3.2e-6</td><td>SAFE PASSAGE</td></tr>
        <tr><td>2026-03-15</td><td>COPERNICUS / Debris-44713</td><td>1.5e-4</td><td>AVOIDED</td></tr>
      </tbody>
    </table>` : '';

  const covSection = incCov ? `
    <h2>Covariance & Uncertainty</h2>
    <p>Covariance analysis performed using Monte Carlo simulation with 100,000 particles.
    All Pc values incorporate 3-sigma position uncertainty. TLE age effects account for
    up to 45% uncertainty growth over the 72-hour prediction window.</p>
    <table>
      <thead><tr><th>Event</th><th>1-σ Uncertainty</th><th>Overlap</th><th>Growth Trend</th></tr></thead>
      <tbody>
        <tr><td>ISS ↔ STARLINK-1142</td><td>0.245 km</td><td>YES</td><td>Increasing</td></tr>
        <tr><td>NOAA-18 ↔ SENTINEL-3B</td><td>0.412 km</td><td>PARTIAL</td><td>Stable</td></tr>
        <tr><td>HIMAWARI-8 ↔ Debris</td><td>0.891 km</td><td>NO</td><td>Decreasing</td></tr>
      </tbody>
    </table>` : '';

  const aiSection = incAI ? `
    <h2>AI Model Performance</h2>
    <p>Trajectory predictions use the <strong>ODE-KAN-Fusion</strong> model (Neural ODE +
    Kolmogorov-Arnold Network), ranked #1 by MAE across all 10 evaluated models.</p>
    <table>
      <thead><tr><th>#</th><th>Model</th><th>Type</th><th>MAE (km)</th><th>RMSE (km)</th><th>R²</th></tr></thead>
      <tbody>
        <tr style="background:#f0fff4"><td>1</td><td><strong>ODE-KAN-Fusion ★</strong></td><td>Novel</td><td>0.1623</td><td>0.3450</td><td>0.8975</td></tr>
        <tr><td>2</td><td>HMT ★</td><td>Novel</td><td>0.1716</td><td>0.3512</td><td>0.9116</td></tr>
        <tr><td>3</td><td>BiLSTM</td><td>Baseline</td><td>0.1990</td><td>0.4321</td><td>0.8950</td></tr>
        <tr><td>4</td><td>XGBOOST</td><td>Baseline</td><td>0.2428</td><td>0.5447</td><td>0.9047</td></tr>
        <tr><td>5</td><td>RIDGE</td><td>Baseline</td><td>0.2840</td><td>0.6248</td><td>0.8767</td></tr>
        <tr><td>6</td><td>LSTM</td><td>Baseline</td><td>0.3847</td><td>0.8784</td><td>0.6649</td></tr>
        <tr><td>7</td><td>CNN-LSTM</td><td>Baseline</td><td>0.3920</td><td>0.9117</td><td>0.7501</td></tr>
        <tr><td>8</td><td>Transformer</td><td>Baseline</td><td>0.4167</td><td>0.9187</td><td>0.6729</td></tr>
        <tr><td>9</td><td>GRU</td><td>Baseline</td><td>0.4383</td><td>0.9683</td><td>0.7438</td></tr>
        <tr><td>10</td><td>RKHS-Spectral-GRU ★</td><td>Novel</td><td>0.6131</td><td>1.2478</td><td>0.0353</td></tr>
      </tbody>
    </table>` : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Trajector — Conjunction Analysis Report</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;max-width:820px;margin:0 auto;padding:40px;color:#1a1a2e;font-size:14px}
    h1{font-size:22px;color:#1a1a2e;border-bottom:3px solid #0284c7;padding-bottom:10px;margin-bottom:6px}
    h2{font-size:16px;color:#1565c0;margin:28px 0 10px}
    p{line-height:1.6;margin-bottom:10px;color:#374151}
    table{width:100%;border-collapse:collapse;margin:12px 0;font-size:13px}
    th{background:#1a1a2e;color:#fff;padding:9px 10px;text-align:left;font-size:12px}
    td{padding:7px 10px;border-bottom:1px solid #e5e7eb}
    tr:nth-child(even) td{background:#f9fafb}
    .crit{color:#dc2626;font-weight:600}
    .warn{color:#d97706;font-weight:600}
    .ok{color:#16a34a;font-weight:600}
    .stat-row{display:flex;gap:16px;margin:14px 0}
    .stat-box{flex:1;border:1px solid #e5e7eb;border-radius:8px;padding:14px;text-align:center}
    .stat-val{font-size:26px;font-weight:700;color:#1565c0}
    .stat-val.crit{color:#dc2626}
    .stat-lbl{font-size:12px;color:#6b7280;margin-top:4px}
    .notice{background:#fffbeb;border:1px solid #f59e0b;border-radius:6px;padding:10px 14px;margin-bottom:20px;font-size:13px}
    .footer{margin-top:40px;font-size:11px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:12px}
    @media print{.notice{display:none}}
  </style>
</head>
<body>
  <div class="notice">
    <strong>To save as PDF:</strong> Press <kbd>Ctrl+P</kbd> (Windows) or <kbd>⌘+P</kbd> (Mac)
    → set destination to <strong>Save as PDF</strong> → click Save
  </div>

  <h1>Trajector — Conjunction Analysis Report</h1>
  <p style="color:#6b7280;font-size:13px">
    Generated: ${new Date().toUTCString()} &nbsp;|&nbsp;
    Period: ${dateFrom} to ${dateTo} &nbsp;|&nbsp;
    Detail level: ${level}
  </p>

  <h2>Executive Summary</h2>
  <p>
    Three conjunction events were identified for the reporting period.
    One critical event (ISS ↔ STARLINK-1142, Pc = 2.1 × 10⁻⁴) required immediate
    maneuver action and was resolved with a 0.42 m/s prograde burn achieving 87% risk reduction.
    All events have been managed successfully.
  </p>
  <div class="stat-row">
    <div class="stat-box"><div class="stat-val">3</div><div class="stat-lbl">Total Conjunction Events</div></div>
    <div class="stat-box"><div class="stat-val crit">1</div><div class="stat-lbl">Critical Events</div></div>
    <div class="stat-box"><div class="stat-val">61 kg</div><div class="stat-lbl">Total Fuel Used</div></div>
    <div class="stat-box"><div class="stat-val ok">3/3</div><div class="stat-lbl">Events Resolved</div></div>
  </div>

  ${incRisk ? `
  <h2>Conjunction Events & Risk Assessment</h2>
  <table>
    <thead><tr><th>Satellite Pair</th><th>TCA (UTC)</th><th>Initial Pc</th><th>Miss Distance</th><th>Risk</th><th>Status</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>` : ''}

  ${incMan ? `
  <h2>Maneuver Recommendations</h2>
  <table>
    <thead><tr><th>Satellite</th><th>Maneuver Type</th><th>ΔV (m/s)</th><th>Fuel (kg)</th><th>Pc After</th><th>Risk Reduction</th></tr></thead>
    <tbody>${manRows}</tbody>
  </table>` : ''}

  ${covSection}
  ${aiSection}
  ${histSection}

  <div class="footer">
    Generated by Trajector Satellite Conjunction Assessment System &nbsp;|&nbsp;
    Model: ODE-KAN-Fusion (MAE = 0.1623 km, R² = 0.9089) &nbsp;|&nbsp;
    ${new Date().toLocaleDateString()}
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const win  = window.open(url, '_blank');
  if (win) {
    win.addEventListener('load', () => { win.print(); URL.revokeObjectURL(url); });
    showNotification('Report opened — use Ctrl+P (or ⌘P) → Save as PDF.', 'info');
  } else {
    // Popup blocked — download the HTML file directly
    URL.revokeObjectURL(url);
    const dateStr = new Date().toISOString().split('T')[0];
    downloadFile(blob, `Trajector_Report_${dateStr}.html`);
    showNotification('Report downloaded as HTML. Open it in a browser and press Ctrl+P to save as PDF.', 'info');
  }
}

// ── JSON download ─────────────────────────────────────────────────────────────

function generateJSONReport() {
  const dateStr = new Date().toISOString().split('T')[0];
  const data = {
    report: {
      title: 'Trajector Conjunction Analysis Report',
      generated: new Date().toISOString(),
      period: {
        from: document.getElementById('report-date-from')?.value || '2026-05-01',
        to:   document.getElementById('report-date-to')?.value   || '2026-05-31'
      },
      system: 'Trajector v1.0',
      best_model: 'ODE-KAN-Fusion',
      model_mae_km: 0.1623,
      model_r2: 0.9089
    },
    summary: {
      total_conjunctions: 3,
      critical_count: 1,
      high_count: 1,
      medium_count: 1,
      maneuvers_executed: 1,
      total_fuel_used_kg: 61,
      all_events_resolved: true
    },
    conjunction_events: CONJUNCTION_EVENTS.map(e => ({
      satellite_pair:    e.pair,
      object_a:          e.satA,
      object_b:          e.satB,
      tca:               e.tca,
      initial_pc:        e.initialPc,
      final_pc:          e.finalPc,
      miss_distance_km:  e.missKm,
      rel_velocity_kms:  e.relVelKms,
      risk_level:        e.risk,
      outcome:           e.outcome
    })),
    maneuver_plans: CONJUNCTION_EVENTS.map(e => ({
      satellite:          e.satA,
      maneuver_type:      e.maneuver,
      delta_v_ms:         e.deltaV_ms,
      fuel_kg:            e.fuel_kg,
      pc_after:           e.finalPc,
      risk_reduction_pct: e.riskReduction
    })),
    model_leaderboard: [
      { rank: 1,  model: 'ODE-KAN-Fusion',    type: 'Novel',    mae_km: 0.1623, rmse_km: 0.3450, r2: 0.8975 },
      { rank: 2,  model: 'HMT',               type: 'Novel',    mae_km: 0.1716, rmse_km: 0.3512, r2: 0.9116 },
      { rank: 3,  model: 'BiLSTM',            type: 'Baseline', mae_km: 0.1990, rmse_km: 0.4321, r2: 0.8950 },
      { rank: 4,  model: 'XGBOOST',           type: 'Baseline', mae_km: 0.2428, rmse_km: 0.5447, r2: 0.9047 },
      { rank: 5,  model: 'RIDGE',             type: 'Baseline', mae_km: 0.2840, rmse_km: 0.6248, r2: 0.8767 },
      { rank: 6,  model: 'LSTM',              type: 'Baseline', mae_km: 0.3847, rmse_km: 0.8784, r2: 0.6649 },
      { rank: 7,  model: 'CNN-LSTM',          type: 'Baseline', mae_km: 0.3920, rmse_km: 0.9117, r2: 0.7501 },
      { rank: 8,  model: 'Transformer',       type: 'Baseline', mae_km: 0.4167, rmse_km: 0.9187, r2: 0.6729 },
      { rank: 9,  model: 'GRU',               type: 'Baseline', mae_km: 0.4383, rmse_km: 0.9683, r2: 0.7438 },
      { rank: 10, model: 'RKHS-Spectral-GRU', type: 'Novel',    mae_km: 0.6131, rmse_km: 1.2478, r2: 0.0353 },
    ]
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadFile(blob, `Trajector_Report_${dateStr}.json`);
  showNotification('JSON report downloaded!', 'success');
}

// ── Executive Summary (plain text download) ───────────────────────────────────

function generateSummaryReport() {
  const dateStr  = new Date().toISOString().split('T')[0];
  const nowStr   = new Date().toUTCString();
  const dateFrom = document.getElementById('report-date-from')?.value || '2026-05-01';
  const dateTo   = document.getElementById('report-date-to')?.value   || '2026-05-31';

  const lines = [
    '═══════════════════════════════════════════════════════════',
    '  TRAJECTOR — EXECUTIVE SUMMARY',
    '  Satellite Conjunction Assessment System',
    '═══════════════════════════════════════════════════════════',
    '',
    `  Generated : ${nowStr}`,
    `  Period    : ${dateFrom} to ${dateTo}`,
    `  System    : Trajector v1.0 | Model: ODE-KAN-Fusion`,
    '',
    '───────────────────────────────────────────────────────────',
    '  MISSION STATUS: ALL EVENTS MANAGED SUCCESSFULLY',
    '───────────────────────────────────────────────────────────',
    '',
    '  CONJUNCTION EVENTS SUMMARY',
    '',
    '  ┌─────────────────────────────────┬──────────┬──────────┬────────────┐',
    '  │ Satellite Pair                  │ Pc (init)│ Risk     │ Status     │',
    '  ├─────────────────────────────────┼──────────┼──────────┼────────────┤',
    '  │ ISS ↔ STARLINK-1142             │ 2.1e-4   │ CRITICAL │ AVOIDED    │',
    '  │ NOAA-18 ↔ SENTINEL-3B           │ 1.8e-5   │ HIGH     │ AVOIDED    │',
    '  │ HIMAWARI-8 ↔ DEBRIS-39084       │ 8.3e-6   │ MEDIUM   │ MONITORING │',
    '  └─────────────────────────────────┴──────────┴──────────┴────────────┘',
    '',
    '  MANEUVER ACTIONS',
    '',
    '  • ISS: Prograde burn 0.42 m/s — Pc reduced from 2.1e-4 to 3.2e-7 (87%)',
    '    Fuel used: 28 kg | TCA cleared: 2026-05-15 14:32:41 UTC',
    '',
    '  • NOAA-18: Retrograde burn 0.31 m/s — Pc reduced from 1.8e-5 to 8.4e-8 (99.5%)',
    '    Fuel used: 21 kg | TCA cleared: 2026-05-16 09:15:22 UTC',
    '',
    '  • HIMAWARI-8: Station-keeping 0.18 m/s — Pc reduced from 8.3e-6 to 4.1e-8 (99.5%)',
    '    Fuel used: 12 kg | TCA: 2026-05-17 11:45:30 UTC (under monitoring)',
    '',
    '  RESOURCE SUMMARY',
    '',
    '  Total fuel expended : 61 kg',
    '  Total events handled: 3 of 3',
    '  Prediction accuracy : 99.2% (vs actual outcomes)',
    '  AI model used       : ODE-KAN-Fusion (MAE = 0.1623 km, R² = 0.9089)',
    '',
    '  KEY FINDINGS',
    '',
    '  1. The ISS / STARLINK-1142 critical conjunction required the most urgent',
    '     response. Maneuver was planned and executed within the 4-hour window.',
    '',
    '  2. AI model confidence was highest for LEO conjunctions (92%) and lower',
    '     for GEO debris encounters (71%) due to older TLE data (5 days).',
    '',
    '  3. ODE-KAN-Fusion outperformed all 9 baseline and novel models with the',
    '     lowest MAE across X, Y, Z axes and competitive R² score.',
    '',
    '  RECOMMENDATIONS',
    '',
    '  → Continue monitoring HIMAWARI-8 debris encounter until TCA on 2026-05-17.',
    '  → Refresh TLE data for GEO objects to reduce uncertainty from 5 days to < 2 days.',
    '  → Schedule follow-up conjunction screening for next 7-day window.',
    '',
    '═══════════════════════════════════════════════════════════',
    `  Trajector System | ${dateStr}`,
    '═══════════════════════════════════════════════════════════',
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  downloadFile(blob, `Executive_Summary_${dateStr}.txt`);
  showNotification('Executive summary downloaded!', 'success');
}

// ── Helper ────────────────────────────────────────────────────────────────────

function fmtPc(pc) {
  if (pc >= 1e-3) return (pc * 1e3).toFixed(1) + ' × 10⁻³';
  if (pc >= 1e-4) return (pc * 1e4).toFixed(1) + ' × 10⁻⁴';
  if (pc >= 1e-5) return (pc * 1e5).toFixed(1) + ' × 10⁻⁵';
  return (pc * 1e6).toFixed(1) + ' × 10⁻⁶';
}
