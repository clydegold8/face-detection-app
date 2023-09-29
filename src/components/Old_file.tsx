import React, { useState } from "react";
import "./App.css";
import {
  Detection,
  DrawingUtils,
  FaceDetector,
  FaceLandmarker,
  FilesetResolver,
  NormalizedLandmark,
  PoseLandmarker,
} from "@mediapipe/tasks-vision";
import * as tflite from '@tensorflow/tfjs-tflite';

import sampleVideo from "./assets/sample_video.mp4";


function oldFile() {
  const [canvasSize, setCanvasSize] = useState({
    width: 360,
    height: 640,
  });


  const start = async (file: any) => {
    const URL = window.URL || window.webkitURL;
    const video = document.getElementsByTagName("video")[0];

    const fileItem = document.getElementById("fileItem") as any;
    const files = fileItem?.files;
    console.log(sampleVideo, files[0])
    let urlBlob = URL.createObjectURL(files[0]);
    let frameloop: any;
    video.src = urlBlob;
    video.load();
    
    cancelAnimationFrame(frameloop);

    video.addEventListener('loadedmetadata', function(e){
      console.log(video.videoWidth, video.videoHeight);
      setCanvasSize({
        width: video.videoWidth,
        height: video.videoHeight
      })
    });

    video.onloadeddata = async function () {
      video.play();
      const canvas = document.querySelector("canvas") as any;
      const ctx = canvas.getContext("2d");
      const canvasElement = document.getElementById(
        "output_canvas"
      ) as HTMLCanvasElement;
      const canvasCtx = canvasElement.getContext("2d") as CanvasRenderingContext2D;
      const videoBlendShapes = document.getElementById("video-blend-shapes") as HTMLCanvasElement;
      const drawingUtils = new DrawingUtils(ctx);
      // const video = document.querySelector("video") as any;
      let faceDetector: FaceDetector;
      let poseLandmarker: PoseLandmarker;
      let faceLandmarker: FaceLandmarker;

      // const tfliteModel = await tflite.loadTFLiteModel(
      //   "./assets/face_detection_full_range.tflite",
      // );
      // console.log(tfliteModel)

      const initializefaceDetector = async () => {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );
        faceDetector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite`,
            // modelAssetPath:`https://cdn.jsdelivr.net/npm/@mediapipe/face_detection@0.4.1646425229/face_detection_full_range.tflite`,
            delegate: "GPU",
            
          },
          runningMode: "VIDEO",
        });

        poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numPoses: 2
        });

        faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
            delegate: "GPU"
          },
          outputFaceBlendshapes: true,
          runningMode: "VIDEO",
          numFaces: 2
        });
      };
      await initializefaceDetector();

      let dataArr = [
        {
          x: 0,
          y: 0,
          h: 0,
          w: 0,
        },
      ];

      const handleDetections = (detections: Detection[]) => {
        ctx.clearRect(0, 0, ctx.width, ctx.height);
        ctx.beginPath();
        ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        detections.forEach((data) => {
          if (data.boundingBox) {
            dataArr.push({
              x: data.boundingBox?.originX,
              y: data.boundingBox?.originY,
              w: data.boundingBox?.width,
              h: data.boundingBox?.height,
            });
            ctx.fillRect(
              data.boundingBox?.originX,
              data.boundingBox?.originY,
              data.boundingBox?.width - 5,
              data.boundingBox?.height - 50
            );
          }
        });

        ctx.fillStyle = "rgb(80,65,53)";
        ctx.lineWidth = "1";
        ctx.strokeStyle = "red";
        ctx.stroke();
      };

      // try to record and capture filtered video and save it to local
      let chunks: any[] = [];
      const saveChunks = (e:any) => {
        e.data.size && chunks.push(e.data);
      }

      const stream = canvas.captureStream(25);
      const recorder = new MediaRecorder(stream);
      recorder.start();
      recorder.ondataavailable  = (event) => {
        saveChunks(event)
      };

      recorder.onstop  = (event) => {
        console.log(event,'stop',chunks)
        if (chunks.length) {
          var blob = new Blob(chunks, { type: chunks[0].type });
          var vidURL = URL.createObjectURL(blob);
          console.log(vidURL, 'vidURL')

          let a = document.createElement('a');
          a.href = vidURL;
          a.download = "video.mp4";
          document.body.appendChild(a);
          // Trigger the file download
          //a.click();
        }
      };
      console.log(chunks);


      function drawBlendShapes(el: HTMLElement, blendShapes: any[]) {
        if (!blendShapes.length) {
          return;
        }
      
        console.log(blendShapes[0]);
        
        let htmlMaker = "";
        blendShapes[0].categories.map((shape: any) => {
          htmlMaker += `
            <li class="blend-shapes-item">
              <span class="blend-shapes-label">${
                shape.displayName || shape.categoryName
              }</span>
              <span class="blend-shapes-value" style="width: calc(${
                +shape.score * 100
              }% - 120px)">${(+shape.score).toFixed(4)}</span>
            </li>
          `;
        });
      
        el.innerHTML = htmlMaker;
      }


      let lastVideoTime = -1;
      const renderLoop = () => {
        const video = document.getElementById("video") as any;
        let startTimeMs = performance.now();
        // Detect faces using detectForVideo
        if (video.currentTime !== lastVideoTime) {
          console.log('running frames', video.currentTime)
          lastVideoTime = video.currentTime;
          const detections = faceDetector.detectForVideo(
            video,
            startTimeMs
          ).detections;
          handleDetections(detections);
          console.log(detections)
          // Detect faces marker using detectForVideo
          poseLandmarker.detectForVideo(video, startTimeMs, (result) => {
            ctx.save();
            ctx.clearRect(0, 0, ctx.width, ctx.height);
            ctx.beginPath();
           
            result.landmarks.forEach((landmark, index) => {
              
              let faceLandMarks: NormalizedLandmark[] = []
              landmark.forEach((faceMarks, index) => {
                if(index < 6){
                  faceLandMarks.push(faceMarks)
                }
              })
              console.log(index, 'aaaaaaaaaa', faceLandMarks)
              drawingUtils.drawLandmarks(faceLandMarks, {
                //radius: (data) => DrawingUtils.lerp(data.from!.z, -0.15, 0.1, 5, 1),
                //lineWidth: 10,
                fillColor: 'red'
              });
              //drawingUtils.drawConnectors(faceLandMarks, PoseLandmarker.POSE_CONNECTIONS);
            })

            // for (const landmark of result.landmarks) {
            //   drawingUtils.drawLandmarks(landmark, {
            //     radius: (data) => DrawingUtils.lerp(data.from!.z, -0.15, 0.1, 5, 1)
            //   });
            //   drawingUtils.drawConnectors(landmark, PoseLandmarker.POSE_CONNECTIONS);
            // }
            ctx.restore();
          });

          //detect face land marks
        // const results = faceLandmarker.detectForVideo(video, startTimeMs);

        // if (results.faceLandmarks) {
        //   for (const landmarks of results.faceLandmarks) {
        //     drawingUtils.drawConnectors(
        //       landmarks,
        //       FaceLandmarker.FACE_LANDMARKS_TESSELATION,
        //       { color: "#C0C0C070", lineWidth: 1 }
        //     );
        //     drawingUtils.drawConnectors(
        //       landmarks,
        //       FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
        //       { color: "#FF3030" }
        //     );
        //     drawingUtils.drawConnectors(
        //       landmarks,
        //       FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW,
        //       { color: "#FF3030" }
        //     );
        //     drawingUtils.drawConnectors(
        //       landmarks,
        //       FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
        //       { color: "#30FF30" }
        //     );
        //     drawingUtils.drawConnectors(
        //       landmarks,
        //       FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW,
        //       { color: "#30FF30" }
        //     );
        //     drawingUtils.drawConnectors(
        //       landmarks,
        //       FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,
        //       { color: "#E0E0E0" }
        //     );
        //     drawingUtils.drawConnectors(
        //       landmarks,
        //       FaceLandmarker.FACE_LANDMARKS_LIPS,
        //       { color: "#E0E0E0" }
        //     );
        //     drawingUtils.drawConnectors(
        //       landmarks,
        //       FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS,
        //       { color: "#FF3030" }
        //     );
        //     drawingUtils.drawConnectors(
        //       landmarks,
        //       FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS,
        //       { color: "#30FF30" }
        //     );
        //   }
        // }
        // drawBlendShapes(videoBlendShapes, results.faceBlendshapes);


        }else{
          recorder.stop();
        }

        frameloop = requestAnimationFrame(() => {
          renderLoop();
        });
      };

      frameloop = renderLoop();
    };
  };

  return (
    <div className="App">
      <div>
        <canvas
          id="canvas"
          width={canvasSize.width}
          height={canvasSize.height}
        ></canvas>
         <div className="blend-shapes">
      <ul className="blend-shapes-list" id="video-blend-shapes"></ul>
    </div>
        <canvas className="output_canvas" id="output_canvas" width={canvasSize.width} height={canvasSize.height} style={{position: 'absolute', left: 0, top: 0,}}></canvas>
        <br />
        <input
          id="fileItem"
          type="file"
          accept="video/mp4"
          onChange={(files) => {
            start(files);
          }}
        />
        <br /> <br /> <br /> <br /> <br /> <br /> <br />
        <video style={{display: 'none'}} id="video"></video>
      </div>
      {/* <ObjectsBlur/> */}
    </div>
  );
}

export default oldFile;
