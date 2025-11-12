import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

// 👇 ТВОЙ endpoint коллекции (не шаблон с :endpoint)
const MOCK_URL = "https://69147b693746c71fe0486c2c.mockapi.io/users";

/* ===================== helpers ===================== */

async function safeJson(res) {
  // некоторые ответы MockAPI при не-200 могут не быть JSON
  try { return await res.json(); } catch { return null; }
}

/**
 * Надёжный поиск пользователя по имени.
 * 1) Пробуем /users?name=...
 * 2) Если 404 / любая ошибка — fallback: /users и фильтруем по name на сервере.
 */
async function getUserByName(name) {
  const url = `${MOCK_URL}?name=${encodeURIComponent(name)}`;
  try {
    const res = await fetch(url);
    if (res.ok) {
      const arr = await res.json();
      return Array.isArray(arr) && arr.length ? arr[0] : null;
    }
    // Если MockAPI дал 404/500 — логируем и делаем fallback
    console.warn(`[getUserByName] primary GET failed ${res.status}, fallback to full list`);
  } catch (e) {
    console.warn(`[getUserByName] primary GET error: ${e?.message || e}, fallback to full list`);
  }

  // Fallback: вытаскиваем всех и фильтруем локально
  const all = await fetch(MOCK_URL).then(r => r.ok ? r.json() : []);
  if (Array.isArray(all)) {
    return all.find(u => String(u?.name || "").trim() === String(name).trim()) || null;
  }
  return null;
}

async function createUser(name) {
  const res = await fetch(MOCK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, balance: 1000 }),
  });
  if (!res.ok) {
    const body = await safeJson(res);
    throw new Error(`MockAPI post error ${res.status} ${body ? JSON.stringify(body) : ""}`);
  }
  return await res.json();
}

async function updateBalance(id, name, balance) {
  // Ставим и name, и balance — чтобы не потерять поле name при PUT
  const res = await fetch(`${MOCK_URL}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, balance }),
  });
  if (!res.ok) {
    const body = await safeJson(res);
    throw new Error(`MockAPI put error ${res.status} ${body ? JSON.stringify(body) : ""}`);
  }
  return await res.json();
}

/* ===================== diagnostics ===================== */

app.get("/api/test", async (req, res) => {
  try {
    const r = await fetch(MOCK_URL);
    const users = r.ok ? await r.json() : [];
    res.json({ ok: true, users: Array.isArray(users) ? users.length : 0 });
  } catch (e) {
    console.error("Test error:", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

/* ===================== auth ===================== */

app.post("/api/register", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({ ok: false, error: "Нет имени" });

    let user = await getUserByName(name);
    if (user) return res.json({ ok: false, error: "Имя занято" });

    user = await createUser(name);
    res.json({ ok: true, user });
  } catch (e) {
    console.error("register:", e);
    res.status(500).json({ ok: false, error: "Ошибка сервера при регистрации" });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({ ok: false, error: "Нет имени" });

    const user = await getUserByName(name);
    if (!user) return res.status(404).json({ ok: false, error: "Пользователь не найден" });

    res.json({ ok: true, user });
  } catch (e) {
    console.error("login:", e);
    res.status(500).json({ ok: false, error: "Ошибка сервера при входе" });
  }
});

/* ===================== balance ===================== */

app.put("/api/balance", async (req, res) => {
  try {
    const { id, name, balance } = req.body;
    if (!id) return res.status(400).json({ ok: false, error: "Нет ID" });
    if (typeof balance !== "number") return res.status(400).json({ ok: false, error: "Некорректный баланс" });

    const updated = await updateBalance(id, name, balance);
    res.json({ ok: true, user: updated });
  } catch (e) {
    console.error("balance:", e);
    res.status(500).json({ ok: false, error: "Ошибка сервера при обновлении баланса" });
  }
});

/* ===================== start ===================== */

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Lucky Box сервер запущен на порту ${PORT}`));
