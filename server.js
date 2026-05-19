import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { v4 as uuid } from "uuid";
import fetch from "node-fetch";

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ⚠️ In-memory opslag (verdwijnt bij restart).
// Voor nu prima om alles werkend te krijgen.
const users = {};   // { username: { password, flagged } }
const chats = {};   // { chatId: { id, owner, title, messages:[{role,text}] } }

const ADMIN_SECRET = "1237151213";

// REGISTER
app.post("/api/register", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Missing" });
  if (users[username]) return res.status(400).json({ error: "Exists" });

  users[username] = { password, flagged: false };
  return res.json({ ok: true });
});

// LOGIN
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const u = users[username];
  if (!u || u.password !== password) {
    return res.status(401).json({ error: "Invalid" });
  }
  return res.json({ ok: true, username });
});

// CREATE CHAT
app.post("/api/chats", (req, res) => {
  const { username, title } = req.body;
  if (!users[username]) return res.status(401).json({ error: "No user" });

  const id = uuid();
  chats[id] = { id, owner: username, title: title || "Nieuwe chat", messages: [] };
  return res.json(chats[id]);
});

// LIST CHATS FOR USER
app.get("/api/chats/:username", (req, res) => {
  const { username } = req.params;
  if (!users[username]) return res.status(401).json({ error: "No user" });

  const list = Object.values(chats).filter(c => c.owner === username);
  return res.json(list);
});

// GET SINGLE CHAT
app.get("/api/chat/:id", (req, res) => {
  const chat = chats[req.params.id];
  if (!chat) return res.status(404).json({ error: "Not found" });
  return res.json(chat);
});

// ADD MESSAGE + AI
app.post("/api/chat/:id/message", async (req, res) => {
  const chat = chats[req.params.id];
  if (!chat) return res.status(404).json({ error: "Not found" });

  const { role, text } = req.body;
  if (!role || !text) return res.status(400).json({ error: "Missing" });

  chat.messages.push({ role, text });

  if (role === "user") {
    try {
      const aiRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: "llama-3.1-70b-versatile",
          messages: [
            { role: "system", content: "Je bent Barry AI, een slimme assistent met humor." },
            ...chat.messages.map(m => ({ role: m.role, content: m.text }))
          ]
        })
      });
      const data = await aiRes.json();
      const aiText = data.choices?.[0]?.message?.content || "Er ging iets mis bij het AI-antwoord.";
      chat.messages.push({ role: "ai", text: aiText });
    } catch (e) {
      console.error(e);
      chat.messages.push({ role: "ai", text: "Er ging iets mis bij het ophalen van het AI-antwoord." });
    }
  }

  return res.json(chat);
});

/* ---------- ADMIN ---------- */

// ADMIN LOGIN VIA SECRET
app.post("/api/admin/login", (req, res) => {
  const { secret } = req.body;
  if (secret !== ADMIN_SECRET) return res.status(401).json({ error: "Nope" });
  return res.json({ ok: true });
});

// ADMIN: LIST USERS
app.get("/api/admin/users", (req, res) => {
  const list = Object.keys(users).map(u => ({
    username: u,
    flagged: users[u].flagged
  }));
  return res.json(list);
});

// ADMIN: USER CHATS
app.get("/api/admin/user/:username/chats", (req, res) => {
  const { username } = req.params;
  const list = Object.values(chats).filter(c => c.owner === username);
  return res.json(list);
});

// ADMIN: FLAG USER
app.post("/api/admin/user/:username/flag", (req, res) => {
  const { username } = req.params;
  if (!users[username]) return res.status(404).json({ error: "No user" });
  users[username].flagged = !users[username].flagged;
  return res.json({ flagged: users[username].flagged });
});

// ADMIN: DELETE USER + CHATS
app.delete("/api/admin/user/:username", (req, res) => {
  const { username } = req.params;
  delete users[username];
  for (const id of Object.keys(chats)) {
    if (chats[id].owner === username) delete chats[id];
  }
  return res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on " + PORT));
