import { useEffect, useState, useRef, useMemo } from "react";
import {
  MapContainer as LeafletMapBase,
  TileLayer,
  Marker,
  Polyline,
} from "react-leaflet";
import L from "leaflet";
import { api } from "../api/api";

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
    iconSize: [15, 15],
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

/* ================= COMPONENTS ================= */

function MovingDrone({ position }: { position: [number, number] }) {
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.setLatLng(position);
    }
  }, [position]);

  return     <Marker
      ref={markerRef}
      position={position}
      icon={createCircleIcon("#27ae60")}
    />;
}
/* ================= MAIN MAP ================= */

export default function LeafletMap({
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

  const [showStartLine, setShowStartLine] = useState(true);
 

  const mapRef = useRef<L.Map | null>(null);

  /* ===== LOAD MISSION ===== */
  useEffect(() => {
    async function loadMission() {
      const { data } = await api.get(`/api/missions/${missionId}`);
      setPoints(
        [...data.points].sort((a, b) => a.order - b.order)
      );
    }

    loadMission();
  }, [missionId]);

  const startPoint = points.length
    ? ([points[0].lat, points[0].lng] as [number, number])
    : null;

  /* ===== DISTANCE TO START ===== */
  useEffect(() => {
    if (!mapRef.current || !startPoint) return;

    const distance = mapRef.current.distance(pos, startPoint);
    setShowStartLine(distance > 10); // meters
  }, [pos, startPoint]);




  const routeLatLngs = useMemo(
    () => points.map((p) => [p.lat, p.lng] as [number, number]),
    [points]
  );

  return (
    <LeafletMapBase
      center={pos}
      zoom={16}
      scrollWheelZoom={fullscreen}
      style={{ width: "100%", height: "100%" }}
      whenCreated={(map) => (mapRef.current = map)}
    >
      <TileLayer url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}" />

      {/* DRONE */}
      <MovingDrone position={pos}  />

      {/* MAIN ROUTE */}
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

      {/* START CONNECTION */}
      {showStartLine && startPoint && (
        <Polyline
          positions={[pos, startPoint]}
          pathOptions={{
            color: "#1198ceff",
            weight: 3,
            dashArray: "6 6",
          }}
        />
      )}

      {/* POINT MARKERS */}
      {points.map((p) => (
        <Marker
          key={p.id}
          position={[p.lat, p.lng]}
          icon={createPointIcon(p.order + 1)}
        />
      ))}
    </LeafletMapBase>
  );
}
