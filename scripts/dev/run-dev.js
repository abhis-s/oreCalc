const { spawn } = require('child_process');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const noBrowser = args.includes('--no-browser') ||
                  args.includes('--no-open') ||
                  process.env.npm_config_browser === 'false' ||
                  process.env.npm_config_no_browser === 'true';

// 1. Run prerequisite tasks synchronously
try {
    execSync('node scripts/dev/copy-workbox.js', { stdio: 'inherit' });
    execSync('node scripts/fetch-billing-costs.js', { stdio: 'inherit' });
} catch (error) {
    console.error('[Dev Runner] Failed to initialize dev prerequisites:', error.message);
    process.exit(1);
}

// 2. Launch concurrently for live watch and dev server
const concurrentlyBin = path.join(process.cwd(), 'node_modules/.bin/concurrently');

const devServerCmd = noBrowser
    ? 'node -r dotenv/config scripts/dev/start-dev-server.js --no-browser'
    : 'pnpm:dev:server';

const concurrentlyArgs = [
    '--kill-others-on-fail',
    'pnpm:watch:sass',
    'pnpm:watch:js',
    devServerCmd
];

const child = spawn(concurrentlyBin, concurrentlyArgs, {
    stdio: 'inherit',
    env: process.env
});

child.on('exit', (code) => {
    process.exit(code || 0);
});
