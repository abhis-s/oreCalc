const { exec } = require('child_process');

const command = 'sass --watch css/main.scss:css/main.css legal/legal.scss:legal/legal.css';

const child = exec(command);

child.stdout.on('data', (data) => {
    console.log(`[Sass] ${data.toString().trim()}`);
});

child.stderr.on('data', (data) => {
    console.error(`[Sass ERROR] ${data.toString().trim()}`);
});

child.on('close', (code) => {
    console.log(`[Sass] Watch process exited with code ${code}`);
});
