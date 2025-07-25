const fs = require('fs');
const path = require('path');

// Read VITE_API_BASE_URL from command line arguments
const args = process.argv.slice(2);
let baseUrl = null;
for (let i = 0; i < args.length; i++) {
    if (args[i] === '--api-url' && args[i + 1]) {
        baseUrl = args[i + 1];
        break;
    }
}

if (!baseUrl) {
    console.error('Error: --api-url argument is missing or empty.');
    process.exit(1);
}

const apiServicePath = path.join(process.cwd(), 'js/services/apiService.js');

let apiServiceContent = fs.readFileSync(apiServicePath, 'utf8');

// Replace the placeholder
apiServiceContent = apiServiceContent.replace('__VITE_API_BASE_URL__', baseUrl);

fs.writeFileSync(apiServicePath, apiServiceContent, 'utf8');
console.log(`Injected VITE_API_BASE_URL: ${baseUrl} into ${apiServicePath}`);
