import { useEffect, useState } from "react";
import { api } from "./api";
import Login from "./Login.jsx";
import Gastos from "./Gastos.jsx";

export default function App() {
  const [u, setU] = useState(undefined); // undefined = a verificar sessão, null = sem sessão

  useEffect(() => { api.get("/me").then(setU).catch(() => setU(null)); }, []);

  if (u === undefined) return <p className="carregar">A carregar…</p>;
  if (!u) return <Login onEntrar={setU} />;
  return (
    <Gastos
      utilizador={u}
      mudar={(patch) => setU((x) => ({ ...x, ...patch }))}
      sair={async () => { try { await api.post("/auth/logout"); } catch {} setU(null); }}
    />
  );
}
