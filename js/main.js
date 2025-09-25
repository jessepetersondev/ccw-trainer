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

// UI logger
function log(msg) {
  console.log(msg);
  const p = document.createElement('p');
  p.textContent = msg;
  logEl.appendChild(p);
  logEl.scrollTop = logEl.scrollHeight;
}

async function setup() {
  if (!window.tf || !window.poseDetection) {
    throw new Error('poseDetection library not loaded. Check script tags in index.html.');
  }
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
