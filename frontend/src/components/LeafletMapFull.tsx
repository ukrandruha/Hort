import DroneMap from "./DroneMap";

export default function LeafletMapFull({ robot, onClose }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-95 z-50">
      <div className="h-14 bg-gray-900 border-b border-gray-700 flex items-center justify-between px-6">
        <span className="text-white text-xl">Map — {robot.name}</span>

        <button
          onClick={onClose}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded"
        >
          Close
        </button>
      </div>

      <div className="w-full h-[calc(100%-3.5rem)]">
        <DroneMap robot={robot} fullscreen />
      </div>
    </div>
  );
}
