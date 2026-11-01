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

// Parse command line arguments for target filtering
const args = process.argv.slice(2);
let targetFilter = null;
const passthroughFlags = [];

for (const arg of args) {
    if (arg.startsWith('--filter=')) {
        targetFilter = arg.slice(9).trim();
    } else if (arg.startsWith('-f=')) {
        targetFilter = arg.slice(3).trim();
    } else if (arg.startsWith('--filter') || arg === '-f') {
        const nextIdx = args.indexOf(arg) + 1;
        if (nextIdx < args.length) {
            targetFilter = args[nextIdx].trim();
        }
    } else if (!arg.startsWith('-')) {
        targetFilter = arg.trim();
    } else {
        passthroughFlags.push(arg);
    }
}

let testsToRun = allTests;
if (targetFilter) {
    const filterLower = targetFilter.toLowerCase();
    testsToRun = allTests.filter(testPath => {
        const normalized = testPath.replace(/\\/g, '/').toLowerCase();
        return normalized.includes(filterLower);
    });

    if (testsToRun.length === 0) {
        console.error(`[Test Runner] No test files matched filter: "${targetFilter}"`);
        process.exit(1);
    }

    console.log(`[Test Runner] Running ${testsToRun.length} of ${allTests.length} test suite(s) matching "${targetFilter}":`);
    for (const file of testsToRun) {
        console.log(`  - ${path.relative(path.join(__dirname, '..'), file)}`);
    }
}

const result = spawnSync(process.execPath, ['--test', ...passthroughFlags, ...testsToRun], {
    stdio: 'inherit'
});

process.exit(result.status ?? 1);
