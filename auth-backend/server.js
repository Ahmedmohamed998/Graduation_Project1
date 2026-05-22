// server.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const app = express();

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3210",
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Routes
const authRoutes = require("./routes/auth");
app.use("/api/auth", authRoutes);

const smsRoutes = require("./routes/sms");
app.use("/api/sms", smsRoutes);

const securityRoutes = require("./routes/security");
app.use("/api/security", securityRoutes);

// Health route
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", service: "auth-backend" });
});

// Test route
app.get("/", (req, res) => {
  res.json({ message: "Auth API is running!" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: "Something went wrong!",
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Database connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("Connected to MongoDB");

    const PORT = process.env.PORT || 3210;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

module.exports = app;
