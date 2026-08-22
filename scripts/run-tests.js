const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function findTestFiles(dir) {
    if (!fs.existsSync(dir)) return [];
    const files = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...findTestFiles(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.test.js')) {
            files.push(fullPath);
        }
    }
    return files;
}

const permanentTests = [
    ...findTestFiles(path.join(__dirname, '../tests/domain')),
    ...findTestFiles(path.join(__dirname, '../tests/core')),
    ...findTestFiles(path.join(__dirname, '../server/tests'))
];

const tempTests = findTestFiles(path.join(__dirname, '../tests/temp'));

if (tempTests.length > 0) {
    console.log(`[Test Runner] Detected ${tempTests.length} active scratchpad test(s) in tests/temp/`);
}

const allTests = [...permanentTests, ...tempTests];

if (allTests.length === 0) {
    console.error('[Test Runner] No test files found.');
    process.exit(1);
}

const result = spawnSync(process.execPath, ['--test', ...allTests], {
    stdio: 'inherit'
});

process.exit(result.status ?? 1);
