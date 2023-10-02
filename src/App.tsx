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

import sampleVideo from "./assets/sample_video.mp4";

function App() {
  const [canvasSize, setCanvasSize] = useState({
    width: 360,
    height: 440,
  });

  const [isNewVideo, setIsNewVideo] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const start = async () => {
    setIsNewVideo(false);
    const URL = window.URL || window.webkitURL;
    const video = document.getElementsByTagName("video")[0];

    const fileItem = document.getElementById("fileItem") as any;
    const files = fileItem?.files;
    console.log(sampleVideo, files[0]);
    let urlBlob = URL.createObjectURL(files[0]);
    let frameloop: any;
    video.src = urlBlob;
    video.load();

    cancelAnimationFrame(frameloop);

    video.addEventListener("loadedmetadata", function (e) {
      console.log(video.videoWidth, video.videoHeight);
      setCanvasSize({
        width: video.videoWidth,
        height: video.videoHeight,
      });
    });

    video.onloadeddata = async function () {
      setIsLoading(true);
      video.play();
      const canvas = document.querySelector("canvas") as any;
      const ctx = canvas.getContext("2d");
      const drawingUtils = new DrawingUtils(ctx);
      let faceDetector: FaceDetector;
      let poseLandmarker: PoseLandmarker;

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
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numPoses: 2,
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
      const saveChunks = (e: any) => {
        e.data.size && chunks.push(e.data);
      };

      const stream = canvas.captureStream(25);
      const recorder = new MediaRecorder(stream);
      recorder.start();
      recorder.ondataavailable = (event) => {
        saveChunks(event);
      };

      recorder.onstop = (event) => {
        console.log(event, "stop", chunks);
        if (chunks.length) {
          var blob = new Blob(chunks, { type: chunks[0].type });
          var vidURL = URL.createObjectURL(blob);
          console.log(vidURL, "vidURL");

          const a = document.createElement("a");
          const node = document.createTextNode("Download Video");
          const element = document.getElementById("downloadBlock");
          a.href = vidURL;
          a.download = "video.mp4";
          a.appendChild(node)
          if(element){
            element.appendChild(a);
          }
            
          // document.body.appendChild(a);
          // Trigger the file download
          //a.click();
        }
      };
      console.log(chunks);

      let lastVideoTime = -1;
      const renderLoop = () => {
        const video = document.getElementById("video") as any;
        let startTimeMs = performance.now();
        // Detect faces using detectForVideo
        if (video.currentTime !== lastVideoTime) {
          console.log("running frames", video.currentTime);
          lastVideoTime = video.currentTime;
          const detections = faceDetector.detectForVideo(
            video,
            startTimeMs
          ).detections;
          setIsLoading(false);
          handleDetections(detections);
          console.log(detections);
          // Detect faces marker using detectForVideo
          poseLandmarker.detectForVideo(video, startTimeMs, (result) => {
            ctx.save();
            ctx.clearRect(0, 0, ctx.width, ctx.height);
            ctx.beginPath();

            result.landmarks.forEach((landmark, index) => {
              let faceLandMarks: NormalizedLandmark[] = [];
              landmark.forEach((faceMarks, index) => {
                if (index < 6) {
                  faceLandMarks.push(faceMarks);
                }
              });
              console.log(index, "aaaaaaaaaa", faceLandMarks);
              //drawingUtils.drawLandmarks(faceLandMarks, {
              //radius: (data) => DrawingUtils.lerp(data.from!.z, -0.15, 0.1, 5, 1),
              //lineWidth: 10,
              //fillColor: 'red'
              //});
              //drawingUtils.drawConnectors(faceLandMarks, PoseLandmarker.POSE_CONNECTIONS);
            });

            // for (const landmark of result.landmarks) {
            //   drawingUtils.drawLandmarks(landmark, {
            //     radius: (data) => DrawingUtils.lerp(data.from!.z, -0.15, 0.1, 5, 1)
            //   });
            //   drawingUtils.drawConnectors(landmark, PoseLandmarker.POSE_CONNECTIONS);
            // }
            ctx.restore();
          });
        } else {
          recorder.stop();
        }

        frameloop = requestAnimationFrame(() => {
          renderLoop();
        });
      };

      frameloop = renderLoop();
    };
  };

  const uploadVideo = () => {
    window.location.reload();
    setIsNewVideo(!isNewVideo);
  };
  const playAgain = () => {
    const video = document.getElementsByTagName("video")[0];
    video.play();
  };

  return (
    <div className="App">
      <div>
        <canvas
          id="canvas"
          width={canvasSize.width}
          height={canvasSize.height}
        ></canvas>
        <br />
        {isLoading && <h1>Rendering Video Please wait</h1>}
        <br />
        {isNewVideo ? (
          <input
            id="fileItem"
            type="file"
            accept="video/mp4"
            onChange={() => {
              start();
            }}
          />
        ) : (
          <>
            <button onClick={uploadVideo}>Upload new video</button>{" "}
            {!isLoading && <button onClick={playAgain}>Play Again</button>}{" "}
            <div id="downloadBlock"></div>
          </>
        )}
        <br /> <br />
        <small>
          This uses short range face detection and limited only up to 2 person
          on the video. Any person away 2 meters from the video capture is not
          recognized by the face detection. Video also having less than 10sec
          will also rendering causes issue
        </small>
        <br /> <br /> <br /> <br /> <br />
        <video style={{ display: "none" }} id="video"></video>
      </div>
      {/* <ObjectsBlur/> */}
    </div>
  );
}

export default App;
