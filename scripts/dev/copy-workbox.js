const fs = require('fs');
const path = require('path');

const projectRoot = process.cwd();
const destDir = path.join(projectRoot, 'js');

const sourcePath = path.join(projectRoot, 'node_modules/workbox-window/build/workbox-window.prod.umd.js');
const destPath = path.join(destDir, 'workbox-window.js');

const mapSourcePath = path.join(projectRoot, 'node_modules/workbox-window/build/workbox-window.prod.umd.js.map');
const mapDestPath = path.join(destDir, 'workbox-window.prod.umd.js.map');

if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

fs.copyFileSync(sourcePath, destPath);
if (fs.existsSync(mapSourcePath)) {
    fs.copyFileSync(mapSourcePath, mapDestPath);
}
console.log(`Copied Workbox and its source map for dev environment to: ${destDir}`);
