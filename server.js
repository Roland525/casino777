import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(express.json());
app.use(cors());

// --- Настройки путей ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(__dirname)); // чтобы html/css/js открывались

// --- MockAPI URL ---
const MOCK_URL = "https://69147b693746c71fe0486c2c.mockapi.io/users";
const SECRET_KEY = process.env.SECRET_KEY; // 🔒 Скрытый ключ хранится в Render

// --- API для фронта ---
app.post("/api/findUser", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ ok: false, error: "Нет имени" });

    // сервер общается с MockAPI, ключ добавляется здесь, а не на клиенте
    const r = await fetch(`${MOCK_URL}?name=${encodeURIComponent(name)}&key=${SECRET_KEY}`);
    const data = await r.json();
    res.json({ ok: true, user: data[0] || null });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post("/api/createUser", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ ok: false });

    const r = await fetch(MOCK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, balance: 1000 })
    });
    const data = await r.json();
    res.json({ ok: true, user: data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// --- Главная страница ---
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// --- Запуск ---
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Lucky Box сервер запущен на ${PORT}`));
