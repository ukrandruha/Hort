import { useEffect, useState } from "react";
import { api } from "../api/api";

export function UserEmailCell({ userId }: { userId: number }) {
  const [email, setEmail] = useState("loading...");

  // --- перенесена функція сюди ---
  async function getUserEmailById(id: number) {
    const res = await api.get(`/api/auth/user-email/${id}`);
    return res.data;
  }
  // ---------------------------------

  useEffect(() => {
    if (!userId) {
      setEmail("-");
      return;
    }

    getUserEmailById(userId)
      .then((data) => setEmail(data.email))
      .catch(() => setEmail("unknown"));
  }, [userId]);

  return <span>{email}</span>;
}
