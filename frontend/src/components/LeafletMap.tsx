import { useEffect, useState, useRef, useMemo } from "react";
import {
  MapContainer as LeafletMapBase,
  TileLayer,
  Marker,
  Polyline,
} from "react-leaflet";
import L from "leaflet";
import "leaflet-rotatedmarker";
import { api } from "../api/api";

/* ================= ICONS ================= */

function createDroneIcon() {
  return L.divIcon({
    className: "",
    html: `
      <div style="
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: #27ae60;
        border: 3px solid white;
        box-shadow: 0 0 6px rgba(0,0,0,0.4);
      "></div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
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

/* ================= UTILS ================= */

function getBearing(
  from: [number, number],
  to: [number, number]
): number {
  const lat1 = (from[0] * Math.PI) / 180;
  const lat2 = (to[0] * Math.PI) / 180;
  const dLon = ((to[1] - from[1]) * Math.PI) / 180;

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/* ================= COMPONENTS ================= */

function DroneMarker({
  position,
  heading,
}: {
  position: [number, number];
  heading: number;
}) {
  const ref = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.setLatLng(position);
    ref.current.setRotationAngle(heading);
  }, [position, heading]);

  return (
    <Marker
      ref={ref}
      position={position}
      icon={createDroneIcon()}
      rotationOrigin="center"
    />
  );
}

function moveTowards(
  from: [number, number],
  to: [number, number],
  distanceMeters: number,
  map: L.Map
): [number, number] {
  const total = map.distance(from, to);

  if (total === 0 || distanceMeters >= total) return to;

  const ratio = distanceMeters / total;

  return [
    from[0] + (to[0] - from[0]) * ratio,
    from[1] + (to[1] - from[1]) * ratio,
  ];
}

/* ================= MAIN MAP ================= */

export default function LeafletMap({
  robot,
  missionId,
  fullscreen,
}: {
  missionId: number;
  fullscreen: boolean;
}) {
  const [pos, setPos] = useState<[number, number]>([
    48.4629585,
    35.0321044,
  ]);

  const [points, setPoints] = useState<
    { id: number; lat: number; lng: number; order: number }[]
  >([]);

  const [heading, setHeading] = useState(0);
  const mapRef = useRef<L.Map | null>(null);

  /* ===== LOAD MISSION ===== */
  useEffect(() => {
    async function loadMission() {
      const { data } = await api.get(`/api/missions/${missionId}`);
      setPoints([...data.points].sort((a, b) => a.order - b.order));
    }
    loadMission();
  }, [missionId]);

  const routeLatLngs = useMemo(
    () => points.map((p) => [p.lat, p.lng] as [number, number]),
    [points]
  );

  /* ===== DJI CAMERA LOGIC ===== */
  useEffect(() => {
    if (!mapRef.current || points.length === 0) return;

    const map = mapRef.current;

    // 1️⃣ камера завжди на дроні
    map.setView(pos, map.getZoom(), { animate: true });

    // 2️⃣ напрямок — на наступну точку
    const targetPoint = points[0];
    const target: [number, number] = [targetPoint.lat, targetPoint.lng];

    const angle = getBearing(pos, target);
    setHeading(angle);
  }, [pos, points]);

////////////////test/////////////////////
const SPEED_MPS = 6; // швидкість дрона (м/с)
const TICK_MS = 200; // інтервал оновлення

const [activeIndex, setActiveIndex] = useState(1);

useEffect(() => {
  if (!mapRef.current || activeIndex >= points.length) return;

  const map = mapRef.current;
  const target = points[activeIndex];

  const interval = setInterval(() => {
    setPos((current) =>
      moveTowards(
        current,
        [target.lat, target.lng],
        (SPEED_MPS * TICK_MS) / 1000,
        map
      )
    );
  }, TICK_MS);

  return () => clearInterval(interval);
}, [activeIndex, points]);



  return (
    <LeafletMapBase
      center={pos}
      zoom={16}
      scrollWheelZoom={fullscreen}
      style={{ width: "100%", height: "100%" }}
      whenCreated={(map) => (mapRef.current = map)}
    >
      <TileLayer url="http://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}" />

      {/* ROUTE */}
      {routeLatLngs.length > 1 && (
        <Polyline
          positions={routeLatLngs}
          pathOptions={{
            color: "#f2c94c",
            weight: 3,
            dashArray: "6 6",
          }}
        />
      )}

      {/* WAYPOINTS */}
      {points.map((p) => (
        <Marker
          key={p.id}
          position={[p.lat, p.lng]}
          icon={createPointIcon(p.order + 1)}
        />
      ))}

      {/* DRONE */}
      <DroneMarker position={pos} heading={heading} />
    </LeafletMapBase>
  );
}
