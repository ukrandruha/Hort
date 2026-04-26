import {
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
  type Dispatch,
  type SetStateAction,
  type MutableRefObject,
} from "react";
import {
  MapContainer as LeafletMapBase,
  TileLayer,
  Marker,
  Polyline,
  CircleMarker,
} from "react-leaflet";
import L from "leaflet";
import { api } from "../api/api";
import { useMap } from "react-leaflet";
import { positionRecorderConfig } from "../config/positionRecorder";
import { GeoCoordinate, isInvalidTelemetryPoint } from "../utils/coordinates";
import { robotStore } from "../utils/robotStore";

/** ================= ICONS ================= **/


function createCircleIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `
      <div style="
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: ${color};
        border: 3px solid white;
        box-shadow: 0 0 6px rgba(0,0,0,0.4);
      "></div>
    `,
    iconSize: [27, 27],
    iconAnchor: [14, 14], 
  });
}

function createDroneHeadingIcon(heading: number | null, isAlert: boolean) {
  const rotation = Number.isFinite(heading) ? heading ?? 0 : 0;
  const color = isAlert ? "#eb5757" : "#27ae60";
  // Swallow-tail shape: nose at top (15,1), wings at (29,27) and (1,27),
  // with a tail notch at (15,18) — gives a classic swallow-tail / arrowhead silhouette.
  return L.divIcon({
    className: "",
    html: `
      <div style="
        width: 30px;
        height: 30px;
        transform: rotate(${rotation}deg);
        transform-origin: 50% 50%;
      ">
        <svg viewBox="0 0 30 30" width="30" height="30" xmlns="http://www.w3.org/2000/svg"
             style="filter: drop-shadow(0 0 3px rgba(0,0,0,0.7));">
          <polygon
            points="15,1 29,27 15,20 1,27"
            fill="${color}"
            stroke="rgba(0,0,0,0.4)"
            stroke-width="0.8"
          />
        </svg>
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

function createPointIcon(number: number) {
  return L.divIcon({
    className: "",
    html: `
      <div style="
        width: 26px;
        height: 26px;
        border-radius: 50%;
        background: #2f80ed;
        border: 2px solid white;
        color: white;
        font-size: 13px;
        font-weight: 600;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 0 4px rgba(0,0,0,0.4);
      ">
        ${number}
      </div>
    `,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

/* ================= COMPONENTS ================= */
function MapFollower({ target }: { target: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    map.panTo(target, {
      animate: true,
      duration: 1,
    });
  }, [target, map]);

  return null;
}

function HistoricalRouteFocusOnce({
  route,
  focusKey,
}: {
  route: [number, number][];
  focusKey: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (!focusKey || route.length === 0) return;
    map.panTo(route[0], {
      animate: true,
      duration: 1,
    });
  }, [map, route, focusKey]);

  return null;
}

function StartLineManager({
  pos,
  startPoint,
  hasReachedStartRef,
  setShowStartLine,
}: {
  pos: [number, number];
  startPoint: [number, number] | null;
  hasReachedStartRef: MutableRefObject<boolean>;
  setShowStartLine: Dispatch<SetStateAction<boolean>>;
}) {
  const map = useMap();

  useEffect(() => {
    if (!startPoint) return;
    if (hasReachedStartRef.current) return;

    const distance = map.distance(pos, startPoint);
    if (distance <= 20) {
      hasReachedStartRef.current = true;
      setShowStartLine(false);
      return;
    }
    setShowStartLine(true);
  }, [map, pos, startPoint, hasReachedStartRef, setShowStartLine]);

  return null;
}

function MovingDrone({
  position,
  heading,
  isAlert,
  onClick,
}: {
  position: [number, number];
  heading: number | null;
  isAlert: boolean;
  onClick?: () => void;
}) {
  const markerRef = useRef<L.Marker | null>(null);
  const markerIcon = useMemo(() => createDroneHeadingIcon(heading, isAlert), [heading, isAlert]);

  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.setLatLng(position);
    }
  }, [position]);




  return     <Marker
      ref={markerRef}
      position={position}
      icon={markerIcon}
      zIndexOffset={1000}
      eventHandlers={{ click: onClick }}
    />;
}
/* ================= MAIN MAP ================= */

export default function LeafletMap({
  robotId,
  fullscreen,
  homeTarget = null,
  showRthPath = false,
  historicalRoute = [],
  historicalRouteFocusKey = 0,
}: {
  robotId: string;
  fullscreen: boolean;
  homeTarget?: [number, number] | null;
  showRthPath?: boolean;
  historicalRoute?: [number, number][];
  historicalRouteFocusKey?: number;
}) {
  const MAX_VALID_SPEED_KMH = positionRecorderConfig.maxSpeedKmh;
  const [pos, setPos] = useState<[number, number]>([
    48.4629585,
    35.0321044,
  ]);
  const [homePos, setHomePos] = useState<[number, number] | null>(null);
  const [telemetryGpsTarget, setTelemetryGpsTarget] = useState<[number, number] | null>(null);
  const [telemetryHeading, setTelemetryHeading] = useState<number | null>(null);
  const [isTelemetryInvalid, setIsTelemetryInvalid] = useState(false);
  const [copyToast, setCopyToast] = useState<string | null>(null);
  const copyToastTimerRef = useRef<number | null>(null);

  const [points, setPoints] = useState<
    { id: number; lat: number; lng: number; order: number }[]
  >([]);
  const [startPoint, setStartPoint] = useState<[number, number] | null>(null);

  const [showStartLine, setShowStartLine] = useState(true);
  const hasReachedStartRef = useRef(false);
 
  useEffect(() => {
    setStartPoint(null);
    setHomePos(null);
    setTelemetryGpsTarget(null);
    setTelemetryHeading(null);
    setIsTelemetryInvalid(false);
    hasReachedStartRef.current = false;
    setShowStartLine(true);
  }, [robotId]);

  useEffect(() => {
    if (!robotId) return;

    const unsubscribe = robotStore.subscribeTelemetry(robotId, (telemetry) => {
      const coordinate = GeoCoordinate.tryCreate(telemetry?.gps?.lat, telemetry?.gps?.lon);
      const speed = Number(telemetry?.gps?.speed);
      const isInvalidTelemetry = isInvalidTelemetryPoint(coordinate, speed, MAX_VALID_SPEED_KMH);

      setIsTelemetryInvalid(isInvalidTelemetry);

      if (coordinate && !coordinate.isZeroPair() && !isInvalidTelemetry) {
        setTelemetryGpsTarget(coordinate.toTuple());
      }

      const nextHeading = Number(telemetry?.gps?.compas);
      if (Number.isFinite(nextHeading)) {
        setTelemetryHeading(((nextHeading % 360) + 360) % 360);
      }
    });

    return unsubscribe;
  }, [robotId, MAX_VALID_SPEED_KMH]);

  useEffect(() => {
    async function loadHomePosition() {
      try {
        const { data } = await api.get(`/api/robots/${robotId}`);
        const lat = Number(data?.lat);
        const lng = Number(data?.lng);
        if (Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)) {
          setHomePos([lat, lng]);
        } else {
          setHomePos(null);
        }
      } catch (e) {
        console.warn("[Map] Failed to load home position", e);
      }
    }

    loadHomePosition();
  }, [robotId]);

  /* ===== LOAD MISSION ===== */
  useEffect(() => {
    async function loadMission() {
      const { data } = await api.get(`api/robots/${robotId}/missions`);
      const firstMission = Array.isArray(data) ? data[0] : null;
      const missionPoints = Array.isArray(firstMission?.points)
        ? firstMission.points
        : [];
      const sorted = [...missionPoints].sort((a, b) => a.order - b.order);
      setPoints(sorted);
      if (sorted.length > 0) {
        setStartPoint((prev) =>
          prev ?? ([sorted[0].lat, sorted[0].lng] as [number, number])
        );
      } else {
        setStartPoint(null);
      }
    }

    loadMission();
  }, [robotId]);

  useEffect(() => {
    hasReachedStartRef.current = false;
    setShowStartLine(true);
  }, [startPoint]);

  useEffect(() => {
    if (!telemetryGpsTarget) return;
    const [lat, lng] = telemetryGpsTarget;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    setPos([lat, lng]);
  }, [telemetryGpsTarget]);

  useEffect(() => {
    if (!homeTarget) return;
    const [lat, lng] = homeTarget;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    setHomePos([lat, lng]);
  }, [homeTarget]);

  useEffect(() => {
    return () => {
      if (copyToastTimerRef.current !== null) {
        window.clearTimeout(copyToastTimerRef.current);
      }
    };
  }, []);

  const showCopyToast = useCallback((message: string) => {
    if (copyToastTimerRef.current !== null) {
      window.clearTimeout(copyToastTimerRef.current);
    }

    setCopyToast(message);
    copyToastTimerRef.current = window.setTimeout(() => {
      setCopyToast(null);
      copyToastTimerRef.current = null;
    }, 3000);
  }, []);

  const handleDroneMarkerClick = useCallback(async () => {
    const coordinate = GeoCoordinate.tryCreate(pos[0], pos[1]);
    if (!coordinate) {
      showCopyToast("Поточні координати недоступні");
      return;
    }

    try {
      const coordsText = `MGRS: ${coordinate.toMGRS()}\nDEC: ${coordinate.toDecimalString()}`;
      await navigator.clipboard.writeText(coordsText);
      showCopyToast("Координати скопійовано в буфер");
    } catch {
      showCopyToast("Не вдалося скопіювати координати");
    }
  }, [pos, showCopyToast]);




  const routeLatLngs = useMemo(
    () => points.map((p) => [p.lat, p.lng] as [number, number]),
    [points]
  );

//  // Симуляція руху дрона 
//  const [activeIndex, setActiveIndex] = useState(0);
 
//  useEffect(() => { const interval = setInterval(() => 
//  { 
//   //if (!points.length) return;
//   if(points.length > 0)
//   {
//     if (activeIndex >= points.length) 
//     {
//       //setPos(pos); 
//       setActiveIndex(0);
//     }else{
//       const target = points[activeIndex];
//       setPos([target.lat, target.lng]);


//       setActiveIndex(activeIndex + 1);
//     }
//   }

// }, 1000); 
//   return () => clearInterval(interval); },
//    [activeIndex, points]); 


  return (
    <LeafletMapBase
      center={pos}
      zoom={21}
      scrollWheelZoom={true}
      attributionControl={false}
      style={{ width: "100%", height: "100%" }}
    >
      <TileLayer url="https://mt1.google.com/vt/lyrs=y&hl=uk&gl=ua&x={x}&y={y}&z={z}" />

      {/* DRONE */}
      <MovingDrone
        position={pos}
        heading={telemetryHeading}
        isAlert={isTelemetryInvalid}
        onClick={handleDroneMarkerClick}
      />

      {/* HOME POSITION */}
      {homePos && (
        <CircleMarker
          center={homePos}
          radius={8}
          pathOptions={{
            color: "#27ae60",
            fillColor: "#27ae60",
            fillOpacity: 1,
            weight: 1,
          }}
        />
      )}

       <MapFollower target={pos} />
      {!showRthPath && (
        <StartLineManager
          pos={pos}
          startPoint={startPoint}
          hasReachedStartRef={hasReachedStartRef}
          setShowStartLine={setShowStartLine}
        />
      )}

      {/* RTH PATH */}
      {showRthPath && homePos && (
        <Polyline
          positions={[pos, homePos]}
          pathOptions={{
            color: "#27ae60",
            weight: 3,
            dashArray: "8 8",
          }}
        />
      )}

      {/* HISTORICAL ROUTE */}
      {historicalRoute.length > 1 && (
        <Polyline
          positions={historicalRoute}
          pathOptions={{
            color: "#2f80ed",
            weight: 4,
            opacity: 0.95,
          }}
        />
      )}

      {historicalRoute.length > 0 && (
        <CircleMarker
          center={historicalRoute[0]}
          radius={7}
          pathOptions={{
            color: "#2f80ed",
            fillColor: "#2f80ed",
            fillOpacity: 1,
            weight: 2,
          }}
        />
      )}

      {historicalRoute.length > 1 && (
        <CircleMarker
          center={historicalRoute[historicalRoute.length - 1]}
          radius={7}
          pathOptions={{
            color: "#eb5757",
            fillColor: "#eb5757",
            fillOpacity: 1,
            weight: 2,
          }}
        />
      )}

      <HistoricalRouteFocusOnce route={historicalRoute} focusKey={historicalRouteFocusKey} />

      {/* MAIN ROUTE */}
      {!showRthPath && routeLatLngs.length > 1 && (
        <Polyline
          positions={routeLatLngs}
          pathOptions={{
            color: "#f2c94c",
            weight: 3,
            dashArray: "6 6",
          }}
        />
      )}

      {/* START CONNECTION */}
      {!showRthPath && showStartLine && startPoint && (
        <Polyline
          positions={[pos, startPoint]}
          pathOptions={{
            color: "rgb(216, 28, 14)",
            weight: 3,
            dashArray: "6 6",
          }}
        />
      )}

      {/* POINT MARKERS */}
      {!showRthPath && points.map((p) => (
        <Marker
          key={p.id}
          position={[p.lat, p.lng]}
          icon={createPointIcon(p.order + 1)}
        />
      ))}

      {copyToast && (
        <div className="pointer-events-none absolute top-4 left-1/2 z-[1001] -translate-x-1/2 rounded-md bg-black/80 px-4 py-2 text-sm text-white shadow-lg">
          {copyToast}
        </div>
      )}
      
    </LeafletMapBase>
   
  );}
