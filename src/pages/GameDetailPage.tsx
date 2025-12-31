import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import { Game, fetchBoxScore, fetchStandings, fetchPolymarketOdds, getOddsKey, getGameStatusInfo, type GameOdds, fetchGameHeat, fetchGameTweets, type SocialHeat, type Tweet } from '../services/apiClient.js';
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

        Promise.all([
            fetchGameHeat(team1, team2),
            fetchGameTweets(team1, team2)
        ]).then(([heatData, tweetsData]) => {
            if (mounted) {
                setSocialHeat(heatData);
                setTweets(tweetsData);
            }
        });

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
            fetchBoxScore(game.gameId).then(data => {
                if (mounted) {
                    setBoxScore(data);
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

            <Box flexDirection="column" marginTop={1}>
                <Box flexDirection="row" justifyContent="space-around">
                    <BoxScoreTable teamName={boxScore.awayTeam.teamTricode} players={boxScore.awayTeam.players} />
                    <BoxScoreTable teamName={boxScore.homeTeam.teamTricode} players={boxScore.homeTeam.players} />
                </Box>
            </Box>

            {/* Social Buzz Section */}
            {tweets.length > 0 && (
                <Box flexDirection="column" marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
                    <Text bold color="cyan">💬 Social Buzz (r/nba)</Text>
                    {tweets.slice(0, 3).map((t, i) => (
                        <Box key={i} flexDirection="column" marginTop={1}>
                            <Text dimColor>@{t.user} • {t.likes} pts</Text>
                            <Text>"{t.text}"</Text>
                        </Box>
                    ))}
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
                    <Box flexDirection="column" marginTop={1} paddingX={1}>
                        <Text bold color="cyan" alignSelf="center">💬 Pre-Game Chatter</Text>
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

const BoxScoreTable = ({ teamName, players }: { teamName: string, players: any[] }) => {
    // Sort active players by points
    const activePlayers = players
        ? players
            .filter((p: any) => p.played === '1')
            .sort((a: any, b: any) => b.statistics.points - a.statistics.points)
            .slice(0, 5)
        : [];

    return (
        <Box flexDirection="column" marginRight={2}>
            <Text bold underline>{teamName} Top Performers</Text>
            <Box flexDirection="column" marginTop={1}>
                <Box borderStyle="single" borderBottom={false} borderTop={false} borderLeft={false} borderRight={false}>
                    <Box width={22}><Text dimColor>PLAYER</Text></Box>
                    <Box width={5}><Text dimColor>PTS</Text></Box>
                    <Box width={5}><Text dimColor>REB</Text></Box>
                    <Box width={5}><Text dimColor>AST</Text></Box>
                </Box>
                {activePlayers.map((p: any) => {
                    // Smart name formatting: keep first initial + reasonable last name
                    let displayName = p.nameI || '';
                    if (displayName.length > 20) {
                        // Try to shorten hyphenated names (e.g., "Gilgeous-Alexander" -> "Gilgeous-Alex")
                        const parts = displayName.split(' ');
                        if (parts.length >= 2) {
                            const firstName = parts[0];
                            let lastName = parts.slice(1).join(' ');
                            if (lastName.length > 16) {
                                // Keep first 14 chars of last name
                                lastName = lastName.slice(0, 14);
                            }
                            displayName = `${firstName} ${lastName}`;
                        }
                    }
                    return (
                        <Box key={p.personId}>
                            <Box width={22}><Text>{displayName}</Text></Box>
                            <Box width={5}><Text>{p.statistics.points}</Text></Box>
                            <Box width={5}><Text>{p.statistics.reboundsTotal}</Text></Box>
                            <Box width={5}><Text>{p.statistics.assists}</Text></Box>
                        </Box>
                    );
                })}
            </Box>
        </Box>
    );
};
