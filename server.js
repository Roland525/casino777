import express from "express";
import fs from "fs";
const app = express();
const file = "data.txt";

app.use(express.static("."));

// Добавление пользователя в txt
app.get("/add", (req, res) => {
  const name = req.query.name;
  if (!name) return res.send("Введите имя!");
  fs.appendFileSync(file, `${name}\n`);
  res.send(`✅ Игрок ${name} добавлен!`);
});

// Показ содержимого txt
app.get("/data", (req, res) => {
  if (!fs.existsSync(file)) return res.send("Файл пока пуст.");
  const content = fs.readFileSync(file, "utf8");
  res.type("text/plain").send(content);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server on ${PORT}`));
