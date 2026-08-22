const express = require('express');
const rateLimit = require('express-rate-limit');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');

process.on('unhandledRejection', (reason, promise) => {
    console.error('[Process] Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('[Process] Uncaught Exception:', err);
});

require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// Ensure Firebase is initialized
require('./services/firebase.js');

const {
    ALLOWED_ORIGINS,
    RATE_LIMIT_DEFAULTS,
    SERVER_CONSTANTS
} = require('./constants.js');

const proxyRoutes = require('./routes/proxyRoutes.js');
const warRoutes = require('./routes/warRoutes.js');
const userDataRoutes = require('./routes/userDataRoutes.js');
const supportRoutes = require('./routes/supportRoutes.js');
const billingRoutes = require('./routes/billingRoutes.js');

const { pruneInactiveUsers } = require('./scripts/prune-inactive-users.js');
const { startCwlBackgroundScraper } = require('./services/warScraperService.js');
const { getOrUpdateBillingCache } = require('./services/billingService.js');

const app = express();
app.set('trust proxy', 1);
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : SERVER_CONSTANTS.PORT_DEFAULT;

// @ts-ignore
app.use(helmet());
// @ts-ignore
app.use(compression());

// @ts-ignore
const generalLimiter = rateLimit(RATE_LIMIT_DEFAULTS.general);
app.use(generalLimiter);

const allowedOrigins = ALLOWED_ORIGINS;

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, curl, or server-to-server)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('.pages.dev') || process.env.NODE_ENV === 'development') {
            return callback(null, true);
        } else {
            return callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-verify-token', 'x-user-id', 'x-app-version'],
    exposedHeaders: ['Retry-After', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Mount modular route subsystems
app.use('/proxy', proxyRoutes);
app.use('/api', warRoutes);
app.use('/api/user-data', userDataRoutes);
app.use('/api', supportRoutes);
app.use('/api/billing', billingRoutes);

// Background schedulers
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
setTimeout(() => {
    pruneInactiveUsers().catch(err => console.error('[SCHEDULED PRUNE] Initial run failed:', err));

    setInterval(() => {
        pruneInactiveUsers().catch(err => console.error('[SCHEDULED PRUNE] Run failed:', err));
    }, SEVEN_DAYS_MS);
}, 60 * 1000);

startCwlBackgroundScraper();

getOrUpdateBillingCache().then(() => {
    console.log('[Billing Cache] Startup cache warm-up complete.');
}).catch(err => {
    console.error('[Billing Cache] Failed to warm up cache on startup:', err);
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Proxy server listening at http://0.0.0.0:${port}`);
});
