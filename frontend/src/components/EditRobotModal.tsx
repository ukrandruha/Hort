import { useEffect, useState } from "react";
import { api } from "../api/api";

export default function EditRobotModal({ robot, onClose, onSave }) {
  const [name, setName] = useState(robot.name);
  const [cameras, setCameras] = useState([]);
  const [cameraId, setCameraId] = useState("");
  const [loadingCameras, setLoadingCameras] = useState(true);

  useEffect(() => {
    loadCameras();
  }, []);

  async function loadCameras() {
    try {
      const res = await api.get(`api/robots/${robot.robotId}/cameras`);
      const data = res.data ?? [];

      setCameras(data);

      // камера за замовченням — та, що active === true
      const activeCamera = data.find((c) => c.active === true);
      if (activeCamera) {
        setCameraId(String(activeCamera.id));
      }
    } finally {
      setLoadingCameras(false);
    }
  }

  function save() {
    onSave({
      name: name.trim(),
      cameraId: cameraId ? Number(cameraId) : null,
    });
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-6 rounded-lg w-96 shadow-xl">
        <h2 className="text-xl font-semibold mb-4">Edit Robot</h2>

        {/* Name */}
        <label className="block text-gray-300 mb-2">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full p-2 mb-4 rounded bg-gray-700 text-white"
        />

        {/* Camera select */}
        <label className="block text-gray-300 mb-2">
          Default camera
        </label>

        {loadingCameras ? (
          <div className="text-gray-400 mb-4">Loading cameras…</div>
        ) : (
          <select
            value={cameraId}
            onChange={(e) => setCameraId(e.target.value)}
            className="w-full p-2 mb-4 rounded bg-gray-700 text-white"
          >
            <option value="">— Not selected —</option>
            {cameras.map((camera) => (
              <option key={camera.id} value={camera.id}>
                {camera.name} ({camera.port})
              </option>
            ))}
          </select>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-gray-600 hover:bg-gray-700"
          >
            Cancel
          </button>

          <button
            onClick={save}
            disabled={loadingCameras}
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
