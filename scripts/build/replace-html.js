const { replaceInFile } = require('replace-in-file');
const path = require('path');

const filePath = path.join(__dirname, '../../dist/index.html');

async function replaceHtml() {
    try {
        const results = await replaceInFile({
            files: filePath,
            from: 'css/main.css',
            to: 'css/main.min.css',
        });
        console.log('Replacement results for index.html:', results);
    } catch (error) {
        console.error('Error replacing in index.html:', error);
        process.exit(1);
    }
}

replaceHtml();