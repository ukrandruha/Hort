import { useEffect, useRef, useState } from "react";
import { Joystick } from "react-joystick-component";
import { WebRTCClient, type WebRTCVideoCodec } from "../webrtc/WebRTCClient";
import DroneMap from "./DroneMap";
import { GamepadReader, type GamepadState } from "../utils/Gamepad";
import { haversineKm } from "../utils/math";
import { PositionRecorder } from "../utils/positionRecorder";
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

    const startOfToday = () => {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    };

    const toDatetimeLocalValue = (date: Date) => {
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };

    const videoRef = useRef<HTMLVideoElement>(null);
    const clientRef = useRef<WebRTCClient | null>(null);
    const gp = useRef<GamepadReader | null>(null);
    const positionRecorderRef = useRef<PositionRecorder | null>(null);


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
    const [showRouteDialog, setShowRouteDialog] = useState(false);
    const [isRouteLoading, setIsRouteLoading] = useState(false);
    const [routeBegin, setRouteBegin] = useState(() => toDatetimeLocalValue(startOfToday()));
    const [routeEnd, setRouteEnd] = useState(() => toDatetimeLocalValue(new Date()));
    const [historicalRoute, setHistoricalRoute] = useState<[number, number][]>([]);
    const [historicalRouteFocusKey, setHistoricalRouteFocusKey] = useState(0);
    const [currentRobot, setCurrentRobot] = useState<any>(robot);
    const [savedHomeTarget, setSavedHomeTarget] = useState<[number, number] | null>(null);
    const [backendHomeTarget, setBackendHomeTarget] = useState<[number, number] | null>(null);
    const [showJoysticks, setShowJoysticks] = useState(false);
    const [showChannels, setShowChannels] = useState(false);
    const [isSavingHome, setIsSavingHome] = useState(false);
    const [showRthPath, setShowRthPath] = useState(false);
    const [isAudioEnabled, setIsAudioEnabled] = useState(false);
    const [videoCodec, setVideoCodec] = useState<WebRTCVideoCodec>("video/VP8");
    const [pingMs, setPingMs] = useState<number | null>(null);
    const [isVideoConnected, setIsVideoConnected] = useState(false);
    const [isForcingWebrtcReboot, setIsForcingWebrtcReboot] = useState(false);
    const [isCameraTransitioning, setIsCameraTransitioning] = useState(false);
    const [isDisconnectCooldown, setIsDisconnectCooldown] = useState(false);
    const [packetLoss, setPacketLoss] = useState<{
      lost: number | null;
      received: number | null;
      pct: number | null;
      fps: number | null;
    }>({ lost: null, received: null, pct: null, fps: null });
    const fpsRef = useRef<number | null>(null);
    const showJoysticksRef = useRef(false);
    const homePressTimerRef = useRef<number | null>(null);
    const disconnectCooldownTimerRef = useRef<number | null>(null);
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
        const x = typeof event.x === "number" ? event.x : 0;
        const y = typeof event.y === "number" ? event.y : 0;
        sendGamepadState({ ch2: x, ch1: y });
      }
    };

    const handleJoystickStop = (side: "left" | "right") => () => {
      if (side === "left") {
        sendGamepadState({ ch2: 0 });
      } else {
        sendGamepadState({ ch2: 0, ch1: 0 });
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

    const queueTelemetryPosition = (telemetry: any) => {
      if (!positionRecorderRef.current || !robot?.robotId || !hasEnoughSatellites(telemetry?.gps)) return;

      const gps = telemetry.gps;
      const altitude = Number(gps.altitude ?? gps.alt ?? telemetry?.altitude ?? telemetry?.alt);
      const speed = Number(gps.speed);
      const accuracy = Number(gps.accuracy ?? gps.hdop);
      const heading = Number(gps.compas ?? gps.heading ?? telemetry?.heading);
      const devicetime = gps.devicetime ?? telemetry?.devicetime ?? Date.now();

      void positionRecorderRef.current?.record({
        robotId: robot.robotId,
        devicetime,
        latitude: Number(gps.lat),
        longitude: Number(gps.lon),
        altitude: Number.isFinite(altitude) ? altitude : undefined,
        speed: Number.isFinite(speed) ? speed : undefined,
        accuracy: Number.isFinite(accuracy) ? accuracy : undefined,
        heading: Number.isFinite(heading) ? heading : null,
      });
    };

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
        queueTelemetryPosition(telemetry);
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
      setHistoricalRoute([]);
      setShowRouteDialog(false);
      setOverlayData(null);
      if (robot?.robotId) {
        robotStore.setTelemetry(robot.robotId, null);
      }
    }, [robot?.robotId]);

    // ============================================
    // AUTO-RECONNECT WEBRTC WHEN ROBOT COMES ONLINE
    // ============================================
    useEffect(() => {
      if (!robot?.robotId) return;

      let timeoutId: number | null = null;
      let stableCheckTimeoutId: number | null = null;
      let isReconnecting = false;

      const hasLiveFps = () => Number.isFinite(fpsRef.current) && (fpsRef.current ?? 0) > 0;

      const runAutoReconnect = async () => {
        if (isReconnecting) {
          return;
        }

        isReconnecting = true;
        try {
          console.log("[UI] Starting auto-reconnect...");

          try {
            if (gp.current) {
              await gp.current.stop();
              gp.current = null;
            }

            const activeRecorder = positionRecorderRef.current;
            positionRecorderRef.current = null;
            if (activeRecorder) {
              await activeRecorder.endSession();
            }

            if (clientRef.current) {
              await clientRef.current.stop();
            }
          } catch (cleanupError) {
            console.warn("[UI] Cleanup error during auto-reconnect", cleanupError);
          }

          clientRef.current = null;
          setConnected(false);
          setIsVideoConnected(false);
          setvideoRecord(false);
          setPingMs(null);
          fpsRef.current = null;
          setPacketLoss({ lost: null, received: null, pct: null, fps: null });

          await new Promise((resolve) => setTimeout(resolve, 500));

          if (!videoRef.current || !robot?.robotId) {
            console.log("[UI] Auto-reconnect cancelled: missing videoRef or robotId");
            return;
          }

          console.log("[UI] Connecting camera (auto-reconnect)…");
          const client = new WebRTCClient(robot.robotId, userId);
          clientRef.current = client;

          client.setVideoElement(videoRef.current);
          client.setPreferredVideoCodec(videoCodec);
          client.setConnectionBAudioEnabled(isAudioEnabled);
          client.onData = (d: any) => {
            robotStore.setTelemetry(robot.robotId, d);
          };
          client.onPing = (ms) => {
            setPingMs(ms);
          };
          client.onStats = (s) => {
            fpsRef.current = Number.isFinite(s.fps) ? s.fps : null;
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
            positionRecorderRef.current = new PositionRecorder();
            positionRecorderRef.current.startSession();
            setConnected(true);
            setupGamePadListeners();
            console.log("[UI] Auto-reconnect successful ✓");
          } catch (connectError) {
            console.error("[UI] Failed to auto-reconnect", connectError);
            try {
              if (clientRef.current === client) {
                await client.stop();
              }
            } catch (stopError) {
              console.warn("[UI] Stop error after failed reconnect", stopError);
            }
            clientRef.current = null;
            setConnected(false);
          }
        } catch (e) {
          console.error("[UI] Auto-reconnect fatal error", e);
          clientRef.current = null;
          setConnected(false);
        } finally {
          isReconnecting = false;
        }
      };

      const unsubscribe = robotStore.subscribeToOfflineTransition(robot.robotId, () => {
        console.log("[UI] Robot came back online, initiating auto-reconnect...");
        
        // Prevent multiple reconnect attempts
        if (isReconnecting) {
          console.log("[UI] Auto-reconnect already in progress");
          return;
        }

        // Clear any pending timeout
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId);
        }

        // Delay to ensure robot is fully online
        timeoutId = window.setTimeout(async () => {
          if (!clientRef.current || isReconnecting) {
            return;
          }

          // Check if video recovered naturally during the delay.
          // If FPS is present, keep current connection; if no FPS, continue with reconnect.
          if (hasLiveFps()) {
            console.log("[UI] WebRTC connection recovered naturally, skipping manual reconnect");
            if (stableCheckTimeoutId !== null) {
              window.clearTimeout(stableCheckTimeoutId);
            }
            stableCheckTimeoutId = window.setTimeout(() => {
              if (!clientRef.current || isReconnecting) {
                return;
              }
              if (hasLiveFps()) {
                return;
              }
              console.log("[UI] FPS disappeared after natural recovery, retrying auto-reconnect...");
              void runAutoReconnect();
            }, 3500) as unknown as number;
            return;
          }
          await runAutoReconnect();
        }, 1000) as unknown as number;
      });

      return () => {
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId);
        }
        if (stableCheckTimeoutId !== null) {
          window.clearTimeout(stableCheckTimeoutId);
        }
        unsubscribe();
      };
    }, [robot?.robotId, userId, isAudioEnabled, videoCodec]);

    const clearHistoricalRoute = () => {
      setHistoricalRoute([]);
      setHistoricalRouteFocusKey(0);
      setShowRouteDialog(false);
      setIsRouteLoading(false);
    };

    const handleRouteButtonClick = () => {
      if (historicalRoute.length > 0) {
        clearHistoricalRoute();
        return;
      }

      setRouteBegin(toDatetimeLocalValue(startOfToday()));
      setRouteEnd(toDatetimeLocalValue(new Date()));
      setShowRouteDialog(true);
    };

    const loadHistoricalRoute = async () => {
      if (!robot?.robotId) {
        alert("Robot is not selected");
        return;
      }

      if (!routeBegin || !routeEnd) {
        alert("Вкажіть початок та кінець періоду");
        return;
      }

      const beginDate = new Date(routeBegin);
      const endDate = new Date(routeEnd);

      if (Number.isNaN(beginDate.getTime()) || Number.isNaN(endDate.getTime())) {
        alert("Некоректний формат дати/часу");
        return;
      }

      if (beginDate >= endDate) {
        alert("Початок періоду має бути раніше кінця");
        return;
      }

      setIsRouteLoading(true);
      try {
        const { data } = await api.get(`/api/robots/${robot.robotId}/positions`, {
          params: {
            // Keep local wall-clock time from datetime-local input to avoid UTC shift.
            datetime_begin: routeBegin,
            datetime_end: routeEnd,
          },
        });

        const rows = Array.isArray(data?.positions)
          ? data.positions
          : Array.isArray(data)
            ? data
            : [];

        // Historical route: render backend points as-is, without frontend filtering.
        const routePoints = rows.map((row: any) => [
          Number(row?.latitude ?? row?.lat),
          Number(row?.longitude ?? row?.lng),
        ] as [number, number]);

        if (routePoints.length < 2) {
          alert("Недостатньо точок для побудови маршруту");
          setHistoricalRoute([]);
          return;
        }

        setHistoricalRoute(routePoints);
        setHistoricalRouteFocusKey(Date.now());
        setShowRouteDialog(false);
        setShowMap(true);
      } catch (e) {
        console.error("[UI] Failed to load historical route", e);
        alert("Помилка завантаження маршруту");
      } finally {
        setIsRouteLoading(false);
      }
    };

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
        if (disconnectCooldownTimerRef.current !== null) {
          window.clearTimeout(disconnectCooldownTimerRef.current);
          disconnectCooldownTimerRef.current = null;
        }
      };
    }, []);



    // ============================================
    // CONNECT CAMERA
    // ============================================
    async function connectCamera() {
      if (isConnecting || clientRef.current) return;
      if (!videoRef.current) return;
      setIsConnecting(true);

      console.log("[UI] Connecting camera…");

      const client = new WebRTCClient(robot.robotId, userId);
      clientRef.current = client;

      client.setVideoElement(videoRef.current);
      client.setPreferredVideoCodec(videoCodec);
      client.setConnectionBAudioEnabled(isAudioEnabled);
      // receive parsed data from robot and show in header
      client.onData = (d: any) => {
        robotStore.setTelemetry(robot.robotId, d);
      };
      client.onPing = (ms) => {
        setPingMs(ms);
        //console.log(`[WebRTC] ping: ${ms ?? "—"} ms`);
      };
      client.onStats = (s) => {
        fpsRef.current = Number.isFinite(s.fps) ? s.fps : null;
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
        positionRecorderRef.current = new PositionRecorder();
        positionRecorderRef.current.startSession();
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

    function toggleAudioEnabled() {
      const next = !isAudioEnabled;
      setIsAudioEnabled(next);
      clientRef.current?.setConnectionBAudioEnabled(next);
    }

    function fullScreen() {

    }
    // ============================================
    // DISCONNECT CAMERA
    // ============================================
    async function disconnectCamera(requestReboot = true, rebootReason = "manual_disconnect") {
      console.log("[UI] Disconnecting camera…");

      const rebootClient = clientRef.current ?? new WebRTCClient(robot.robotId, userId);

      const activeRecorder = positionRecorderRef.current;
      positionRecorderRef.current = null;
      await activeRecorder?.endSession();

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
      fpsRef.current = null;
      setPacketLoss({ lost: null, received: null, pct: null, fps: null });
      setOverlayData(null);
      robotStore.setTelemetry(robot.robotId, null);

      if (requestReboot) {
        try {
          await rebootClient.requestRebootForWebrtc(rebootReason);
        } catch (rebootError) {
          console.warn("[UI] Failed to request WebRTC reboot on disconnect", rebootError);
        }
      }

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

async function handleCameraSelectionChange(value: string) {
  setCameraId(value);
  if (!value) return;

  setIsCameraTransitioning(true);
  try {
    await api.post(`/api/robots/${robot.robotId}/cameras/${value}/activate`);
    await loadCameras();

    const hasActiveCameraSession = Boolean(clientRef.current) || connected || isVideoConnected;

    if (hasActiveCameraSession) {
      console.log("[UI] Camera changed while active, running disconnect -> reboot -> reconnect...");
      await disconnectCamera(true, "camera_switch");
      await new Promise<void>((resolve) => window.setTimeout(resolve, 3000));
      await connectCamera();
      return;
    }

    console.log("[UI] Camera changed while inactive, requesting WebRTC reboot...");
    await forceWebrtcRebootRequest();
  } catch (err) {
    console.error("[UI] Failed to activate camera", err);
    alert("Failed to activate camera");
  } finally {
    setIsCameraTransitioning(false);
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
      if (connected && !isDisconnectCooldown) {
        setIsDisconnectCooldown(true);
        if (disconnectCooldownTimerRef.current !== null) {
          window.clearTimeout(disconnectCooldownTimerRef.current);
        }
        disconnectCooldownTimerRef.current = window.setTimeout(() => {
          setIsDisconnectCooldown(false);
          disconnectCooldownTimerRef.current = null;
        }, 5000) as unknown as number;

        try {
          await disconnectCamera();
        } catch (disconnectError) {
          console.warn("[UI] Disconnect camera failed", disconnectError);
        }
        // "robotId": "1000000012a168a1","reason":"", "disconnectedBy": "4" , "force":false}
        const disconnectData = {
          "robotId": robot.robotId,
          "reason": "",
          "disconnectedBy": userId.toString(),
          "force": false
        };
        try {
          await api.post(`api/robots/robot-sessions/deactivateWebrtc`, disconnectData);
        } catch (deactivateError) {
          console.warn("[UI] Failed to deactivate WebRTC session", deactivateError);
        }

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
    const isLedOn = Number(overlayData?.led) === 1;
   


    return (
      <div className="fixed inset-0 bg-black bg-opacity-90 flex flex-col z-50">

        {/* HEADER */}
        <div className="h-14 bg-gray-900 border-b border-gray-700 flex items-center justify-between px-6 relative">
          <div className="flex items-center gap-4">
            <div className="text-xl font-semibold text-gray-200 flex items-center gap-2">
              <span>{currentRobot?.name ?? robot.name}</span>
              <span>{isRobotOffline ? "🔴" : "🟢"}</span>
            </div>
          </div>

          {/* second section center */}
          <div
            className="absolute top-0 h-14 flex items-center justify-center pointer-events-none"
            style={{ left: 0, width: "calc(50% - 160px)" }}
          >
            <div className="text-gray-300 text-sm text-center whitespace-pre">
              {overlayData ? (
                overlayData.raw ? String(overlayData.raw) : (
                  overlayData.v !== undefined ? (() => {
                    return [
                      `B1: ${overlayData.v}v`,
                      `B2: ${overlayData.v2}v`,
                      `i: ${overlayData.i}`,
                    ].filter(Boolean).join("  ");
                  })() : JSON.stringify(overlayData)
                )
              ) : null}
            </div>
          </div>

          {/* center overlay */}
          <div className="absolute left-0 right-0 top-0 h-14 flex items-center justify-center pointer-events-none">
            <div className="text-gray-300 text-sm text-center whitespace-pre flex items-center gap-2">
              {overlayData && !overlayData.raw && (
                <span
                  className={`inline-block h-2 w-2 rounded-full ${isLedOn ? "bg-yellow-400" : "bg-gray-500"}`}
                />
              )}
              <span>
                {overlayData && !overlayData.raw ? (() => {
                const satellites = overlayData.gps?.satellites_visible ?? "—";
                const hdop = overlayData.gps?.hdop ?? "—";
                const homeDist = getHomeDistanceKm(overlayData);
                const speed = Number(overlayData.gps?.speed);
                return (
                  <>
                    <span>{`Sat: ${satellites}`}</span>
                    <span className="mx-2">{`\\ ${hdop}`}</span>
                    {homeDist !== null && <span className="mx-2">{`H-${homeDist.toFixed(2)} km`}</span>}
                    {Number.isFinite(speed) && (
                      <span className="mx-2 text-lg font-medium text-gray-100">{` ${speed} kmh`}</span>
                    )}
                  </>
                );
              })() : null}
              </span>
              {overlayData && !overlayData.raw && (
                <span
                  className={`inline-block h-2 w-2 rounded-full ${isLedOn ? "bg-yellow-400" : "bg-gray-500"}`}
                />
              )}
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
                  await handleCameraSelectionChange(e.target.value);
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
            <select
              value={videoCodec}
              onChange={(e) => {
                const codec = e.target.value as WebRTCVideoCodec;
                setVideoCodec(codec);
                clientRef.current?.setPreferredVideoCodec(codec);
              }}
              className="px-2 py-1 rounded bg-gray-800 text-gray-200 border border-gray-700 w-28"
              title="WebRTC codec"
            >
              <option value="video/VP8">VP8</option>
              <option value="video/H264">H264</option>
            </select>
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

          <div
            className={`absolute pointer-events-none ${
              showMap && mapInMainView
                ? "top-6 left-[49px] w-72 h-56 z-[1201]"
                : "inset-0 z-20"
            }`}
            aria-hidden="true"
          >
            <div className="relative w-full h-full">
              <div className="absolute left-1/2 top-1/2 h-5 w-[3px] -translate-x-1/2 -translate-y-1/2 bg-red-500/90" />
              <div className="absolute left-1/2 top-1/2 h-[3px] w-5 -translate-x-1/2 -translate-y-1/2 bg-red-500/90" />
            </div>
          </div>

          {showMap && mapInMainView && (
            <div className="absolute inset-0 z-10">
              <DroneMap
                robot={robot}
                homeTarget={savedHomeTarget}
                showRthPath={showRthPath}
                historicalRoute={historicalRoute}
                historicalRouteFocusKey={historicalRouteFocusKey}
              />
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
              <DroneMap
                robot={robot}
                homeTarget={savedHomeTarget}
                showRthPath={showRthPath}
                historicalRoute={historicalRoute}
                historicalRouteFocusKey={historicalRouteFocusKey}
              />
            </div>
          )}

          {showRouteDialog && (
            <div className="absolute inset-0 z-[1300] flex items-center justify-center bg-black/55">
              <div className="w-[420px] rounded-lg border border-gray-700 bg-gray-900 p-5 shadow-2xl">
                <div className="mb-4 text-lg font-semibold text-gray-100">Побудувати маршрут</div>
                <div className="flex flex-col gap-4">
                  <label className="text-sm text-gray-300">
                    Дата та час початку
                    <input
                      type="datetime-local"
                      value={routeBegin}
                      onChange={(e) => setRouteBegin(e.target.value)}
                      className="mt-1 w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-gray-100"
                    />
                  </label>

                  <label className="text-sm text-gray-300">
                    Дата та час кінця
                    <input
                      type="datetime-local"
                      value={routeEnd}
                      onChange={(e) => setRouteEnd(e.target.value)}
                      className="mt-1 w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-gray-100"
                    />
                  </label>
                </div>

                <div className="mt-5 flex items-center justify-end gap-2">
                  <button
                    onClick={() => setShowRouteDialog(false)}
                    disabled={isRouteLoading}
                    className="rounded border border-gray-700 bg-gray-800 px-4 py-2 text-gray-200 hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Скасувати
                  </button>
                  <button
                    onClick={loadHistoricalRoute}
                    disabled={isRouteLoading}
                    className="rounded bg-blue-700 px-4 py-2 text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isRouteLoading ? "Завантаження..." : "Показати маршрут"}
                  </button>
                </div>
              </div>
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
              className={`w-12 h-12 rounded-full border text-gray-200 shadow-lg flex items-center justify-center ${
                showMap
                  ? "bg-green-700/90 border-green-600"
                  : "bg-gray-900/90 border-gray-700 hover:bg-gray-800"
              }`}
              title={showMap ? "Hide map" : "Show map"}
              aria-label={showMap ? "Hide map" : "Show map"}
            >
              <img src="/map.svg" alt="map icon" className="w-6 h-6 invert" />
            </button>
            <button
              onClick={handleRouteButtonClick}
              className={`w-12 h-12 rounded-full border text-gray-200 shadow-lg flex items-center justify-center ${
                historicalRoute.length > 0
                  ? "bg-green-700/90 border-green-600"
                  : "bg-gray-900/90 border-gray-700 hover:bg-gray-800"
              }`}
              title={historicalRoute.length > 0 ? "Hide historical route" : "Show historical route"}
              aria-label={historicalRoute.length > 0 ? "Hide historical route" : "Show historical route"}
            >
              <img src="/route.svg" alt="route icon" className="w-6 h-6 invert" />
            </button>
            <button
              onClick={toggleAudioEnabled}
              className={`w-12 h-12 rounded-full border text-gray-200 shadow-lg flex items-center justify-center ${
                isAudioEnabled
                  ? "bg-green-700/90 border-green-600"
                  : "bg-gray-900/90 border-gray-700 hover:bg-gray-800"
              }`}
              title={`Audio: ${isAudioEnabled ? "так" : "ні"}`}
              aria-label={`Audio: ${isAudioEnabled ? "так" : "ні"}`}
            >
              <img src={isAudioEnabled ? "/audio-on.svg" : "/audio-off.svg"} alt="audio" className="w-6 h-6 invert" />
            </button>
            <button
              onClick={() => setShowJoysticks((prev) => !prev)}
              className={`w-12 h-12 rounded-full border text-gray-200 shadow-lg flex items-center justify-center ${
                showJoysticks
                  ? "bg-green-700/90 border-green-600"
                  : "bg-gray-900/90 border-gray-700 hover:bg-gray-800"
              }`}
              title={showJoysticks ? "Hide joysticks" : "Show joysticks"}
              aria-label={showJoysticks ? "Hide joysticks" : "Show joysticks"}
            >
              <img src="/joystick.svg" alt="joystick" className="w-6 h-6 invert" />
            </button>
            {showJoysticks && (
              <button
                ref={channelsToggleButtonRef}
                onClick={() => setShowChannels((prev) => !prev)}
                className={`w-12 h-12 rounded-full border text-gray-200 shadow-lg flex items-center justify-center ${
                  showChannels
                    ? "bg-green-700/90 border-green-600"
                    : "bg-gray-900/90 border-gray-700 hover:bg-gray-800"
                }`}
                title={showChannels ? "Hide channels" : "Show channels"}
                aria-label={showChannels ? "Hide channels" : "Show channels"}
              >
                <img src="/control-panel.svg" alt="channels" className="w-6 h-6 invert" />
              </button>
            )}
            <button
              onPointerDown={startHomeLongPress}
              onPointerUp={clearHomeLongPress}
              onPointerLeave={clearHomeLongPress}
              onPointerCancel={clearHomeLongPress}
              disabled={!currentGpsTarget || isSavingHome}
              className="w-12 h-12 rounded-full bg-gray-900/90 border border-gray-700 text-gray-200 shadow-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              title={
                currentGpsTarget
                  ? isSavingHome
                    ? "Saving Home..."
                    : "Hold 1.2s to save Home position"
                  : "No GPS position"
              }
              aria-label="Save Home position"
            >
              <img src="/home.svg" alt="home" className="w-6 h-6 invert" />
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
              <div className="absolute bottom-6 right-6 z-40">
                <Joystick
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
            {overlayData?.starlink && (
              <div className="mt-2 border-t border-gray-700/50 pt-2">
                <div
                  className={`text-sm font-mono ${
                    overlayData.starlink.state === "CONNECTED" ? "text-gray-200/70" : "text-red-500"
                  }`}
                >
                  Starlink: {overlayData.starlink.state === "CONNECTED" ? "✓" : "✗"}
                </div>
                <div className="text-gray-200/70 text-sm font-mono">
                  {overlayData.starlink.latency_ms ?? "—"} ms / {(overlayData.starlink.drop_rate * 100).toFixed(1)}%
                </div>
                <div className="text-gray-200/70 text-sm font-mono">
                  obs: {overlayData.starlink.obstruction}%
                </div>
              </div>
            )}
          </div>
        </div>

        {/* FOOTER BUTTONS */}
        <div className="h-20 bg-gray-900 border-t border-gray-700 flex items-center gap-4 px-6">

          {!connected && (
            <>
              <button
                onClick={connectCamera}
                disabled={isConnecting || isRobotOffline || isDisconnectCooldown || isCameraTransitioning}
                className={`px-4 py-2 rounded ${
                  isConnecting || isRobotOffline || isDisconnectCooldown || isCameraTransitioning
                    ? "bg-blue-900 cursor-not-allowed opacity-60"
                    : "bg-blue-700 hover:bg-blue-800"
                }`}
              >
                {isConnecting
                  ? "Connecting..."
                  : isCameraTransitioning
                    ? "Switching camera..."
                  : isDisconnectCooldown
                    ? "Connect blocked..."
                    : "Connect camera"}
              </button>
              { <button
                onClick={forceWebrtcRebootRequest}
                disabled={isForcingWebrtcReboot}
                className={`px-4 py-2 rounded ${
                  isForcingWebrtcReboot
                    ? "bg-orange-900 cursor-not-allowed opacity-60"
                    : "bg-orange-700 hover:bg-orange-800"
                }`}
              >
                {isForcingWebrtcReboot ? "Requesting..." : "Reboot video service"}
              </button> }
            </>
          )}

          {connected && (
            <button
              onClick={operatorDisconnect}
              disabled={isDisconnectCooldown}
              className={`px-4 py-2 rounded ${
                isDisconnectCooldown
                  ? "bg-yellow-800 cursor-not-allowed opacity-60"
                  : "bg-yellow-600 hover:bg-yellow-700"
              }`}
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
             🔴 Stop {elapsed}
            </button>
          )}

        </div>
      </div>
    );
  }
);
export default VideoViewer;
