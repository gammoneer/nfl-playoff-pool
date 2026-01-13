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
// WEEK 1-3 PRIZE #1: MOST CORRECT WINNERS
// ============================================================================

/**
 * Calculate Week Prize #1: Most Correct Winners
 * Works for weeks 1, 2, and 3
 * Tiebreaker: Closest to actual total points (among tied players only)
 * 
 * @param {Object} allPicks - All player picks from Firebase
 * @param {Object} actualScores - Actual scores from Firebase
 * @param {string} week - Week identifier (wildcard, divisional, conference)
 * @returns {Object} - Winner object with details
 */
export function calculateWeekPrize1(allPicks, actualScores, week) {
  // Get actual winners for the week
  const actualWinners = getActualWinners(actualScores, week);
  
  // If no actual scores yet, return "not scored"
  if (Object.keys(actualWinners).length === 0) {
    return {
      status: 'not_scored',
      winner: null,
      message: 'Waiting for game results'
    };
  }
  
  // Calculate actual total for tiebreaker
  const actualTotal = calculateActualWeekTotal(actualScores, week);
  
  // Count correct winners for each player
  const playerResults = [];
  
  Object.keys(allPicks).forEach(playerCode => {
    const playerData = allPicks[playerCode];
    const playerName = playerData.name;
    const playerPicks = playerData.picks;
    
    // Skip if player didn't enter picks for this week
    if (!playerPicks || !playerPicks[week]) {
      return;
    }
    
    const correctWinners = countCorrectWinners(playerPicks, actualWinners, week);
    const predictedTotal = calculateWeekTotal(playerPicks, week);
    const difference = calculateDifference(predictedTotal, actualTotal);
    
    playerResults.push({
      name: playerName,
      code: playerCode,
      correctWinners,
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
  
  // Find the highest count of correct winners
  const maxCorrect = Math.max(...playerResults.map(p => p.correctWinners));
  
  // Find all players with that highest count
  const topPlayers = playerResults.filter(p => p.correctWinners === maxCorrect);
  
  // If only one player has the most correct, they win
  if (topPlayers.length === 1) {
    return {
      status: 'calculated',
      winner: topPlayers[0].name,
      winnerCode: topPlayers[0].code,
      correctWinners: maxCorrect,
      tiebreakerUsed: false,
      isTrueTie: false,
      tiedPlayers: null,
      allPlayerResults: playerResults.sort((a, b) => b.correctWinners - a.correctWinners)
    };
  }
  
  // TIEBREAKER: Use total points difference among tied players
  const minDifference = Math.min(...topPlayers.map(p => p.difference));
  const winners = topPlayers.filter(p => p.difference === minDifference);
  
  // Check if still tied after tiebreaker
  const isTrueTie = winners.length > 1;
  
  return {
    status: 'calculated',
    winner: isTrueTie ? winners.map(p => p.name) : winners[0].name,
    winnerCode: isTrueTie ? winners.map(p => p.code) : winners[0].code,
    correctWinners: maxCorrect,
    actualTotal,
    predictedTotal: winners[0].predictedTotal,
    difference: winners[0].difference,
    tiebreakerUsed: true,
    tiebreakerLevel: `${week} Total Points`,
    isTrueTie,
    tiedPlayers: topPlayers.map(p => p.name), // All players who were tied on correct winners
    tiedPlayersDetails: topPlayers.map(p => ({
      name: p.name,
      correctWinners: p.correctWinners,
      predictedTotal: p.predictedTotal,
      difference: p.difference
    })),
    allPlayerResults: playerResults.sort((a, b) => b.correctWinners - a.correctWinners)
  };
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
// WEEK 4 (SUPER BOWL) PRIZE #1: CORRECT WINNER WITH CASCADING TIEBREAKERS
// ============================================================================

/**
 * Calculate Week 4 Prize #1: Correct Super Bowl Winner
 * Cascading tiebreakers: Week 4 → Week 3 → Week 2 → Week 1 total points
 * 
 * @param {Object} allPicks - All player picks from Firebase
 * @param {Object} actualScores - Actual scores from Firebase (all weeks)
 * @returns {Object} - Winner object with detailed tiebreaker steps
 */
export function calculateWeek4Prize1(allPicks, actualScores) {
  const week = 'superbowl';
  
  // Get actual Super Bowl winner
  const actualWinners = getActualWinners(actualScores, week);
  
  // If no actual scores yet, return "not scored"
  if (Object.keys(actualWinners).length === 0) {
    return {
      status: 'not_scored',
      winner: null,
      message: 'Waiting for Super Bowl results'
    };
  }
  
  // There's only one game in Super Bowl, get the winner
  const superBowlWinner = actualWinners['13']; // Game 13 is Super Bowl
  
  if (!superBowlWinner) {
    return {
      status: 'not_scored',
      winner: null,
      message: 'Super Bowl winner not determined'
    };
  }
  
  // STEP 1: Filter to players who picked the correct Super Bowl winner
  const eligiblePlayers = [];
  
  Object.keys(allPicks).forEach(playerCode => {
    const playerData = allPicks[playerCode];
    const playerName = playerData.name;
    const playerPicks = playerData.picks;
    
    // Skip if player didn't enter Super Bowl pick
    if (!playerPicks || !playerPicks[week] || !playerPicks[week]['13']) {
      return;
    }
    
    const playerGame = playerPicks[week]['13'];
    const score1 = parseInt(playerGame.team1);
    const score2 = parseInt(playerGame.team2);
    
    let playerWinner = null;
    if (score1 > score2) {
      playerWinner = 'team1';
    } else if (score2 > score1) {
      playerWinner = 'team2';
    }
    
    // Only include players who picked the correct winner
    if (playerWinner === superBowlWinner) {
      eligiblePlayers.push({
        name: playerName,
        code: playerCode,
        picks: playerPicks
      });
    }
  });
  
  // If no one picked the correct winner
  if (eligiblePlayers.length === 0) {
    return {
      status: 'no_winner',
      winner: null,
      message: 'No players picked the correct Super Bowl winner'
    };
  }
  
  // If only one player picked correctly, they win!
  if (eligiblePlayers.length === 1) {
    return {
      status: 'calculated',
      winner: eligiblePlayers[0].name,
      winnerCode: eligiblePlayers[0].code,
      pickedCorrectWinner: true,
      eligiblePlayers: 1,
      eliminatedPlayers: Object.keys(allPicks).length - 1,
      tiebreakerUsed: false,
      isTrueTie: false,
      steps: [
        {
          level: 'Correct Super Bowl Winner',
          remaining: 1,
          winner: eligiblePlayers[0].name
        }
      ]
    };
  }
  
  // CASCADING TIEBREAKERS: Week 4 → 3 → 2 → 1
  const weeks = [
    { key: 'superbowl', name: 'Week 4' },
    { key: 'conference', name: 'Week 3' },
    { key: 'divisional', name: 'Week 2' },
    { key: 'wildcard', name: 'Week 1' }
  ];
  
  let remainingPlayers = [...eligiblePlayers];
  const tiebreakerSteps = [
    {
      level: 'Correct Super Bowl Winner',
      remaining: eligiblePlayers.length,
      tied: eligiblePlayers.map(p => p.name)
    }
  ];
  
  // Try each week's total as tiebreaker
  for (const weekInfo of weeks) {
    if (remainingPlayers.length === 1) {
      // We have a winner!
      break;
    }
    
    const actualTotal = calculateActualWeekTotal(actualScores, weekInfo.key);
    
    // Calculate each remaining player's difference for this week
    const playersWithDiff = remainingPlayers.map(player => {
      const predictedTotal = calculateWeekTotal(player.picks, weekInfo.key);
      const difference = calculateDifference(predictedTotal, actualTotal);
      
      return {
        ...player,
        predictedTotal,
        difference,
        actualTotal
      };
    });
    
    // Find the smallest difference
    const minDiff = Math.min(...playersWithDiff.map(p => p.difference));
    
    // Filter to players with smallest difference
    remainingPlayers = playersWithDiff.filter(p => p.difference === minDiff);
    
    // Record this step
    tiebreakerSteps.push({
      level: `${weekInfo.name} Total Points`,
      actualTotal,
      remaining: remainingPlayers.length,
      tied: remainingPlayers.map(p => p.name),
      minDifference: minDiff,
      details: playersWithDiff.map(p => ({
        name: p.name,
        predictedTotal: p.predictedTotal,
        difference: p.difference
      }))
    });
    
    // If we're down to one winner, break
    if (remainingPlayers.length === 1) {
      break;
    }
  }
  
  // Check final result
  const isTrueTie = remainingPlayers.length > 1;
  
  return {
    status: 'calculated',
    winner: isTrueTie ? remainingPlayers.map(p => p.name) : remainingPlayers[0].name,
    winnerCode: isTrueTie ? remainingPlayers.map(p => p.code) : remainingPlayers[0].code,
    pickedCorrectWinner: true,
    eligiblePlayers: eligiblePlayers.length,
    eliminatedPlayers: Object.keys(allPicks).length - eligiblePlayers.length,
    tiebreakerUsed: tiebreakerSteps.length > 1,
    isTrueTie,
    steps: tiebreakerSteps
  };
}

// ============================================================================
// WEEK 4 (SUPER BOWL) PRIZE #2: CLOSEST TOTAL WITH CASCADING TIEBREAKERS
// ============================================================================

/**
 * Calculate Week 4 Prize #2: Closest Total Points
 * Cascading tiebreakers: Week 4 → Week 3 → Week 2 → Week 1 total points
 * 
 * @param {Object} allPicks - All player picks from Firebase
 * @param {Object} actualScores - Actual scores from Firebase (all weeks)
 * @returns {Object} - Winner object with detailed tiebreaker steps
 */
export function calculateWeek4Prize2(allPicks, actualScores) {
  const week = 'superbowl';
  
  // Calculate actual Week 4 total
  const actualTotal = calculateActualWeekTotal(actualScores, week);
  
  // If no actual scores yet, return "not scored"
  if (actualTotal === 0) {
    return {
      status: 'not_scored',
      winner: null,
      message: 'Waiting for Super Bowl results'
    };
  }
  
  // Calculate each player's predicted total and difference for Week 4
  const allPlayers = [];
  
  Object.keys(allPicks).forEach(playerCode => {
    const playerData = allPicks[playerCode];
    const playerName = playerData.name;
    const playerPicks = playerData.picks;
    
    // Skip if player didn't enter Super Bowl pick
    if (!playerPicks || !playerPicks[week]) {
      return;
    }
    
    const predictedTotal = calculateWeekTotal(playerPicks, week);
    const difference = calculateDifference(predictedTotal, actualTotal);
    
    allPlayers.push({
      name: playerName,
      code: playerCode,
      picks: playerPicks,
      predictedTotal,
      difference
    });
  });
  
  // If no players entered picks
  if (allPlayers.length === 0) {
    return {
      status: 'no_picks',
      winner: null,
      message: 'No picks submitted for Super Bowl'
    };
  }
  
  // Find the smallest difference for Week 4
  const minDiff = Math.min(...allPlayers.map(p => p.difference));
  
  // Filter to players with smallest difference
  let remainingPlayers = allPlayers.filter(p => p.difference === minDiff);
  
  // If only one player is closest, they win!
  if (remainingPlayers.length === 1) {
    return {
      status: 'calculated',
      winner: remainingPlayers[0].name,
      winnerCode: remainingPlayers[0].code,
      actualTotal,
      predictedTotal: remainingPlayers[0].predictedTotal,
      difference: minDiff,
      tiebreakerUsed: false,
      isTrueTie: false,
      steps: [
        {
          level: 'Week 4 Total Points',
          actualTotal,
          remaining: 1,
          winner: remainingPlayers[0].name,
          minDifference: minDiff
        }
      ]
    };
  }
  
  // CASCADING TIEBREAKERS: Week 3 → 2 → 1 (Week 4 already used above)
  const weeks = [
    { key: 'conference', name: 'Week 3' },
    { key: 'divisional', name: 'Week 2' },
    { key: 'wildcard', name: 'Week 1' }
  ];
  
  const tiebreakerSteps = [
    {
      level: 'Week 4 Total Points',
      actualTotal,
      remaining: remainingPlayers.length,
      tied: remainingPlayers.map(p => p.name),
      minDifference: minDiff,
      details: remainingPlayers.map(p => ({
        name: p.name,
        predictedTotal: p.predictedTotal,
        difference: p.difference
      }))
    }
  ];
  
  // Try each remaining week's total as tiebreaker
  for (const weekInfo of weeks) {
    if (remainingPlayers.length === 1) {
      // We have a winner!
      break;
    }
    
    const weekActualTotal = calculateActualWeekTotal(actualScores, weekInfo.key);
    
    // Calculate each remaining player's difference for this week
    const playersWithDiff = remainingPlayers.map(player => {
      const predictedTotal = calculateWeekTotal(player.picks, weekInfo.key);
      const difference = calculateDifference(predictedTotal, weekActualTotal);
      
      return {
        ...player,
        weekPredictedTotal: predictedTotal,
        weekDifference: difference,
        weekActualTotal
      };
    });
    
    // Find the smallest difference
    const weekMinDiff = Math.min(...playersWithDiff.map(p => p.weekDifference));
    
    // Filter to players with smallest difference
    remainingPlayers = playersWithDiff.filter(p => p.weekDifference === weekMinDiff);
    
    // Record this step
    tiebreakerSteps.push({
      level: `${weekInfo.name} Total Points`,
      actualTotal: weekActualTotal,
      remaining: remainingPlayers.length,
      tied: remainingPlayers.map(p => p.name),
      minDifference: weekMinDiff,
      details: playersWithDiff.map(p => ({
        name: p.name,
        predictedTotal: p.weekPredictedTotal,
        difference: p.weekDifference
      }))
    });
    
    // If we're down to one winner, break
    if (remainingPlayers.length === 1) {
      break;
    }
  }
  // Check if we have any remaining players
  if (remainingPlayers.length === 0) {
    return {
      status: 'no_picks',
      winner: null,
      message: 'No valid picks for tiebreaker weeks'
    };
  }
  
  // Check final result
  const isTrueTie = remainingPlayers.length > 1;
  
  return {
    status: 'calculated',
    winner: isTrueTie ? remainingPlayers.map(p => p.name) : remainingPlayers[0].name,
    winnerCode: isTrueTie ? remainingPlayers.map(p => p.code) : remainingPlayers[0].code,
    actualTotal,
    predictedTotal: remainingPlayers[0].predictedTotal,
    difference: remainingPlayers[0].difference,
    tiebreakerUsed: tiebreakerSteps.length > 1,
    isTrueTie,
    steps: tiebreakerSteps,
    allPlayerResults: allPlayers.sort((a, b) => a.difference - b.difference)
  };
}

// ============================================================================
// GRAND PRIZE #1: MOST CORRECT WINNERS (OVERALL) - 2-LAYER TIEBREAKERS
// ============================================================================

/**
 * Calculate Grand Prize #1: Most Correct Winners (All 4 Weeks Combined)
 * 
 * LAYER 1 Tiebreakers: Week 4 → 3 → 2 → 1 correct winners
 * LAYER 2 Tiebreakers: Week 4 → 3 → 2 → 1 total points
 * 
 * @param {Object} allPicks - All player picks from Firebase
 * @param {Object} actualScores - Actual scores from Firebase (all weeks)
 * @returns {Object} - Winner object with detailed tiebreaker steps
 */
export function calculateGrandPrize1(allPicks, actualScores) {
  const weeks = [
    { key: 'wildcard', name: 'Week 1' },
    { key: 'divisional', name: 'Week 2' },
    { key: 'conference', name: 'Week 3' },
    { key: 'superbowl', name: 'Week 4' }
  ];
  
  // Get actual winners for all weeks
  const allActualWinners = {};
  weeks.forEach(week => {
    allActualWinners[week.key] = getActualWinners(actualScores, week.key);
  });
  
  // Check if all weeks have scores
  const allScored = weeks.every(week => 
    Object.keys(allActualWinners[week.key]).length > 0
  );
  
  if (!allScored) {
    return {
      status: 'not_scored',
      winner: null,
      message: 'Waiting for all playoff rounds to complete'
    };
  }
  
  // Calculate total correct winners for each player across all weeks
  const allPlayers = [];
  
  Object.keys(allPicks).forEach(playerCode => {
    const playerData = allPicks[playerCode];
    const playerName = playerData.name;
    const playerPicks = playerData.picks;
    
    let totalCorrect = 0;
    const weeklyCorrect = {};
    
    weeks.forEach(week => {
      const correct = countCorrectWinners(playerPicks, allActualWinners[week.key], week.key);
      weeklyCorrect[week.key] = correct;
      totalCorrect += correct;
    });
    
    allPlayers.push({
      name: playerName,
      code: playerCode,
      picks: playerPicks,
      totalCorrect,
      weeklyCorrect
    });
  });
  
  if (allPlayers.length === 0) {
    return {
      status: 'no_picks',
      winner: null,
      message: 'No picks submitted'
    };
  }
  
  // Find the highest total correct winners
  const maxCorrect = Math.max(...allPlayers.map(p => p.totalCorrect));
  
  // Filter to players with max correct
  let remainingPlayers = allPlayers.filter(p => p.totalCorrect === maxCorrect);
  
  // If only one player has the most, they win!
  if (remainingPlayers.length === 1) {
    return {
      status: 'calculated',
      winner: remainingPlayers[0].name,
      winnerCode: remainingPlayers[0].code,
      correctWinners: maxCorrect,
      tiebreakerUsed: false,
      isTrueTie: false,
      steps: [
        {
          layer: 0,
          type: 'Overall Correct Winners',
          remaining: 1,
          winner: remainingPlayers[0].name,
          correctWinners: maxCorrect
        }
      ]
    };
  }
  
  // LAYER 1: TRY CORRECT WINNERS PER WEEK (Week 4 → 3 → 2 → 1)
  const tiebreakerSteps = [
    {
      layer: 0,
      type: 'Overall Correct Winners',
      remaining: remainingPlayers.length,
      tied: remainingPlayers.map(p => p.name),
      correctWinners: maxCorrect
    }
  ];
  
  const layer1Weeks = [...weeks].reverse(); // Week 4 → 3 → 2 → 1
  
  for (const weekInfo of layer1Weeks) {
    if (remainingPlayers.length === 1) break;
    
    // Find max correct for this week among remaining players
    const maxWeekCorrect = Math.max(...remainingPlayers.map(p => p.weeklyCorrect[weekInfo.key]));
    
    // Filter to players with max correct for this week
    const beforeCount = remainingPlayers.length;
    remainingPlayers = remainingPlayers.filter(p => p.weeklyCorrect[weekInfo.key] === maxWeekCorrect);
    
    tiebreakerSteps.push({
      layer: 1,
      type: 'Correct Winners',
      level: `${weekInfo.name} Winners`,
      remaining: remainingPlayers.length,
      tied: remainingPlayers.map(p => p.name),
      maxCorrect: maxWeekCorrect,
      eliminated: beforeCount - remainingPlayers.length
    });
    
    if (remainingPlayers.length === 1) break;
  }
  
  // If we have a winner after Layer 1, return
  if (remainingPlayers.length === 1) {
    return {
      status: 'calculated',
      winner: remainingPlayers[0].name,
      winnerCode: remainingPlayers[0].code,
      correctWinners: maxCorrect,
      tiebreakerUsed: true,
      isTrueTie: false,
      steps: tiebreakerSteps
    };
  }
  
  // LAYER 2: TRY TOTAL POINTS PER WEEK (Week 4 → 3 → 2 → 1)
  for (const weekInfo of layer1Weeks) {
    if (remainingPlayers.length === 1) break;
    
    const weekActualTotal = calculateActualWeekTotal(actualScores, weekInfo.key);
    
    // Calculate differences for this week
    const playersWithDiff = remainingPlayers.map(player => {
      const predictedTotal = calculateWeekTotal(player.picks, weekInfo.key);
      const difference = calculateDifference(predictedTotal, weekActualTotal);
      
      return {
        ...player,
        weekPredictedTotal: predictedTotal,
        weekDifference: difference
      };
    });
    
    // Find smallest difference
    const minDiff = Math.min(...playersWithDiff.map(p => p.weekDifference));
    
    // Filter to players with smallest difference
    const beforeCount = remainingPlayers.length;
    remainingPlayers = playersWithDiff.filter(p => p.weekDifference === minDiff);
    
    tiebreakerSteps.push({
      layer: 2,
      type: 'Closest to Totals',
      level: `${weekInfo.name} Total Points`,
      actualTotal: weekActualTotal,
      remaining: remainingPlayers.length,
      tied: remainingPlayers.map(p => p.name),
      minDifference: minDiff,
      eliminated: beforeCount - remainingPlayers.length,
      details: playersWithDiff.map(p => ({
        name: p.name,
        predictedTotal: p.weekPredictedTotal,
        difference: p.weekDifference
      }))
    });
    
    if (remainingPlayers.length === 1) break;
  }

  
  // Check if we have any remaining players
  if (remainingPlayers.length === 0) {
    return {
      status: 'no_picks',
      winner: null,
      message: 'No valid picks for tiebreaker weeks'
    };
  }
  
  // Final result
  const isTrueTie = remainingPlayers.length > 1;
  
  return {
    status: 'calculated',
    winner: isTrueTie ? remainingPlayers.map(p => p.name) : remainingPlayers[0].name,
    winnerCode: isTrueTie ? remainingPlayers.map(p => p.code) : remainingPlayers[0].code,
    correctWinners: maxCorrect,
    tiebreakerUsed: true,
    isTrueTie,
    steps: tiebreakerSteps,
    allPlayerResults: allPlayers.sort((a, b) => b.totalCorrect - a.totalCorrect)
  };
}

// ============================================================================
// GRAND PRIZE #2: CLOSEST TOTAL POINTS (OVERALL) - CASCADING TIEBREAKERS
// ============================================================================

/**
 * Calculate Grand Prize #2: Closest Total Points (All 4 Weeks Combined)
 * 
 * Cascading tiebreakers: Week 4 → 3 → 2 → 1 total points
 * 
 * @param {Object} allPicks - All player picks from Firebase
 * @param {Object} actualScores - Actual scores from Firebase (all weeks)
 * @returns {Object} - Winner object with detailed tiebreaker steps
 */
export function calculateGrandPrize2(allPicks, actualScores) {
  const weeks = [
    { key: 'wildcard', name: 'Week 1' },
    { key: 'divisional', name: 'Week 2' },
    { key: 'conference', name: 'Week 3' },
    { key: 'superbowl', name: 'Week 4' }
  ];
  
  // Calculate actual totals for all weeks
  const weeklyActualTotals = {};
  let overallActualTotal = 0;
  
  weeks.forEach(week => {
    const weekTotal = calculateActualWeekTotal(actualScores, week.key);
    weeklyActualTotals[week.key] = weekTotal;
    overallActualTotal += weekTotal;
  });
  
  // Check if all weeks have scores
  if (overallActualTotal === 0) {
    return {
      status: 'not_scored',
      winner: null,
      message: 'Waiting for all playoff rounds to complete'
    };
  }
  
  // Calculate overall predicted total and difference for each player
  const allPlayers = [];
  
  Object.keys(allPicks).forEach(playerCode => {
    const playerData = allPicks[playerCode];
    const playerName = playerData.name;
    const playerPicks = playerData.picks;
    
    let overallPredictedTotal = 0;
    const weeklyPredictedTotals = {};
    
    weeks.forEach(week => {
      const weekTotal = calculateWeekTotal(playerPicks, week.key);
      weeklyPredictedTotals[week.key] = weekTotal;
      overallPredictedTotal += weekTotal;
    });
    
    const overallDifference = calculateDifference(overallPredictedTotal, overallActualTotal);
    
    allPlayers.push({
      name: playerName,
      code: playerCode,
      picks: playerPicks,
      overallPredictedTotal,
      overallDifference,
      weeklyPredictedTotals
    });
  });
  
  if (allPlayers.length === 0) {
    return {
      status: 'no_picks',
      winner: null,
      message: 'No picks submitted'
    };
  }
  
  // Find the smallest overall difference
  const minOverallDiff = Math.min(...allPlayers.map(p => p.overallDifference));
  
  // Filter to players with smallest overall difference
  let remainingPlayers = allPlayers.filter(p => p.overallDifference === minOverallDiff);
  
  // If only one player is closest, they win!
  if (remainingPlayers.length === 1) {
    return {
      status: 'calculated',
      winner: remainingPlayers[0].name,
      winnerCode: remainingPlayers[0].code,
      overallActualTotal,
      overallPredictedTotal: remainingPlayers[0].overallPredictedTotal,
      difference: minOverallDiff,
      tiebreakerUsed: false,
      isTrueTie: false,
      steps: [
        {
          level: 'Overall Total Points',
          actualTotal: overallActualTotal,
          remaining: 1,
          winner: remainingPlayers[0].name,
          minDifference: minOverallDiff
        }
      ],
      allPlayerResults: allPlayers.sort((a, b) => a.overallDifference - b.overallDifference)
    };
  }
  
  // CASCADING TIEBREAKERS: Week 4 → 3 → 2 → 1 total points
  const tiebreakerSteps = [
    {
      level: 'Overall Total Points',
      actualTotal: overallActualTotal,
      remaining: remainingPlayers.length,
      tied: remainingPlayers.map(p => p.name),
      minDifference: minOverallDiff,
      details: remainingPlayers.map(p => ({
        name: p.name,
        predictedTotal: p.overallPredictedTotal,
        difference: p.overallDifference
      }))
    }
  ];
  
  const tiebreakerWeeks = [...weeks].reverse(); // Week 4 → 3 → 2 → 1
  
  for (const weekInfo of tiebreakerWeeks) {
    if (remainingPlayers.length === 1) break;
    
    const weekActualTotal = weeklyActualTotals[weekInfo.key];
    
    // Calculate differences for this week among remaining players
    const playersWithDiff = remainingPlayers.map(player => {
      const weekPredictedTotal = player.weeklyPredictedTotals[weekInfo.key];
      const weekDifference = calculateDifference(weekPredictedTotal, weekActualTotal);
      
      return {
        ...player,
        weekPredictedTotal,
        weekDifference
      };
    });
    
    // Find smallest difference for this week
    const minWeekDiff = Math.min(...playersWithDiff.map(p => p.weekDifference));
    
    // Filter to players with smallest difference
    const beforeCount = remainingPlayers.length;
    remainingPlayers = playersWithDiff.filter(p => p.weekDifference === minWeekDiff);
    
    tiebreakerSteps.push({
      level: `${weekInfo.name} Total Points`,
      actualTotal: weekActualTotal,
      remaining: remainingPlayers.length,
      tied: remainingPlayers.map(p => p.name),
      minDifference: minWeekDiff,
      eliminated: beforeCount - remainingPlayers.length,
      details: playersWithDiff.map(p => ({
        name: p.name,
        predictedTotal: p.weekPredictedTotal,
        difference: p.weekDifference
      }))
    });
    
    if (remainingPlayers.length === 1) break;
  }
  
  
  // Check if we have any remaining players
  if (remainingPlayers.length === 0) {
    return {
      status: 'no_picks',
      winner: null,
      message: 'No valid picks for tiebreaker weeks'
    };
  }
  
  // Final result
  const isTrueTie = remainingPlayers.length > 1;
  
  return {
    status: 'calculated',
    winner: isTrueTie ? remainingPlayers.map(p => p.name) : remainingPlayers[0].name,
    winnerCode: isTrueTie ? remainingPlayers.map(p => p.code) : remainingPlayers[0].code,
    overallActualTotal,
    overallPredictedTotal: remainingPlayers[0].overallPredictedTotal,
    difference: remainingPlayers[0].overallDifference,
    tiebreakerUsed: tiebreakerSteps.length > 1,
    isTrueTie,
    steps: tiebreakerSteps,
    allPlayerResults: allPlayers.sort((a, b) => a.overallDifference - b.overallDifference)
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
  calculateWeekPrize1,
  calculateWeekPrize2,
  calculateWeek4Prize1,
  calculateWeek4Prize2,
  calculateGrandPrize1,
  calculateGrandPrize2
};
