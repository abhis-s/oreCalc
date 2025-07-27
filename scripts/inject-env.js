const fs = require('fs');
const path = require('path');

// This script expects VITE_API_BASE_URL to be set in process.env
const baseUrl = process.env.VITE_API_BASE_URL;

if (!baseUrl) {
    console.error('Error: VITE_API_BASE_URL environment variable is not set.');
    process.exit(1);
}

const apiServicePath = path.join(process.cwd(), 'js/services/apiService.js');

let apiServiceContent = fs.readFileSync(apiServicePath, 'utf8');

// Replace the placeholder
apiServiceContent = apiServiceContent.replace('__VITE_API_BASE_URL__', baseUrl);

fs.writeFileSync(apiServicePath, apiServiceContent, 'utf8');
console.log(`Injected VITE_API_BASE_URL: ${baseUrl} into ${apiServicePath}`);