// server.js
import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());
app.use(express.static("."));

// === Твоя MockAPI база ===
const MOCK_URL = "https://69147b693746c71fe0486c2c.mockapi.io/users";

// ====== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ======
async function getUser(name) {
  const res = await fetch(`${MOCK_URL}?name=${encodeURIComponent(name)}`);
  const data = await res.json();
  return data[0];
}

async function createUser(name) {
  const res = await fetch(MOCK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, balance: 1000 })
  });
  return res.json();
}

async function updateBalance(id, name, balance) {
  await fetch(`${MOCK_URL}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, balance })
  });
}

function random() {
  return Math.random();
}

// ====== API: /api/login ======
app.post("/api/login", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    if (!name) return res.json({ error: "Введите ник" });

    let user = await getUser(name);
    if (!user) user = await createUser(name);

    res.json({ ok: true, user });
  } catch (e) {
    console.error("Login error", e);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ====== API: /api/play ======
app.post("/api/play", async (req, res) => {
  try {
    const { name, game, action, pick, mines } = req.body;
    if (!name || !game) return res.json({ error: "Неверные данные" });

    let user = await getUser(name);
    if (!user) return res.json({ error: "Пользователь не найден" });

    let balance = parseInt(user.balance);
    let win = 0;
    let cost = 0;

    // === Игры ===
    if (game === "slots" && action === "spin") {
      cost = 100;
      if (balance < cost) return res.json({ error: "Недостаточно средств" });

      balance -= cost;
      const r = random();
      if (r < 0.06) win = 800;        // 6% шанс
      else if (r < 0.18) win = 200;   // 12% шанс
      balance += win;
    }

    else if (game === "roulette" && action === "spin") {
      cost = 150;
      if (balance < cost) return res.json({ error: "Недостаточно средств" });
      balance -= cost;

      const colors = ["red", "black", "green"];
      const result = colors[Math.floor(random() * colors.length)];

      if (result === pick) {
        if (pick === "green") win = 1500; // зеро 10×
        else win = 300;                   // обычный 2×
      }
      balance += win;
      return res.json({ ok: true, result, win, balance });
    }

    else if (game === "blackjack") {
      cost = 200;
      if (balance < cost) return res.json({ error: "Недостаточно средств" });
      balance -= cost;
      const player = Math.floor(random() * 11) + 15;
      const dealer = Math.floor(random() * 11) + 15;
      if (player > 21) win = 0;
      else if (dealer > 21 || player > dealer) win = 400;
      else if (player === dealer) win = 200;
      balance += win;
    }

    else if (game === "mines") {
      cost = 100;
      if (balance < cost) return res.json({ error: "Недостаточно средств" });
      balance -= cost;

      const safeChance = 1 - mines / 25;
      if (random() < safeChance) win = Math.floor(100 * (1 / safeChance) * 0.9);
      balance += win;
    }

    await updateBalance(user.id, name, balance);
    res.json({ ok: true, game, win, balance });

  } catch (e) {
    console.error("Play error:", e);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ====== ЗАПУСК ======
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🎰 Lucky Box Casino запущен на порту ${PORT}`));
