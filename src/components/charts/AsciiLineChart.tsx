import React from 'react';
import { Text, Box } from 'ink';
// @ts-ignore
import asciichart from 'asciichart';

interface AsciiLineChartProps {
    data: number[];
    height?: number;
    colors?: string[];
    minY?: number; // Force minimum Y value for symmetric charts
    maxY?: number; // Force maximum Y value for symmetric charts
}

export const AsciiLineChart: React.FC<AsciiLineChartProps> = ({
    data,
    height = 10,
    colors = ['green'],
    minY,
    maxY
}) => {
    if (!data || data.length === 0) {
        return <Text>No data</Text>;
    }

    // Filter out any non-finite numbers
    const cleanData = data.filter(v => typeof v === 'number' && isFinite(v));

    if (cleanData.length < 2) {
        return <Text dimColor>Insufficient data points.</Text>;
    }

    const config: any = {
        height: height,
        colors: colors.map(c => (asciichart as any)[c] || (asciichart as any).green),
        format: (x: number) => {
            return Math.abs(x).toFixed(0).padStart(3);
        }
    };

    // Add min/max if provided to force Y-axis range
    if (minY !== undefined) config.min = minY;
    if (maxY !== undefined) config.max = maxY;

    let plot = '';
    try {
        plot = asciichart.plot(cleanData, config);
    } catch (e) {
        return <Text dimColor>Chart error.</Text>;
    }

    return (
        <Box flexDirection="column">
            <Text>{plot}</Text>
        </Box>
    );
};
