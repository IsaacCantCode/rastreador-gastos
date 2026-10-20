# Rastreador de Gastos (full-stack)

React + Vite no front-end; Node + Express + SQLite no back-end.

- Contas com email e palavra-passe (bcrypt + cookie httpOnly com JWT); cada utilizador só vê os seus dados.
- Gastos fixos, assinaturas, planeados e imprevistos, orçamento mensal e relatório em .doc.
- Envio automático por email (todos os dias às 09:00, hora de Lisboa):
  lembrete semanal se passaram 7 dias sem atualizar, e relatório .doc do mês anterior.

## Arrancar em desenvolvimento (Node 20.6 ou superior)

```bash
npm install
cp .env.example .env   # e edita o JWT_SECRET
npm run dev
```

Abre http://localhost:5173. Sem `SMTP_HOST` no `.env`, os emails só aparecem na consola do servidor.

## Produção

```bash
npm run build
NODE_ENV=production JWT_SECRET=... npm start
```

O servidor entrega a app compilada e a API na mesma porta. Precisa de um disco persistente
(o ficheiro `data.db`) e de ficar sempre ligado, porque as tarefas agendadas correm dentro do processo.

Deploy: https://rastreador-gastos-8ff1.onrender.com
