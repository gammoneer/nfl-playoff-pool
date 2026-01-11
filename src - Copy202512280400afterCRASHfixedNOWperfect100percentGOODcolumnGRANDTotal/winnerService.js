// ============================================
// WINNER SERVICE - Leader Calculation & Export
// ============================================
// Calculates prize leaders and exports complete data to CSV

/**
 * Calculate leaders for Prize #1, #3, #5, #7, #9 (Most Correct Winners)
 * @param {Array} allPicks - All player picks for the week
 * @param {Object} actualScores - Actual game scores
 * @param {Object} games - Games for the week
 * @returns {Array} Leaders sorted by correct count
 */
export function calculateMostCorrectWinners(allPicks, actualScores, games) {
  const results = allPicks.map(pick => {
    let correctCount = 0;

    games.forEach(game => {
      const playerPrediction = pick.predictions?.[game.id];
      const actualScore = actualScores?.[game.id];

      if (!playerPrediction || !actualScore) return;

      // Who did player predict to win?
      const playerWinner = playerPrediction.team1 > playerPrediction.team2 ? 'team1' : 'team2';

      // Who actually won?
      const actualWinner = actualScore.team1 > actualScore.team2 ? 'team1' : 'team2';

      if (playerWinner === actualWinner) {
        correctCount++;
      }
    });

    return {
      playerCode: pick.playerCode,
      playerName: pick.playerName,
      correctCount,
      source: pick.source || 'manual'
    };
  });

  // Sort by correct count (highest first)
  return results.sort((a, b) => b.correctCount - a.correctCount);
}

/**
 * Calculate leaders for Prize #2, #4, #6, #8, #10 (Closest Total Points)
 * @param {Array} allPicks - All player picks for the week
 * @param {Object} actualScores - Actual game scores
 * @param {Object} games - Games for the week
 * @returns {Array} Leaders sorted by smallest difference
 */
export function calculateClosestTotalPoints(allPicks, actualScores, games) {
  // Calculate actual total
  let actualTotal = 0;
  games.forEach(game => {
    const score = actualScores?.[game.id];
    if (score) {
      actualTotal += (score.team1 || 0) + (score.team2 || 0);
    }
  });

  const results = allPicks.map(pick => {
    let playerTotal = 0;

    games.forEach(game => {
      const prediction = pick.predictions?.[game.id];
      if (prediction) {
        playerTotal += (prediction.team1 || 0) + (prediction.team2 || 0);
      }
    });

    const difference = Math.abs(playerTotal - actualTotal);

    return {
      playerCode: pick.playerCode,
      playerName: pick.playerName,
      predictedTotal: playerTotal,
      actualTotal,
      difference,
      source: pick.source || 'manual'
    };
  });

  // Sort by smallest difference
  return results.sort((a, b) => a.difference - b.difference);
}

/**
 * Format timestamp for CSV export
 * @param {Date} date 
 * @returns {string} Formatted timestamp
 */
export function formatTimestamp(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

/**
 * Export all picks to Excel-ready CSV
 * @param {string} week - Week name (wildcard, divisional, conference, superbowl)
 * @param {Array} allPicks - All player picks
 * @param {Object} actualScores - Actual scores
 * @param {Object} games - Games for the week
 * @returns {string} CSV content
 */
export function exportToCSV(week, allPicks, actualScores, games) {
  const weekNames = {
    wildcard: 'Week 1 - Wildcard Round',
    divisional: 'Week 2 - Divisional Round',
    conference: 'Week 3 - Conference Championships',
    superbowl: 'Week 4 - Super Bowl'
  };

  const weekName = weekNames[week] || week;
  
  // Calculate actual total
  let actualTotal = 0;
  games.forEach(game => {
    const score = actualScores?.[game.id];
    if (score) {
      actualTotal += (score.team1 || 0) + (score.team2 || 0);
    }
  });

  // Timestamp in PST
  const now = new Date();
  const pstTime = new Date(now.toLocaleString('en-US', { 
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }));

  const timestamp = pstTime.toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  // Header rows
  let csv = `${weekName} - Complete Export\n`;
  csv += `Exported: ${timestamp} PST\n`;
  csv += `Actual Total Points: ${actualTotal}\n`;
  csv += `\n`;

  // Column headers
  const headers = ['Player Code', 'Player Name'];
  
  // Add game columns
  games.forEach(game => {
    headers.push(game.team1);
    headers.push(game.team2);
  });
  
  headers.push('Player Total');
  headers.push('Difference from Actual');
  headers.push('Correct Winners Count');
  headers.push('Source');

  csv += headers.join(',') + '\n';

  // Calculate correct winners for each player
  const correctWinnersData = calculateMostCorrectWinners(allPicks, actualScores, games);

  // Data rows
  allPicks.forEach(pick => {
    const row = [];
    
    // Player info
    row.push(pick.playerCode || '');
    row.push(pick.playerName || '');

    // Game scores
    let playerTotal = 0;
    games.forEach(game => {
      const prediction = pick.predictions?.[game.id];
      if (prediction) {
        row.push(prediction.team1 || 0);
        row.push(prediction.team2 || 0);
        playerTotal += (prediction.team1 || 0) + (prediction.team2 || 0);
      } else {
        row.push('');
        row.push('');
      }
    });

    // Totals and calculations
    row.push(playerTotal);
    row.push(playerTotal - actualTotal); // Difference (can be negative)
    
    // Find correct count for this player
    const correctData = correctWinnersData.find(c => c.playerCode === pick.playerCode);
    row.push(correctData?.correctCount || 0);
    
    row.push(pick.source || 'manual');

    csv += row.join(',') + '\n';
  });

  return csv;
}

/**
 * Download CSV file
 * @param {string} content - CSV content
 * @param {string} filename - Filename
 */
export function downloadCSV(content, filename) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Get prize leaders for a specific prize
 * @param {number} prizeNumber - Prize number (1-10)
 * @param {string} week - Current week
 * @param {Array} allPicks - All picks
 * @param {Object} actualScores - Actual scores
 * @param {Object} games - Games
 * @returns {Object} Prize leaders data
 */
export function getPrizeLeaders(prizeNumber, week, allPicks, actualScores, games) {
  const prizeTypes = {
    1: 'Most Correct Winners',
    2: 'Closest Total Points',
    3: 'Most Correct Winners',
    4: 'Closest Total Points',
    5: 'Most Correct Winners',
    6: 'Closest Total Points',
    7: 'Most Correct Winners',
    8: 'Closest Total Points',
    9: 'Most Correct Winners (All 4 Weeks)',
    10: 'Closest Total Points (All 4 Weeks)'
  };

  const isCorrectWinners = [1, 3, 5, 7, 9].includes(prizeNumber);
  
  if (isCorrectWinners) {
    const leaders = calculateMostCorrectWinners(allPicks, actualScores, games);
    const topScore = leaders[0]?.correctCount || 0;
    const tiedLeaders = leaders.filter(l => l.correctCount === topScore);
    
    return {
      prizeNumber,
      prizeType: prizeTypes[prizeNumber],
      leaders: tiedLeaders,
      allRankings: leaders,
      hasTie: tiedLeaders.length > 1,
      tieCount: tiedLeaders.length
    };
  } else {
    const leaders = calculateClosestTotalPoints(allPicks, actualScores, games);
    const topDifference = leaders[0]?.difference || 0;
    const tiedLeaders = leaders.filter(l => l.difference === topDifference);
    
    return {
      prizeNumber,
      prizeType: prizeTypes[prizeNumber],
      leaders: tiedLeaders,
      allRankings: leaders,
      hasTie: tiedLeaders.length > 1,
      tieCount: tiedLeaders.length,
      actualTotal: leaders[0]?.actualTotal || 0
    };
  }
}

export default {
  calculateMostCorrectWinners,
  calculateClosestTotalPoints,
  formatTimestamp,
  exportToCSV,
  downloadCSV,
  getPrizeLeaders
};
