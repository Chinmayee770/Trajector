// Advanced CesiumJS Satellite Visualization System
// Features: Realistic Earth, Multiple Satellites, Interactive Controls, Real-time Updates

console.log('CesiumJS visualization script loaded');

// Global variables
let viewer;
let satellites = new Map();
let orbits = new Map();
let conjunctionZones = [];
let selectedSatellites = new Set();
let simulationTime = new Date();
let simulationSpeed = 1;
let isSimulationRunning = false;
let timeSpeedMultiplier = 1;

// Satellite data (would come from API in real implementation)
const satelliteData = [
    { id: 25544,  name: 'ISS',           type: 'space_station',    altitude: 408, inclination: 51.6, color: Cesium.Color.RED },
    { id: 44713,  name: 'STARLINK-1007', type: 'starlink',         altitude: 550, inclination: 53.1, color: Cesium.Color.CYAN },
    { id: 44714,  name: 'STARLINK-1008', type: 'starlink',         altitude: 550, inclination: 53.1, color: Cesium.Color.CYAN },
    { id: 44715,  name: 'STARLINK-1009', type: 'starlink',         altitude: 550, inclination: 53.1, color: Cesium.Color.CYAN },
    { id: 20580,  name: 'HST',           type: 'telescope',        altitude: 547, inclination: 28.5, color: Cesium.Color.PURPLE },
    { id: 28654,  name: 'NOAA-18',       type: 'weather',          altitude: 854, inclination: 98.7, color: Cesium.Color.ORANGE },
    { id: 39084,  name: 'SENTINEL-3A',   type: 'earth_observation',altitude: 814, inclination: 98.6, color: Cesium.Color.GREEN },
    { id: 39086,  name: 'SENTINEL-3B',   type: 'earth_observation',altitude: 814, inclination: 98.6, color: Cesium.Color.GREEN }
];

const API_BASE = 'http://localhost:5000/api';

// Fetch live satellite data (TLE + orbital params) from the Flask API.
// Falls back to hardcoded satelliteData on failure.
async function fetchLiveSatellites() {
    try {
        const resp = await fetch(`${API_BASE}/satellites`, { signal: AbortSignal.timeout(8000) });
        if (!resp.ok) throw new Error('API error');
        const json = await resp.json();
        const live = (json.satellites || []).map(s => ({
            id:          s.norad_id,
            name:        s.name,
            type:        s.type,
            altitude:    s.altitude_km || 400,
            inclination: s.inclination || 0,
            tle_line1:   s.tle_line1,
            tle_line2:   s.tle_line2,
            color:       Cesium.Color.fromCssColorString(s.color || '#06b6d4'),
            source:      'spacetrack',
        }));
        if (live.length > 0) {
            console.log(`Loaded ${live.length} satellites from Space-Track via API`);
            return live;
        }
    } catch (e) {
        console.warn('API unavailable, using local TLE data:', e.message);
    }
    return satelliteData;
}

// Initialize CesiumJS viewer
document.addEventListener('DOMContentLoaded', async function() {
    console.log('DOMContentLoaded fired, initializing CesiumJS visualization');

    await initializeViewer();
    initializeUI();

    // Load live TLE data, then create satellite entities
    const liveSats = await fetchLiveSatellites();
    createSatellitesFromData(liveSats);

    setupEventListeners();
    setInterval(updateTime, 1000);
    setInterval(updateHUD, 100);

    console.log('CesiumJS visualization initialized successfully');
});

/**
 * Initialize Cesium Viewer with built-in Natural Earth II imagery (no token required).
 */
async function initializeViewer() {
    const container = document.getElementById('canvas-container');

    // Use Natural Earth II imagery that ships with CesiumJS — no Ion token needed.
    const baseLayer = Cesium.ImageryLayer.fromProviderAsync(
        Cesium.TileMapServiceImageryProvider.fromUrl(
            Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII'),
            { fileExtension: 'jpg', maximumLevel: 5 }
        )
    );

    viewer = new Cesium.Viewer(container, {
        animation:             false,
        baseLayerPicker:       false,
        fullscreenButton:      false,
        geocoder:              false,
        homeButton:            false,
        infoBox:               true,
        navigationHelpButton:  false,
        sceneModePicker:       false,
        selectionIndicator:    true,
        timeline:              false,
        baseLayer:             baseLayer,
        // Flat ellipsoid terrain so no Ion terrain token is needed
        terrainProvider:       new Cesium.EllipsoidTerrainProvider()
    });

    // Atmosphere / lighting
    viewer.scene.globe.enableLighting         = true;
    viewer.scene.globe.atmosphereLightIntensity = 2.0;

    // Initial camera — pull back enough to see the full globe
    viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(0.0, 20.0, 20000000.0)
    });

    // Show stars
    viewer.scene.skyBox = new Cesium.SkyBox({
        sources: {
            positiveX: Cesium.buildModuleUrl('Assets/Textures/SkyBox/tycho2t3_80_px.jpg'),
            negativeX: Cesium.buildModuleUrl('Assets/Textures/SkyBox/tycho2t3_80_mx.jpg'),
            positiveY: Cesium.buildModuleUrl('Assets/Textures/SkyBox/tycho2t3_80_py.jpg'),
            negativeY: Cesium.buildModuleUrl('Assets/Textures/SkyBox/tycho2t3_80_my.jpg'),
            positiveZ: Cesium.buildModuleUrl('Assets/Textures/SkyBox/tycho2t3_80_pz.jpg'),
            negativeZ: Cesium.buildModuleUrl('Assets/Textures/SkyBox/tycho2t3_80_mz.jpg')
        }
    });
    viewer.scene.skyAtmosphere.show = true;

    console.log('Cesium viewer initialized');
}

/**
 * Initialize UI elements.
 */
function initializeUI() {
    const searchInput = document.getElementById('satellite-search');
    if (searchInput) {
        searchInput.addEventListener('input', function () {
            const q = this.value.toLowerCase();
            document.querySelectorAll('.satellite-item').forEach(item => {
                const name = item.dataset.name || '';
                item.style.display = name.toLowerCase().includes(q) ? '' : 'none';
            });
        });
    }
    console.log('UI initialized');
}

const TYPE_COLOR_MAP = {
    space_station:    '#ef4444',
    starlink:         '#06b6d4',
    telescope:        '#a855f7',
    weather:          '#f97316',
    earth_observation:'#22c55e'
};

function populateSatelliteList(dataArray) {
    const list = document.getElementById('satellite-list');
    if (!list) return;
    list.innerHTML = '';
    (dataArray || satelliteData).forEach(sat => {
        const cssColor = TYPE_COLOR_MAP[sat.type] || '#6b7280';
        const typeLabel = sat.type.replace(/_/g, ' ');
        const item = document.createElement('div');
        item.className = 'satellite-item';
        item.dataset.name = sat.name;
        item.dataset.id   = sat.id;
        item.innerHTML = `
            <div class="satellite-color" style="background:${cssColor}"></div>
            <div class="satellite-info">
                <div class="satellite-name">${sat.name}</div>
                <div class="satellite-type">${typeLabel}</div>
            </div>
            <div class="satellite-status">
                <span class="altitude">${sat.altitude} km</span>
            </div>`;
        item.addEventListener('click', () => focusSatellite(sat.id));
        list.appendChild(item);
    });
}

function focusSatellite(id) {
    document.querySelectorAll('.satellite-item').forEach(el => el.classList.remove('selected'));
    const clicked = document.querySelector(`.satellite-item[data-id="${id}"]`);
    if (clicked) clicked.classList.add('selected');

    const satEntry = satellites.get(id);
    if (!satEntry || !viewer) return;
    const entity = satEntry.entity;
    if (entity) {
        viewer.trackedEntity = entity;
        entity.label.show = true;
        setTimeout(() => { entity.label.show = false; }, 4000);
    }
}

function createSatellitesFromData(dataArray) {
    dataArray.forEach(data => createSatellite(data));
    populateSatelliteList(dataArray);
}

/**
 * Create a single satellite entity with an orbital path.
 */
function createSatellite(data) {
    const semiMajorAxis = 6371 + data.altitude; // km
    const eccentricity  = 0.0;
    const inclination   = Cesium.Math.toRadians(data.inclination);
    const raan          = 0.0;
    const argOfPeriapsis = 0.0;

    const positionProp = new Cesium.SampledPositionProperty();

    const entity = viewer.entities.add({
        id:          data.id.toString(),
        name:        data.name,
        position:    positionProp,
        orientation: new Cesium.VelocityOrientationProperty(positionProp),
        point: {
            pixelSize:    8,
            color:        data.color,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 1
        },
        label: {
            text:           data.name,
            font:           '12pt Arial',
            fillColor:      data.color,
            outlineColor:   Cesium.Color.BLACK,
            outlineWidth:   2,
            style:          Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset:    new Cesium.Cartesian2(0, -32),
            show:           false
        }
    });

    // Sample orbital positions over 24 hours (1 sample per minute)
    const startTime    = Cesium.JulianDate.now();
    const totalSamples = 1440;
    const times        = [];
    const positions    = [];

    for (let i = 0; i < totalSamples; i++) {
        const time        = Cesium.JulianDate.addMinutes(startTime, i, new Cesium.JulianDate());
        const meanAnomaly = (2 * Math.PI * i) / totalSamples;
        const pos         = calculateOrbitalPosition(semiMajorAxis, eccentricity, inclination, raan, argOfPeriapsis, meanAnomaly);
        times.push(time);
        positions.push(pos);
    }

    positionProp.addSamples(times, positions);

    // Orbital path polyline
    const orbitPath = viewer.entities.add({
        polyline: {
            positions: new Cesium.CallbackProperty(() => positions, true),
            width:     2,
            material:  new Cesium.PolylineGlowMaterialProperty({
                glowPower: 0.1,
                color:     data.color.withAlpha(0.3)
            }),
            show: true
        }
    });

    satellites.set(data.id, {
        entity:  entity,
        orbit:   orbitPath,
        data:    data,
        period:  calculateOrbitalPeriod(semiMajorAxis)
    });

    console.log(`Created satellite: ${data.name}`);
}

/**
 * Kepler's third law — returns period in seconds.
 */
function calculateOrbitalPeriod(semiMajorAxisKm) {
    const mu = 3.986004418e14; // m³/s²
    const a  = semiMajorAxisKm * 1000;
    return 2 * Math.PI * Math.sqrt(Math.pow(a, 3) / mu);
}

/**
 * Orbital position in Earth-centred inertial frame (km → Cesium Cartesian3 in metres).
 */
function calculateOrbitalPosition(a, e, i, Omega, omega, M) {
    // Circular orbit: true anomaly == mean anomaly
    const nu = M;
    const r  = a * 1000; // convert km to m

    const cosOmega = Math.cos(Omega);
    const sinOmega = Math.sin(Omega);
    const cosomega = Math.cos(omega);
    const sinomega = Math.sin(omega);
    const cosnu    = Math.cos(nu);
    const sinnu    = Math.sin(nu);
    const cosi     = Math.cos(i);

    const X = r * ((cosOmega * cosomega - sinOmega * sinomega * cosi) * cosnu +
                   (-cosOmega * sinomega - sinOmega * cosomega * cosi) * sinnu);
    const Y = r * ((sinOmega * cosomega + cosOmega * sinomega * cosi) * cosnu +
                   (-sinOmega * sinomega + cosOmega * cosomega * cosi) * sinnu);
    const Z = r * (sinomega * Math.sin(i) * cosnu + cosomega * Math.sin(i) * sinnu);

    return new Cesium.Cartesian3(X, Y, Z);
}

/**
 * Setup all UI event listeners (single definition).
 */
function setupEventListeners() {
    console.log('Setting up event listeners');

    // Camera controls
    document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
        viewer.camera.zoomIn(500000);
    });
    document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
        viewer.camera.zoomOut(500000);
    });
    document.getElementById('btn-rotate-reset')?.addEventListener('click', () => {
        viewer.camera.setView({
            destination: Cesium.Cartesian3.fromDegrees(0.0, 20.0, 20000000.0)
        });
    });
    document.getElementById('btn-earth-view')?.addEventListener('click', () => {
        viewer.camera.setView({
            destination: Cesium.Cartesian3.fromDegrees(0.0, 0.0, 30000000.0)
        });
    });
    document.getElementById('btn-follow-satellite')?.addEventListener('click', () => {
        if (selectedSatellites.size > 0) {
            const id  = [...selectedSatellites][0];
            const sat = satellites.get(id);
            if (sat) viewer.trackedEntity = sat.entity;
        }
    });

    // Layer toggles
    document.getElementById('layer-iss')?.addEventListener('change', (e) => {
        satellites.forEach(sat => {
            if (sat.data.type === 'space_station') {
                sat.entity.show = e.target.checked;
                sat.orbit.show  = e.target.checked;
            }
        });
    });
    document.getElementById('layer-starlink')?.addEventListener('change', (e) => {
        satellites.forEach(sat => {
            if (sat.data.type === 'starlink') {
                sat.entity.show = e.target.checked;
                sat.orbit.show  = e.target.checked;
            }
        });
    });
    document.getElementById('layer-debris')?.addEventListener('change', (e) => {
        satellites.forEach(sat => {
            if (sat.data.type === 'debris') {
                sat.entity.show = e.target.checked;
                sat.orbit.show  = e.target.checked;
            }
        });
    });
    document.getElementById('layer-orbits')?.addEventListener('change', (e) => {
        satellites.forEach(sat => { sat.orbit.show = e.target.checked; });
    });

    // Simulation controls
    document.getElementById('time-speed')?.addEventListener('input', (e) => {
        timeSpeedMultiplier = parseFloat(e.target.value);
        document.getElementById('speed-value').textContent = timeSpeedMultiplier + 'x';
        viewer.clock.multiplier = timeSpeedMultiplier;
    });
    document.getElementById('btn-play-pause')?.addEventListener('click', () => {
        isSimulationRunning = !isSimulationRunning;
        const btn = document.getElementById('btn-play-pause');
        if (btn) {
            btn.innerHTML = isSimulationRunning
                ? '<i class="fas fa-pause"></i> Pause'
                : '<i class="fas fa-play"></i> Start';
        }
        if (isSimulationRunning) {
            viewer.clock.shouldAnimate = true;
        } else {
            viewer.clock.shouldAnimate = false;
        }
    });
    document.getElementById('btn-reset-time')?.addEventListener('click', () => {
        simulationTime = new Date();
        viewer.clock.currentTime = Cesium.JulianDate.fromDate(simulationTime);
    });

    // Entity selection
    viewer.selectedEntityChanged.addEventListener((selectedEntity) => {
        if (selectedEntity) {
            const id = parseInt(selectedEntity.id);
            if (satellites.has(id)) selectSatellite(id);
        } else {
            clearSelection();
        }
    });

    console.log('Event listeners setup complete');
}

function selectSatellite(id) {
    clearSelection();
    selectedSatellites.add(id);
    const sat = satellites.get(id);
    if (sat) {
        sat.entity.label.show = true;
        updateSatelliteInfo(sat);
    }
}

function clearSelection() {
    selectedSatellites.forEach(id => {
        const sat = satellites.get(id);
        if (sat) sat.entity.label.show = false;
    });
    selectedSatellites.clear();
    const infoEl = document.getElementById('satellite-info');
    if (infoEl) infoEl.innerHTML = '<p>Select a satellite to view details</p>';
}

function updateSatelliteInfo(satellite) {
    const infoEl = document.getElementById('satellite-info');
    if (!infoEl || !satellite) return;
    const d = satellite.data;
    infoEl.innerHTML = `
        <h4>${d.name}</h4>
        <p><strong>Type:</strong> ${d.type.replace(/_/g, ' ').toUpperCase()}</p>
        <p><strong>Altitude:</strong> ${d.altitude} km</p>
        <p><strong>Inclination:</strong> ${d.inclination}°</p>
        <p><strong>Orbital Period:</strong> ${Math.round(satellite.period / 60)} min</p>
    `;
}

function updateTime() {
    const el = document.getElementById('current-time');
    if (el) el.textContent = new Date().toLocaleTimeString();

    const hudTime = document.getElementById('hud-time');
    if (hudTime) hudTime.textContent = simulationTime.toLocaleTimeString();
}

function updateHUD() {
    const hudSel  = document.getElementById('hud-selected-count');
    const hudSats = document.getElementById('hud-satellite-count');
    if (hudSel)  hudSel.textContent  = selectedSatellites.size;
    if (hudSats) hudSats.textContent = satellites.size;
}
