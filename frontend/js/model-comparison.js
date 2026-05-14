/* Model Comparison — leaderboard visualisation */

// Full leaderboard data (matches models/leaderboard.csv)
const LEADERBOARD = [
    { model: "ODE-KAN-Fusion",    type: "Novel",    mae_km: 0.16228, rmse_km: 0.34504, r2: 0.89746, train_time_s: 24.82,    mae_x: 0.47156, mae_y: 0.01040, mae_z: 0.00488 },
    { model: "HMT",               type: "Novel",    mae_km: 0.17164, rmse_km: 0.35124, r2: 0.91158, train_time_s: 27.64,    mae_x: 0.50071, mae_y: 0.01022, mae_z: 0.00400 },
    { model: "BiLSTM",            type: "Baseline", mae_km: 0.19901, rmse_km: 0.43206, r2: 0.89505, train_time_s: 0.0,      mae_x: 0.58124, mae_y: 0.01064, mae_z: 0.00515 },
    { model: "XGBoost",           type: "Baseline", mae_km: 0.24284, rmse_km: 0.54470, r2: 0.90465, train_time_s: 106.57,   mae_x: 0.71442, mae_y: 0.00941, mae_z: 0.00469 },
    { model: "Ridge",             type: "Baseline", mae_km: 0.28404, rmse_km: 0.62478, r2: 0.87672, train_time_s: 3.52,     mae_x: 0.83655, mae_y: 0.00980, mae_z: 0.00577 },
    { model: "LSTM",              type: "Baseline", mae_km: 0.38468, rmse_km: 0.87843, r2: 0.66486, train_time_s: 1622.60,  mae_x: 1.12521, mae_y: 0.02125, mae_z: 0.00758 },
    { model: "CNN-LSTM",          type: "Baseline", mae_km: 0.39204, rmse_km: 0.91173, r2: 0.75009, train_time_s: 0.0,      mae_x: 1.15393, mae_y: 0.01550, mae_z: 0.00669 },
    { model: "Transformer",       type: "Baseline", mae_km: 0.41669, rmse_km: 0.91868, r2: 0.67287, train_time_s: 0.0,      mae_x: 1.22240, mae_y: 0.01915, mae_z: 0.00854 },
    { model: "GRU",               type: "Baseline", mae_km: 0.43826, rmse_km: 0.96831, r2: 0.74377, train_time_s: 0.0,      mae_x: 1.29277, mae_y: 0.01482, mae_z: 0.00720 },
    { model: "RKHS-Spectral-GRU", type: "Novel",    mae_km: 0.61305, rmse_km: 1.24776, r2: 0.03528, train_time_s: 75.30,   mae_x: 1.79087, mae_y: 0.03491, mae_z: 0.01337 },
];

const BEST_IDX = 0; // ODE-KAN-Fusion has lowest MAE (already sorted)

// colour helpers
function barColor(d, idx) {
    if (idx === BEST_IDX) return "rgba(255,215,0,0.9)";
    return d.type === "Novel" ? "rgba(0,123,255,0.75)" : "rgba(108,117,125,0.65)";
}
function borderColor(d, idx) {
    if (idx === BEST_IDX) return "#0056b3";
    return d.type === "Novel" ? "#0056b3" : "#6c757d";
}

const labels  = LEADERBOARD.map(d => d.model);
const bgColors = LEADERBOARD.map((d, i) => barColor(d, i));
const bdColors = LEADERBOARD.map((d, i) => borderColor(d, i));

// ── populate best model banner ───────────────────────────────────────────────
const best = LEADERBOARD[BEST_IDX];
document.getElementById("best-model-name").textContent = best.model;
document.getElementById("best-mae").textContent  = best.mae_km.toFixed(4);
document.getElementById("best-rmse").textContent = best.rmse_km.toFixed(4);
document.getElementById("best-r2").textContent   = best.r2.toFixed(4);

// ── shared Chart.js defaults ─────────────────────────────────────────────────
Chart.defaults.font.family = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
Chart.defaults.font.size   = 11;
Chart.defaults.color       = "#6c757d";

function makeBarChart(id, datasets, opts = {}) {
    const ctx = document.getElementById(id).getContext("2d");
    return new Chart(ctx, {
        type: "bar",
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: opts.showLegend ?? false },
                tooltip: {
                    callbacks: {
                        label: ctx => ` ${ctx.dataset.label || ""}: ${Number(ctx.raw).toFixed(4)} ${opts.unit || ""}`,
                    },
                },
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { maxRotation: 35, minRotation: 25, font: { size: 10 } },
                },
                y: {
                    grid: { color: "rgba(0,0,0,0.06)" },
                    beginAtZero: true,
                    title: { display: !!opts.yLabel, text: opts.yLabel, font: { size: 11 } },
                    ...( opts.yMax ? { max: opts.yMax } : {} ),
                },
            },
            animation: { duration: 600, easing: "easeOutQuart" },
        },
    });
}

// ── Main chart (swappable) ───────────────────────────────────────────────────
let activeMetric = "mae";
const mainChartTitles = {
    mae:  "Mean Absolute Error — Lower is Better (km)",
    rmse: "Root Mean Squared Error — Lower is Better (km)",
    r2:   "R² Score — Higher is Better (max 1.0)",
};

function mainDataset(metric) {
    const vals = LEADERBOARD.map(d =>
        metric === "mae"  ? d.mae_km  :
        metric === "rmse" ? d.rmse_km : d.r2
    );
    return [{
        label: metric.toUpperCase(),
        data: vals,
        backgroundColor: bgColors,
        borderColor: bdColors,
        borderWidth: 2,
        borderRadius: 6,
        borderSkipped: false,
    }];
}

const mainChart = makeBarChart("mainChart", mainDataset("mae"), {
    unit: "km",
    yLabel: "Error (km)",
});

// metric toggle
document.querySelectorAll(".toggle-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".toggle-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        activeMetric = btn.dataset.metric;
        mainChart.data.datasets = mainDataset(activeMetric);
        mainChart.options.scales.y.title.text = activeMetric === "r2" ? "R²" : "Error (km)";
        document.getElementById("main-chart-title").textContent = mainChartTitles[activeMetric];
        mainChart.update();
    });
});

// ── Axis error chart (grouped bars) ─────────────────────────────────────────
makeBarChart("axisChart", [
    {
        label: "MAE X",
        data: LEADERBOARD.map(d => d.mae_x),
        backgroundColor: "rgba(0,86,179,0.7)",
        borderColor: "#0056b3",
        borderWidth: 1.5,
        borderRadius: 4,
    },
    {
        label: "MAE Y",
        data: LEADERBOARD.map(d => d.mae_y),
        backgroundColor: "rgba(0,200,120,0.7)",
        borderColor: "#00a86b",
        borderWidth: 1.5,
        borderRadius: 4,
    },
    {
        label: "MAE Z",
        data: LEADERBOARD.map(d => d.mae_z),
        backgroundColor: "rgba(255,150,0,0.7)",
        borderColor: "#cc7700",
        borderWidth: 1.5,
        borderRadius: 4,
    },
], { showLegend: true, unit: "km", yLabel: "MAE (km)" });

// ── RMSE vs MAE chart ────────────────────────────────────────────────────────
makeBarChart("errorSpreadChart", [
    {
        label: "MAE",
        data: LEADERBOARD.map(d => d.mae_km),
        backgroundColor: "rgba(0,123,255,0.7)",
        borderColor: "#0056b3",
        borderWidth: 1.5,
        borderRadius: 4,
    },
    {
        label: "RMSE",
        data: LEADERBOARD.map(d => d.rmse_km),
        backgroundColor: "rgba(220,53,69,0.6)",
        borderColor: "#dc3545",
        borderWidth: 1.5,
        borderRadius: 4,
    },
], { showLegend: true, unit: "km", yLabel: "Error (km)" });

// ── R² chart ─────────────────────────────────────────────────────────────────
makeBarChart("r2Chart", [{
    label: "R²",
    data: LEADERBOARD.map(d => d.r2),
    backgroundColor: LEADERBOARD.map((d, i) =>
        i === BEST_IDX ? "rgba(255,215,0,0.85)" :
        d.r2 >= 0.9    ? "rgba(0,180,80,0.75)"  :
        d.r2 >= 0.7    ? "rgba(0,123,255,0.65)" : "rgba(220,53,69,0.6)"
    ),
    borderColor: LEADERBOARD.map((d, i) =>
        i === BEST_IDX ? "#0056b3" :
        d.r2 >= 0.9    ? "#00a050" :
        d.r2 >= 0.7    ? "#0056b3" : "#dc3545"
    ),
    borderWidth: 2,
    borderRadius: 5,
}], { yMax: 1.05, unit: "", yLabel: "R²" });

// ── Train-time chart ─────────────────────────────────────────────────────────
const timeCtx = document.getElementById("trainTimeChart").getContext("2d");
new Chart(timeCtx, {
    type: "bar",
    data: {
        labels,
        datasets: [{
            label: "Train Time (s)",
            data: LEADERBOARD.map(d => d.train_time_s),
            backgroundColor: LEADERBOARD.map((d, i) =>
                i === BEST_IDX ? "rgba(255,215,0,0.85)" :
                d.type === "Novel" ? "rgba(0,123,255,0.7)" : "rgba(108,117,125,0.6)"
            ),
            borderColor: bdColors,
            borderWidth: 2,
            borderRadius: 6,
        }],
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label: ctx => ` ${Number(ctx.raw).toFixed(1)} s`,
                    afterLabel: ctx => ctx.raw === 0 ? " (pre-trained / cached)" : "",
                },
            },
        },
        scales: {
            x: { grid: { display: false }, ticks: { maxRotation: 35, minRotation: 25, font: { size: 10 } } },
            y: { grid: { color: "rgba(0,0,0,0.06)" }, beginAtZero: true, title: { display: true, text: "Seconds" } },
        },
        animation: { duration: 600, easing: "easeOutQuart" },
    },
});

// ── Metrics table ─────────────────────────────────────────────────────────────
function buildTable(data) {
    const tbody = document.getElementById("table-body");
    tbody.innerHTML = "";
    data.forEach((d, i) => {
        const origIdx = LEADERBOARD.indexOf(d);
        const isBest  = origIdx === BEST_IDX;
        const rank    = i + 1;
        const rankClass = rank <= 3 ? `rank-${rank}` : "rank-other";
        const typeClass  = d.type === "Novel" ? "novel" : "baseline";
        const tr = document.createElement("tr");
        if (isBest) tr.classList.add("row-best");
        tr.innerHTML = `
            <td><span class="rank-badge ${rankClass}">${rank}</span></td>
            <td>${isBest ? "🏆 " : ""}${d.model}</td>
            <td><span class="type-badge ${typeClass}">${d.type === "Novel" ? "★ Novel" : "Baseline"}</span></td>
            <td class="metric-cell${isBest ? " best-val" : ""}">${d.mae_km.toFixed(5)}</td>
            <td class="metric-cell">${d.rmse_km.toFixed(5)}</td>
            <td class="metric-cell">${d.r2.toFixed(5)}</td>
            <td class="metric-cell">${d.train_time_s > 0 ? d.train_time_s.toFixed(2) : "—"}</td>
            <td class="metric-cell">${d.mae_x.toFixed(4)}</td>
            <td class="metric-cell">${d.mae_y.toFixed(5)}</td>
            <td class="metric-cell">${d.mae_z.toFixed(5)}</td>
        `;
        tbody.appendChild(tr);
    });
}

buildTable([...LEADERBOARD]);

// sortable columns
let sortDir = { mae_km: 1, rmse_km: 1, r2: -1 };
document.querySelectorAll("th.sortable").forEach(th => {
    th.addEventListener("click", () => {
        const col = th.dataset.col;
        sortDir[col] = -sortDir[col];
        document.querySelectorAll("th.sortable").forEach(h => h.classList.remove("active"));
        th.classList.add("active");
        th.textContent = th.textContent.replace(/[↑↓]/, sortDir[col] === 1 ? "↑" : "↓");
        const sorted = [...LEADERBOARD].sort((a, b) => sortDir[col] * (a[col] - b[col]));
        buildTable(sorted);
    });
});
