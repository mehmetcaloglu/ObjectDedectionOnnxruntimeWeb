import React, { useState, useEffect, useRef } from 'react';
import { InferenceSession, Tensor } from 'onnxruntime-web';
import { runModelUtils } from '../../utils';

import styles from './Web.module.css';
import { Button } from '../../@/components/ui/button';

function WebcamModelUI({ modelFilepath, warmupModel, preprocess, postprocess }) {
    const [sessionBackend, setSessionBackend] = useState('wasm');
    const [modelFile, setModelFile] = useState(null);
    const [modelLoading, setModelLoading] = useState(true);
    const [modelInitializing, setModelInitializing] = useState(true);
    const [sessionRunning, setSessionRunning] = useState(false);
    const [modelLoadingError, setModelLoadingError] = useState(false);
    const [webcamEnabled, setWebcamEnabled] = useState(false);
    const [webcamInitialized, setWebcamInitialized] = useState(false);
    const [backendSelectList] = useState([
        { text: 'GPU-WebGL', value: 'webgl' },
        { text: 'CPU-WebAssembly', value: 'wasm' },
    ]);

    const webcamElement = useRef(null);
    const webcamContainer = useRef(null);
    const [videoOrigWidth, setVideoOrigWidth] = useState(0);
    const [videoOrigHeight, setVideoOrigHeight] = useState(0);
    const [session, setSession] = useState(null);
    const [gpuSession, setGpuSession] = useState(null);
    const [cpuSession, setCpuSession] = useState(null);
    const [inferenceTime, setInferenceTime] = useState(0);

    // useEffect(() => {
    //     debugger
    //     async function fetchModelFile() {
    //         const response = await fetch(modelFilepath);
    //         const arrayBuffer = await response.arrayBuffer();
    //         setModelFile(arrayBuffer);
    //     }
    //     debugger

    //     fetchModelFile().then(() => {
    //         debugger
    //     }).catch(() => {
    //         debugger
    //         setSessionBackend('wasm');
    //     });
    //     debugger
    // }, [modelFilepath]);

    useEffect(() => {
        if (webcamEnabled) {
            stopCamera();
        }
        clearRects();
        clearCanvas();

        if (modelFilepath) {
            async function fetchModelFile() {
                const response = await fetch(modelFilepath);
                const arrayBuffer = await response.arrayBuffer();
                setModelFile(arrayBuffer);
            }

            fetchModelFile()
        }

        // try {
        //     debugger
        //     initSession();
        // } catch (e) {
        //     setModelLoadingError(true);
        // }
    }, [sessionBackend]);

    useEffect(() => {
        if (modelFile) {
            try {
                initSession();
            } catch (e) {
                setModelLoadingError(true);
            }
        }
    }, [modelFile])


    useEffect(() => {
        if (!modelLoading) {
            console.log('webcamInitialized', webcamInitialized)
            console.log('webcamEnabled', webcamEnabled)

            webcamController();
        }
    }, [webcamInitialized, webcamEnabled])



    useEffect(() => {
        if (webcamElement.current) {
            webcamElement.current.addEventListener('loadedmetadata', () => {
                setVideoOrigWidth(webcamElement?.current.videoWidth);
                setVideoOrigHeight(webcamElement.current.videoHeight);
                adjustVideoSize(webcamElement.current.videoWidth, webcamElement.current.videoHeight);
            });
        }
    }, []);

    const initSession = async () => {
        setSessionRunning(false);
        setModelLoadingError(false);
        let myCpuSession = null;
        try {
            if (sessionBackend === 'wasm') {


                if (cpuSession) {
                    setSession(cpuSession);
                }

                setModelLoading(true);
                setModelInitializing(true);
                const cpuSess = await runModelUtils.createModelCpu(modelFile);
                setCpuSession(cpuSess);
                setSession(cpuSess);
                myCpuSession = cpuSess;
            }
        } catch (e) {

            setModelLoading(false);
            setModelInitializing(false);

            setCpuSession(null);

            throw new Error('Error: Backend not supported.');
        }
        setModelLoading(false);

        await warmupModel(myCpuSession);

        setModelInitializing(false);
    };



    const webcamController = () => {

        if (!webcamEnabled) {
            // stopCamera();
            clearRects();
        }
        runLiveVideo();
    };

    const setup = async () => {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: { facingMode: 'environment' },
            });
            console.log('stream', stream)
            webcamElement.current.srcObject = stream;
            return new Promise((resolve) => {
                webcamElement.current.onloadedmetadata = () => {
                    setVideoOrigWidth(webcamElement.current.videoWidth);
                    setVideoOrigHeight(webcamElement.current.videoHeight);
                    adjustVideoSize(webcamElement.current.videoWidth, webcamElement.current.videoHeight);
                    resolve();
                };
            });
        } else {
            throw new Error('No webcam found!');
        }
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

    const startCamera = async () => {

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

    const runLiveVideo = async () => {
        if (!webcamEnabled) {
            await startCamera();
            return;
        }
        while (webcamEnabled) {
            console.log("runLiveVideo")
            const ctx = capture();

            await runModel(ctx);
            await new Promise((resolve) => requestAnimationFrame(() => resolve()));
        }
    };

    const runModel = async (ctx) => {

        setSessionRunning(true);
        const data = preprocess(ctx);
        let outputTensor;
        let myInferenceTime;
        [outputTensor, myInferenceTime] = await runModelUtils.runModel(session, data);

        clearRects();
        postprocess(outputTensor, myInferenceTime);
        setInferenceTime(myInferenceTime);
        setSessionRunning(false);
    };

    const clearCanvas = () => {
        setInferenceTime(0);
        const element = document.getElementById('input-canvas');
        if (element) {
            const ctx = element.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            }
        }
    };

    const clearRects = () => {
        while (webcamContainer.current.childNodes.length > 2) {
            webcamContainer.current.removeChild(webcamContainer.current.childNodes[2]);
        }
    };

    const capture = () => {
        const size = Math.min(videoOrigWidth, videoOrigHeight);
        const centerHeight = videoOrigHeight / 2;
        const beginHeight = centerHeight - size / 2;
        const centerWidth = videoOrigWidth / 2;
        const beginWidth = centerWidth - size / 2;

        const canvas = document.getElementById('screenshot');

        canvas.width = Math.min(webcamElement.current.width, webcamElement.current.height);
        canvas.height = Math.min(webcamElement.current.width, webcamElement.current.height);

        const context = canvas.getContext('2d');

        context.drawImage(webcamElement.current, beginWidth, beginHeight, size, size, 0, 0, canvas.width, canvas.height);

        return context;
    };

    const adjustVideoSize = (width, height) => {
        const aspectRatio = width / height;
        if (width >= height) {
            webcamElement.current.width = aspectRatio * webcamElement.current.height;
        } else if (width < height) {
            webcamElement.current.height = webcamElement.current.width / aspectRatio;
        }
    };

    const handleChange = (event) => {
        setSessionBackend(event.target.value);
    };

    return (
        <div>
            <div style={{ margin: 'auto', width: '40%', padding: '40px' }}>
                <div className="select-backend">Select Backend:</div>
                <select value={sessionBackend} onChange={handleChange} disabled={modelLoading || modelInitializing || sessionRunning}>
                    {backendSelectList.map((backend) => (
                        <option key={backend.value} value={backend.value}>
                            {backend.text}
                        </option>
                    ))}
                </select>
            </div>
            {modelLoadingError && (
                <div style={{ paddingBottom: '30px' }} className="error-message">
                    Error: Current backend is not supported on your machine. Try Selecting a different backend.
                </div>
            )}
            <div className="styles.webcam-panel " style={{ display: 'flex', justifyContent: 'space-around', position: "relative", padding: "40px 20px", marginTop: "30px", backgroundColor: "white," }}>
                <div className="webcam-container" id="webcam-container" ref={webcamContainer}  >
                    <video id="webcam" autoPlay playsInline muted ref={webcamElement} width="416" height="416" />
                    {
                        !webcamEnabled &&
                        <canvas id="input-canvas" width="416" height="416" />
                    }
                </div>
                <style jsx>{`
        .webcam-container {
          border-radius: 5px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24);
          margin: 0 auto;
          width: 416px;
          height: 416px;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .webcam-container > :nth-child(n + 3) {
          position: absolute;
          border: 1px solid red;
          font-size: 24px;
        }
        .webcam-container > :nth-child(n + 3) > :first-child {
          background: white;
          color: black;
          opacity: 0.8;
          font-size: 12px;
          padding: 3px;
          text-transform: capitalize;
          white-space: nowrap;
        }
      `}</style>
            </div>
            <div className="infer-time">Model Inference Time: <span>{inferenceTime}</span> ms</div>
            {(!modelLoading && !modelInitializing) ? (
                <div className="webcam-controller">
                    {/* <button disabled={sessionRunning} onClick={webcamController}>{webcamEnabled ? 'Stop Camera' : 'Start Camera'}</button> */}
                    <Button variant="destructive" disabled={sessionRunning} onClick={webcamController}>{webcamEnabled ? 'Stop Camera' : 'Start Camera'}</Button>
                </div>
            ) : (
                <div className="model-loading">Model Loading...</div>
            )}
            <canvas id="screenshot" style={{ display: 'none' }} />

        </div>
    );
}

export default WebcamModelUI;
