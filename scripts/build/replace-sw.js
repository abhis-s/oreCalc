const { replaceInFile } = require('replace-in-file');
const path = require('path');

const filePath = path.join(__dirname, '../../dist/service-worker.js');

async function replaceSw() {
    try {
        const results = await replaceInFile({
            files: filePath,
            from: '/css/main.css',
            to: '/css/main.min.css',
        });
        console.log('Replacement results for service-worker.js:', results);
    } catch (error) {
        console.error('Error replacing in service-worker.js:', error);
        process.exit(1);
    }
}

replaceSw();
