import { useEffect, useState, useRef } from "react";
import {
  MapContainer as LeafletMapBase,
  TileLayer,
  Marker,
  Polyline,
  CircleMarker,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import { api } from "../api/api";

const droneIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/854/854894.png",
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

function MovingMarker({ position }: { position: [number, number] }) {
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.setLatLng(position);
    }
  }, [position]);

  return <Marker position={position} icon={droneIcon} ref={markerRef} />;
}

export default function LeafletMap({robot, missionId, fullscreen }) {
  const [pos, setPos] = useState<[number, number]>([
    48.4629585,
    35.0321044,
  ]);

  const [missionPoints, setMissionPoints] = useState<
    { lat: number; lng: number; order: number }[]
  >([]);

  const mapRef = useRef<L.Map | null>(null);

  /* ====== LOAD MISSION ====== */
  useEffect(() => {
    async function loadMission() {
      const { data } = await api.get(`/api/missions/${missionId}`);
      const sortedPoints = [...data.points].sort(
        (a, b) => a.order - b.order
      );
      setMissionPoints(sortedPoints);
    }

    loadMission();
  }, [missionId]);

  /* ====== CHECK DISTANCE TO START ====== */
  const startPoint =
    missionPoints.length > 0
      ? ([missionPoints[0].lat, missionPoints[0].lng] as [number, number])
      : null;

  const showStartLine =
    startPoint && mapRef.current
      ? mapRef.current.distance(pos, startPoint) > 10 // meters
      : false;

  const routeLatLngs = missionPoints.map(
    (p) => [p.lat, p.lng] as [number, number]
  );

  return (
    <LeafletMapBase
      center={pos}
      zoom={16}
      scrollWheelZoom={fullscreen}
      style={{ width: "100%", height: "100%" }}
      whenCreated={(map) => (mapRef.current = map)}
    >
      <TileLayer url="http://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}" />

      {/* DRONE */}
      <MovingMarker position={pos} />

      {/* MAIN ROUTE */}
      {routeLatLngs.length > 1 && (
        <Polyline
          positions={routeLatLngs}
          pathOptions={{
            color: "yellow",
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
            color: "yellow",
            weight: 2,
            dashArray: "4 6",
          }}
        />
      )}

      {/* INTERMEDIATE POINTS */}
      {missionPoints.map((p, index) => (
        <CircleMarker
          key={p.id}
          center={[p.lat, p.lng]}
          radius={4} // ≈ 3 mm
          pathOptions={{
            color: "red",
            fillColor: "red",
            fillOpacity: 1,
          }}
        />
      ))}
    </LeafletMapBase>
  );
}
