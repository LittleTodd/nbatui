/**
 * Terminal ANSI Escape Utilities
 * - OSC 0: Update terminal window / tab title
 * - OSC 52: Copy text directly into system clipboard
 */

/**
 * Set the terminal window or tab title using ANSI OSC 0 sequence
 */
export function setTerminalTitle(title: string): void {
    if (process.stdout && process.stdout.isTTY) {
        process.stdout.write(`\x1b]0;${title}\x07`);
    }
}

/**
 * Copy text to system clipboard using ANSI OSC 52 escape sequence.
 * Works natively in iTerm2, Kitty, WezTerm, Alacritty, Ghostty, Windows Terminal, tmux, etc.
 */
export function copyToClipboardOSC52(text: string): boolean {
    try {
        const base64 = Buffer.from(text).toString('base64');
        const osc52 = `\x1b]52;c;${base64}\x07`;
        if (process.stdout && process.stdout.isTTY) {
            process.stdout.write(osc52);
            return true;
        }
    } catch {
        // fallback
    }
    return false;
}
