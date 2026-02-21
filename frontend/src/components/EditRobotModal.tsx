import { useEffect, useState } from "react";
import { api } from "../api/api";

export default function EditRobotModal({ robot, onClose, onSave }) {
  const [name, setName] = useState(robot.name);

  function save() {
    onSave({
      name: name.trim(),
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

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-gray-600 hover:bg-gray-700"
          >
            Cancel
          </button>

          <button
            onClick={save}
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
