// ============================================
// 🎲 RNG ALERT SYSTEM FUNCTIONS
// For Firebase Realtime Database
// Add these AFTER payment functions
// ============================================

/**
 * Apply RNG to all players in list
 * Uses Firebase Realtime Database (not Firestore)
 */
const applyRNGToAll = async (playersList) => {
  let successCount = 0;
  let failCount = 0;

  for (const player of playersList) {
    try {
      // Generate RNG picks for all games in current week
      const weekGames = PLAYOFF_WEEKS[currentWeek].games;
      const rngPredictions = {};
      
      weekGames.forEach(game => {
        rngPredictions[game.id] = generateRNGScore();
      });

      // Submit picks for this player
      await submitPicksForPlayer(
        player.playerCode,
        currentWeek,
        rngPredictions,
        'POOL_MANAGER_RNG'
      );

      successCount++;
    } catch (error) {
      console.error(`Error applying RNG to ${player.playerName}:`, error);
      failCount++;
    }
  }

  alert(
    `✅ RNG Applied!\n\n` +
    `Success: ${successCount} player(s)\n` +
    `Failed: ${failCount} player(s)\n\n` +
    `Players who got RNG picks:\n` +
    playersList.map(p => `• ${p.playerName}`).join('\n')
  );

  // Hide alert
  setShowRNGAlert(false);
};

/**
 * Review each player manually for RNG
 * Scrolls to override section for manual entry
 */
const reviewRNGManually = (playersList) => {
  if (playersList.length === 0) return;

  alert(
    `🔍 Manual Review Mode\n\n` +
    `You can now use the "Pool Manager Override" section to apply RNG to each player:\n\n` +
    playersList.map(p => `• ${p.playerName} (${p.playerCode})`).join('\n')
  );

  // Scroll to override section (optional)
  const overrideSection = document.getElementById('pool-manager-override');
  if (overrideSection) {
    overrideSection.scrollIntoView({ behavior: 'smooth' });
  }

  setShowRNGAlert(false);
};

/**
 * Dismiss RNG alert
 */
const dismissRNGAlert = () => {
  setRngAlertDismissed(true);
  setShowRNGAlert(false);
};

/**
 * Helper: Submit picks for any player (used by RNG)
 * Uses Firebase Realtime Database (not Firestore)
 */
const submitPicksForPlayer = async (playerCode, week, predictions, enteredBy = 'PLAYER') => {
  try {
    // Check if player already has picks for this week
    const picksRef = ref(database, 'picks');
    const snapshot = await get(picksRef);
    
    let existingFirebaseKey = null;
    let existingTimestamp = Date.now();
    
    if (snapshot.exists()) {
      const allFirebasePicks = snapshot.val();
      for (const [key, pick] of Object.entries(allFirebasePicks)) {
        if (pick.playerCode === playerCode && pick.week === week) {
          existingFirebaseKey = key;
          existingTimestamp = pick.timestamp || Date.now();
          break;
        }
      }
    }

    // Get player name from PLAYER_CODES
    const playerName = PLAYER_CODES[playerCode] || playerCode;

    const pickData = {
      playerCode,
      playerName,
      week,
      predictions,
      timestamp: existingTimestamp, // Keep original timestamp if updating
      lastUpdated: Date.now(),
      enteredBy,
      enteredByCode: playerCode, // Current logged-in manager's code
      enteredByName: playerName
    };

    if (existingFirebaseKey) {
      // Update existing pick
      await set(ref(database, `picks/${existingFirebaseKey}`), pickData);
    } else {
      // Create new pick
      await push(ref(database, 'picks'), pickData);
    }

    console.log(`✅ Picks submitted for ${playerCode} (${enteredBy})`);
  } catch (error) {
    console.error('Error submitting picks:', error);
    throw error;
  }
};
