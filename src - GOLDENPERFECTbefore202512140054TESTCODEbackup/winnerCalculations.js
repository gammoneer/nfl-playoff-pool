// ============================================================================
// WINNER CALCULATIONS - NFL PLAYOFF POOL
// ============================================================================
// This file contains all tiebreaker logic for determining prize winners
// across all weeks and grand prizes.
// ============================================================================

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate total points for a specific week
 * @param {Object} playerPicks - Player's picks object with game predictions
 * @param {string} week - Week identifier (wildcard, divisional, conference, superbowl)
 * @returns {number} - Total predicted points for that week
 */
export function calculateWeekTotal(playerPicks, week) {
  if (!playerPicks || !playerPicks[week]) return 0;
  
  let total = 0;
  const weekPicks = playerPicks[week];
  
  // Add up all game predictions for this week
  Object.keys(weekPicks).forEach(gameId => {
    const game = weekPicks[gameId];
    if (game && game.team1 !== undefined && game.team2 !== undefined) {
      total += parseInt(game.team1) + parseInt(game.team2);
    }
  });
  
  return total;
}

/**
 * Calculate actual total points for a week from actual scores
 * @param {Object} actualScores - Actual scores object
 * @param {string} week - Week identifier
 * @returns {number} - Total actual points for that week
 */
export function calculateActualWeekTotal(actualScores, week) {
  if (!actualScores || !actualScores[week]) return 0;
  
  let total = 0;
  const weekScores = actualScores[week];
  
  Object.keys(weekScores).forEach(gameId => {
    const game = weekScores[gameId];
    if (game && game.team1 !== undefined && game.team2 !== undefined) {
      total += parseInt(game.team1) + parseInt(game.team2);
    }
  });
  
  return total;
}

/**
 * Determine winning teams for each game in a week
 * @param {Object} actualScores - Actual scores object
 * @param {string} week - Week identifier
 * @returns {Object} - Map of gameId to winning team ("team1" or "team2")
 */
export function getActualWinners(actualScores, week) {
  if (!actualScores || !actualScores[week]) return {};
  
  const winners = {};
  const weekScores = actualScores[week];
  
  Object.keys(weekScores).forEach(gameId => {
    const game = weekScores[gameId];
    if (game && game.team1 !== undefined && game.team2 !== undefined) {
      const score1 = parseInt(game.team1);
      const score2 = parseInt(game.team2);
      
      if (score1 > score2) {
        winners[gameId] = 'team1';
      } else if (score2 > score1) {
        winners[gameId] = 'team2';
      }
      // If tied, no winner assigned (shouldn't happen in NFL playoffs)
    }
  });
  
  return winners;
}

/**
 * Count how many winning teams a player picked correctly for a week
 * @param {Object} playerPicks - Player's picks object
 * @param {Object} actualWinners - Map of gameId to winning team
 * @param {string} week - Week identifier
 * @returns {number} - Count of correct winner predictions
 */
export function countCorrectWinners(playerPicks, actualWinners, week) {
  if (!playerPicks || !playerPicks[week]) return 0;
  
  let correctCount = 0;
  const weekPicks = playerPicks[week];
  
  Object.keys(actualWinners).forEach(gameId => {
    const actualWinner = actualWinners[gameId];
    const playerGame = weekPicks[gameId];
    
    if (playerGame && playerGame.team1 !== undefined && playerGame.team2 !== undefined) {
      const score1 = parseInt(playerGame.team1);
      const score2 = parseInt(playerGame.team2);
      
      let playerWinner = null;
      if (score1 > score2) {
        playerWinner = 'team1';
      } else if (score2 > score1) {
        playerWinner = 'team2';
      }
      
      if (playerWinner === actualWinner) {
        correctCount++;
      }
    }
  });
  
  return correctCount;
}

/**
 * Calculate absolute difference between predicted and actual
 * @param {number} predicted - Predicted value
 * @param {number} actual - Actual value
 * @returns {number} - Absolute difference
 */
export function calculateDifference(predicted, actual) {
  return Math.abs(predicted - actual);
}

// ============================================================================
// WEEK 1-3 PRIZE #2: CLOSEST TOTAL POINTS
// ============================================================================

/**
 * Calculate Week Prize #2: Closest Total Points
 * Works for weeks 1, 2, and 3
 * 
 * @param {Object} allPicks - All player picks from Firebase
 * @param {Object} actualScores - Actual scores from Firebase
 * @param {string} week - Week identifier (wildcard, divisional, conference)
 * @returns {Object} - Winner object with details
 */
export function calculateWeekPrize2(allPicks, actualScores, week) {
  // Calculate actual total for the week
  const actualTotal = calculateActualWeekTotal(actualScores, week);
  
  // If no actual scores yet, return "not scored"
  if (actualTotal === 0) {
    return {
      status: 'not_scored',
      winner: null,
      message: 'Waiting for game results'
    };
  }
  
  // Calculate each player's predicted total and difference
  const playerResults = [];
  
  Object.keys(allPicks).forEach(playerCode => {
    const playerData = allPicks[playerCode];
    const playerName = playerData.name;
    const playerPicks = playerData.picks;
    
    // Skip if player didn't enter picks for this week
    if (!playerPicks || !playerPicks[week]) {
      return;
    }
    
    const predictedTotal = calculateWeekTotal(playerPicks, week);
    const difference = calculateDifference(predictedTotal, actualTotal);
    
    playerResults.push({
      name: playerName,
      code: playerCode,
      predictedTotal,
      difference
    });
  });
  
  // If no players entered picks, return
  if (playerResults.length === 0) {
    return {
      status: 'no_picks',
      winner: null,
      message: 'No picks submitted for this week'
    };
  }
  
  // Find the smallest difference
  const minDifference = Math.min(...playerResults.map(p => p.difference));
  
// Find all players with that smallest difference (handles ties)
  const closestPlayers = playerResults.filter(p => p.difference === minDifference);
  
  // Check if we actually found any players with valid picks
  if (closestPlayers.length === 0) {
    return {
      status: 'no_picks',
      winner: null,
      message: 'No valid picks submitted for this week'
    };
  }
  
  // Determine if it's a true tie or single winner
  const isTrueTie = closestPlayers.length > 1;
  
  return {
    status: 'calculated',
    winner: isTrueTie ? closestPlayers.map(p => p.name) : closestPlayers[0].name,
    winnerCode: isTrueTie ? closestPlayers.map(p => p.code) : closestPlayers[0].code,
    actualTotal,
    predictedTotal: closestPlayers[0].predictedTotal,
    difference: minDifference,
    tiebreakerUsed: false,
    isTrueTie,
    tiedPlayers: isTrueTie ? closestPlayers.map(p => p.name) : null,
    // For display
    allPlayerResults: playerResults.sort((a, b) => a.difference - b.difference)
  };
}

// ============================================================================
// EXPORT ALL FUNCTIONS
// ============================================================================

export default {
  // Helper functions
  calculateWeekTotal,
  calculateActualWeekTotal,
  getActualWinners,
  countCorrectWinners,
  calculateDifference,
  
  // Prize calculation functions
  calculateWeekPrize2
};
