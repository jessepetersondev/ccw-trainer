import { VisionEngine } from '../js/vision.js';

// Mock canvas context
function createMockCanvas(width, height) {
  return {
    width,
    height,
    getContext: () => ({
      clearRect: () => {},
      beginPath: () => {},
      arc: () => {},
      fill: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
    }),
  };
}

describe('VisionEngine computeMetrics', () => {
  test('calculates stance ratio correctly', () => {
    const videoEl = document.createElement('video');
    const canvasEl = createMockCanvas(640, 480);
    const engine = new VisionEngine(videoEl, canvasEl, () => {});
    // Pose with ankle and shoulder positions
    const pose = {
      keypoints: [
        { name: 'left_ankle', x: 0.2 * 640, y: 0.9 * 480, score: 0.9 },
        { name: 'right_ankle', x: 0.8 * 640, y: 0.9 * 480, score: 0.9 },
        { name: 'left_shoulder', x: 0.3 * 640, y: 0.3 * 480, score: 0.9 },
        { name: 'right_shoulder', x: 0.7 * 640, y: 0.3 * 480, score: 0.9 },
      ],
    };
    const metrics = engine.computeMetrics(pose);
    // stance ratio = ankleDist (0.6) / shoulderDist (0.4) = 1.5
    expect(metrics.stanceRatio).toBeCloseTo(1.5, 1);
  });

  test('detects two-hand grip when wrists close', () => {
    const videoEl = document.createElement('video');
    const canvasEl = createMockCanvas(640, 480);
    const engine = new VisionEngine(videoEl, canvasEl, () => {});
    const pose = {
      keypoints: [
        { name: 'left_wrist', x: 0.45 * 640, y: 0.5 * 480, score: 0.9 },
        { name: 'right_wrist', x: 0.55 * 640, y: 0.5 * 480, score: 0.9 },
        { name: 'left_shoulder', x: 0.3 * 640, y: 0.3 * 480, score: 0.9 },
        { name: 'right_shoulder', x: 0.7 * 640, y: 0.3 * 480, score: 0.9 },
      ],
    };
    const metrics = engine.computeMetrics(pose);
    expect(metrics.gripTwoHand).toBe(true);
  });

  test('detects one-hand grip when wrists far apart', () => {
    const videoEl = document.createElement('video');
    const canvasEl = createMockCanvas(640, 480);
    const engine = new VisionEngine(videoEl, canvasEl, () => {});
    const pose = {
      keypoints: [
        { name: 'left_wrist', x: 0.2 * 640, y: 0.5 * 480, score: 0.9 },
        { name: 'right_wrist', x: 0.8 * 640, y: 0.5 * 480, score: 0.9 },
        { name: 'left_shoulder', x: 0.3 * 640, y: 0.3 * 480, score: 0.9 },
        { name: 'right_shoulder', x: 0.7 * 640, y: 0.3 * 480, score: 0.9 },
      ],
    };
    const metrics = engine.computeMetrics(pose);
    expect(metrics.gripTwoHand).toBe(false);
  });
});