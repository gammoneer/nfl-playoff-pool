// ============================================
// RNG SERVICE - Random Pick Generation
// ============================================
// Generates random picks (10-50) for players who missed deadline
// Tracks payment status and notifications

/**
 * Generate random score between 10-50 (inclusive)
 */
export function generateRandomScore() {
  return Math.floor(Math.random() * 41) + 10; // 10-50 inclusive
}

/**
 * Generate RNG picks for a single player for a specific week
 * @param {string} playerCode - Player's code
 * @param {string} playerName - Player's name
 * @param {Object} weekGames - Games for the week
 * @param {string} week - Week key (wildcard, divisional, conference, superbowl)
 * @returns {Object} Generated picks
 */
export function generateRNGPicks(playerCode, playerName, weekGames, week) {
  const picks = {};
  const timestamp = new Date().toISOString();
  
  weekGames.forEach(game => {
    picks[game.id] = {
      team1: generateRandomScore(),
      team2: generateRandomScore()
    };
  });

  return {
    playerCode,
    playerName,
    week,
    predictions: picks,
    source: 'rng',
    generatedAt: timestamp,
    lastUpdated: timestamp
  };
}

/**
 * Generate RNG picks for multiple players
 * @param {Array} players - Array of player objects with code and name
 * @param {Object} weekGames - Games for the week
 * @param {string} week - Week key
 * @returns {Array} Array of generated picks for all players
 */
export function generateBulkRNGPicks(players, weekGames, week) {
  return players.map(player => 
    generateRNGPicks(player.code, player.name, weekGames, week)
  );
}

/**
 * Create RNG log entry
 * @param {Object} rngPick - Generated RNG pick
 * @returns {Object} Log entry
 */
export function createRNGLogEntry(rngPick) {
  const gameScores = Object.values(rngPick.predictions).map(pred => 
    `${pred.team1}-${pred.team2}`
  );

  return {
    playerCode: rngPick.playerCode,
    playerName: rngPick.playerName,
    week: rngPick.week,
    gameScores: gameScores.join(', '),
    generatedAt: rngPick.generatedAt,
    notifiedEmail: false,
    notifiedText: false,
    notificationDate: null,
    notes: ''
  };
}

/**
 * Format timestamp for filename (YYYYMMDDHHMMSS)
 * @param {Date} date - Date object
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
 * Generate RNG log CSV content
 * @param {Array} rngLogs - Array of RNG log entries
 * @param {string} week - Week name
 * @returns {string} CSV content
 */
export function generateRNGLogCSV(rngLogs, week) {
  const timestamp = new Date().toLocaleString('en-US', { 
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  let csv = `"RNG Generation Log"\n`;
  csv += `"Timestamp: ${timestamp} PST"\n`;
  csv += `"Week: ${week}"\n`;
  csv += `""\n`;
  csv += `"Code","Name","Paid","Game Picks","Notified Email","Notified Text","Notification Date","Notes"\n`;

  rngLogs.forEach(log => {
    const notifiedEmail = log.notifiedEmail ? 'Yes' : 'No';
    const notifiedText = log.notifiedText ? 'Yes' : 'No';
    const notificationDate = log.notificationDate || '';
    const notes = (log.notes || '').replace(/"/g, '""'); // Escape quotes

    csv += `"${log.playerCode}","${log.playerName}","Yes","${log.gameScores}","${notifiedEmail}","${notifiedText}","${notificationDate}","${notes}"\n`;
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
 * Create backup of all picks
 * @param {Array} allPicks - All player picks
 * @returns {string} CSV content
 */
export function createPicksBackupCSV(allPicks) {
  const timestamp = new Date().toLocaleString('en-US', { 
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  let csv = `"Backup Created: ${timestamp} PST"\n`;
  csv += `"Total Players: ${allPicks.length}"\n`;
  csv += `""\n`;
  csv += `"Player Code","Player Name","Week","Predictions (JSON)","Source","Last Updated"\n`;

  allPicks.forEach(pick => {
    const predictions = JSON.stringify(pick.predictions).replace(/"/g, '""');
    const source = pick.source || 'manual';
    const lastUpdated = pick.lastUpdated || '';

    csv += `"${pick.playerCode}","${pick.playerName}","${pick.week}","${predictions}","${source}","${lastUpdated}"\n`;
  });

  return csv;
}

export default {
  generateRandomScore,
  generateRNGPicks,
  generateBulkRNGPicks,
  createRNGLogEntry,
  formatTimestamp,
  generateRNGLogCSV,
  downloadCSV,
  createPicksBackupCSV
};
