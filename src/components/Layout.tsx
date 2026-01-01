
import React from 'react';
import { Box, Text } from 'ink';

interface HeaderProps {
    dateDisplay: string;
}

export function Header({ dateDisplay }: HeaderProps) {
    return (
        <Box justifyContent="center" flexDirection="column" alignItems="center">
            <Text bold color="cyan">🏀 NBA BATTLE MAP 🏀</Text>
            <Text bold color="yellow">📅 {dateDisplay} 📅</Text>
        </Box>
    );
}

interface FooterProps {
    connected: boolean;
    loading: boolean;
    gamesCount: number;
    SpinnerComponent: React.ComponentType<any>; // Using any to avoid complex type matching for ink-spinner
}

export function Footer({ connected, loading, gamesCount, SpinnerComponent }: FooterProps) {
    return (
        <Box justifyContent="space-between" paddingX={1} marginTop={1}>
            <Box>
                <Text color={connected ? 'green' : 'red'}>
                    {connected ? '● Connected' : '● Disconnected'}
                </Text>
                {loading && <Text color="yellow"> <SpinnerComponent type="dots" /></Text>}
            </Box>
            <Text dimColor>{gamesCount} games • ←/→: date | ↑/↓: select | s: standings | Enter: detail</Text>
            <Text dimColor>r: refresh | q: quit</Text>
        </Box>
    );
}
