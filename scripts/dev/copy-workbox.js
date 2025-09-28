const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();
const destDir = path.join(projectRoot, 'js');

const sourcePath = path.join(projectRoot, 'node_modules/workbox-window/build/workbox-window.prod.umd.js');
const destPath = path.join(destDir, 'workbox-window.js');

if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

fs.copyFileSync(sourcePath, destPath);
console.log(`Copied Workbox for dev environment to: ${destPath}`);
