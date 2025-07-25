const { exec } = require('child_process');

const command = 'sass --watch css/main.scss css/main.css';

const child = exec(command);

child.stdout.on('data', (data) => {
    console.log(`Sass: ${data}`);
});

child.stderr.on('data', (data) => {
    console.error(`Sass Error: ${data}`);
});

child.on('close', (code) => {
    console.log(`Sass process exited with code ${code}`);
});
