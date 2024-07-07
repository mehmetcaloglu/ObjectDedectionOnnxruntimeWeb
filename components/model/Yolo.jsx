import React, { useState, useEffect } from 'react';
import ndarray from 'ndarray';
import ops from 'ndarray-ops';
import WebcamModelUI from '../common/VueToReact';
import { runModelUtils, yolo, yoloTransforms } from '../../utils/index';
import { Tensor, InferenceSession } from 'onnxruntime-web';

const MODEL_FILEPATH_PROD = `/onnxruntime-web-demo/yolo.onnx`;
const MODEL_FILEPATH_DEV = '/yolo.onnx';

const Yolo = ({ hasWebGL }) => {
  const [modelFilepath, setModelFilepath] = useState(
    process.env.NODE_ENV === 'production' ? MODEL_FILEPATH_PROD : MODEL_FILEPATH_DEV
  );

  const warmupModel = (session) => {
    
    return runModelUtils.warmupModel(session, [1, 3, 416, 416]);
  };

  const preprocess = (ctx) => {
    
    const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
   
    const { data, width, height } = imageData;
    
    // data processing
    const dataTensor = ndarray(new Float32Array(data), [width, height, 4]);
    
    const dataProcessedTensor = ndarray(new Float32Array(width * height * 3), [
      1,
      3,
      width,
      height,
    ]);

    ops.assign(
      dataProcessedTensor.pick(0, 0, null, null),
      dataTensor.pick(null, null, 0)
    );
    ops.assign(
      dataProcessedTensor.pick(0, 1, null, null),
      dataTensor.pick(null, null, 1)
    );
    ops.assign(
      dataProcessedTensor.pick(0, 2, null, null),
      dataTensor.pick(null, null, 2)
    );

    const tensor = new Tensor("float32", new Float32Array(width * height * 3), [
      1,
      3,
      width,
      height,
    ]);
    (tensor.data ).set(dataProcessedTensor.data);
    return tensor;
  };
  
  
  
  
// // Helper function to resize image data
// const resizeImageData = (image, targetWidth, targetHeight) => {
//   const canvas = document.createElement('canvas');
//   canvas.width = targetWidth;
//   canvas.height = targetHeight;
//   const ctx = canvas.getContext('2d');
  
//   // Check if the input is already an ImageData object
//   const imageData = image instanceof ImageData ? image : image.getImageData(0, 0, image.width, image.height);

//   ctx.drawImage(imageData, 0, 0, targetWidth, targetHeight);
//   return ctx.getImageData(0, 0, targetWidth, targetHeight);
// };

  const postprocess = async (tensor, inferenceTime) => {
    
    try {
      const originalOutput = new Tensor(
        "float32",
        tensor.data ,
        [1, 125, 13, 13]
      );
      
      const outputTensor = yoloTransforms.transpose(
        originalOutput,
        [0, 2, 3, 1]
      );
      
      // postprocessing
      const boxes = await yolo.postprocess(outputTensor, 20);
      console.log(boxes);
      if (boxes.length === 0) {
        let rect = document.getElementById("rect");
        let label = document.getElementById("label");
        if (rect != null) {
          rect.remove();
        }
        if (label != null) {
          label.remove();
        }
      }
      boxes.forEach((box) => {
        
        const { top, left, bottom, right, classProb, className } = box;
        
        drawRect(
          left,
          top,
          right - left,
          bottom - top,
          `${className} Confidence: ${Math.round(
            classProb * 100
          )}% Time: ${inferenceTime.toFixed(1)}ms`
        );
      });
      
    } catch (e) {
      
      alert("Model is not valid!");
    }
  }

  const drawRect = (x, y, w, h, text = '', color = 'red') => {
    console.log(x, y, w, h, text, color);
    const webcamContainerElement = document.getElementById("webcam-container") ;
    // Depending on the display size, webcamContainerElement might be smaller than 416x416.
    const [ox, oy] = [(webcamContainerElement.offsetWidth - 416) / 2, (webcamContainerElement.offsetHeight - 416) / 2];
    // first chect are there div element id"rect" if it doesnt create a div element id "rect" if it is there then update the position of the div element

    let rect = document.getElementById("rect");
    let label = document.getElementById("label");
    if (rect == null) {
      rect = document.createElement("div");
      rect.id = "rect";
      rect.style.cssText = `position: absolute; top: ${y+oy}px; left: ${x+ox}px; width: ${w}px; height: ${h}px; border: 5px solid ${color};`;
      label = document.createElement("div");
      label.id = "label";
      label.style.cssText = `border: 2px solid ${color}; background-color: ${color}; color: white; font-size: 12px; position: absolute; top: -1.5em; left: 0;`;
      label.innerText = text;
    }
    else {
      rect.style.cssText = `position: absolute; top: ${y+oy}px; left: ${x+ox}px; width: ${w}px; height: ${h}px; border: 5px solid ${color};`;
      label.style.cssText = `border: 2px solid ${color}; background-color: ${color}; color: white; font-size: 12px; position: absolute; top: -1.5em; left: 0;`;
      label.innerText = text;
    }


    // const rect = document.createElement("div");
    // rect.style.cssText = `position: absolute; top: ${y+oy}px; left: ${x+ox}px; width: ${w}px; height: ${h}px; border: 5px solid ${color};`;
    // const label = document.createElement("div");  
    // // label.style.cssText = `border: 2px solid ${color}; background-color: ${color}; color: white; font-size: 12px; position: absolute; top: -1.5em; left: 0;`;
    // label.innerText = text;
    rect.appendChild(label);
    
    webcamContainerElement.appendChild(
      rect
    );
    debugger
  };

  return (
    <WebcamModelUI
      modelName="Yolo"
      hasWebGL={hasWebGL}
      modelFilepath={modelFilepath}
      imageSize={416}
      warmupModel={warmupModel}
      preprocess={preprocess}
      postprocess={postprocess}
    />
  );
};

export default Yolo;
