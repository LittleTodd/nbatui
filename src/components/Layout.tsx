
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
    warning?: string | null;
    SpinnerComponent: React.ComponentType<any>; // Using any to avoid complex type matching for ink-spinner
}

export function Footer({ connected, loading, gamesCount, warning, SpinnerComponent }: FooterProps) {
    // Determine connection status display
    const getConnectionStatus = () => {
        if (loading && !connected) {
            // Still initializing - show connecting state
            return (
                <Box>
                    <Text color="yellow">● Connecting</Text>
                    <Text color="yellow"> <SpinnerComponent type="dots" /></Text>
                </Box>
            );
        } else if (connected) {
            return <Text color="green">● Connected</Text>;
        } else {
            return <Text color="red">● Disconnected</Text>;
        }
    };

    return (
        <Box justifyContent="space-between" paddingX={1} marginTop={1}>
            <Box>
                {getConnectionStatus()}
                {loading && connected && <Text color="yellow"> <SpinnerComponent type="dots" /></Text>}
                {!loading && warning && <Text color="yellow"> ⚠ {warning}</Text>}
            </Box>
            <Text dimColor>{gamesCount} Games • ←/→: Date | ↑/↓: Select | /: Search | s: Standings</Text>
            <Text dimColor>Enter: Detail | r: Refresh | q: Quit</Text>
        </Box>
    );
}
