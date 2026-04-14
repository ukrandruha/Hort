import {
  useEffect,
  useState,
  useRef,
  useMemo,
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

function createDroneHeadingIcon(heading: number | null) {
  const rotation = Number.isFinite(heading) ? heading ?? 0 : 0;
  return L.divIcon({
    className: "",
    html: `
      <div style="
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        transform: rotate(${rotation}deg);
        transform-origin: 50% 50%;
      ">
        <div style="
          width: 0;
          height: 0;
          border-left: 9px solid transparent;
          border-right: 9px solid transparent;
          border-bottom: 18px solid #27ae60;
          filter: drop-shadow(0 0 4px rgba(0,0,0,0.6));
        "></div>
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
}: {
  position: [number, number];
  heading: number | null;
}) {
  const markerRef = useRef<L.Marker | null>(null);
  const markerIcon = useMemo(() => createDroneHeadingIcon(heading), [heading]);

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
    />;
}
/* ================= MAIN MAP ================= */

export default function LeafletMap({
  robotId,
  fullscreen,
  gpsTarget,
  heading = null,
  homeTarget = null,
  showRthPath = false,
}: {
  robotId: string;
  fullscreen: boolean;
  gpsTarget?: [number, number] | null;
  heading?: number | null;
  homeTarget?: [number, number] | null;
  showRthPath?: boolean;
}) {
  const [pos, setPos] = useState<[number, number]>([
    48.4629585,
    35.0321044,
  ]);
  const [homePos, setHomePos] = useState<[number, number] | null>(null);

  const [points, setPoints] = useState<
    { id: number; lat: number; lng: number; order: number }[]
  >([]);
  const [startPoint, setStartPoint] = useState<[number, number] | null>(null);

  const [showStartLine, setShowStartLine] = useState(true);
  const hasReachedStartRef = useRef(false);
 
  useEffect(() => {
    setStartPoint(null);
    setHomePos(null);
    hasReachedStartRef.current = false;
    setShowStartLine(true);
  }, [robotId]);

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
    if (!gpsTarget) return;
    const [lat, lng] = gpsTarget;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    setPos([lat, lng]);
  }, [gpsTarget]);

  useEffect(() => {
    if (!homeTarget) return;
    const [lat, lng] = homeTarget;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    setHomePos([lat, lng]);
  }, [homeTarget]);




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
      style={{ width: "100%", height: "100%" }}
    >
      <TileLayer url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}" />

      {/* DRONE */}
      <MovingDrone position={pos} heading={heading} />

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
      
    </LeafletMapBase>
   
  );}
