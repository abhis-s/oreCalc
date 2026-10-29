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

const serverPackageJsonPath = path.join(projectRoot, 'server', 'package.json');
if (fs.existsSync(serverPackageJsonPath)) {
    try {
        const serverPackageJson = JSON.parse(fs.readFileSync(serverPackageJsonPath, 'utf8'));
        serverPackageJson.version = newVersion;
        fs.writeFileSync(serverPackageJsonPath, JSON.stringify(serverPackageJson, null, 2) + '\n', 'utf8');
        console.log('[OK] Updated server/package.json');
    } catch (e) {
        console.warn('[WARN] Failed to update server/package.json:', e);
    }
}

console.log(`\nSuccessfully bumped version to ${newVersion}!`);

console.log('\nRecommended Release Commands:');
console.log(`  git add -A`);
console.log(`  git commit -m "chore(release): bump version to ${newVersion}"`);
console.log(`  git tag -a v${newVersion} -m "Release v${newVersion}"`);
console.log(`  git push origin main --tags\n`);
