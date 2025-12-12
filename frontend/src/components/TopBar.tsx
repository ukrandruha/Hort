import { useAuth } from "../auth/AuthContext";

export default function TopBar() {
  const { logout } = useAuth();

  return (
    <div className="flex items-center justify-between px-6 py-4 bg-gray-800 shadow-md">
      <h1 className="text-xl font-semibold">Hort Dashboard</h1>

      <button
        onClick={logout}
        className="bg-red-600 px-4 py-2 rounded hover:bg-red-700"
      >
        Logout
      </button>
    </div>
  );
}
