const fs = require('fs');
const path = require('path');

const baseUrl = process.env.VITE_API_BASE_URL;

if (!baseUrl) {
    console.error('Error: VITE_API_BASE_URL environment variable is not set.');
    process.exit(1);
}

const apiServicePath = path.join(process.cwd(), 'js/services/apiService.js');

let apiServiceContent = fs.readFileSync(apiServicePath, 'utf8');

// Use a global regex to replace all occurrences if necessary, though it should be once.
apiServiceContent = apiServiceContent.replace(/__VITE_API_BASE_URL__/g, baseUrl);

fs.writeFileSync(apiServicePath, apiServiceContent, 'utf8');
console.log(`Injected VITE_API_BASE_URL: ${baseUrl} into ${apiServicePath}`);
