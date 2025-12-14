// ============================================
// ESPN API SERVICE
// ============================================
// Fetches live NFL scores from ESPN API
// Returns: scores, game status, quarter, time remaining
// Auto-refreshes every 5 minutes during games
// Manual override controls per game

/**
 * ESPN API Endpoints for NFL
 * Scoreboard: https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard
 * 
 * Game Status Codes:
 * - "STATUS_SCHEDULED" = Not started
 * - "STATUS_IN_PROGRESS" = Live game
 * - "STATUS_HALFTIME" = Halftime
 * - "STATUS_END_PERIOD" = End of quarter
 * - "STATUS_FINAL" = Game finished
 * - "STATUS_FINAL_OVERTIME" = OT finished
 */

const ESPN_API_BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';

/**
 * Fetch current NFL scores from ESPN
 * @returns {Promise<Object>} Game data with scores and status
 */
export async function fetchESPNScores() {
  try {
    const response = await fetch(`${ESPN_API_BASE}/scoreboard`);
    
    if (!response.ok) {
      throw new Error(`ESPN API error: ${response.status}`);
    }
    
    const data = await response.json();
    return parseESPNData(data);
  } catch (error) {
    console.error('Error fetching ESPN scores:', error);
    return {
      success: false,
      error: error.message,
      games: []
    };
  }
}

/**
 * Parse ESPN API response into our game format
 * @param {Object} espnData - Raw ESPN API response
 * @returns {Object} Parsed game data
 */
function parseESPNData(espnData) {
  if (!espnData.events || espnData.events.length === 0) {
    return {
      success: true,
      games: [],
      message: 'No games currently available'
    };
  }

  const games = espnData.events.map(event => {
    const competition = event.competitions[0];
    const status = competition.status;
    const competitors = competition.competitors;

    // Determine home/away teams (ESPN uses 0=away, 1=home)
    const awayTeam = competitors.find(c => c.homeAway === 'away');
    const homeTeam = competitors.find(c => c.homeAway === 'home');

    // Get team abbreviations and scores
    const awayAbbrev = awayTeam.team.abbreviation;
    const homeAbbrev = homeTeam.team.abbreviation;
    const awayScore = parseInt(awayTeam.score) || 0;
    const homeScore = parseInt(homeTeam.score) || 0;

    // Parse game status
    const gameStatus = parseGameStatus(status);

    // Get game ID (ESPN's unique ID)
    const espnGameId = event.id;

    return {
      espnGameId,
      awayTeam: {
        abbreviation: awayAbbrev,
        fullName: awayTeam.team.displayName,
        score: awayScore
      },
      homeTeam: {
        abbreviation: homeAbbrev,
        fullName: homeTeam.team.displayName,
        score: homeScore
      },
      status: gameStatus.status,
      statusText: gameStatus.text,
      period: gameStatus.period,
      clock: gameStatus.clock,
      isFinal: gameStatus.isFinal,
      isLive: gameStatus.isLive,
      isScheduled: gameStatus.isScheduled,
      startTime: event.date,
      lastUpdated: new Date().toISOString()
    };
  });

  return {
    success: true,
    games,
    fetchedAt: new Date().toISOString()
  };
}

/**
 * Parse ESPN game status into readable format
 * @param {Object} status - ESPN status object
 * @returns {Object} Parsed status
 */
function parseGameStatus(status) {
  const statusType = status.type.name;
  const period = status.period;
  const clock = status.displayClock;
  const detail = status.type.detail;

  // Determine status
  let gameStatus = 'scheduled';
  let statusText = detail;
  let isLive = false;
  let isFinal = false;
  let isScheduled = false;

  if (statusType === 'STATUS_SCHEDULED') {
    gameStatus = 'scheduled';
    statusText = `Scheduled`;
    isScheduled = true;
  } else if (statusType === 'STATUS_IN_PROGRESS') {
    gameStatus = 'live';
    isLive = true;
    
    // Determine quarter/period text
    if (period === 1) statusText = `1st Quarter - ${clock}`;
    else if (period === 2) statusText = `2nd Quarter - ${clock}`;
    else if (period === 3) statusText = `3rd Quarter - ${clock}`;
    else if (period === 4) statusText = `4th Quarter - ${clock}`;
    else if (period > 4) statusText = `OT ${period - 4} - ${clock}`;
    
  } else if (statusType === 'STATUS_HALFTIME') {
    gameStatus = 'halftime';
    statusText = 'Halftime';
    isLive = true;
  } else if (statusType === 'STATUS_END_PERIOD') {
    gameStatus = 'live';
    statusText = `End of ${period === 1 ? '1st' : period === 2 ? '2nd' : period === 3 ? '3rd' : '4th'} Quarter`;
    isLive = true;
  } else if (statusType === 'STATUS_FINAL' || statusType === 'STATUS_FINAL_OVERTIME') {
    gameStatus = 'final';
    isFinal = true;
    
    if (statusType === 'STATUS_FINAL_OVERTIME') {
      statusText = period > 4 ? `Final/OT${period - 4}` : 'Final/OT';
    } else {
      statusText = 'Final';
    }
  }

  return {
    status: gameStatus,
    text: statusText,
    period: period,
    clock: clock || '',
    isLive,
    isFinal,
    isScheduled
  };
}

/**
 * Map ESPN team abbreviation to your playoff team format
 * This function maps ESPN's team codes to your playoff pool structure
 * 
 * @param {string} espnAbbrev - ESPN team abbreviation (e.g., "KC", "BUF")
 * @param {Object} playoffWeeks - Your PLAYOFF_WEEKS structure
 * @param {string} week - Current week (wildcard, divisional, conference, superbowl)
 * @returns {Object|null} Matched game or null
 */
export function mapESPNGameToPlayoffGame(espnGame, playoffWeeks, week, teamCodes) {
  // If you have team codes set (e.g., "PIT" vs "BUF"), match against those
  if (!teamCodes || !teamCodes[week]) {
    return null;
  }

  const weekGames = playoffWeeks[week].games;
  const weekTeamCodes = teamCodes[week];

  // Try to find matching game by team codes
  for (const game of weekGames) {
    const gameTeamCodes = weekTeamCodes[game.id];
    
    if (!gameTeamCodes) continue;

    const matchesTeam1 = gameTeamCodes.team1 === espnGame.awayTeam.abbreviation || 
                        gameTeamCodes.team1 === espnGame.homeTeam.abbreviation;
    const matchesTeam2 = gameTeamCodes.team2 === espnGame.awayTeam.abbreviation || 
                        gameTeamCodes.team2 === espnGame.homeTeam.abbreviation;

    if (matchesTeam1 && matchesTeam2) {
      // Found match! Determine which team is which
      const team1IsAway = gameTeamCodes.team1 === espnGame.awayTeam.abbreviation;
      
      return {
        gameId: game.id,
        team1Score: team1IsAway ? espnGame.awayTeam.score : espnGame.homeTeam.score,
        team2Score: team1IsAway ? espnGame.homeTeam.score : espnGame.awayTeam.score,
        status: espnGame.status,
        statusText: espnGame.statusText,
        period: espnGame.period,
        clock: espnGame.clock,
        isFinal: espnGame.isFinal,
        isLive: espnGame.isLive,
        espnGameId: espnGame.espnGameId
      };
    }
  }

  return null;
}

/**
 * Auto-refresh manager
 * Handles automatic fetching every 5 minutes during live games
 */
export class ESPNAutoRefresh {
  constructor(onFetch, intervalMinutes = 5) {
    this.onFetch = onFetch;
    this.intervalMinutes = intervalMinutes;
    this.intervalId = null;
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) {
      console.log('Auto-refresh already running');
      return;
    }

    console.log(`Starting auto-refresh every ${this.intervalMinutes} minutes`);
    this.isRunning = true;

    // Fetch immediately
    this.onFetch();

    // Then set interval
    this.intervalId = setInterval(() => {
      console.log('Auto-fetching ESPN scores...');
      this.onFetch();
    }, this.intervalMinutes * 60 * 1000);
  }

  stop() {
    if (!this.isRunning) {
      console.log('Auto-refresh not running');
      return;
    }

    console.log('Stopping auto-refresh');
    clearInterval(this.intervalId);
    this.intervalId = null;
    this.isRunning = false;
  }

  isActive() {
    return this.isRunning;
  }

  setInterval(minutes) {
    this.intervalMinutes = minutes;
    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }
}

export default {
  fetchESPNScores,
  mapESPNGameToPlayoffGame,
  ESPNAutoRefresh
};
