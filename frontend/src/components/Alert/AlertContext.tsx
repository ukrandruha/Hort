import {
  createContext,
  useContext,
  useState,
  ReactNode,
} from "react";
import AlertModal from "./AlertModal";

interface AlertData {
  title?: string;
  message: string;
}

interface AlertContextValue {
  show: (message: string, title?: string) => void;
}

const AlertContext = createContext<AlertContextValue | null>(null);

export function AlertProvider({ children }: { children: ReactNode }) {
  const [alert, setAlert] = useState<AlertData | null>(null);

  function show(message: string, title?: string) {
    setAlert({ message, title });
  }

  return (
    <AlertContext.Provider value={{ show }}>
      {children}

      {alert && (
        <AlertModal
          title={alert.title}
          message={alert.message}
          onOk={() => setAlert(null)}
        />
      )}
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const ctx = useContext(AlertContext);
  if (!ctx) {
    throw new Error("useAlert must be used inside AlertProvider");
  }
  return ctx;
}
