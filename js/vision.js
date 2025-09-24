import { distance } from './utils.js';

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
    this.dominantHand = 'right'; // default; future improvement: ask user
  }

  /**
   * Initialise webcam and load the MoveNet pose detector.
   */
  async init() {
    // Wait for libraries to be available
    if (!window.tf) {
      throw new Error('TensorFlow.js not loaded. Check script tags in index.html.');
    }
    
    if (!window.poseDetection) {
      throw new Error('poseDetection library not loaded. Check script tags in index.html.');
    }

    console.log('Initializing pose detection...');
    
    // Request camera access (try environment then user as a fallback for iOS)
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: { ideal: 'environment' },
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      });
    } catch (err) {
      console.log('Environment camera not available, trying user camera:', err.message);
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 }
          },
          audio: false
        });
      } catch (err2) {
        throw new Error('Camera access denied or not available: ' + err2.message);
      }
    }

    this.videoEl.srcObject = this.stream;
    
    // Wait for video to be ready
    await new Promise((resolve) => {
      this.videoEl.onloadedmetadata = () => {
        resolve();
      };
    });
    
    await this.videoEl.play();

    // Resize canvas to match video
    this.canvasEl.width = this.videoEl.videoWidth || 640;
    this.canvasEl.height = this.videoEl.videoHeight || 480;

    console.log('Video dimensions:', this.canvasEl.width, 'x', this.canvasEl.height);

    // Create MoveNet detector
    try {
      const detectorConfig = {
        modelType: window.poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING
      };
      
      this.detector = await window.poseDetection.createDetector(
        window.poseDetection.SupportedModels.MoveNet, 
        detectorConfig
      );
      
      console.log('Pose detector created successfully');
    } catch (err) {
      throw new Error('Failed to create pose detector: ' + err.message);
    }
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
        const poses = await this.detector.estimatePoses(this.videoEl, {
          maxPoses: 1,
          flipHorizontal: false
        });
        
        if (poses && poses[0]) {
          const pose = poses[0];
          // Extract metrics
          const metrics = this.computeMetrics(pose);
          // Draw overlay
          this.drawPose(pose, metrics);
          // Invoke callback
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
   * Returns an object { stanceRatio, gripTwoHand, wristY, hipY }.
   * All distances are normalised by torso size (distance between shoulders).
   *
   * @param {any} pose
   */
  computeMetrics(pose) {
    // Landmarks we need
    const keypoints = {};
    pose.keypoints.forEach((kp) => {
      if (kp.score > 0.3) { // Lowered threshold for better detection
        keypoints[kp.name] = {
          x: kp.x / this.canvasEl.width,
          y: kp.y / this.canvasEl.height
        };
      }
    });

    // Stance ratio: distance between ankles / shoulder distance
    const leftAnkle = keypoints['left_ankle'];
    const rightAnkle = keypoints['right_ankle'];
    const leftShoulder = keypoints['left_shoulder'];
    const rightShoulder = keypoints['right_shoulder'];

    let stanceRatio = null;
    if (leftAnkle && rightAnkle && leftShoulder && rightShoulder) {
      const ankleDist = distance(leftAnkle, rightAnkle);
      const shoulderDist = distance(leftShoulder, rightShoulder);
      if (shoulderDist > 0) {
        stanceRatio = ankleDist / shoulderDist;
      }
    }

    // Two-hand grip detection: distance between wrists relative to shoulder width
    const leftWrist = keypoints['left_wrist'];
    const rightWrist = keypoints['right_wrist'];
    let gripTwoHand = null;
    if (leftWrist && rightWrist && leftShoulder && rightShoulder) {
      const wristDist = distance(leftWrist, rightWrist);
      const shoulderDist = distance(leftShoulder, rightShoulder);
      // If wrists are close (within ~0.35 of shoulder width), consider two-hand grip
      if (shoulderDist > 0) {
        gripTwoHand = wristDist < shoulderDist * 0.35;
      }
    }

    // Draw metrics for draw detection: y positions of right wrist (dominant hand) and right hip
    let wristY = null;
    let hipY = null;
    if (rightWrist) wristY = rightWrist.y;
    const rightHip = keypoints['right_hip'];
    if (rightHip) hipY = rightHip.y;

    return { stanceRatio, gripTwoHand, wristY, hipY };
  }

  /**
   * Draw skeleton and metrics overlay.
   * @param {any} pose
   * @param {Object} metrics
   */
  drawPose(pose, metrics) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvasEl.width, this.canvasEl.height);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#00FF00';
    ctx.fillStyle = '#FF0000';

    // Draw keypoints
    pose.keypoints.forEach((kp) => {
      if (kp.score > 0.3) {
        ctx.beginPath();
        ctx.arc(kp.x, kp.y, 4, 0, 2 * Math.PI);
        ctx.fill();
      }
    });

    // Draw connecting lines (skeleton) using predefined edges
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

    // Draw stance lines if available
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
        ctx.lineWidth = 2; // Reset line width
      }
    }
  }
}
