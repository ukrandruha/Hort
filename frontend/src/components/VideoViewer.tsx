import { useEffect, useRef, useState } from "react";
import { WebRTCClient } from "../webrtc/WebRTCClient";
import DroneMap from "./DroneMap";
import {GamepadReader} from "../utils/Gamepad";
import { useAuth } from "../auth/AuthContext";



export default function VideoViewer({ robot,userId, onClose }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const clientRef = useRef<WebRTCClient | null>(null);
  const gp = useRef<GamepadReader| null>(null);


  const [connected, setConnected] = useState(false);

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

    setupGamePadListeners();  
    setConnected(true);
  }
  function fullScreen() {

  }
  // ============================================
  // DISCONNECT CAMERA
  // ============================================
  async function disconnectCamera() {
    console.log("[UI] Disconnecting camera…");

    if(gp.current)
    {
      await gp.current.stop();
    }

    if (clientRef.current) {
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
      loadState();
      const interval = setInterval(loadState, 3000);

    return () => {
      disconnectCamera();
      clearInterval(interval);
    };
  }, []);

   async function loadState() {
      try {
     
        if (robot?.sessionStatus === 'DISCONNECT_REQUESTED') {
            // stop control immediately
            alert("DISCONNECT_REQUESTED");
        }
      } catch (e) {
        console.error("Failed to load State", e);
      }
    }



  // ============================================
  // Connect GAMEPAD
  // ============================================

  function setupGamePadListeners() {


    gp.current = new GamepadReader({
      axisMap: { ch1: 0, ch2: 1, ch3: 2, ch4: 3, ch5: 4, ch6: 5, ch7: 6 }, // підлаштуй порядок осей під свій TX12
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




  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex flex-col z-50">

      {/* HEADER */}
      <div className="h-14 bg-gray-900 border-b border-gray-700 flex items-center justify-between px-6">
        <div className="text-xl font-semibold text-gray-200">
          Camera View — {robot.name} ({robot.robotId})
        </div>


        <button
          onClick={() => {
            disconnectCamera();
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
            onClick={disconnectCamera}
            className="px-4 py-2 bg-yellow-600 rounded hover:bg-yellow-700"
          >
            Disconnect camera
          </button>
        )}

        <button className="px-4 py-2 bg-red-700 rounded hover:bg-red-800">
          Reboot robot
        </button>
      </div>
    </div>
  );
}
