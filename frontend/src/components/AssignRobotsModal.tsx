import { useEffect, useState } from "react";
import { api } from "../api/api";
import { alert } from "./Alert/globalAlert";

interface Props {
  onClose: () => void;
}

type Robot = {
  robotId: string;
  name?: string | null;
};

export default function AssignRobotsModal({ onClose }: Props) {
  const [robots, setRobots] = useState<Robot[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [userId, setUserId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/api/robots");
        setRobots(res.data || []);
      } catch (e) {
        console.error(e);
        alert("Failed to load robots");
      }
    })();
  }, []);

  function toggle(id: string) {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  }

  async function submit() {
    if (!userId) {
      alert("Enter user id");
      return;
    }

    const devices = Object.keys(selected).filter((k) => selected[k]);
    if (devices.length === 0) {
      alert("Select at least one robot");
      return;
    }

    setLoading(true);
    try {
      await api.post("/api/admin/assign-robots", {
        userId: Number(userId),
        devices,
      });
      alert("Assigned successfully");
      onClose();
    } catch (e) {
      console.error(e);
      alert("Assign failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black opacity-50" onClick={onClose} />

      <div className="relative bg-gray-900 text-gray-200 rounded p-6 w-full max-w-2xl z-10">
        <h2 className="text-lg font-semibold mb-4">Assign Robots to User</h2>

        <div className="mb-4">
          <label className="block text-sm text-gray-300 mb-1">User ID</label>
          <input
            className="w-full px-3 py-2 bg-gray-800 rounded border border-gray-700"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="Enter numeric user id"
          />
        </div>

        <div className="mb-4 max-h-64 overflow-y-auto border border-gray-700 rounded p-2">
          {robots.map((r) => (
            <label key={r.robotId} className="flex items-center gap-2 py-1">
              <input
                type="checkbox"
                checked={!!selected[r.robotId]}
                onChange={() => toggle(r.robotId)}
              />
              <span>{r.name ?? r.robotId} ({r.robotId})</span>
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700"
            disabled={loading}
          >
            {loading ? "Assigning..." : "Assign"}
          </button>
        </div>
      </div>
    </div>
  );
}
