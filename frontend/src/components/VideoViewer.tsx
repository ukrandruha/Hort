import { useEffect, useRef, useState } from "react";
import { WebRTCClient } from "../webrtc/WebRTCClient";
import DroneMap from "./DroneMap";
import { GamepadReader } from "../utils/Gamepad";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api/api";
import { forwardRef, useImperativeHandle } from "react";

import { alert } from "./Alert/globalAlert";



//////////////////////////
export type VideoViewerHandle = {
  onDisconnectRequested: () => void;
};

//export default function VideoViewer({ robot,userId, onClose }) {


const VideoViewer = forwardRef<VideoViewerHandle, any>(
  ({ robot, userId, onClose }, ref) => {

    const videoRef = useRef<HTMLVideoElement>(null);
    const clientRef = useRef<WebRTCClient | null>(null);
    const gp = useRef<GamepadReader | null>(null);


    const [connected, setConnected] = useState(false);
    const [videoRecord, setvideoRecord] = useState(false);



    // ============================================
    // CONNECT CAMERA
    // ============================================
    async function connectCamera() {
      if (!videoRef.current) return;
     

      console.log("[UI] Connecting camera…");

      const client = new WebRTCClient(robot.robotId, userId);
      clientRef.current = client;

      client.setVideoElement(videoRef.current);
      await client.start();

      setConnected(true);

      setupGamePadListeners();
      
    }
    function fullScreen() {

    }
    // ============================================
    // DISCONNECT CAMERA
    // ============================================
    async function disconnectCamera() {
      console.log("[UI] Disconnecting camera…");

      if (gp.current) {
        await gp.current.stop();
      }

      if (clientRef.current) {
        await clientRef.current.stopRecording();
        setvideoRecord(false);
        await clientRef.current.stop();
        clientRef.current = null;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }


      setConnected(false);

    }

    // ============================================
    // CLEANUP ON CLOSE
    // ============================================
    useEffect(() => {
      return () => {
        operatorDisconnect();
        //disconnectCamera();
      };
    }, []);


useEffect(() => {
  const onUnload = () => {
    if (!connected) return;

    navigator.sendBeacon(
      "/api/robots/robot-sessions/disconnect",
      JSON.stringify({
        robotId: robot.robotId,
        disconnectedBy: userId.toString(),
        reason: "browser_closed",
        force: false,
      })
    );
  };

  window.addEventListener("unload", onUnload);
  return () => {
    window.removeEventListener("unload", onUnload);
  };
}, []);


    // ============================================
    // Connect GAMEPAD
    // ============================================

    function setupGamePadListeners() {


      gp.current = new GamepadReader({
        axisMap: { ch1: 0, ch2: 1, ch3: 2, ch4: 3, ch5: 4, ch6: 5, ch7: 6, ch8: 7 }, // підлаштуй порядок осей під свій TX12
        deadzone: 0.03,
        smooth: 0.25,
        updateIntervalMs: 100,
      });


      // отримуємо дані кожен кадр (~60 fps)
      gp.current.onUpdate = (s) => {

        // sendDataArray(pack7(s));
        //console.log(s);
        clientRef.current?.SetDataGamePad(s);


      };

      // старт опитування
      gp.current.start();


    }


    useImperativeHandle(
      ref,
      () => ({
        onDisconnectRequested() {
          adminDisconnect();
          //onClose();
        },
      }),
      //[onClose],
    );

    async function adminDisconnect() {
      disconnectCamera();
      alert("Зʼєднання розірвано адміністратором");
      await api.post(`api/robots/robot-sessions/confirmDisconnect`, { "robotId": robot.robotId });
    }

    async function operatorDisconnect() {
      if (connected) {
        disconnectCamera();
        // "robotId": "1000000012a168a1","reason":"", "disconnectedBy": "4" , "force":false}
        const disconnectData = {
          "robotId": robot.robotId,
          "reason": "",
          "disconnectedBy": userId.toString(),
          "force": false
        };
        await api.post(`api/robots/robot-sessions/disconnect`, disconnectData);

      }
    }
function startRecording() 
{
    if (clientRef.current) {
      setvideoRecord(true);
      clientRef.current.startRecording();
    }
}

async function stopRecording()
{
  if (clientRef.current) {
          await clientRef.current.stopRecording();
        setvideoRecord(false);
  }
        
}
   


    return (
      <div className="fixed inset-0 bg-black bg-opacity-90 flex flex-col z-50">

        {/* HEADER */}
        <div className="h-14 bg-gray-900 border-b border-gray-700 flex items-center justify-between px-6">
          <div className="text-xl font-semibold text-gray-200">
            Camera View — {robot.name} ({robot.robotId})
          </div>


          <button
            onClick={() => {
              operatorDisconnect();
              onClose();
            }}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded"
          >
            Close
          </button>
        </div>

        {/* MAIN VIDEO AREA */}
        <div className="relative flex-1 bg-black flex items-center justify-center">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="absolute inset-0 w-full h-full object-contain"
          />

          {/* MAP PIP */}
          <div
            className="
            absolute bottom-6 right-6 
            w-72 h-56 rounded-lg overflow-hidden shadow-xl 
            border border-gray-700 bg-gray-900"
          >
            <DroneMap robot={robot} />
          </div>
        </div>

        {/* FOOTER BUTTONS */}
        <div className="h-20 bg-gray-900 border-t border-gray-700 flex items-center gap-4 px-6">

          {!connected && (
            <button
              onClick={connectCamera}
              className="px-4 py-2 bg-blue-700 rounded hover:bg-blue-800"
            >
              Connect camera
            </button>
          )}

          {connected && (
            <button
              onClick={operatorDisconnect}
              className="px-4 py-2 bg-yellow-600 rounded hover:bg-yellow-700"
            >
              Disconnect camera
            </button>
          )}
{!videoRecord && (
          <button 
          onClick={startRecording}
          className="px-4 py-2 bg-gray-400 rounded hover:bg-red-800">
            🔴 REC
          </button>
)}
 {videoRecord && (
            <button
              onClick={stopRecording}
              className="px-4 py-2 bg-gray-400 rounded hover:bg-yellow-700"
            >
             🔴 Stop 
            </button>
          )}

        </div>
      </div>
    );
  }
);
export default VideoViewer;
