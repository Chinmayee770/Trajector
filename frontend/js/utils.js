// Utility Functions for Trajector Frontend

/**
 * API Configuration and Helper Functions
 */
const API_CONFIG = {
    baseURL: 'http://localhost:5000/api', // Change to your backend URL
    timeout: 5000
};

/**
 * Make API request
 */
async function apiCall(endpoint, options = {}) {
    const {
        method = 'GET',
        headers = {},
        body = null,
        timeout = API_CONFIG.timeout
    } = options;

    const url = `${API_CONFIG.baseURL}${endpoint}`;
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            },
            body: body ? JSON.stringify(body) : null,
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`API Call Failed: ${endpoint}`, error);
        throw error;
    }
}

/**
 * Format large numbers with K, M, B notation
 */
function formatNumber(num) {
    if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toFixed(0);
}

/**
 * Format scientific notation for small numbers (collision probabilities)
 */
function formatScientific(num) {
    if (Math.abs(num) < 1e-10) return '0';
    return num.toExponential(2);
}

/**
 * Format date and time
 */
function formatDate(date, format = 'datetime') {
    const d = new Date(date);
    
    if (format === 'datetime') {
        return d.toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone: 'UTC'
        }) + ' UTC';
    } else if (format === 'date') {
        return d.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } else if (format === 'time') {
        return d.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone: 'UTC'
        });
    }
}

/**
 * Format distance in kilometers
 */
function formatDistance(km) {
    if (km >= 1000) return (km / 1000).toFixed(2) + ' Mm';
    return km.toFixed(2) + ' km';
}

/**
 * Format velocity in km/s
 */
function formatVelocity(kms) {
    return kms.toFixed(3) + ' km/s';
}

/**
 * Get risk level based on collision probability
 */
function getRiskLevel(pc) {
    if (pc > 1e-3) return 'CRITICAL';
    if (pc > 1e-4) return 'HIGH';
    if (pc > 1e-5) return 'MEDIUM';
    return 'LOW';
}

/**
 * Get risk color based on collision probability
 */
function getRiskColor(pc) {
    if (pc > 1e-3) return '#ff0000'; // Red
    if (pc > 1e-4) return '#ff6600'; // Orange
    if (pc > 1e-5) return '#ffaa00'; // Yellow
    return '#00cc44'; // Green
}

/**
 * Get risk class for styling
 */
function getRiskClass(pc) {
    if (pc > 1e-3) return 'risk-critical';
    if (pc > 1e-4) return 'risk-high';
    if (pc > 1e-5) return 'risk-medium';
    return 'risk-low';
}

/**
 * Debounce function for event handlers
 */
function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

/**
 * Throttle function for performance
 */
function throttle(func, limit) {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Calculate time difference from now
 */
function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + ' min ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + ' hour' + (Math.floor(seconds / 3600) > 1 ? 's' : '') + ' ago';
    
    return Math.floor(seconds / 86400) + ' day' + (Math.floor(seconds / 86400) > 1 ? 's' : '') + ' ago';
}

/**
 * Generate random color
 */
function getRandomColor() {
    const colors = [
        '#00d4ff', '#0080ff', '#00cc44', '#ffaa00',
        '#ff6600', '#ff0000', '#ff1493', '#00bfff'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Clone object deeply
 */
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * Create a notification toast
 */
function showNotification(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Remove after duration
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

/**
 * Parse TLE format satellite data
 */
function parseTLE(line0, line1, line2) {
    try {
        return {
            name: line0.trim(),
            satelliteNumber: parseInt(line1.substring(2, 7)),
            epochYear: 2000 + parseInt(line1.substring(18, 20)),
            epochDay: parseFloat(line1.substring(20, 32)),
            inclination: parseFloat(line2.substring(8, 16)),
            rightAscension: parseFloat(line2.substring(17, 25)),
            eccentricity: parseFloat('0.' + line2.substring(26, 33)),
            argumentPerigee: parseFloat(line2.substring(34, 42)),
            meanAnomaly: parseFloat(line2.substring(43, 51)),
            meanMotion: parseFloat(line2.substring(52, 63))
        };
    } catch (error) {
        console.error('Error parsing TLE:', error);
        return null;
    }
}

/**
 * Calculate orbital period from mean motion (revolutions per day)
 */
function calculateOrbitalPeriod(meanMotion) {
    return (24 * 60) / meanMotion; // Returns period in minutes
}

/**
 * Create a 2D canvas context with proper scaling.
 * Falls back to offsetWidth/offsetHeight when getBoundingClientRect returns 0
 * (which happens before first layout in some browsers).
 */
function createCanvasContext(canvas) {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    const rect = canvas.getBoundingClientRect();
    const width  = (rect.width  > 0 ? rect.width  : canvas.offsetWidth)  || 600;
    const height = (rect.height > 0 ? rect.height : canvas.offsetHeight) || 400;

    canvas.width  = width  * dpr;
    canvas.height = height * dpr;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    return { ctx, width, height };
}

/**
 * Draw a gradient circle
 */
function drawGradientCircle(ctx, x, y, radius, color1, color2) {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, color1);
    gradient.addColorStop(1, color2);
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
}

/**
 * Check if a point is inside a rectangle
 */
function isPointInRect(point, rect) {
    return point.x >= rect.x && point.x <= rect.x + rect.width &&
           point.y >= rect.y && point.y <= rect.y + rect.height;
}

/**
 * Calculate distance between two points
 */
function distance(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Clamp a value between min and max
 */
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * Linear interpolation
 */
function lerp(start, end, t) {
    return start + (end - start) * t;
}

/**
 * Easing functions
 */
const easing = {
    linear: (t) => t,
    easeInQuad: (t) => t * t,
    easeOutQuad: (t) => t * (2 - t),
    easeInOutQuad: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    easeInCubic: (t) => t * t * t,
    easeOutCubic: (t) => (--t) * t * t + 1,
    easeOutExpo: (t) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
};

/**
 * Animate a value from start to end
 */
function animateValue(start, end, duration, callback, easingFunc = easing.easeOutQuad) {
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easingFunc(progress);
        const value = start + (end - start) * easedProgress;
        
        callback(value);
        
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    
    requestAnimationFrame(update);
}

/**
 * Export data as JSON
 */
function exportJSON(data, filename) {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    downloadFile(blob, filename);
}

/**
 * Export data as CSV
 */
function exportCSV(data, filename) {
    if (!Array.isArray(data) || data.length === 0) return;
    
    const headers = Object.keys(data[0]);
    const csv = [
        headers.join(','),
        ...data.map(row => headers.map(h => JSON.stringify(row[h])).join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    downloadFile(blob, filename);
}

/**
 * Generic file download helper
 */
function downloadFile(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Add notification styles if not already present
function addNotificationStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .toast {
            position: fixed;
            bottom: -100px;
            left: 50%;
            transform: translateX(-50%);
            background: var(--bg-light);
            color: var(--text-primary);
            padding: 15px 25px;
            border-radius: 8px;
            border-left: 4px solid var(--primary-color);
            z-index: 10000;
            transition: bottom 0.3s ease;
        }
        
        .toast.show {
            bottom: 20px;
        }
        
        .toast-success {
            border-left-color: var(--success-color);
        }
        
        .toast-error {
            border-left-color: var(--danger-color);
        }
        
        .toast-warning {
            border-left-color: var(--warning-color);
        }
        
        .toast-info {
            border-left-color: var(--primary-color);
        }
    `;
    document.head.appendChild(style);
}

// Initialize notification styles on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addNotificationStyles);
} else {
    addNotificationStyles();
}
