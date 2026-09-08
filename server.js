'use strict';
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = 'ac-display-secret-2026-local';
const DB_PATH = path.join(__dirname, 'banco.json');

function loadDB() {
  if (!fs.existsSync(DB_PATH)) {
    const empty = { users: [], produtos: [], propostas: [] };
    fs.writeFileSync(DB_PATH, JSON.stringify(empty, null, 2), 'utf8');
    return empty;
  }
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); }
  catch { return { users: [], produtos: [], propostas: [] }; }
}

function saveDB(db) { fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8'); }
function generateId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'Token ausente' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'Token invalido' }); }
}

app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Campos obrigatorios' });
  const db = loadDB();
  if (db.users.find(u => u.email === email.toLowerCase().trim()))
    return res.status(409).json({ error: 'E-mail ja cadastrado' });
  const hash = await bcrypt.hash(password, 10);
  const user = { id: generateId(), email: email.toLowerCase().trim(), password: hash, created_at: new Date().toISOString() };
  db.users.push(user); saveDB(db);
  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: { id: user.id, email: user.email } });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const db = loadDB();
  const user = db.users.find(u => u.email === (email || '').toLowerCase().trim());
  if (!user) return res.status(401).json({ error: 'E-mail nao encontrado' });
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Senha incorreta' });
  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: { id: user.id, email: user.email } });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ user: { id: req.user.id, email: req.user.email } });
});

app.get('/api/produtos', authMiddleware, (req, res) => {
  const db = loadDB();
  res.json([...db.produtos].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
});

app.post('/api/produtos', authMiddleware, (req, res) => {
  const db = loadDB();
  const items = Array.isArray(req.body) ? req.body : [req.body];
  const created = items.map(p => ({ id: generateId(), nome: String(p.nome || '').trim(), preco: parseFloat(p.preco) || 0, created_at: new Date().toISOString() }));
  db.produtos.push(...created); saveDB(db); res.json(created);
});

app.delete('/api/produtos', authMiddleware, (req, res) => {
  const db = loadDB(); db.produtos = []; saveDB(db); res.json({ ok: true });
});

app.delete('/api/produtos/:id', authMiddleware, (req, res) => {
  const db = loadDB();
  const idx = db.produtos.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Produto nao encontrado' });
  db.produtos.splice(idx, 1); saveDB(db); res.json({ ok: true });
});

app.get('/api/propostas', authMiddleware, (req, res) => {
  const db = loadDB();
  res.json(db.propostas.filter(p => p.user_id === req.user.id).sort((a, b) => b.created_at.localeCompare(a.created_at)));
});

app.post('/api/propostas', authMiddleware, (req, res) => {
  const db = loadDB();
  const proposal = { ...req.body, id: generateId(), user_id: req.user.id, created_at: new Date().toISOString() };
  db.propostas.push(proposal); saveDB(db); res.json(proposal);
});

app.delete('/api/propostas/:id', authMiddleware, (req, res) => {
  const db = loadDB();
  const idx = db.propostas.findIndex(p => p.id === req.params.id && p.user_id === req.user.id);
  if (idx === -1) return res.status(404).json({ error: 'Proposta nao encontrada' });
  db.propostas.splice(idx, 1); saveDB(db); res.json({ ok: true });
});

app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });

app.listen(PORT, () => {
  console.log('');
  console.log('  AC Display - Servidor Local');
  console.log('  http://localhost:' + PORT);
  console.log('  Banco: banco.json | Ctrl+C para encerrar');
  console.log('');
});
