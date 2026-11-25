/**
 * Terminal ANSI Escape Utilities
 * - OSC 0: Update terminal window / tab title
 * - OSC 52: Copy text directly into system clipboard
 */

const MAX_OSC52_BYTES = 74994; // ~100KB base64 limit across terminals

/**
 * Strip C0/C1 control characters (including ESC, BEL, CR, LF) to prevent
 * terminal escape sequence injection when interpolating API-sourced strings.
 */
function sanitizeTitle(title: string): string {
    return title.replace(/[\x00-\x1f\x7f-\x9f]/g, ' ').trim().slice(0, 120);
}

/**
 * Set the terminal window or tab title using ANSI OSC 0 sequence
 */
export function setTerminalTitle(title: string): void {
    if (process.stdout && process.stdout.isTTY) {
        const safe = sanitizeTitle(title);
        process.stdout.write(`\x1b]0;${safe}\x07`);
    }
}

/**
 * Clear/reset the terminal window or tab title on exit
 */
export function resetTerminalTitle(): void {
    if (process.stdout && process.stdout.isTTY) {
        process.stdout.write('\x1b]0;\x07');
    }
}

/**
 * Copy text to system clipboard using ANSI OSC 52 escape sequence.
 * Supports tmux and GNU screen via DCS passthrough wrapping.
 */
export function copyToClipboardOSC52(text: string): boolean {
    try {
        if (!process.stdout || !process.stdout.isTTY) return false;
        const buf = Buffer.from(text, 'utf8');
        if (buf.byteLength > MAX_OSC52_BYTES) return false;

        const base64 = buf.toString('base64');
        let seq = `\x1b]52;c;${base64}\x07`;

        if (process.env.TMUX) {
            // tmux DCS passthrough: double inner ESC bytes
            seq = `\x1bPtmux;\x1b${seq}\x1b\\`;
        } else if (process.env.STY) {
            // GNU screen DCS passthrough
            seq = `\x1bP${seq}\x1b\\`;
        }

        process.stdout.write(seq);
        return true;
    } catch {
        return false;
    }
}
