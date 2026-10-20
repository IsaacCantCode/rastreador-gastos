// Datas, ocorrências mensais, totais e relatório

export const TIPOS = {
  assinatura: "Assinatura",
  fixo: "Gasto fixo",
  planeado: "Planeado",
  imprevisto: "Imprevisto",
};
export const RECORRENTES = ["assinatura", "fixo"]; // repetem-se todos os meses/anos
export const CATEGORIAS = ["Casa", "Alimentação", "Streaming", "Transportes", "Saúde e desporto", "Lazer", "Software", "Outros"];

const p2 = (n) => String(n).padStart(2, "0");
export const toISO = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const hoje = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
export const mesKey = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}`;
export const ultimoDia = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();

export function addMes(key, n) {
  const [y, m] = key.split("-").map(Number);
  return mesKey(new Date(y, m - 1 + n, 1));
}
export function nomeMes(key) {
  const [y, m] = key.split("-").map(Number);
  const t = new Intl.DateTimeFormat("pt-PT", { month: "long", year: "numeric" }).format(new Date(y, m - 1, 1));
  return t.charAt(0).toUpperCase() + t.slice(1);
}
export const eur = (n) => new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(n);

// Todas as cobranças de um mês (recorrentes + pontuais)
export function ocorrencias(itens, key) {
  const [y, m] = key.split("-").map(Number);
  const ult = new Date(y, m, 0).getDate();
  const out = [];
  for (const it of itens) {
    const [iy, im, id] = it.date.split("-").map(Number);
    let dia = null;
    if (RECORRENTES.includes(it.type)) {
      const começou = y > iy || (y === iy && m >= im);
      const calha = it.cycle === "yearly" ? m === im : true;
      if (começou && calha) dia = Math.min(id, ult);
    } else if (iy === y && im === m) dia = id;
    if (dia) out.push({ ...it, dia });
  }
  return out.sort((a, b) => a.dia - b.dia);
}

// Planeados por pagar contam como "previsto", o resto como "gasto"
export function totais(oc) {
  const t = { gasto: 0, previsto: 0, porTipo: {}, porCat: {} };
  for (const o of oc) {
    if (o.type === "planeado" && o.status !== "pago") { t.previsto += o.amount; continue; }
    t.gasto += o.amount;
    t.porTipo[o.type] = (t.porTipo[o.type] ?? 0) + o.amount;
    t.porCat[o.category] = (t.porCat[o.category] ?? 0) + o.amount;
  }
  return t;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const linhasOrdenadas = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]);

export function resumoTexto(key, oc, t, orcamento) {
  const l = [`Gastos de ${nomeMes(key)}`, `Total gasto: ${eur(t.gasto)}`];
  if (t.previsto) l.push(`Ainda previsto: ${eur(t.previsto)}`);
  if (orcamento) l.push(`Orçamento: ${eur(orcamento)} (${eur(orcamento - t.gasto - t.previsto)} de margem)`);
  l.push("", ...linhasOrdenadas(t.porTipo).map(([k, v]) => `${TIPOS[k]}: ${eur(v)}`));
  return l.join("\n");
}

// Documento Word (HTML com extensão .doc, abre no Word, Pages e Google Docs)
export function relatorioHtml(key, oc, t, orcamento) {
  const tabela = (cab, linhas) =>
    `<table border="1" cellpadding="5" style="border-collapse:collapse;width:100%"><tr>${cab.map((c) => `<th align="left">${c}</th>`).join("")}</tr>${linhas
      .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</table>`;
  return `<html><head><meta charset="utf-8"><title>Gastos ${key}</title></head><body style="font-family:Calibri,Arial,sans-serif">
<h1>Relatório de gastos — ${nomeMes(key)}</h1>
<p><b>Total gasto:</b> ${eur(t.gasto)}<br>${t.previsto ? `<b>Ainda previsto:</b> ${eur(t.previsto)}<br>` : ""}${orcamento ? `<b>Orçamento:</b> ${eur(orcamento)} — margem de ${eur(orcamento - t.gasto - t.previsto)}` : ""}</p>
<h2>Por tipo</h2>${tabela(["Tipo", "Valor"], linhasOrdenadas(t.porTipo).map(([k, v]) => [TIPOS[k], eur(v)]))}
<h2>Por categoria</h2>${tabela(["Categoria", "Valor"], linhasOrdenadas(t.porCat).map(([k, v]) => [k, eur(v)]))}
<h2>Todos os movimentos</h2>${tabela(["Dia", "Descrição", "Tipo", "Categoria", "Valor"],
    oc.map((o) => [o.dia, o.name + (o.type === "planeado" && o.status !== "pago" ? " (por pagar)" : ""), TIPOS[o.type], o.category, eur(o.amount)]))}
<p style="color:#666">Gerado em ${new Date().toLocaleDateString("pt-PT")}.</p></body></html>`;
}

export function descarregar(nome, html) {
  const url = URL.createObjectURL(new Blob(["\ufeff" + html], { type: "application/msword" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: nome });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
