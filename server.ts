import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory data store for MVP
const db = {
  users: [] as any[],
  posts: [] as any[],
  messages: [] as any[],
  friendRequests: [] as any[],
  friends: [] as any[],
  blocks: [] as { blockerId: string, blockedId: string }[]
};

const getUserId = (req: express.Request) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  try {
    const { id } = JSON.parse(Buffer.from(authHeader.replace('Bearer ', ''), 'base64').toString('ascii'));
    return id;
  } catch {
    return null;
  }
}


async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes - Authentication (Mock)
  app.post("/api/auth/register", (req, res) => {
    const { name, email, password } = req.body;
    if (db.users.find((u) => u.email === email)) {
      return res.status(400).json({ error: "User already exists" });
    }
    const newUser = { id: String(Date.now()), name, email, password, bio: "", avatar: "" };
    db.users.push(newUser);
    // Simple token for MVP
    const token = Buffer.from(JSON.stringify({ id: newUser.id })).toString('base64');
    res.json({ token, user: { id: newUser.id, name, email } });
  });

  app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body;
    const user = db.users.find((u) => u.email === email && u.password === password);
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = Buffer.from(JSON.stringify({ id: user.id })).toString('base64');
    res.json({ token, user: { id: user.id, name, email } });
  });

  app.get("/api/me", (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "No token" });
    try {
      const { id } = JSON.parse(Buffer.from(authHeader.replace('Bearer ', ''), 'base64').toString('ascii'));
      const user = db.users.find((u) => u.id === id);
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json({ user: { id: user.id, name: user.name, email: user.email, bio: user.bio, avatar: user.avatar } });
    } catch {
      res.status(401).json({ error: "Invalid token" });
    }
  });

  // API Routes - Posts
  app.get("/api/posts", (req, res) => {
    const userId = getUserId(req);
    const hiddenUsers = db.blocks
      .filter((b) => b.blockerId === userId || b.blockedId === userId)
      .flatMap((b) => [b.blockerId, b.blockedId]);

    // Return posts with author details
    const populatedPosts = db.posts
      .filter((p) => !hiddenUsers.includes(p.userId))
      .map(p => ({
        ...p,
        author: db.users.find(u => u.id === p.userId)
      })).sort((a, b) => b.timestamp - a.timestamp);
    res.json(populatedPosts);
  });

  app.post("/api/posts", (req, res) => {
    const { userId, text } = req.body;
    const post = { id: String(Date.now()), userId, text, timestamp: Date.now(), likes: 0, comments: [] };
    db.posts.push(post);
    res.json(post);
  });
  
  // API Routes - Users
  app.get("/api/users", (req, res) => {
    const userId = getUserId(req);
    const hiddenUsers = db.blocks
      .filter((b) => b.blockerId === userId || b.blockedId === userId)
      .flatMap((b) => [b.blockerId, b.blockedId]);

    // Exclude passwords
    const safeUsers = db.users
      .filter((u) => !hiddenUsers.includes(u.id))
      .map(u => ({ id: u.id, name: u.name, bio: u.bio, avatar: u.avatar }));
    res.json(safeUsers);
  });

  app.post("/api/users/:id/block", (req, res) => {
    const userId = getUserId(req);
    const blockedId = req.params.id;
    if (!userId || !blockedId) return res.status(400).json({ error: "Invalid request" });
    
    if (!db.blocks.find((b) => b.blockerId === userId && b.blockedId === blockedId)) {
      db.blocks.push({ blockerId: userId, blockedId });
    }
    res.json({ success: true });
  });

  app.delete("/api/users/:id/block", (req, res) => {
    const userId = getUserId(req);
    const blockedId = req.params.id;
    if (!userId || !blockedId) return res.status(400).json({ error: "Invalid request" });
    
    db.blocks = db.blocks.filter((b) => !(b.blockerId === userId && b.blockedId === blockedId));
    res.json({ success: true });
  });

  app.get("/api/blocks", (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const blockedIds = db.blocks.filter((b) => b.blockerId === userId).map((b) => b.blockedId);
    const blockedUsers = db.users
      .filter((u) => blockedIds.includes(u.id))
      .map((u) => ({ id: u.id, name: u.name, avatar: u.avatar }));
    
    res.json(blockedUsers);
  });

  // Socket.IO for Real-time Chat
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*" }
  });

  io.on("connection", (socket) => {
    console.log("User connected", socket.id);
    
    // Simple presence
    socket.on("register", (userId) => {
      socket.join(userId); // Join a room for their own user ID to receive direct messages
    });

    socket.on("sendMessage", (message) => {
      // message: { fromId, toId, text }
      const isBlocked = db.blocks.find((b) => 
        (b.blockerId === message.fromId && b.blockedId === message.toId) || 
        (b.blockerId === message.toId && b.blockedId === message.fromId)
      );

      const newMsg = { ...message, id: String(Date.now()), timestamp: Date.now() };
      db.messages.push(newMsg);
      
      if (!isBlocked) {
        // Emit to recipient only if not blocked
        io.to(message.toId).emit("receiveMessage", newMsg);
      }
      // Emit back to sender
      socket.emit("receiveMessage", newMsg);
    });
    
    // Fetch previous messages between two users
    socket.on("getMessages", ({ userId, otherId }, callback) => {
      const history = db.messages.filter(
        m => (m.fromId === userId && m.toId === otherId) || (m.fromId === otherId && m.toId === userId)
      ).sort((a, b) => a.timestamp - b.timestamp);
      callback(history);
    });

    socket.on("disconnect", () => {
      console.log("User disconnected", socket.id);
    });
  });

  // Vite Middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production serving static files
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
