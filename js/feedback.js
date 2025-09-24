/**
 * Generate feedback text based on metrics and training module.
 * @param {Object} metrics
 * @param {string} module
 * @param {number|null} drawTime - measured draw time in milliseconds (optional)
 * @returns {string[]} array of feedback messages
 */
export function generateFeedback(metrics, module, drawTime = null) {
  const messages = [];
  if (module === 'stance' || module === 'full') {
    if (metrics.stanceRatio !== null) {
      // Ideal stance ratio range (distance between ankles / shoulder width)
      const ratio = metrics.stanceRatio;
      if (ratio < 1.0) {
        messages.push('Stand with your feet wider for better stability.');
      } else if (ratio > 2.0) {
        messages.push('Feet are too far apart; narrow your stance slightly.');
      } else {
        messages.push('Good stance width.');
      }
    }
  }
  if (module === 'grip' || module === 'full') {
    if (metrics.gripTwoHand === false) {
      messages.push('Use both hands for better control and stability.');
    } else if (metrics.gripTwoHand === true) {
      messages.push('Good two‑handed grip.');
    }
  }
  if (module === 'draw' || module === 'full') {
    if (drawTime != null) {
      const seconds = (drawTime / 1000).toFixed(2);
      if (seconds > 2.5) {
        messages.push(`Draw time ${seconds}s — practice to shave it down.`);
      } else {
        messages.push(`Draw time ${seconds}s — nice work!`);
      }
    }
  }
  return messages;
}