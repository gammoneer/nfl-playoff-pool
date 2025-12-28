// ============================================
// 🔄 ONE-TIME MIGRATION SCRIPT
// Run this ONCE to create players table in Firebase
// ============================================

/**
 * Migrate PLAYER_CODES to Firebase players table
 * Run this once in browser console as Pool Manager
 */
const migratePlayerCodesToFirebase = async () => {
  try {
    console.log('🔄 Starting migration...');
    
    // Check if players already exist
    const playersRef = ref(database, 'players');
    const snapshot = await get(playersRef);
    
    if (snapshot.exists()) {
      const confirm = window.confirm(
        'Players table already exists in Firebase!\n\n' +
        'Do you want to ADD payment fields to existing players?\n\n' +
        'Click OK to update, Cancel to abort.'
      );
      
      if (!confirm) {
        console.log('❌ Migration cancelled');
        return;
      }
      
      // Update existing players with payment fields
      const existingPlayers = snapshot.val();
      let updateCount = 0;
      
      for (const [key, player] of Object.entries(existingPlayers)) {
        if (!player.hasOwnProperty('paymentStatus')) {
          await update(ref(database, `players/${key}`), {
            paymentStatus: 'UNPAID',
            paymentTimestamp: '',
            paymentMethod: '',
            paymentAmount: 0,
            visibleToPlayers: true,
            updatedAt: Date.now()
          });
          updateCount++;
          console.log(`✅ Updated: ${player.playerName}`);
        }
      }
      
      alert(`✅ Migration complete!\n\nUpdated ${updateCount} player(s) with payment fields.`);
    } else {
      // Create players table from PLAYER_CODES
      console.log('📝 Creating new players table...');
      
      let createCount = 0;
      
      for (const [code, name] of Object.entries(PLAYER_CODES)) {
        const isManager = POOL_MANAGER_CODES.includes(code);
        
        await push(ref(database, 'players'), {
          playerCode: code,
          playerName: name,
          role: isManager ? 'MANAGER' : 'PLAYER',
          paymentStatus: 'UNPAID',
          paymentTimestamp: '',
          paymentMethod: '',
          paymentAmount: 0,
          visibleToPlayers: true,
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
        
        createCount++;
        console.log(`✅ Created: ${name} (${code})`);
      }
      
      alert(
        `✅ Migration complete!\n\n` +
        `Created ${createCount} player(s) in Firebase.\n\n` +
        `You can now use the Payment Management page!`
      );
    }
    
    console.log('🎉 Migration finished!');
  } catch (error) {
    console.error('❌ Migration error:', error);
    alert(`❌ Migration failed: ${error.message}\n\nCheck console for details.`);
  }
};

// ============================================
// 🚀 HOW TO RUN THIS:
// ============================================
// 1. Login as Pool Manager
// 2. Open browser console (F12)
// 3. Copy this entire file
// 4. Paste into console
// 5. Type: migratePlayerCodesToFirebase()
// 6. Press Enter
// 7. Wait for success message!
// ============================================

console.log('✅ Migration script loaded!');
console.log('📋 To run: migratePlayerCodesToFirebase()');
