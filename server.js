import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import crypto from "crypto";

const app = express();
app.use(express.json());
app.use(cors());

// === ТВОЙ MockAPI ===
const MOCK_URL = "https://69147b693746c71fe0486c2c.mockapi.io/users";

// === 🔒 Простая защита API (секретный токен между фронтом и сервером) ===
const API_KEY = process.env.API_KEY || "LuckySecret777"; // добавь ENV в Render

function checkKey(req, res, next) {
  const key = req.headers["x-api-key"];
  if (key !== API_KEY) return res.status(403).json({ ok: false, error: "Доступ запрещён" });
  next();
}

// ====== Утилиты ======
async function safeFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "User-Agent": "LuckyBoxServer/1.0",
      ...(options.headers || {})
    }
  });
  if (!res.ok) throw new Error(`MockAPI error ${res.status}`);
  return await res.json();
}

async function getUserByName(name) {
  const users = await safeFetch(`${MOCK_URL}?name=${encodeURIComponent(name)}`);
  return users.length ? users[0] : null;
}

async function createUser(name) {
  return await safeFetch(MOCK_URL, {
    method: "POST",
    body: JSON.stringify({ name, balance: 1000 })
  });
}

async function updateBalance(id, name, balance) {
  return await safeFetch(`${MOCK_URL}/${id}`, {
    method: "PUT",
    body: JSON.stringify({ name, balance })
  });
}

// ====== API ======
app.get("/api/test", async (req, res) => {
  try {
    const users = await safeFetch(MOCK_URL);
    res.json({ ok: true, users: users.length });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 🔐 Всё важное — только с API ключом
app.post("/api/register", checkKey, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ ok: false, error: "Нет имени" });

    const exist = await getUserByName(name);
    if (exist) return res.json({ ok: false, error: "Имя занято" });

    const user = await createUser(name);
    res.json({ ok: true, user });
  } catch (e) {
    console.error("register:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post("/api/login", checkKey, async (req, res) => {
  try {
    const { name } = req.body;
    const user = await getUserByName(name);
    if (!user) return res.status(404).json({ ok: false, error: "Пользователь не найден" });
    res.json({ ok: true, user });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.put("/api/balance", checkKey, async (req, res) => {
  try {
    const { id, name, balance } = req.body;
    if (!id) return res.status(400).json({ ok: false, error: "Нет ID" });
    const updated = await updateBalance(id, name, balance);
    res.json({ ok: true, user: updated });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 🚫 Защита от удаления пользователей
app.delete("*", (req, res) => {
  res.status(403).json({ ok: false, error: "Удаление запрещено" });
});

// === Anti-DDoS ограничение ===
let recentIPs = new Map();
app.use((req, res, next) => {
  const ip = req.ip;
  const now = Date.now();
  const last = recentIPs.get(ip) || 0;
  if (now - last < 700) return res.status(429).json({ ok: false, error: "Слишком часто" });
  recentIPs.set(ip, now);
  next();
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Lucky Box сервер запущен на ${PORT}`));
