#!/usr/bin/env node
/**
 * NBA-TUI Cross-Platform Launcher
 * Works on macOS, Linux, and Windows
 */

import { spawn, execSync, exec } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { platform } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

// Colors for terminal output
const colors = {
    reset: '\x1b[0m',
    yellow: '\x1b[33m',
    green: '\x1b[32m',
    cyan: '\x1b[36m',
    red: '\x1b[31m',
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

// Get current terminal size
function getTerminalSize() {
    return {
        cols: process.stdout.columns || 80,
        rows: process.stdout.rows || 24,
    };
}

// Try to resize terminal window based on platform
async function resizeTerminal(minRows = 40, minCols = 100) {
    const { rows, cols } = getTerminalSize();

    if (rows >= minRows && cols >= minCols) {
        return true; // Already big enough
    }

    log(`Terminal too small (${cols}x${rows}), attempting to resize...`, 'yellow');

    const os = platform();

    try {
        if (os === 'darwin') {
            // macOS: Use AppleScript
            const termProgram = process.env.TERM_PROGRAM || '';

            if (termProgram === 'Apple_Terminal') {
                execSync(`osascript -e 'tell application "Terminal" to set bounds of front window to {100, 100, 1000, 800}'`, { stdio: 'ignore' });
            } else if (termProgram === 'iTerm.app') {
                execSync(`osascript -e 'tell application "iTerm2" to tell current window to set bounds to {100, 100, 1000, 800}'`, { stdio: 'ignore' });
            } else {
                // Try ANSI escape sequence as fallback
                process.stdout.write(`\x1b[8;${minRows};${minCols}t`);
            }
        } else if (os === 'linux') {
            // Linux: Try xdotool first, then ANSI escape
            try {
                execSync('which xdotool', { stdio: 'ignore' });
                execSync(`xdotool getactivewindow windowsize 1000 800`, { stdio: 'ignore' });
            } catch {
                // Fallback to ANSI escape sequence
                process.stdout.write(`\x1b[8;${minRows};${minCols}t`);
            }
        } else if (os === 'win32') {
            // Windows: Use PowerShell or mode command
            try {
                execSync(`mode con: cols=${minCols} lines=${minRows}`, { stdio: 'ignore' });
            } catch {
                // Try PowerShell
                execSync(`powershell -command "$host.UI.RawUI.WindowSize = New-Object System.Management.Automation.Host.Size(${minCols}, ${minRows})"`, { stdio: 'ignore' });
            }
        }

        // Wait for resize to take effect
        await sleep(500);

        const newSize = getTerminalSize();
        if (newSize.rows >= minRows) {
            log(`Resized to ${newSize.cols}x${newSize.rows}`, 'green');
            return true;
        }
    } catch (e) {
        // Resize failed, continue anyway
    }

    return false;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Get Python command based on platform
function getPythonCommand() {
    const os = platform();
    if (os === 'win32') {
        return 'python';
    }
    return 'python3';
}

// Get venv activation path based on platform
function getVenvPaths() {
    const os = platform();
    const venvDir = join(PROJECT_ROOT, 'data-service', 'venv');

    if (os === 'win32') {
        return {
            python: join(venvDir, 'Scripts', 'python.exe'),
            pip: join(venvDir, 'Scripts', 'pip.exe'),
            activate: join(venvDir, 'Scripts', 'activate.bat'),
        };
    }
    return {
        python: join(venvDir, 'bin', 'python'),
        pip: join(venvDir, 'bin', 'pip'),
        activate: join(venvDir, 'bin', 'activate'),
    };
}

// Setup Python virtual environment
async function setupPythonEnv() {
    const venvDir = join(PROJECT_ROOT, 'data-service', 'venv');
    const venv = getVenvPaths();

    if (!existsSync(venvDir)) {
        log('Creating Python virtual environment...', 'yellow');
        const pythonCmd = getPythonCommand();
        execSync(`${pythonCmd} -m venv "${venvDir}"`, {
            cwd: join(PROJECT_ROOT, 'data-service'),
            stdio: 'inherit'
        });
    }

    // Install requirements
    const requirementsFile = join(PROJECT_ROOT, 'data-service', 'requirements.txt');
    if (existsSync(requirementsFile)) {
        log('Installing Python dependencies...', 'yellow');
        execSync(`"${venv.pip}" install -q -r requirements.txt`, {
            cwd: join(PROJECT_ROOT, 'data-service'),
            stdio: 'ignore'
        });
    }

    // Install ascii-animator for loading animation
    try {
        execSync(`"${venv.pip}" install -q ascii-animator`, {
            cwd: join(PROJECT_ROOT, 'data-service'),
            stdio: 'ignore'
        });
    } catch {
        // Not critical if it fails
    }

    return venv;
}

// Kill process on port
function killProcessOnPort(port) {
    const os = platform();
    try {
        if (os === 'win32') {
            execSync(`for /f "tokens=5" %a in ('netstat -aon ^| find ":${port}"') do taskkill /F /PID %a`, {
                stdio: 'ignore',
                shell: 'cmd.exe'
            });
        } else {
            execSync(`lsof -ti:${port} | xargs kill -9`, { stdio: 'ignore' });
        }
    } catch {
        // No process on port, that's fine
    }
}

// Start backend server
function startBackend(venv) {
    log('Starting backend server...', 'yellow');

    killProcessOnPort(8765);

    const backendProcess = spawn(venv.python, ['main.py'], {
        cwd: join(PROJECT_ROOT, 'data-service'),
        stdio: 'ignore',
        detached: true,
    });

    backendProcess.unref();
    return backendProcess;
}

// Wait for backend to be ready
async function waitForBackend(timeout = 30000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        try {
            const response = await fetch('http://localhost:8765/health');
            if (response.ok) {
                return true;
            }
        } catch {
            // Not ready yet
        }
        await sleep(500);
    }

    return false;
}

// Show simple loading animation
async function showLoading() {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;

    const interval = setInterval(() => {
        process.stdout.write(`\r${colors.cyan}${frames[i]} Loading NBA TUI...${colors.reset}`);
        i = (i + 1) % frames.length;
    }, 100);

    return () => {
        clearInterval(interval);
        process.stdout.write('\r\x1b[K'); // Clear line
    };
}

// Prefetch data
async function prefetchData() {
    try {
        await Promise.all([
            fetch('http://localhost:8765/games/today').catch(() => { }),
            fetch('http://localhost:8765/api/polymarket/odds').catch(() => { }),
            fetch('http://localhost:8765/games/standings').catch(() => { }),
        ]);
    } catch {
        // Non-critical
    }
}

// Start TUI
function startTUI() {
    const os = platform();

    // Try bun first, then npx
    let command, args;

    try {
        if (os === 'win32') {
            execSync('where bun', { stdio: 'ignore' });
        } else {
            execSync('which bun', { stdio: 'ignore' });
        }
        command = 'bun';
        args = ['run', 'start'];
    } catch {
        command = 'npx';
        args = ['bun', 'run', 'start'];
    }

    const tuiProcess = spawn(command, args, {
        cwd: PROJECT_ROOT,
        stdio: 'inherit',
    });

    return tuiProcess;
}

// Main entry point
async function main() {
    log('🏀 NBA TUI Launcher', 'cyan');
    log('Initializing...', 'yellow');

    // Step 1: Try to resize terminal
    await resizeTerminal(40, 100);

    // Step 2: Setup Python environment
    const venv = await setupPythonEnv();

    // Step 3: Start backend
    const backendProcess = startBackend(venv);

    // Step 4: Wait for backend with loading animation
    const stopLoading = await showLoading();
    const backendReady = await waitForBackend();
    stopLoading();

    if (!backendReady) {
        log('Failed to start backend server', 'red');
        process.exit(1);
    }

    // Step 5: Prefetch data
    await prefetchData();

    // Step 6: Clear screen and start TUI
    console.clear();
    log('✅ Ready! Starting TUI...', 'green');
    await sleep(500);

    const tuiProcess = startTUI();

    // Cleanup on exit
    const cleanup = () => {
        log('\n🛑 Shutting down...', 'yellow');
        try {
            if (!backendProcess.killed) {
                process.kill(-backendProcess.pid);
            }
        } catch {
            killProcessOnPort(8765);
        }
        process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    tuiProcess.on('exit', cleanup);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
