/**
 * PRIZE ELIGIBILITY UTILITIES
 * 
 * Central location for all prize eligibility logic
 * Rule: Player must be PAID + VISIBLE to win prizes
 */

/**
 * Check if a player is eligible to win prizes
 * @param {Object} player - Player object with paymentStatus and visibleToPlayers
 * @returns {boolean} - True if eligible, false if not
 */
export const isPlayerEligible = (player) => {
  if (!player) return false;
  
  const isPaid = player.paymentStatus === 'PAID';
  const isVisible = player.visibleToPlayers !== false; // Default to true if undefined
  
  return isPaid && isVisible;
};

/**
 * Filter players to only eligible ones
 * @param {Array} players - Array of player objects
 * @returns {Array} - Array of eligible players only
 */
export const getEligiblePlayers = (players) => {
  if (!Array.isArray(players)) return [];
  
  return players.filter(isPlayerEligible);
};

/**
 * Filter picks to only include eligible players
 * @param {Array} picks - Array of pick objects
 * @param {Array} players - Array of player objects
 * @returns {Array} - Array of picks from eligible players only
 */
export const getEligiblePicks = (picks, players) => {
  if (!Array.isArray(picks) || !Array.isArray(players)) return [];
  
  return picks.filter(pick => {
    const player = players.find(p => p.playerCode === pick.playerCode);
    return isPlayerEligible(player);
  });
};

/**
 * Get eligibility status with details
 * @param {Object} player - Player object
 * @returns {Object} - Eligibility details
 */
export const getEligibilityStatus = (player) => {
  if (!player) {
    return {
      eligible: false,
      badge: '❌',
      text: 'UNKNOWN',
      reason: 'Player not found'
    };
  }
  
  const isPaid = player.paymentStatus === 'PAID';
  const isVisible = player.visibleToPlayers !== false;
  
  if (isPaid && isVisible) {
    return {
      eligible: true,
      badge: '💰✅',
      text: 'ELIGIBLE',
      reason: 'Player is paid and visible'
    };
  } else if (!isPaid && isVisible) {
    return {
      eligible: false,
      badge: '⏳❌',
      text: 'NOT PAID',
      reason: 'Player has not paid entry fee'
    };
  } else if (isPaid && !isVisible) {
    return {
      eligible: false,
      badge: '🚫❌',
      text: 'HIDDEN',
      reason: 'Player is hidden by Pool Manager'
    };
  } else {
    return {
      eligible: false,
      badge: '⏳🚫',
      text: 'UNPAID+HIDDEN',
      reason: 'Player is unpaid and hidden'
    };
  }
};

/**
 * Get counts of eligible vs ineligible players
 * @param {Array} players - Array of player objects
 * @returns {Object} - Counts object
 */
export const getEligibilityCounts = (players) => {
  if (!Array.isArray(players)) {
    return { eligible: 0, ineligible: 0, total: 0 };
  }
  
  const eligible = players.filter(isPlayerEligible).length;
  const total = players.length;
  const ineligible = total - eligible;
  
  return { eligible, ineligible, total };
};

/**
 * Group players by eligibility
 * @param {Array} players - Array of player objects
 * @returns {Object} - Object with eligible and ineligible arrays
 */
export const groupPlayersByEligibility = (players) => {
  if (!Array.isArray(players)) {
    return { eligible: [], ineligible: [] };
  }
  
  const eligible = [];
  const ineligible = [];
  
  players.forEach(player => {
    if (isPlayerEligible(player)) {
      eligible.push(player);
    } else {
      ineligible.push(player);
    }
  });
  
  return { eligible, ineligible };
};

/**
 * Get eligibility warning message for hiding/unpaying
 * @param {Object} player - Player object
 * @param {string} action - Action type: 'hide' or 'unpay'
 * @returns {string} - Warning message
 */
export const getEligibilityWarning = (player, action) => {
  if (!player) return '';
  
  if (action === 'hide' && player.paymentStatus === 'PAID') {
    return (
      `⚠️ WARNING: ${player.playerName} is PAID!\n\n` +
      `Hiding this player will make them INELIGIBLE to win prizes.\n\n` +
      `Continue?`
    );
  }
  
  if (action === 'unpay' && player.visibleToPlayers !== false) {
    return (
      `⚠️ WARNING: Marking ${player.playerName} as UNPAID\n\n` +
      `This will make them INELIGIBLE to win prizes!\n\n` +
      `Continue?`
    );
  }
  
  return '';
};

/**
 * Validate eligibility rules are met
 * @param {Array} players - Array of all players
 * @returns {Object} - Validation result with any warnings
 */
export const validateEligibilityRules = (players) => {
  const warnings = [];
  const eligibilityCounts = getEligibilityCounts(players);
  
  // Check if there are any eligible players
  if (eligibilityCounts.eligible === 0 && players.length > 0) {
    warnings.push('⚠️ No players are currently eligible to win prizes!');
  }
  
  // Check for paid but hidden players
  const paidButHidden = players.filter(p => 
    p.paymentStatus === 'PAID' && p.visibleToPlayers === false
  );
  
  if (paidButHidden.length > 0) {
    warnings.push(
      `⚠️ ${paidButHidden.length} paid player(s) are hidden and cannot win prizes: ` +
      paidButHidden.map(p => p.playerName).join(', ')
    );
  }
  
  return {
    valid: warnings.length === 0,
    warnings,
    ...eligibilityCounts
  };
};

/**
 * Format eligibility info for display
 * @param {Array} players - Array of player objects
 * @returns {string} - Formatted string for display
 */
export const formatEligibilityInfo = (players) => {
  const counts = getEligibilityCounts(players);
  
  return (
    `Prize Eligibility Status:\n` +
    `✅ ${counts.eligible} Eligible (Paid + Visible)\n` +
    `❌ ${counts.ineligible} Ineligible (Unpaid or Hidden)\n` +
    `📊 ${counts.total} Total Players`
  );
};

export default {
  isPlayerEligible,
  getEligiblePlayers,
  getEligiblePicks,
  getEligibilityStatus,
  getEligibilityCounts,
  groupPlayersByEligibility,
  getEligibilityWarning,
  validateEligibilityRules,
  formatEligibilityInfo
};
