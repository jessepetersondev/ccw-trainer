// Utility functions for geometry and time measurements

/**
 * Compute Euclidean distance between two points.
 * Each point is an object with x and y properties (normalised 0–1 coordinates).
 * @param {Object} a
 * @param {Object} b
 * @returns {number}
 */
export function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Compute the angle (in degrees) between three points, with `b` as the vertex.
 * Returns the interior angle at point `b` formed by segments ab and cb.
 * @param {Object} a
 * @param {Object} b
 * @param {Object} c
 * @returns {number}
 */
export function angle(a, b, c) {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const magAB = Math.sqrt(ab.x * ab.x + ab.y * ab.y);
  const magCB = Math.sqrt(cb.x * cb.x + cb.y * cb.y);
  const cosTheta = dot / (magAB * magCB + 1e-6);
  return Math.acos(Math.min(Math.max(cosTheta, -1), 1)) * (180 / Math.PI);
}

/**
 * Simple throttle function to limit function calls.
 * @param {Function} fn
 * @param {number} wait
 */
export function throttle(fn, wait) {
  let lastCall = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastCall >= wait) {
      lastCall = now;
      return fn.apply(this, args);
    }
  };
}
