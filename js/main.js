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

async function setup() {
  visionEngine = new VisionEngine(videoEl, canvasEl, () => {});
  await visionEngine.init();
  trainingModule = new TrainingModule(visionEngine, logEl);
}

startBtn.addEventListener('click', async () => {
  // Disable start button, enable stop
  startBtn.disabled = true;
  stopBtn.disabled = false;
  moduleSelect.disabled = true;
  // Start training
  const module = moduleSelect.value;
  if (!visionEngine) {
    await setup();
  }
  trainingModule.start(module);
});

stopBtn.addEventListener('click', () => {
  startBtn.disabled = false;
  stopBtn.disabled = true;
  moduleSelect.disabled = false;
  trainingModule.stop();
});

// Attempt to initialise camera on load
window.addEventListener('load', async () => {
  try {
    await setup();
  } catch (err) {
    console.error(err);
    logEl.textContent = 'Error initialising camera: ' + err.message;
  }
});