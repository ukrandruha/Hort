
import { useEffect, useState, useRef } from "react";
import { api } from "../api/api";
import { getStatusColor, getCloudColor } from "../utils/statusColors";
import { useAuth } from "../auth/AuthContext";
import EditRobotModal from "./EditRobotModal";
import VideoViewer, { VideoViewerHandle } from "./VideoViewer";

import { alert } from "./Alert/globalAlert";

export default function RobotTable() {
  const [robots, setRobots] = useState([]);
  const { token } = useAuth();
  //const { user } = useAuth();
  const [editRobot, setEditRobot] = useState(null);
  const [videoRobot, setVideoRobot] = useState(null);

  const videoViewerRef = useRef<VideoViewerHandle | null>(null);
  const videoRobotRef = useRef<any>(null);

  let videorobotId: string = "";

  async function load() {
    try {
      const res = await api.get("/api/robots/");
      const data = res.data;
      const currentVideoRobot = videoRobotRef.current;

      setRobots(data);

      if (currentVideoRobot) {
        const current = data.find(
          (r: any) => r.robotId === currentVideoRobot.robotId,
        );
        if (current?.sessionStatus === "DISCONNECT_REQUESTED") {
          // ✅ ВИКЛИК МЕТОДУ В VideoViewer
          videoViewerRef.current?.onDisconnectRequested();
        }
      }

    } catch (e) {
      console.error("Failed to load robots", e);
    }
  }

  useEffect(() => {
    videoRobotRef.current = videoRobot;
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [videoRobot]);


  function openEdit(robot) {
    setEditRobot(robot);
  }

  function openVideo(robot) {
    setVideoRobot(robot);
    videorobotId = robot.robotId;
  }

  function closeVideo() {
    setVideoRobot(null);
    videorobotId = "";
  }


  async function saveRobot(data) {
    if (!editRobot) return;

    try {
      await api.patch(`/api/robots/${editRobot.robotId.trim()}`, data);
      setEditRobot(null);
      load();
    } catch (e) {
      alert("Edit failed");
      console.error(e);
    }
  }

  async function deleteRobot(robotId: string) {
    if (!confirm("Are you sure you want to delete this robot?")) return;

    try {
      await api.delete(`/api/robots/${robotId}`);
      load();
    } catch (e) {
      alert("Delete failed");
      console.error(e);
    }
  }





  // Decode JWT to check role
  function getRole(): string | null {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.role;
    } catch {
      return null;
    }
  }
  function getUserId(): number | null {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.id;
    } catch {
      return null;
    }
  }

  const role = getRole();
  const userId = getUserId();

  return (
    <div className="p-6">
      {editRobot && (
        <EditRobotModal
          robot={editRobot}
          onClose={() => setEditRobot(null)}
          onSave={saveRobot}
        />
      )}

      {videoRobot && (
        <VideoViewer ref={videoViewerRef} robot={videoRobot} userId={userId} onClose={closeVideo} />
      )}


      <table className="w-full table-auto border-collapse text-left text-gray-200">
        <thead className="bg-gray-800 text-gray-300">
          <tr>
            <th className="py-3 px-4">Name</th>
            <th className="py-3 px-4">RobotId</th>
            <th className="py-3 px-4">Status</th>
            <th className="py-3 px-4">Battery</th>
            <th className="py-3 px-4">CPU</th>
            <th className="py-3 px-4">Memory</th>
            <th className="py-3 px-4">Disk</th>
            <th className="py-3 px-4">Temp</th>
            <th className="py-3 px-4">Last Seen</th>
            <th className="py-3 px-4">Webrtc</th>
            <th className="py-3 px-4">Actions</th>
          </tr>
        </thead>

        <tbody>
          {robots.map((r) => {
            const lastSeenDate = new Date(r.updatedAt);
            const isOffline = Date.now() - lastSeenDate.getTime() > 10000;
            const cloudColor = isOffline ? "text-red-500" : "text-green-400";

            const requestdisconect = r.sessionStatus === "DISCONNECT_REQUESTED";
            const operatorColor = requestdisconect ? "text-yellow-400" : "text-green-400";

            return (
              <tr key={r.robotId} className="border-b border-gray-700">
                <td className="py-2 px-4">{r.name}</td>
                <td className="py-2 px-4">{r.robotId}</td>

                <td className={`py-2 px-4 ${cloudColor}`}>
                  ● {isOffline ? "Offline" : "Online"}
                </td>
                <td className="py-2 px-4">{r.Battery}</td>

                <td className={`py-2 px-4 ${getStatusColor(r.cpu)}`}>
                  {r.cpu ?? "-"}%
                </td>

                <td className={`py-2 px-4 ${getStatusColor(r.memory)}`}>
                  {r.memory ?? "-"}%
                </td>

                <td className={`py-2 px-4 ${getStatusColor(r.disk)}`}>
                  {r.disk ?? "-"}%
                </td>
                <td className={`py-2 px-4 ${getStatusColor(r.temperature)}`}>
                  {r.temperature ?? "-"}°
                </td>


                <td className="py-2 px-4">
                  {new Date(r.updatedAt).toLocaleString()}
                </td>
                <td className={`py-2 px-4 ${operatorColor}`}>
                  {r.operatorEmail ?? "-"}
                </td>

                {role === "admin" && (
                  <td className="py-2 px-4 flex gap-2">

                    <button
                      className="bg-green-600 px-3 py-1 rounded hover:bg-green-700"
                      onClick={() => openVideo(r)}
                    >
                      Open
                    </button>
                    <button
                      className="bg-blue-600 px-3 py-1 rounded hover:bg-blue-700"
                      onClick={() => openEdit(r)}
                    >
                      Edit
                    </button>

                    <button
                      className="bg-red-600 px-3 py-1 rounded hover:bg-red-700"
                      onClick={() => deleteRobot(r.robotId)}
                    >
                      Delete
                    </button>
                  </td>
                )}

              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
