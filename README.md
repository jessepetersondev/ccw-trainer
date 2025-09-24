# CCW Trainer App

This repository contains the source code for **CCW Trainer**, a web‑based application that uses on‑device AI to help U.S. citizens prepare for concealed‑carry (CCW) qualification tests.  The app runs entirely in the browser and never uploads video to a server, ensuring privacy and low latency.

## Features

* **Real‑time pose analysis** – Utilises TensorFlow.js and the MoveNet model to detect body landmarks from the user’s webcam or smartphone camera.
* **Stance evaluation** – Calculates stance width relative to shoulder width and provides corrective feedback when the shooter’s feet are too close together or too far apart.
* **Grip assessment** – Detects whether the shooter is using a one‑hand or two‑hand grip by measuring the distance between wrist landmarks.  Warns if the support hand is not properly wrapped around the shooting hand.
* **Draw‑speed measurement** – Measures the time it takes to draw the firearm from a concealed holster by detecting when the dominant wrist moves from the hip area to the presentation position.
* **Training modules** – Includes focused practice sessions for stance, grip and draw technique, plus a CCW practice test that simulates typical qualification courses (untimed strings of five shots from 3–15 yards).  Logs are stored in the browser so users can track their improvement.
* **Safety first** – The interface consistently reminds users to practice with unloaded firearms or certified training replicas and to keep their finger off the trigger until ready to shoot.

## Structure

```
ccw_trainer_app/
├── index.html          # main web page
├── style.css           # application styling
├── js/
│   ├── main.js         # bootstraps the application
│   ├── vision.js       # pose detection and feature extraction
│   ├── feedback.js     # generates textual feedback based on metrics
│   ├── training.js     # implements training scenarios and logging
│   └── utils.js        # utility functions
└── test/
    └── vision.test.js  # simple unit tests for metric calculations
```

## Running the App Locally

1. Ensure that you have **Node.js ≥ 18** installed if you want to run the tests.  No build tools are required to run the app itself.

2. Serve the `ccw_trainer_app` directory over a local HTTP server.  For example, with Python:

   ```bash
   cd ccw_trainer_app
   python3 -m http.server 8000
   ```

3. Open your browser and navigate to `http://localhost:8000`.  Grant the page access to your webcam when prompted.

4. Select a training module from the drop‑down menu and click **Start Session**.  Follow the on‑screen instructions.  Feedback will appear in the right panel.

## Development and Testing

Unit tests for the metric calculations are implemented using [Jest](https://jestjs.io/).  To run the tests:

```bash
npm install
npm test
```

The test file `test/vision.test.js` includes sample landmark data and verifies that the stance width and grip detection logic behave as expected.

## Deployment

This application is a static site and can be hosted on any HTTP server.  To deploy on GitHub Pages:

1. Commit the contents of `ccw_trainer_app` to the `gh-pages` branch of your repository.
2. Enable GitHub Pages in the repository settings, pointing it to the `gh-pages` branch.
3. The app will be available at `https://<username>.github.io/<repo>/`.

Alternatively you can zip the `ccw_trainer_app` directory and distribute it directly; opening `index.html` in a modern browser will allow the app to run (though some browsers restrict webcam access for file:// URLs, so using a local server is recommended).

## Limitations

* The app uses general pose metrics to infer grip and draw actions; it does not perform explicit firearm recognition.  Users must still practice with certified training weapons and consult certified instructors to ensure proper technique.
* Due to the lack of pre‑trained open‑source models for detecting holsters or firearms, draw‑speed measurement relies on tracking the dominant hand’s movement relative to the hip and shoulder; results may vary depending on camera placement and user anatomy.

## Acknowledgements

This project uses open‑source libraries including:

* [TensorFlow.js](https://www.tensorflow.org/js) – Machine‑learning framework for the browser.
* [@tensorflow-models/pose-detection](https://github.com/tensorflow/tfjs-models/tree/master/pose-detection) – Provides the MoveNet pose estimator.
