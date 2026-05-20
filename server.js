// server.js
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import crypto from "crypto";

const app = express();
app.use(cors());
app.use(bodyParser.json());

// In-memory “database” (voor demo)
// In productie: vervang dit door echte DB (Postgres/Mongo)
const db = {
  users: {
    // voorbeeld:
    // "ravi": {
    //   passwordHash: "....",
    //   chats: [{ id, name, messages: [...] }],
    //   flagged: false
    // }
  }
};

function sha256(str) {
  return crypto.createHash("sha256").update(str).digest("hex");
}

// ========== AUTH ==========

// Registreren
app.post("/api/register", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Missing fields" });
  if (db.users[username]) return res.status(400).json({ error: "User exists" });

  db.users[username] = {
    passwordHash: sha256(password),
    chats: [],
    flagged: false
  };
  res.json({ ok: true });
});

// Inloggen
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const user = db.users[username];
  if (!user) return res.status(400).json({ error: "Unknown user" });
  if (user.passwordHash !== sha256(password)) {
    return res.status(400).json({ error: "Wrong password" });
  }
  // Simpel: geen JWT, alleen bevestiging
  res.json({ ok: true });
});

// ========== USER CHATS ==========

// Alle data van 1 user ophalen
app.get("/api/user/:username", (req, res) => {
  const { username } = req.params;
  const user = db.users[username];
  if (!user) return res.status(404).json({ error: "Not found" });
  res.json(user);
});

// User data opslaan (chats, flagged, etc.)
app.post("/api/user/:username", (req, res) => {
  const { username } = req.params;
  const user = db.users[username];
  if (!user) return res.status(404).json({ error: "Not found" });

  const { chats, flagged } = req.body;
  if (Array.isArray(chats)) user.chats = chats;
  if (typeof flagged === "boolean") user.flagged = flagged;

  res.json({ ok: true });
});

// Account verwijderen
app.delete("/api/user/:username", (req, res) => {
  const { username } = req.params;
  delete db.users[username];
  res.json({ ok: true });
});

// ========== ADMIN ==========

const ADMIN_CODE = "1237151213";

// Alle users + meta
app.post("/api/admin/users", (req, res) => {
  const { code } = req.body;
  if (code !== ADMIN_CODE) return res.status(403).json({ error: "Forbidden" });

  const list = Object.entries(db.users).map(([name, u]) => ({
    username: name,
    chatsCount: (u.chats || []).length,
    flagged: !!u.flagged
  }));
  res.json(list);
});

// Volledige data van 1 user (voor admin)
app.post("/api/admin/user", (req, res) => {
  const { code, username } = req.body;
  if (code !== ADMIN_CODE) return res.status(403).json({ error: "Forbidden" });

  const user = db.users[username];
  if (!user) return res.status(404).json({ error: "Not found" });
  res.json(user);
});

// Flag toggle
app.post("/api/admin/flag", (req, res) => {
  const { code, username } = req.body;
  if (code !== ADMIN_CODE) return res.status(403).json({ error: "Forbidden" });

  const user = db.users[username];
  if (!user) return res.status(404).json({ error: "Not found" });

  user.flagged = !user.flagged;
  res.json({ flagged: user.flagged });
});

// Admin delete user
app.post("/api/admin/delete", (req, res) => {
  const { code, username } = req.body;
  if (code !== ADMIN_CODE) return res.status(403).json({ error: "Forbidden" });

  delete db.users[username];
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
