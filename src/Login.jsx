import { useState } from "react";
import { api } from "./api";

export default function Login({ onEntrar }) {
  const [registo, setRegisto] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erro, setErro] = useState("");
  const [a, setA] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setErro(""); setA(true);
    try { onEntrar(await api.post(registo ? "/auth/register" : "/auth/login", { email, password })); }
    catch (err) { setErro(err.message); setA(false); }
  }

  return (
    <form className="auth" onSubmit={enviar}>
      <h1>Rastreador de Gastos</h1>
      <h2>{registo ? "Criar conta" : "Entrar"}</h2>
      <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></label>
      <label>Palavra-passe
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={registo ? 8 : undefined}
          autoComplete={registo ? "new-password" : "current-password"} required />
      </label>
      {erro && <p className="erro" role="alert">{erro}</p>}
      <button type="submit" disabled={a}>{registo ? "Criar conta" : "Entrar"}</button>
      <button type="button" className="secundario" onClick={() => { setRegisto(!registo); setErro(""); }}>
        {registo ? "Já tenho conta" : "Ainda não tenho conta"}
      </button>
    </form>
  );
}
