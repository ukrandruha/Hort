import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import AssignRobotsModal from "./AssignRobotsModal";

export default function TopBar() {
  const { logout, token } = useAuth() as any;
  const [openSettings, setOpenSettings] = useState(false);

  function getRole(): string | null {
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.role;
    } catch {
      return null;
    }
  }

  const role = getRole();

  return (
    <div className="flex items-center justify-between px-6 py-4 bg-gray-800 shadow-md">
      <h1 className="flex items-center gap-2 text-xl font-semibold">
        <img src="/favicon.svg" alt="Hort logo" className="h-10 w-10" />
        <span>ХОРТ</span>
      </h1>

      <div className="flex items-center gap-3">
        {role === "admin" && (
          <>
            <button
              onClick={() => setOpenSettings(true)}
              className="bg-blue-600 px-4 py-2 rounded hover:bg-blue-700"
            >
              Settings
            </button>
            {openSettings && (
              <AssignRobotsModal onClose={() => setOpenSettings(false)} />
            )}
          </>
        )}

        <button
          onClick={logout}
          className="bg-red-600 px-4 py-2 rounded hover:bg-red-700"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
