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
  friendRequests: [] as { fromId: string, toId: string, status: 'pending' | 'accepted' | 'rejected' }[],
  friends: [] as { user1Id: string, user2Id: string }[],
  blocks: [] as { blockerId: string, blockedId: string }[],
  resetTokens: [] as { token: string, email: string }[],
  notifications: [] as { id: string, userId: string, type: 'friend_request' | 'system', content: string, read: boolean, timestamp: number, relatedId?: string }[]
};

const onlineUsers = new Set<string>();

const createNotification = (userId: string, type: 'friend_request' | 'system', content: string, relatedId?: string) => {
  const notification = { id: String(Date.now()), userId, type, content, read: false, timestamp: Date.now(), relatedId };
  db.notifications.push(notification);
  return notification;
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

  app.use(express.json({ limit: "10mb" }));

  // API Routes - Authentication (Mock)
  app.post("/api/auth/register", (req, res) => {
    const { name, email, password } = req.body;
    if (db.users.find((u) => u.email === email)) {
      return res.status(400).json({ error: "User already exists with that email" });
    }
    const username = `@${name.replace(/\s+/g,'').toLowerCase()}${Math.floor(Math.random() * 10000)}`;
    const newUser = { 
      id: String(Date.now()), 
      name, 
      username,
      email, 
      password, 
      phone: "",
      showEmail: false,
      showPhone: false,
      bio: "", 
      avatar: "",
      interests: [] as string[]
    };
    db.users.push(newUser);
    // Simple token for MVP
    const token = Buffer.from(JSON.stringify({ id: newUser.id })).toString('base64');
    res.json({ token, user: { id: newUser.id, name: newUser.name, username: newUser.username, email: newUser.email, phone: newUser.phone, showEmail: newUser.showEmail, showPhone: newUser.showPhone, bio: newUser.bio, avatar: newUser.avatar, interests: newUser.interests } });
  });

  app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body;
    const user = db.users.find((u) => u.email === email && u.password === password);
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = Buffer.from(JSON.stringify({ id: user.id })).toString('base64');
    res.json({ token, user: { id: user.id, name: user.name, username: user.username, email: user.email, phone: user.phone, showEmail: user.showEmail, showPhone: user.showPhone, bio: user.bio, avatar: user.avatar, interests: user.interests } });
  });

  app.post("/api/auth/forgot-password", (req, res) => {
    const { email } = req.body;
    const user = db.users.find((u) => u.email === email);
    if (!user) {
      return res.json({ success: true, message: "If the email exists, a reset code was sent." });
    }
    const token = Math.random().toString(36).substring(2, 10).toUpperCase();
    db.resetTokens.push({ token, email });
    res.json({ success: true, token, message: "Use this token to reset your password." });
  });

  app.post("/api/auth/reset-password", (req, res) => {
    const { token, password } = req.body;
    const resetRecord = db.resetTokens.find((r) => r.token === token);
    if (!resetRecord) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }
    const user = db.users.find((u) => u.email === resetRecord.email);
    if (!user) {
      return res.status(400).json({ error: "User not found" });
    }
    user.password = password;
    db.resetTokens = db.resetTokens.filter((r) => r.token !== token);
    res.json({ success: true });
  });

  app.get("/api/me", (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "No token" });
    
    const user = db.users.find((u) => u.id === userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user: { id: user.id, name: user.name, username: user.username, email: user.email, phone: user.phone, showEmail: user.showEmail, showPhone: user.showPhone, bio: user.bio, avatar: user.avatar, interests: user.interests } });
  });

  app.put("/api/users/me", (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const userIndex = db.users.findIndex(u => u.id === userId);
    if (userIndex === -1) return res.status(404).json({ error: "User not found" });

    const { bio, avatar, name, username, email, phone, showEmail, showPhone, interests } = req.body;
    
    // Check if username is already taken by someone else
    if (username && username !== db.users[userIndex].username) {
       if (db.users.find(u => u.username === username && u.id !== userId)) {
         return res.status(400).json({ error: "Username is already taken" });
       }
       db.users[userIndex].username = username;
    }
    // Check if email is already taken by someone else
    if (email && email !== db.users[userIndex].email) {
       if (db.users.find(u => u.email === email && u.id !== userId)) {
         return res.status(400).json({ error: "Email is already taken" });
       }
       db.users[userIndex].email = email;
    }

    if (bio !== undefined) db.users[userIndex].bio = bio;
    if (avatar !== undefined) db.users[userIndex].avatar = avatar;
    if (name !== undefined) db.users[userIndex].name = name;
    if (phone !== undefined) db.users[userIndex].phone = phone;
    if (showEmail !== undefined) db.users[userIndex].showEmail = showEmail;
    if (showPhone !== undefined) db.users[userIndex].showPhone = showPhone;
    if (interests !== undefined) db.users[userIndex].interests = interests;
    
    const u = db.users[userIndex];
    res.json({ success: true, user: { id: u.id, name: u.name, username: u.username, email: u.email, phone: u.phone, showEmail: u.showEmail, showPhone: u.showPhone, bio: u.bio, avatar: u.avatar, interests: u.interests } });
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
  
  app.delete("/api/posts/:id", (req, res) => {
    const userId = getUserId(req);
    const postId = req.params.id;
    if (!userId || !postId) return res.status(400).json({ error: "Invalid request" });
    
    const postIndex = db.posts.findIndex((p) => p.id === postId);
    if (postIndex === -1) return res.status(404).json({ error: "Post not found" });

    if (db.posts[postIndex].userId !== userId) {
      return res.status(403).json({ error: "Unauthorized to delete this post" });
    }

    db.posts.splice(postIndex, 1);
    res.json({ success: true });
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
      .map(u => ({ id: u.id, name: u.name, username: u.username, bio: u.bio, avatar: u.avatar, interests: u.interests, email: u.showEmail ? u.email : undefined, phone: u.showPhone ? u.phone : undefined, isOnline: onlineUsers.has(u.id) }));
    res.json(safeUsers);
  });

  // API Routes - Friendships
  app.post("/api/friends/request", (req, res) => {
    const userId = getUserId(req);
    const { toId } = req.body;
    if (!userId || !toId || userId === toId) return res.status(400).json({ error: "Invalid request" });

    const existingReq = db.friendRequests.find(r => 
      (r.fromId === userId && r.toId === toId && r.status !== 'rejected') || 
      (r.fromId === toId && r.toId === userId && r.status !== 'rejected')
    );
    if (existingReq) return res.status(400).json({ error: "Request already exists or are already friends" });

    db.friendRequests.push({ fromId: userId, toId, status: 'pending' });
    const user = db.users.find(u => u.id === userId);
    createNotification(toId, 'friend_request', `${user?.name || 'A user'} wants to connect.`, userId);
    
    res.json({ success: true });
  });

  app.post("/api/friends/accept", (req, res) => {
    const userId = getUserId(req);
    const { fromId } = req.body;
    if (!userId || !fromId) return res.status(400).json({ error: "Invalid request" });

    const reqIndex = db.friendRequests.findIndex(r => r.fromId === fromId && r.toId === userId && r.status === 'pending');
    if (reqIndex === -1) return res.status(404).json({ error: "Request not found" });

    db.friendRequests[reqIndex].status = 'accepted';
    db.friends.push({ user1Id: userId, user2Id: fromId });
    
    const user = db.users.find(u => u.id === userId);
    createNotification(fromId, 'system', `${user?.name || 'A user'} accepted your connection request.`);
    
    res.json({ success: true });
  });

  app.post("/api/friends/reject", (req, res) => {
    const userId = getUserId(req);
    const { fromId } = req.body;
    if (!userId || !fromId) return res.status(400).json({ error: "Invalid request" });

    const reqIndex = db.friendRequests.findIndex(r => r.fromId === fromId && r.toId === userId && r.status === 'pending');
    if (reqIndex === -1) return res.status(404).json({ error: "Request not found" });

    db.friendRequests[reqIndex].status = 'rejected';
    res.json({ success: true });
  });

  app.get("/api/friends", (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const friendIds = db.friends.filter(f => f.user1Id === userId || f.user2Id === userId)
      .map(f => f.user1Id === userId ? f.user2Id : f.user1Id);
    
    const friends = db.users.filter(u => friendIds.includes(u.id)).map(u => ({ id: u.id, name: u.name, username: u.username, avatar: u.avatar, email: u.showEmail ? u.email : undefined, phone: u.showPhone ? u.phone : undefined, isOnline: onlineUsers.has(u.id) }));
    res.json(friends);
  });

  app.get("/api/friends/requests", (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const incomingReqs = db.friendRequests.filter(r => r.toId === userId && r.status === 'pending');
    const requests = incomingReqs.map(r => {
      const fromUser = db.users.find(u => u.id === r.fromId);
      return { fromId: r.fromId, name: fromUser?.name, username: fromUser?.username, avatar: fromUser?.avatar, email: fromUser?.showEmail ? fromUser?.email : undefined, phone: fromUser?.showPhone ? fromUser?.phone : undefined };
    });
    res.json(requests);
  });
  
  app.get("/api/friends/suggestions", (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const friendIds = db.friends.filter(f => f.user1Id === userId || f.user2Id === userId)
      .map(f => f.user1Id === userId ? f.user2Id : f.user1Id);
      
    const pendingReqIds = db.friendRequests.filter(r => 
      (r.fromId === userId && r.status === 'pending') || 
      (r.toId === userId && r.status === 'pending')
    ).map(r => r.fromId === userId ? r.toId : r.fromId);

    const hiddenUsers = db.blocks
      .filter((b) => b.blockerId === userId || b.blockedId === userId)
      .flatMap((b) => [b.blockerId, b.blockedId]);

    const suggestions = db.users
      .filter(u => u.id !== userId && !friendIds.includes(u.id) && !pendingReqIds.includes(u.id) && !hiddenUsers.includes(u.id))
      .map(u => ({ id: u.id, name: u.name, username: u.username, avatar: u.avatar, bio: u.bio, email: u.showEmail ? u.email : undefined, phone: u.showPhone ? u.phone : undefined }))
      .slice(0, 5); // Limit suggestions

    res.json(suggestions);
  });

  // API Routes - Notifications
  app.get("/api/notifications", (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const userNotifs = db.notifications.filter(n => n.userId === userId).sort((a, b) => b.timestamp - a.timestamp);
    res.json(userNotifs);
  });

  app.post("/api/notifications/read", (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    db.notifications.filter(n => n.userId === userId).forEach(n => n.read = true);
    res.json({ success: true });
  });

  // API Routes - Messages (unread)
  app.get("/api/messages/unread-counts", (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const counts: Record<string, number> = {};
    db.messages.filter(m => m.toId === userId && !m.isRead).forEach(m => {
      counts[m.fromId] = (counts[m.fromId] || 0) + 1;
    });
    res.json(counts);
  });

  app.post("/api/messages/read", (req, res) => {
    const userId = getUserId(req);
    const { fromId } = req.body;
    if (!userId || !fromId) return res.status(400).json({ error: "Invalid request" });

    db.messages.filter(m => m.toId === userId && m.fromId === fromId && !m.isRead).forEach(m => {
      m.isRead = true;
    });
    res.json({ success: true });
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
    let currentUserId: string | null = null;
    
    // Simple presence
    socket.on("register", (userId) => {
      currentUserId = userId;
      onlineUsers.add(userId);
      socket.join(userId); // Join a room for their own user ID to receive direct messages
      io.emit("userStatusChange", { userId, isOnline: true });
    });

    socket.on("sendMessage", (message) => {
      // message: { fromId, toId, text }
      const isBlocked = db.blocks.find((b) => 
        (b.blockerId === message.fromId && b.blockedId === message.toId) || 
        (b.blockerId === message.toId && b.blockedId === message.fromId)
      );

      const newMsg = { ...message, id: String(Date.now()), timestamp: Date.now(), isRead: false };
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
      if (currentUserId) {
        onlineUsers.delete(currentUserId);
        io.emit("userStatusChange", { userId: currentUserId, isOnline: false });
      }
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
