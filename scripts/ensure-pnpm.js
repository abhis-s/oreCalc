/**
 * scripts/ensure-pnpm.js
 * Strictly blocks npm and yarn invocations across all scripts and lifecycle hooks.
 */

const userAgent = process.env.npm_config_user_agent || '';
const execPath = process.env.npm_execpath || '';
const isPnpm = userAgent.includes('pnpm') || execPath.includes('pnpm') || !!process.env.PNPM_SCRIPT_SRC_DIR;

if (!isPnpm) {
    console.error('\n\x1b[41m\x1b[37m\x1b[1m [ERROR] This project strictly mandates PNPM. \x1b[0m');
    console.error('\x1b[31mDirect use of npm or yarn is blocked to preserve lockfile and environment integrity.\x1b[0m');
    const command = process.env.npm_lifecycle_event || 'install';
    const suggestion = command === 'install' ? 'pnpm install' : `pnpm ${command}`;
    console.error(`\x1b[33mPlease run:\x1b[0m \x1b[1m\x1b[32m${suggestion}\x1b[0m\n`);
    process.exit(1);
}
