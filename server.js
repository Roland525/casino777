// server.js
import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());
app.use(express.static(".")); // отдаёт index.html и стили

// === Твоя база MockAPI ===
const MOCK_URL = "https://69147b693746c71fe0486c2c.mockapi.io/users";

// ====== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ======
async function getUser(name) {
  try {
    const res = await fetch(`${MOCK_URL}?name=${encodeURIComponent(name)}`);
    if (!res.ok) throw new Error(`MockAPI get error ${res.status}`);
    const data = await res.json();
    return data[0];
  } catch (e) {
    console.error("❌ Ошибка при получении пользователя:", e.message);
    throw e;
  }
}

async function createUser(name) {
  try {
    const res = await fetch(MOCK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, balance: 1000 })
    });
    if (!res.ok) throw new Error(`MockAPI create error ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error("❌ Ошибка при создании пользователя:", e.message);
    throw e;
  }
}

async function updateBalance(id, name, balance) {
  try {
    const res = await fetch(`${MOCK_URL}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, balance })
    });
    if (!res.ok) throw new Error(`MockAPI update error ${res.status}`);
  } catch (e) {
    console.error("❌ Ошибка при обновлении баланса:", e.message);
    throw e;
  }
}

// ====== /api/test — проверка соединения с MockAPI ======
app.get("/api/test", async (req, res) => {
  try {
    const response = await fetch(MOCK_URL);
    const data = await response.json();
    res.json({ ok: true, users: data.length });
  } catch (e) {
    console.error("❌ MockAPI test error:", e.message);
    res.status(500).json({ error: "Не удалось подключиться к MockAPI" });
  }
});

// ====== /api/login ======
app.post("/api/login", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    if (!name) return res.json({ error: "Введите ник" });

    let user = await getUser(name);
    if (!user) {
      user = await createUser(name);
      console.log(`✅ Создан новый пользователь: ${name}`);
    } else {
      console.log(`👤 Пользователь найден: ${name}`);
    }

    res.json({ ok: true, user });
  } catch (e) {
    console.error("❌ Ошибка логина:", e.message);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ====== /api/play ======
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
      const r = Math.random();
      if (r < 0.05) win = 800;       // 5%
      else if (r < 0.20) win = 200;  // 15%
      balance += win;
    }

    else if (game === "roulette" && action === "spin") {
      cost = 150;
      if (balance < cost) return res.json({ error: "Недостаточно средств" });
      balance -= cost;

      const colors = ["red", "black", "green"];
      const result = colors[Math.floor(Math.random() * colors.length)];
      if (result === pick) {
        if (pick === "green") win = 1500; // зеро 10x
        else win = 300;                   // обычный 2x
      }
      balance += win;
      await updateBalance(user.id, name, balance);
      return res.json({ ok: true, result, win, balance });
    }

    else if (game === "blackjack") {
      cost = 200;
      if (balance < cost) return res.json({ error: "Недостаточно средств" });
      balance -= cost;
      const player = Math.floor(Math.random() * 11) + 15;
      const dealer = Math.floor(Math.random() * 11) + 15;
      if (player > 21) win = 0;
      else if (dealer > 21 || player > dealer) win = 400;
      else if (player === dealer) win = 200;
      balance += win;
    }

    else if (game === "mines") {
      cost = 100;
      if (balance < cost) return res.json({ error: "Недостаточно средств" });
      balance -= cost;

      const safeChance = 1 - (mines / 25);
      if (Math.random() < safeChance) win = Math.floor(100 * (1 / safeChance) * 0.9);
      balance += win;
    }

    await updateBalance(user.id, name, balance);
    res.json({ ok: true, game, win, balance });

  } catch (e) {
    console.error("❌ Ошибка в /api/play:", e.message);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ====== Запуск сервера ======
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🎰 Lucky Box сервер на :${PORT}`));
