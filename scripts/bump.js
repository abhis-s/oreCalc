const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');

// 1. Parse arguments and flags
const args = process.argv.slice(2);
const force = args.includes('--force') || args.includes('-f');
const cleanArgs = args.filter(arg => arg !== '--force' && arg !== '-f');
const newVersion = cleanArgs[0];

if (!newVersion) {
    console.error('Error: Please specify the new version number in x.x.x format.');
    console.error('Usage: pnpm run bump <new-version> [--force|-f]');
    process.exit(1);
}

const semverRegex = /^\d+\.\d+\.\d+$/;
if (!semverRegex.test(newVersion)) {
    console.error(`Error: Invalid version format "${newVersion}". Must be exactly x.x.x.`);
    process.exit(1);
}

// 2. Read package.json to get current version
const packageJsonPath = path.join(projectRoot, 'package.json');
let packageJson;
try {
    packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
} catch (e) {
    console.error('Error reading package.json:', e);
    process.exit(1);
}

const currentVersion = packageJson.version;

// 3. Compare versions
function compareSemver(v1, v2) {
    const cleanV1 = v1.split(/[+-]/)[0];
    const cleanV2 = v2.split(/[+-]/)[0];
    const p1 = cleanV1.split('.').map(Number);
    const p2 = cleanV2.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        if (p1[i] > p2[i]) return 1;
        if (p1[i] < p2[i]) return -1;
    }
    return 0;
}

if (!force && compareSemver(newVersion, currentVersion) <= 0) {
    console.error(`Error: New version "${newVersion}" is not greater than the current version "${currentVersion}".`);
    console.error('Use --force or -f to override this check.');
    process.exit(1);
}

console.log(`Bumping version: ${currentVersion} -> ${newVersion}`);

// 4. Update package.json
packageJson.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');
console.log('✔ Updated package.json');

// 5. Update server/main.js
const serverMainJsPath = path.join(projectRoot, 'server', 'main.js');
if (fs.existsSync(serverMainJsPath)) {
    let content = fs.readFileSync(serverMainJsPath, 'utf8');
    content = content.replace(/(currentAppVersion:\s*['"])[^'"]+(['"])/g, `$1${newVersion}$2`);
    fs.writeFileSync(serverMainJsPath, content, 'utf8');
    console.log('✔ Updated server/main.js');
}

// 6. Update js/core/state.js
const stateJsPath = path.join(projectRoot, 'js', 'core', 'state.js');
if (fs.existsSync(stateJsPath)) {
    let content = fs.readFileSync(stateJsPath, 'utf8');
    content = content.replace(/(window\.__ENV__\?\.APP_VERSION\s*\|\|\s*['"])[^'"]+(['"])/g, `$1${newVersion}$2`);
    fs.writeFileSync(stateJsPath, content, 'utf8');
    console.log('✔ Updated js/core/state.js');
}

// 7. Update js/app.js
const appJsPath = path.join(projectRoot, 'js', 'app.js');
if (fs.existsSync(appJsPath)) {
    let content = fs.readFileSync(appJsPath, 'utf8');
    content = content.replace(/(window\.__ENV__\?\.APP_VERSION\s*\|\|\s*state\.appVersion\s*\|\|\s*['"])[^'"]+(['"])/g, `$1${newVersion}$2`);
    fs.writeFileSync(appJsPath, content, 'utf8');
    console.log('✔ Updated js/app.js');
}

// 8. Update js/components/appSettings/appSettings.js
const appSettingsJsPath = path.join(projectRoot, 'js', 'components', 'appSettings', 'appSettings.js');
if (fs.existsSync(appSettingsJsPath)) {
    let content = fs.readFileSync(appSettingsJsPath, 'utf8');
    // Replace standard 'x.x.x' fallbacks
    content = content.replace(/(window\.__ENV__\?\.APP_VERSION\s*\|\|\s*state\.appVersion\s*\|\|\s*['"])[^'"]+(['"])/g, `$1${newVersion}$2`);
    // Replace 'vx.x.x' fallback
    content = content.replace(/(window\.__ENV__\?\.APP_VERSION\s*\|\|\s*state\.appVersion\s*\|\|\s*['"]v)[^'"]+(['"])/g, `$1${newVersion}$2`);
    fs.writeFileSync(appSettingsJsPath, content, 'utf8');
    console.log('✔ Updated js/components/appSettings/appSettings.js');
}

console.log(`\nSuccessfully bumped all files to version ${newVersion}!`);

console.log('\nRecommended Release Commands:');
console.log(`  git add package.json server/main.js js/core/state.js js/app.js js/components/appSettings/appSettings.js`);
console.log(`  git commit -m "chore(release): bump version to ${newVersion}"`);
console.log(`  git tag -a v${newVersion} -m "Release v${newVersion}"`);
console.log(`  git push origin main --tags\n`);
