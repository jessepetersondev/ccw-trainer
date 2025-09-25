import { distance } from './utils.js';

// Cache modules so we only import once
let TF_READY = null;
let posedetectionNS = null;

/**
 * Dynamically import TFJS (core, converter, webgl) and pose-detection as ES modules.
 * Uses esm.run CDN, which serves browser-friendly ES modules with dependencies resolved.
 */
async function ensureTfAndPoseDetection() {
  if (TF_READY && posedetectionNS) return { tfReady: TF_READY, posedetection: posedetectionNS };

  // Load TFJS pieces
  const tf = await import('https://esm.run/@tensorflow/tfjs-core@4.14.0');
  await import('https://esm.run/@tensorflow/tfjs-converter@4.14.0');
  await import('https://esm.run/@tensorflow/tfjs-backend-webgl@4.14.0');

  await tf.setBackend('webgl');
  await tf.ready();
  TF_READY = true;

  // Load pose-detection model namespace
  posedetectionNS = await import('https://esm.run/@tensorflow-models/pose-detection@3.1.0');

  return { tfReady: TF_READY, posedetection: posedetectionNS };
}

/**
 * VisionEngine encapsulates webcam capture, pose detection and metric extraction.
 */
export class VisionEngine {
  /**
   * @param {HTMLVideoElement} videoEl
   * @param {HTMLCanvasElement} canvasEl
   * @param {Function} onPose - callback invoked with pose results and metrics.
   */
  constructor(videoEl, canvasEl, onPose) {
    this.videoEl = videoEl;
    this.canvasEl = canvasEl;
    this.ctx = canvasEl.getContext('2d');
    this.onPose = onPose;
    this.detector = null;
    this.stream = null;
    this.running = false;
    this.dominantHand = 'right';
  }

  /**
   * Try to open a camera with sensible fallbacks.
   */
  async getBestStream() {
    const tryConstraint = async (constraints) => {
      try {
        return await navigator.mediaDevices.getUserMedia(constraints);
      } catch (e) {
        console.warn('getUserMedia failed', constraints, e);
        throw e;
      }
    };

    // 1) Prefer the back camera
    try {
      return await tryConstraint({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
    } catch {
      // 2) Fall back to front camera
      try {
        return await tryConstraint({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false
        });
      } catch {
        // 3) Enumerate devices (some browsers require deviceId)
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cams = devices.filter(d => d.kind === 'videoinput');
        if (cams.length) {
          const back = cams.find(d => /back|rear|environment/i.test(d.label)) || cams[0];
          try {
            return await tryConstraint({ video: { deviceId: { exact: back.deviceId } }, audio: false });
          } catch {
            return await tryConstraint({ video: { deviceId: back.deviceId }, audio: false });
          }
        }
        throw new Error('No camera devices found');
      }
    }
  }

  /**
   * Initialise webcam and load the MoveNet pose detector.
   */
  async init() {
    // Load TFJS & model via ESM (no globals needed)
    const { posedetection } = await ensureTfAndPoseDetection();

    // Video element tweaks for mobile Safari autoplay
    this.videoEl.setAttribute('playsinline', '');
    this.videoEl.muted = true;

    // Request camera stream with fallbacks
    try {
      this.stream = await this.getBestStream();
    } catch (err) {
      throw new Error('Camera access denied or not available: ' + (err?.message || err));
    }

    this.videoEl.srcObject = this.stream;

    // Wait for metadata to size canvas correctly
    await new Promise((res) => {
      if (this.videoEl.readyState >= 2) return res();
      this.videoEl.onloadedmetadata = () => res();
    });
    await this.videoEl.play();

    this.canvasEl.width = this.videoEl.videoWidth || 640;
    this.canvasEl.height = this.videoEl.videoHeight || 480;

    // Create MoveNet detector
    const modelConfig = { modelType: posedetection.movenet.modelType.SINGLEPOSE_LIGHTNING };
    this.detector = await posedetection.createDetector(posedetection.SupportedModels.MoveNet, modelConfig);
  }

  /**
   * Start the detection loop.
   */
  start() {
    if (!this.detector) throw new Error('Detector not initialised');
    this.running = true;

    const loop = async () => {
      if (!this.running) return;
      try {
        const poses = await this.detector.estimatePoses(this.videoEl, { maxPoses: 1, flipHorizontal: false });
        if (poses && poses[0]) {
          const pose = poses[0];
          const metrics = this.computeMetrics(pose);
          this.drawPose(pose, metrics);
          this.onPose(pose, metrics);
        }
      } catch (err) {
        console.error('Error in pose detection loop:', err);
      }
      requestAnimationFrame(loop);
    };
    loop();
  }

  /**
   * Stop the detection loop and release camera.
   */
  stop() {
    this.running = false;
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
    }
  }

  /**
   * Compute stance width, shoulder width and grip type from pose.
   * Returns { stanceRatio, gripTwoHand, wristY, hipY }.
   */
  computeMetrics(pose) {
    const keypoints = {};
    pose.keypoints.forEach((kp) => {
      if (kp.score > 0.3) {
        keypoints[kp.name] = {
          x: kp.x / this.canvasEl.width,
          y: kp.y / this.canvasEl.height
        };
      }
    });

    const leftAnkle = keypoints['left_ankle'];
    const rightAnkle = keypoints['right_ankle'];
    const leftShoulder = keypoints['left_shoulder'];
    const rightShoulder = keypoints['right_shoulder'];

    let stanceRatio = null;
    if (leftAnkle && rightAnkle && leftShoulder && rightShoulder) {
      const ankleDist = distance(leftAnkle, rightAnkle);
      const shoulderDist = distance(leftShoulder, rightShoulder);
      if (shoulderDist > 0) stanceRatio = ankleDist / shoulderDist;
    }

    const leftWrist = keypoints['left_wrist'];
    const rightWrist = keypoints['right_wrist'];
    let gripTwoHand = null;
    if (leftWrist && rightWrist && leftShoulder && rightShoulder) {
      const wristDist = distance(leftWrist, rightWrist);
      const shoulderDist = distance(leftShoulder, rightShoulder);
      if (shoulderDist > 0) gripTwoHand = wristDist < shoulderDist * 0.35;
    }

    let wristY = null;
    let hipY = null;
    if (rightWrist) wristY = rightWrist.y;
    const rightHip = keypoints['right_hip'];
    if (rightHip) hipY = rightHip.y;

    return { stanceRatio, gripTwoHand, wristY, hipY };
  }

  /**
   * Draw skeleton and metrics overlay.
   */
  drawPose(pose, metrics) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvasEl.width, this.canvasEl.height);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#00FF00';
    ctx.fillStyle = '#FF0000';

    pose.keypoints.forEach((kp) => {
      if (kp.score > 0.3) {
        ctx.beginPath();
        ctx.arc(kp.x, kp.y, 4, 0, 2 * Math.PI);
        ctx.fill();
      }
    });

    const edges = [
      ['left_hip', 'left_knee'], ['left_knee', 'left_ankle'],
      ['right_hip', 'right_knee'], ['right_knee', 'right_ankle'],
      ['left_shoulder', 'left_elbow'], ['left_elbow', 'left_wrist'],
      ['right_shoulder', 'right_elbow'], ['right_elbow', 'right_wrist'],
      ['left_shoulder', 'right_shoulder'], ['left_hip', 'right_hip'],
      ['left_shoulder', 'left_hip'], ['right_shoulder', 'right_hip'],
    ];

    edges.forEach(([aName, bName]) => {
      const a = pose.keypoints.find((kp) => kp.name === aName);
      const b = pose.keypoints.find((kp) => kp.name === bName);
      if (a && b && a.score > 0.3 && b.score > 0.3) {
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    });

    if (metrics.stanceRatio !== null) {
      const leftAnkle = pose.keypoints.find((kp) => kp.name === 'left_ankle');
      const rightAnkle = pose.keypoints.find((kp) => kp.name === 'right_ankle');
      const leftShoulder = pose.keypoints.find((kp) => kp.name === 'left_shoulder');
      const rightShoulder = pose.keypoints.find((kp) => kp.name === 'right_shoulder');
      if (leftAnkle && rightAnkle && leftShoulder && rightShoulder) {
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(leftAnkle.x, leftAnkle.y);
        ctx.lineTo(rightAnkle.x, rightAnkle.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(leftShoulder.x, leftShoulder.y);
        ctx.lineTo(rightShoulder.x, rightShoulder.y);
        ctx.stroke();
        ctx.lineWidth = 2;
      }
    }
  }
}
