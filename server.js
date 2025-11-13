import express from "express";
import cors from "cors";
import path from "path";
import fetch from "node-fetch";
import { fileURLToPath } from "url";

const app = express();

/* ===== CONFIG ===== */
const MOCK_URL = "https://69147b693746c71fe0486c2c.mockapi.io/users";
const SECRET_KEY = process.env.SECRET_KEY || "dev-key";
const PORT = process.env.PORT || 10000;

/* ===== FILE PATHS ===== */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ===== MIDDLEWARE ===== */
app.use(cors({
  origin: [
    "https://casino777.onrender.com",
    "http://localhost:5500",
    "http://localhost:3000",
    "http://127.0.0.1:5500",
    "http://127.0.0.1:3000"
  ],
  methods: ["GET", "POST", "PUT", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));
app.use(express.json());
app.use(express.static(__dirname));

/* ===== MAIN PAGE ===== */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

/* ===== API ROUTES ===== */

// 🔹 Найти пользователя
app.post("/api/findUser", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "No name" });

    const r = await fetch(`${MOCK_URL}?name=${encodeURIComponent(name)}`);
    const users = await r.json();
    res.json({ user: users[0] || null });
  } catch (e) {
    console.error("findUser error:", e);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Создать пользователя
app.post("/api/createUser", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "No name" });

    const r = await fetch(MOCK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, balance: 1000 })
    });
    const data = await r.json();
    res.json({ user: data });
  } catch (e) {
    console.error("createUser error:", e);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Получить пользователя по ID (для автологина)
app.get("/api/user/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const r = await fetch(`${MOCK_URL}/${id}`);
    const data = await r.json();
    res.json({ user: data });
  } catch (e) {
    console.error("getUser error:", e);
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Сохранить баланс
app.post("/api/saveBalance", async (req, res) => {
  console.log("💾 saveBalance", req.body);

  const { id, balance } = req.body;

  if (!id || balance === undefined) {
    return res.json({ ok: false, error: "invalid_data" });
  }

  try {
    const r = await fetch(`${MOCK_URL}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ balance })
    });

    const data = await r.json();
    console.log("✅ Balance saved:", data);

    res.json({ ok: true, user: data });
  } catch (err) {
    console.log("❌ MockAPI error:", err);
    res.json({ ok: false, error: "mockapi_fail" });
  }
});


/* ===== SERVER ===== */
app.listen(PORT, () =>
  console.log(`✅ Lucky Box backend запущен на http://localhost:${PORT}`)
);
