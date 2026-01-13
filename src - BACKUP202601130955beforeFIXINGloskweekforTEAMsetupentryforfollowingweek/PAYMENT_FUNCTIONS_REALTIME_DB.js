// ============================================
// 💰 PAYMENT MANAGEMENT FUNCTIONS
// For Firebase Realtime Database
// Add these RIGHT AFTER isPoolManager() function
// ============================================

/**
 * Update player payment information
 * Uses Firebase Realtime Database (not Firestore)
 */
const updatePayment = async (playerCode, paymentData) => {
  try {
    // Find player in Firebase Realtime Database
    const playersRef = ref(database, 'players');
    const snapshot = await get(playersRef);
    
    if (!snapshot.exists()) {
      alert('❌ No players found in database.');
      return;
    }
    
    const allPlayers = snapshot.val();
    let playerKey = null;
    
    // Find the Firebase key for this player
    for (const [key, player] of Object.entries(allPlayers)) {
      if (player.playerCode === playerCode) {
        playerKey = key;
        break;
      }
    }
    
    if (!playerKey) {
      alert(`❌ Player ${playerCode} not found.`);
      return;
    }
    
    // Update player with payment data
    const playerRef = ref(database, `players/${playerKey}`);
    await update(playerRef, {
      paymentStatus: paymentData.status,
      paymentTimestamp: paymentData.timestamp,
      paymentMethod: paymentData.method,
      paymentAmount: paymentData.amount,
      updatedAt: Date.now()
    });
    
    console.log(`✅ Payment updated for ${playerCode}`);
    
    // Reload players to refresh UI
    // Note: You'll need to call your existing loadPlayers() function here
    // If you don't have one, you'll need to reload the page or refetch data
    
  } catch (error) {
    console.error('Error updating payment:', error);
    alert('❌ Error updating payment. Please try again.');
  }
};

/**
 * Toggle player visibility (hide/show from regular players)
 * Uses Firebase Realtime Database (not Firestore)
 */
const togglePlayerVisibility = async (playerCode) => {
  try {
    // Find player in Firebase Realtime Database
    const playersRef = ref(database, 'players');
    const snapshot = await get(playersRef);
    
    if (!snapshot.exists()) {
      alert('❌ No players found in database.');
      return;
    }
    
    const allPlayers = snapshot.val();
    let playerKey = null;
    let currentVisibility = true; // Default to visible
    
    // Find the Firebase key for this player
    for (const [key, player] of Object.entries(allPlayers)) {
      if (player.playerCode === playerCode) {
        playerKey = key;
        currentVisibility = player.visibleToPlayers !== false; // Default to true if undefined
        break;
      }
    }
    
    if (!playerKey) {
      alert(`❌ Player ${playerCode} not found.`);
      return;
    }
    
    // Toggle visibility
    const newVisibility = !currentVisibility;
    const playerRef = ref(database, `players/${playerKey}`);
    await update(playerRef, {
      visibleToPlayers: newVisibility,
      updatedAt: Date.now()
    });
    
    console.log(`✅ Visibility toggled for ${playerCode}: ${newVisibility ? 'VISIBLE' : 'HIDDEN'}`);
    
    // Show confirmation
    alert(`✅ Player ${currentVisibility ? 'hidden from' : 'shown to'} regular players!`);
    
  } catch (error) {
    console.error('Error toggling visibility:', error);
    alert('❌ Error updating visibility. Please try again.');
  }
};

/**
 * Permanently remove player from system
 * Uses Firebase Realtime Database (not Firestore)
 */
const removePlayer = async (playerCode) => {
  try {
    // Find player in Firebase Realtime Database
    const playersRef = ref(database, 'players');
    const snapshot = await get(playersRef);
    
    if (!snapshot.exists()) {
      alert('❌ No players found in database.');
      return;
    }
    
    const allPlayers = snapshot.val();
    let playerKey = null;
    let playerName = '';
    
    // Find the Firebase key for this player
    for (const [key, player] of Object.entries(allPlayers)) {
      if (player.playerCode === playerCode) {
        playerKey = key;
        playerName = player.playerName || playerCode;
        break;
      }
    }
    
    if (!playerKey) {
      alert(`❌ Player ${playerCode} not found.`);
      return;
    }
    
    // Delete the player
    const playerRef = ref(database, `players/${playerKey}`);
    await remove(playerRef);
    
    console.log(`✅ Player ${playerCode} removed permanently`);
    
    // Show confirmation
    alert(`✅ ${playerName} has been permanently removed from the system.`);
    
  } catch (error) {
    console.error('Error removing player:', error);
    alert('❌ Error removing player. Please try again.');
  }
};
