/**
 * BrailleCourt Component
 * High-Resolution Half-Court Shot Chart & Heatmap in the Terminal
 *
 * Uses Unicode Braille patterns (U+2800 - U+28FF) for crisp court blueprint lines
 * overlaid with distinct color-coded shot markers (○ Made / × Missed).
 */
import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { BrailleCanvas } from '../utils/brailleCanvas.js';
import type { PlayByPlayAction } from '../services/apiClient.js';

interface BrailleCourtProps {
    actions: PlayByPlayAction[];
    homeTricode: string;
    awayTricode: string;
    homeName?: string;
    awayName?: string;
    onClose?: () => void;
}

interface ShotPoint {
    px: number;
    py: number;
    isMake: boolean;
    team: string;
    player: string;
    distance: number;
    is3pt: boolean;
    zone: 'paint' | 'mid' | '3pt_corner' | '3pt_above';
}

interface RenderSegment {
    text: string;
    color?: string;
    dimColor?: boolean;
    bold?: boolean;
}

// Convert NBA Live PlayByPlay coordinates to Half-Court Canvas pixels (76 x 64).
// Basket is centered at (38, 9), baseline at y=2, paint x∈[24..52] y∈[2..28], 3PT arc radius=30.
// NBA Live API provides:
// - xLegacy ∈ [-250, 250] (lateral tenths-of-foot from hoop), yLegacy ∈ [-52.5, 417.5] (depth from hoop)
// - x ∈ [0, 100] (full-court 94ft length, left hoop ≈ 5.585, right hoop ≈ 94.415), y ∈ [0, 100] (50ft width)
function normalizeShotCoords(
    action: PlayByPlayAction,
    canvasWidth: number,
    canvasHeight: number
): { px: number; py: number; xLeg: number; yLeg: number } | null {
    const hoopX = canvasWidth / 2; // 38
    const hoopY = 9;
    const halfWidthScale = (canvasWidth - 8) / 2; // 34 px for 25 ft (250 tenths)
    const depthScale = canvasHeight - 13; // 51 px for 41.75 ft (417.5 tenths)

    let xLeg: number | null = null;
    let yLeg: number | null = null;

    if (
        typeof action.xLegacy === 'number' &&
        typeof action.yLegacy === 'number' &&
        Number.isFinite(action.xLegacy) &&
        Number.isFinite(action.yLegacy)
    ) {
        xLeg = action.xLegacy;
        yLeg = action.yLegacy;
    } else if (
        typeof action.x === 'number' &&
        typeof action.y === 'number' &&
        Number.isFinite(action.x) &&
        Number.isFinite(action.y)
    ) {
        if (action.x < 0 || action.x > 100 || action.y < 0 || action.y > 100) {
            // Already in legacy NBA half-court tenths-of-foot coordinates
            xLeg = action.x;
            yLeg = action.y;
        } else {
            // Full-court landscape percentages (0..100 x 0..100): fold both baskets to top half-court
            const isRightBasket = action.side === 'right' || (action.side !== 'left' && action.x > 50);
            if (isRightBasket) {
                xLeg = (action.y - 50) * 5;
                yLeg = (94.415 - action.x) * 9.4;
            } else {
                xLeg = (50 - action.y) * 5;
                yLeg = (action.x - 5.585) * 9.4;
            }
        }
    }

    if (xLeg !== null && yLeg !== null) {
        const px = hoopX + (xLeg / 250) * halfWidthScale;
        const py = hoopY + (yLeg / 417.5) * depthScale;
        return {
            px: Math.max(3, Math.min(canvasWidth - 4, px)),
            py: Math.max(3, Math.min(canvasHeight - 4, py)),
            xLeg,
            yLeg
        };
    }

    // Fallback: estimate from description / shotDistance if coordinates are absent
    const desc = action.description || '';
    const distMatch = desc.match(/(\d+)'/);
    const dist = distMatch && distMatch[1] ? parseInt(distMatch[1], 10) : (action.shotDistance || 15);

    const pseudoAngle = ((action.actionNumber * 37) % 140) + 20;
    const rad = (pseudoAngle * Math.PI) / 180;
    const estXLeg = Math.cos(rad) * dist * 10;
    const estYLeg = Math.sin(rad) * dist * 10;
    const px = hoopX + (estXLeg / 250) * halfWidthScale;
    const py = hoopY + (estYLeg / 417.5) * depthScale;

    return {
        px: Math.max(3, Math.min(canvasWidth - 4, px)),
        py: Math.max(3, Math.min(canvasHeight - 4, py)),
        xLeg: estXLeg,
        yLeg: estYLeg
    };
}

export function BrailleCourt({
    actions,
    homeTricode,
    awayTricode,
    homeName,
    awayName,
    onClose
}: BrailleCourtProps) {
    const [teamFilter, setTeamFilter] = useState<'ALL' | 'AWAY' | 'HOME'>('ALL');
    const [showHeatmap, setShowHeatmap] = useState(false);
    const [shotFilter, setShotFilter] = useState<'all' | 'made' | 'missed'>('all');

    // Canvas dimensions in cells (each cell is 2x4 sub-pixels)
    const CELL_W = 38;
    const CELL_H = 16;
    const PIXEL_W = CELL_W * 2; // 76
    const PIXEL_H = CELL_H * 4; // 64

    // Extract all field goal attempts
    const shotData = useMemo(() => {
        const fgActions = actions.filter(a => {
            const desc = a.description || '';
            return (
                a.shotResult === 'Made' ||
                a.shotResult === 'Missed' ||
                a.actionType === '2pt' ||
                a.actionType === '3pt' ||
                desc.includes('Shot') ||
                desc.includes('Layup') ||
                desc.includes('Dunk') ||
                desc.includes('3PT')
            );
        });

        const list: ShotPoint[] = [];

        for (const action of fgActions) {
            const coords = normalizeShotCoords(action, PIXEL_W, PIXEL_H);
            if (!coords) continue;

            const desc = action.description || '';
            const isMake = action.shotResult === 'Made' || (!action.shotResult && !desc.includes('MISS'));
            const is3pt = action.actionType === '3pt' || desc.includes('3PT');
            const dist = action.shotDistance || Math.round(Math.hypot(coords.xLeg, coords.yLeg) / 10);

            // NBA Paint is 16ft wide (xLeg ∈ [-80, 80]) and 19ft deep from baseline (yLeg <= 140)
            let zone: ShotPoint['zone'] = 'mid';
            if (is3pt) {
                zone = coords.yLeg <= 88 ? '3pt_corner' : '3pt_above';
            } else if (Math.abs(coords.xLeg) <= 85 && coords.yLeg <= 145) {
                zone = 'paint';
            }

            list.push({
                px: coords.px,
                py: coords.py,
                isMake,
                team: action.teamTricode || '',
                player: action.playerName || action.playerNameI || 'Player',
                distance: dist,
                is3pt,
                zone
            });
        }

        return list;
    }, [actions, PIXEL_W, PIXEL_H]);

    // Filtered shots
    const filteredShots = useMemo(() => {
        return shotData.filter(s => {
            if (teamFilter === 'HOME' && s.team !== homeTricode) return false;
            if (teamFilter === 'AWAY' && s.team !== awayTricode) return false;
            if (shotFilter === 'made' && !s.isMake) return false;
            if (shotFilter === 'missed' && s.isMake) return false;
            return true;
        });
    }, [shotData, teamFilter, homeTricode, awayTricode, shotFilter]);

    // Statistics calculations
    const stats = useMemo(() => {
        const total = filteredShots.length;
        const makes = filteredShots.filter(s => s.isMake).length;
        const pct = total > 0 ? ((makes / total) * 100).toFixed(1) : '0.0';

        const threes = filteredShots.filter(s => s.is3pt);
        const threeMakes = threes.filter(s => s.isMake).length;
        const threePct = threes.length > 0 ? ((threeMakes / threes.length) * 100).toFixed(1) : '0.0';

        const paint = filteredShots.filter(s => s.zone === 'paint');
        const paintMakes = paint.filter(s => s.isMake).length;
        const paintPct = paint.length > 0 ? ((paintMakes / paint.length) * 100).toFixed(1) : '0.0';

        const mid = filteredShots.filter(s => s.zone === 'mid');
        const midMakes = mid.filter(s => s.isMake).length;
        const midPct = mid.length > 0 ? ((midMakes / mid.length) * 100).toFixed(1) : '0.0';

        return {
            total, makes, pct,
            threes: threes.length, threeMakes, threePct,
            paint: paint.length, paintMakes, paintPct,
            mid: mid.length, midMakes, midPct
        };
    }, [filteredShots]);

    // Render pure court geometry (separate from shot markers so colors & symbols are cleanly distinct)
    const baseCourtLines = useMemo(() => {
        const canvas = new BrailleCanvas(CELL_W, CELL_H);

        // 1. Outer Court Border (Sidelines, Baseline at top, Half-court line at bottom)
        canvas.drawRect(2, 2, PIXEL_W - 4, PIXEL_H - 4);

        // 2. Backboard
        canvas.drawLine(32, 6, 44, 6);

        // 3. Rim / Basket
        canvas.drawCircle(38, 9, 3);

        // 4. Restricted Area Arc
        canvas.drawArc(38, 9, 6, 0, 180, 4);

        // 5. Paint / Key Rectangle
        canvas.drawRect(24, 2, 28, 26);

        // 6. Free Throw Circle
        canvas.drawCircle(38, 28, 9);

        // 7. 3-Point Line
        canvas.drawLine(8, 2, 8, 20);
        canvas.drawLine(PIXEL_W - 9, 2, PIXEL_W - 9, 20);
        canvas.drawArc(38, 9, 30, 22, 158, 2);

        // 8. Half-Court Center Circle at bottom center
        canvas.drawArc(38, PIXEL_H - 2, 10, 180, 360, 4);

        return canvas.renderLines();
    }, [CELL_W, CELL_H, PIXEL_W, PIXEL_H]);

    // Compose each court row into color-separated segments (dim gray court blueprint + distinct ○/×/◎ shot markers)
    const renderedRows = useMemo<RenderSegment[][]>(() => {
        const cellShots = new Map<string, { makes: number; misses: number }>();

        for (const s of filteredShots) {
            const cx = Math.max(0, Math.min(CELL_W - 1, Math.floor(s.px / 2)));
            const cy = Math.max(0, Math.min(CELL_H - 1, Math.floor(s.py / 4)));
            const key = `${cx},${cy}`;
            const existing = cellShots.get(key) || { makes: 0, misses: 0 };
            if (s.isMake) existing.makes += 1;
            else existing.misses += 1;
            cellShots.set(key, existing);
        }

        const rows: RenderSegment[][] = [];

        for (let cy = 0; cy < CELL_H; cy++) {
            const line = baseCourtLines[cy] || '';
            const segments: RenderSegment[] = [];

            const pushCell = (char: string, color: string | undefined, dimColor: boolean, bold: boolean) => {
                const prev = segments[segments.length - 1];
                if (prev && prev.color === color && Boolean(prev.dimColor) === dimColor && Boolean(prev.bold) === bold) {
                    prev.text += char;
                } else {
                    segments.push({ text: char, color, dimColor, bold });
                }
            };

            for (let cx = 0; cx < CELL_W; cx++) {
                const cell = cellShots.get(`${cx},${cy}`);
                if (cell) {
                    if (showHeatmap) {
                        const total = cell.makes + cell.misses;
                        const fgPct = total > 0 ? cell.makes / total : 0;
                        const heatColor = fgPct >= 0.55 ? 'red' : fgPct >= 0.4 ? 'yellow' : 'cyan';
                        const sym = cell.makes > 0 && cell.misses > 0 ? '◎' : cell.makes > 0 ? '○' : '×';
                        pushCell(sym, heatColor, false, true);
                    } else if (cell.makes > 0 && cell.misses === 0) {
                        pushCell('○', 'green', false, true);
                    } else if (cell.misses > 0 && cell.makes === 0) {
                        pushCell('×', 'red', false, true);
                    } else {
                        // Both made and missed shots fell in the same cell
                        pushCell('◎', 'yellow', false, true);
                    }
                } else {
                    // Court outline in muted gray so shots pop clearly
                    pushCell(line[cx] || ' ', 'gray', true, false);
                }
            }

            rows.push(segments);
        }

        return rows;
    }, [baseCourtLines, filteredShots, showHeatmap, CELL_W, CELL_H]);

    useInput((input, key) => {
        if (key.escape || input === 'c' || input === 'q') {
            onClose?.();
            return;
        }
        if (input === 'h') {
            setShowHeatmap(prev => !prev);
        }
        if (input === 't') {
            setTeamFilter(prev => prev === 'ALL' ? 'AWAY' : prev === 'AWAY' ? 'HOME' : 'ALL');
        }
        if (input === 'm') {
            setShotFilter(prev => prev === 'all' ? 'made' : prev === 'made' ? 'missed' : 'all');
        }
    });

    const activeTeamLabel = teamFilter === 'ALL'
        ? 'Both Teams'
        : teamFilter === 'HOME'
            ? `${homeTricode} (${homeName || 'Home'})`
            : `${awayTricode} (${awayName || 'Away'})`;

    return (
        <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} paddingY={0}>
            {/* Header */}
            <Box justifyContent="space-between" width={CELL_W + 32} marginBottom={1}>
                <Box>
                    <Text bold color="cyan">🏀 BrailleCourt™ Shot Chart </Text>
                    <Text color="yellow">[{activeTeamLabel}]</Text>
                </Box>
                <Text dimColor>[Esc/c to close]</Text>
            </Box>

            {/* Main Court & Stats Side-by-Side */}
            <Box flexDirection="row">
                {/* Court Graphics */}
                <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
                    <Box justifyContent="space-between" width={CELL_W}>
                        <Text dimColor>L Corner</Text>
                        <Text dimColor>▼ Basket</Text>
                        <Text dimColor>R Corner</Text>
                    </Box>

                    {renderedRows.map((segments, rowIdx) => (
                        <Text key={rowIdx}>
                            {segments.map((seg, segIdx) => (
                                <Text
                                    key={segIdx}
                                    color={seg.color}
                                    dimColor={seg.dimColor}
                                    bold={seg.bold}
                                >
                                    {seg.text}
                                </Text>
                            ))}
                        </Text>
                    ))}

                    {/* Clear Shot Legend */}
                    <Box justifyContent="center" width={CELL_W} marginTop={0}>
                        {showHeatmap ? (
                            <Text>
                                <Text color="red" bold>● Hot ≥55%</Text>
                                <Text dimColor>  </Text>
                                <Text color="yellow" bold>● Avg</Text>
                                <Text dimColor>  </Text>
                                <Text color="cyan" bold>● Cold &lt;40%</Text>
                            </Text>
                        ) : (
                            <Text>
                                <Text color="green" bold>○ Made</Text>
                                <Text dimColor>   </Text>
                                <Text color="red" bold>× Missed</Text>
                                <Text dimColor>   </Text>
                                <Text color="yellow" bold>◎ Mixed</Text>
                            </Text>
                        )}
                    </Box>
                </Box>

                {/* Right Panel: Shot Breakdown & Zone Stats */}
                <Box flexDirection="column" marginLeft={2} width={28}>
                    <Text bold underline>Shooting Breakdown</Text>

                    <Box flexDirection="column" marginTop={1}>
                        <Box justifyContent="space-between">
                            <Text>Field Goals:</Text>
                            <Text bold color="yellow">{stats.makes}/{stats.total} ({stats.pct}%)</Text>
                        </Box>
                        <Box justifyContent="space-between">
                            <Text>3-Pointers:</Text>
                            <Text bold color="green">{stats.threeMakes}/{stats.threes} ({stats.threePct}%)</Text>
                        </Box>
                    </Box>

                    <Box marginTop={1} borderStyle="single" borderTop={true} borderBottom={false} borderLeft={false} borderRight={false} borderColor="gray" />

                    <Text bold color="cyan">Zone Efficiency</Text>
                    <Box flexDirection="column" marginTop={0}>
                        <Box justifyContent="space-between">
                            <Text dimColor>Paint / Rim:</Text>
                            <Text bold color={parseFloat(stats.paintPct) >= 55 ? 'green' : undefined}>
                                {stats.paintMakes}/{stats.paint} ({stats.paintPct}%)
                            </Text>
                        </Box>
                        <Box justifyContent="space-between">
                            <Text dimColor>Mid-Range:</Text>
                            <Text bold color={parseFloat(stats.midPct) >= 45 ? 'green' : undefined}>
                                {stats.midMakes}/{stats.mid} ({stats.midPct}%)
                            </Text>
                        </Box>
                        <Box justifyContent="space-between">
                            <Text dimColor>3PT Arc:</Text>
                            <Text bold color={parseFloat(stats.threePct) >= 38 ? 'green' : undefined}>
                                {stats.threeMakes}/{stats.threes} ({stats.threePct}%)
                            </Text>
                        </Box>
                    </Box>

                    {/* Controls Guide */}
                    <Box flexDirection="column" marginTop={2} borderStyle="single" borderColor="gray" paddingX={1}>
                        <Text bold dimColor>Hotkeys</Text>
                        <Text><Text color="cyan" bold>[t]</Text> Team: <Text color="yellow">{teamFilter}</Text></Text>
                        <Text><Text color="cyan" bold>[m]</Text> Filter: <Text color="yellow">{shotFilter}</Text></Text>
                        <Text><Text color="cyan" bold>[h]</Text> Heatmap: <Text color={showHeatmap ? 'green' : 'gray'}>{showHeatmap ? 'ON' : 'OFF'}</Text></Text>
                    </Box>
                </Box>
            </Box>
        </Box>
    );
}
