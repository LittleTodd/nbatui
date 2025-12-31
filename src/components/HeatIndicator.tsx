import { Text } from 'ink';

export type HeatLevel = 'cold' | 'warm' | 'hot' | 'fire';

interface HeatIndicatorProps {
    level: HeatLevel;
    count: number;
    compact?: boolean;
}

export function HeatIndicator({ level, count, compact = false }: HeatIndicatorProps) {
    if (level === 'cold') {
        if (compact) return null; // Don't show cold in compact mode
        return <Text dimColor>❄️ {count}</Text>;
    }

    if (level === 'warm') {
        return <Text color="yellow">🌡️ {count}</Text>;
    }

    if (level === 'hot') {
        return <Text color="orange">🔥 {count}</Text>;
    }

    if (level === 'fire') {
        // Blinking effect for super hot games
        return <Text color="red" bold>🌋 {count}</Text>;
    }

    return null;
}
