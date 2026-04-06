import { useEffect, useRef, useState } from "react";
import { Joystick, JoystickShape } from "react-joystick-component";
import { WebRTCClient } from "../webrtc/WebRTCClient";
import DroneMap from "./DroneMap";
import { GamepadReader, type GamepadState } from "../utils/Gamepad";
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
    const [isConnecting, setIsConnecting] = useState(false);
    const [videoRecord, setvideoRecord] = useState(false);
    const [overlayData, setOverlayData] = useState<any>(null);
    const [recordStart, setRecordStart] = useState<number | null>(null);
    const [elapsed, setElapsed] = useState<string>("00:00");
    const intervalRef = useRef<number | null>(null);
    const [cameras, setCameras] = useState<any[]>([]);
    const [cameraId, setCameraId] = useState<string>("");
    const [loadingCameras, setLoadingCameras] = useState(false);
    const [showMap, setShowMap] = useState(false);
    const [mapTarget, setMapTarget] = useState<[number, number] | null>(null);
    const [showJoysticks, setShowJoysticks] = useState(false);
    const [showChannels, setShowChannels] = useState(false);
    const [pingMs, setPingMs] = useState<number | null>(null);
    const [isVideoConnected, setIsVideoConnected] = useState(false);
    const [packetLoss, setPacketLoss] = useState<{
      lost: number | null;
      received: number | null;
      pct: number | null;
      fps: number | null;
    }>({ lost: null, received: null, pct: null, fps: null });
    const showJoysticksRef = useRef(false);
    const [channelState, setChannelState] = useState({
      ch5: 0,
      ch6: 0,
      ch7: 0,
      ch8: 0,
      b1: -1,
      b2: -1,
      b3: -1,
      b4: -1,
    });
    const channelStateRef = useRef(channelState);
    const lastGamepadStateRef = useRef<GamepadState>({
      ch1: 0,
      ch2: 0,
      ch3: 0,
      ch4: 0,
      ch5: 0,
      ch6: 0,
      ch7: 0,
      ch8: 0,
      b1: -1,
      b2: -1,
      b3: -1,
      b4: -1,
    });

    const sendGamepadState = (partial: Partial<GamepadState>) => {
      const next = {
        ...lastGamepadStateRef.current,
        ...channelStateRef.current,
        ...partial,
      };
      lastGamepadStateRef.current = next;
      clientRef.current?.SetDataGamePad(next);
    };

    const handleJoystickStart = () => {};

    const handleJoystickMove = (side: "left" | "right") => (event: any) => {
      if (!event) return;
      if (side === "left") {
        const x = typeof event.x === "number" ? event.x : 0;
        sendGamepadState({ ch2: x });
      } else {
        const y = typeof event.y === "number" ? event.y : 0;
        sendGamepadState({ ch1: y });
      }
    };

    const handleJoystickStop = (side: "left" | "right") => () => {
      if (side === "left") {
        sendGamepadState({ ch2: 0 });
      } else {
        sendGamepadState({ ch1: 0 });
      }
    };

    const setChannelValue = (
      key: "ch5" | "ch6" | "ch7" | "ch8" | "b1" | "b2" | "b3" | "b4",
      value: number
    ) => {
      setChannelState((prev) => {
        if (prev[key] === value) return prev;
        const next = { ...prev, [key]: value };
        channelStateRef.current = next;
        sendGamepadState({ [key]: value } as Partial<GamepadState>);
        return next;
      });
    };

    const isZeroState = (s: GamepadState) =>
      s.ch1 === 0 &&
      s.ch2 === 0 &&
      s.ch3 === 0 &&
      s.ch4 === 0 &&
      s.ch5 === 0 &&
      s.ch6 === 0 &&
      s.ch7 === 0 &&
      s.ch8 === 0 &&
      s.b1 === 0 &&
      s.b2 === 0 &&
      s.b3 === 0 &&
      s.b4 === 0;

    const hasGamepadChanged = (prev: GamepadState, next: GamepadState) => {
      // Не дублюємо відправку, якщо обидва стани повністю нульові.
      if (isZeroState(prev) && isZeroState(next)) {
        return false;
      }
      return (
        prev.ch1 !== next.ch1 ||
        prev.ch2 !== next.ch2 ||
        prev.ch3 !== next.ch3 ||
        prev.ch4 !== next.ch4 ||
        prev.ch5 !== next.ch5 ||
        prev.ch6 !== next.ch6 ||
        prev.ch7 !== next.ch7 ||
        prev.ch8 !== next.ch8 ||
        prev.b1 !== next.b1 ||
        prev.b2 !== next.b2 ||
        prev.b3 !== next.b3 ||
        prev.b4 !== next.b4
      );
    };

    const hasEnoughSatellites = (gps: any): gps is {
      lat: number;
      lon: number;
      satellites_visible: number;
    } => {
      if (!gps) return false;
      const lat = Number(gps.lat);
      const lon = Number(gps.lon);
      const satellites = Number(gps.satellites_visible);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
      if (lat === 0 && lon === 0) return false;
      return satellites >= 4;
    };

    useEffect(() => {
      showJoysticksRef.current = showJoysticks;
    }, [showJoysticks]);

    useEffect(() => {
      if (!showJoysticks) {
        setShowChannels(false);
      }
    }, [showJoysticks]);



    // ============================================
    // CONNECT CAMERA
    // ============================================
    async function connectCamera() {
      if (connected || isConnecting) return;
      if (!videoRef.current) return;
      setIsConnecting(true);

      console.log("[UI] Connecting camera…");

      const client = new WebRTCClient(robot.robotId, userId);
      clientRef.current = client;

      client.setVideoElement(videoRef.current);
      // receive parsed data from robot and show in header
      client.onData = (d: any) => {
        setOverlayData(d);
        if (hasEnoughSatellites(d?.gps)) {
          setMapTarget([d.gps.lat, d.gps.lon]);
        }
      };
      client.onPing = (ms) => {
        setPingMs(ms);
        //console.log(`[WebRTC] ping: ${ms ?? "—"} ms`);
      };
      client.onStats = (s) => {
        setPacketLoss({
          lost: s.packetsLostInterval,
          received: s.packetsReceivedInterval,
          pct: s.lossPct,
          fps: s.fps,
        });
      };
      client.onVideoConnectionStateChange = (isConnectedNow) => {
        setIsVideoConnected(isConnectedNow);
      };
      try {
        await client.start();
        setConnected(true);
        setupGamePadListeners();
      } catch (e) {
        console.error("[UI] Failed to connect camera", e);
        try {
          await client.stop();
        } catch (stopError) {
          console.warn("[UI] Failed to cleanup after connect error", stopError);
        }
        if (clientRef.current === client) {
          clientRef.current = null;
        }
        alert("Помилка підключення камери");
      } finally {
        setIsConnecting(false);
      }
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
      setIsConnecting(false);
      setIsVideoConnected(false);
      setMapTarget(null);
      setPingMs(null);
      setPacketLoss({ lost: null, received: null, pct: null, fps: null });

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
      "/api/robots/robot-sessions/deactivateWebrtc",
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

useEffect(() => {
  loadCameras();
}, [robot?.robotId]);

async function loadCameras() {
  if (!robot?.robotId) return;
  setLoadingCameras(true);
  try {
    const res = await api.get(`/api/robots/${robot.robotId}/cameras`);
    const data = res.data ?? [];
    setCameras(data);
    const activeCamera = data.find((c: any) => c.active === true);
    if (activeCamera) {
      setCameraId(String(activeCamera.id));
    } else {
      setCameraId("");
    }
  } finally {
    setLoadingCameras(false);
  }
}


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

        //console.log(s);
        if (showJoysticksRef.current) {
          return;
        }
        if (!hasGamepadChanged(lastGamepadStateRef.current, s)) {
          return;
        }
        lastGamepadStateRef.current = s;
        clientRef.current?.SetDataGamePad(s);


      };

      // старт опитування
      gp.current.start();


    }

    function formatElapsed(ms: number) {
      const total = Math.floor(ms / 1000);
      const hrs = Math.floor(total / 3600);
      const mins = Math.floor((total % 3600) / 60);
      const secs = total % 60;
      if (hrs > 0) return `${String(hrs).padStart(2,'0')}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
      return `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
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
        await api.post(`api/robots/robot-sessions/deactivateWebrtc`, disconnectData);

      }
    }
function startRecording() 
{
    if (!isVideoConnected) return;
    if (clientRef.current) {
      setvideoRecord(true);
      clientRef.current.startRecording();
      const now = Date.now();
      setRecordStart(now);
      setElapsed(formatElapsed(0));
      if (intervalRef.current) window.clearInterval(intervalRef.current as any);
      intervalRef.current = window.setInterval(() => {
        const diff = Date.now() - now;
        setElapsed(formatElapsed(diff));
      }, 500) as unknown as number;
    }
}

async function stopRecording()
{
  if (clientRef.current) {
          await clientRef.current.stopRecording();
        setvideoRecord(false);
         if (intervalRef.current) {
           window.clearInterval(intervalRef.current as any);
           intervalRef.current = null;
         }
         setRecordStart(null);
         setElapsed("00:00");
  }
        
}
   


    return (
      <div className="fixed inset-0 bg-black bg-opacity-90 flex flex-col z-50">

        {/* HEADER */}
        <div className="h-14 bg-gray-900 border-b border-gray-700 flex items-center justify-between px-6 relative">
          <div className="flex items-center gap-4">
            <div className="text-xl font-semibold text-gray-200">{robot.name}</div>
            <div className="h-6 w-px bg-gray-700" />
            <div className="text-sm text-gray-300">
              {videoRecord ? (
                <span className="font-mono text-sm">🔴 {elapsed}</span>
              ) : (
                <span className="text-gray-500">&nbsp;</span>
              )}
            </div>
          </div>

          {/* center overlay */}
          <div className="absolute left-0 right-0 top-0 h-14 flex items-center justify-center pointer-events-none">
            <div className="text-gray-300 text-sm text-center whitespace-pre">
              {overlayData ? (
                overlayData.raw ? String(overlayData.raw) : (
                  overlayData.v !== undefined ? [
                    `B1: ${overlayData.v}v`,
                    `B2: ${overlayData.v2}v`,
                    `i: ${overlayData.i}`,
                    //`p: ${overlayData.p}`,
                    //`wh: ${overlayData.wh}`,
                    `Sat: ${overlayData.gps?.satellites_visible ?? "—"}`,
                    `\\ ${overlayData.gps?.hdop ?? "—"}`
                  ].join("  ") : JSON.stringify(overlayData)
                )
              ) : null}
            </div>
          </div>

          {/* vertical separators near center to isolate overlay */}
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-160px, -50%)' }} className="h-8 w-px bg-gray-700" />
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(160px, -50%)' }} className="h-8 w-px bg-gray-700" />

          <div className="flex items-center gap-3">
            {loadingCameras ? (
              <div className="text-gray-500 text-sm">Loading…</div>
            ) : (
              <select
                value={cameraId}
                onChange={async (e) => {
                  const value = e.target.value;
                  setCameraId(value);
                  if (!value) return;
                  try {
                    await api.post(`/api/robots/${robot.robotId}/cameras/${value}/activate`);
                    await loadCameras();
                  } catch (err) {
                    alert("Failed to activate camera");
                  }
                }}
                className="px-2 py-1 rounded bg-gray-800 text-gray-200 border border-gray-700 w-52"
              >
                <option value="">—</option>
                {cameras.map((camera) => (
                  <option key={camera.id} value={camera.id}>
                    {camera.name} ({camera.port})
                  </option>
                ))}
              </select>
            )}
            <div className="h-6 w-px bg-gray-700" />
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
          {showMap && (
            <div
              className="
              absolute top-6 left-6 
              w-72 h-56 rounded-lg overflow-hidden shadow-xl 
              border border-gray-700 bg-gray-900"
            >
              <DroneMap robot={robot} gpsTarget={mapTarget} />
            </div>
          )}

          {/* Floating controls (right side) */}
          <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-40">
            <button
              onClick={() => setShowMap((prev) => !prev)}
              className="w-12 h-12 rounded-full bg-gray-900/90 border border-gray-700 text-gray-200 shadow-lg hover:bg-gray-800"
              title={showMap ? "Hide map" : "Show map"}
              aria-label={showMap ? "Hide map" : "Show map"}
            >
              🗺️
            </button>
            <button
              onClick={() => setShowJoysticks((prev) => !prev)}
              className="w-12 h-12 rounded-full bg-gray-900/90 border border-gray-700 text-gray-200 shadow-lg hover:bg-gray-800"
              title={showJoysticks ? "Hide joysticks" : "Show joysticks"}
              aria-label={showJoysticks ? "Hide joysticks" : "Show joysticks"}
            >
              🎮
            </button>
            {showJoysticks && (
              <button
                onClick={() => setShowChannels((prev) => !prev)}
                className="w-12 h-12 rounded-full bg-gray-900/90 border border-gray-700 text-gray-200 shadow-lg hover:bg-gray-800"
                title={showChannels ? "Hide channels" : "Show channels"}
                aria-label={showChannels ? "Hide channels" : "Show channels"}
              >
                🎛️
              </button>
            )}
          </div>

          <div
            className={`absolute left-6 top-24 w-80 bg-gray-900/95 border border-gray-700 rounded-lg shadow-xl p-4 z-40 transition-[opacity,transform] duration-300 ease-out ${
              showJoysticks && showChannels
                ? "opacity-100 translate-y-0 pointer-events-auto"
                : "opacity-0 -translate-y-6 pointer-events-none"
            }`}
          >
            <div className="text-gray-200 font-semibold mb-3">Channels</div>
            <div className="grid grid-cols-1 gap-3">
              <div className="grid grid-cols-4 items-center gap-2">
                <div className="text-gray-300">Arm</div>
                {[-1, 0, 1].map((v) => (
                  <button
                    key={`ch5-${v}`}
                    onClick={() => setChannelValue("ch5", v)}
                    className={`px-2 py-1 rounded border text-sm ${
                      channelState.ch5 === v
                        ? "bg-blue-600 border-blue-500 text-white"
                        : "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-4 items-center gap-2">
                <div className="text-gray-300">video</div>
                {[-1, 0, 1].map((v) => (
                  <button
                    key={`ch6-${v}`}
                    onClick={() => setChannelValue("ch6", v)}
                    className={`px-2 py-1 rounded border text-sm ${
                      channelState.ch6 === v
                        ? "bg-blue-600 border-blue-500 text-white"
                        : "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-4 items-center gap-2">
                <div className="text-gray-300">CH7</div>
                {[-1, 0, 1].map((v) => (
                  <button
                    key={`ch7-${v}`}
                    onClick={() => setChannelValue("ch7", v)}
                    className={`px-2 py-1 rounded border text-sm ${
                      channelState.ch7 === v
                        ? "bg-blue-600 border-blue-500 text-white"
                        : "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-4 items-center gap-2">
                <div className="text-gray-300">brake</div>
                {[-1, 0, 1].map((v) => (
                  <button
                    key={`ch8-${v}`}
                    onClick={() => setChannelValue("ch8", v)}
                    className={`px-2 py-1 rounded border text-sm ${
                      channelState.ch8 === v
                        ? "bg-blue-600 border-blue-500 text-white"
                        : "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 items-center gap-2">
                <div className="text-gray-300">IR</div>
                {[-1, 1].map((v) => (
                  <button
                    key={`ch9-${v}`}
                    onClick={() => setChannelValue("b1", v)}
                    className={`px-2 py-1 rounded border text-sm ${
                      channelState.b1 === v
                        ? "bg-blue-600 border-blue-500 text-white"
                        : "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 items-center gap-2">
                <div className="text-gray-300">Light</div>
                {[-1, 1].map((v) => (
                  <button
                    key={`ch10-${v}`}
                    onClick={() => setChannelValue("b2", v)}
                    className={`px-2 py-1 rounded border text-sm ${
                      channelState.b2 === v
                        ? "bg-blue-600 border-blue-500 text-white"
                        : "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 items-center gap-2">
                <div className="text-gray-300">revers</div>
                {[-1, 1].map((v) => (
                  <button
                    key={`ch11-${v}`}
                    onClick={() => setChannelValue("b3", v)}
                    className={`px-2 py-1 rounded border text-sm ${
                      channelState.b3 === v
                        ? "bg-blue-600 border-blue-500 text-white"
                        : "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 items-center gap-2">
                <div className="text-gray-300">CH12</div>
                {[-1, 1].map((v) => (
                  <button
                    key={`ch12-${v}`}
                    onClick={() => setChannelValue("b4", v)}
                    className={`px-2 py-1 rounded border text-sm ${
                      channelState.b4 === v
                        ? "bg-blue-600 border-blue-500 text-white"
                        : "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {showJoysticks && (
            <>
              <div className="absolute bottom-6 left-6 z-40">
                <Joystick
                  controlPlaneShape={JoystickShape.AxisX}
                  start={handleJoystickStart("left")}
                  throttle={50}
                  move={handleJoystickMove("left")}
                  stop={handleJoystickStop("left")}
                />
              </div>
              <div className="absolute bottom-6 right-6 z-40">
                <Joystick
                  controlPlaneShape={JoystickShape.AxisY}
                  start={handleJoystickStart("right")}
                  throttle={50}
                  move={handleJoystickMove("right")}
                  stop={handleJoystickStop("right")}
                />
              </div>
            </>
          )}

          <div className="absolute right-6 top-6 z-40 text-gray-200/70 text-sm font-mono pointer-events-none text-left">
            <div>ping: {pingMs ?? "—"} ms</div>
            <div className="text-gray-200/70 text-sm font-mono">
              loss/10s:{" "}
              {packetLoss.lost ?? "—"}
              {packetLoss.pct !== null ? ` (${packetLoss.pct}%)` : ""}
            </div>
            <div className="text-gray-200/70 text-sm font-mono">
              fps: {packetLoss.fps ?? "—"}
            </div>
          </div>
        </div>

        {/* FOOTER BUTTONS */}
        <div className="h-20 bg-gray-900 border-t border-gray-700 flex items-center gap-4 px-6">

          {!connected && (
            <button
              onClick={connectCamera}
              disabled={isConnecting}
              className={`px-4 py-2 rounded ${
                isConnecting
                  ? "bg-blue-900 cursor-not-allowed opacity-60"
                  : "bg-blue-700 hover:bg-blue-800"
              }`}
            >
              {isConnecting ? "Connecting..." : "Connect camera"}
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
{isVideoConnected && !videoRecord && (
          <button 
          onClick={startRecording}
          className="px-4 py-2 bg-gray-400 rounded hover:bg-red-800">
            🔴 REC
          </button>
)}
 {isVideoConnected && videoRecord && (
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
