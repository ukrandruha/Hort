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
  const [users, setUsers] = useState<{ id: number; email: string }[]>([]);
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("user");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/api/robots/");
        setRobots(res.data || []);
      } catch (e) {
        console.error(e);
        alert("Failed to load robots");
      }
    })();
    (async () => {
      try {
        const res = await api.get("/api/admin/users");
        setUsers(res.data || []);
      } catch (e) {
        console.error(e);
        // non-fatal
      }
    })();
  }, []);

  function toggle(id: string) {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  }

  async function submit() {
    if (!selectedUser) {
      alert("Select a user");
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
        userId: Number(selectedUser),
        devices,
      });
      alert("Assigned successfully");
      onClose();
    } catch (err: any) {
      console.error("Assign robots error:", err);
      const serverMsg = err?.response?.data?.error || err?.response?.data || err?.message;
      alert("Assign failed: " + String(serverMsg));
    } finally {
      setLoading(false);
    }
  }

  async function createUser() {
    if (!newEmail || !newPassword) {
      alert("Email and password required");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/api/auth/register", {
        email: newEmail,
        password: newPassword,
        role: newRole,
      });

      const created = res.data?.user;
      if (created) {
        // refresh users list
        const list = await api.get("/api/admin/users");
        setUsers(list.data || []);
        setSelectedUser(created.id);
        setShowAddUser(false);
        setNewEmail("");
        setNewPassword("");
        setNewRole("user");
        alert("User created");
      } else {
        alert("User creation failed");
      }
    } catch (err: any) {
      console.error("Create user error:", err);
      const serverMsg = err?.response?.data?.error || err?.response?.data || err?.message;
      alert("Create failed: " + String(serverMsg));
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
          <label className="block text-sm text-gray-300 mb-1">User</label>
          <div className="flex gap-2">
            <select
            className="w-full px-3 py-2 bg-gray-800 rounded border border-gray-700"
            value={selectedUser ?? ""}
            onChange={async (e) => {
              const v = e.target.value ? Number(e.target.value) : null;
              setSelectedUser(v);
              setSelected({});
              if (v) {
                try {
                  const res = await api.get(`/api/admin/user-devices/${v}`);
                  const assigned: string[] = res.data || [];
                  const map: Record<string, boolean> = {};
                  assigned.forEach((d) => (map[d] = true));
                  setSelected(map);
                } catch (err) {
                  console.error(err);
                  alert("Failed to load user's devices");
                }
              }
            }}
          >
            <option value="">-- Select user --</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.email} ({u.id})
              </option>
            ))}
            </select>

            <button
              type="button"
              className="px-3 py-2 bg-green-600 rounded hover:bg-green-700"
              onClick={() => setShowAddUser((s) => !s)}
            >
              {showAddUser ? "Close" : "Add user"}
            </button>
          </div>
          {showAddUser && (
            <div className="mt-3 p-3 border border-gray-700 rounded bg-gray-800">
              <label className="block text-sm text-gray-300 mb-1">Email</label>
              <input
                className="w-full px-3 py-2 bg-gray-900 rounded border border-gray-700 mb-2"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="user@example.com"
              />

              <label className="block text-sm text-gray-300 mb-1">Password</label>
              <input
                type="password"
                className="w-full px-3 py-2 bg-gray-900 rounded border border-gray-700 mb-2"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="password"
              />

              <label className="block text-sm text-gray-300 mb-1">Role</label>
              <select
                className="w-full px-3 py-2 bg-gray-900 rounded border border-gray-700 mb-3"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
              >
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="px-3 py-2 rounded bg-gray-700 hover:bg-gray-600"
                  onClick={() => setShowAddUser(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-700"
                  onClick={createUser}
                  disabled={loading}
                >
                  {loading ? "Creating..." : "Create"}
                </button>
              </div>
            </div>
          )}
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
