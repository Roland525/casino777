import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());
app.use(express.static(".")); // index.html, styles.css и т.д.

// ====== Твоя коллекция в MockAPI ======
const MOCK_URL = "https://69147b693746c71fe0486c2c.mockapi.io/users";

// ====== Вспомогательные функции работы с MockAPI ======
async function mockGetUserByName(name) {
  const r = await fetch(`${MOCK_URL}?name=${encodeURIComponent(name)}`);
  if (!r.ok) throw new Error(`MockAPI get error ${r.status}`);
  const arr = await r.json();
  return Array.isArray(arr) && arr.length ? arr[0] : null;
}
async function mockCreateUser(name, balance = 1000) {
  const r = await fetch(MOCK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, balance })
  });
  if (!r.ok) throw new Error(`MockAPI create error ${r.status}`);
  return r.json();
}
async function mockUpdateUserBalance(id, name, balance) {
  const r = await fetch(`${MOCK_URL}/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, balance })
  });
  if (!r.ok) throw new Error(`MockAPI update error ${r.status}`);
  return r.json();
}

// ====== Простой rate-limit по пользователю (в памяти) ======
const rate = {}; // { name: { ts, count } }
function isRateLimited(name) {
  const now = Date.now();
  if (!rate[name]) rate[name] = { ts: now, count: 0 };
  const r = rate[name];
  if (now - r.ts > 2000) { r.ts = now; r.count = 0; }
  r.count++;
  return r.count > 15; // >15 действий за 2с — отказываем
}

// ====== Состояния игр в памяти (на сессию пользователя) ======
const sessions = {}; // sessions[name] = { blackjack: {...}, mines: {...} }

// ====== Сервисный тест подключения к MockAPI ======
app.get("/api/test", async (req, res) => {
  try {
    const r = await fetch(MOCK_URL);
    const data = await r.json();
    res.json({ ok: true, users: Array.isArray(data) ? data.length : 0 });
  } catch (e) {
    console.error("MockAPI test error:", e.message);
    res.status(500).json({ error: "Не удалось подключиться к MockAPI" });
  }
});

// ====== Регистрация и вход ======
app.post("/api/register", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    if (!name) return res.json({ error: "Введите ник" });
    const exists = await mockGetUserByName(name);
    if (exists) return res.json({ error: "Такой ник уже занят" });
    const user = await mockCreateUser(name, 1000);
    res.json({ ok: true, user });
  } catch (e) {
    console.error("register:", e.message);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    if (!name) return res.json({ error: "Введите ник" });
    const user = await mockGetUserByName(name);
    if (!user) return res.json({ error: "Пользователь не найден" });
    res.json({ ok: true, user });
  } catch (e) {
    console.error("login:", e.message);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// ====== Игровая логика на сервере ======

// --- SLOTS ---
function playSlots() {
  const COST = 100;
  const RTP = 0.95; // целевой возврат
  const expected = COST * RTP; // 95
  const bigP = 0.06; // шанс 6% на 800
  let smallP = (expected - 800 * bigP) / 200; // шанс на 200
  smallP = Math.max(0, Math.min(1 - bigP, smallP));
  const r = Math.random();
  let win = 0;
  if (r < bigP) win = 800;
  else if (r < bigP + smallP) win = 200;
  return { cost: COST, win };
}

// --- ROULETTE ---
const wheelOrder = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const reds = new Set([32,19,21,25,34,27,36,30,23,5,16,1,14,9,18,7,12,3]);
const seg = 360 / wheelOrder.length;
function numColor(n){ return n === 0 ? "green" : (reds.has(n) ? "red" : "black"); }
function playRoulette(pick) {
  const COST = 150;
  const idx = Math.floor(Math.random() * wheelOrder.length);
  const num = wheelOrder[idx];
  const color = numColor(num);
  let win = 0;
  if (pick === color) win = (color === "green") ? 1500 : 300; // зеро 10x, цвет 2x
  return { cost: COST, win, num, color, index: idx, angle: 360 - (idx * seg + seg / 2) };
}

// --- BLACKJACK ---
const SUITS = ["♠","♥","♦","♣"];
const RANKS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
function freshDeck(){
  const d=[]; for(const s of SUITS) for(const r of RANKS) d.push(r+s);
  for(let i=d.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [d[i],d[j]]=[d[j],d[i]]; }
  return d;
}
function cardVal(card){
  const r = card.slice(0,-1);
  if(r==="A") return 11;
  if(r==="J"||r==="Q"||r==="K") return 10;
  return Number(r);
}
function handTotal(hand){
  let t = hand.reduce((a,c)=>a+cardVal(c),0);
  let aces = hand.filter(c=>c.startsWith("A")).length;
  while(t>21 && aces){ t-=10; aces--; }
  return t;
}

// --- MINES ---
const GRID = 25; // 5х5
function randomMines(cnt){ const s=new Set(); while(s.size<cnt) s.add(Math.floor(Math.random()*GRID)); return s; }
function pSafeAtStep(opened, mines){
  const safeLeft = (GRID - mines) - opened;
  const cellsLeft = GRID - opened;
  return Math.max(0, safeLeft) / Math.max(1, cellsLeft);
}

// ====== /api/play ======
app.post("/api/play", async (req, res) => {
  try {
    const { name, game, action, pick, bet, mines, idx } = req.body;
    if (!name || !game || !action) return res.json({ error: "Неверные данные" });
    if (isRateLimited(name)) return res.status(429).json({ error: "Слишком часто" });

    const user = await mockGetUserByName(name);
    if (!user) return res.json({ error: "Пользователь не найден" });

    let balance = parseInt(user.balance, 10) || 0;
    const ss = (sessions[name] ||= {});

    // ---------- SLOTS ----------
    if (game === "slots" && action === "spin") {
      const { cost, win } = playSlots();
      if (balance < cost) return res.json({ error: "Недостаточно средств" });
      balance = balance - cost + win;
      await mockUpdateUserBalance(user.id, user.name, balance);
      return res.json({ ok: true, balance, result: { win } });
    }

    // ---------- ROULETTE ----------
    if (game === "roulette" && action === "spin") {
      const colorPick = ["red","black","green"].includes(pick) ? pick : "red";
      const { cost, win, num, color, index, angle } = playRoulette(colorPick);
      if (balance < cost) return res.json({ error: "Недостаточно средств" });
      balance = balance - cost + win;
      await mockUpdateUserBalance(user.id, user.name, balance);
      return res.json({ ok: true, balance, result: { win, num, color, index, angle } });
    }

    // ---------- BLACKJACK ----------
    if (game === "blackjack") {
      ss.blackjack ||= {};
      const BJ_BET = 200;

      if (action === "start") {
        if (balance < BJ_BET) return res.json({ error: "Недостаточно средств" });
        balance -= BJ_BET;
        const deck=freshDeck();
        const player=[deck.pop(),deck.pop()];
        const dealer=[deck.pop(),deck.pop()];
        ss.blackjack={ deck, player, dealer, bet: BJ_BET, active:true };
        await mockUpdateUserBalance(user.id, user.name, balance);
        return res.json({
          ok:true, balance,
          state:{ player, dealer:[dealer[0],"🂠"], totals:{ player: handTotal(player), dealer: cardVal(dealer[0]) } }
        });
      }

      if (!ss.blackjack?.active) return res.json({ error: "Раунд не начат" });

      if (action === "hit") {
        const st = ss.blackjack;
        st.player.push(st.deck.pop());
        const pt = handTotal(st.player);
        let outcome = null;
        if (pt>21) { st.active=false; outcome="bust"; }
        await mockUpdateUserBalance(user.id, user.name, balance);
        return res.json({
          ok:true, balance,
          state:{ player: st.player, dealer:[st.dealer[0],"🂠"], totals:{ player: pt, dealer: cardVal(st.dealer[0]) }, outcome }
        });
      }

      if (action === "stand") {
        const st = ss.blackjack;
        while (handTotal(st.dealer) < 17) st.dealer.push(st.deck.pop());
        const pt=handTotal(st.player), dt=handTotal(st.dealer);
        let win = 0;
        if (pt<=21 && (dt>21 || pt>dt)) win = st.bet*2;      // 400 (net +200)
        else if (pt===dt) win = st.bet;                      // возврат 200
        st.active=false;
        balance += win;
        await mockUpdateUserBalance(user.id, user.name, balance);
        return res.json({
          ok:true, balance,
          state:{ player: st.player, dealer: st.dealer, totals:{ player: pt, dealer: dt } },
          result:{ win }
        });
      }
    }

    // ---------- MINES ----------
    if (game === "mines") {
      ss.mines ||= {};
      if (action === "start") {
        const stake = Math.max(1, parseInt(bet || "100", 10));
        const mcount = Math.max(1, Math.min(24, parseInt(mines || "5", 10)));
        if (balance < stake) return res.json({ error: "Недостаточно средств" });
        balance -= stake;
        ss.mines = { bet: stake, mineCount: mcount, mines: randomMines(mcount), revealed: new Set(), active:true, profit:0 };
        await mockUpdateUserBalance(user.id, user.name, balance);
        return res.json({ ok:true, balance, state:{ opened:0, mineCount:mcount } });
      }

      if (!ss.mines?.active) return res.json({ error: "Игра не активна" });

      if (action === "reveal") {
        const st = ss.mines;
        const index = parseInt(idx,10);
        if (Number.isNaN(index) || index<0 || index>=GRID) return res.json({ error: "Неверная клетка" });
        if (st.revealed.has(index)) return res.json({ error: "Клетка уже открыта" });

        if (st.mines.has(index)) {
          st.active=false; st.profit=0;
          await mockUpdateUserBalance(user.id, user.name, balance);
          return res.json({ ok:true, balance, state:{ boom:true, mines:[...st.mines] }, result:{ total:0, profit:0 } });
        } else {
          st.revealed.add(index);
          const opened = st.revealed.size;
          const p = pSafeAtStep(opened-1, st.mineCount);
          const stepMult = Math.max(1.02, (1/Math.max(0.01,p))*0.95);
          const total = Math.floor(st.bet * Math.pow(stepMult, opened));
          st.profit = Math.max(0, total - st.bet);
          await mockUpdateUserBalance(user.id, user.name, balance);
          return res.json({ ok:true, balance, state:{ boom:false, revealed:[...st.revealed] }, result:{ total, profit: st.profit } });
        }
      }

      if (action === "cashout") {
        const st = ss.mines;
        const payout = st.bet + st.profit;
        balance += payout;
        st.active=false;
        await mockUpdateUserBalance(user.id, user.name, balance);
        return res.json({ ok:true, balance, result:{ total: payout, profit: st.profit } });
      }
    }

    res.json({ error: "Неизвестная игра/действие" });
  } catch (e) {
    console.error("/api/play:", e.message);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🎰 Lucky Box сервер на :${PORT}`));
