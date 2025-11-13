// --- Импорт библиотек ---
import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

// --- Настройки окружения ---
const app = express();
app.use(express.json());
app.use(cors());

// --- Папка, где лежит index.html и твои файлы ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(__dirname)); // чтобы сайт открывался по /

/* ====== Конфигурация ====== */
const MOCK_URL = "https://69147b693746c71fe0486c2c.mockapi.io/users";
const SECRET_KEY = process.env.SECRET_KEY; // 🔒 этот ключ берётся из Render Environment Variables

/* ====== API для фронтенда ====== */

// поиск пользователя
app.post("/api/findUser", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ ok: false, error: "Нет имени" });

    // обращаемся к MockAPI с добавлением ключа (но сам ключ на клиент не уходит)
    const r = await fetch(`${MOCK_URL}?name=${encodeURIComponent(name)}&key=${SECRET_KEY}`);
    const data = await r.json();
    res.json({ ok: true, user: data[0] || null });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// создание пользователя
app.post("/api/createUser", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ ok: false, error: "Нет имени" });

    const r = await fetch(MOCK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, balance: 1000 })
    });
    const data = await r.json();
    res.json({ ok: true, user: data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// отдача HTML-файла
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// запуск сервера
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Lucky Box сервер работает на порту ${PORT}`));
