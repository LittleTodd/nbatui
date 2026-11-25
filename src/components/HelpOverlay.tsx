import React from 'react';
import { Box, Text, useInput } from 'ink';

interface HelpOverlayProps {
    onClose: () => void;
}

export function HelpOverlay({ onClose }: HelpOverlayProps) {
    useInput((input, key) => {
        if (key.escape || input === '?' || input === 'q') {
            onClose();
        }
    });

    return (
        <Box
            flexDirection="column"
            borderStyle="double"
            borderColor="cyan"
            paddingX={2}
            paddingY={1}
            width={64}
            alignSelf="center"
        >
            <Box justifyContent="space-between" marginBottom={1}>
                <Text bold color="cyan">🏀 NBA-TUI KEYBINDINGS & HELP</Text>
                <Text dimColor>[Esc / ?] Close</Text>
            </Box>

            <Box flexDirection="column" marginBottom={1}>
                <Text bold color="yellow">Navigation (Map & List)</Text>
                <Text>  <Text color="cyan" bold>↑/↓</Text> or <Text color="cyan" bold>k/j</Text>         Select game</Text>
                <Text>  <Text color="cyan" bold>←/→</Text> or <Text color="cyan" bold>h/l</Text>         Previous / Next day</Text>
                <Text>  <Text color="cyan" bold>t</Text>                  Jump to Today</Text>
                <Text>  <Text color="cyan" bold>Enter</Text>              Open Game Detail</Text>
                <Text>  <Text color="cyan" bold>/</Text>                  Search by team code, city, or name</Text>
            </Box>

            <Box flexDirection="column" marginBottom={1}>
                <Text bold color="yellow">Views & Modes</Text>
                <Text>  <Text color="cyan" bold>m</Text>                  Toggle US Map / Scoreboard List</Text>
                <Text>  <Text color="cyan" bold>s</Text>                  Standings & Polymarket Props</Text>
                <Text>  <Text color="cyan" bold>z</Text>                  RedZone: Jump to highest-leverage live game</Text>
                <Text>  <Text color="cyan" bold>x</Text>                  Toggle Spoiler-Free Mode (hide scores)</Text>
                <Text>  <Text color="cyan" bold>r</Text>                  Refresh current slate</Text>
                <Text>  <Text color="cyan" bold>q</Text> / <Text color="cyan" bold>Ctrl+C</Text>         Quit (Esc only closes overlays)</Text>
            </Box>

            <Box flexDirection="column">
                <Text bold color="yellow">Inside Game Detail</Text>
                <Text>  <Text color="cyan" bold>1-4</Text> / <Text color="cyan" bold>Tab</Text>          Box Score / Lineups / Stream / Lead Tracker</Text>
                <Text>  <Text color="cyan" bold>[</Text> / <Text color="cyan" bold>]</Text>              Switch to Previous / Next game</Text>
                <Text>  <Text color="cyan" bold>c</Text> / <Text color="cyan" bold>d</Text> / <Text color="cyan" bold>v</Text>          BrailleCourt™ / Superstar Duel / Player Card</Text>
                <Text>  <Text color="cyan" bold>Ctrl+U</Text> / <Text color="cyan" bold>Ctrl+D</Text>    Page Up / Page Down in Play-by-Play</Text>
            </Box>
        </Box>
    );
}
