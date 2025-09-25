import { VisionEngine } from './vision.js';
import { TrainingModule } from './training.js';

// --- DOM ---
const videoEl = document.getElementById('video');
const canvasEl = document.getElementById('overlay');
const moduleSelect = document.getElementById('module-select');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const logEl = document.getElementById('log');

// --- State ---
let visionEngine;
let trainingModule;

// --- Logging ---
function log(msg) {
  console.log(msg);
  const p = document.createElement('p');
  p.textContent = msg;
  logEl.appendChild(p);
  logEl.scrollTop = logEl.scrollHeight;
}

// --- Script loader with fallbacks ---
async function loadScriptWithFallbacks(urls, checkFn, timeoutPerUrl = 9000) {
  for (const url of urls) {
    const ok = await new Promise((resolve) => {
      // Already present?
      try { if (checkFn()) return resolve(true); } catch {}

      const s = document.createElement('script');
      s.src = url;
      s.async = false;               // preserve order (TFJS before pose-detection)
      s.crossOrigin = 'anonymous';
      let finished = false;

      const done = (result) => {
        if (finished) return;
        finished = true;
        resolve(result);
      };

      // Give the script time to load AND expose its global
      const start = Date.now();
      const poll = () => {
        try { if (checkFn()) return done(true); } catch {}
        if (Date.now() - start > timeoutPerUrl) return done(false);
        setTimeout(poll, 120);
      };

      s.onload = () => {
        // Start polling for the expected global
        poll();
      };
      s.onerror = () => done(false);

      document.head.appendChild(s);
    });

    if (ok) return true; // this URL worked
  }
  return false; // all URLs failed
}

// --- Multi-CDN candidates (order matters) ---
const TFJS_URLS = [
  // jsDelivr first (fast, version-pinned)
  'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.14.0/dist/tf.min.js',
  // unpkg fallback
  'https://unpkg.com/@tensorflow/tfjs@4.14.0/dist/tf.min.js',
  // last-resort: latest (not ideal, but better than failing)
  'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs/dist/tf.min.js',
];

const POSE_URLS = [
  // jsDelivr UMD
  'https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection@3.1.0/dist/pose-detection.umd.js',
  // unpkg UMD
  'https://unpkg.com/@tensorflow-models/pose-detection@3.1.0/dist/pose-detection.umd.js',
  // older UMD (in case 3.1.0 path is flaky)
  'https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection@3.0.0/dist/pose-detection.umd.js',
  'https://unpkg.com/@tensorflow-models/pose-detection@3.0.0/dist/pose-detection.umd.js',
  // last-resort: latest UMD
  'https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection/dist/pose-detection.umd.js',
];

// Ensure TFJS and pose-detection are present before continuing
async function ensureLibraries() {
  const tfOk = await loadScriptWithFallbacks(TFJS_URLS, () => !!window.tf);
  if (!tfOk) throw new Error('Unable to load TensorFlow.js from any CDN');

  const poseOk = await loadScriptWithFallbacks(POSE_URLS, () => !!window.poseDetection);
  if (!poseOk) throw new Error('Unable to load Pose Detection from any CDN');
}

async function setup() {
  // Must run after a user gesture on iOS (we call from Start button)
  log('Initializing camera & pose model…');

  // Load libs (or confirm they’re present)
  await ensureLibraries();

  if (!visionEngine) visionEngine = new VisionEngine(videoEl, canvasEl, () => {});
  await visionEngine.init(); // may throw if permission denied or camera unavailable

  if (!trainingModule) trainingModule = new TrainingModule(visionEngine, logEl);
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
  try { trainingModule?.stop(); }
  finally {
    startBtn.disabled = false;
    stopBtn.disabled = true;
    moduleSelect.disabled = false;
  }
});

// No auto camera access here — we wait for Start button
window.addEventListener('load', () => {
  log('Libraries loaded. Tap Start Session to begin.');
});
