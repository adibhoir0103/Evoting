// ============================================================
// Bharat E-Vote — Application Entry Point
// ============================================================
// Slim server.js — all business logic has been extracted to
// controllers/ and routes/ during Phase 2 modularization.
// ============================================================

// Initialize Sentry FIRST — before all other imports
const Sentry = require('@sentry/node');

require('dotenv').config();

// Sentry must be initialized BEFORE require('express') for auto-instrumentation
if (process.env.SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    });
    console.log('✅ Sentry error monitoring initialized');
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

const logger = require('./lib/logger');
const { errorHandler } = require('./middleware/errorHandler');

// Initialize Backend EVM WebSocket Listeners for real-time contract tracing
const blockchainListener = require('./services/blockchainListener');
blockchainListener.init();

// Initialize Election Email Notification Scheduler
const electionNotifier = require('./services/electionNotifier');
electionNotifier.start();

// Child logger for server context
const serverLog = logger.child('server');

const app = express();
const PORT = process.env.PORT || 5000;

// ===================== GLOBAL MIDDLEWARE =====================

// Response compression (gzip)
app.use(compression());

// Structured HTTP request logging via morgan → custom logger stream
app.use(morgan(':method :url :status :response-time ms', {
    stream: { write: (msg) => logger.info('http', msg.trim()) }
}));

// Security headers
const isProduction = process.env.NODE_ENV === 'production';
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https://upload.wikimedia.org", "https://*.wikimedia.org"],
            connectSrc: isProduction
                ? ["'self'"]
                : ["'self'", "http://localhost:*", "ws://localhost:*"]
        }
    },
    crossOriginEmbedderPolicy: false,
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true }
}));

// CORS
const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
    : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173', 'http://127.0.0.1:5173'];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10kb' }));

// ===================== HEALTH CHECKS =====================

app.get('/', (req, res) => {
    res.json({
        status: 'running',
        service: 'Bharat E-Vote Backend API',
        version: '3.0.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        endpoints: '/api/v1/*'
    });
});

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'bharat-evote-api', timestamp: new Date().toISOString() });
});

app.get('/api/v1/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'bharat-evote-api', timestamp: new Date().toISOString() });
});

// ===================== ROUTE MOUNTING =====================

app.use('/api/v1/auth', require('./routes/authRoutes'));
app.use('/api/v1/user', require('./routes/userRoutes'));
app.use('/api/v1/vote', require('./routes/voteRoutes'));
app.use('/api/v1/zkp', require('./routes/zkpRoutes'));
app.use('/api/v1/ipfs', require('./routes/ipfsRoutes'));
app.use('/api/v1/meta-tx', require('./routes/metaTxRoutes'));
app.use('/api/v1/admin', require('./routes/admin'));

// ===================== ERROR HANDLING =====================

// Sentry error handler (must be before custom error handler)
Sentry.setupExpressErrorHandler(app);

// Centralized error handler
app.use(errorHandler);

// ===================== START SERVER =====================

if (require.main === module) {
    app.listen(PORT, () => {
        serverLog.info(`Server started on port ${PORT}`, { port: PORT, env: process.env.NODE_ENV || 'development' });
    });
}

module.exports = app;
