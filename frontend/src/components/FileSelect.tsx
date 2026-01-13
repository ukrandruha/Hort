import { useState } from "react";

export default function FileSelectModal({ onClose, onConfirm }) {
  const [file, setFile] = useState(null);

  function handleOk() {
    if (!file) return;
    onConfirm(file);
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 p-6 rounded-lg w-96 shadow-xl">
        <h2 className="text-xl font-semibold mb-4">
          Select file
        </h2>

        <label className="block text-gray-300 mb-2">
          File
        </label>

        <input
          type="file"
          accept=".waypoints"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="w-full p-2 mb-4 rounded bg-gray-700 text-white"
        />

        {file && (
          <div className="text-sm text-gray-400 mb-4">
            Selected: {file.name}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-gray-600 hover:bg-gray-700"
          >
            Cancel
          </button>

          <button
            onClick={handleOk}
            disabled={!file}
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
