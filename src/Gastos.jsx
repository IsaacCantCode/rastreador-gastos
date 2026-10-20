import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import {
  TIPOS, RECORRENTES, CATEGORIAS, toISO, hoje, mesKey, addMes, nomeMes,
  ocorrencias, totais, eur, relatorioHtml, descarregar,
} from "./utils";

const SEMANA = 7 * 864e5;
const ICONES = {
  "Casa": ["fa-house", "#007AFF"], "Alimentação": ["fa-cart-shopping", "#FF9500"], "Streaming": ["fa-tv", "#FF2D55"],
  "Transportes": ["fa-car", "#5AC8FA"], "Saúde e desporto": ["fa-dumbbell", "#34C759"], "Lazer": ["fa-gamepad", "#AF52DE"],
  "Software": ["fa-laptop-code", "#5856D6"], "Outros": ["fa-tags", "#8e9bb0"],
};
const novoForm = () => ({ name: "", amount: "", type: "imprevisto", date: toISO(hoje()), category: "Alimentação", cycle: "monthly", status: "previsto" });

export default function Gastos({ utilizador: u, mudar, sair }) {
  const [itens, setItens] = useState([]);
  const [mes, setMes] = useState(mesKey(hoje()));
  const [form, setForm] = useState(novoForm);
  const [editId, setEditId] = useState(null);
  const [filtro, setFiltro] = useState("todos");
  const [agora, setAgora] = useState(new Date());
  const [msg, setMsg] = useState("");

  const tratar = (e) => (e.status === 401 ? sair() : setMsg(e.message));
  const tocar = () => mudar({ ultimoCheckin: new Date().toISOString() });

  useEffect(() => { api.get("/items").then(setItens).catch(tratar); }, []); // eslint-disable-line
  useEffect(() => { const t = setInterval(() => setAgora(new Date()), 60000); return () => clearInterval(t); }, []);

  const semanaDue = agora - new Date(u.ultimoCheckin) >= SEMANA;
  const dias = Math.floor((agora - new Date(u.ultimoCheckin)) / 864e5);

  const oc = useMemo(() => ocorrencias(itens, mes), [itens, mes]);
  const t = useMemo(() => totais(oc), [oc]);
  const visiveis = filtro === "todos" ? oc : oc.filter((o) => o.type === filtro);
  const comprometido = t.gasto + t.previsto;
  const pct = u.orcamento ? Math.min(100, (comprometido / u.orcamento) * 100) : 0;
  const estourou = u.orcamento > 0 && comprometido > u.orcamento;
  const maxCat = Math.max(1, ...Object.values(t.porCat));
  const recorrente = RECORRENTES.includes(form.type);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function guardar(e) {
    e.preventDefault();
    const amount = parseFloat(String(form.amount).replace(",", "."));
    if (!form.name.trim() || !(amount > 0)) return;
    const dados = { ...form, amount };
    try {
      if (editId) {
        const it = await api.put(`/items/${editId}`, dados);
        setItens(itens.map((i) => (i.id === editId ? it : i)));
      } else {
        setItens([...itens, await api.post("/items", dados)]);
        setMes(form.date.slice(0, 7));
      }
      setForm(novoForm()); setEditId(null); setMsg(""); tocar();
    } catch (err) { tratar(err); }
  }

  function editar(o) {
    const { dia, ...it } = o;
    setEditId(it.id); setForm({ ...novoForm(), ...it, amount: String(it.amount) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function remover(id) {
    try { await api.del(`/items/${id}`); setItens(itens.filter((i) => i.id !== id)); tocar(); } catch (err) { tratar(err); }
  }
  async function pagar(o) {
    const { dia, ...it } = o;
    try { const novo = await api.put(`/items/${o.id}`, { ...it, status: "pago" }); setItens(itens.map((i) => (i.id === o.id ? novo : i))); tocar(); } catch (err) { tratar(err); }
  }
  async function confirmarAtualizado() {
    try { mudar(await api.post("/checkin")); } catch (err) { tratar(err); }
  }
  async function guardarDefs(patch) {
    try { mudar(await api.put("/settings", { orcamento: u.orcamento, lembretes: u.lembretes, ...patch })); } catch (err) { tratar(err); }
  }
  async function enviarEmail() {
    setMsg("A enviar…");
    try { await api.post(`/report/${mes}/email`); setMsg(`Relatório de ${nomeMes(mes)} enviado para ${u.email}.`); } catch (err) { tratar(err); }
  }

  return (
    <div className="app">
      <aside className="painel">
        <div className="conta"><span className="brand-icon" aria-hidden="true"><i className="fa-solid fa-wallet" /></span><h1>Gastos</h1><button className="secundario" onClick={sair}>Sair</button></div>
        <p className="sub">{u.email}</p>
        <div className="nav-mes">
          <button className="secundario" onClick={() => setMes(addMes(mes, -1))} aria-label="Mês anterior">‹</button>
          <strong>{nomeMes(mes)}</strong>
          <button className="secundario" onClick={() => setMes(addMes(mes, 1))} aria-label="Mês seguinte">›</button>
        </div>
        <p className="total">{eur(t.gasto)}<small> gastos</small></p>
        <p className="sub">{t.previsto > 0 ? `+ ${eur(t.previsto)} planeados por pagar` : "Sem planeados por pagar"}</p>

        {u.orcamento > 0 && (
          <div className="orc">
            <div className="barra"><i className={estourou ? "estoura" : ""} style={{ width: `${pct}%` }} /></div>
            <p>{estourou ? `${eur(comprometido - u.orcamento)} acima do orçamento` : `${eur(u.orcamento - comprometido)} de margem (orçamento ${eur(u.orcamento)})`}</p>
          </div>
        )}

        {Object.keys(t.porTipo).length > 0 && <>
          <h2>Por tipo</h2>
          <ul className="linhas">{Object.entries(t.porTipo).sort((a, b) => b[1] - a[1]).map(([k, v]) => <li key={k}><span>{TIPOS[k]}</span><span>{eur(v)}</span></li>)}</ul>
          <h2>Por categoria</h2>
          <ul className="barras">{Object.entries(t.porCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
            <li key={k}><div className="linhas-topo"><span>{k}</span><span>{eur(v)}</span></div><div className="barra"><i style={{ width: `${(v / maxCat) * 100}%` }} /></div></li>
          ))}</ul>
        </>}

        <button className="secundario" disabled={oc.length === 0} onClick={() => descarregar(`gastos-${mes}.doc`, relatorioHtml(mes, oc, t, u.orcamento))}>Descarregar relatório (.doc)</button>
        <button className="secundario" disabled={oc.length === 0} onClick={enviarEmail}>Enviar relatório por email</button>

        <details className="defs">
          <summary>Definições</summary>
          <label>Orçamento mensal (€)
            <input key={u.orcamento} inputMode="decimal" defaultValue={u.orcamento || ""} placeholder="0"
              onBlur={(e) => guardarDefs({ orcamento: parseFloat(e.target.value.replace(",", ".")) || 0 })} />
          </label>
          <label className="check"><input type="checkbox" checked={u.lembretes} onChange={(e) => guardarDefs({ lembretes: e.target.checked })} /> Receber lembretes e relatório mensal por email</label>
        </details>
      </aside>

      <main>
        {msg && <p className="aviso info" role="status">{msg}</p>}
        {semanaDue && (
          <section className="aviso" role="status">
            <p><strong>Já passou uma semana ({dias} dias) desde a última atualização.</strong> Regista os gastos desta semana.</p>
            <button onClick={confirmarAtualizado}>Já está tudo atualizado</button>
          </section>
        )}

        <form className="form" onSubmit={guardar}>
          <h2>{editId ? "Editar gasto" : "Novo gasto"}</h2>
          <label>Descrição<input value={form.name} onChange={set("name")} placeholder="Netflix, renda, jantar…" required /></label>
          <label>Valor (€)<input value={form.amount} onChange={set("amount")} inputMode="decimal" placeholder="12,50" required /></label>
          <label>Tipo<select value={form.type} onChange={set("type")}>{Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label>{recorrente ? "Primeira cobrança" : "Data"}<input type="date" value={form.date} onChange={set("date")} required /></label>
          <label>Categoria<select value={form.category} onChange={set("category")}>{CATEGORIAS.map((c) => <option key={c}>{c}</option>)}</select></label>
          {recorrente && <label>Repete<select value={form.cycle} onChange={set("cycle")}><option value="monthly">Todos os meses</option><option value="yearly">Todos os anos</option></select></label>}
          {form.type === "planeado" && <label>Estado<select value={form.status} onChange={set("status")}><option value="previsto">Por pagar</option><option value="pago">Pago</option></select></label>}
          <div className="acoes">
            <button type="submit">{editId ? "Guardar alterações" : "Adicionar"}</button>
            {editId && <button type="button" className="secundario" onClick={() => { setEditId(null); setForm(novoForm()); }}>Cancelar</button>}
          </div>
        </form>

        <div className="filtros" role="group" aria-label="Filtrar por tipo">
          {["todos", ...Object.keys(TIPOS)].map((k) => (
            <button key={k} className={k === filtro ? "ativo" : ""} onClick={() => setFiltro(k)}>{k === "todos" ? "Todos" : TIPOS[k]}</button>
          ))}
        </div>

        {visiveis.length === 0 ? (
          <div className="vazio"><p>Sem gastos em {nomeMes(mes)}{filtro !== "todos" ? ` do tipo ${TIPOS[filtro].toLowerCase()}` : ""}. Adiciona o primeiro no formulário acima.</p></div>
        ) : (
          <ul className="lista">
            {visiveis.map((o) => {
              const porPagar = o.type === "planeado" && o.status !== "pago";
              const [icone, cor] = ICONES[o.category] ?? ICONES.Outros;
              return (
                <li key={o.id} className={porPagar ? "previsto" : ""}>
                  <div className="tx-icon" style={{ background: cor + "26", color: cor }} aria-hidden="true"><i className={`fa-solid ${icone}`} /></div>
                  <div>
                    <strong>{o.name}</strong>
                    <span>Dia {o.dia} · {TIPOS[o.type]} · {o.category}{RECORRENTES.includes(o.type) && o.cycle === "yearly" ? " · anual" : ""}{porPagar ? " · por pagar" : ""}</span>
                  </div>
                  <div className="valor">{eur(o.amount)}</div>
                  <div className="linha-acoes">
                    {porPagar && <button onClick={() => pagar(o)}>Marcar pago</button>}
                    <button className="secundario" onClick={() => editar(o)}>Editar</button>
                    <button className="secundario perigo" onClick={() => remover(o.id)} aria-label={`Apagar ${o.name}`}>Apagar</button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="nota">Editar ou apagar uma assinatura ou gasto fixo aplica-se a todos os meses.</p>
      </main>
    </div>
  );
}
