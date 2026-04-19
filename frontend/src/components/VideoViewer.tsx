import { useEffect, useRef, useState } from "react";
import { Joystick, JoystickShape } from "react-joystick-component";
import { WebRTCClient } from "../webrtc/WebRTCClient";
import DroneMap from "./DroneMap";
import { GamepadReader, type GamepadState } from "../utils/Gamepad";
import { haversineKm } from "../utils/math";
import { robotStore } from "../utils/robotStore";
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
    const [mapInMainView, setMapInMainView] = useState(false);
    const [currentRobot, setCurrentRobot] = useState<any>(robot);
    const [savedHomeTarget, setSavedHomeTarget] = useState<[number, number] | null>(null);
    const [backendHomeTarget, setBackendHomeTarget] = useState<[number, number] | null>(null);
    const [showJoysticks, setShowJoysticks] = useState(false);
    const [showChannels, setShowChannels] = useState(false);
    const [isSavingHome, setIsSavingHome] = useState(false);
    const [showRthPath, setShowRthPath] = useState(false);
    const [pingMs, setPingMs] = useState<number | null>(null);
    const [isVideoConnected, setIsVideoConnected] = useState(false);
    const [isForcingWebrtcReboot, setIsForcingWebrtcReboot] = useState(false);
    const [packetLoss, setPacketLoss] = useState<{
      lost: number | null;
      received: number | null;
      pct: number | null;
      fps: number | null;
    }>({ lost: null, received: null, pct: null, fps: null });
    const showJoysticksRef = useRef(false);
    const homePressTimerRef = useRef<number | null>(null);
    const channelsPanelRef = useRef<HTMLDivElement | null>(null);
    const channelsToggleButtonRef = useRef<HTMLButtonElement | null>(null);
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
      return true;
      // return (
      //   prev.ch1 !== next.ch1 ||
      //   prev.ch2 !== next.ch2 ||
      //   prev.ch3 !== next.ch3 ||
      //   prev.ch4 !== next.ch4 ||
      //   prev.ch5 !== next.ch5 ||
      //   prev.ch6 !== next.ch6 ||
      //   prev.ch7 !== next.ch7 ||
      //   prev.ch8 !== next.ch8 ||
      //   prev.b1 !== next.b1 ||
      //   prev.b2 !== next.b2 ||
      //   prev.b3 !== next.b3 ||
      //   prev.b4 !== next.b4
      // );
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

    const currentGpsTarget = hasEnoughSatellites(overlayData?.gps)
      ? [overlayData.gps.lat, overlayData.gps.lon] as [number, number]
      : null;
    const currentHeadingRaw = Number(overlayData?.gps?.compas);
    const currentHeading = Number.isFinite(currentHeadingRaw)
      ? ((currentHeadingRaw % 360) + 360) % 360
      : null;

    useEffect(() => {
      showJoysticksRef.current = showJoysticks;
    }, [showJoysticks]);

    useEffect(() => {
      setCurrentRobot(robot);
    }, [robot]);

    useEffect(() => {
      if (!robot?.robotId) return;
      const unsubscribe = robotStore.subscribe(robot.robotId, (nextRobot) => {
        setCurrentRobot((prev: any) => ({ ...prev, ...nextRobot }));
      });
      return unsubscribe;
    }, [robot?.robotId]);

    useEffect(() => {
      if (!robot?.robotId) return;
      const unsubscribe = robotStore.subscribeTelemetry(robot.robotId, (telemetry) => {
        setOverlayData(telemetry);
      });
      return unsubscribe;
    }, [robot?.robotId]);

    useEffect(() => {
      if (!showJoysticks) {
        setShowChannels(false);
      }
    }, [showJoysticks]);

    useEffect(() => {
      if (!showChannels) return;

      const onPointerDown = (event: PointerEvent) => {
        const target = event.target as Node;
        if (channelsPanelRef.current?.contains(target)) return;
        if (channelsToggleButtonRef.current?.contains(target)) return;
        setShowChannels(false);
      };

      document.addEventListener("pointerdown", onPointerDown);
      return () => {
        document.removeEventListener("pointerdown", onPointerDown);
      };
    }, [showChannels]);

    useEffect(() => {
      setSavedHomeTarget(null);
      setBackendHomeTarget(null);
      setShowRthPath(false);
      setOverlayData(null);
      if (robot?.robotId) {
        robotStore.setTelemetry(robot.robotId, null);
      }
    }, [robot?.robotId]);

    useEffect(() => {
      let canceled = false;

      async function loadHomePosition() {
        if (!robot?.robotId) return;
        try {
          const { data } = await api.get(`/api/robots/${robot.robotId}`);
          const lat = Number(data?.lat);
          const lng = Number(data?.lng);
          if (canceled) return;
          if (Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)) {
            setBackendHomeTarget([lat, lng]);
          } else {
            setBackendHomeTarget(null);
          }
        } catch (e) {
          if (!canceled) {
            setBackendHomeTarget(null);
          }
        }
      }

      loadHomePosition();

      return () => {
        canceled = true;
      };
    }, [robot?.robotId]);

    const clearHomeLongPress = () => {
      if (homePressTimerRef.current !== null) {
        window.clearTimeout(homePressTimerRef.current);
        homePressTimerRef.current = null;
      }
    };

    const saveHomePosition = async () => {
      if (isSavingHome) return;
      if (!currentGpsTarget) {
        alert("Немає поточної GPS позиції");
        return;
      }

      setIsSavingHome(true);
      try {
        await api.post("/api/robots/update-position", {
          robotId: robot.robotId,
          position: {
            lat: currentGpsTarget[0],
            lng: currentGpsTarget[1],
          },
        });
        setSavedHomeTarget([currentGpsTarget[0], currentGpsTarget[1]]);
        setBackendHomeTarget([currentGpsTarget[0], currentGpsTarget[1]]);
        alert("Home позицію збережено");
      } catch (e) {
        console.error("[UI] Failed to update home position", e);
        alert("Помилка збереження Home позиції");
      } finally {
        setIsSavingHome(false);
      }
    };

    const startHomeLongPress = () => {
      if (isSavingHome || !currentGpsTarget) return;
      clearHomeLongPress();
      homePressTimerRef.current = window.setTimeout(() => {
        homePressTimerRef.current = null;
        void saveHomePosition();
      }, 1200);
    };

    useEffect(() => {
      return () => {
        clearHomeLongPress();
      };
    }, []);



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
        robotStore.setTelemetry(robot.robotId, d);
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

    async function forceWebrtcRebootRequest() {
      if (isForcingWebrtcReboot) return;
      setIsForcingWebrtcReboot(true);
      try {
        const rebootClient = new WebRTCClient(robot.robotId, userId);
        await rebootClient.requestRebootForWebrtc("manual_webrtc_reboot_request");
        alert("Запит на перезапуск WebRTC сервісу відправлено");
      } catch (e) {
        console.error("[UI] Failed to request manual WebRTC reboot", e);
        alert("Помилка запиту перезапуску WebRTC сервісу");
      } finally {
        setIsForcingWebrtcReboot(false);
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
      setSavedHomeTarget(null);
      setShowRthPath(false);
      setMapInMainView(false);
      setPingMs(null);
      setPacketLoss({ lost: null, received: null, pct: null, fps: null });
      setOverlayData(null);
      robotStore.setTelemetry(robot.robotId, null);

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
        try {
          await clientRef.current?.requestRebootForWebrtc("manual_disconnect");
        } catch (rebootError) {
          console.warn("[UI] Failed to request WebRTC reboot on disconnect", rebootError);
        }
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

    const getHomeDistanceKm = (data: any): number | null => {
      const homeTargetForDistance = savedHomeTarget ?? backendHomeTarget;
      const gpsLat = Number(data?.gps?.lat);
      const gpsLon = Number(data?.gps?.lon);

      if (
        !homeTargetForDistance ||
        homeTargetForDistance[0] <= 0 ||
        homeTargetForDistance[1] <= 0 ||
        !Number.isFinite(gpsLat) ||
        !Number.isFinite(gpsLon) ||
        gpsLat <= 0 ||
        gpsLon <= 0
      ) {
        return null;
      }

      return haversineKm(homeTargetForDistance[0], homeTargetForDistance[1], gpsLat, gpsLon);
    };

    const lastSeenAt = currentRobot?.updatedAt ? new Date(currentRobot.updatedAt).getTime() : 0;
    const isRobotOffline = !lastSeenAt || Date.now() - lastSeenAt > 10000;
   


    return (
      <div className="fixed inset-0 bg-black bg-opacity-90 flex flex-col z-50">

        {/* HEADER */}
        <div className="h-14 bg-gray-900 border-b border-gray-700 flex items-center justify-between px-6 relative">
          <div className="flex items-center gap-4">
            <div className="text-xl font-semibold text-gray-200 flex items-center gap-2">
              <span>{currentRobot?.name ?? robot.name}</span>
              <span>{isRobotOffline ? "🔴" : "🟢"}</span>
            </div>
            <div className="h-6 w-px bg-gray-700" />
            <div className="text-sm text-gray-300">
              {videoRecord ? (
                <span className="font-mono text-sm">🔴 {elapsed}</span>
              ) : (
                <span className="text-gray-500">&nbsp;</span>
              )}
            </div>
          </div>

          {/* second section center: Sat + Home distance */}
          <div
            className="absolute top-0 h-14 flex items-center justify-center pointer-events-none"
            style={{ left: 0, width: "calc(50% - 160px)" }}
          >
            <div className="text-gray-300 text-sm text-center whitespace-pre">
              {overlayData && !overlayData.raw ? (() => {
                const satellites = overlayData.gps?.satellites_visible ?? "—";
                const hdop = overlayData.gps?.hdop ?? "—";
                const homeDist = getHomeDistanceKm(overlayData);
                const speed = Number(overlayData.gps?.speed);
                return [
                  `Sat: ${satellites}`,
                  `\\ ${hdop}`,
                  homeDist !== null ? `H-${homeDist.toFixed(2)} km` : null,
                  Number.isFinite(speed) ? `Speed : ${speed.toFixed(2)} kmh` : null,
                ].filter(Boolean).join("  ");
              })() : null}
            </div>
          </div>

          {/* center overlay */}
          <div className="absolute left-0 right-0 top-0 h-14 flex items-center justify-center pointer-events-none">
            <div className="text-gray-300 text-sm text-center whitespace-pre">
              {overlayData ? (
                overlayData.raw ? String(overlayData.raw) : (
                  overlayData.v !== undefined ? (() => {
                    return [
                      `B1: ${overlayData.v}v`,
                      `B2: ${overlayData.v2}v`,
                      `i: ${overlayData.i}`,
                      //`p: ${overlayData.p}`,
                      //`wh: ${overlayData.wh}`,
                    ].filter(Boolean).join("  ");
                  })() : JSON.stringify(overlayData)
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
            className={`absolute object-contain ${
              showMap && mapInMainView
                ? "top-6 left-[49px] w-72 h-56 rounded-lg overflow-hidden shadow-xl border border-gray-700 bg-gray-900 z-[1200] cursor-pointer"
                : "inset-0 w-full h-full"
            }`}
            onClick={showMap && mapInMainView ? () => setMapInMainView(false) : undefined}
            title={showMap && mapInMainView ? "Show video in main view" : undefined}
          />

          {showMap && mapInMainView && (
            <div className="absolute inset-0 z-10">
              <DroneMap robot={robot} homeTarget={savedHomeTarget} showRthPath={showRthPath} />
            </div>
          )}

          {/* MAP PIP */}
          {showMap && !mapInMainView && (
            <div
              className="
              absolute top-6 left-[49px] 
              w-72 h-56 rounded-lg overflow-hidden shadow-xl 
              border border-gray-700 bg-gray-900 z-30 cursor-pointer"
              onClick={() => setMapInMainView(true)}
              title="Show map in main view"
            >
              <DroneMap robot={robot} homeTarget={savedHomeTarget} showRthPath={showRthPath} />
            </div>
          )}

          {/* Floating controls (right side) */}
          <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-40">
            <button
              onClick={() =>
                setShowMap((prev) => {
                  const next = !prev;
                  if (!next) {
                    setMapInMainView(false);
                  }
                  return next;
                })
              }
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
                ref={channelsToggleButtonRef}
                onClick={() => setShowChannels((prev) => !prev)}
                className="w-12 h-12 rounded-full bg-gray-900/90 border border-gray-700 text-gray-200 shadow-lg hover:bg-gray-800"
                title={showChannels ? "Hide channels" : "Show channels"}
                aria-label={showChannels ? "Hide channels" : "Show channels"}
              >
                🎛️
              </button>
            )}
            <button
              onPointerDown={startHomeLongPress}
              onPointerUp={clearHomeLongPress}
              onPointerLeave={clearHomeLongPress}
              onPointerCancel={clearHomeLongPress}
              disabled={!currentGpsTarget || isSavingHome}
              className="w-12 h-12 rounded-full bg-gray-900/90 border border-gray-700 text-gray-200 shadow-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              title={
                currentGpsTarget
                  ? isSavingHome
                    ? "Saving Home..."
                    : "Hold 1.2s to save Home position"
                  : "No GPS position"
              }
              aria-label="Save Home position"
            >
              🏠
            </button>
            <button
              onClick={() => setShowRthPath((prev) => !prev)}
              className={`w-12 h-12 rounded-full border text-gray-200 shadow-lg ${
                showRthPath
                  ? "bg-green-700/90 border-green-600"
                  : "bg-gray-900/90 border-gray-700 hover:bg-gray-800"
              }`}
              title={showRthPath ? "Disable RTH path" : "Enable RTH path"}
              aria-label={showRthPath ? "Disable RTH path" : "Enable RTH path"}
            >
              RTH
            </button>
          </div>

          <div
            ref={channelsPanelRef}
            className={`absolute left-1/2 top-1/2 w-80 bg-gray-900/75 border border-gray-700 rounded-lg shadow-xl p-4 z-40 transition-[opacity,transform] duration-300 ease-out ${
              showJoysticks && showChannels
                ? "opacity-100 -translate-x-1/2 -translate-y-1/2 pointer-events-auto"
                : "opacity-0 -translate-x-1/2 -translate-y-[60%] pointer-events-none"
            }`}
          >
            <div className="text-gray-200 font-semibold mb-3">Channels</div>
            <div className="grid grid-cols-1 gap-3">
              <div className="grid grid-cols-4 items-center gap-2">
                <div className="text-gray-300">arm</div>
                {[-1, 0, 1].map((v) => (
                  <button
                    key={`ch5-${v}`}
                    onClick={() => setChannelValue("ch5", v)}
                    className={`px-2 h-[25px] rounded border text-sm flex items-center justify-center ${
                      channelState.ch5 === v
                        ? "bg-blue-600/80 border-blue-500/80 text-white"
                        : "bg-gray-800/80 border-gray-700/80 text-gray-300 hover:bg-gray-700/80"
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
                    className={`px-2 h-[25px] rounded border text-sm flex items-center justify-center ${
                      channelState.ch6 === v
                        ? "bg-blue-600/80 border-blue-500/80 text-white"
                        : "bg-gray-800/80 border-gray-700/80 text-gray-300 hover:bg-gray-700/80"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-4 items-center gap-2">
                <div className="text-gray-300">ch7</div>
                {[-1, 0, 1].map((v) => (
                  <button
                    key={`ch7-${v}`}
                    onClick={() => setChannelValue("ch7", v)}
                    className={`px-2 h-[25px] rounded border text-sm flex items-center justify-center ${
                      channelState.ch7 === v
                        ? "bg-blue-600/80 border-blue-500/80 text-white"
                        : "bg-gray-800/80 border-gray-700/80 text-gray-300 hover:bg-gray-700/80"
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
                    className={`px-2 h-[25px] rounded border text-sm flex items-center justify-center ${
                      channelState.ch8 === v
                        ? "bg-blue-600/80 border-blue-500/80 text-white"
                        : "bg-gray-800/80 border-gray-700/80 text-gray-300 hover:bg-gray-700/80"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 items-center gap-2">
                <div className="text-gray-300">ir</div>
                {[-1, 1].map((v) => (
                  <button
                    key={`ch9-${v}`}
                    onClick={() => setChannelValue("b1", v)}
                    className={`px-2 h-[25px] rounded border text-sm flex items-center justify-center ${
                      channelState.b1 === v
                        ? "bg-blue-600/80 border-blue-500/80 text-white"
                        : "bg-gray-800/80 border-gray-700/80 text-gray-300 hover:bg-gray-700/80"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 items-center gap-2">
                <div className="text-gray-300">light</div>
                {[-1, 1].map((v) => (
                  <button
                    key={`ch10-${v}`}
                    onClick={() => setChannelValue("b2", v)}
                    className={`px-2 h-[25px] rounded border text-sm flex items-center justify-center ${
                      channelState.b2 === v
                        ? "bg-blue-600/80 border-blue-500/80 text-white"
                        : "bg-gray-800/80 border-gray-700/80 text-gray-300 hover:bg-gray-700/80"
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
                    className={`px-2 h-[25px] rounded border text-sm flex items-center justify-center ${
                      channelState.b3 === v
                        ? "bg-blue-600/80 border-blue-500/80 text-white"
                        : "bg-gray-800/80 border-gray-700/80 text-gray-300 hover:bg-gray-700/80"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 items-center gap-2">
                <div className="text-gray-300">ch12</div>
                {[-1, 1].map((v) => (
                  <button
                    key={`ch12-${v}`}
                    onClick={() => setChannelValue("b4", v)}
                    className={`px-2 h-[25px] rounded border text-sm flex items-center justify-center ${
                      channelState.b4 === v
                        ? "bg-blue-600/80 border-blue-500/80 text-white"
                        : "bg-gray-800/80 border-gray-700/80 text-gray-300 hover:bg-gray-700/80"
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
                  start={handleJoystickStart}
                  throttle={50}
                  move={handleJoystickMove("left")}
                  stop={handleJoystickStop("left")}
                />
              </div>
              <div className="absolute bottom-6 right-6 z-40">
                <Joystick
                  controlPlaneShape={JoystickShape.AxisY}
                  start={handleJoystickStart}
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
            <>
              <button
                onClick={connectCamera}
                disabled={isConnecting || isRobotOffline}
                className={`px-4 py-2 rounded ${
                  isConnecting || isRobotOffline
                    ? "bg-blue-900 cursor-not-allowed opacity-60"
                    : "bg-blue-700 hover:bg-blue-800"
                }`}
              >
                {isConnecting ? "Connecting..." : "Connect camera"}
              </button>
              <button
                onClick={forceWebrtcRebootRequest}
                disabled={isForcingWebrtcReboot}
                className={`px-4 py-2 rounded ${
                  isForcingWebrtcReboot
                    ? "bg-orange-900 cursor-not-allowed opacity-60"
                    : "bg-orange-700 hover:bg-orange-800"
                }`}
              >
                {isForcingWebrtcReboot ? "Requesting..." : "Reboot WebRTC"}
              </button>
            </>
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
