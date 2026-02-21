import { useEffect, useState, useRef } from "react";
import { api } from "../api/api";
import { getStatusColor, getCloudColor } from "../utils/statusColors";
import { useAuth } from "../auth/AuthContext";
import EditRobotModal from "./EditRobotModal";
import FileSelectModal from "./FileSelect";
import VideoViewer, { VideoViewerHandle } from "./VideoViewer";

import { alert } from "./Alert/globalAlert";

interface Robot {
  robotId: string;
  name: string | null;
  status: string | null;
  battery: number | null;
  cpu: number | null;
  memory: number | null;
  disk: number | null;
  temperature: number | null;
  lat: number | null;
  lng: number | null;
  updatedAt: string;
  operatorEmail: string | null;
  sessionStatus: string | null;
}

export default function RobotTable() {
  const [robots, setRobots] = useState<Robot[]>([]);
  const { token } = useAuth();
  const [editRobot, setEditRobot] = useState<Robot | null>(null);
  const [missionRobot, setSelectFile] = useState<Robot | null>(null);
  const [videoRobot, setVideoRobot] = useState<Robot | null>(null);

  const videoViewerRef = useRef<VideoViewerHandle | null>(null);
  const videoRobotRef = useRef<any>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const role = getRole();
  const userId = getUserId();

  async function load() {
    try {
      const res = await api.get("/api/robots/");
      const data = res.data;
      const currentVideoRobot = videoRobotRef.current;

      setRobots(data);

      if (currentVideoRobot) {
        const current = data.find(
          (r: Robot) => r.robotId === currentVideoRobot.robotId,
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

  useEffect(() => {
    function handleClickOutside() {
      setOpenMenuId(null);
    }
    document.addEventListener("click", handleClickOutside);
    return () => {
    document.removeEventListener("click", handleClickOutside);
  };
}, []);


  function openEdit(robot: Robot) {
    setEditRobot(robot);
  }

  function openSelectFile(robot: Robot) {
    setSelectFile(robot);
  }

  function openVideo(robot: Robot) {
    setVideoRobot(robot);
  }

  function closeVideo() {
    setVideoRobot(null);
  }


  async function saveRobot(data) {
    if (!editRobot) return;

    try {
      await api.patch(`/api/robots/${editRobot.robotId.trim()}`,  {name: data.name});

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

  async function requestDisconect(robotId: string) {
    if (!userId) {
      alert("User ID not available");
      return;
    }

    try {
      const disconnectData = {
        robotId: robotId,
        reason: "admin",
        disconnectedBy: userId.toString(),
        force: true
      };
      await api.post(`api/robots/robot-sessions/disconnect`, disconnectData);
    } catch (e) {
      alert(String(e));
    }
  }




  // Decode JWT to check role
  function getRole(): string | null {
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.role;
    } catch {
      return null;
    }
  }
  
  function getUserId(): number | null {
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.id;
    } catch {
      return null;
    }
  }


 type Waypoint = {
  lat: number;
  lng: number;
};

async function  parseQgcWaypoints(
  file: File
) {
  const text = await file.text();
  const lines = text.split(/\r?\n/);
  const points: Waypoint[] = [];



  // перший рядок — header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split("\t");
    if (parts.length < 10) continue;

    const lat = Number(parts[8]);
    const lng = Number(parts[9]);

    if (Number.isNaN(lat) || Number.isNaN(lng)) continue;

    points.push({ lat, lng });
  }

  return points;
}



  return (
    <div className="p-6">
     
      {editRobot && (
        <EditRobotModal
          robot={editRobot}
          onClose={() => setEditRobot(null)}
          onSave={saveRobot}
        />
      )}

      {missionRobot && (
        <FileSelectModal
          onClose={() => setSelectFile(null)}
          onConfirm={async (file) => {
            try {
              // Парсимо файл та отримуємо точки
              const points = await parseQgcWaypoints(file);
              
              if (points.length === 0) {
                alert("Файл не містить валідних точок");
                return;
              }

              const robotId = missionRobot.robotId;

              // Видаляємо старі місії робота
              try {
                await api.delete(`/api/robots/${robotId.trim()}/missions`);
              } catch (err) {
                // Ігноруємо помилку, якщо місій немає
                console.log("No existing missions to delete");
              }

              // Створюємо нову місію
              await api.post(`/api/robots/${robotId.trim()}/missions`, {
                name: `Mission ${new Date().toLocaleString()}`,
                points: points
              });

              alert("Місію успішно створено");
              setSelectFile(null);
              load(); // Оновлюємо список роботів
            } catch (err) {
              console.error("Failed to create mission:", err);
              alert("Помилка при створенні місії: " + (err instanceof Error ? err.message : String(err)));
            }
          }}
        />
      )}

      {videoRobot && userId && (
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
                <td className="py-2 px-4">{r.battery ?? "-"}%</td>

                <td className={`py-2 px-4 ${getStatusColor(r.cpu ?? 0)}`}>
                  {r.cpu ?? "-"}%
                </td>

                <td className={`py-2 px-4 ${getStatusColor(r.memory ?? 0)}`}>
                  {r.memory ?? "-"}%
                </td>

                <td className={`py-2 px-4 ${getStatusColor(r.disk ?? 0)}`}>
                  {r.disk ?? "-"}%
                </td>
                <td className={`py-2 px-4 ${getStatusColor(r.temperature ?? 0)}`}>
                  {r.temperature ?? "-"}°
                </td>


                <td className="py-2 px-4">
                  {new Date(r.updatedAt).toLocaleString()}
                </td>
                <td className={`py-2 px-4 ${operatorColor}`}>
                  {r.operatorEmail ?? "-"}
                </td>


<td className="py-2 px-4 flex items-center gap-2 relative">
  <button
    className="bg-green-600 px-3 py-1 rounded hover:bg-green-700"
    onClick={() => openVideo(r)}
  >
    Open
  </button>

  {(
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpenMenuId(openMenuId === r.robotId ? null : r.robotId);
        }}
        className="px-2 py-1 rounded hover:bg-gray-700"
      >
        ⋮
      </button>

      {openMenuId === r.robotId && (
        <div
          className="absolute right-0 top-full mt-2 w-32 bg-gray-800 border border-gray-700 rounded shadow-lg z-50"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full text-left px-4 py-2 hover:bg-gray-700"
            onClick={() => {
              openEdit(r);
              setOpenMenuId(null);
            }}
          >
            Edit
          </button>

          <button
            className="w-full text-left px-4 py-2 hover:bg-gray-700"
            onClick={() => {
              openSelectFile(r);
              setOpenMenuId(null);
            }}
          >
           Mission
          </button>

          <button
            className="w-full text-left px-4 py-2 text-red-400 hover:bg-red-600 hover:text-white"
            onClick={() => {
             // deleteRobot(r.robotId);
              requestDisconect(r.robotId)
              setOpenMenuId(null);
            }}
          >
            Disconect
          </button>
        </div>
      )}
    </>
  )}
</td>


                 
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
