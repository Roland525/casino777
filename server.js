import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());
app.use(express.static("."));

// === MockAPI users collection ===
const MOCK_URL = "https://69147b693746c71fe0486c2c.mockapi.io/users";

// ===== Helpers to work with MockAPI =====
async function mockGetUserByName(name) {
  const r = await fetch(`${MOCK_URL}?name=${encodeURIComponent(name)}`);
  if (!r.ok) throw new Error("MockAPI get error " + r.status);
  const arr = await r.json();
  return Array.isArray(arr) && arr.length ? arr[0] : null;
}
async function mockCreateUser(name, balance = 1000) {
  const r = await fetch(MOCK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, balance })
  });
  if (!r.ok) throw new Error("MockAPI create error " + r.status);
  return r.json();
}
async function mockUpdateUserBalance(id, name, balance) {
  const r = await fetch(`${MOCK_URL}/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, balance })
  });
  if (!r.ok) throw new Error("MockAPI update error " + r.status);
  return r.json();
}

// ===== in-memory game state (per user) =====
const sessions = {}; // sessions[name] = { blackjack: {...}, mines: {...}, lastActionTs: number }

function now() { return Date.now(); }
function rng() { return Math.random(); }
function rateLimited(name) {
  const s = (sessions[name] ||= {});
  const t = now();
  if (!s.lastActionTs) { s.lastActionTs = t; s.actCount=0; return false; }
  if (t - s.lastActionTs > 2000) { s.lastActionTs = t; s.actCount = 0; return false; }
  s.actCount = (s.actCount || 0) + 1;
  return s.actCount > 15; // >15 действий за 2 секунды — баним запрос
}

// ===== Auth endpoints =====
app.post("/api/register", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    if (!name) return res.json({ error: "Введите ник" });
    const exists = await mockGetUserByName(name);
    if (exists) return res.json({ error: "Такой ник уже занят" });
    const user = await mockCreateUser(name, 1000);
    return res.json({ ok: true, user });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    if (!name) return res.json({ error: "Введите ник" });
    const user = await mockGetUserByName(name);
    if (!user) return res.json({ error: "Пользователь не найден" });
    return res.json({ ok: true, user });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ===== Game logic on server =====

// ---- SLOTS ----
function playSlots() {
  const COST = 100;
  // Контролируем RTP
  const RTP = 0.95;
  const expected = COST * RTP; // 95
  const bigP = 0.06; // 6% шанс на 800
  let smallP = (expected - 800 * bigP) / 200; // шанс на 200
  if (smallP < 0) smallP = 0;
  if (smallP > 1 - bigP) smallP = 1 - bigP;

  const r = rng();
  let win = 0;
  if (r < bigP) win = 800;
  else if (r < bigP + smallP) win = 200;
  return { cost: COST, win };
}

// ---- ROULETTE ----
const wheelOrder = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const reds = new Set([32,19,21,25,34,27,36,30,23,5,16,1,14,9,18,7,12,3]);
function numColor(n) {
  if (n === 0) return "green";
  return reds.has(n) ? "red" : "black";
}
function playRoulette(pick) {
  const COST = 150;
  const idx = Math.floor(rng() * wheelOrder.length);
  const num = wheelOrder[idx];
  const color = numColor(num);
  let win = 0;
  if (pick === color) {
    if (color === "green") win = 1500; // зеро — х10 от 150 (можно поднять до 36x)
    else win = 300; // 2x
  }
  return { cost: COST, win, num, color, index: idx };
}

// ---- BLACKJACK ----
const SUITS = ["♠","♥","♦","♣"];
const RANKS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
function freshDeck() {
  const d = [];
  for (const s of SUITS) for (const r of RANKS) d.push(r+s);
  // shuffle
  for (let i = d.length-1; i>0; i--) {
    const j = Math.floor(rng()*(i+1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}
function cardVal(card) {
  const r = card.slice(0, -1);
  if (r === "A") return 11;
  if (r === "J" || r === "Q" || r === "K") return 10;
  return Number(r);
}
function total(hand) {
  let t = hand.reduce((a,c)=>a+cardVal(c),0);
  let aces = hand.filter(c=>c.startsWith("A")).length;
  while (t>21 && aces) { t -= 10; aces--; }
  return t;
}

// ---- MINES ----
const GRID = 25; // 5x5
function randomMines(count) {
  const set = new Set();
  while (set.size < count) set.add(Math.floor(rng()*GRID));
  return set;
}
function minesSafeProb(safeOpened, mines) {
  const safeLeft = (GRID - mines) - safeOpened;
  const cellsLeft = GRID - safeOpened;
  return Math.max(0, safeLeft) / Math.max(1, cellsLeft);
}

// ===== /api/play endpoint =====
app.post("/api/play", async (req, res) => {
  try {
    const { name, game, action, pick, mines, idx } = req.body;
    if (!name || !game || !action) return res.json({ error: "Неверные данные" });
    if (rateLimited(name)) return res.status(429).json({ error: "Слишком часто" });

    let user = await mockGetUserByName(name);
    if (!user) return res.json({ error: "Пользователь не найден" });

    let balance = parseInt(user.balance, 10) || 0;
    const session = (sessions[name] ||= {});

    // ---- SLOTS ----
    if (game === "slots" && action === "spin") {
      const { cost, win } = playSlots();
      if (balance < cost) return res.json({ error: "Недостаточно средств" });
      balance = balance - cost + win;
      await mockUpdateUserBalance(user.id, user.name, balance);
      return res.json({ ok: true, balance, result: { win } });
    }

    // ---- ROULETTE ----
    if (game === "roulette" && action === "spin") {
      const colorPick = ["red","black","green"].includes(pick) ? pick : "red";
      const { cost, win, num, color, index } = playRoulette(colorPick);
      if (balance < cost) return res.json({ error: "Недостаточно средств" });
      balance = balance - cost + win;
      await mockUpdateUserBalance(user.id, user.name, balance);
      return res.json({ ok: true, balance, result: { win, num, color, index } });
    }

    // ---- BLACKJACK ----
    // actions: start, hit, stand
    if (game === "blackjack") {
      session.blackjack ||= {};
      const BJ_BET = 200;

      if (action === "start") {
        if (balance < BJ_BET) return res.json({ error: "Недостаточно средств" });
        balance -= BJ_BET;
        const deck = freshDeck();
        const player = [deck.pop(), deck.pop()];
        const dealer = [deck.pop(), deck.pop()];
        session.blackjack = { deck, player, dealer, bet: BJ_BET, active: true, settled:false };
        await mockUpdateUserBalance(user.id, user.name, balance);
        return res.json({
          ok: true, balance,
          state: { player, dealer: [dealer[0], "🂠"], totals: { player: total(player), dealer: cardVal(dealer[0]) } }
        });
      }

      if (!session.blackjack?.active) return res.json({ error: "Раунд не начат" });

      if (action === "hit") {
        const st = session.blackjack;
        st.player.push(st.deck.pop());
        const pt = total(st.player);
        let outcome = null; // "bust"|"continue"
        if (pt > 21) { outcome = "bust"; st.active=false; }
        await mockUpdateUserBalance(user.id, user.name, balance);
        return res.json({
          ok: true, balance,
          state: { player: st.player, dealer: [st.dealer[0], "🂠"], totals: { player: pt, dealer: cardVal(st.dealer[0]) }, outcome }
        });
      }

      if (action === "stand") {
        const st = session.blackjack;
        // dealer draws to 17
        while (total(st.dealer) < 17) st.dealer.push(st.deck.pop());
        const pt = total(st.player);
        const dt = total(st.dealer);
        let win = 0;
        if (pt > 21) win = 0;
        else if (dt > 21 || pt > dt) win = st.bet * 2;     // 400 (net +200)
        else if (pt === dt) win = st.bet;                  // возврат 200
        else win = 0;

        balance += win;
        st.active = false; st.settled = true;

        await mockUpdateUserBalance(user.id, user.name, balance);
        return res.json({
          ok: true, balance,
          state: { player: st.player, dealer: st.dealer, totals: { player: pt, dealer: dt } },
          result: { win }
        });
      }
    }

    // ---- MINES ----
    // actions: start {mines, bet}, reveal {idx}, cashout
    if (game === "mines") {
      session.mines ||= {};
      if (action === "start") {
        const bet = Math.max(1, parseInt(req.body.bet || "100", 10));
        const mineCount = Math.max(1, Math.min(24, parseInt(mines || "5",10)));
        if (balance < bet) return res.json({ error: "Недостаточно средств" });
        balance -= bet;

        session.mines = {
          bet,
          mineCount,
          mines: randomMines(mineCount),
          revealed: new Set(),
          active: true,
          profit: 0,
          opened: 0
        };
        await mockUpdateUserBalance(user.id, user.name, balance);
        return res.json({ ok: true, balance, state: { opened: 0, mineCount } });
      }

      if (!session.mines?.active) return res.json({ error: "Игра не активна" });

      if (action === "reveal") {
        const st = session.mines;
        const index = parseInt(idx, 10);
        if (Number.isNaN(index) || index < 0 || index >= GRID) return res.json({ error: "Неверная клетка" });
        if (st.revealed.has(index)) return res.json({ error: "Клетка уже открыта" });

        if (st.mines.has(index)) {
          // boom
          st.active = false; st.profit = 0;
          await mockUpdateUserBalance(user.id, user.name, balance);
          return res.json({ ok: true, balance, state: { boom: true, mines: Array.from(st.mines) }, result: { total: 0, profit: 0 } });
        } else {
          st.revealed.add(index);
          st.opened += 1;
          // множитель по обратной вероятности * маржа 0.95
          const pSafe = minesSafeProb(st.revealed.size-1, st.mineCount);
          const stepMult = Math.max(1.02, (1/Math.max(0.01, pSafe))*0.95);
          const total = Math.floor(st.bet * Math.pow(stepMult, st.revealed.size));
          const profit = Math.max(0, total - st.bet);
          st.profit = profit;

          const allSafeOpened = (st.opened >= (GRID - st.mineCount));
          if (allSafeOpened) {
            balance += st.bet + st.profit;
            st.active = false;
            await mockUpdateUserBalance(user.id, user.name, balance);
            return res.json({
              ok: true, balance,
              state: { completed: true, mines: Array.from(st.mines), revealed: Array.from(st.revealed) },
              result: { total, profit }
            });
          }

          await mockUpdateUserBalance(user.id, user.name, balance);
          return res.json({
            ok: true, balance,
            state: { boom:false, revealed: Array.from(st.revealed) },
            result: { total, profit }
          });
        }
      }

      if (action === "cashout") {
        const st = session.mines;
        const payout = st.bet + st.profit;
        balance += payout;
        st.active = false;
        await mockUpdateUserBalance(user.id, user.name, balance);
        return res.json({ ok: true, balance, result: { total: payout, profit: st.profit } });
      }
    }

    return res.json({ error: "Неизвестная игра/действие" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Ошибка сервера" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🎰 Lucky Box сервер на :${PORT}`));
