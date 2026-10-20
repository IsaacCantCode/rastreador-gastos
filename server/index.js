import express from "express";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { db } from "./db.js";
import { iniciarJobs, enviarRelatorio } from "./jobs.js";
import { TIPOS, CATEGORIAS } from "../src/utils.js";

const SECRET = process.env.JWT_SECRET;
if (!SECRET) { console.error("Falta JWT_SECRET no .env"); process.exit(1); }

const app = express();
app.use(express.json());
app.use(cookieParser());

const COLS = "id, name, amount, type, date, category, cycle, status";
const cookie = { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 30 * 864e5 };
const entrar = (res, id) => res.cookie("token", jwt.sign({ id }, SECRET, { expiresIn: "30d" }), cookie);
const publico = (u) => ({ id: u.id, email: u.email, orcamento: u.orcamento, lembretes: !!u.lembretes, ultimoCheckin: u.ultimo_checkin });
const erro = (res, code, msg) => res.status(code).json({ erro: msg });

function auth(req, res, next) {
  try {
    const { id } = jwt.verify(req.cookies.token, SECRET);
    req.user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
    if (!req.user) throw new Error();
    next();
  } catch { erro(res, 401, "Sessão expirada. Entra outra vez."); }
}

// --- Conta ---
app.post("/api/auth/register", (req, res) => {
  const email = String(req.body.email ?? "").trim().toLowerCase();
  const password = String(req.body.password ?? "");
  if (!/^\S+@\S+\.\S+$/.test(email)) return erro(res, 400, "Email inválido.");
  if (password.length < 8) return erro(res, 400, "A palavra-passe precisa de pelo menos 8 caracteres.");
  if (db.prepare("SELECT 1 FROM users WHERE email = ?").get(email)) return erro(res, 409, "Já existe uma conta com este email.");
  const r = db.prepare("INSERT INTO users (email, password_hash, ultimo_checkin) VALUES (?, ?, ?)")
    .run(email, bcrypt.hashSync(password, 10), new Date().toISOString());
  entrar(res, r.lastInsertRowid);
  res.status(201).json(publico(db.prepare("SELECT * FROM users WHERE id = ?").get(r.lastInsertRowid)));
});

app.post("/api/auth/login", (req, res) => {
  const email = String(req.body.email ?? "").trim().toLowerCase();
  const u = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!u || !bcrypt.compareSync(String(req.body.password ?? ""), u.password_hash)) return erro(res, 401, "Email ou palavra-passe errados.");
  entrar(res, u.id);
  res.json(publico(u));
});

app.post("/api/auth/logout", (_req, res) => { res.clearCookie("token"); res.json({ ok: true }); });
app.get("/api/me", auth, (req, res) => res.json(publico(req.user)));

app.put("/api/settings", auth, (req, res) => {
  const orc = Math.max(0, Number(req.body.orcamento) || 0);
  db.prepare("UPDATE users SET orcamento = ?, lembretes = ? WHERE id = ?").run(orc, req.body.lembretes ? 1 : 0, req.user.id);
  res.json(publico(db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id)));
});

// --- Gastos ---
function limpar(b) {
  const amount = Number(b.amount);
  if (!String(b.name ?? "").trim() || !(amount > 0) || !TIPOS[b.type] || !/^\d{4}-\d{2}-\d{2}$/.test(b.date ?? "")) return null;
  return {
    name: String(b.name).trim().slice(0, 100), amount, type: b.type, date: b.date,
    category: CATEGORIAS.includes(b.category) ? b.category : "Outros",
    cycle: b.cycle === "yearly" ? "yearly" : "monthly",
    status: b.status === "pago" ? "pago" : "previsto",
  };
}
const tocarCheckin = (id) => db.prepare("UPDATE users SET ultimo_checkin = ? WHERE id = ?").run(new Date().toISOString(), id);

app.get("/api/items", auth, (req, res) => res.json(db.prepare(`SELECT ${COLS} FROM items WHERE user_id = ?`).all(req.user.id)));

app.post("/api/items", auth, (req, res) => {
  const d = limpar(req.body);
  if (!d) return erro(res, 400, "Dados do gasto inválidos.");
  const id = crypto.randomUUID();
  db.prepare("INSERT INTO items (id, user_id, name, amount, type, date, category, cycle, status) VALUES (?,?,?,?,?,?,?,?,?)")
    .run(id, req.user.id, d.name, d.amount, d.type, d.date, d.category, d.cycle, d.status);
  tocarCheckin(req.user.id);
  res.status(201).json({ id, ...d });
});

app.put("/api/items/:id", auth, (req, res) => {
  const d = limpar(req.body);
  if (!d) return erro(res, 400, "Dados do gasto inválidos.");
  const r = db.prepare("UPDATE items SET name=?, amount=?, type=?, date=?, category=?, cycle=?, status=? WHERE id=? AND user_id=?")
    .run(d.name, d.amount, d.type, d.date, d.category, d.cycle, d.status, req.params.id, req.user.id);
  if (!r.changes) return erro(res, 404, "Gasto não encontrado.");
  tocarCheckin(req.user.id);
  res.json({ id: req.params.id, ...d });
});

app.delete("/api/items/:id", auth, (req, res) => {
  db.prepare("DELETE FROM items WHERE id = ? AND user_id = ?").run(req.params.id, req.user.id);
  tocarCheckin(req.user.id);
  res.json({ ok: true });
});

app.post("/api/checkin", auth, (req, res) => {
  tocarCheckin(req.user.id);
  res.json({ ultimoCheckin: new Date().toISOString() });
});

app.post("/api/report/:month/email", auth, async (req, res) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(req.params.month)) return erro(res, 400, "Mês inválido.");
  try { await enviarRelatorio(req.user, req.params.month); res.json({ ok: true }); }
  catch (e) { console.error(e); erro(res, 502, "Não foi possível enviar o email. Verifica a configuração SMTP."); }
});

// Em produção o próprio servidor entrega a app compilada
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), "../dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

const porta = process.env.PORT ?? 3001;
app.listen(porta, () => { console.log(`API em http://localhost:${porta}`); iniciarJobs(); });
