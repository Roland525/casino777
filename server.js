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

/************* AUTH *************/
const $auth = document.getElementById("authPanel");
const $casino = document.getElementById("casino");
const $authMsg = document.getElementById("authMsg");
const $nick = document.getElementById("nickname");
const $user = document.getElementById("userDisplay");
const $bal = document.getElementById("balance");
let currentUser = null;

function updateBalanceUI() {
  $bal.textContent = currentUser.balance;
  $bal.parentElement.classList.add("shine");
  setTimeout(() => $bal.parentElement.classList.remove("shine"), 600);
}

function openCasino() {
  $auth.classList.add("hidden");
  $casino.classList.remove("hidden");
  document.querySelector('[data-tab="tab-slots"]').click();
  $user.textContent = currentUser.name;
  updateBalanceUI();
}

/* === Вход === */
document.getElementById("loginBtn").addEventListener("click", async () => {
  const nick = $nick.value.trim();
  if (!nick) { $authMsg.textContent = "Введите ник"; return; }
  $authMsg.textContent = "Проверка...";
  try {
    const found = await apiFindByName(nick);
    if (Array.isArray(found) && found.length > 0) {
      const u = found[0];
      currentUser = { id: u.id, name: u.name, balance: u.balance };
      $authMsg.textContent = "Добро пожаловать, " + u.name + "!";
      openCasino();
    } else {
      $authMsg.textContent = "Пользователь не найден!";
    }
  } catch (e) {
    console.error(e);
    $authMsg.textContent = "Ошибка связи с MockAPI";
  }
});

/* === Регистрация === */
document.getElementById("registerBtn").addEventListener("click", async () => {
  const nick = $nick.value.trim();
  if (!nick) { $authMsg.textContent = "Введите ник"; return; }
  $authMsg.textContent = "Создание аккаунта...";
  try {
    const found = await apiFindByName(nick);
    if (Array.isArray(found) && found.length > 0) {
      $authMsg.textContent = "Такой ник уже занят!";
      return;
    }
    const u = await apiCreate(nick, 1000);
    if (!u || !u.id) {
      $authMsg.textContent = "Ошибка создания!";
      return;
    }
    currentUser = { id: u.id, name: u.name, balance: u.balance };
    $authMsg.textContent = "Аккаунт создан, добро пожаловать!";
    openCasino();
  } catch (e) {
    console.error(e);
    $authMsg.textContent = "Ошибка связи с MockAPI";
  }
});

document.getElementById("logoutBtn").addEventListener("click", () => location.reload());

async function saveBalance() {
  if (!currentUser || !currentUser.id) return;
  await apiUpdate(currentUser.id, { name: currentUser.name, balance: currentUser.balance });
}

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
