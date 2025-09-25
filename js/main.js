import { VisionEngine } from './vision.js';
import { TrainingModule } from './training.js';

// DOM elements
const videoEl = document.getElementById('video');
const canvasEl = document.getElementById('overlay');
const moduleSelect = document.getElementById('module-select');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const logEl = document.getElementById('log');

let visionEngine;
let trainingModule;

// CDN URLs we rely on
const TFJS_URL = 'https://unpkg.com/@tensorflow/tfjs@4.14.0/dist/tf.min.js';
const POSE_URL = 'https://unpkg.com/@tensorflow-models/pose-detection@3.1.0/dist/pose-detection.umd.js';

// UI logger
function log(msg) {
  console.log(msg);
  const p = document.createElement('p');
  p.textContent = msg;
  logEl.appendChild(p);
  logEl.scrollTop = logEl.scrollHeight;
}

// Load a script tag only once and wait for a global check to pass
function loadScriptOnce(src, checkFn, { timeoutMs = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    // Already available?
    try {
      if (checkFn()) return resolve();
    } catch (_) {}

    // Already added?
    const existing = Array.from(document.getElementsByTagName('script'))
      .find(s => s.src === src);
    if (existing) {
      // Poll for readiness
      const start = Date.now();
      const poll = () => {
        try {
          if (checkFn()) return resolve();
        } catch (_) {}
        if (Date.now() - start > timeoutMs) {
          return reject(new Error(`Timeout waiting for ${src}`));
        }
        setTimeout(poll, 100);
      };
      return poll();
    }

    // Create tag
    const script = document.createElement('script');
    script.src = src;
    script.async = false; // preserve order
    script.onload = () => {
      // Verify the global is present
      const start = Date.now();
      const poll = () => {
        try {
          if (checkFn()) return resolve();
        } catch (_) {}
        if (Date.now() - start > timeoutMs) {
          return reject(new Error(`Loaded ${src} but global not available`));
        }
        setTimeout(poll, 100);
      };
      poll();
    };
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

// Ensure TFJS and Pose Detection are present (from head or load now)
async function ensureLibraries() {
  // Load TFJS first
  await loadScriptOnce(TFJS_URL, () => !!window.tf);
  // Then pose-detection (depends on tfjs)
  await loadScriptOnce(POSE_URL, () => !!window.poseDetection);
}

async function setup() {
  // Make sure libraries are really available (regardless of HTML order/caching/CDN lag)
  await ensureLibraries();

  if (!visionEngine) {
    visionEngine = new VisionEngine(videoEl, canvasEl, () => {});
  }
  log('Initializing camera & pose model…');
  await visionEngine.init(); // may throw if permission denied or camera unavailable
  if (!trainingModule) {
    trainingModule = new TrainingModule(visionEngine, logEl);
  }
  log('Ready! Select a module and begin.');
}

// Start on user gesture (required on iOS/Safari)
startBtn.addEventListener('click', async () => {
  startBtn.disabled = true;
  stopBtn.disabled = false;
  moduleSelect.disabled = true;

  try {
    await setup();
    const module = moduleSelect.value;
    trainingModule.start(module);
    log('Session started.');
  } catch (err) {
    console.error('Setup error:', err);
    log(`Setup error: ${err.message || err}`);
    // Re-enable so user can try again
    startBtn.disabled = false;
    stopBtn.disabled = true;
    moduleSelect.disabled = false;
  }
});

stopBtn.addEventListener('click', () => {
  try {
    trainingModule?.stop();
  } finally {
    startBtn.disabled = false;
    stopBtn.disabled = true;
    moduleSelect.disabled = false;
  }
});

// No auto camera access here — we wait for Start button
window.addEventListener('load', () => {
  log('Libraries loaded. Tap Start Session to begin.');
});
