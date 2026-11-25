import React from 'react';
import { Text, Box } from 'ink';
import { blendColors, getLuminance } from '../../data/teamColors.js';

interface LeadTrackerChartProps {
    data: number[];  // Values centered around 0 (positive = team lead, negative = opponent lead)
    height?: number;
    teamColor?: string;
    oppColor?: string;
    teamLabel?: string;  // Team tricode (e.g., "HOU")
    oppLabel?: string;   // Opponent tricode (e.g., "ORL")
    width?: number;
    mode?: 'probability' | 'margin'; // 'probability' (0 = 50% win prob) or 'margin' (0 = tied score)
}

/**
 * Bidirectional chart with adaptive Y-axis scaling.
 * Supports both Win Probability offset mode (0 = 50%) and Score Margin mode (0 = tied).
 */
export const LeadTrackerChart: React.FC<LeadTrackerChartProps> = ({
    data,
    height = 11,
    teamColor = 'green',
    oppColor = 'red',
    teamLabel = 'TEAM',
    oppLabel = 'OPP',
    width = 50,
    mode = 'probability'
}) => {
    if (!data || data.length === 0) {
        return <Text dimColor>No data</Text>;
    }

    const cleanData = data.filter(v => typeof v === 'number' && isFinite(v));
    if (cleanData.length < 2) {
        return <Text dimColor>Insufficient data points.</Text>;
    }

    const dataMax = Math.max(...cleanData);
    const dataMin = Math.min(...cleanData);
    const dataRange = dataMax - dataMin;
    const crossesZero = dataMin < 0 && dataMax > 0;

    let displayMin: number;
    let displayMax: number;
    let showZeroLine: boolean;

    if (crossesZero) {
        const maxAbs = Math.max(Math.abs(dataMax), Math.abs(dataMin), mode === 'margin' ? 5 : 10);
        const niceMax = Math.ceil(maxAbs / 5) * 5;
        displayMin = -niceMax;
        displayMax = niceMax;
        showZeroLine = true;
    } else {
        const minPadding = 1;
        const roundTo = dataRange < 10 ? 1 : 5;

        displayMin = Math.floor((dataMin - minPadding) / roundTo) * roundTo;
        displayMax = Math.ceil((dataMax + minPadding) / roundTo) * roundTo;

        const minRange = 5;
        if (displayMax - displayMin < minRange) {
            const mid = (dataMin + dataMax) / 2;
            displayMin = Math.floor((mid - minRange / 2) / roundTo) * roundTo;
            displayMax = Math.ceil((mid + minRange / 2) / roundTo) * roundTo;
        }

        showZeroLine = displayMin <= 0 && displayMax >= 0;
    }

    const displayRange = Math.max(1, displayMax - displayMin);
    const chartHeight = height;

    let sampledData: number[] = [];
    if (cleanData.length <= width) {
        sampledData = [...cleanData];
    } else {
        const step = cleanData.length / width;
        for (let i = 0; i < width; i++) {
            const idx = Math.floor(i * step);
            const val = cleanData[idx];
            if (val !== undefined) sampledData.push(val);
        }
    }

    const valueToRow = (value: number): number => {
        const normalized = (displayMax - value) / displayRange;
        return Math.min(chartHeight - 1, Math.max(0, Math.round(normalized * (chartHeight - 1))));
    };

    const zeroRow = showZeroLine ? valueToRow(0) : -1;

    const grid: string[][] = [];
    const colorGrid: (string | undefined)[][] = [];

    for (let row = 0; row < chartHeight; row++) {
        grid.push([]);
        colorGrid.push([]);
        for (let col = 0; col < sampledData.length; col++) {
            grid[row]!.push(' ');
            colorGrid[row]!.push(undefined);
        }
    }

    const isTeamDominant = dataMax > 0 || (dataMax === 0 && dataMin >= 0);

    for (let col = 0; col < sampledData.length; col++) {
        const value = sampledData[col]!;
        const edgeRow = valueToRow(value);

        if (showZeroLine && zeroRow >= 0) {
            const blendedColor = blendColors(teamColor, oppColor);

            if (value > 0) {
                for (let row = edgeRow; row < zeroRow; row++) {
                    grid[row]![col] = '█';
                    colorGrid[row]![col] = teamColor;
                }
                grid[zeroRow]![col] = '█';
                colorGrid[zeroRow]![col] = blendedColor;
            } else if (value < 0) {
                grid[zeroRow]![col] = '█';
                colorGrid[zeroRow]![col] = blendedColor;
                for (let row = zeroRow + 1; row <= edgeRow; row++) {
                    grid[row]![col] = '█';
                    colorGrid[row]![col] = oppColor;
                }
            } else {
                grid[zeroRow]![col] = '█';
                colorGrid[zeroRow]![col] = blendedColor;
            }
        } else {
            const fillColor = isTeamDominant ? teamColor : oppColor;
            for (let row = edgeRow; row < chartHeight; row++) {
                grid[row]![col] = '█';
                colorGrid[row]![col] = fillColor;
            }
        }
    }

    const formatMargin = (v: number): string => {
        const rounded = Math.round(v);
        if (rounded === 0) return 'Tied';
        return rounded > 0 ? `${teamLabel} +${rounded}` : `${oppLabel} +${Math.abs(rounded)}`;
    };

    let topValStr: string;
    let botValStr: string;
    let topTeam: string;
    let botTeam: string;
    let topColor: string;
    let botColor: string;

    if (crossesZero) {
        const maxAbs = Math.max(Math.abs(displayMax), Math.abs(displayMin));
        topValStr = mode === 'margin' ? `+${maxAbs}` : `${50 + maxAbs}`;
        botValStr = mode === 'margin' ? `+${maxAbs}` : `${50 + maxAbs}`;
        topTeam = teamLabel;
        botTeam = oppLabel;
        topColor = teamColor;
        botColor = oppColor;
    } else {
        const dominantLabel = isTeamDominant ? teamLabel : oppLabel;
        const dominantColor = isTeamDominant ? teamColor : oppColor;
        if (mode === 'margin') {
            topValStr = isTeamDominant ? `+${Math.round(displayMax)}` : `+${Math.abs(Math.round(displayMin))}`;
            botValStr = isTeamDominant ? `+${Math.max(0, Math.round(displayMin))}` : `+${Math.max(0, Math.abs(Math.round(displayMax)))}`;
        } else {
            topValStr = `${Math.round(isTeamDominant ? 50 + displayMax : 50 - displayMin)}`;
            botValStr = `${Math.round(isTeamDominant ? 50 + displayMin : 50 - displayMax)}`;
        }
        topTeam = dominantLabel;
        botTeam = dominantLabel;
        topColor = dominantColor;
        botColor = dominantColor;
    }

    const currentVal = sampledData[sampledData.length - 1] || 0;
    const zeroAxisLabel = mode === 'margin' ? '  0 ─' : ' 50 ─';

    const getReadableColor = (color: string): string => {
        const luminance = getLuminance(color);
        if (luminance > 0.6) return '#555555';
        return color;
    };

    const highColor = getReadableColor(dataMax >= 0 ? teamColor : oppColor);
    const nowColor = getReadableColor(currentVal >= 0 ? teamColor : oppColor);
    const lowColor = getReadableColor(dataMin >= 0 ? teamColor : oppColor);

    return (
        <Box flexDirection="column">
            <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
                {/* Top label */}
                <Box>
                    <Text dimColor>{topValStr.padStart(3)}</Text>
                    <Text color={topColor}> {topTeam}</Text>
                </Box>

                {/* Chart rows */}
                {grid.map((row, rowIdx) => (
                    <Box key={rowIdx}>
                        <Text dimColor>
                            {rowIdx === zeroRow ? zeroAxisLabel : '    │'}
                        </Text>
                        {row.map((cell, colIdx) => (
                            <Text key={colIdx} color={colorGrid[rowIdx]![colIdx]}>
                                {cell}
                            </Text>
                        ))}
                    </Box>
                ))}

                {/* Bottom label */}
                <Box>
                    <Text dimColor>{botValStr.padStart(3)}</Text>
                    <Text color={botColor}> {botTeam}</Text>
                </Box>

                {/* Stats footer */}
                <Box justifyContent="space-around" marginTop={1}>
                    {mode === 'margin' ? (
                        <>
                            <Text>
                                <Text dimColor>Max {teamLabel}: </Text>
                                <Text bold color={highColor}>{formatMargin(dataMax)}</Text>
                            </Text>
                            <Text>
                                <Text dimColor>Now: </Text>
                                <Text bold color={nowColor}>{formatMargin(currentVal)}</Text>
                            </Text>
                            <Text>
                                <Text dimColor>Max {oppLabel}: </Text>
                                <Text bold color={lowColor}>{formatMargin(dataMin)}</Text>
                            </Text>
                        </>
                    ) : (
                        <>
                            <Text>
                                <Text dimColor>High: </Text>
                                <Text bold color={highColor}>{(dataMax + 50).toFixed(0)}%</Text>
                            </Text>
                            <Text>
                                <Text dimColor>Now: </Text>
                                <Text bold color={nowColor}>{(currentVal + 50).toFixed(0)}%</Text>
                            </Text>
                            <Text>
                                <Text dimColor>Low: </Text>
                                <Text bold color={lowColor}>{(dataMin + 50).toFixed(0)}%</Text>
                            </Text>
                        </>
                    )}
                </Box>
            </Box>
        </Box>
    );
};
