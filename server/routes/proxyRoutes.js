const express = require('express');
const rateLimit = require('express-rate-limit');
const { RATE_LIMIT_DEFAULTS } = require('../constants.js');

const proxyPlayerRoutes = require('./proxyPlayerRoutes.js');
const proxyClanRoutes = require('./proxyClanRoutes.js');
const proxyCwlRoutes = require('./proxyCwlRoutes.js');

const router = express.Router();
// @ts-ignore
const proxyLimiter = rateLimit(RATE_LIMIT_DEFAULTS.proxy);

router.use(proxyLimiter);

router.use('/', proxyPlayerRoutes);
router.use('/', proxyClanRoutes);
router.use('/', proxyCwlRoutes);

module.exports = router;
