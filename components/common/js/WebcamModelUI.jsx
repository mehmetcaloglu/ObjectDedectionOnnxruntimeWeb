import React, { useState, useEffect, useRef } from 'react';
import { InferenceSession, Tensor } from 'onnxruntime-web';
import { runModelUtils } from '../../';

const WebcamModelUI = ({
  modelFilepath,
  warmupModel,
  preprocess,
  postprocess,
}) => {
  const [modelLoading, setModelLoading] = useState(true);
  const [modelInitializing, setModelInitializing] = useState(true);
  const [sessionRunning, setSessionRunning] = useState(false);
  const [modelLoadingError, setModelLoadingError] = useState(false);
  const [webcamEnabled, setWebcamEnabled] = useState(false);
  const [webcamInitialized, setWebcamInitialized] = useState(false);
  const [sessionBackend, setSessionBackend] = useState('webgl');
  const [modelFile, setModelFile] = useState(new ArrayBuffer(0));
  const [inferenceTime, setInferenceTime] = useState(0);
  const webcamElement = useRef(null);
  const webcamContainer = useRef(null);
  const webcamStream = useRef(null);
  const gpuSession = useRef(null);
  const cpuSession = useRef(null);
  const session = useRef(null);

  const backendSelectList = [
    { text: 'GPU-WebGL', value: 'webgl' },
    { text: 'CPU-WebAssembly', value: 'wasm' },
  ];

  useEffect(() => {
    const fetchModelFile = async () => {
      const response = await fetch(modelFilepath);
      const arrayBuffer = await response.arrayBuffer();
      debugger
      setModelFile(arrayBuffer);
    };

    fetchModelFile().then(initSession).catch(() => setSessionBackend('wasm'));
  }, [modelFilepath]);

  useEffect(() => {
    debugger
    if (webcamEnabled) {
      runLiveVideo();
    }
  }, [webcamEnabled]);

  const initSession = async () => {
    setSessionRunning(false);
    setModelLoadingError(false);

    if (sessionBackend === 'webgl' && gpuSession.current) {
      session.current = gpuSession.current;
      return;
    }

    if (sessionBackend === 'wasm' && cpuSession.current) {
      session.current = cpuSession.current;
      return;
    }

    setModelLoading(true);
    setModelInitializing(true);

    try {
      if (sessionBackend === 'webgl') {
        gpuSession.current = await runModelUtils.createModelGpu(modelFile);
        debugger
        session.current = gpuSession.current;
        debugger
      } else if (sessionBackend === 'wasm') {
        cpuSession.current = await runModelUtils.createModelCpu(modelFile);
        session.current = cpuSession.current;
      }
    } catch (e) {
      debugger
      setModelLoading(false);
      setModelInitializing(false);
      if (sessionBackend === 'webgl') {
        gpuSession.current = undefined;
      } else {
        cpuSession.current = undefined;
      }
      Console.log('Error: Backend not supported.');
    }

    setModelLoading(false);
    await warmupModel(session.current);
    setModelInitializing(false);
  };

  const startCamera = async () => {
    debugger
    if (!webcamInitialized) {
      setSessionRunning(true);
      try {
        await setup();
      } catch (e) {
        setSessionRunning(false);
        setWebcamEnabled(false);
        alert('No webcam found');
        return;
      }
      webcamElement.current.play();
      setWebcamInitialized(true);
      setSessionRunning(false);
    } else {
      await webcamElement.current.play();
    }
    setWebcamEnabled(true);
  };

  const stopCamera = async () => {
    webcamElement.current.pause();
    while (sessionRunning) {
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    }
    clearRects();
    clearCanvas();
    setWebcamEnabled(false);
  };

  const runLiveVideo = async () => {
    await startCamera();
    if (!webcamEnabled) return;
    while (webcamEnabled) {
      const ctx = capture();
      await runModel(ctx);
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    }
  };

  const setup = async () => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'environment' },
      });
      webcamStream.current = stream;
      webcamElement.current.srcObject = stream;
      return new Promise((resolve) => {
        webcamElement.current.onloadedmetadata = () => {
          const videoWidth = webcamElement.current.videoWidth;
          const videoHeight = webcamElement.current.videoHeight;
          webcamElement.current.setAttribute('width', `${videoWidth}px`);
          webcamElement.current.setAttribute('height', `${videoHeight}px`);
          resolve();
        };
      });
    }
  };

  const capture = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 416;
    canvas.height = 416;
    ctx.drawImage(webcamElement.current, 0, 0, 416, 416);
    clearRects();
    return ctx;
  };

  const clearRects = () => {
    webcamContainer.current.querySelectorAll('div').forEach((e) => e.remove());
  };

  const clearCanvas = () => {
    const ctx = webcamElement.current.getContext('2d');
    ctx.clearRect(0, 0, webcamElement.current.width, webcamElement.current.height);
  };

  const runModel = async (ctx) => {
    if (!ctx) return;
    setSessionRunning(true);
    const preprocessedData = preprocess(ctx);
    const start = new Date();
    const outputData = await session.current.run([preprocessedData]);
    const end = new Date();
    const time = end.getTime() - start.getTime();
    setInferenceTime(time);
    await postprocess(outputData[0], time);
    setSessionRunning(false);
  };

  return (
    <div className="container">
      <div className="header">
        <h1>Webcam Model UI</h1>
        <p>
          <strong>Model: </strong> {modelFilepath}
        </p>
      </div>
      <div className="content">
        <div id="webcam-container" ref={webcamContainer}>
          <video ref={webcamElement} autoPlay muted playsInline />
        </div>
        <div className="controls">
          <button onClick={webcamEnabled ? stopCamera : startCamera}>
            {webcamEnabled ? 'Stop Camera' : 'Start Camera'}
          </button>
          <select
            value={sessionBackend}
            onChange={(e) => {
              setSessionBackend(e.target.value);
              initSession();
            }}
            disabled={modelLoading || modelInitializing || sessionRunning || webcamEnabled}
          >
            {backendSelectList.map((item) => (
              <option key={item.value} value={item.value}>
                {item.text}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="footer">
        <p>
          <strong>Backend: </strong> {sessionBackend}
        </p>
        <p>
          <strong>Inference Time: </strong> {inferenceTime} ms
        </p>
      </div>
    </div>
  );
};

export default WebcamModelUI;
