// ============================================================
// Bharat E-Vote — Application Entry Point
// ============================================================
// Slim server.js — all business logic has been extracted to
// controllers/ and routes/ during Phase 2 modularization.
// ============================================================

// Initialize Sentry FIRST — before all other imports
const Sentry = require('@sentry/node');

require('dotenv').config();

// Logger must be initialized before Sentry so serverLog is available
const logger = require('./lib/logger');
const serverLog = logger.child('server');

// Sentry must be initialized BEFORE require('express') for auto-instrumentation
if (process.env.SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    });
    serverLog.info('Sentry error monitoring initialized');
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const hpp = require('hpp');

const { errorHandler } = require('./middleware/errorHandler');

// Initialize Backend EVM WebSocket Listeners for real-time contract tracing
const blockchainListener = require('./services/blockchainListener');
blockchainListener.init();

// Initialize Election Email Notification Scheduler
const electionNotifier = require('./services/electionNotifier');
electionNotifier.start();

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
        // SECURITY: Reject 'null' origin to prevent local file CORS bypass
        if (origin === 'null') {
            return callback(new Error('Not allowed by CORS: null origin rejected'));
        }
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
app.use(cookieParser());

// Prevent HTTP Parameter Pollution
app.use(hpp());

// ===================== HEALTH CHECKS =====================

app.get('/', (req, res) => {
    res.json({
        status: 'running',
        service: 'Bharat E-Vote Backend API',
        timestamp: new Date().toISOString()
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

if (process.env.NODE_ENV !== 'production') {
    app.use('/api/v1/test', require('./routes/testRoutes'));
}

// ===================== ERROR HANDLING =====================

// Sentry error handler (must be before custom error handler)
Sentry.setupExpressErrorHandler(app);

// Centralized error handler
app.use(errorHandler);

// ===================== START SERVER =====================

if (require.main === module) {
    const server = app.listen(PORT, () => {
        serverLog.info(`Server started on port ${PORT}`, { port: PORT, env: process.env.NODE_ENV || 'development' });
    });

    // Graceful shutdown — essential for zero-downtime deploys (PM2, Railway, Render)
    const gracefulShutdown = (signal) => {
        serverLog.info(`${signal} received — shutting down gracefully`);
        server.close(async () => {
            serverLog.info('HTTP server closed');
            const prisma = require('./lib/prisma');
            await prisma.$disconnect();
            serverLog.info('Prisma disconnected');
            if (process.env.SENTRY_DSN) {
                await Sentry.close(2000);
            }
            process.exit(0);
        });
        // Force kill after 10s if graceful shutdown stalls
        setTimeout(() => { process.exit(1); }, 10000);
    };
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

module.exports = app;
