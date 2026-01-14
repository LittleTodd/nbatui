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
}

/**
 * Win Probability Chart with adaptive Y-axis scaling
 * - If data is all on one side and range is small: zoom in on actual range
 * - If data crosses 50%: show full bidirectional view
 */
export const LeadTrackerChart: React.FC<LeadTrackerChartProps> = ({
    data,
    height = 11,
    teamColor = 'green',
    oppColor = 'red',
    teamLabel = 'TEAM',
    oppLabel = 'OPP',
    width = 50
}) => {
    if (!data || data.length === 0) {
        return <Text dimColor>No data</Text>;
    }

    // Clean and validate data
    const cleanData = data.filter(v => typeof v === 'number' && isFinite(v));
    if (cleanData.length < 2) {
        return <Text dimColor>Insufficient data points.</Text>;
    }

    // Calculate data range (offset values, 0 = 50%)
    const dataMax = Math.max(...cleanData);
    const dataMin = Math.min(...cleanData);
    const dataRange = dataMax - dataMin;

    // Check if data crosses zero (50% line)
    const crossesZero = dataMin < 0 && dataMax > 0;

    // Determine display mode and Y-axis range
    let displayMin: number;
    let displayMax: number;
    let showZeroLine: boolean;

    if (crossesZero) {
        // Data crosses 50% - show symmetric view around 0
        const maxAbs = Math.max(Math.abs(dataMax), Math.abs(dataMin), 10);
        const niceMax = Math.ceil(maxAbs / 5) * 5;
        displayMin = -niceMax;
        displayMax = niceMax;
        showZeroLine = true;
    } else {
        // Data is all on one side - zoom in tightly on the actual range
        // Use minimal padding: just 1-2% beyond the data range
        const minPadding = 1;  // At least 1% padding on each side

        // For small ranges, use 1% increments; for larger, use 5%
        const roundTo = dataRange < 10 ? 1 : 5;

        displayMin = Math.floor((dataMin - minPadding) / roundTo) * roundTo;
        displayMax = Math.ceil((dataMax + minPadding) / roundTo) * roundTo;

        // Ensure minimum range of 5% for visual clarity
        const minRange = 5;
        if (displayMax - displayMin < minRange) {
            const mid = (dataMin + dataMax) / 2;
            displayMin = Math.floor((mid - minRange / 2) / roundTo) * roundTo;
            displayMax = Math.ceil((mid + minRange / 2) / roundTo) * roundTo;
        }

        // Check if 0 is visible in this range
        showZeroLine = displayMin <= 0 && displayMax >= 0;
    }

    const displayRange = displayMax - displayMin;
    const chartHeight = height;

    // Downsample data to fit width
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

    // Map offset value (-50 to +50) to row index
    const valueToRow = (value: number): number => {
        const normalized = (displayMax - value) / displayRange;
        return Math.min(chartHeight - 1, Math.max(0, Math.round(normalized * (chartHeight - 1))));
    };

    // Find zero line row (if visible)
    const zeroRow = showZeroLine ? valueToRow(0) : -1;

    // Generate chart grid
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

    // Fill the chart
    for (let col = 0; col < sampledData.length; col++) {
        const value = sampledData[col]!;
        const edgeRow = valueToRow(value);

        // Determine fill direction and color
        // Plan A+: Extend bars to meet at the 50% line with blended color for smooth transition
        if (showZeroLine && zeroRow >= 0) {
            // Calculate blended color for the 50% line
            const blendedColor = blendColors(teamColor, oppColor);

            if (value > 0) {
                // Team is favored: fill from edgeRow down to zeroRow-1, then zeroRow with blend
                for (let row = edgeRow; row < zeroRow; row++) {
                    grid[row]![col] = '█';
                    colorGrid[row]![col] = teamColor;
                }
                // 50% line uses blended color
                grid[zeroRow]![col] = '█';
                colorGrid[zeroRow]![col] = blendedColor;
            } else if (value < 0) {
                // Opponent is favored: zeroRow with blend, then fill down to edgeRow
                grid[zeroRow]![col] = '█';
                colorGrid[zeroRow]![col] = blendedColor;
                for (let row = zeroRow + 1; row <= edgeRow; row++) {
                    grid[row]![col] = '█';
                    colorGrid[row]![col] = oppColor;
                }
            } else {
                // value === 0: exactly 50%, use blended color
                grid[zeroRow]![col] = '█';
                colorGrid[zeroRow]![col] = blendedColor;
            }
        } else {
            // Unidirectional zoomed view: always fill from bottom UP to current value
            // This way, higher values = taller bars (more fill from bottom)
            const isTeamFavored = dataMax > 0 || (dataMax === 0 && dataMin >= 0);
            const fillColor = isTeamFavored ? teamColor : oppColor;

            // Fill from bottom of chart up to the edge row
            for (let row = edgeRow; row < chartHeight; row++) {
                grid[row]![col] = '█';
                colorGrid[row]![col] = fillColor;
            }
        }
    }

    // Convert offset to absolute probability for display
    // When crossing zero: symmetric probabilities, different team labels
    // When not crossing: linear probabilities, same team label
    let topProb: number;
    let botProb: number;
    let topTeam: string;
    let botTeam: string;
    let topColor: string;
    let botColor: string;

    if (crossesZero) {
        // Symmetric: both show same distance from 50%
        const maxAbs = Math.max(Math.abs(displayMax), Math.abs(displayMin));
        topProb = 50 + maxAbs;
        botProb = 50 + maxAbs;
        topTeam = teamLabel;
        botTeam = oppLabel;
        topColor = teamColor;
        botColor = oppColor;
    } else {
        // Zoomed view: show actual probability range for tracked team
        topProb = 50 + displayMax;
        botProb = 50 + displayMin;
        topTeam = teamLabel;
        botTeam = teamLabel;
        topColor = teamColor;
        botColor = teamColor;
    }

    // Stats for footer (absolute probabilities)
    const currentVal = sampledData[sampledData.length - 1] || 0;

    return (
        <Box flexDirection="column">
            <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
                {/* Top label */}
                <Box>
                    <Text dimColor>{topProb.toString().padStart(3)}</Text>
                    <Text color={topColor}> {topTeam}</Text>
                </Box>

                {/* Chart rows */}
                {grid.map((row, rowIdx) => (
                    <Box key={rowIdx}>
                        {/* Y-axis label */}
                        <Text dimColor>
                            {rowIdx === zeroRow ? ' 50 ─' : '    │'}
                        </Text>

                        {/* Data cells */}
                        {row.map((cell, colIdx) => (
                            <Text key={colIdx} color={colorGrid[rowIdx]![colIdx]}>
                                {cell}
                            </Text>
                        ))}
                    </Box>
                ))}

                {/* Bottom label */}
                <Box>
                    <Text dimColor>{botProb.toString().padStart(3)}</Text>
                    <Text color={botColor}> {botTeam}</Text>
                </Box>

                {/* Stats footer - show absolute win probability */}
                {/* Use readable colors for text - if color is too light, use a darker fallback */}
                {(() => {
                    const getReadableColor = (color: string): string => {
                        const luminance = getLuminance(color);
                        // If color is too light for light background, use a dark gray
                        if (luminance > 0.6) return '#555555';
                        return color;
                    };

                    const highColor = getReadableColor(dataMax >= 0 ? teamColor : oppColor);
                    const nowColor = getReadableColor(currentVal >= 0 ? teamColor : oppColor);
                    const lowColor = getReadableColor(dataMin >= 0 ? teamColor : oppColor);

                    return (
                        <Box justifyContent="space-around" marginTop={1}>
                            <Text>
                                <Text dimColor>High: </Text>
                                <Text bold color={highColor}>
                                    {(dataMax + 50).toFixed(0)}%
                                </Text>
                            </Text>
                            <Text>
                                <Text dimColor>Now: </Text>
                                <Text bold color={nowColor}>
                                    {(currentVal + 50).toFixed(0)}%
                                </Text>
                            </Text>
                            <Text>
                                <Text dimColor>Low: </Text>
                                <Text bold color={lowColor}>
                                    {(dataMin + 50).toFixed(0)}%
                                </Text>
                            </Text>
                        </Box>
                    );
                })()}
            </Box>
        </Box>
    );
};
