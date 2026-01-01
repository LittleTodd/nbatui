import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import { type Game, fetchBoxScore, fetchStandings, fetchPolymarketOdds, getOddsKey, getGameStatusInfo, type GameOdds, fetchGameHeat, fetchGameTweets, type SocialHeat, type Tweet } from '../services/apiClient.js';
import { TEAM_BG_COLORS } from '../data/teamColors.js';
import { HeatIndicator } from '../components/HeatIndicator.js';

interface GameDetailPageProps {
    game: Game;
    onBack: () => void;
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
    L10: string;  // Last 10 games, e.g. "6-4"
    strCurrentStreak: string;  // Current streak, e.g. "W 2" or "L 3"
}

export function GameDetailPage({ game, onBack }: GameDetailPageProps) {
    const [boxScore, setBoxScore] = useState<any>(null);
    const [standings, setStandings] = useState<TeamStanding[]>([]);
    const [odds, setOdds] = useState<GameOdds | null>(null);
    const [loading, setLoading] = useState(true);
    const [socialHeat, setSocialHeat] = useState<SocialHeat | null>(null);
    const [tweets, setTweets] = useState<Tweet[]>([]);

    const isScheduled = game.gameStatus === 1;

    useEffect(() => {
        let mounted = true;
        setLoading(true);

        // Fetch Social Data (Parallel)
        const team1 = game.awayTeam.teamName;
        const team2 = game.homeTeam.teamName;

        // Check for 6-month limit
        const gameDateStr = game.gameTimeUTC?.slice(0, 10);
        let skipSocial = false;
        if (gameDateStr) {
            const gameDate = new Date(gameDateStr);
            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
            if (gameDate < sixMonthsAgo) {
                skipSocial = true;
            }
        }

        if (!skipSocial) {
            Promise.all([
                fetchGameHeat(team1, team2, game.gameStatus, gameDateStr),
                fetchGameTweets(team1, team2, game.gameStatus, gameDateStr)
            ]).then(([heatData, tweetsData]) => {
                if (mounted) {
                    setSocialHeat(heatData);
                    setTweets(tweetsData);
                }
            });
        }

        if (isScheduled) {
            // For scheduled games, fetch standings and odds for preview
            Promise.all([
                fetchStandings(),
                fetchPolymarketOdds()
            ]).then(([standingsData, oddsData]) => {
                if (mounted) {
                    // API returns {standings: [...], count: N} format
                    const standingsArray = standingsData?.standings || [];
                    setStandings(Array.isArray(standingsArray) ? standingsArray : []);
                    // Find odds for this game
                    const gameDate = game.gameTimeUTC?.slice(0, 10) || '';
                    let gameOdds = oddsData[getOddsKey(game.awayTeam.teamTricode, game.homeTeam.teamTricode, gameDate)];
                    // Try next day if not found (Polymarket often uses next day)
                    if (!gameOdds && gameDate) {
                        const nextDay = new Date(gameDate);
                        nextDay.setDate(nextDay.getDate() + 1);
                        const nextDayStr = nextDay.toISOString().slice(0, 10);
                        gameOdds = oddsData[getOddsKey(game.awayTeam.teamTricode, game.homeTeam.teamTricode, nextDayStr)];
                    }
                    setOdds(gameOdds || null);
                    setLoading(false);
                }
            });
        } else {
            // For live/completed games, fetch boxscore
            fetchBoxScore(game.gameId).then((boxData: any) => {
                if (mounted) {
                    setBoxScore(boxData);
                    setLoading(false);
                }
            });
        }

        return () => { mounted = false; };
    }, [game.gameId, isScheduled]);

    useInput((input, key) => {
        if (key.escape || input === 'q' || key.backspace) {
            onBack();
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
        return <GamePreview game={game} standings={standings} odds={odds} socialHeat={socialHeat} tweets={tweets} />;
    }

    // Live/completed game: show boxscore
    if (!boxScore) {
        return (
            <Box flexDirection="column" alignItems="center">
                <Text color="red">Failed to load game data.</Text>
                <Text>Press Esc to return.</Text>
            </Box>
        );
    }

    return (
        <Box flexDirection="column" padding={1} borderStyle="round" borderColor="cyan">
            <Box justifyContent="center" marginBottom={1} flexDirection="column" alignItems="center">
                <Text bold color="yellow">
                    {boxScore.awayTeam.teamCity} {boxScore.awayTeam.teamName} ({boxScore.awayTeam.score})
                    {' @ '}
                    {boxScore.homeTeam.teamCity} {boxScore.homeTeam.teamName} ({boxScore.homeTeam.score})
                </Text>
                {socialHeat && socialHeat.level !== 'cold' && (
                    <Box marginTop={0}>
                        <HeatIndicator level={socialHeat.level} count={socialHeat.count} />
                    </Box>
                )}
            </Box>

            <Box marginBottom={1}>
                <Text>Status: {boxScore.gameStatusText}</Text>
            </Box>

            {/* Quarter-by-Quarter Scoring */}
            <QuarterScoreTable
                awayTeam={boxScore.awayTeam}
                homeTeam={boxScore.homeTeam}
            />

            <Divider />

            <Box flexDirection="row" justifyContent="center">
                <BoxScoreTable
                    teamName={boxScore.awayTeam.teamCity}
                    teamTricode={boxScore.awayTeam.teamTricode}
                    players={boxScore.awayTeam.players}
                />
                <BoxScoreTable
                    teamName={boxScore.homeTeam.teamCity}
                    teamTricode={boxScore.homeTeam.teamTricode}
                    players={boxScore.homeTeam.players}
                />
            </Box>

            <Divider />

            {/* Social Buzz Section */}
            {tweets.length > 0 && (
                <Box flexDirection="column" marginTop={1} paddingX={1} borderStyle="round" borderColor="gray">
                    <Text bold color="#ffcc00">💬 Social Buzz (r/nba)</Text>
                    <Box flexDirection="column" marginTop={1}>
                        {tweets.slice(0, 3).map((t, i) => (
                            <Box key={i} flexDirection="column" marginBottom={1}>
                                <Text dimColor>@{t.user} <Text color="green">^ {t.likes}</Text></Text>
                                <Text italic color="white">"{t.text}"</Text>
                            </Box>
                        ))}
                    </Box>
                </Box>
            )}

            <Box marginTop={2}>
                <Text dimColor>Press Esc to go back</Text>
            </Box>
        </Box>
    );
}

// Game Preview component for scheduled games
function GamePreview({ game, standings, odds, socialHeat, tweets }: { game: Game; standings: TeamStanding[]; odds: GameOdds | null; socialHeat: SocialHeat | null; tweets: Tweet[] }) {
    const { text: gameTime } = getGameStatusInfo(game);

    // Find standings for both teams
    const awayStanding = standings.find(s => s.TeamID === game.awayTeam.teamId);
    const homeStanding = standings.find(s => s.TeamID === game.homeTeam.teamId);

    const formatRecord = (standing: TeamStanding | undefined) => {
        if (!standing) return 'N/A';
        const conf = standing.Conference === 'East' ? 'East' : 'West';
        return `${standing.WINS}-${standing.LOSSES} (#${standing.PlayoffRank} ${conf})`;
    };

    return (
        <Box flexDirection="column" padding={1} borderStyle="round" borderColor="cyan">
            {/* Header */}
            <Box justifyContent="center" marginBottom={1} flexDirection="column" alignItems="center">
                <Text bold color="cyan">🏀 GAME PREVIEW</Text>
                {socialHeat && socialHeat.level !== 'cold' && (
                    <HeatIndicator level={socialHeat.level} count={socialHeat.count} />
                )}
            </Box>

            {/* Divider */}
            <Box justifyContent="center">
                <Text dimColor>{'─'.repeat(40)}</Text>
            </Box>

            {/* Matchup - Primary Focus */}
            <Box flexDirection="column" alignItems="center" marginY={1}>
                <Text bold color="white">
                    {game.awayTeam.teamCity} {game.awayTeam.teamName}
                </Text>
                <Text dimColor>  @  </Text>
                <Text bold color="white">
                    {game.homeTeam.teamCity} {game.homeTeam.teamName}
                </Text>
            </Box>

            <Box justifyContent="center" marginBottom={1}>
                <Text bold backgroundColor={TEAM_BG_COLORS[game.awayTeam.teamTricode] || '#333'} color="#ffffff"> {game.awayTeam.teamTricode} </Text>
                <Text color="gray">  vs  </Text>
                <Text bold backgroundColor={TEAM_BG_COLORS[game.homeTeam.teamTricode] || '#333'} color="#ffffff"> {game.homeTeam.teamTricode} </Text>
            </Box>

            {/* Tip-off time - Highlighted */}
            <Box justifyContent="center" paddingY={1} marginBottom={1}>
                <Text backgroundColor="green" color="black" bold> ⏰ {gameTime} </Text>
            </Box>

            {/* Divider */}
            <Box justifyContent="center">
                <Text dimColor>{'─'.repeat(40)}</Text>
            </Box>

            {/* Season Records */}
            <Box flexDirection="column" alignItems="center" marginY={1}>
                <Text bold color="cyan">📊 Season Records</Text>
                <Box marginTop={1} flexDirection="column">
                    <Box>
                        <Box minWidth={7}><Text bold backgroundColor={TEAM_BG_COLORS[game.awayTeam.teamTricode] || '#333'} color="#ffffff"> {game.awayTeam.teamTricode} </Text></Box>
                        <Text>  {formatRecord(awayStanding)}</Text>
                    </Box>
                    <Box>
                        <Box minWidth={7}><Text bold backgroundColor={TEAM_BG_COLORS[game.homeTeam.teamTricode] || '#333'} color="#ffffff"> {game.homeTeam.teamTricode} </Text></Box>
                        <Text>  {formatRecord(homeStanding)}</Text>
                    </Box>
                </Box>
            </Box>

            {/* Divider */}
            <Box justifyContent="center">
                <Text dimColor>{'─'.repeat(40)}</Text>
            </Box>

            {/* Recent Form - Last 10 Games */}
            <Box flexDirection="column" alignItems="center" marginY={1}>
                <Text bold color="cyan">🔥 Recent Form (L10)</Text>
                <Box marginTop={1} flexDirection="column">
                    <Box>
                        <Box minWidth={7}><Text bold backgroundColor={TEAM_BG_COLORS[game.awayTeam.teamTricode] || '#333'} color="#ffffff"> {game.awayTeam.teamTricode} </Text></Box>
                        <Text>  {awayStanding?.L10 || 'N/A'}</Text>
                        {awayStanding?.strCurrentStreak && (
                            <Text color={awayStanding.strCurrentStreak.startsWith('W') ? 'green' : 'red'} bold>
                                {' '}({awayStanding.strCurrentStreak})
                            </Text>
                        )}
                    </Box>
                    <Box>
                        <Box minWidth={7}><Text bold backgroundColor={TEAM_BG_COLORS[game.homeTeam.teamTricode] || '#333'} color="#ffffff"> {game.homeTeam.teamTricode} </Text></Box>
                        <Text>  {homeStanding?.L10 || 'N/A'}</Text>
                        {homeStanding?.strCurrentStreak && (
                            <Text color={homeStanding.strCurrentStreak.startsWith('W') ? 'green' : 'red'} bold>
                                {' '}({homeStanding.strCurrentStreak})
                            </Text>
                        )}
                    </Box>
                </Box>
            </Box>

            {/* Odds (if available) */}
            {odds && odds.awayOdds > 0 && (
                <>
                    {/* Divider */}
                    <Box justifyContent="center">
                        <Text dimColor>{'─'.repeat(40)}</Text>
                    </Box>

                    <Box flexDirection="column" alignItems="center" marginY={1}>
                        <Text bold color="cyan">📈 Odds (Polymarket)</Text>
                        <Box marginTop={1} gap={2}>
                            <Text bold backgroundColor={TEAM_BG_COLORS[game.awayTeam.teamTricode] || '#333'} color="#ffffff"> {game.awayTeam.teamTricode} </Text>
                            <Text color="green" bold>{odds.awayOdds.toFixed(2)}</Text>
                            <Text dimColor>|</Text>
                            <Text color="green" bold>{odds.homeOdds.toFixed(2)}</Text>
                            <Text bold backgroundColor={TEAM_BG_COLORS[game.homeTeam.teamTricode] || '#333'} color="#ffffff"> {game.homeTeam.teamTricode} </Text>
                        </Box>
                    </Box>
                </>
            )}

            {/* Social Buzz for Preview */}
            {tweets.length > 0 && (
                <>
                    <Box justifyContent="center">
                        <Text dimColor>{'─'.repeat(40)}</Text>
                    </Box>
                    <Box flexDirection="column" marginTop={1} paddingX={1} alignItems="center">
                        <Text bold color="cyan">💬 Pre-Game Chatter</Text>
                        {tweets.slice(0, 3).map((t, i) => (
                            <Box key={i} flexDirection="column" marginTop={1}>
                                <Text dimColor>@{t.user} • {t.likes} pts</Text>
                                <Text>"{t.text}"</Text>
                            </Box>
                        ))}
                    </Box>
                </>
            )}

            {/* Footer */}
            <Box justifyContent="center" marginTop={1}>
                <Text dimColor>{'─'.repeat(40)}</Text>
            </Box>
            <Box marginTop={1} justifyContent="center">
                <Text dimColor>Press Esc to go back</Text>
            </Box>
        </Box>
    );
}

const Divider = () => (
    <Box marginY={1} width="100%" justifyContent="center">
        <Text dimColor>──────────────────────────────────────────────────</Text>
    </Box>
);

const BoxScoreTable = ({ teamName, teamTricode, players }: { teamName: string, teamTricode: string, players: any[] }) => {
    // Sort active players by points
    const activePlayers = players
        ? players
            .filter((p: any) => p.played === '1')
            .sort((a: any, b: any) => b.statistics.points - a.statistics.points)
            .slice(0, 5)
        : [];

    const teamBg = TEAM_BG_COLORS[teamTricode] || '#333';

    return (
        <Box flexDirection="column" marginRight={2} borderStyle="round" borderColor={teamBg} padding={1}>
            {/* Header with Team Color Background */}
            <Box marginBottom={1}>
                <Text bold backgroundColor={teamBg} color="#ffffff"> {teamName} </Text>
                <Text bold> TOP PERFORMERS</Text>
            </Box>

            <Box flexDirection="column">
                {/* Table Header */}
                <Box borderStyle="single" borderBottom={true} borderTop={false} borderLeft={false} borderRight={false} borderColor="gray" marginBottom={1}>
                    <Box width={18}><Text dimColor>PLAYER</Text></Box>
                    <Box width={6} justifyContent="flex-end"><Text dimColor>PTS</Text></Box>
                    <Box width={6} justifyContent="flex-end"><Text dimColor>REB</Text></Box>
                    <Box width={6} justifyContent="flex-end"><Text dimColor>AST</Text></Box>
                </Box>

                {/* Rows */}
                {activePlayers.map((p: any) => {
                    // Smart name formatting
                    let displayName = p.nameI || '';
                    if (displayName.length > 18) {
                        const parts = displayName.split(' ');
                        displayName = parts[0].charAt(0) + '. ' + parts.slice(1).join(' ');
                        if (displayName.length > 18) displayName = displayName.slice(0, 16) + '..';
                    }
                    return (
                        <Box key={p.personId} marginBottom={0}>
                            <Box width={18}><Text color="white" bold>{displayName}</Text></Box>
                            <Box width={6} justifyContent="flex-end"><Text bold color="cyan">{p.statistics.points}</Text></Box>
                            <Box width={6} justifyContent="flex-end"><Text dimColor>{p.statistics.reboundsTotal}</Text></Box>
                            <Box width={6} justifyContent="flex-end"><Text dimColor>{p.statistics.assists}</Text></Box>
                        </Box>
                    );
                })}
            </Box>
        </Box>
    );
};

// Quarter-by-Quarter Scoring Table
interface Period {
    period: number;
    periodType: string;
    score: number;
}

interface TeamWithPeriods {
    teamTricode: string;
    score: number;
    periods?: Period[];
}

const QuarterScoreTable = ({ awayTeam, homeTeam }: { awayTeam: TeamWithPeriods; homeTeam: TeamWithPeriods }) => {
    const awayPeriods = awayTeam.periods || [];
    const homePeriods = homeTeam.periods || [];

    // Determine max periods (handles OT)
    const maxPeriods = Math.max(awayPeriods.length, homePeriods.length, 4);

    // Get period labels
    const getPeriodLabel = (idx: number) => {
        if (idx < 4) return `Q${idx + 1}`;
        return `OT${idx - 3}`;
    };

    // Get score for a period (0 if not available)
    const getScore = (periods: Period[], idx: number) => {
        const period = periods.find(p => p.period === idx + 1);
        return period?.score ?? '-';
    };

    const awayBg = TEAM_BG_COLORS[awayTeam.teamTricode] || '#333';
    const homeBg = TEAM_BG_COLORS[homeTeam.teamTricode] || '#333';

    return (
        <Box flexDirection="column" marginY={1} borderStyle="single" borderColor="gray" paddingX={1}>
            <Text bold color="cyan">📊 Scoring by Quarter</Text>
            <Box flexDirection="column" marginTop={1}>
                {/* Header Row */}
                <Box marginBottom={1}>
                    <Box width={7}><Text dimColor>TEAM</Text></Box>
                    {Array.from({ length: maxPeriods }, (_, i) => (
                        <Box key={i} width={6} justifyContent="center">
                            <Text dimColor>{getPeriodLabel(i)}</Text>
                        </Box>
                    ))}
                    <Box width={7} justifyContent="center">
                        <Text dimColor bold>TOTAL</Text>
                    </Box>
                </Box>

                {/* Away Team Row */}
                <Box>
                    <Box width={7}>
                        <Text bold backgroundColor={awayBg} color="#ffffff"> {awayTeam.teamTricode} </Text>
                    </Box>
                    {Array.from({ length: maxPeriods }, (_, i) => (
                        <Box key={i} width={6} justifyContent="center">
                            <Text color="white">{getScore(awayPeriods, i)}</Text>
                        </Box>
                    ))}
                    <Box width={7} justifyContent="center">
                        <Text bold color={awayTeam.score > homeTeam.score ? 'green' : 'white'}>
                            {awayTeam.score}
                        </Text>
                    </Box>
                </Box>

                {/* Home Team Row */}
                <Box>
                    <Box width={7}>
                        <Text bold backgroundColor={homeBg} color="#ffffff"> {homeTeam.teamTricode} </Text>
                    </Box>
                    {Array.from({ length: maxPeriods }, (_, i) => (
                        <Box key={i} width={6} justifyContent="center">
                            <Text color="white">{getScore(homePeriods, i)}</Text>
                        </Box>
                    ))}
                    <Box width={7} justifyContent="center">
                        <Text bold color={homeTeam.score > awayTeam.score ? 'green' : 'white'}>
                            {homeTeam.score}
                        </Text>
                    </Box>
                </Box>
            </Box>
        </Box>
    );
};




