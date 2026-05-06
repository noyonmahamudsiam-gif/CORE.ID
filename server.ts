import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-for-development";
const MONGODB_URI = process.env.MONGODB_URI;

mongoose.set("bufferCommands", false); // Fail fast if not connected

import { MongoMemoryServer } from 'mongodb-memory-server';

async function connectDB() {
  if (MONGODB_URI) {
    try {
      await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
      console.log("Connected to persistent MongoDB");
    } catch (err) {
      console.error("Database connection error:", err);
    }
  } else {
    console.log("No MONGODB_URI found. Starting in-memory MongoDB...");
    try {
      const mongoServer = await MongoMemoryServer.create();
      const uri = mongoServer.getUri();
      await mongoose.connect(uri);
      console.log("Connected to in-memory MongoDB (Data will be lost on restart)");
    } catch (err) {
      console.error("In-memory MongoDB failed to start:", err);
    }
  }
}

connectDB();

// Mongoose Schemas (Migration Safe)
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  email: { type: String, unique: true, sparse: true },
  password: { type: String, required: true },
  phone: { type: String, unique: true, sparse: true },
  gender: { type: String, enum: ['Male', 'Female', 'Other', 'Prefer not to say'], default: 'Prefer not to say' },
  genderVerified: { type: Boolean, default: false },
  dateOfBirth: { type: String, default: "" },
  ageVerified: { type: Boolean, default: false },
  messagePrivacy: { type: String, enum: ['everyone', 'friends', 'none'], default: 'everyone' },
  showEmail: { type: Boolean, default: false },
  showPhone: { type: Boolean, default: false },
  bio: { type: String, default: "" },
  aboutMe: { type: String, default: "" },
  showAboutMe: { type: Boolean, default: false },
  avatar: { type: String, default: "" },
  interests: { type: [String], default: [] },
  isVerified: { type: Boolean, default: false }, // new migration safe field
  createdAt: { type: Number, default: () => Date.now() }
}, { timestamps: true });

const otpSchema = new mongoose.Schema({
  identifier: { type: String, required: true },
  code: { type: String, required: true },
  expiresAt: { type: Number, required: true },
  type: { type: String, enum: ['register', 'reset'], required: true },
  name: String,
  gender: String,
  dateOfBirth: String,
  passwordHash: String,
  consumed: { type: Boolean, default: false } // Instead of deleting, mark consumed
});

const postSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  text: { type: String, required: true },
  timestamp: { type: Number, default: () => Date.now() },
  likes: { type: Number, default: 0 },
  comments: { type: Array, default: [] },
  isDeleted: { type: Boolean, default: false } // Soft delete
});

const messageSchema = new mongoose.Schema({
  fromId: { type: String, required: true },
  toId: { type: String, required: true },
  text: { type: String, required: true },
  timestamp: { type: Number, default: () => Date.now() },
  isRead: { type: Boolean, default: false }
});

const friendRequestSchema = new mongoose.Schema({
  fromId: { type: String, required: true },
  toId: { type: String, required: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' }
});

const friendSchema = new mongoose.Schema({
  user1Id: { type: String, required: true },
  user2Id: { type: String, required: true }
});

const blockSchema = new mongoose.Schema({
  blockerId: { type: String, required: true },
  blockedId: { type: String, required: true }
});

const notificationSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  type: { type: String, enum: ['friend_request', 'system'], required: true },
  content: { type: String, required: true },
  relatedId: String,
  read: { type: Boolean, default: false },
  timestamp: { type: Number, default: () => Date.now() }
});

const User = mongoose.models.User || mongoose.model<any>("User", userSchema);
const OTP = mongoose.models.OTP || mongoose.model<any>("OTP", otpSchema);
const Post = mongoose.models.Post || mongoose.model<any>("Post", postSchema);
const Message = mongoose.models.Message || mongoose.model<any>("Message", messageSchema);
const FriendRequest = mongoose.models.FriendRequest || mongoose.model<any>("FriendRequest", friendRequestSchema);
const Friend = mongoose.models.Friend || mongoose.model<any>("Friend", friendSchema);
const Block = mongoose.models.Block || mongoose.model<any>("Block", blockSchema);
const Notification = mongoose.models.Notification || mongoose.model<any>("Notification", notificationSchema);

// Emulate Email Sending (configure real SMTP in production)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: Number(process.env.SMTP_PORT) || 587,
  auth: {
    user: process.env.SMTP_USER || 'ethereal.user@ethereal.email',
    pass: process.env.SMTP_PASS || 'etherealpass'
  }
});

// Helper to simulate emails during dev if no real SMTP exists
const sendEmail = async (to: string, subject: string, text: string) => {
  console.log(`\n\n=== EMAIL TO: ${to} ===\nSubject: ${subject}\n\n${text}\n========================\n\n`);
  try {
    if (process.env.SMTP_HOST) {
      await transporter.sendMail({ from: '"Core.ID System" <noreply@core.id>', to, subject, text });
    }
  } catch (err) {
    console.error("Failed to send real email", err);
  }
};

const onlineUsers = new Set<string>();

const createNotification = async (userId: string, type: 'friend_request' | 'system', content: string, relatedId?: string) => {
  const notification = await Notification.create({ userId, type, content, relatedId, timestamp: Date.now() });
  return notification;
};

const getUserId = (req: express.Request) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  try {
    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
    return decoded.id;
  } catch {
    return null;
  }
}


async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Rate Limiter for OTP requests
  const otpLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 3, // limit each IP to 3 requests per windowMs
    message: { error: "Too many requests from this IP, please try again after a minute" }
  });

  // API Routes - Authentication
  app.post("/api/auth/register", otpLimiter, async (req, res) => {
    try {
      const { name, identifier, password, gender, dateOfBirth } = req.body;
      if (!identifier || !password || !name || !gender || !dateOfBirth) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      // Validate format
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
      const isPhone = /^\+?[\d\s-]{7,15}$/.test(identifier);
      if (!isEmail && !isPhone) return res.status(400).json({ error: "Invalid email or phone format" });
      if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

      // Validate Age 16+
      const dob = new Date(dateOfBirth);
      const ageDiffMs = Date.now() - dob.getTime();
      const ageDate = new Date(ageDiffMs);
      const age = Math.abs(ageDate.getUTCFullYear() - 1970);
      if (age < 16) return res.status(400).json({ error: "You must be at least 16 years old to use this platform." });

      const existingUser = await User.findOne({ $or: [{ email: identifier }, { phone: identifier }] });
      if (existingUser) {
        return res.status(400).json({ error: "User already exists with that email or phone number" });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const code = Math.floor(1000 + Math.random() * 9000).toString(); // 4-digit code
      const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

      // store OTP temporarily, update existing if any
      await OTP.findOneAndUpdate(
        { identifier, type: 'register' },
        { code, expiresAt, name, gender, dateOfBirth, passwordHash, consumed: false },
        { upsert: true }
      );

      if (isEmail) {
        await sendEmail(identifier, "Your Core.ID Verification Code", `Your verification code is: ${code}\nThis code will expire in 5 minutes.`);
      } else {
        console.log(`[SMS MOCK] Sending to ${identifier}: Your verification code is ${code}`);
      }
      res.json({ 
        success: true, 
        message: "Verification code sent.",
        mockCode: !process.env.SMTP_HOST ? code : undefined
      });
    } catch (err) {
      console.error("Register Error:", err);
      res.status(500).json({ error: "Internal Server Error. Please contact support or try again." });
    }
  });

  app.post("/api/auth/verify-register", async (req, res) => {
    const { identifier, code } = req.body;
    const otpRecord = await OTP.findOne({ identifier, type: 'register', consumed: false });

    if (!otpRecord) return res.status(400).json({ error: "No verification process found for this identifier" });
    if (otpRecord.code !== String(code)) return res.status(400).json({ error: "Invalid verification code" });
    if (Date.now() > otpRecord.expiresAt) return res.status(400).json({ error: "Verification code has expired" });

    // Code is correct, create the user
    const username = `@${otpRecord.name!.replace(/\s+/g,'').toLowerCase()}${Math.floor(Math.random() * 10000)}`;
    
    // Check if username accidentally clashes
    let finalUsername = username;
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      finalUsername = username + Math.floor(Math.random() * 1000);
    }

    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);

    const newUser = await User.create({
      name: otpRecord.name, 
      username: finalUsername,
      email: isEmail ? identifier : undefined,
      phone: !isEmail ? identifier : undefined,
      password: otpRecord.passwordHash,
      gender: otpRecord.gender,
      dateOfBirth: otpRecord.dateOfBirth,
      isVerified: true
    });
    
    // consume OTP
    await OTP.updateOne({ _id: otpRecord._id }, { consumed: true });

    const token = jwt.sign({ id: newUser._id.toString() }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: newUser._id.toString(), name: newUser.name, username: newUser.username, email: newUser.email, phone: newUser.phone, gender: newUser.gender, dateOfBirth: newUser.dateOfBirth, showEmail: newUser.showEmail, showPhone: newUser.showPhone, bio: newUser.bio, aboutMe: newUser.aboutMe, showAboutMe: newUser.showAboutMe, avatar: newUser.avatar, interests: newUser.interests } });
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { identifier, password } = req.body;
      const user = await User.findOne({ $or: [{ email: identifier }, { phone: identifier }] });
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const token = jwt.sign({ id: user._id.toString() }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ token, user: { id: user._id.toString(), name: user.name, username: user.username, email: user.email, phone: user.phone, gender: user.gender, dateOfBirth: user.dateOfBirth, showEmail: user.showEmail, showPhone: user.showPhone, bio: user.bio, aboutMe: user.aboutMe, showAboutMe: user.showAboutMe, avatar: user.avatar, interests: user.interests } });
    } catch (err) {
      console.error("Login Error:", err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.post("/api/auth/forgot-password", otpLimiter, async (req, res) => {
    const { identifier } = req.body;
    const user = await User.findOne({ $or: [{ email: identifier }, { phone: identifier }] });
    if (!user) {
      // Don't leak whether user exists, but pretend we sent it
      return res.json({ success: true, message: "If the account exists, a reset code was sent." });
    }
    
    const code = Math.floor(1000 + Math.random() * 9000).toString(); // 4-digit code
    const expiresAt = Date.now() + 5 * 60 * 1000;

    await OTP.findOneAndUpdate(
      { identifier, type: 'reset' },
      { code, expiresAt, consumed: false },
      { upsert: true }
    );

    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
    if (isEmail) {
      await sendEmail(identifier, "Your Password Reset Code", `Your password reset code is: ${code}\nThis code will expire in 5 minutes.`);
    } else {
      console.log(`[SMS MOCK] Sending to ${identifier}: Your reset code is ${code}`);
    }
    
    res.json({ 
      success: true, 
      message: "If the account exists, a reset code was sent.",
      mockCode: !process.env.SMTP_HOST ? code : undefined 
    });
  });

  app.post("/api/auth/verify-reset-code", async (req, res) => {
    const { identifier, code } = req.body;
    
    // In order for the next step (reset password) to be secure without requiring email tracking solely in frontend, 
    // we generate a temporary reset token once OTP is validated.
    const otpRecord = await OTP.findOne({ identifier, type: 'reset', consumed: false });
    if (!otpRecord) return res.status(400).json({ error: "No reset request found" });
    if (otpRecord.code !== String(code)) return res.status(400).json({ error: "Invalid reset code" });
    if (Date.now() > otpRecord.expiresAt) return res.status(400).json({ error: "Reset code has expired" });

    // OTP matched. Consume it and generate a one-time token for password reset
    await OTP.updateOne({ _id: otpRecord._id }, { consumed: true });
    const resetToken = jwt.sign({ identifier, intent: 'reset_password' }, JWT_SECRET, { expiresIn: '15m' });

    res.json({ success: true, token: resetToken });
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: "Missing fields" });
    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { identifier: string, intent: string };
      if (decoded.intent !== 'reset_password') throw new Error("Invalid token intent");

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await User.findOneAndUpdate(
        { $or: [{ email: decoded.identifier }, { phone: decoded.identifier }] }, 
        { password: hashedPassword }
      );
      if (!user) return res.status(400).json({ error: "User not found" });
      
      // Optionally we could verify if the token was already used by maintaining a consumed tokens list,
      // but for MVP JWT expiration is generally good enough.
      res.json({ success: true, message: "Password updated successfully" });
    } catch {
      res.status(400).json({ error: "Invalid or expired token" });
    }
  });

  app.get("/api/me", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "No token" });
    
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user: { id: user._id.toString(), name: user.name, username: user.username, email: user.email, phone: user.phone, showEmail: user.showEmail, showPhone: user.showPhone, bio: user.bio, aboutMe: user.aboutMe, showAboutMe: user.showAboutMe, avatar: user.avatar, interests: user.interests, gender: user.gender, genderVerified: user.genderVerified, dateOfBirth: user.dateOfBirth, ageVerified: user.ageVerified, messagePrivacy: user.messagePrivacy || 'everyone' } });
  });

  app.put("/api/users/me", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const { bio, avatar, name, username, email, phone, showEmail, showPhone, interests, aboutMe, showAboutMe, genderVerified, ageVerified, messagePrivacy } = req.body;
    
    // Check if username is already taken by someone else
    if (username && username !== user.username) {
       const existingUn = await User.findOne({ username, _id: { $ne: userId } });
       if (existingUn) {
         return res.status(400).json({ error: "Username is already taken" });
       }
       user.username = username;
    }
    // Check if email is already taken by someone else
    if (email && email !== user.email) {
       const existingEm = await User.findOne({ email, _id: { $ne: userId } });
       if (existingEm) {
         return res.status(400).json({ error: "Email is already taken" });
       }
       user.email = email;
    }

    if (bio !== undefined) user.bio = bio;
    if (avatar !== undefined) user.avatar = avatar;
    if (name !== undefined) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (showEmail !== undefined) user.showEmail = showEmail;
    if (showPhone !== undefined) user.showPhone = showPhone;
    if (interests !== undefined) user.interests = interests;
    if (aboutMe !== undefined) user.aboutMe = aboutMe;
    if (showAboutMe !== undefined) user.showAboutMe = showAboutMe;
    if (genderVerified !== undefined) user.genderVerified = genderVerified;
    if (ageVerified !== undefined) user.ageVerified = ageVerified;
    if (messagePrivacy !== undefined) user.messagePrivacy = messagePrivacy;
    
    const u = await user.save();
    res.json({ success: true, user: { id: u._id.toString(), name: u.name, username: u.username, email: u.email, phone: u.phone, showEmail: u.showEmail, showPhone: u.showPhone, bio: u.bio, aboutMe: u.aboutMe, showAboutMe: u.showAboutMe, avatar: u.avatar, interests: u.interests, gender: u.gender, genderVerified: u.genderVerified, dateOfBirth: u.dateOfBirth, ageVerified: u.ageVerified, messagePrivacy: u.messagePrivacy || 'everyone' } });
  });

  // API Routes - Posts
  app.get("/api/posts", async (req, res) => {
    const userId = getUserId(req);
    const userBlocks = await Block.find({ $or: [{ blockerId: userId }, { blockedId: userId }] });
    const hiddenUsers = userBlocks.flatMap((b) => [b.blockerId, b.blockedId]);

    // Return active posts with author details
    const posts = await Post.find({ userId: { $nin: hiddenUsers }, isDeleted: false }).sort({ timestamp: -1 });
    const userKeys = [...new Set(posts.map(p => p.userId))];
    const authors = await User.find({ _id: { $in: userKeys } });

    const populatedPosts = posts.map(p => {
      const u = authors.find(u => u._id.toString() === p.userId);
      return {
        id: p._id.toString(), userId: p.userId, text: p.text, timestamp: p.timestamp, likes: p.likes, comments: p.comments,
        author: u ? { id: u._id.toString(), name: u.name, avatar: u.avatar, username: u.username } : undefined
      };
    });
    res.json(populatedPosts);
  });

  app.post("/api/posts", async (req, res) => {
    const { userId, text } = req.body;
    const post = await Post.create({ userId, text });
    res.json({ ...post.toObject(), id: post._id.toString() });
  });
  
  app.delete("/api/posts/:id", async (req, res) => {
    const userId = getUserId(req);
    const postId = req.params.id;
    if (!userId || !postId) return res.status(400).json({ error: "Invalid request" });
    
    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ error: "Post not found" });

    if (post.userId !== userId) {
      return res.status(403).json({ error: "Unauthorized to delete this post" });
    }

    post.isDeleted = true; // Soft delete instead of deleting
    await post.save();
    res.json({ success: true });
  });

  // API Routes - Users
  app.get("/api/users", async (req, res) => {
    const userId = getUserId(req);
    let hiddenUsers: string[] = [];
    if (userId) {
      const userBlocks = await Block.find({ $or: [{ blockerId: userId }, { blockedId: userId }] });
      hiddenUsers = userBlocks.flatMap((b) => [b.blockerId, b.blockedId]);
    }

    // Exclude passwords
    const safeUsers = await User.find({ _id: { $nin: hiddenUsers } });
    const mappedUsers = safeUsers.map(u => ({ 
      id: u._id.toString(), 
      name: u.name, 
      username: u.username, 
      bio: u.bio, 
      avatar: u.avatar, 
      interests: u.interests, 
      email: u.showEmail ? u.email : undefined, 
      phone: u.showPhone ? u.phone : undefined, 
      aboutMe: u.showAboutMe ? u.aboutMe : undefined,
      gender: u.gender,
      genderVerified: u.genderVerified,
      ageVerified: u.ageVerified,
      messagePrivacy: u.messagePrivacy || 'everyone',
      isOnline: onlineUsers.has(u._id.toString()) 
    }));
    res.json(mappedUsers);
  });

  // API Routes - Friendships
  app.post("/api/friends/request", async (req, res) => {
    const userId = getUserId(req);
    const { toId } = req.body;
    if (!userId || !toId || userId === toId) return res.status(400).json({ error: "Invalid request" });

    const existingReq = await FriendRequest.findOne({
      $or: [
        { fromId: userId, toId: toId, status: { $ne: 'rejected' } },
        { fromId: toId, toId: userId, status: { $ne: 'rejected' } }
      ]
    });
    
    if (existingReq) return res.status(400).json({ error: "Request already exists or are already friends" });

    await FriendRequest.create({ fromId: userId, toId, status: 'pending' });
    const user = await User.findById(userId);
    await createNotification(toId, 'friend_request', `${user?.name || 'A user'} wants to connect.`, userId);
    
    res.json({ success: true });
  });

  app.post("/api/friends/accept", async (req, res) => {
    const userId = getUserId(req);
    const { fromId } = req.body;
    if (!userId || !fromId) return res.status(400).json({ error: "Invalid request" });

    const reqDoc = await FriendRequest.findOneAndUpdate(
      { fromId: fromId, toId: userId, status: 'pending' },
      { status: 'accepted' }
    );
    if (!reqDoc) return res.status(404).json({ error: "Request not found" });

    await Friend.create({ user1Id: userId, user2Id: fromId });
    
    const user = await User.findById(userId);
    await createNotification(fromId, 'system', `${user?.name || 'A user'} accepted your connection request.`);
    
    res.json({ success: true });
  });

  app.post("/api/friends/reject", async (req, res) => {
    const userId = getUserId(req);
    const { fromId } = req.body;
    if (!userId || !fromId) return res.status(400).json({ error: "Invalid request" });

    const reqDoc = await FriendRequest.findOneAndUpdate(
      { fromId: fromId, toId: userId, status: 'pending' },
      { status: 'rejected' }
    );
    if (!reqDoc) return res.status(404).json({ error: "Request not found" });

    res.json({ success: true });
  });

  app.get("/api/friends", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const friendships = await Friend.find({ $or: [{ user1Id: userId }, { user2Id: userId }] });
    const friendIds = friendships.map(f => f.user1Id === userId ? f.user2Id : f.user1Id);
    
    const dbUsers = await User.find({ _id: { $in: friendIds } });
    const friends = dbUsers.map(u => ({ id: u._id.toString(), name: u.name, username: u.username, avatar: u.avatar, email: u.showEmail ? u.email : undefined, phone: u.showPhone ? u.phone : undefined, aboutMe: u.showAboutMe ? u.aboutMe : undefined, isOnline: onlineUsers.has(u._id.toString()) }));
    res.json(friends);
  });

  app.get("/api/friends/requests/sent", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const outgoingReqs = await FriendRequest.find({ fromId: userId, status: 'pending' });
    res.json(outgoingReqs);
  });

  app.get("/api/friends/requests", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const incomingReqs = await FriendRequest.find({ toId: userId, status: 'pending' });
    const userKeys = [...new Set(incomingReqs.map(r => r.fromId))];
    const authors = await User.find({ _id: { $in: userKeys } });

    const requests = incomingReqs.map(r => {
      const fromUser = authors.find(u => u._id.toString() === r.fromId);
      return { fromId: r.fromId, name: fromUser?.name, username: fromUser?.username, avatar: fromUser?.avatar, email: fromUser?.showEmail ? fromUser?.email : undefined, phone: fromUser?.showPhone ? fromUser?.phone : undefined };
    });
    res.json(requests);
  });
  
  app.get("/api/friends/suggestions", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const friendships = await Friend.find({ $or: [{ user1Id: userId }, { user2Id: userId }] });
    const friendIds = friendships.map(f => f.user1Id === userId ? f.user2Id : f.user1Id);
      
    const pendingReqs = await FriendRequest.find({
      $or: [
        { fromId: userId, status: 'pending' },
        { toId: userId, status: 'pending' }
      ]
    });
    const pendingReqIds = pendingReqs.map(r => r.fromId === userId ? r.toId : r.fromId);

    const userBlocks = await Block.find({ $or: [{ blockerId: userId }, { blockedId: userId }] });
    const hiddenUsers = userBlocks.flatMap((b) => [b.blockerId, b.blockedId]);

    const excludeIds = [userId, ...friendIds, ...pendingReqIds, ...hiddenUsers];

    const dbUsers = await User.find({ _id: { $nin: excludeIds } }).limit(5);

    const suggestions = dbUsers.map(u => ({ id: u._id.toString(), name: u.name, username: u.username, avatar: u.avatar, bio: u.bio, email: u.showEmail ? u.email : undefined, phone: u.showPhone ? u.phone : undefined, aboutMe: u.showAboutMe ? u.aboutMe : undefined }));

    res.json(suggestions);
  });

  // API Routes - Notifications
  app.get("/api/notifications", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const userNotifs = await Notification.find({ userId: userId }).sort({ timestamp: -1 });
    res.json(userNotifs.map(n => ({ ...n.toObject(), id: n._id.toString() })));
  });

  app.post("/api/notifications/read", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    await Notification.updateMany({ userId: userId }, { read: true });
    res.json({ success: true });
  });

  // API Routes - Messages (unread)
  app.get("/api/messages/unread-counts", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const msgs = await Message.find({ toId: userId, isRead: false });
    const counts: Record<string, number> = {};
    msgs.forEach(m => {
      counts[m.fromId] = (counts[m.fromId] || 0) + 1;
    });
    res.json(counts);
  });

  app.post("/api/messages/read", async (req, res) => {
    const userId = getUserId(req);
    const { fromId } = req.body;
    if (!userId || !fromId) return res.status(400).json({ error: "Invalid request" });

    await Message.updateMany({ toId: userId, fromId: fromId, isRead: false }, { isRead: true });
    res.json({ success: true });
  });

  app.post("/api/users/:id/block", async (req, res) => {
    const userId = getUserId(req);
    const blockedId = req.params.id;
    if (!userId || !blockedId) return res.status(400).json({ error: "Invalid request" });
    
    await Block.findOneAndUpdate(
      { blockerId: userId, blockedId: blockedId },
      { blockerId: userId, blockedId: blockedId },
      { upsert: true }
    );
    res.json({ success: true });
  });

  app.delete("/api/users/:id/block", async (req, res) => {
    const userId = getUserId(req);
    const blockedId = req.params.id;
    if (!userId || !blockedId) return res.status(400).json({ error: "Invalid request" });
    
    await Block.findOneAndDelete({ blockerId: userId, blockedId: blockedId });
    res.json({ success: true });
  });

  app.get("/api/blocks", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const userBlocks = await Block.find({ blockerId: userId });
    const blockedIds = userBlocks.map(b => b.blockedId);
    
    const blockedUsers = await User.find({ _id: { $in: blockedIds } });
    const mappedUsers = blockedUsers.map(u => ({ id: u._id.toString(), name: u.name, avatar: u.avatar }));
    
    res.json(mappedUsers);
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

    socket.on("sendMessage", async (message) => {
      // message: { fromId, toId, text }
      const recipient = await User.findById(message.toId);
      if (!recipient) return;

      if (recipient.messagePrivacy === 'none') {
        socket.emit("messageError", { error: "This user does not accept direct messages." });
        return;
      }
      
      if (recipient.messagePrivacy === 'friends') {
        const isFriend = await Friend.findOne({
          $or: [
            { user1Id: message.fromId, user2Id: message.toId },
            { user1Id: message.toId, user2Id: message.fromId }
          ]
        });
        if (!isFriend) {
          socket.emit("messageError", { error: "This user only accepts messages from friends." });
          return;
        }
      }

      const isBlocked = await Block.findOne({
        $or: [
          { blockerId: message.fromId, blockedId: message.toId },
          { blockerId: message.toId, blockedId: message.fromId }
        ]
      });

      const newMsgDoc = await Message.create({ fromId: message.fromId, toId: message.toId, text: message.text, isRead: false });
      const newMsg = { ...newMsgDoc.toObject(), id: newMsgDoc._id.toString() };
      
      if (!isBlocked) {
        // Emit to recipient only if not blocked
        io.to(message.toId).emit("receiveMessage", newMsg);
      }
      // Emit back to sender
      socket.emit("receiveMessage", newMsg);
    });
    
    // Fetch previous messages between two users
    socket.on("getMessages", async ({ userId, otherId }, callback) => {
      const history = await Message.find({
        $or: [
          { fromId: userId, toId: otherId },
          { fromId: otherId, toId: userId }
        ]
      }).sort({ timestamp: 1 });
      
      callback(history.map(m => ({ ...m.toObject(), id: m._id.toString() })));
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
