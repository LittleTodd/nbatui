
import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';

interface HeaderProps {
    dateDisplay: string;
    spoilerFree?: boolean;
    tzLabel?: string;
}

export function Header({ dateDisplay, spoilerFree = false, tzLabel }: HeaderProps) {
    return (
        <Box justifyContent="center" flexDirection="column" alignItems="center">
            <Box>
                <Text bold color="cyan">🏀 NBA BATTLE MAP 🏀</Text>
                {spoilerFree && (
                    <Text bold backgroundColor="magenta" color="white"> SPOILER-FREE </Text>
                )}
            </Box>
            <Box>
                <Text color="cyan" bold>◀ </Text>
                <Text bold color="yellow"> 📅 {dateDisplay}{tzLabel ? ` (${tzLabel})` : ''} </Text>
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
    lastUpdated?: Date;
    viewMode?: 'map' | 'list';
    spoilerFree?: boolean;
    SpinnerComponent?: React.ComponentType<any>;
}

export function Footer({
    connected,
    loading,
    gamesCount,
    warning,
    termWidth = 100,
    lastUpdated,
    viewMode = 'map',
    spoilerFree = false,
    SpinnerComponent
}: FooterProps) {
    const ActiveSpinner = SpinnerComponent || Spinner;

    const getConnectionStatus = () => {
        if (loading && !connected) {
            return (
                <Box>
                    <Text color="yellow">● Connecting </Text>
                    <Text color="yellow"><ActiveSpinner type="dots" /></Text>
                </Box>
            );
        } else if (connected) {
            const ageSec = lastUpdated ? Math.max(0, Math.floor((Date.now() - lastUpdated.getTime()) / 1000)) : null;
            const freshness = ageSec !== null && ageSec >= 5 ? ` (${ageSec}s ago)` : '';
            return <Text color="green">● Live{freshness}</Text>;
        } else {
            return <Text color="red">● Disconnected ([r] Retry)</Text>;
        }
    };

    const isNarrow = termWidth < 105;
    const isMedium = termWidth >= 105 && termWidth < 130;
    const viewToggleLabel = viewMode === 'map' ? 'm List' : 'm Map';

    const controlsHint = isNarrow
        ? `${gamesCount}G • ←→ Date • ↑↓ Sel • ${viewToggleLabel} • ? Help`
        : isMedium
            ? `${gamesCount}G • ←→ Date • ↑↓ Sel • ${viewToggleLabel} • / Search • s Standings • ? Help`
            : `${gamesCount} Games • ←/→ Date | ↑/↓ Select | ${viewToggleLabel} | s Standings | z Clutch | x ${spoilerFree ? 'Show' : 'Hide'} | / Search | ? Help`;

    const actionsHint = isNarrow
        ? `Enter • q Quit`
        : `Enter: Detail | r: Refresh | q: Quit`;

    const displayWarning = warning ? (warning.length > 26 ? warning.slice(0, 23) + '...' : warning) : null;

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
