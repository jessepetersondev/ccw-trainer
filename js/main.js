import { VisionEngine } from './vision.js';
import { TrainingModule } from './training.js';

// DOM
const videoEl = document.getElementById('video');
const canvasEl = document.getElementById('overlay');
const moduleSelect = document.getElementById('module-select');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const logEl = document.getElementById('log');

let visionEngine;
let trainingModule;

function log(msg) {
  console.log(msg);
  const p = document.createElement('p');
  p.textContent = msg;
  logEl.appendChild(p);
  logEl.scrollTop = logEl.scrollHeight;
}

async function setup() {
  if (!visionEngine) {
    visionEngine = new VisionEngine(videoEl, canvasEl, () => {});
  }
  log('Initializing camera & pose model…');
  await visionEngine.init(); // prompts camera after user gesture
  if (!trainingModule) {
    trainingModule = new TrainingModule(visionEngine, logEl);
  }
  log('Ready! Select a module and begin.');
}

// Start on user gesture (iOS/Safari requirement)
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

window.addEventListener('load', () => {
  log('Libraries loaded. Tap Start Session to begin.');
});
