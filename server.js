import express from "express";
import fs from "fs";

const app = express();
const FILE = "users.txt";

app.use(express.static("."));

// чтение users.txt -> объект
function readUsers() {
  if (!fs.existsSync(FILE)) return {};
  const raw = fs.readFileSync(FILE, "utf8").trim();
  if (!raw) return {};
  const users = {};
  raw.split("\n").forEach((line) => {
    const [name, bal] = line.split(":");
    users[name] = { name, balance: parseInt(bal, 10) || 0 };
  });
  return users;
}

// сохранение объекта -> users.txt
function saveUsers(users) {
  const text = Object.values(users)
    .map((u) => `${u.name}:${u.balance}`)
    .join("\n");
  fs.writeFileSync(FILE, text);
}

// вход/регистрация
app.get("/login", (req, res) => {
  const name = String(req.query.name || "").trim();
  if (!name) return res.json({ error: "Введите имя!" });
  const users = readUsers();
  const justCreated = !users[name];
  if (justCreated) users[name] = { name, balance: 1000 };
  saveUsers(users);
  res.json({ ...users[name], justCreated });
});

// сохранение баланса
app.get("/save", (req, res) => {
  const name = String(req.query.name || "").trim();
  const balance = parseInt(String(req.query.balance || "0"), 10) || 0;
  if (!name) return res.json({ error: "Нет имени" });
  const users = readUsers();
  if (!users[name]) users[name] = { name, balance: 1000 };
  users[name].balance = Math.max(0, balance);
  saveUsers(users);
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🎰 Lucky Box server on :${PORT}`));
