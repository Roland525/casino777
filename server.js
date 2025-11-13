import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const MOCK_URL = "https://69147b693746c71fe0486c2c.mockapi.io/users";
const SECRET_KEY = "357625638264364"; // 🔑 Можешь изменить на любое сложное слово

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Раздаём всё из корня репозитория (index.html, styles.css, и т.д.)
app.use(express.static(__dirname));

// Корень сайта — index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🎰 Lucky Box: статический сервер на :${PORT}`));
