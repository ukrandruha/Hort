import { BrowserRouter, Routes, Route } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import { AuthProvider } from "./auth/AuthContext";
import ProtectedRoute from "./auth/ProtectedRoute";

import { AlertProvider } from "./components/Alert/AlertContext";
import { useAlert } from "./components/Alert/AlertContext";
import { registerAlert } from "./components/Alert/globalAlert";
import { useEffect } from "react";

export default function App() {
  
  const { show } = useAlert();
  useEffect(() => {
    registerAlert(show);
  }, [show]);

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
root.render(
  <AlertProvider>
    <App />
  </AlertProvider>
);
