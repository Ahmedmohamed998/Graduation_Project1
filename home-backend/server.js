const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const { seedSystemCategories } = require('./utils/seedCategories');
const { initFirebase }         = require('./utils/firebase');

// Load environment variables
dotenv.config();

const app = express();

// ========== MIDDLEWARE ==========
// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Security Middlewares
const mongoSanitize = require("express-mongo-sanitize");
app.use(mongoSanitize());

const rateLimit = require("express-rate-limit");
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // max 200 requests per IP per window
  message: { error: "Too many requests, please try again later." },
});
app.use("/api/", limiter);

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// ========== DATABASE CONNECTION ==========
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(async () => {
    logger.info('✅ Connected to MongoDB successfully');
    console.log('✅ MongoDB connected - Database:', mongoose.connection.name);
    await seedSystemCategories();
  })
  .catch((err) => {
    logger.error('❌ MongoDB connection error:', err);
    console.error('❌ Failed to connect to MongoDB:', err.message);
    process.exit(1);
  });

// ========== ROUTES ==========
// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'home-backend',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/budgets', require('./routes/budgets'));
app.use('/api/savings', require('./routes/savings'));
app.use('/api/debts', require('./routes/debts'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/offers', require('./routes/offers'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/help',       require('./routes/help'));
app.use('/api/ai',         require('./routes/ai'));
app.use('/api/categories', require('./routes/categories'));

// Notifications (FCM)
app.use('/api/notifications', require('./routes/notifications'));

// Voice pipeline
app.use('/api/voice', require('./routes/voice'));

// OCR pipeline (with size limit middleware)
app.use('/api/ocr', express.raw({ limit: '10mb', type: '*/*' }));
app.use('/api/ocr', require('./routes/ocr'));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ========== ERROR HANDLER ==========
app.use(errorHandler);

// ========== FIREBASE INIT ==========
try {
  initFirebase();
} catch (err) {
  console.error('Firebase initialization error (non-fatal):', err.message);
}

// ========== START SERVER ==========
const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`\n🚀 Home Backend Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health\n`);
  logger.info(`Server started on port ${PORT}`);
});
