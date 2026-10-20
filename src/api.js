async function pedir(metodo, url, corpo) {
  const r = await fetch("/api" + url, {
    method: metodo,
    headers: corpo ? { "Content-Type": "application/json" } : undefined,
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(dados.erro ?? "Algo correu mal."), { status: r.status });
  return dados;
}

export const api = {
  get: (u) => pedir("GET", u),
  post: (u, b) => pedir("POST", u, b ?? {}),
  put: (u, b) => pedir("PUT", u, b),
  del: (u) => pedir("DELETE", u),
};
