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
  try {
    logEl.textContent = 'Initializing camera and AI models...';
    visionEngine = new VisionEngine(videoEl, canvasEl, () => {});
    await visionEngine.init();
    trainingModule = new TrainingModule(visionEngine, logEl);
    logEl.textContent = 'Ready! Select a training module and click Start Session.';
    startBtn.disabled = false;
  } catch (error) {
    console.error('Setup error:', error);
    logEl.textContent = 'Setup failed: ' + error.message;
    throw error;
  }
}

startBtn.addEventListener('click', async () => {
  try {
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
  } catch (error) {
    console.error('Start error:', error);
    logEl.textContent = 'Failed to start session: ' + error.message;
    // Re-enable controls
    startBtn.disabled = false;
    stopBtn.disabled = true;
    moduleSelect.disabled = false;
  }
});

stopBtn.addEventListener('click', () => {
  try {
    startBtn.disabled = false;
    stopBtn.disabled = true;
    moduleSelect.disabled = false;
    if (trainingModule) {
      trainingModule.stop();
    }
  } catch (error) {
    console.error('Stop error:', error);
    logEl.textContent = 'Error stopping session: ' + error.message;
  }
});

// Initialize when page loads
window.addEventListener('load', async () => {
  try {
    // Disable start button initially
    startBtn.disabled = true;
    logEl.textContent = 'Loading...';
    
    // Wait a bit for libraries to be fully loaded
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await setup();
  } catch (err) {
    console.error('Initialization error:', err);
    logEl.textContent = 'Error initializing: ' + err.message + '. Please refresh the page.';
  }
});