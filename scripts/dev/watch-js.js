const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const jsDir = path.join(process.cwd(), 'js');
const verbose = process.env.VERBOSE === 'true';

console.log('[JS Watcher] Monitoring javascript files for syntax errors...');

/**
 * Spawns a background process using `node --check` to quickly validate the javascript syntax
 * of the target file. Useful in development when transpilers are not used.
 *
 * @param {string} filePath - Absolute path to the JavaScript file to validate.
 */
function checkSyntax(filePath) {
    exec(`node --check "${filePath}"`, (error, stdout, stderr) => {
        const relativePath = path.relative(process.cwd(), filePath);
        if (error) {
            console.error(`\x1b[31m[JS Error] Syntax check failed for ${relativePath}:\x1b[0m`);
            console.error(stderr || error.message);
        } else {
            if (verbose) {
                console.log(`\x1b[32m[JS OK] ${relativePath}\x1b[0m`);
            }
        }
    });
}

// Watch the javascript directory recursively and run the checkSyntax tool on any updated file.
if (fs.existsSync(jsDir)) {
    fs.watch(jsDir, { recursive: true }, (eventType, filename) => {
        if (filename && filename.endsWith('.js')) {
            const filePath = path.join(jsDir, filename);
            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                checkSyntax(filePath);
            }
        }
    });
}
