import { useState, useEffect } from 'react';

export interface TerminalSize {
    columns: number;
    rows: number;
}

/**
 * Reactive terminal dimensions hook that subscribes to stdout 'resize' events.
 */
export function useTerminalSize(): TerminalSize {
    const [size, setSize] = useState<TerminalSize>(() => ({
        columns: process.stdout?.columns || 100,
        rows: process.stdout?.rows || 30,
    }));

    useEffect(() => {
        const stdout = process.stdout;
        if (!stdout) return;

        const onResize = () => {
            setSize({
                columns: stdout.columns || 100,
                rows: stdout.rows || 30,
            });
        };

        stdout.on('resize', onResize);
        return () => {
            stdout.off('resize', onResize);
        };
    }, []);

    return size;
}
