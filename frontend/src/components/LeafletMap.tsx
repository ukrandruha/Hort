import { useEffect, useState, useRef } from "react";
import { MapContainer as LeafletMapBase, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";

const droneIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/854/854894.png",
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

// Компонент для оновлення позиції маркера у реальному часі
function MovingMarker({ position }) {
  const markerRef = useRef(null);

  useEffect(() => {
    if (!markerRef.current) return;
    markerRef.current.setLatLng(position);
  }, [position]);

  return <Marker position={position} icon={droneIcon} ref={markerRef} />;
}

export default function LeafletMap({ robot, fullscreen }) {
  const [pos, setPos] = useState([48.4629585, 35.0321044]); // 48.4629585,35.0321044

 /*  // Симуляція руху дрона
  useEffect(() => {
    const interval = setInterval(() => {
      setPos((prev) => [
        prev[0] + (Math.random() - 0.5) * 0.0005,
        prev[1] + (Math.random() - 0.5) * 0.0005,
      ]);
    }, 800);

    return () => clearInterval(interval);
  }, []);
 */
  return (
    <LeafletMapBase
      center={pos}
      zoom={16}
      scrollWheelZoom={fullscreen}
      style={{ width: "100%", height: "100%" }}
    >
      <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{x}/{y}" />

      <MovingMarker position={pos} />

      <Popup position={pos}>
        {robot.name} <br /> {robot.robotId}
      </Popup>

      {/* Zoom controls */}
      {/* <MapZoomControls /> */}
    </LeafletMapBase>
  );
}

// Zoom UI
// function MapZoomControls() {
//   const map = useMap();

//   return (
//     <div className="absolute bottom-4 left-4 flex flex-col bg-gray-800 p-2 rounded shadow-lg">
//       <button
//         className="bg-gray-700 text-white px-2 py-1 mb-1 rounded hover:bg-gray-600"
//         onClick={() => map.zoomIn()}
//       >
//         +
//       </button>
//       <button
//         className="bg-gray-700 text-white px-2 py-1 rounded hover:bg-gray-600"
//         onClick={() => map.zoomOut()}
//       >
//         -
//       </button>
//     </div>
//   );
// }
