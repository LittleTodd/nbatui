import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import { type Game, fetchBoxScore, fetchStandings, fetchPolymarketOdds, findGameOdds, getGameStatusInfo, type GameOdds, fetchPlayByPlay, type PlayByPlayAction, fetchScoreCurve, type ScoreCurveData } from '../services/apiClient.js';
import { TEAM_BG_COLORS, TEAM_TEXT_COLORS } from '../data/teamColors.js';
import { PlayByPlayStream } from '../components/PlayByPlayStream.js';
import { LiveOnCourt } from '../components/LiveOnCourt.js';
import { OddsCurve } from '../components/OddsCurve.js';
import { BrailleCourt } from '../components/BrailleCourt.js';
import { SuperstarDuel } from '../components/SuperstarDuel.js';
import { PlayerTradingCard, type TradingCardPlayer } from '../components/PlayerTradingCard.js';
import { LeadTrackerChart } from '../components/charts/LeadTrackerChart.js';
import { detectMomentumRun, checkMilestoneWatches } from '../utils/momentumDetector.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';

interface GameDetailPageProps {
    game: Game;
    onBack: () => void;
    onPrevGame?: () => void;
    onNextGame?: () => void;
    gameIndex?: number;
    totalGames?: number;
}

interface TeamStanding {
    TeamID: number;
    TeamCity: string;
    TeamName: string;
    TeamAbbreviation: string;
    Conference: string;
    ConferenceRecord: string;
    PlayoffRank: number;
    WINS: number;
    LOSSES: number;
    L10: string;
    strCurrentStreak: string;
}

function selectTopPerformer(boxScore: any, homeTricode: string, awayTricode: string): TradingCardPlayer | null {
    const candidates: Array<{ player: any; teamTricode: string; score: number }> = [];
    const collect = (players: any[] | undefined, tricode: string) => {
        if (!Array.isArray(players)) return;
        for (const p of players) {
            const s = p?.statistics || {};
            const impact = (s.points || 0) + (s.reboundsTotal || 0) * 1.2 + (s.assists || 0) * 1.5 + (s.steals || 0) * 2 + (s.blocks || 0) * 2;
            candidates.push({ player: p, teamTricode: tricode, score: impact });
        }
    };
    collect(boxScore?.homeTeam?.players, homeTricode);
    collect(boxScore?.awayTeam?.players, awayTricode);
    candidates.sort((a, b) => b.score - a.score);
    const top = candidates[0];
    if (!top) return null;
    return {
        personId: top.player.personId,
        name: top.player.name || top.player.nameI || 'Player',
        jerseyNum: top.player.jerseyNum || '0',
        position: top.player.position || 'G',
        teamTricode: top.teamTricode,
        statistics: top.player.statistics || {}
    };
}

export function GameDetailPage({ game, onBack, onPrevGame, onNextGame, gameIndex, totalGames }: GameDetailPageProps) {
    const { columns: termWidth } = useTerminalSize();
    const [boxScore, setBoxScore] = useState<any>(null);
    const [standings, setStandings] = useState<TeamStanding[]>([]);
    const [odds, setOdds] = useState<GameOdds | null>(null);
    const [loading, setLoading] = useState(true);
    const [playByPlay, setPlayByPlay] = useState<PlayByPlayAction[]>([]);
    type DetailTab = 'boxscore' | 'lineups' | 'playbyplay' | 'leadtracker';
    const [detailTab, setDetailTab] = useState<DetailTab>('boxscore');
    const [showShotChart, setShowShotChart] = useState(false);
    const [showDuel, setShowDuel] = useState(false);
    const [tradingCardPlayer, setTradingCardPlayer] = useState<TradingCardPlayer | null>(null);
    const [tradingCardAnchorCol, setTradingCardAnchorCol] = useState<number | null>(null);
    const [scoreCurve, setScoreCurve] = useState<ScoreCurveData | null>(null);
    const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
    const [retryCounter, setRetryCounter] = useState(0);

    const isScheduled = game.gameStatus === 1;

    // Reset per-game UI state when switching games with '[' / ']'
    useEffect(() => {
        setBoxScore(null);
        setPlayByPlay([]);
        setScoreCurve(null);
        setShowShotChart(false);
        setShowDuel(false);
        setTradingCardPlayer(null);
        setTradingCardAnchorCol(null);
        setIsStatsModalOpen(false);
        setLoading(true);
    }, [game.gameId]);

    // Fetch & refresh score curve for live/completed games (per-effect cancelled flag prevents stale overwrite)
    useEffect(() => {
        if (isScheduled) return;
        let cancelled = false;
        let timeoutId: ReturnType<typeof setTimeout> | undefined;

        let lastCurveJson = '';
        const fetchCurve = async () => {
            try {
                const data = await fetchScoreCurve(game.gameId);
                if (!cancelled && data) {
                    const serialized = JSON.stringify(data);
                    if (serialized !== lastCurveJson) {
                        lastCurveJson = serialized;
                        setScoreCurve(data);
                    }
                }
            } catch {
                // Ignore transient errors
            }
            if (!cancelled && game.gameStatus === 2) {
                timeoutId = setTimeout(fetchCurve, 30000);
            }
        };

        fetchCurve();
        return () => {
            cancelled = true;
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [game.gameId, game.gameStatus, isScheduled, retryCounter]);

    // Static Data Fetch for scheduled games (Odds, Standings)
    useEffect(() => {
        if (!isScheduled) return;
        let cancelled = false;
        setLoading(true);

        const fetchStaticData = async () => {
            try {
                const [standingsData, oddsData] = await Promise.all([
                    fetchStandings(),
                    fetchPolymarketOdds()
                ]);

                if (cancelled) return;

                const standingsArray = standingsData?.standings || [];
                setStandings(Array.isArray(standingsArray) ? standingsArray : []);

                const gameDate = game.localDate || game.gameDateET || game.gameTimeUTC?.slice(0, 10) || '';
                const gameOdds = findGameOdds(oddsData, game.awayTeam.teamTricode, game.homeTeam.teamTricode, gameDate);
                setOdds(gameOdds || null);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchStaticData();
        return () => { cancelled = true; };
    }, [game.gameId, isScheduled, retryCounter]);

    // Polling Logic for Main Game Data (Box Score / Header) with per-effect cancellation
    useEffect(() => {
        if (isScheduled) return;
        let cancelled = false;
        let timeoutId: ReturnType<typeof setTimeout> | undefined;

        let lastBoxJson = '';
        const loop = async () => {
            if (cancelled) return;

            try {
                const boxData = await fetchBoxScore(game.gameId);
                if (cancelled) return;

                if (boxData && boxData.awayTeam && boxData.homeTeam) {
                    const serialized = JSON.stringify(boxData);
                    if (serialized !== lastBoxJson) {
                        lastBoxJson = serialized;
                        setBoxScore(boxData);
                    }
                }
                setLoading(false);

                // Stop if game is final (status 3) and data confirms it
                if (game.gameStatus === 3 && boxData?.gameStatus === 3) return;

                // Faster 20s sync during active play; backoff during breaks/halftime
                let delay = 20000;
                const statusText = boxData?.gameStatusText || '';
                const period = boxData?.period || 0;
                const clock = boxData?.gameClock || '';

                if (statusText.toLowerCase().includes('halftime') || (period === 2 && clock === 'PT00M00.00S')) {
                    delay = 300000;
                } else if (clock === 'PT00M00.00S' && period !== 2 && period < 5) {
                    delay = 120000;
                }

                if (!cancelled) {
                    timeoutId = setTimeout(loop, delay);
                }
            } catch {
                if (!cancelled) {
                    setLoading(false);
                    timeoutId = setTimeout(loop, 30000);
                }
            }
        };

        loop();

        return () => {
            cancelled = true;
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [game.gameId, game.gameStatus, isScheduled, retryCounter]);

    // Dedicated Polling Logic for Play-by-Play & Shot Tracking with per-effect cancellation
    useEffect(() => {
        if (isScheduled) return;
        let cancelled = false;
        let timeoutId: ReturnType<typeof setTimeout> | undefined;

        let lastPbpKey = '';
        const fetchPBP = async () => {
            if (cancelled) return;

            try {
                const pbpData = await fetchPlayByPlay(game.gameId, game.gameStatus);
                if (!cancelled && pbpData?.actions) {
                    const lastAction = pbpData.actions[pbpData.actions.length - 1];
                    const key = `${pbpData.actions.length}:${lastAction?.actionNumber ?? ''}:${lastAction?.scoreHome ?? ''}-${lastAction?.scoreAway ?? ''}`;
                    if (key !== lastPbpKey) {
                        lastPbpKey = key;
                        setPlayByPlay(pbpData.actions);
                    }
                }
            } catch {
                // Ignore errors, retry next tick
            }

            if (!cancelled && game.gameStatus === 2) {
                timeoutId = setTimeout(fetchPBP, 15000);
            }
        };

        fetchPBP();

        return () => {
            cancelled = true;
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [game.gameId, game.gameStatus, isScheduled, retryCounter]);

    const momentumRun = useMemo(() => {
        return detectMomentumRun(playByPlay, game.homeTeam.teamTricode, game.awayTeam.teamTricode);
    }, [playByPlay, game.homeTeam.teamTricode, game.awayTeam.teamTricode]);

    const milestones = useMemo(() => {
        if (!boxScore) return [];
        const homeWatches = checkMilestoneWatches(boxScore.homeTeam?.players || [], game.homeTeam.teamTricode);
        const awayWatches = checkMilestoneWatches(boxScore.awayTeam?.players || [], game.awayTeam.teamTricode);
        return [...homeWatches, ...awayWatches];
    }, [boxScore, game.homeTeam.teamTricode, game.awayTeam.teamTricode]);

    useInput((input, key) => {
        // When any child overlay modal is open, let the child own ALL keyboard input
        // to prevent double-handling or key leakage to underlying tabs/routes.
        if (showShotChart || showDuel || tradingCardPlayer) {
            return;
        }

        // Escape / q / Backspace returns to map (unless inline stats card is open)
        if (key.escape || input === 'q' || key.backspace) {
            if (isStatsModalOpen) return;
            onBack();
            return;
        }

        // Retry failed load
        if (input === 'r' && !boxScore && !isScheduled) {
            setLoading(true);
            setRetryCounter(c => c + 1);
            return;
        }

        // Quick game switching without returning to map
        if (input === '[' && onPrevGame) {
            onPrevGame();
            return;
        }
        if (input === ']' && onNextGame) {
            onNextGame();
            return;
        }

        // Shortcuts below apply only to live/final games with loaded boxScore
        if (isScheduled || !boxScore) {
            return;
        }

        if (input === 'c') {
            setShowShotChart(true);
            return;
        }
        if (input === 'd') {
            setShowDuel(true);
            return;
        }
        if (input === 'v') {
            const top = selectTopPerformer(boxScore, game.homeTeam.teamTricode, game.awayTeam.teamTricode);
            if (top) {
                setTradingCardAnchorCol(null);
                setTradingCardPlayer(top);
            }
            return;
        }

        // Tab switching: 1, 2, 3, 4
        if (input === '1') setDetailTab('boxscore');
        if (input === '2') setDetailTab('lineups');
        if (input === '3' || input === 'p' || input === 'P') setDetailTab('playbyplay');
        if (input === '4' || input === 'l' || input === 'L') setDetailTab('leadtracker');

        // Tab key cycles through main tabs
        if (key.tab) {
            const tabs: DetailTab[] = ['boxscore', 'lineups', 'playbyplay', 'leadtracker'];
            setDetailTab(prev => {
                const idx = tabs.indexOf(prev);
                return tabs[(idx + 1) % tabs.length] || 'boxscore';
            });
        }
    });

    if (loading) {
        return (
            <Box flexDirection="column" alignItems="center" justifyContent="center" height={20}>
                <Text color="green"><Spinner type="dots" /> Loading Data...</Text>
            </Box>
        );
    }

    // Scheduled game: show Game Preview
    if (isScheduled) {
        return <GamePreview game={game} standings={standings} odds={odds} termWidth={termWidth} />;
    }

    // Live/completed game: error fallback with retry action
    if (!boxScore || !boxScore.awayTeam || !boxScore.homeTeam) {
        return (
            <Box flexDirection="column" alignItems="center" justifyContent="center" height={15} borderStyle="round" borderColor="red" paddingX={3}>
                <Text bold color="red">Failed to load game data.</Text>
                <Text dimColor>Make sure the local data-service is running.</Text>
                <Box marginTop={1}>
                    <Text color="cyan" bold>[r]</Text><Text dimColor> Retry  •  </Text>
                    <Text color="magenta" bold>[Esc]</Text><Text dimColor> Return to Map</Text>
                </Box>
            </Box>
        );
    }

    // Modal Overlays
    if (showShotChart) {
        return (
            <Box flexDirection="column" alignItems="center" paddingX={1} paddingTop={1}>
                <BrailleCourt
                    actions={playByPlay}
                    homeTricode={game.homeTeam.teamTricode}
                    awayTricode={game.awayTeam.teamTricode}
                    homeName={game.homeTeam.teamName}
                    awayName={game.awayTeam.teamName}
                    onClose={() => setShowShotChart(false)}
                />
            </Box>
        );
    }

    if (showDuel) {
        return (
            <Box flexDirection="column" alignItems="center" paddingX={1} paddingTop={1}>
                <SuperstarDuel
                    awayTeam={boxScore.awayTeam}
                    homeTeam={boxScore.homeTeam}
                    onClose={() => setShowDuel(false)}
                />
            </Box>
        );
    }

    // Full-screen card only when opened via [v] outside Live Lineups;
    // inside Live Lineups it pops out inline anchored directly under the selected player.
    const isInlineLineupCard = Boolean(tradingCardPlayer && detailTab === 'lineups' && tradingCardAnchorCol !== null);
    if (tradingCardPlayer && !isInlineLineupCard) {
        return (
            <Box flexDirection="column" alignItems="center" paddingX={1} paddingTop={1}>
                <PlayerTradingCard
                    player={tradingCardPlayer}
                    onClose={() => {
                        setTradingCardPlayer(null);
                        setTradingCardAnchorCol(null);
                    }}
                />
            </Box>
        );
    }

    const isNarrowLayout = termWidth < 110;
    const chartWidth = Math.max(30, Math.min(65, termWidth - 18));

    return (
        <Box flexDirection="column" paddingX={1} paddingTop={1} borderStyle="round" borderColor="cyan">
            {/* Top Row: Quarter Scoring */}
            <Box flexDirection="column">
                <QuarterScoreTable
                    awayTeam={boxScore.awayTeam}
                    homeTeam={boxScore.homeTeam}
                    currentPeriod={boxScore.period}
                    isLive={boxScore.gameStatus === 2}
                />

                {/* Live Momentum Surge & Milestones Banner */}
                {(momentumRun || milestones.length > 0) && (
                    <Box justifyContent="space-between" paddingX={1} marginBottom={1}>
                        {momentumRun ? (
                            <Text bold color="yellow">{momentumRun.description}</Text>
                        ) : <Box />}
                        {milestones.length > 0 ? (
                            <Text bold color="cyan">{milestones[0]?.playerName}: {milestones[0]?.milestone} ({milestones[0]?.summary})</Text>
                        ) : <Box />}
                    </Box>
                )}
            </Box>

            {/* Navigation Tab Bar */}
            <Box justifyContent="space-between" borderStyle="single" borderColor="gray" paddingX={1} marginBottom={1}>
                <Box>
                    <Text bold color={detailTab === 'boxscore' ? 'cyan' : 'gray'}>[1] Box Score</Text>
                    <Text> </Text>
                    <Text bold color={detailTab === 'lineups' ? 'cyan' : 'gray'}>[2] Live Lineups</Text>
                    <Text> </Text>
                    <Text bold color={detailTab === 'playbyplay' ? 'cyan' : 'gray'}>
                        [3] {game.gameStatus === 2 ? '▶ Live Stream' : 'Play-by-Play'}
                    </Text>
                    <Text> </Text>
                    <Text bold color={detailTab === 'leadtracker' ? 'cyan' : 'gray'}>[4] Lead Tracker</Text>
                </Box>
                <Box>
                    <Text color="yellow">[c] Court</Text>
                    <Text> </Text>
                    <Text color="yellow">[d] Duel</Text>
                    <Text> </Text>
                    <Text color="yellow">[v] Card</Text>
                </Box>
            </Box>

            {/* Tab 1: Box Score & Comparison (responsive stack on narrow terminals) */}
            {detailTab === 'boxscore' && (
                <Box flexDirection={isNarrowLayout ? 'column' : 'row'} justifyContent="center">
                    <BoxScoreTable
                        teamName={boxScore.awayTeam.teamCity || boxScore.awayTeam.teamTricode}
                        teamTricode={boxScore.awayTeam.teamTricode}
                        players={boxScore.awayTeam.players || []}
                        termWidth={termWidth}
                        stacked={isNarrowLayout}
                    />
                    <TeamStatsComparison
                        awayTeam={boxScore.awayTeam}
                        homeTeam={boxScore.homeTeam}
                        termWidth={termWidth}
                        stacked={isNarrowLayout}
                    />
                    <BoxScoreTable
                        teamName={boxScore.homeTeam.teamCity || boxScore.homeTeam.teamTricode}
                        teamTricode={boxScore.homeTeam.teamTricode}
                        players={boxScore.homeTeam.players || []}
                        termWidth={termWidth}
                        stacked={isNarrowLayout}
                    />
                </Box>
            )}

            {/* Tab 2: Live On Court & Lineups */}
            {detailTab === 'lineups' && (
                <Box flexDirection="column">
                    <LiveOnCourt
                        awayTeam={boxScore.awayTeam}
                        homeTeam={boxScore.homeTeam}
                        isActive={!isInlineLineupCard}
                        highlightSelected={isInlineLineupCard}
                        onPlayerSelect={(p, tricode, colIndex) => {
                            setTradingCardAnchorCol(colIndex);
                            setTradingCardPlayer({
                                personId: p.personId,
                                name: p.name || p.nameI || 'Player',
                                jerseyNum: p.jerseyNum || '-',
                                position: p.position || 'N/A',
                                teamTricode: tricode,
                                statistics: p.statistics || {}
                            });
                        }}
                        onModalStateChange={setIsStatsModalOpen}
                    />
                    {isInlineLineupCard && tradingCardPlayer && (() => {
                        const col = tradingCardAnchorCol ?? 0;
                        const cardWidth = 54;
                        const innerWidth = Math.max(56, termWidth - 6);
                        const lineupAreaWidth = Math.max(40, innerWidth - 11);
                        const targetX = Math.round(9 + (col / 5) * lineupAreaWidth);
                        const cardMarginLeft = Math.max(0, Math.min(targetX, Math.max(0, innerWidth - cardWidth)));
                        const pointerPad = Math.max(2, Math.min(cardWidth - 4, targetX - cardMarginLeft + 3));
                        return (
                            <Box flexDirection="column" marginLeft={cardMarginLeft}>
                                <Text color="cyan">{' '.repeat(pointerPad)}▲</Text>
                                <PlayerTradingCard
                                    player={tradingCardPlayer}
                                    onClose={() => {
                                        setTradingCardPlayer(null);
                                        setTradingCardAnchorCol(null);
                                    }}
                                />
                            </Box>
                        );
                    })()}
                </Box>
            )}

            {/* Tab 3: Play-by-Play Stream (uses live boxScore scores instead of stale map snapshot) */}
            {detailTab === 'playbyplay' && (
                <Box flexDirection="column" paddingX={1} borderStyle="round" borderColor="gray">
                    <PlayByPlayStream
                        actions={playByPlay}
                        homeTricode={game.homeTeam.teamTricode}
                        awayTricode={game.awayTeam.teamTricode}
                        homeName={game.homeTeam.teamName}
                        awayName={game.awayTeam.teamName}
                        homeScore={boxScore.homeTeam.score ?? game.homeTeam.score}
                        awayScore={boxScore.awayTeam.score ?? game.awayTeam.score}
                        isLive={boxScore.gameStatus === 2}
                        gameStatusText={boxScore?.gameStatusText || game.gameStatusText}
                        isActive={true}
                    />
                </Box>
            )}

            {/* Tab 4: Lead Tracker Chart (margin mode!) */}
            {detailTab === 'leadtracker' && (
                <Box flexDirection="column" alignItems="center" paddingX={1} borderStyle="round" borderColor="gray">
                    <Box justifyContent="space-between" width="100%" marginBottom={1}>
                        <Text bold color="cyan">📈 Game Flow: Lead Margin Progression</Text>
                        <Text dimColor>+ = {game.homeTeam.teamTricode} Lead | - = {game.awayTeam.teamTricode} Lead</Text>
                    </Box>
                    {scoreCurve && scoreCurve.points.length > 0 ? (
                        <LeadTrackerChart
                            data={scoreCurve.points.map(p => p.homeScore - p.awayScore)}
                            teamColor={TEAM_BG_COLORS[game.homeTeam.teamTricode] || 'green'}
                            oppColor={TEAM_BG_COLORS[game.awayTeam.teamTricode] || 'red'}
                            teamLabel={game.homeTeam.teamTricode}
                            oppLabel={game.awayTeam.teamTricode}
                            width={chartWidth}
                            height={12}
                            mode="margin"
                        />
                    ) : (
                        <Box height={10} alignItems="center" justifyContent="center">
                            <Text dimColor>Scoring progression data is loading or not yet available.</Text>
                        </Box>
                    )}
                </Box>
            )}

            {/* Footer */}
            <Box paddingLeft={1} marginTop={1} justifyContent="space-between">
                <Box>
                    <Text color="magenta">[Esc] 🏠 Back</Text>
                    {totalGames && totalGames > 1 && gameIndex !== undefined && (
                        <Text dimColor>  •  [/] Game {gameIndex + 1}/{totalGames}</Text>
                    )}
                </Box>
                <Text dimColor>[1-4] Tabs • [c] Court • [d] Duel • [v] Card</Text>
            </Box>
        </Box>
    );
}

// Game Preview component for scheduled games
function GamePreview({ game, standings, odds, termWidth }: { game: Game; standings: TeamStanding[]; odds: GameOdds | null; termWidth: number }) {
    const { text: gameTime } = getGameStatusInfo(game);
    const CONTENT_WIDTH = Math.min(60, Math.max(44, termWidth - 8));

    const awayStanding = standings.find(s => s.TeamID === game.awayTeam.teamId);
    const homeStanding = standings.find(s => s.TeamID === game.homeTeam.teamId);

    const formatRecord = (standing: TeamStanding | undefined) => {
        if (!standing) return 'N/A';
        const conf = standing.Conference === 'East' ? 'East' : 'West';
        return `${standing.WINS}-${standing.LOSSES} (#${standing.PlayoffRank} ${conf})`;
    };

    const localTz = (() => {
        try {
            return Intl.DateTimeFormat(undefined, { timeZoneName: 'short' })
                .formatToParts(new Date())
                .find(p => p.type === 'timeZoneName')?.value || '';
        } catch {
            return '';
        }
    })();

    return (
        <Box flexDirection="column" paddingY={1} borderStyle="round" borderColor="cyan" alignItems="center" width="100%">
            <Box flexDirection="column" alignItems="center" marginBottom={1}>
                <Text bold color="cyan">🏀 GAME PREVIEW</Text>
            </Box>

            <Box flexDirection="column" alignItems="center" marginBottom={1}>
                <Text bold>{game.awayTeam.teamCity} {game.awayTeam.teamName} <Text dimColor> @ </Text> {game.homeTeam.teamCity} {game.homeTeam.teamName}</Text>
                <Box marginTop={1}>
                    <Text bold backgroundColor={TEAM_BG_COLORS[game.awayTeam.teamTricode] || '#333'} color={TEAM_TEXT_COLORS[game.awayTeam.teamTricode] || '#ffffff'}> {game.awayTeam.teamTricode} </Text>
                    <Text color="gray">  vs  </Text>
                    <Text bold backgroundColor={TEAM_BG_COLORS[game.homeTeam.teamTricode] || '#333'} color={TEAM_TEXT_COLORS[game.homeTeam.teamTricode] || '#ffffff'}> {game.homeTeam.teamTricode} </Text>
                </Box>
            </Box>

            <Box marginBottom={1}>
                <Text backgroundColor="green" color="black" bold> ⏰ {gameTime}{localTz ? ` (${localTz})` : ''} </Text>
            </Box>

            <Text dimColor>{'─'.repeat(CONTENT_WIDTH)}</Text>

            <Box width={CONTENT_WIDTH} justifyContent="space-between" marginY={1}>
                <Box flexDirection="column" alignItems="flex-start" width="45%">
                    <Text bold color="cyan">📊 Records</Text>
                    <Box marginTop={1} flexDirection="column">
                        <Box>
                            <Text bold backgroundColor={TEAM_BG_COLORS[game.awayTeam.teamTricode] || '#333'} color={TEAM_TEXT_COLORS[game.awayTeam.teamTricode] || '#ffffff'}> {game.awayTeam.teamTricode} </Text>
                            <Text> {formatRecord(awayStanding)}</Text>
                        </Box>
                        <Box marginTop={1}>
                            <Text bold backgroundColor={TEAM_BG_COLORS[game.homeTeam.teamTricode] || '#333'} color={TEAM_TEXT_COLORS[game.homeTeam.teamTricode] || '#ffffff'}> {game.homeTeam.teamTricode} </Text>
                            <Text> {formatRecord(homeStanding)}</Text>
                        </Box>
                    </Box>
                </Box>

                <Box minWidth={1}><Text dimColor>│</Text></Box>

                <Box flexDirection="column" alignItems="flex-start" width="45%">
                    <Text bold color="cyan">🔥 Last 10</Text>
                    <Box marginTop={1} flexDirection="column">
                        <Box>
                            <Text bold backgroundColor={TEAM_BG_COLORS[game.awayTeam.teamTricode] || '#333'} color={TEAM_TEXT_COLORS[game.awayTeam.teamTricode] || '#ffffff'}> {game.awayTeam.teamTricode} </Text>
                            <Text> {awayStanding?.L10 || 'N/A'}</Text>
                            {awayStanding?.strCurrentStreak && (
                                <Text color={awayStanding.strCurrentStreak.startsWith('W') ? 'green' : 'red'}> ({awayStanding.strCurrentStreak})</Text>
                            )}
                        </Box>
                        <Box marginTop={1}>
                            <Text bold backgroundColor={TEAM_BG_COLORS[game.homeTeam.teamTricode] || '#333'} color={TEAM_TEXT_COLORS[game.homeTeam.teamTricode] || '#ffffff'}> {game.homeTeam.teamTricode} </Text>
                            <Text> {homeStanding?.L10 || 'N/A'}</Text>
                            {homeStanding?.strCurrentStreak && (
                                <Text color={homeStanding.strCurrentStreak.startsWith('W') ? 'green' : 'red'}> ({homeStanding.strCurrentStreak})</Text>
                            )}
                        </Box>
                    </Box>
                </Box>
            </Box>

            {odds && odds.awayOdds > 0 && (
                <Box flexDirection="column" alignItems="center" width="100%">
                    <Text dimColor>{'─'.repeat(CONTENT_WIDTH)}</Text>
                    <Box marginY={1} gap={2}>
                        <Text bold color="cyan">📈 Polymarket:</Text>
                        <Text bold backgroundColor={TEAM_BG_COLORS[game.awayTeam.teamTricode] || '#333'} color={TEAM_TEXT_COLORS[game.awayTeam.teamTricode] || '#ffffff'}> {game.awayTeam.teamTricode} </Text>
                        <Text color="green" bold>{odds.awayOdds.toFixed(2)}</Text>
                        <Text dimColor>|</Text>
                        <Text color="green" bold>{odds.homeOdds.toFixed(2)}</Text>
                        <Text bold backgroundColor={TEAM_BG_COLORS[game.homeTeam.teamTricode] || '#333'} color={TEAM_TEXT_COLORS[game.homeTeam.teamTricode] || '#ffffff'}> {game.homeTeam.teamTricode} </Text>
                    </Box>

                    {odds.awayTokenId && (
                        <OddsCurve
                            clobId={odds.awayTokenId}
                            teamTricode={game.awayTeam.teamTricode}
                            oppTricode={game.homeTeam.teamTricode}
                        />
                    )}
                </Box>
            )}

            <Box borderStyle="single" borderTop={true} borderBottom={false} borderLeft={false} borderRight={false} borderColor="gray" paddingTop={1} width={CONTENT_WIDTH} justifyContent="center">
                <Text dimColor>[Esc] Back  •  [/] Prev/Next Game</Text>
            </Box>
        </Box>
    );
}

const BoxScoreTable = ({
    teamName,
    teamTricode,
    players,
    termWidth,
    stacked
}: {
    teamName: string;
    teamTricode: string;
    players: any[];
    termWidth: number;
    stacked: boolean;
}) => {
    const activePlayers = Array.isArray(players)
        ? players
            .filter((p: any) => p?.played === '1')
            .sort((a: any, b: any) => (b?.statistics?.points || 0) - (a?.statistics?.points || 0))
            .slice(0, stacked ? 6 : 10)
        : [];

    const teamBg = TEAM_BG_COLORS[teamTricode] || '#333';

    const tableWidth = stacked ? Math.max(36, termWidth - 8) : Math.floor(termWidth * 0.35);
    const statColWidth = 5;
    const nameWidth = Math.max(12, tableWidth - statColWidth * 3 - 8);

    return (
        <Box flexDirection="column" marginRight={stacked ? 0 : 1} marginBottom={stacked ? 1 : 0} borderStyle="round" borderColor={teamBg} padding={1} flexShrink={1}>
            <Box marginBottom={1}>
                <Text bold backgroundColor={teamBg} color={TEAM_TEXT_COLORS[teamTricode] || '#ffffff'}> {teamName} </Text>
                <Text bold> TOP PERFORMERS</Text>
            </Box>

            <Box flexDirection="column">
                <Box borderStyle="single" borderBottom={true} borderTop={false} borderLeft={false} borderRight={false} borderColor="gray" marginBottom={1}>
                    <Box width={nameWidth}><Text dimColor>PLAYER</Text></Box>
                    <Box width={statColWidth} justifyContent="flex-end"><Text dimColor>PTS</Text></Box>
                    <Box width={statColWidth} justifyContent="flex-end"><Text dimColor>REB</Text></Box>
                    <Box width={statColWidth} justifyContent="flex-end"><Text dimColor>AST</Text></Box>
                </Box>

                {activePlayers.map((p: any, idx: number) => {
                    let displayName = String(p?.nameI || p?.name || 'Player');
                    if (displayName.length > nameWidth) {
                        const parts = displayName.split(' ').filter(Boolean);
                        const first = parts[0] || '';
                        displayName = first ? `${first.charAt(0)}. ${parts.slice(1).join(' ')}` : displayName;
                        if (displayName.length > nameWidth) displayName = displayName.slice(0, Math.max(1, nameWidth - 2)) + '..';
                    }
                    const stats = p?.statistics || {};
                    return (
                        <Box key={p?.personId ?? idx} marginBottom={0}>
                            <Box width={nameWidth}><Text bold>{displayName}</Text></Box>
                            <Box width={statColWidth} justifyContent="flex-end"><Text bold color="cyan">{stats.points ?? 0}</Text></Box>
                            <Box width={statColWidth} justifyContent="flex-end"><Text dimColor>{stats.reboundsTotal ?? 0}</Text></Box>
                            <Box width={statColWidth} justifyContent="flex-end"><Text dimColor>{stats.assists ?? 0}</Text></Box>
                        </Box>
                    );
                })}
            </Box>
        </Box>
    );
};

interface Period {
    period: number;
    periodType: string;
    score: number;
}

interface TeamWithPeriods {
    teamTricode: string;
    score: number;
    periods?: Period[];
    statistics?: any;
}

interface QuarterScoreTableProps {
    awayTeam: TeamWithPeriods;
    homeTeam: TeamWithPeriods;
    currentPeriod?: number;
    isLive?: boolean;
}

const QuarterScoreTable = ({ awayTeam, homeTeam, currentPeriod = 0, isLive = false }: QuarterScoreTableProps) => {
    const awayPeriods = awayTeam.periods || [];
    const homePeriods = homeTeam.periods || [];

    const [breathDim, setBreathDim] = useState(false);
    useEffect(() => {
        if (!isLive || currentPeriod === 0) return;
        const timer = setInterval(() => setBreathDim(v => !v), 600);
        return () => clearInterval(timer);
    }, [isLive, currentPeriod]);

    const maxPeriods = Math.max(awayPeriods.length, homePeriods.length, 4);

    const getPeriodLabel = (idx: number) => (idx < 4 ? `Q${idx + 1}` : `OT${idx - 3}`);

    const getScore = (periods: Period[], idx: number) => {
        const period = periods.find(p => p.period === idx + 1);
        return period?.score ?? '-';
    };

    const awayBg = TEAM_BG_COLORS[awayTeam.teamTricode] || '#333';
    const homeBg = TEAM_BG_COLORS[homeTeam.teamTricode] || '#333';
    const isCurrentPeriod = (idx: number) => isLive && (idx + 1) === currentPeriod;

    const renderTimeouts = (stats?: any) => {
        if (!stats || typeof stats.timeoutsRemaining !== 'number') return null;
        const total = 7;
        const rem = Math.max(0, Math.min(total, stats.timeoutsRemaining));
        return (
            <Box marginLeft={1}>
                <Text dimColor>TO: </Text>
                <Text color="yellow">{'●'.repeat(rem)}</Text>
                <Text dimColor>{'○'.repeat(total - rem)}</Text>
            </Box>
        );
    };

    return (
        <Box flexDirection="column" marginBottom={1} borderStyle="single" borderColor="gray" paddingX={1} flexGrow={1}>
            <Text bold color="cyan">📊 Scoring by Quarter</Text>
            <Box flexDirection="column" marginTop={1}>
                <Box marginBottom={1}>
                    <Box width={7}><Text dimColor>TEAM</Text></Box>
                    {Array.from({ length: maxPeriods }, (_, i) => (
                        <Box key={i} width={6} justifyContent="center">
                            <Text dimColor={!isCurrentPeriod(i)} bold={isCurrentPeriod(i)} color={isCurrentPeriod(i) ? 'green' : undefined}>
                                {getPeriodLabel(i)}
                            </Text>
                        </Box>
                    ))}
                    <Box width={7} justifyContent="flex-end">
                        <Text dimColor bold>TOTAL</Text>
                    </Box>
                </Box>

                {/* Away Team Row */}
                <Box>
                    <Box width={7}>
                        <Text bold backgroundColor={awayBg} color={TEAM_TEXT_COLORS[awayTeam.teamTricode] || '#ffffff'}> {awayTeam.teamTricode} </Text>
                    </Box>
                    {Array.from({ length: maxPeriods }, (_, i) => (
                        <Box key={i} width={6} justifyContent="center">
                            <Text
                                color={isCurrentPeriod(i) ? 'green' : undefined}
                                bold={isCurrentPeriod(i)}
                                dimColor={isCurrentPeriod(i) && breathDim}
                            >
                                {getScore(awayPeriods, i)}
                            </Text>
                        </Box>
                    ))}
                    <Box width={7} justifyContent="flex-end">
                        <Text bold color={awayTeam.score > homeTeam.score ? 'green' : undefined}>
                            {awayTeam.score}
                        </Text>
                    </Box>
                    {awayTeam.statistics?.inBonus === '1' && (
                        <Box marginLeft={1}><Text bold backgroundColor="red" color="white"> BONUS </Text></Box>
                    )}
                    {renderTimeouts(awayTeam.statistics)}
                </Box>

                {/* Home Team Row */}
                <Box>
                    <Box width={7}>
                        <Text bold backgroundColor={homeBg} color={TEAM_TEXT_COLORS[homeTeam.teamTricode] || '#ffffff'}> {homeTeam.teamTricode} </Text>
                    </Box>
                    {Array.from({ length: maxPeriods }, (_, i) => (
                        <Box key={i} width={6} justifyContent="center">
                            <Text
                                color={isCurrentPeriod(i) ? 'green' : undefined}
                                bold={isCurrentPeriod(i)}
                                dimColor={isCurrentPeriod(i) && breathDim}
                            >
                                {getScore(homePeriods, i)}
                            </Text>
                        </Box>
                    ))}
                    <Box width={7} justifyContent="flex-end">
                        <Text bold color={homeTeam.score > awayTeam.score ? 'green' : undefined}>
                            {homeTeam.score}
                        </Text>
                    </Box>
                    {homeTeam.statistics?.inBonus === '1' && (
                        <Box marginLeft={1}><Text bold backgroundColor="red" color="white"> BONUS </Text></Box>
                    )}
                    {renderTimeouts(homeTeam.statistics)}
                </Box>
            </Box>
        </Box>
    );
};

interface TeamStats {
    fieldGoalsMade?: number;
    fieldGoalsAttempted?: number;
    fieldGoalsPercentage?: number;
    threePointersMade?: number;
    threePointersAttempted?: number;
    threePointersPercentage?: number;
    freeThrowsMade?: number;
    freeThrowsAttempted?: number;
    freeThrowsPercentage?: number;
    reboundsTotal?: number;
    turnovers?: number;
    assists?: number;
}

interface TeamWithStats {
    teamTricode: string;
    score: number;
    statistics?: TeamStats;
}

const StatBar = ({ leftVal, rightVal, leftColor, rightColor, barWidth = 26 }: { leftVal: number; rightVal: number; leftColor: string; rightColor: string; barWidth?: number }) => {
    const safeWidth = Math.max(2, Math.floor(barWidth));
    const safeLeft = Number.isFinite(leftVal) ? Math.max(0, leftVal) : 0;
    const safeRight = Number.isFinite(rightVal) ? Math.max(0, rightVal) : 0;
    const total = safeLeft + safeRight;

    if (total === 0) {
        return <Text dimColor>{'─'.repeat(safeWidth)}</Text>;
    }

    const leftBars = Math.max(0, Math.min(safeWidth, Math.round((safeLeft / total) * safeWidth)));
    const rightBars = safeWidth - leftBars;

    return (
        <Text>
            <Text color={leftColor}>{'█'.repeat(leftBars)}</Text>
            <Text color={rightColor}>{'█'.repeat(rightBars)}</Text>
        </Text>
    );
};

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result || !result[1] || !result[2] || !result[3]) return null;
    return {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    };
}

function getColorDistance(hex1: string, hex2: string): number {
    const rgb1 = hexToRgb(hex1);
    const rgb2 = hexToRgb(hex2);
    if (!rgb1 || !rgb2) return 1000;
    return Math.sqrt(
        Math.pow(rgb1.r - rgb2.r, 2) +
        Math.pow(rgb1.g - rgb2.g, 2) +
        Math.pow(rgb1.b - rgb2.b, 2)
    );
}

const TeamStatsComparison = ({
    awayTeam,
    homeTeam,
    termWidth,
    stacked
}: {
    awayTeam: TeamWithStats;
    homeTeam: TeamWithStats;
    termWidth: number;
    stacked: boolean;
}) => {
    const awayStats = awayTeam.statistics || {};
    const homeStats = homeTeam.statistics || {};

    const awayBg = TEAM_BG_COLORS[awayTeam.teamTricode] || '#666';
    const homeBg = TEAM_BG_COLORS[homeTeam.teamTricode] || '#666';

    let awayBarColor = awayBg;
    let homeBarColor = homeBg;
    const COLLISION_THRESHOLD = 80;

    if (getColorDistance(awayBarColor, homeBarColor) < COLLISION_THRESHOLD) {
        const awayText = TEAM_TEXT_COLORS[awayTeam.teamTricode] || '#ffffff';
        if (getColorDistance(awayText, homeBarColor) > COLLISION_THRESHOLD) {
            awayBarColor = awayText;
        } else {
            const homeText = TEAM_TEXT_COLORS[homeTeam.teamTricode] || '#ffffff';
            if (getColorDistance(awayBarColor, homeText) > COLLISION_THRESHOLD) {
                homeBarColor = homeText;
            } else {
                awayBarColor = '#CCCCCC';
            }
        }
    }

    const formatPct = (pct: number | undefined) => pct !== undefined ? `${Math.round(pct * 100)}%` : '-';
    const formatShots = (made: number | undefined, att: number | undefined) =>
        made !== undefined && att !== undefined ? `(${made}-${att})` : '';

    const stats = [
        {
            label: 'Field Goal %',
            awayVal: awayStats.fieldGoalsPercentage || 0,
            homeVal: homeStats.fieldGoalsPercentage || 0,
            awayDisplay: formatPct(awayStats.fieldGoalsPercentage),
            homeDisplay: formatPct(homeStats.fieldGoalsPercentage),
            awaySub: formatShots(awayStats.fieldGoalsMade, awayStats.fieldGoalsAttempted),
            homeSub: formatShots(homeStats.fieldGoalsMade, homeStats.fieldGoalsAttempted),
        },
        {
            label: '3-Point %',
            awayVal: awayStats.threePointersPercentage || 0,
            homeVal: homeStats.threePointersPercentage || 0,
            awayDisplay: formatPct(awayStats.threePointersPercentage),
            homeDisplay: formatPct(homeStats.threePointersPercentage),
            awaySub: formatShots(awayStats.threePointersMade, awayStats.threePointersAttempted),
            homeSub: formatShots(homeStats.threePointersMade, homeStats.threePointersAttempted),
        },
        {
            label: 'Free Throw %',
            awayVal: awayStats.freeThrowsPercentage || 0,
            homeVal: homeStats.freeThrowsPercentage || 0,
            awayDisplay: formatPct(awayStats.freeThrowsPercentage),
            homeDisplay: formatPct(homeStats.freeThrowsPercentage),
            awaySub: formatShots(awayStats.freeThrowsMade, awayStats.freeThrowsAttempted),
            homeSub: formatShots(homeStats.freeThrowsMade, homeStats.freeThrowsAttempted),
        },
        {
            label: 'Rebounds',
            awayVal: awayStats.reboundsTotal || 0,
            homeVal: homeStats.reboundsTotal || 0,
            awayDisplay: String(awayStats.reboundsTotal || 0),
            homeDisplay: String(homeStats.reboundsTotal || 0),
        },
        {
            label: 'Turnovers',
            awayVal: homeStats.turnovers || 0, // Inverted (fewer turnovers is better)
            homeVal: awayStats.turnovers || 0,
            awayDisplay: String(awayStats.turnovers || 0),
            homeDisplay: String(homeStats.turnovers || 0),
        },
        {
            label: 'Assists',
            awayVal: awayStats.assists || 0,
            homeVal: homeStats.assists || 0,
            awayDisplay: String(awayStats.assists || 0),
            homeDisplay: String(homeStats.assists || 0),
        },
    ];

    const panelWidth = stacked ? Math.max(36, termWidth - 10) : Math.floor(termWidth * 0.30) - 6;
    const sideWidth = 8;
    const barWidth = Math.max(10, panelWidth - sideWidth * 2);

    return (
        <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1} marginX={stacked ? 0 : 1} marginBottom={stacked ? 1 : 0}>
            <Box justifyContent="center" marginBottom={1}>
                <Text bold color="cyan">📊 Team Stats</Text>
            </Box>

            <Box marginBottom={1}>
                <Box width={sideWidth} justifyContent="flex-start">
                    <Text bold backgroundColor={awayBg} color={TEAM_TEXT_COLORS[awayTeam.teamTricode] || '#ffffff'}> {awayTeam.teamTricode} </Text>
                </Box>
                <Box width={barWidth} justifyContent="center" />
                <Box width={sideWidth} justifyContent="flex-end">
                    <Text bold backgroundColor={homeBg} color={TEAM_TEXT_COLORS[homeTeam.teamTricode] || '#ffffff'}> {homeTeam.teamTricode} </Text>
                </Box>
            </Box>

            {stats.map((stat, i) => (
                <Box key={i} flexDirection="column" marginBottom={0}>
                    <Box>
                        <Box width={sideWidth} justifyContent="flex-start">
                            <Text bold color={stat.awayVal > stat.homeVal ? 'green' : undefined}>
                                {stat.awayVal > stat.homeVal ? '★ ' : ''}{stat.awayDisplay}
                            </Text>
                        </Box>
                        <Box width={barWidth} justifyContent="center">
                            <StatBar leftVal={stat.awayVal} rightVal={stat.homeVal} leftColor={awayBarColor} rightColor={homeBarColor} barWidth={barWidth} />
                        </Box>
                        <Box width={sideWidth} justifyContent="flex-end">
                            <Text bold color={stat.homeVal > stat.awayVal ? 'green' : undefined}>
                                {stat.homeDisplay}{stat.homeVal > stat.awayVal ? ' ★' : ''}
                            </Text>
                        </Box>
                    </Box>
                    <Box>
                        <Box width={sideWidth} justifyContent="flex-start">
                            <Text dimColor>{stat.awaySub || ''}</Text>
                        </Box>
                        <Box width={barWidth} justifyContent="center">
                            <Text dimColor>{stat.label}</Text>
                        </Box>
                        <Box width={sideWidth} justifyContent="flex-end">
                            <Text dimColor>{stat.homeSub || ''}</Text>
                        </Box>
                    </Box>
                </Box>
            ))}
        </Box>
    );
};
