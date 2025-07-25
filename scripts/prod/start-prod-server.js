const liveServer = require('live-server');
const path = require('path');

const params = {
    port: 8081,
    host: "0.0.0.0",
    root: path.join(__dirname, '../../dist'),
    open: false,
    file: "index.html",
    wait: 1000,
    logLevel: 2,
};

liveServer.start(params);