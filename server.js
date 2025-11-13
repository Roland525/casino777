import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

const MOCK_URL = "https://69147b693746c71fe0486c2c.mockapi.io/users";

/* ========== Вспомогательные функции ========== */
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

/* ========== API ========== */

// Проверка связи
app.get("/api/test", async (req, res) => {
  try {
    const users = await safeFetch(MOCK_URL);
    res.json({ ok: true, users: users.length });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Регистрация
app.post("/api/register", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ ok: false, error: "Нет имени" });

    const existing = await getUserByName(name);
    if (existing) return res.json({ ok: false, error: "Имя занято" });

    const user = await createUser(name);
    res.json({ ok: true, user });
  } catch (e) {
    console.error("Register error:", e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Вход
app.post("/api/login", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ ok: false, error: "Нет имени" });

    const user = await getUserByName(name);
    if (!user) return res.status(404).json({ ok: false, error: "Пользователь не найден" });

    res.json({ ok: true, user });
  } catch (e) {
    console.error("Login error:", e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Обновление баланса
app.put("/api/balance", async (req, res) => {
  try {
    const { id, name, balance } = req.body;
    if (!id) return res.status(400).json({ ok: false, error: "Нет ID" });

    const updated = await updateBalance(id, name, balance);
    res.json({ ok: true, user: updated });
  } catch (e) {
    console.error("Balance error:", e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 🚫 Блокируем удаление
app.delete("*", (req, res) => {
  res.status(403).json({ ok: false, error: "Удаление запрещено" });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Lucky Box сервер запущен на порту ${PORT}`));
