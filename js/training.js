import { generateFeedback } from './feedback.js';

/**
 * TrainingModule orchestrates training sessions and feedback.
 */
export class TrainingModule {
  /**
   * @param {VisionEngine} visionEngine
   * @param {HTMLElement} logEl
   */
  constructor(visionEngine, logEl) {
    this.vision = visionEngine;
    this.logEl = logEl;
    this.activeModule = null;
    this.sessionActive = false;
    this.lastFeedbackTime = 0;
    // Draw training state
    this.drawBaselineY = null;
    this.drawStartTime = null;
  }

  /**
   * Start a training session.
   * @param {string} module - stance, grip, draw or full
   */
  start(module) {
    this.activeModule = module;
    this.sessionActive = true;
    this.clearLog();
    this.log(`Started ${module} session.`);
    this.drawBaselineY = null;
    this.drawStartTime = null;
    // Provide callback for pose updates
    this.vision.onPose = (pose, metrics) => {
      if (!this.sessionActive) return;
      const now = Date.now();
      // Draw session logic
      if (module === 'draw' || module === 'full') {
        this.handleDraw(metrics);
      }
      // Provide feedback no more than once per second
      if (now - this.lastFeedbackTime > 1000) {
        let drawTime = null;
        if (this.completedDrawTime) {
          drawTime = this.completedDrawTime;
          this.completedDrawTime = null;
        }
        const messages = generateFeedback(metrics, module, drawTime);
        if (messages.length > 0) this.log(messages.join(' '));
        this.lastFeedbackTime = now;
      }
    };
    this.vision.start();
  }

  /**
   * Stop the current training session.
   */
  stop() {
    if (this.sessionActive) {
      this.sessionActive = false;
      this.vision.stop();
      this.log('Session ended.');
      // Save log to localStorage
      const history = JSON.parse(localStorage.getItem('ccw_logs') || '[]');
      history.push({ timestamp: new Date().toISOString(), module: this.activeModule, log: this.logEl.innerText });
      localStorage.setItem('ccw_logs', JSON.stringify(history));
    }
  }

  /**
   * Handle draw timing logic.
   * We measure time between the hand at the hip (baseline) and raised to the chest/shoulder level.
   * @param {Object} metrics
   */
  handleDraw(metrics) {
    const wristY = metrics.wristY;
    const hipY = metrics.hipY;
    if (wristY == null || hipY == null) return;
    // Determine baseline (hand at or below hip)
    if (this.drawBaselineY === null) {
      // Wait until the hand is within 10% below hip (y greater than hip)
      if (wristY > hipY + 0.05) {
        this.drawBaselineY = wristY;
        this.drawStartTime = Date.now();
      }
    } else {
      // Detect completion: hand raised above shoulder height (y less than hip minus margin)
      if (wristY < hipY - 0.15) {
        const endTime = Date.now();
        const drawTime = endTime - this.drawStartTime;
        this.completedDrawTime = drawTime;
        // Reset for next draw
        this.drawBaselineY = null;
        this.drawStartTime = null;
      }
    }
  }

  /**
   * Append a message to the session log element.
   * @param {string} msg
   */
  log(msg) {
    const p = document.createElement('p');
    p.textContent = msg;
    this.logEl.appendChild(p);
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  /**
   * Clear the log element.
   */
  clearLog() {
    this.logEl.innerHTML = '';
  }
}
