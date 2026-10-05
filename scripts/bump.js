const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');

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

const packageJsonPath = path.join(projectRoot, 'package.json');
let packageJson;
try {
    packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
} catch (e) {
    console.error('Error reading package.json:', e);
    process.exit(1);
}

const currentVersion = packageJson.version;

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

packageJson.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');
console.log('[OK] Updated package.json');

const serverRoutesSupportJsPath = path.join(projectRoot, 'server', 'routes', 'supportRoutes.js');
if (fs.existsSync(serverRoutesSupportJsPath)) {
    let content = fs.readFileSync(serverRoutesSupportJsPath, 'utf8');
    content = content.replace(/(currentAppVersion:\s*['"])[^'"]+(['"])/g, `$1${newVersion}$2`);
    fs.writeFileSync(serverRoutesSupportJsPath, content, 'utf8');
    console.log('[OK] Updated server/routes/supportRoutes.js');
}

const serverMainJsPath = path.join(projectRoot, 'server', 'main.js');
if (fs.existsSync(serverMainJsPath)) {
    let content = fs.readFileSync(serverMainJsPath, 'utf8');
    content = content.replace(/(currentAppVersion:\s*['"])[^'"]+(['"])/g, `$1${newVersion}$2`);
    fs.writeFileSync(serverMainJsPath, content, 'utf8');
    console.log('[OK] Updated server/main.js');
}

const stateJsPath = path.join(projectRoot, 'js', 'core', 'state.js');
if (fs.existsSync(stateJsPath)) {
    let content = fs.readFileSync(stateJsPath, 'utf8');
    content = content.replace(/(appVersion:\s*(?:\(typeof window !== ['"]undefined['"] \? window\.__ENV__\?\.APP_VERSION : null\) \|\|\s*)?['"])[^'"]+(['"])/g, `$1${newVersion}$2`);
    fs.writeFileSync(stateJsPath, content, 'utf8');
    console.log('[OK] Updated js/core/state.js');
}

const appJsPath = path.join(projectRoot, 'js', 'app.js');
if (fs.existsSync(appJsPath)) {
    let content = fs.readFileSync(appJsPath, 'utf8');
    content = content.replace(/(settings\.appVersion\s*=\s*window\.__ENV__\?\.APP_VERSION\s*\|\|\s*['"])[^'"]+(['"])/g, `$1${newVersion}$2`);
    content = content.replace(/(cleanAppSettings\.appVersion\s*=\s*['"])[^'"]+(['"])/g, `$1${newVersion}$2`);
    fs.writeFileSync(appJsPath, content, 'utf8');
    console.log('[OK] Updated js/app.js');
}

const appSettingsDisplayPath = path.join(projectRoot, 'js', 'components', 'appSettings', 'appSettingsDisplay.js');
if (fs.existsSync(appSettingsDisplayPath)) {
    let content = fs.readFileSync(appSettingsDisplayPath, 'utf8');
    content = content.replace(/(const versionText = window\.__ENV__\?\.APP_VERSION\s*\|\|\s*state\.appVersion\s*\|\|\s*['"])[^'"]+(['"])/g, `$1${newVersion}$2`);
    fs.writeFileSync(appSettingsDisplayPath, content, 'utf8');
    console.log('[OK] Updated js/components/appSettings/appSettingsDisplay.js');
}

const appSettingsInputsPath = path.join(projectRoot, 'js', 'components', 'appSettings', 'appSettingsInputs.js');
if (fs.existsSync(appSettingsInputsPath)) {
    let content = fs.readFileSync(appSettingsInputsPath, 'utf8');
    content = content.replace(/(appVersionDisplay\.textContent = ['"]v['"] \+ \(window\.__ENV__\?\.APP_VERSION\s*\|\|\s*state\.appVersion\s*\|\|\s*['"])[^'"]+(['"]\)\.replace)/g, `$1${newVersion}$2`);
    fs.writeFileSync(appSettingsInputsPath, content, 'utf8');
    console.log('[OK] Updated js/components/appSettings/appSettingsInputs.js');
}

const appFooterPath = path.join(projectRoot, 'js', 'components', 'common', 'appFooter.js');
if (fs.existsSync(appFooterPath)) {
    let content = fs.readFileSync(appFooterPath, 'utf8');
    content = content.replace(/(options\.version\s*\|\|\s*['"])[^'"]+(['"])/g, `$1${newVersion}$2`);
    fs.writeFileSync(appFooterPath, content, 'utf8');
    console.log('[OK] Updated js/components/common/appFooter.js');
}

const localStorageManagerPath = path.join(projectRoot, 'js', 'core', 'localStorageManager.js');
if (fs.existsSync(localStorageManagerPath)) {
    let content = fs.readFileSync(localStorageManagerPath, 'utf8');
    content = content.replace(/(appVersion:\s*state\.appVersion\s*\|\|\s*['"])[^'"]+(['"])/g, `$1${newVersion}$2`);
    content = content.replace(/(appSettings\.appVersion\s*=\s*['"])[^'"]+(['"])/g, `$1${newVersion}$2`);
    fs.writeFileSync(localStorageManagerPath, content, 'utf8');
    console.log('[OK] Updated js/core/localStorageManager.js');
}

const authClientServicePath = path.join(projectRoot, 'js', 'services', 'authClientService.js');
if (fs.existsSync(authClientServicePath)) {
    let content = fs.readFileSync(authClientServicePath, 'utf8');
    content = content.replace(/(appVersion:\s*rawSettings\.appVersion\s*\|\|\s*['"])[^'"]+(['"])/g, `$1${newVersion}$2`);
    fs.writeFileSync(authClientServicePath, content, 'utf8');
    console.log('[OK] Updated js/services/authClientService.js');
}

console.log(`\nSuccessfully bumped all files to version ${newVersion}!`);

console.log('\nRecommended Release Commands:');
console.log(`  git add -A`);
console.log(`  git commit -m "chore(release): bump version to ${newVersion}"`);
console.log(`  git tag -a v${newVersion} -m "Release v${newVersion}"`);
console.log(`  git push origin main --tags\n`);
