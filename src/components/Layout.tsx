
import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';

interface HeaderProps {
    dateDisplay: string;
}

export function Header({ dateDisplay }: HeaderProps) {
    return (
        <Box justifyContent="center" flexDirection="column" alignItems="center">
            <Text bold color="cyan">🏀 NBA BATTLE MAP 🏀</Text>
            <Box>
                <Text color="cyan" bold>◀ </Text>
                <Text bold color="yellow"> 📅 {dateDisplay} </Text>
                <Text color="cyan" bold> ▶</Text>
            </Box>
        </Box>
    );
}

interface FooterProps {
    connected: boolean;
    loading: boolean;
    gamesCount: number;
    warning?: string | null;
    termWidth?: number;
    SpinnerComponent?: React.ComponentType<any>;
}

export function Footer({ connected, loading, gamesCount, warning, termWidth = 100, SpinnerComponent }: FooterProps) {
    const ActiveSpinner = SpinnerComponent || Spinner;

    // Determine connection status display
    const getConnectionStatus = () => {
        if (loading && !connected) {
            // Still initializing - show connecting state
            return (
                <Box>
                    <Text color="yellow">● Connecting </Text>
                    <Text color="yellow"><ActiveSpinner type="dots" /></Text>
                </Box>
            );
        } else if (connected) {
            return <Text color="green">● Connected</Text>;
        } else {
            return <Text color="red">● Disconnected</Text>;
        }
    };

    // Compact hints based on terminal width to prevent line wrapping and screen jitter
    const isNarrow = termWidth < 105;
    const isMedium = termWidth >= 105 && termWidth < 125;

    const controlsHint = isNarrow
        ? `${gamesCount}G • ←/→ Date • ↑/↓ Select • s Standings • z Clutch`
        : isMedium
            ? `${gamesCount}G • ←/→ Date • ↑/↓ Select • / Search • s Standings • z Clutch`
            : `${gamesCount} Games • ←/→: Date | ↑/↓: Select | z: Clutch | s: Standings | /: Search`;

    const actionsHint = isNarrow
        ? `Enter Detail • r Refresh • q Quit`
        : isMedium
            ? `Enter Detail • r Refresh • q Quit`
            : `Enter: Detail | r: Refresh | q: Quit`;

    const displayWarning = warning ? (warning.length > 24 ? warning.slice(0, 21) + '...' : warning) : null;

    return (
        <Box width="100%" height={1} justifyContent="space-between" paddingX={1} marginTop={1} flexWrap="nowrap">
            <Box flexShrink={0}>
                {getConnectionStatus()}
                {loading && connected && (
                    <Box marginLeft={1}>
                        <Text color="yellow"><ActiveSpinner type="dots" /></Text>
                    </Box>
                )}
                {!loading && displayWarning && <Text color="yellow"> ⚠ {displayWarning}</Text>}
            </Box>
            <Text dimColor wrap="truncate">{controlsHint}</Text>
            <Text dimColor wrap="truncate">{actionsHint}</Text>
        </Box>
    );
}
