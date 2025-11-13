import express from "express";
import cors from "cors";
import path from "path";
import fetch from "node-fetch";
import { fileURLToPath } from "url";

const app = express();

// 🔹 Настройки
const MOCK_URL = "https://69147b693746c71fe0486c2c.mockapi.io/users";
const SECRET_KEY = process.env.SECRET_KEY || "dev-key-only-for-local";
const PORT = process.env.PORT || 10000;

// Для статических файлов
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🔹 Middleware
app.use(cors({
  origin: ["https://casino777.onrender.com", "http://localhost:5500"],
  methods: ["GET", "POST", "PUT", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
}));
app.use(express.json());
app.use(express.static(__dirname));

// 🔹 Главная страница
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ===== API РОУТЫ =====

// 🧩 Найти пользователя по нику
app.post("/api/findUser", async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "No name" });

  try {
    const r = await fetch(`${MOCK_URL}?name=${encodeURIComponent(name)}`, {
      headers: { "x-key": SECRET_KEY },
    });
    const data = await r.json();
    res.json({ user: data[0] || null });
  } catch (e) {
    console.error("findUser error:", e);
    res.status(500).json({ error: "findUser failed" });
  }
});

// 🧩 Создать пользователя
app.post("/api/createUser", async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "No name" });

  try {
    const r = await fetch(MOCK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-key": SECRET_KEY },
      body: JSON.stringify({ name, balance: 1000 }),
    });
    const data = await r.json();
    res.json({ user: data });
  } catch (e) {
    console.error("createUser error:", e);
    res.status(500).json({ error: "createUser failed" });
  }
});

// 🧩 Сохранить баланс
app.post("/api/saveBalance", async (req, res) => {
  const { id, balance } = req.body;
  if (!id) return res.status(400).json({ error: "No id" });

  try {
    const r = await fetch(`${MOCK_URL}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-key": SECRET_KEY },
      body: JSON.stringify({ balance }),
    });
    const data = await r.json();
    res.json({ ok: true, user: data });
  } catch (e) {
    console.error("saveBalance error:", e);
    res.status(500).json({ error: "saveBalance failed" });
  }
});

// ===== ЗАПУСК =====
app.listen(PORT, () => console.log(`🎰 Lucky Box сервер запущен на порту ${PORT}`));
