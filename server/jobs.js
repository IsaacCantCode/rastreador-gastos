import cron from "node-cron";
import nodemailer from "nodemailer";
import { db } from "./db.js";
import { ocorrencias, totais, relatorioHtml, resumoTexto, nomeMes, mesKey, addMes } from "../src/utils.js";

const smtp = !!process.env.SMTP_HOST;
const transporte = smtp
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  : nodemailer.createTransport({ jsonTransport: true });
const DE = process.env.MAIL_FROM ?? "Rastreador de Gastos <no-reply@localhost>";
const APP_URL = process.env.APP_URL ?? "http://localhost:5173";

async function enviar(msg) {
  await transporte.sendMail({ from: DE, ...msg });
  if (!smtp) console.log(`[email simulado] para ${msg.to}: ${msg.subject}`);
}

const itensDe = (id) => db.prepare("SELECT * FROM items WHERE user_id = ?").all(id);

export async function enviarRelatorio(user, key) {
  const oc = ocorrencias(itensDe(user.id), key);
  const t = totais(oc);
  await enviar({
    to: user.email,
    subject: `Gastos de ${nomeMes(key)}: ${t.gasto.toFixed(2).replace(".", ",")} €`,
    text: resumoTexto(key, oc, t, user.orcamento) + "\n\nO relatório completo vai em anexo.",
    attachments: [{ filename: `gastos-${key}.doc`, content: "\ufeff" + relatorioHtml(key, oc, t, user.orcamento), contentType: "application/msword" }],
  });
  db.prepare("INSERT OR IGNORE INTO reports_sent (user_id, month) VALUES (?, ?)").run(user.id, key);
}

// Corre todos os dias às 09:00 (Lisboa) e uma vez no arranque
export async function verificar() {
  const agora = new Date();
  const anterior = addMes(mesKey(agora), -1);
  const users = db.prepare("SELECT * FROM users WHERE lembretes = 1").all();

  for (const u of users) {
    try {
      // 1) Lembrete semanal: 7 dias sem atualizar, no máximo um email por semana
      const semCheckin = agora - new Date(u.ultimo_checkin) >= 7 * 864e5;
      const lembradoHa = u.ultimo_lembrete ? agora - new Date(u.ultimo_lembrete) : Infinity;
      if (semCheckin && lembradoHa >= 7 * 864e5) {
        await enviar({
          to: u.email,
          subject: "Hora de atualizar os teus gastos",
          text: `Já passou uma semana desde a última atualização.\nRegista os gastos desta semana: ${APP_URL}`,
        });
        db.prepare("UPDATE users SET ultimo_lembrete = ? WHERE id = ?").run(agora.toISOString(), u.id);
      }
      // 2) Relatório do mês anterior, enviado uma só vez
      const jaEnviado = db.prepare("SELECT 1 FROM reports_sent WHERE user_id = ? AND month = ?").get(u.id, anterior);
      if (!jaEnviado && ocorrencias(itensDe(u.id), anterior).length > 0) await enviarRelatorio(u, anterior);
    } catch (e) {
      console.error(`Falhou o envio para ${u.email}:`, e.message);
    }
  }
}

export function iniciarJobs() {
  cron.schedule("0 9 * * *", verificar, { timezone: "Europe/Lisbon" });
  verificar();
}
