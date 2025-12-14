import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, push, onValue, set, update, get, remove } from 'firebase/database';
import './App.css';
import StandingsPage from './StandingsPage';
import ESPNControls from './ESPNControls';
import { fetchESPNScores, mapESPNGameToPlayoffGame, ESPNAutoRefresh } from './espnService';
import WeekSelector from './WeekSelector';
import {
  UnsavedChangesPopup,
  DiscardChangesPopup,
  IncompleteEntryError,
  InvalidScoresError,
  SuccessConfirmation,
  NoChangesInfo,
  TiedGamesError
} from './ValidationPopups';
import LeaderDisplay from './LeaderDisplay';
import WinnerDeclaration from './WinnerDeclaration';
import { 
  getPrizeLeaders, 
  exportToCSV, 
  downloadCSV 
} from './winnerService';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDr3PPXC90wvQW_LG8TkAyR9K-7e0loQ3A",
  authDomain: "nfl-playoff-pool-2025-scores.firebaseapp.com",
  databaseURL: "https://nfl-playoff-pool-2025-scores-default-rtdb.firebaseio.com",
  projectId: "nfl-playoff-pool-2025-scores",
  storageBucket: "nfl-playoff-pool-2025-scores.firebasestorage.app",
  messagingSenderId: "844539772456",
  appId: "1:844539772456:web:9bbfcf523195a5eedfff1d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// ============================================
// 📅 PLAYOFF SEASON CONFIGURATION
// ============================================
// Define when the playoff season starts and ends
// Submissions lock on WEEKENDS ONLY during playoff season
// Format: YYYY-MM-DD
const PLAYOFF_SEASON = {
  firstFriday: "2026-01-09",  // Friday before Wild Card weekend (last day to submit)
  lastMonday: "2026-02-09"    // Monday after Super Bowl (season ends)
};
// Before firstFriday: NO LOCKS - players can submit anytime
// During playoffs: Locks Friday 11:59 PM - Monday 12:01 AM each weekend
// After lastMonday: Season over
// TO CHANGE: Edit dates above when you know actual playoff schedule
// ============================================

// ============================================
// 📅 AUTOMATIC WEEK LOCK DATES - ACTUAL 2025 NFL PLAYOFFS
// ============================================
// Weeks automatically lock on these dates at 12:01 AM PST
// Pool Manager can override manually anytime
// Format: YYYY-MM-DD (12:01 AM PST)
// RULE: All picks lock on the FRIDAY before the weekend games are played
const AUTO_LOCK_DATES = {
  wildcard: "2026-01-10",    // Saturday 12:01 AM - Games: Sat-Sun-Mon (Jan 10-12) - Deadline: Fri Jan 9 @ 11:59 PM
  divisional: "2026-01-17",  // Saturday 12:01 AM - Games: Sat-Sun (Jan 17-18) - Deadline: Fri Jan 16 @ 11:59 PM
  conference: "2026-01-25",  // Sunday 12:01 AM - Games: Sunday (Jan 25) - Deadline: Fri Jan 23 @ 11:59 PM
  superbowl: "2026-02-08"    // Sunday 12:01 AM - Game: Sunday (Feb 8) - Deadline: Fri Feb 6 @ 11:59 PM
};
// ✅ UPDATED WITH ACTUAL NFL PLAYOFF 2025 DATES!
// Wild Card Weekend: January 10-12, 2026 (Sat-Sun-Mon) - Locks Sat Jan 10 @ 12:01 AM
// Divisional Round: January 17-18, 2026 (Sat-Sun) - Locks Sat Jan 17 @ 12:01 AM
// Conference Championships: January 25, 2026 (Sunday) - Locks Sun Jan 25 @ 12:01 AM
// Super Bowl LIX: February 8, 2026 (Sunday) - Locks Sun Feb 8 @ 12:01 AM
// PLAYER RULE: All picks must be submitted by 11:59 PM on the Friday before games!
// TO CHANGE: Just edit the dates above!
// ============================================

// ============================================
// 🔧 POOL MANAGER CONFIGURATION
// ============================================
// TO ADD POOL MANAGERS:
// Just add codes to the array below. Use 6 characters (letters/numbers).
// You can have multiple pool managers!
const POOL_MANAGER_CODES = ["76BB89", "Z9Y8X7"];  // Add more codes here as needed
// Pool Manager #1: 76BB89 (Richard)
// Pool Manager #2: Z9Y8X7 (Dennis)
// Example to add more: ["76BB89", "Z9Y8X7", "ABC123"]
// After changing, save file and restart: npm start
// ============================================

// ============================================
// 👥 PLAYER CODES (Alphanumeric)
// ============================================
// TO ADD/CHANGE PLAYERS:
// Add line: "CODE12": "Player Name",
// Codes are now 6-character alphanumeric (A-Z, 2-9)
// Avoid confusing characters: 0, O, I, 1, l
const PLAYER_CODES = {
  "76BB89": "POOL MANAGER - Richard",  // Pool Manager #1
  "Z9Y8X7": "POOL MANAGER - Dennis",   // Pool Manager #2
  "J239W4": "Bob Casson",
  "B7Y4X3": "Bob Desrosiers",
  "D4F7G5": "Bonnie Biletski",
  "536EE2": "Brian Colburg",
  "X8HH67": "Chris Neufeld",
  "G7R3P5": "Curtis Braun",
  "A4LJC9": "Curtis Palidwor",
  "X3P8N1": "Dallas Pylypow",
  "HM8T67": "Darrell Klassen",
  "TA89R2": "Dave Boyarski",
  "K2P9W5": "Dave Desrosiers",
  "A5K4T7": "Dennis Biletski",
  "6WRUJR": "Emily Chadwick",
  "AB6C89": "Gareth Reeve",
  "D3F6G9": "Jarrod Reimer",
  "T42B67": "Jo Behr",
  "PUEFKF": "Joshua Biletski",
  "ABC378": "Ken Mcleod",
  "K9R3N6": "Kevin Pich",
  "H7P3N5": "Larry Bretecher",
  "B5R4T6": "Larry Strand",
  "L2W9X2": "Michelle Desrosiers",
  "5GGPL3": "Mike Brkich",
  "T4M8Z8": "Neema Dadmand",
  "9CD72G": "Neil Banman",
  "T7Y4R8": "Neil Foster",
  "KWBZ86": "Nick Melanidis",
  "2WQA9X": "Nima Ahmadi",
  "E4T6J7": "Orest Pich",
  "N4M8Q2": "Randy Moffatt",
  "B8L9M2": "Richard Biletski",
  "62R92L": "Rob Crowe",
  "H8M3N7": "Rob Kost",
  "WW3F44": "Ryan Moffatt",
  "E5G7G8": "Tony Creta",
  // Add more players here...
  // Example: "Z8X5C3": "New Player",
};
// ============================================

// Playoff structure - update these with actual matchups when known
const PLAYOFF_WEEKS = {
  wildcard: {
    name: "Wild Card Round (Jan 10-12, 2026)",
    deadline: "Friday, January 9, 2026 at 11:59 PM PST",
    games: [
      { id: 1, team1: "AFC #7", team2: "AFC #2" },
      { id: 2, team1: "AFC #6", team2: "AFC #3" },
      { id: 3, team1: "AFC #5", team2: "AFC #4" },
      { id: 4, team1: "NFC #7", team2: "NFC #2" },
      { id: 5, team1: "NFC #6", team2: "NFC #3" },
      { id: 6, team1: "NFC #5", team2: "NFC #4" }
    ]
  },
  divisional: {
    name: "Divisional Round (Jan 17-18, 2026)",
    deadline: "Friday, January 16, 2026 at 11:59 PM PST",
    games: [
      { id: 7, team1: "AFC Winner 1", team2: "AFC #1" },
      { id: 8, team1: "AFC Winner 2", team2: "AFC Winner 3" },
      { id: 9, team1: "NFC Winner 1", team2: "NFC #1" },
      { id: 10, team1: "NFC Winner 2", team2: "NFC Winner 3" }
    ]
  },
  conference: {
    name: "Conference Championships (Jan 25, 2026)",
    deadline: "Friday, January 23, 2026 at 11:59 PM PST",
    games: [
      { id: 11, team1: "AFC Winner A", team2: "AFC Winner B" },
      { id: 12, team1: "NFC Winner A", team2: "NFC Winner B" }
    ]
  },
  superbowl: {
    name: "Super Bowl LIX (Feb 8, 2026)",
    deadline: "Friday, February 6, 2026 at 11:59 PM PST",
    games: [
      { id: 13, team1: "AFC Champion", team2: "NFC Champion" }
    ]
  }
};

function App() {
  // Navigation state for switching between views
  const [currentView, setCurrentView] = useState('picks'); // 'picks' or 'standings'
  const [playerName, setPlayerName] = useState('');
  const [playerCode, setPlayerCode] = useState('');
  const [codeValidated, setCodeValidated] = useState(false);
  const [currentWeek, setCurrentWeek] = useState('wildcard');
  const [predictions, setPredictions] = useState({});
  const [allPicks, setAllPicks] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  
  // Pool Manager states
  const [teamCodes, setTeamCodes] = useState({});      // { wildcard: { 1: {team1: "PIT", team2: "BUF"}, ... }}
  const [actualScores, setActualScores] = useState({}); // { wildcard: { 1: {team1: 27, team2: 24}, ... }}
  const [gameStatus, setGameStatus] = useState({});     // { wildcard: { 1: "final", 2: "live", ... }}
  const [manualWeekTotals, setManualWeekTotals] = useState({ // Manual week totals entered by Pool Manager
    wildcard: '',
    divisional: '',
    conference: '',
    superbowl_week4: '',
    superbowl_week3: '',
    superbowl_week2: '',
    superbowl_week1: '',
    superbowl_grand: ''  // Grand total for all 4 weeks combined
  });
  
  // Track which totals are manually overridden (vs auto-calculated)
  const [manualOverrides, setManualOverrides] = useState({
    superbowl_week4: false,
    superbowl_week3: false,
    superbowl_week2: false,
    superbowl_week1: false,
    superbowl_grand: false
  });

  // 🔒 NEW: Week lock status state
  const [weekLockStatus, setWeekLockStatus] = useState({
    wildcard: { locked: false, lockDate: null, autoLockDate: AUTO_LOCK_DATES.wildcard },
    divisional: { locked: false, lockDate: null, autoLockDate: AUTO_LOCK_DATES.divisional },
    conference: { locked: false, lockDate: null, autoLockDate: AUTO_LOCK_DATES.conference },
    superbowl: { locked: false, lockDate: null, autoLockDate: AUTO_LOCK_DATES.superbowl }
  });

  // 📡 ESPN API states
  const [gameLocks, setGameLocks] = useState({});      // { wildcard: { 1: true }, ... }
  const [espnAutoRefresh, setEspnAutoRefresh] = useState(null);
  const [lastESPNFetch, setLastESPNFetch] = useState(null);

  // ============================================
  // 🆕 STEP 5: COMPLETE FEATURE STATE
  // ============================================
  
  // Validation & Navigation State
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showPopup, setShowPopup] = useState(null);
  const [pendingWeekChange, setPendingWeekChange] = useState(null);
  const [missingGames, setMissingGames] = useState([]);
  const [invalidScores, setInvalidScores] = useState([]);
  
  // Official Winners (Pool Manager only)
  const [officialWinners, setOfficialWinners] = useState({});
  
  // 💰 PRIZE POOL SETUP (Phase 2)
  const [prizePool, setPrizePool] = useState({
    totalFees: 0,
    prizeValue: 0,
    numberOfPlayers: 0,
    entryFee: 20
  });
  const [showPrizePoolSetup, setShowPrizePoolSetup] = useState(false);
  
  // 🏆 ENHANCED WINNER DECLARATION (Phase 2)
  const [selectedPrize, setSelectedPrize] = useState('');
  const [numberOfWinners, setNumberOfWinners] = useState(1);
  const [selectedWinners, setSelectedWinners] = useState([]);
  const [useCustomSplit, setUseCustomSplit] = useState(false);
  const [customSplits, setCustomSplits] = useState([]);
  const [showWinnerDeclaration, setShowWinnerDeclaration] = useState(false);
  
  // Track original picks for unsaved changes detection
  const [originalPicks, setOriginalPicks] = useState({});
  
  // Track all picks completion status for WeekSelector
  const [weekPicksStatus, setWeekPicksStatus] = useState({});

  // ============================================
  // 👑 POOL MANAGER OVERRIDE STATE
  // ============================================
  const [overrideMode, setOverrideMode] = useState(false);
  const [selectedPlayerForOverride, setSelectedPlayerForOverride] = useState('');
  const [overrideAction, setOverrideAction] = useState(null); // 'rng', 'manual', 'view'
  const [rngPreview, setRngPreview] = useState(null);
  const [showRngPreview, setShowRngPreview] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null); // 'week' or 'all'
  const [showClearWeekConfirm, setShowClearWeekConfirm] = useState(null); // weekKey to clear


  // Check if current user is Pool Manager
  const isPoolManager = () => {
    return POOL_MANAGER_CODES.includes(playerCode) && codeValidated;
  };

  // ============================================
  // 👑 POOL MANAGER OVERRIDE FUNCTIONS
  // ============================================

  /**
   * Generate RNG scores (10-50 inclusive, NO TIES)
   * Returns { team1: number, team2: number }
   */
  const generateRNGScore = () => {
    let team1Score = Math.floor(Math.random() * 41) + 10; // 10-50
    let team2Score = Math.floor(Math.random() * 41) + 10; // 10-50
    
    // Ensure no tie - regenerate team2 if same
    while (team1Score === team2Score) {
      team2Score = Math.floor(Math.random() * 41) + 10;
    }
    
    return { team1: team1Score, team2: team2Score };
  };

  /**
   * Generate complete RNG picks for all games in a week
   */
  const generateRNGPicks = () => {
    const weekGames = PLAYOFF_WEEKS[currentWeek].games;
    const rngPredictions = {};
    
    weekGames.forEach(game => {
      rngPredictions[game.id] = generateRNGScore();
    });
    
    setRngPreview(rngPredictions);
    setShowRngPreview(true);
  };

  /**
   * Submit RNG picks for selected player
   */
  const submitRNGPicks = async () => {
    if (!selectedPlayerForOverride || !rngPreview) return;
    
    const selectedPlayer = PLAYER_CODES[selectedPlayerForOverride];
    if (!selectedPlayer) return;
    
    try {
      // Check if player already has picks for this week
      const picksRef = ref(database, 'picks');
      const snapshot = await get(picksRef);
      
      let existingFirebaseKey = null;
      if (snapshot.exists()) {
        const allFirebasePicks = snapshot.val();
        for (const [key, pick] of Object.entries(allFirebasePicks)) {
          if (pick.playerCode === selectedPlayerForOverride && pick.week === currentWeek) {
            existingFirebaseKey = key;
            break;
          }
        }
      }

      const pickData = {
        playerName: selectedPlayer,
        playerCode: selectedPlayerForOverride,
        week: currentWeek,
        predictions: rngPreview,
        timestamp: existingFirebaseKey ? (snapshot.val()[existingFirebaseKey].timestamp || Date.now()) : Date.now(),
        lastUpdated: Date.now(),
        enteredBy: 'POOL_MANAGER_RNG',
        enteredByCode: playerCode,
        enteredByName: playerName
      };

      if (existingFirebaseKey) {
        await set(ref(database, `picks/${existingFirebaseKey}`), pickData);
      } else {
        await push(ref(database, 'picks'), pickData);
      }

      alert(`✅ RNG picks successfully submitted for ${selectedPlayer}!`);
      setShowRngPreview(false);
      setRngPreview(null);
      setOverrideMode(false);
      setSelectedPlayerForOverride('');
    } catch (error) {
      console.error('Error submitting RNG picks:', error);
      alert('❌ Error submitting RNG picks. Please try again.');
    }
  };

  /**
   * Load picks for selected player in override mode
   */
  const loadPlayerPicksForOverride = () => {
    if (!selectedPlayerForOverride) return;
    
    const playerPick = allPicks.find(
      pick => pick.playerCode === selectedPlayerForOverride && pick.week === currentWeek
    );
    
    if (playerPick && playerPick.predictions) {
      // Load their existing picks into the form
      setPredictions(playerPick.predictions);
      setOriginalPicks({...playerPick.predictions});
      setOverrideAction('manual');
    } else {
      // No picks exist, start with empty
      setPredictions({});
      setOriginalPicks({});
      setOverrideAction('manual');
    }
  };

  /**
   * Submit picks on behalf of selected player
   */
  const submitPicksForPlayer = async (e) => {
    e.preventDefault();
    
    if (!selectedPlayerForOverride) {
      alert('Please select a player first.');
      return;
    }

    const selectedPlayer = PLAYER_CODES[selectedPlayerForOverride];
    const currentWeekData = PLAYOFF_WEEKS[currentWeek];

    try {
      // Check if player already has picks
      const picksRef = ref(database, 'picks');
      const snapshot = await get(picksRef);
      
      let existingFirebaseKey = null;
      if (snapshot.exists()) {
        const allFirebasePicks = snapshot.val();
        for (const [key, pick] of Object.entries(allFirebasePicks)) {
          if (pick.playerCode === selectedPlayerForOverride && pick.week === currentWeek) {
            existingFirebaseKey = key;
            break;
          }
        }
      }

      const pickData = {
        playerName: selectedPlayer,
        playerCode: selectedPlayerForOverride,
        week: currentWeek,
        predictions,
        timestamp: existingFirebaseKey ? (snapshot.val()[existingFirebaseKey].timestamp || Date.now()) : Date.now(),
        lastUpdated: Date.now(),
        enteredBy: 'POOL_MANAGER_MANUAL',
        enteredByCode: playerCode,
        enteredByName: playerName
      };

      if (existingFirebaseKey) {
        await set(ref(database, `picks/${existingFirebaseKey}`), pickData);
      } else {
        await push(ref(database, 'picks'), pickData);
      }

      alert(`✅ Picks successfully submitted for ${selectedPlayer}!`);
      setPredictions({});
      setOverrideMode(false);
      setSelectedPlayerForOverride('');
      setOverrideAction(null);
    } catch (error) {
      console.error('Error submitting picks for player:', error);
      alert('❌ Error submitting picks. Please try again.');
    }
  };

  /**
   * Delete picks for selected player for CURRENT week only
   */
  const deletePicksForWeek = async () => {
    if (!selectedPlayerForOverride) return;
    
    const selectedPlayer = PLAYER_CODES[selectedPlayerForOverride];
    
    try {
      console.log('🔍 DEBUG: Starting delete for player:', selectedPlayer);
      console.log('🔍 DEBUG: Player code:', selectedPlayerForOverride);
      console.log('🔍 DEBUG: Current week:', currentWeek);
      
      // Find the pick for this player and current week
      const picksRef = ref(database, 'picks');
      const snapshot = await get(picksRef);
      
      console.log('🔍 DEBUG: Got snapshot, exists?', snapshot.exists());
      
      if (snapshot.exists()) {
        const allFirebasePicks = snapshot.val();
        console.log('🔍 DEBUG: Total picks in database:', Object.keys(allFirebasePicks).length);
        
        let keyToDelete = null;
        
        for (const [key, pick] of Object.entries(allFirebasePicks)) {
          console.log(`🔍 DEBUG: Checking pick ${key}:`, pick.playerCode, pick.week);
          if (pick.playerCode === selectedPlayerForOverride && pick.week === currentWeek) {
            keyToDelete = key;
            console.log('🔍 DEBUG: FOUND KEY TO DELETE:', keyToDelete);
            break;
          }
        }
        
        if (keyToDelete) {
          console.log('🔍 DEBUG: Attempting to delete key:', keyToDelete);
          await remove(ref(database, `picks/${keyToDelete}`)); // Delete using remove()
          console.log('✅ DEBUG: Delete successful!');
          alert(`✅ ${selectedPlayer}'s picks for ${currentWeek === 'wildcard' ? 'Week 1' : currentWeek === 'divisional' ? 'Week 2' : currentWeek === 'conference' ? 'Week 3' : 'Week 4'} have been deleted!`);
        } else {
          console.log('❌ DEBUG: No pick found to delete');
          alert(`ℹ️ ${selectedPlayer} has no picks for this week.`);
        }
      }
      
      setShowDeleteConfirm(null);
      setSelectedPlayerForOverride('');
    } catch (error) {
      console.error('❌ DEBUG: Error deleting picks:', error);
      console.error('❌ DEBUG: Error message:', error.message);
      console.error('❌ DEBUG: Error code:', error.code);
      alert(`❌ Error deleting picks: ${error.message}\n\nCheck browser console (F12) for details.`);
    }
  };

  /**
   * Delete ALL picks for selected player across ALL weeks
   */
  const deleteAllPicksForPlayer = async () => {
    if (!selectedPlayerForOverride) return;
    
    const selectedPlayer = PLAYER_CODES[selectedPlayerForOverride];
    
    try {
      console.log('🔍 DEBUG: Starting delete ALL for player:', selectedPlayer);
      console.log('🔍 DEBUG: Player code:', selectedPlayerForOverride);
      
      // Find ALL picks for this player
      const picksRef = ref(database, 'picks');
      const snapshot = await get(picksRef);
      
      console.log('🔍 DEBUG: Got snapshot, exists?', snapshot.exists());
      
      if (snapshot.exists()) {
        const allFirebasePicks = snapshot.val();
        const keysToDelete = [];
        
        console.log('🔍 DEBUG: Total picks in database:', Object.keys(allFirebasePicks).length);
        
        for (const [key, pick] of Object.entries(allFirebasePicks)) {
          if (pick.playerCode === selectedPlayerForOverride) {
            console.log('🔍 DEBUG: Found pick to delete:', key, pick.week);
            keysToDelete.push(key);
          }
        }
        
        console.log('🔍 DEBUG: Total keys to delete:', keysToDelete.length);
        
        if (keysToDelete.length > 0) {
          // Delete all picks for this player
          console.log('🔍 DEBUG: Attempting to delete keys:', keysToDelete);
          const deletePromises = keysToDelete.map(key => 
            remove(ref(database, `picks/${key}`))
          );
          await Promise.all(deletePromises);
          
          console.log('✅ DEBUG: Delete ALL successful!');
          alert(`✅ ALL picks for ${selectedPlayer} have been deleted!\n\nDeleted ${keysToDelete.length} pick(s) across all weeks.`);
        } else {
          console.log('❌ DEBUG: No picks found to delete');
          alert(`ℹ️ ${selectedPlayer} has no picks in any week.`);
        }
      }
      
      setShowDeleteConfirm(null);
      setSelectedPlayerForOverride('');
      setOverrideMode(false);
    } catch (error) {
      console.error('❌ DEBUG: Error deleting all picks:', error);
      console.error('❌ DEBUG: Error message:', error.message);
      console.error('❌ DEBUG: Error code:', error.code);
      alert(`❌ Error deleting picks: ${error.message}\n\nCheck browser console (F12) for details.`);
    }
  };

  /**
   * Clear all week data (team names, scores, statuses) for a specific week
   * Does NOT delete player picks
   */
  const clearWeekData = async (weekKey) => {
    try {
      console.log('🗑️ Clearing week data for:', weekKey);
      
      // Clear team codes for this week
      if (teamCodes[weekKey]) {
        await set(ref(database, `teamCodes/${weekKey}`), null);
        console.log('✅ Cleared team codes');
      }
      
      // Clear actual scores for this week
      if (actualScores[weekKey]) {
        await set(ref(database, `actualScores/${weekKey}`), null);
        console.log('✅ Cleared actual scores');
      }
      
      // Clear game status for this week
      if (gameStatus[weekKey]) {
        await set(ref(database, `gameStatus/${weekKey}`), null);
        console.log('✅ Cleared game status');
      }
      
      alert(`✅ Week ${weekKey === 'wildcard' ? '1' : weekKey === 'divisional' ? '2' : weekKey === 'conference' ? '3' : '4'} data cleared!\n\nTeam names, scores, and statuses have been deleted.\nPlayer picks are still intact.`);
      setShowClearWeekConfirm(null);
    } catch (error) {
      console.error('❌ Error clearing week data:', error);
      alert(`❌ Error clearing week data: ${error.message}`);
    }
  };

  /**
   * 🎨 6-COLOR HIGHLIGHTING SYSTEM
   * Three game states, only colors predicted WINNER cell:
   * 
   * STATE 1: Actual scores entered, but status NOT set (empty/blank)
   *   - Yellow = Predicted winner is currently winning
   *   - Light Blue = Predicted winner is currently losing
   * 
   * STATE 2: Game status = LIVE
   *   - Light Green = Predicted winner is currently winning
   *   - Light Red = Predicted winner is currently losing
   * 
   * STATE 3: Game status = FINAL
   *   - Bright Green = Predicted winner WON (correct!)
   *   - Bright Red = Predicted winner LOST (wrong!)
   */
  const getCellHighlight = (playerTeam1, playerTeam2, actualTeam1, actualTeam2, gameStatus, isTeam1Cell) => {
    // Determine which team player predicted to win
    const playerPredictedTeam1 = Number(playerTeam1) > Number(playerTeam2);
    const playerPredictedTeam2 = Number(playerTeam2) > Number(playerTeam1);
    
    // If player predicted a tie or has no valid prediction, no highlighting
    if (playerTeam1 === playerTeam2 || !playerTeam1 || !playerTeam2) {
      return { background: 'transparent', color: '#000' };
    }
    
    // If we have actual scores entered
    if (actualTeam1 !== undefined && actualTeam2 !== undefined && actualTeam1 !== '' && actualTeam2 !== '') {
      const actualTeam1Winning = Number(actualTeam1) > Number(actualTeam2);
      const actualTeam2Winning = Number(actualTeam2) > Number(actualTeam1);
      
      // STATE 1: Actual scores entered, but NO status set (empty/blank)
      // Use Yellow/Light Blue
      if (!gameStatus || gameStatus === '') {
        // Only color the predicted winner cell
        if (isTeam1Cell && playerPredictedTeam1) {
          if (actualTeam1Winning) {
            return { background: '#fff9c4', color: '#000' }; // Yellow - looks good (not confirmed)
          } else {
            return { background: '#b3e5fc', color: '#000' }; // Light Blue - looks bad (not confirmed)
          }
        }
        if (!isTeam1Cell && playerPredictedTeam2) {
          if (actualTeam2Winning) {
            return { background: '#fff9c4', color: '#000' }; // Yellow - looks good (not confirmed)
          } else {
            return { background: '#b3e5fc', color: '#000' }; // Light Blue - looks bad (not confirmed)
          }
        }
      }
      
      // STATE 2: Game status = LIVE
      // Use Light Green/Light Red
      if (gameStatus === 'live') {
        // Only color the predicted winner cell
        if (isTeam1Cell && playerPredictedTeam1) {
          if (actualTeam1Winning) {
            return { background: '#c8e6c9', color: '#000' }; // Light Green - winning now!
          } else {
            return { background: '#ffcdd2', color: '#000' }; // Light Red - losing now!
          }
        }
        if (!isTeam1Cell && playerPredictedTeam2) {
          if (actualTeam2Winning) {
            return { background: '#c8e6c9', color: '#000' }; // Light Green - winning now!
          } else {
            return { background: '#ffcdd2', color: '#000' }; // Light Red - losing now!
          }
        }
      }
      
      // STATE 3: Game status = FINAL
      // Use Bright Green/Bright Red
      if (gameStatus === 'final') {
        // Only color the predicted winner cell
        if (isTeam1Cell && playerPredictedTeam1) {
          if (actualTeam1Winning) {
            return { background: '#4caf50', color: '#000' }; // Bright Green - CORRECT! ✅
          } else {
            return { background: '#f44336', color: '#000' }; // Bright Red - WRONG! ❌
          }
        }
        if (!isTeam1Cell && playerPredictedTeam2) {
          if (actualTeam2Winning) {
            return { background: '#4caf50', color: '#000' }; // Bright Green - CORRECT! ✅
          } else {
            return { background: '#f44336', color: '#000' }; // Bright Red - WRONG! ❌
          }
        }
      }
    }
    
    // Default: No highlighting
    return { background: 'transparent', color: '#000' };
  };

  // ============================================
  // 💰 PHASE 2: PRIZE POOL & WINNER DECLARATION
  // ============================================

  /**
   * Save prize pool setup to Firebase
   */
  const savePrizePool = async (totalFees, numberOfPlayers, entryFee) => {
    try {
      const prizeValue = totalFees / 10; // Each prize is 10%
      const poolData = {
        totalFees: Number(totalFees),
        prizeValue: Number(prizeValue.toFixed(2)),
        numberOfPlayers: Number(numberOfPlayers),
        entryFee: Number(entryFee),
        lastUpdated: new Date().toISOString()
      };
      
      await set(ref(database, 'prizePool'), poolData);
      setPrizePool(poolData);
      alert(`✅ Prize pool saved!\n\nTotal Pool: $${totalFees}\nEach Prize: $${prizeValue.toFixed(2)} (10%)`);
      setShowPrizePoolSetup(false);
    } catch (error) {
      console.error('Error saving prize pool:', error);
      alert(`❌ Error saving prize pool: ${error.message}`);
    }
  };

  /**
   * Calculate split for winners (equal split with extra penny to last person)
   */
  const calculateSplit = (prizeValue, numWinners) => {
    const baseAmount = Math.floor((prizeValue * 100) / numWinners) / 100; // Round down
    const basePercentage = Math.floor((10000 / numWinners)) / 100; // Round down percentage
    
    const splits = [];
    let totalAllocated = 0;
    
    // Give base amount to all but last
    for (let i = 0; i < numWinners - 1; i++) {
      splits.push({
        percentage: basePercentage,
        amount: baseAmount
      });
      totalAllocated += baseAmount;
    }
    
    // Last person gets remainder (includes extra penny if any)
    const lastAmount = Number((prizeValue - totalAllocated).toFixed(2));
    const lastPercentage = Number((100 - (basePercentage * (numWinners - 1))).toFixed(2));
    splits.push({
      percentage: lastPercentage,
      amount: lastAmount
    });
    
    return splits;
  };

  /**
   * Declare winner(s) for a prize
   */
  const declareWinners = async () => {
    if (!selectedPrize || selectedWinners.length === 0) {
      alert('❌ Please select a prize and at least one winner.');
      return;
    }
    
    try {
      const prizeValue = prizePool.prizeValue || 100;
      let splits = [];
      
      if (useCustomSplit) {
        // Validate custom splits
        const totalPercent = customSplits.reduce((sum, split) => sum + Number(split.percentage || 0), 0);
        const totalAmount = customSplits.reduce((sum, split) => sum + Number(split.amount || 0), 0);
        
        if (Math.abs(totalPercent - 100) > 0.01) {
          alert(`❌ Percentages must equal 100%!\nCurrent total: ${totalPercent.toFixed(2)}%`);
          return;
        }
        
        if (Math.abs(totalAmount - prizeValue) > 0.01) {
          alert(`❌ Amounts must equal $${prizeValue.toFixed(2)}!\nCurrent total: $${totalAmount.toFixed(2)}`);
          return;
        }
        
        splits = customSplits.map((split, idx) => ({
          playerCode: selectedWinners[idx].code,
          playerName: selectedWinners[idx].name,
          percentage: Number(split.percentage),
          amount: Number(split.amount)
        }));
      } else {
        // Auto-calculate equal split
        const autoSplits = calculateSplit(prizeValue, selectedWinners.length);
        splits = selectedWinners.map((winner, idx) => ({
          playerCode: winner.code,
          playerName: winner.name,
          percentage: autoSplits[idx].percentage,
          amount: autoSplits[idx].amount
        }));
      }
      
      // Save to Firebase
      const winnerData = {
        prizeNumber: selectedPrize,
        prizeName: getPrizeName(selectedPrize),
        prizeValue: prizeValue,
        winners: splits,
        declaredBy: 'POOL_MANAGER',
        declaredByCode: playerCode,
        declaredByName: playerName,
        declaredAt: new Date().toISOString()
      };
      
      await set(ref(database, `officialWinners/prize${selectedPrize}`), winnerData);
      
      alert(`✅ Winner(s) declared for ${getPrizeName(selectedPrize)}!\n\n${splits.map(s => `${s.playerName}: ${s.percentage}% ($${s.amount.toFixed(2)})`).join('\n')}`);
      
      // Reset form
      setSelectedPrize('');
      setNumberOfWinners(1);
      setSelectedWinners([]);
      setUseCustomSplit(false);
      setCustomSplits([]);
      setShowWinnerDeclaration(false);
    } catch (error) {
      console.error('Error declaring winners:', error);
      alert(`❌ Error declaring winners: ${error.message}`);
    }
  };

  /**
   * Get prize name from number
   */
  const getPrizeName = (prizeNum) => {
    const prizes = {
      1: 'Prize #1 - Week 1 Most Correct Predictions',
      2: 'Prize #2 - Week 1 Closest Total Points',
      3: 'Prize #3 - Week 2 Most Correct Predictions',
      4: 'Prize #4 - Week 2 Closest Total Points',
      5: 'Prize #5 - Week 3 Most Correct Predictions',
      6: 'Prize #6 - Week 3 Closest Total Points',
      7: 'Prize #7 - Week 4 Most Correct Predictions',
      8: 'Prize #8 - Week 4 Closest Total Points',
      9: 'Prize #9 - Overall 4-Week Grand Total Most Correct Predictions',
      10: 'Prize #10 - Overall 4-Week Grand Total Closest Points'
    };
    return prizes[prizeNum] || `Prize #${prizeNum}`;
  };

  /**
   * Delete/clear a prize declaration
   */
  const deletePrizeDeclaration = async (prizeNum) => {
    if (!window.confirm(`Are you sure you want to delete the winner declaration for ${getPrizeName(prizeNum)}?\n\nThis action cannot be undone!`)) {
      return;
    }
    
    try {
      await set(ref(database, `officialWinners/prize${prizeNum}`), null);
      alert(`✅ Winner declaration deleted for ${getPrizeName(prizeNum)}`);
    } catch (error) {
      console.error('Error deleting prize:', error);
      alert(`❌ Error: ${error.message}`);
    }
  };

  // 🔒 NEW: Check if a week should be automatically locked based on date
  const shouldAutoLock = (weekKey) => {
    const autoLockDate = AUTO_LOCK_DATES[weekKey];
    if (!autoLockDate) return false;
    
    const now = new Date();
    const pstTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    const lockDate = new Date(autoLockDate + 'T00:00:00');
    
    return pstTime >= lockDate;
  };

  // 🔒 NEW: Check if a week is locked (manual lock OR auto lock)
  const isWeekLocked = (weekKey) => {
    // Pool Manager bypasses all locks
    if (isPoolManager()) {
      return false;
    }
    
    // Check manual lock
    if (weekLockStatus[weekKey]?.locked) {
      return true;
    }
    
    // Check automatic lock based on date
    return shouldAutoLock(weekKey);
  };

  // 🔒 NEW: Load week lock status from Firebase
  useEffect(() => {
    const weekLockRef = ref(database, 'weekLockStatus');
    onValue(weekLockRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Merge with auto-lock dates
        const mergedStatus = {};
        Object.keys(AUTO_LOCK_DATES).forEach(weekKey => {
          mergedStatus[weekKey] = {
            locked: data[weekKey]?.locked || false,
            lockDate: data[weekKey]?.lockDate || null,
            autoLockDate: AUTO_LOCK_DATES[weekKey]
          };
        });
        setWeekLockStatus(mergedStatus);
      }
    });
  }, []);

  // 🔒 NEW: Pool Manager function to manually lock/unlock a week
  const handleWeekLockToggle = (weekKey) => {
    const newLockStatus = !weekLockStatus[weekKey].locked;
    const lockDate = newLockStatus ? new Date().toISOString() : null;
    
    const updatedStatus = {
      ...weekLockStatus,
      [weekKey]: {
        ...weekLockStatus[weekKey],
        locked: newLockStatus,
        lockDate: lockDate
      }
    };
    
    setWeekLockStatus(updatedStatus);
    
    // Save to Firebase
    set(ref(database, `weekLockStatus/${weekKey}`), {
      locked: newLockStatus,
      lockDate: lockDate,
      autoLockDate: AUTO_LOCK_DATES[weekKey]
    });
    
    alert(newLockStatus 
      ? `✅ Week ${weekKey} is now LOCKED\n\nPlayers cannot edit picks for this week.`
      : `🔓 Week ${weekKey} is now UNLOCKED\n\nPlayers can edit picks for this week.`
    );
  };

  // Load all picks from Firebase
  useEffect(() => {
    const picksRef = ref(database, 'picks');
    onValue(picksRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const picksArray = Object.keys(data).map(key => ({
          ...data[key],
          firebaseKey: key
        }));
        setAllPicks(picksArray);
      } else {
        setAllPicks([]);
      }
    });
  }, []);

  // Load team codes from Firebase
  useEffect(() => {
    const teamCodesRef = ref(database, 'teamCodes');
    onValue(teamCodesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setTeamCodes(data);
      }
    });
  }, []);

  // Load actual scores from Firebase
  useEffect(() => {
    const actualScoresRef = ref(database, 'actualScores');
    onValue(actualScoresRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setActualScores(data);
      }
    });
  }, []);

  // Load game status from Firebase
  useEffect(() => {
    const gameStatusRef = ref(database, 'gameStatus');
    onValue(gameStatusRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setGameStatus(data);
      }
    });
  }, []);

  // 🆕 STEP 5: Load official winners from Firebase
  useEffect(() => {
    const winnersRef = ref(database, 'officialWinners');
    onValue(winnersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setOfficialWinners(data);
      }
    });
  }, []);

  // 💰 Load prize pool setup from Firebase
  useEffect(() => {
    const prizePoolRef = ref(database, 'prizePool');
    onValue(prizePoolRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setPrizePool(data);
      }
    });
  }, []);

  // 📡 Load game locks from Firebase  ← ADD THIS NEW ONE HERE
  useEffect(() => {
    const gameLocksRef = ref(database, 'gameLocks');
    onValue(gameLocksRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setGameLocks(data);
      }
    });
  }, []);

  // Load manual week totals from Firebase
  useEffect(() => {
    const manualTotalsRef = ref(database, 'manualWeekTotals');
    onValue(manualTotalsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setManualWeekTotals(data);
      }
    });
  }, []);

  // 🔧 FIX #3: Auto-load existing picks when week changes or player logs in
  useEffect(() => {
    if (codeValidated && playerName && allPicks.length > 0) {
      // Find existing pick for current week and player
      const existingPick = allPicks.find(
        pick => pick.playerName === playerName && pick.week === currentWeek
      );
      
      if (existingPick && existingPick.predictions) {
        console.log('Loading existing picks for', playerName, 'week', currentWeek);
        setPredictions(existingPick.predictions);
      } else {
        // No existing picks for this week - clear the form
        console.log('No existing picks found - clearing form');
        setPredictions({});
      }
    }
  }, [currentWeek, allPicks, codeValidated, playerName]);

  // 📡 Initialize ESPN Auto-Refresh
  useEffect(() => {
    const autoRefresh = new ESPNAutoRefresh(handleESPNFetch, 5);
    setEspnAutoRefresh(autoRefresh);
    // Cleanup on unmount
    return () => {
      if (autoRefresh) {
        autoRefresh.stop();
      }
    };
  }, []);

  // ============================================
  // 📡 ESPN API FUNCTIONS
  // ============================================

  /**
   * Fetch scores from ESPN and update Firebase
   */
  const handleESPNFetch = async () => {
    try {
      console.log('Fetching scores from ESPN...');
      const espnData = await fetchESPNScores();

      if (!espnData.success) {
        console.error('ESPN fetch failed:', espnData.error);
        return;
      }

      console.log('ESPN games fetched:', espnData.games.length);

      // Map ESPN games to our playoff structure
      const weekGames = PLAYOFF_WEEKS[currentWeek].games;
      const updates = {};

      espnData.games.forEach(espnGame => {
        const matchedGame = mapESPNGameToPlayoffGame(
          espnGame,
          PLAYOFF_WEEKS,
          currentWeek,
          teamCodes
        );

        if (matchedGame) {
          const gameId = matchedGame.gameId;

          // Check if game is locked (manual override)
          if (gameLocks[currentWeek]?.[gameId]) {
            console.log(`Game ${gameId} is locked, skipping API update`);
            return;
          }

          // Update score
          updates[gameId] = {
            team1: matchedGame.team1Score,
            team2: matchedGame.team2Score,
            source: 'espn',
            lastUpdated: new Date().toISOString()
          };

          // Update game status
          setGameStatus(prev => ({
            ...prev,
            [currentWeek]: {
              ...prev[currentWeek],
              [gameId]: matchedGame.isFinal ? 'final' : matchedGame.isLive ? 'live' : ''
            }
          }));
        }
      });

      // Update actualScores state
      if (Object.keys(updates).length > 0) {
        setActualScores(prev => ({
          ...prev,
          [currentWeek]: {
            ...prev[currentWeek],
            ...updates
          }
        }));

        // Save to Firebase
        const scoresRef = ref(database, `actualScores/${currentWeek}`);
        await set(scoresRef, {
          ...actualScores[currentWeek],
          ...updates
        });

        console.log(`Updated ${Object.keys(updates).length} games from ESPN`);
      }

      setLastESPNFetch(new Date());
    } catch (error) {
      console.error('Error fetching ESPN scores:', error);
    }
  };

  /**
   * Toggle game lock (prevent/allow ESPN updates)
   */
  const handleGameLockToggle = (gameId) => {
    console.log('🔧 Toggle clicked for game:', gameId);
    console.log('📊 Current week:', currentWeek);
    console.log('📊 Current locks:', gameLocks);
    console.log('📊 Current value for game', gameId, ':', gameLocks[currentWeek]?.[gameId]);
    
    setGameLocks(prev => {
      const newLocks = { ...prev };
      if (!newLocks[currentWeek]) {
        newLocks[currentWeek] = {};
      }
      
      const oldValue = newLocks[currentWeek][gameId];
      const newValue = !oldValue;
      
      console.log('🔄 Old value:', oldValue);
      console.log('🔄 New value:', newValue);
      
      newLocks[currentWeek][gameId] = newValue;
      
      // Save to Firebase
      const locksRef = ref(database, `gameLocks/${currentWeek}/${gameId}`);
      set(locksRef, newValue);
      
      console.log('💾 Saved to Firebase:', newValue);
      console.log('📦 Returning new locks:', newLocks);
      
      return newLocks;
    });
  };

  const handleScoreChange = (gameId, team, score) => {
    setPredictions(prev => ({
      ...prev,
      [gameId]: {
        ...prev[gameId],
        [team]: score
      }
    }));
    // Manually set unsaved changes flag when user types
    console.log('⌨️ User typed score - setting hasUnsavedChanges to TRUE');
    setHasUnsavedChanges(true);
  };

  // RNG Pick - Auto-fill all games with random scores
  const handleRNGPick = () => {
    // Check if any predictions already exist
    const hasExistingPicks = Object.keys(predictions).some(gameId => 
      predictions[gameId]?.team1 || predictions[gameId]?.team2
    );
    
    // Show warning if picks exist
    if (hasExistingPicks) {
      const confirmed = window.confirm(
        '⚠️ WARNING!\n\n' +
        'Clicking RNG will OVERWRITE all your current picks!\n\n' +
        'Are you sure you want to continue?'
      );
      
      if (!confirmed) {
        return; // User cancelled
      }
    }
    
    // Generate random scores between 3 and 45 (realistic NFL range)
    const newPredictions = {};
    currentWeekData.games.forEach(game => {
      let team1Score = Math.floor(Math.random() * (45 - 3 + 1)) + 3;
      let team2Score = Math.floor(Math.random() * (45 - 3 + 1)) + 3;
      
      // Ensure no ties - regenerate team2 if scores match
      while (team1Score === team2Score) {
        team2Score = Math.floor(Math.random() * (45 - 3 + 1)) + 3;
      }
      
      newPredictions[game.id] = {
        team1: team1Score.toString(),
        team2: team2Score.toString()
      };
    });
    setPredictions(newPredictions);
    console.log('🎲 RNG: Setting hasUnsavedChanges to TRUE');
    setHasUnsavedChanges(true); // Mark as having unsaved changes
    console.log('🎲 RNG: hasUnsavedChanges should now be true');
    alert(
      `🎲 RNG picks generated for all ${currentWeekData.games.length} games!\n\n` +
      `Score range: 3-45 points per team\n` +
      `No tied games guaranteed!\n\n` +
      `You can now edit any scores before submitting.`
    );
  };

  // Pool Manager functions to update team codes
  const handleTeamCodeChange = (gameId, team, code) => {
    const updatedCodes = {
      ...teamCodes,
      [currentWeek]: {
        ...(teamCodes[currentWeek] || {}),
        [gameId]: {
          ...(teamCodes[currentWeek]?.[gameId] || {}),
          [team]: code.toUpperCase()
        }
      }
    };
    setTeamCodes(updatedCodes);
    
    // Save to Firebase
    set(ref(database, `teamCodes/${currentWeek}/${gameId}/${team}`), code.toUpperCase());
  };

  // Pool Manager functions to update actual scores
  const handleActualScoreChange = (gameId, team, score) => {
    const updatedScores = {
      ...actualScores,
      [currentWeek]: {
        ...(actualScores[currentWeek] || {}),
        [gameId]: {
          ...(actualScores[currentWeek]?.[gameId] || {}),
          [team]: score
        }
      }
    };
    setActualScores(updatedScores);
    
    // Save to Firebase
    set(ref(database, `actualScores/${currentWeek}/${gameId}/${team}`), score);
  };

  // Pool Manager functions to update game status
  const handleGameStatusChange = (gameId, status) => {
    const updatedStatus = {
      ...gameStatus,
      [currentWeek]: {
        ...(gameStatus[currentWeek] || {}),
        [gameId]: status
      }
    };
    setGameStatus(updatedStatus);
    
    // Save to Firebase
    set(ref(database, `gameStatus/${currentWeek}/${gameId}`), status);
  };

  // Pool Manager function to update manual week totals
  const handleManualTotalChange = (weekKey, value) => {
    const updatedTotals = {
      ...manualWeekTotals,
      [weekKey]: value
    };
    setManualWeekTotals(updatedTotals);
    
    // Mark as manually overridden ONLY if value is not empty
    // If empty/null/undefined, return to auto-calculation
    const isOverridden = value !== '' && value !== null && value !== undefined;
    setManualOverrides(prev => ({
      ...prev,
      [weekKey]: isOverridden
    }));
    
    // Save to Firebase
    set(ref(database, `manualWeekTotals/${weekKey}`), value || null);
  };
  
  /**
   * Clear manual override and return to auto-calculation
   */
  const clearManualOverride = (weekKey) => {
    setManualWeekTotals(prev => ({
      ...prev,
      [weekKey]: ''
    }));
    setManualOverrides(prev => ({
      ...prev,
      [weekKey]: false
    }));
    set(ref(database, `manualWeekTotals/${weekKey}`), null);
  };
  
  /**
   * Calculate auto-calculated weekly total for a player
   * Sum of point differences for all games in a specific week
   */
  // ============================================
  // 🎯 SMART P NOTATION HELPER FUNCTIONS
  // ============================================
  
  /**
   * Calculate predicted total for a week (sum of all predicted scores)
   */
  const calculatePredictedTotal = (playerCode, week) => {
    const playerPick = allPicks.find(p => p.playerCode === playerCode && p.week === week);
    if (!playerPick || !playerPick.predictions) return null;
    
    let total = 0;
    Object.keys(playerPick.predictions).forEach(gameId => {
      const pred = playerPick.predictions[gameId];
      if (pred && pred.team1 && pred.team2) {
        total += (parseInt(pred.team1) || 0) + (parseInt(pred.team2) || 0);
      }
    });
    
    return total;
  };

  /**
   * Get which weeks a player has picks for
   * Returns array like [1, 2, 3, 4] or [1, 3] etc.
   */
  const getPlayerWeeks = (playerCode) => {
    const weeks = [];
    const weekMap = {
      wildcard: 1,
      divisional: 2,
      conference: 3,
      superbowl: 4
    };
    
    ['wildcard', 'divisional', 'conference', 'superbowl'].forEach(weekName => {
      const hasPick = allPicks.some(p => p.playerCode === playerCode && p.week === weekName);
      if (hasPick) {
        weeks.push(weekMap[weekName]);
      }
    });
    
    return weeks;
  };

  /**
   * Check if pattern is abnormal (not sequential from 1)
   * Normal: [1], [1,2], [1,2,3], [1,2,3,4]
   * Abnormal: [1,3], [2], [1,2,4], etc.
   */
  const isAbnormalPattern = (weeks) => {
    if (weeks.length === 0) return false;
    if (weeks.length === 4) return false; // Complete is normal
    
    // Check if sequential from 1
    const isSequential = weeks.every((week, index) => week === index + 1);
    return !isSequential;
  };

  /**
   * Format P notation (P13, P123, etc.)
   */
  const formatPNotation = (weeks) => {
    return 'P' + weeks.join('');
  };

  /**
   * Check if player's pick for a week was RNG'd by Pool Manager
   */
  const isRNGPick = (playerCode, week) => {
    const playerPick = allPicks.find(p => p.playerCode === playerCode && p.week === week);
    return playerPick?.enteredBy === 'POOL_MANAGER_RNG';
  };

  const calculateWeeklyTotal = (playerCode, week) => {
    // Find player's picks for this week
    const playerPick = allPicks.find(p => p.playerCode === playerCode && p.week === week);
    if (!playerPick || !playerPick.predictions) return 0;
    
    // Get actual scores for this week
    const weekActualScores = actualScores[week];
    if (!weekActualScores) return 0;
    
    // Calculate sum of point differences
    let total = 0;
    Object.keys(playerPick.predictions).forEach(gameId => {
      const pred = playerPick.predictions[gameId];
      const actual = weekActualScores[gameId];
      
      if (pred && actual && pred.team1 && pred.team2 && actual.team1 && actual.team2) {
        const predTotal = parseInt(pred.team1) + parseInt(pred.team2);
        const actualTotal = parseInt(actual.team1) + parseInt(actual.team2);
        const diff = Math.abs(predTotal - actualTotal);
        total += diff;
      }
    });
    
    return total;
  };
  
  /**
   * Calculate grand total (sum of all 4 weeks) for a player
   */
  const calculateGrandTotal = (playerCode) => {
    const week1 = calculateWeeklyTotal(playerCode, 'wildcard');
    const week2 = calculateWeeklyTotal(playerCode, 'divisional');
    const week3 = calculateWeeklyTotal(playerCode, 'conference');
    const week4 = calculateWeeklyTotal(playerCode, 'superbowl');
    return week1 + week2 + week3 + week4;
  };
  
  /**
   * ============================================
   * 🎨 SMART DISPLAY FORMATTING FUNCTIONS
   * ============================================
   */
  
  /**
   * Format weekly total for display with smart P notation
   * Returns object: { display: string, tooltip: string, fontSize: string }
   */
  const formatWeeklyDisplay = (playerCode, weekName, weekNumber) => {
    const predicted = calculatePredictedTotal(playerCode, weekName);
    const difference = calculateWeeklyTotal(playerCode, weekName);
    const isRNG = isRNGPick(playerCode, weekName);
    const hasActual = Object.keys(actualScores[weekName] || {}).length > 0;
    
    if (!predicted) {
      return { display: '-', tooltip: '', fontSize: '16px' };
    }
    
    const asterisk = isRNG ? '*' : '';
    
    if (!hasActual || difference === 0) {
      return {
        display: `${predicted}${asterisk}`,
        tooltip: isRNG ? `Predicted: ${predicted} (RNG filled by Pool Manager)` : `Predicted: ${predicted}`,
        fontSize: '16px'
      };
    }
    
    return {
      display: `${predicted}${asterisk}/${difference}`,
      tooltip: isRNG 
        ? `Predicted: ${predicted} (RNG) | Difference: ${difference}`
        : `Predicted: ${predicted} | Difference: ${difference}`,
      fontSize: '16px'
    };
  };
  
  /**
   * Format grand total with smart P notation
   * Returns object: { display: string, tooltip: string, fontSize: string }
   */
  const formatGrandDisplay = (playerCode) => {
    const weeks = getPlayerWeeks(playerCode);
    
    if (weeks.length === 0) {
      return { display: '-', tooltip: '', fontSize: '16px' };
    }
    
    const abnormal = isAbnormalPattern(weeks);
    const prefix = abnormal ? formatPNotation(weeks) + '/' : '';
    
    // Calculate full predicted (all weeks player entered)
    let fullPredicted = 0;
    let playedPredicted = 0;
    let totalDifference = 0;
    let hasAnyActual = false;
    let allWeeksPlayed = true;
    
    const weekMap = { 1: 'wildcard', 2: 'divisional', 3: 'conference', 4: 'superbowl' };
    
    weeks.forEach(weekNum => {
      const weekName = weekMap[weekNum];
      const pred = calculatePredictedTotal(playerCode, weekName);
      const diff = calculateWeeklyTotal(playerCode, weekName);
      const hasActual = Object.keys(actualScores[weekName] || {}).length > 0;
      
      if (pred) {
        fullPredicted += pred;
        
        if (hasActual && diff > 0) {
          playedPredicted += pred;
          totalDifference += diff;
          hasAnyActual = true;
        } else if (!hasActual) {
          allWeeksPlayed = false;
        }
      }
    });
    
    // Tooltip text
    let tooltip = '';
    if (abnormal) {
      tooltip = `Weeks Entered: ${weeks.join(', ')} | `;
    }
    
    // No games played yet
    if (!hasAnyActual) {
      tooltip += `Full Prediction: ${fullPredicted}`;
      return {
        display: `${prefix}${fullPredicted}`,
        tooltip,
        fontSize: '16px'
      };
    }
    
    // All entered weeks are played
    if (allWeeksPlayed) {
      tooltip += `Full Prediction: ${fullPredicted} | Total Difference: ${totalDifference}`;
      return {
        display: `${prefix}${fullPredicted}/${totalDifference}`,
        tooltip,
        fontSize: '16px'
      };
    }
    
    // Some weeks played, some not
    tooltip += `Full Prediction: ${fullPredicted} | Played Weeks: ${playedPredicted} | Difference So Far: ${totalDifference}`;
    return {
      display: `${prefix}${fullPredicted}/${playedPredicted}/${totalDifference}`,
      tooltip,
      fontSize: '14px' // Smaller font for 3 numbers
    };
  };
  
  /**
   * Calculate total actual points scored across all games in a week
   * This is for the header display (not player-specific)
   */
  const calculateWeekTotalPoints = (weekName) => {
    const weekScores = actualScores[weekName];
    if (!weekScores) return 0;
    
    let total = 0;
    Object.values(weekScores).forEach(game => {
      if (game && game.team1 && game.team2) {
        total += (parseInt(game.team1) || 0) + (parseInt(game.team2) || 0);
      }
    });
    
    return total;
  };
  
  /**
   * Get the display value for week total header
   * Uses manual override if set, otherwise shows total actual points for that week
   */
  const getHeaderDisplayValue = (weekKey, weekName) => {
    // If manually overridden, use that value
    if (manualWeekTotals[weekKey]) {
      return manualWeekTotals[weekKey];
    }
    
    // Otherwise, calculate total actual points for this week
    const total = calculateWeekTotalPoints(weekName);
    return total > 0 ? total : '';
  };
  
  /**
   * Get grand total header value (sum of all 4 weeks)
   */
  const getGrandTotalHeaderValue = () => {
    // If manually overridden, use that value
    if (manualWeekTotals.superbowl_grand) {
      return manualWeekTotals.superbowl_grand;
    }
    
    // Otherwise, sum all 4 weeks
    const week1Total = calculateWeekTotalPoints('wildcard');
    const week2Total = calculateWeekTotalPoints('divisional');
    const week3Total = calculateWeekTotalPoints('conference');
    const week4Total = calculateWeekTotalPoints('superbowl');
    
    const grandTotal = week1Total + week2Total + week3Total + week4Total;
    return grandTotal > 0 ? grandTotal : '';
  };

  // ============================================
  // 🎲 POOL MANAGER RNG - QUICK TEST DATA
  // ============================================
  
  // All 32 NFL teams
  const NFL_TEAMS = [
    'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE',
    'DAL', 'DEN', 'DET', 'GB', 'HOU', 'IND', 'JAC', 'KC',
    'LV', 'LAC', 'LAR', 'MIA', 'MIN', 'NE', 'NO', 'NYG',
    'NYJ', 'PHI', 'PIT', 'SF', 'SEA', 'TB', 'TEN', 'WAS'
  ];

  // Pool Manager RNG - Auto-populate everything for testing
  const handlePoolManagerRNG = () => {
    // Check if any data already exists
    const hasExistingTeams = currentWeekData.games.some(game => 
      teamCodes[currentWeek]?.[game.id]?.team1 || teamCodes[currentWeek]?.[game.id]?.team2
    );
    const hasExistingScores = currentWeekData.games.some(game =>
      actualScores[currentWeek]?.[game.id]?.team1 || actualScores[currentWeek]?.[game.id]?.team2
    );
    const hasExistingStatus = currentWeekData.games.some(game =>
      gameStatus[currentWeek]?.[game.id]
    );

    // Show warning if any data exists
    if (hasExistingTeams || hasExistingScores || hasExistingStatus) {
      const confirmed = window.confirm(
        '⚠️ POOL MANAGER RNG WARNING!\n\n' +
        'This will OVERWRITE:\n' +
        '• All team codes\n' +
        '• All actual scores\n' +
        '• All game statuses\n\n' +
        'Are you sure you want to continue?'
      );
      
      if (!confirmed) {
        return; // User cancelled
      }
    }

    // Shuffle and select random teams (ensure each team used only once)
    const shuffledTeams = [...NFL_TEAMS].sort(() => Math.random() - 0.5);
    const gamesCount = currentWeekData.games.length;
    const teamsNeeded = gamesCount * 2;
    
    if (teamsNeeded > shuffledTeams.length) {
      alert('⚠️ Not enough unique teams for all games!');
      return;
    }

    const selectedTeams = shuffledTeams.slice(0, teamsNeeded);

    // Generate data for each game
    const newTeamCodes = { ...teamCodes };
    const newActualScores = { ...actualScores };
    const newGameStatus = { ...gameStatus };

    if (!newTeamCodes[currentWeek]) newTeamCodes[currentWeek] = {};
    if (!newActualScores[currentWeek]) newActualScores[currentWeek] = {};
    if (!newGameStatus[currentWeek]) newGameStatus[currentWeek] = {};

    currentWeekData.games.forEach((game, index) => {
      const team1 = selectedTeams[index * 2];
      const team2 = selectedTeams[index * 2 + 1];
      let score1 = Math.floor(Math.random() * (50 - 3 + 1)) + 3;
      let score2 = Math.floor(Math.random() * (50 - 3 + 1)) + 3;

      // Ensure no ties - regenerate score2 if scores match
      while (score1 === score2) {
        score2 = Math.floor(Math.random() * (50 - 3 + 1)) + 3;
      }

      // Set team codes
      newTeamCodes[currentWeek][game.id] = {
        team1: team1,
        team2: team2
      };

      // Set actual scores
      newActualScores[currentWeek][game.id] = {
        team1: score1.toString(),
        team2: score2.toString()
      };

      // Set status to final
      newGameStatus[currentWeek][game.id] = 'final';

      // Save to Firebase
      set(ref(database, `teamCodes/${currentWeek}/${game.id}`), {
        team1: team1,
        team2: team2
      });
      set(ref(database, `actualScores/${currentWeek}/${game.id}`), {
        team1: score1.toString(),
        team2: score2.toString()
      });
      set(ref(database, `gameStatus/${currentWeek}/${game.id}`), 'final');
    });

    // Update state
    setTeamCodes(newTeamCodes);
    setActualScores(newActualScores);
    setGameStatus(newGameStatus);

    alert(
      `🎲 POOL MANAGER RNG Complete!\n\n` +
      `✅ ${gamesCount} games populated\n` +
      `✅ Random teams assigned (each used once)\n` +
      `✅ Scores: 3-50 points\n` +
      `✅ No tied games guaranteed\n` +
      `✅ All games marked FINAL\n\n` +
      `Ready for testing!`
    );
  };

  // ============================================
  // 🚪 LOGOUT HANDLER WITH UNSAVED CHANGES CHECK
  // ============================================
  
  const handleLogout = () => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚪 HANDLE LOGOUT CALLED');
    console.log('📊 Current hasUnsavedChanges value:', hasUnsavedChanges);
    console.log('📦 Current predictions:', JSON.stringify(predictions));
    console.log('📦 Current originalPicks:', JSON.stringify(originalPicks));
    console.log('🔍 Are they equal?', JSON.stringify(predictions) === JSON.stringify(originalPicks));
    
    // Check if there are unsaved changes
    if (hasUnsavedChanges) {
      console.log('⚠️⚠️⚠️ HAS UNSAVED CHANGES - SHOWING WARNING ⚠️⚠️⚠️');
      const choice = window.confirm(
        '⚠️ UNSAVED CHANGES!\n\n' +
        'You have unsaved picks that will be lost.\n\n' +
        'Click OK to DISCARD changes and logout\n' +
        'Click CANCEL to stay and save your picks'
      );
      
      if (!choice) {
        console.log('❌ User cancelled logout');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        return; // User wants to stay and save
      }
      console.log('✅ User confirmed logout - discarding changes');
    } else {
      console.log('✅✅✅ NO UNSAVED CHANGES - LOGGING OUT DIRECTLY ✅✅✅');
    }
    
    // Proceed with logout
    console.log('🚪 Proceeding with logout...');
    setCodeValidated(false);
    setPlayerCode('');
    setPlayerName('');
    setPredictions({});
    setCurrentView('picks');
    setHasUnsavedChanges(false);
    console.log('🚪 Logout complete');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  // ============================================
  // ❌ CANCEL PICKS HANDLER
  // ============================================
  
  const handleCancelPicks = () => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        '⚠️ DISCARD CHANGES?\n\n' +
        'This will reset your picks to the last saved version.\n\n' +
        'Are you sure you want to discard your changes?'
      );
      
      if (!confirmed) {
        return; // User cancelled
      }
    }
    
    // Reset to last saved picks or empty
    const playerPick = allPicks.find(p => p.playerCode === playerCode && p.week === currentWeek);
    if (playerPick) {
      setPredictions(playerPick.predictions);
    } else {
      setPredictions({});
    }
    setHasUnsavedChanges(false);
  };

  // ============================================
  // 🆕 STEP 5: COMPLETE FEATURE HANDLERS
  // ============================================
  
  // Pool Manager declares official winner
  const handleDeclareWinner = async (prizeNumber, winner) => {
    if (winner) {
      // Declare a winner
      const updatedWinners = {
        ...officialWinners,
        [prizeNumber]: winner
      };
      setOfficialWinners(updatedWinners);
      
      // Save to Firebase
      try {
        await update(ref(database, `winners/${prizeNumber}`), {
          playerCode: winner.playerCode,
          playerName: winner.playerName,
          score: winner.score,
          declaredAt: new Date().toISOString(),
          declaredBy: playerCode
        });
        alert(`✅ Winner declared for Prize #${prizeNumber}: ${winner.playerName}`);
      } catch (error) {
        console.error('Failed to save winner:', error);
        alert('❌ Failed to save winner. Please try again.');
      }
    } else {
      // Remove winner
      const updated = {...officialWinners};
      delete updated[prizeNumber];
      setOfficialWinners(updated);
      
      // Remove from Firebase
      try {
        await set(ref(database, `winners/${prizeNumber}`), null);
        alert(`✅ Winner removed for Prize #${prizeNumber}`);
      } catch (error) {
        console.error('Failed to remove winner:', error);
      }
    }
  };

  // Handle week change with unsaved changes check
  const handleWeekChange = (newWeek) => {
    if (hasUnsavedChanges) {
      setPendingWeekChange(newWeek);
      setShowPopup('unsavedChanges');
    } else {
      setCurrentWeek(newWeek);
      loadWeekPicks(newWeek);
    }
  };

  // Load picks for a specific week
  const loadWeekPicks = (weekKey) => {
    console.log('📂📂📂 LOAD WEEK PICKS CALLED 📂📂📂');
    console.log('📂 Loading picks for week:', weekKey);
    
    const existingPick = allPicks.find(
      p => p.week === weekKey && p.playerCode === playerCode
    );
    
    if (existingPick && existingPick.predictions) {
      console.log('📂 Found existing picks:', JSON.stringify(existingPick.predictions));
      console.log('📂 Creating deep copies for predictions and originalPicks');
      
      const predCopy = JSON.parse(JSON.stringify(existingPick.predictions));
      const origCopy = JSON.parse(JSON.stringify(existingPick.predictions));
      
      setPredictions(predCopy);
      setOriginalPicks(origCopy);
      setHasUnsavedChanges(false);
      console.log('📂 Set hasUnsavedChanges to FALSE');
      console.log('📂📂📂 LOAD WEEK PICKS COMPLETE 📂📂📂');
    } else {
      console.log('📂 No existing picks found - clearing state');
      setPredictions({});
      setOriginalPicks({});
      setHasUnsavedChanges(false);
      console.log('📂📂📂 LOAD WEEK PICKS COMPLETE (EMPTY) 📂📂📂');
    }
  };

  // DISABLED: Automatic change detection was causing issues after submit
  // We now manually control hasUnsavedChanges in RNG, score changes, and submit
  /*
  useEffect(() => {
    const predStr = JSON.stringify(predictions);
    const origStr = JSON.stringify(originalPicks);
    const hasChanges = predStr !== origStr;
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 CHANGE DETECTION useEffect triggered');
    console.log('📦 predictions:', predStr);
    console.log('📦 originalPicks:', origStr);
    console.log('🔄 hasChanges:', hasChanges);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    setHasUnsavedChanges(hasChanges);
  }, [predictions, originalPicks]);
  */


  // Load picks when week changes
  useEffect(() => {
    if (codeValidated && playerCode) {
      loadWeekPicks(currentWeek);
    }
  }, [currentWeek, codeValidated, playerCode]);
  // NOTE: allPicks removed from dependencies to prevent reload after submit!

  // Update week picks status for WeekSelector
  useEffect(() => {
    if (allPicks.length > 0 && playerCode) {
      const status = {};
      ['wildcard', 'divisional', 'conference', 'superbowl'].forEach(week => {
        const weekPick = allPicks.find(p => p.week === week && p.playerCode === playerCode);
        if (weekPick && weekPick.predictions) {
          const gameCount = PLAYOFF_WEEKS[week].games.length;
          const filledCount = Object.keys(weekPick.predictions).filter(
            gameId => weekPick.predictions[gameId]?.team1 && weekPick.predictions[gameId]?.team2
          ).length;
          status[week] = { 
            complete: filledCount === gameCount,
            count: filledCount,
            total: gameCount
          };
        }
      });
      setWeekPicksStatus(status);
    }
  }, [allPicks, playerCode]);

  // Check if submissions are allowed based on day/time (PST)
  // Pool Manager bypasses lockout
  const isSubmissionAllowed = () => {
    // Pool Manager can always submit
    if (isPoolManager()) {
      return true;
    }

    const now = new Date();
    const pstTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    
    // Check if we're in playoff season
    const playoffStart = new Date(PLAYOFF_SEASON.firstFriday + 'T00:00:00');
    const playoffEnd = new Date(PLAYOFF_SEASON.lastMonday + 'T23:59:59');
    
    // If BEFORE playoff season starts: Allow submissions anytime! ✅
    if (pstTime < playoffStart) {
      return true;
    }
    
    // If AFTER playoff season ends: Season is over
    if (pstTime > playoffEnd) {
      return false;  // You can change this if you want to keep it open
    }
    
    // We're IN playoff season - apply weekend locks
    const day = pstTime.getDay(); // 0=Sunday, 1=Monday, ..., 5=Friday, 6=Saturday
    const hours = pstTime.getHours();
    const minutes = pstTime.getMinutes();
    
    // Block on Friday after 11:59 PM (starting Saturday 00:00)
    if (day === 5 && (hours === 23 && minutes >= 59)) {
      return false;
    }
    
    // Block all day Saturday (day 6)
    if (day === 6) {
      return false;
    }
    
    // Block all day Sunday (day 0)
    if (day === 0) {
      return false;
    }
    
    // Block Monday until 12:01 AM (first minute of Monday)
    if (day === 1 && hours === 0 && minutes === 0) {
      return false;
    }
    
    // All other times during playoff season are allowed
    return true;
  };

  // Validate player code and set player name
  const handleCodeValidation = () => {
    const code = playerCode.trim().toUpperCase();
    
    if (!code) {
      alert('Please enter your 6-character player code');
      return;
    }
    
    // Accept 6-character alphanumeric codes
    if (code.length !== 6 || !/^[A-Z0-9]{6}$/.test(code)) {
      alert('Invalid code format!\n\nPlayer codes must be exactly 6 characters (letters and numbers).\nExample: A7K9M2');
      return;
    }
    
    const playerNameForCode = PLAYER_CODES[code];
    
    if (!playerNameForCode) {
      alert('Invalid player code!\n\nThis code is not recognized.\n\nMake sure you:\n1. Paid your $20 entry fee\n2. Received your code from the pool manager\n3. Entered the code correctly\n\nContact: gammoneer2b@gmail.com');
      return;
    }
    
    // Check if this player already has picks for this week
    const existingPick = allPicks.find(
      pick => pick.playerName === playerNameForCode && pick.week === currentWeek
    );
    
    if (existingPick) {
      // Alert will be shown, picks will load automatically via useEffect
      if (POOL_MANAGER_CODES.includes(code)) {
        alert(`Welcome, Pool Manager!\n\nYou have unrestricted access to:\n✓ Enter picks anytime (no lockout)\n✓ Enter team codes\n✓ Enter actual game scores\n✓ Set game status (LIVE/FINAL)\n✓ Lock/unlock weeks\n✓ View all player codes`);
      } else {
        const lockStatus = isWeekLocked(currentWeek);
        if (lockStatus) {
          alert(`Welcome back, ${playerNameForCode}!\n\n🔒 WARNING: This week is LOCKED!\n\nYour existing picks for ${PLAYOFF_WEEKS[currentWeek].name} will be loaded, but you cannot edit them because the games have been played.\n\nYou can only view your submitted picks.`);
        } else {
          alert(`Welcome back, ${playerNameForCode}!\n\nYour existing picks for ${PLAYOFF_WEEKS[currentWeek].name} will be loaded automatically.\n\nYou can edit and resubmit anytime except during playoff weekends (Friday 11:59 PM - Monday 12:01 AM PST).`);
        }
      }
    } else if (POOL_MANAGER_CODES.includes(code)) {
      alert(`Welcome, Pool Manager!\n\nYou have unrestricted access to:\n✓ Enter picks anytime (no lockout)\n✓ Enter team codes\n✓ Enter actual game scores\n✓ Set game status (LIVE/FINAL)\n✓ Lock/unlock weeks\n✓ View all player codes`);
    }
    
    // Code is valid!
    setPlayerName(playerNameForCode);
    setPlayerCode(code); // Store uppercase version
    setCodeValidated(true);
  };

  // Download picks as CSV spreadsheet - ENHANCED with Pool Manager data
  const downloadPicksAsCSV = () => {
    const weekPicks = allPicks.filter(pick => pick.week === currentWeek);
    
    if (weekPicks.length === 0) {
      alert('No picks to download for this week.');
      return;
    }

    const currentWeekData = PLAYOFF_WEEKS[currentWeek];

    // ===== ENHANCED: Add Pool Manager data at the top =====
    let csv = '';
    
    // Row 1: Team Codes
    csv += 'TEAM CODES:,';
    currentWeekData.games.forEach(game => {
      const team1Code = teamCodes[currentWeek]?.[game.id]?.team1 || '-';
      const team2Code = teamCodes[currentWeek]?.[game.id]?.team2 || '-';
      csv += `${team1Code},${team2Code},`;
    });
    if (currentWeek === 'superbowl') {
      csv += ',,,,'; // Empty cells for week totals columns
    }
    csv += '\n';
    
    // Row 2: Actual Scores
    csv += 'ACTUAL SCORES:,';
    currentWeekData.games.forEach(game => {
      const actualTeam1 = actualScores[currentWeek]?.[game.id]?.team1 || '-';
      const actualTeam2 = actualScores[currentWeek]?.[game.id]?.team2 || '-';
      csv += `${actualTeam1},${actualTeam2},`;
    });
    if (currentWeek === 'superbowl') {
      csv += ',,,,'; // Empty cells for week totals columns
    }
    csv += '\n';
    
    // Row 3: Combined Game Totals (Team1 + Team2)
    csv += 'GAME TOTALS:,';
    currentWeekData.games.forEach(game => {
      const actualTeam1 = parseInt(actualScores[currentWeek]?.[game.id]?.team1) || 0;
      const actualTeam2 = parseInt(actualScores[currentWeek]?.[game.id]?.team2) || 0;
      const gameTotal = actualTeam1 + actualTeam2;
      const gameTotalDisplay = (actualTeam1 > 0 || actualTeam2 > 0) ? gameTotal : '-';
      csv += `${gameTotalDisplay},,`; // Combined total spans both team columns
    });
    if (currentWeek === 'superbowl') {
      csv += ',,,,'; // Empty cells for week totals columns
    }
    csv += '\n';
    
    // Row 4: Game Status
    csv += 'GAME STATUS:,';
    currentWeekData.games.forEach(game => {
      const status = gameStatus[currentWeek]?.[game.id] || '-';
      const statusText = status === 'final' ? 'FINAL' : (status === 'live' ? 'LIVE' : '-');
      csv += `${statusText},,`; // Span two columns
    });
    if (currentWeek === 'superbowl') {
      csv += ',,,,'; // Empty cells for week totals columns
    }
    csv += '\n';
    
    // Row 5: Official/Manual Week Totals
    csv += 'OFFICIAL TOTALS:,';
    currentWeekData.games.forEach(() => {
      csv += ',,'; // Empty cells for game columns
    });
    if (currentWeek === 'superbowl') {
      csv += `${manualWeekTotals.superbowl_week4 || '-'},`;
      csv += `${manualWeekTotals.superbowl_week3 || '-'},`;
      csv += `${manualWeekTotals.superbowl_week2 || '-'},`;
      csv += `${manualWeekTotals.superbowl_week1 || '-'},`;
      csv += `${manualWeekTotals.superbowl_grand || '-'},`;
    } else {
      csv += `${manualWeekTotals[currentWeek] || '-'},`;
    }
    csv += '\n';
    
    // Row 6: Blank separator row
    csv += '\n';
    // ===== END ENHANCED SECTION =====

    // Create CSV header - First row with game numbers
    csv += ','; // Empty cell for player name column
    currentWeekData.games.forEach(game => {
      csv += `Game ${game.id},Game ${game.id},`;
    });
    csv += '\n';

    // Second header row with team names
    csv += 'Player Name,';
    currentWeekData.games.forEach(game => {
      csv += `${game.team1} Score,${game.team2} Score,`;
    });
    
    // Add week breakdown columns for Super Bowl
    if (currentWeek === 'superbowl') {
      csv += 'Week 4 Total,Week 3 Total,Week 2 Total,Week 1 Total,GRAND TOTAL,';
    } else {
      csv += 'Total Points,';
    }
    csv += 'Submitted At\n';

    // Add data rows
    weekPicks
      .sort((a, b) => (b.lastUpdated || b.timestamp) - (a.lastUpdated || a.timestamp))
      .forEach(pick => {
        csv += `"${pick.playerName}",`;
        currentWeekData.games.forEach(game => {
          const team1Score = pick.predictions[game.id]?.team1 || '-';
          const team2Score = pick.predictions[game.id]?.team2 || '-';
          csv += `${team1Score},${team2Score},`;
        });
        
        // Calculate totals
        if (currentWeek === 'superbowl') {
          // Calculate each week's total
          const week4Total = (() => {
            const w4Pick = allPicks.find(p => p.playerName === pick.playerName && p.week === 'superbowl');
            if (!w4Pick) return 0;
            let sum = 0;
            PLAYOFF_WEEKS.superbowl.games.forEach(game => {
              const pred = w4Pick.predictions[game.id];
              if (pred) sum += (Number(pred.team1) || 0) + (Number(pred.team2) || 0);
            });
            return sum;
          })();

          const week3Total = (() => {
            const w3Pick = allPicks.find(p => p.playerName === pick.playerName && p.week === 'conference');
            if (!w3Pick) return 0;
            let sum = 0;
            PLAYOFF_WEEKS.conference.games.forEach(game => {
              const pred = w3Pick.predictions[game.id];
              if (pred) sum += (Number(pred.team1) || 0) + (Number(pred.team2) || 0);
            });
            return sum;
          })();

          const week2Total = (() => {
            const w2Pick = allPicks.find(p => p.playerName === pick.playerName && p.week === 'divisional');
            if (!w2Pick) return 0;
            let sum = 0;
            PLAYOFF_WEEKS.divisional.games.forEach(game => {
              const pred = w2Pick.predictions[game.id];
              if (pred) sum += (Number(pred.team1) || 0) + (Number(pred.team2) || 0);
            });
            return sum;
          })();

          const week1Total = (() => {
            const w1Pick = allPicks.find(p => p.playerName === pick.playerName && p.week === 'wildcard');
            if (!w1Pick) return 0;
            let sum = 0;
            PLAYOFF_WEEKS.wildcard.games.forEach(game => {
              const pred = w1Pick.predictions[game.id];
              if (pred) sum += (Number(pred.team1) || 0) + (Number(pred.team2) || 0);
            });
            return sum;
          })();

          const grandTotal = week4Total + week3Total + week2Total + week1Total;
          
          csv += `${week4Total},${week3Total},${week2Total},${week1Total},${grandTotal},`;
        } else {
          // Single total for non-Super Bowl weeks
          const totalPoints = currentWeekData.games.reduce((total, game) => {
            const team1Score = parseInt(pick.predictions[game.id]?.team1) || 0;
            const team2Score = parseInt(pick.predictions[game.id]?.team2) || 0;
            return total + team1Score + team2Score;
          }, 0);
          csv += `${totalPoints},`;
        }
        
        const date = new Date(pick.lastUpdated || pick.timestamp).toLocaleString('en-US', {
          month: '2-digit',
          day: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });
        
        csv += `"${date}"\n`;
      });

    // Download the CSV
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `nfl_playoff_picks_${currentWeek}_${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Submit predictions
  // 🆕 STEP 5: Enhanced submit with complete validation
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Check if week is locked
    if (isWeekLocked(currentWeek)) {
      alert('🔒 WEEK LOCKED\n\nThis week\'s games have been played.\nPicks are permanently locked.');
      return;
    }
    
    if (!isSubmissionAllowed()) {
      alert('⛔ SUBMISSIONS CLOSED\n\nDuring playoff weekends, picks are locked from:\n• Friday 11:59 PM PST\n• Through Monday 12:01 AM PST');
      return;
    }

    const currentWeekData = PLAYOFF_WEEKS[currentWeek];
    
    // STEP 5 VALIDATION: Check for incomplete entries
    const missing = [];
    currentWeekData.games.forEach(game => {
      if (!predictions[game.id] || !predictions[game.id].team1 || !predictions[game.id].team2) {
        missing.push(game.id);
      }
    });
    
    if (missing.length > 0) {
      setMissingGames(missing);
      setShowPopup('incomplete');
      return;
    }
    
    // STEP 5 VALIDATION: Check for invalid scores
    const invalid = [];
    currentWeekData.games.forEach(game => {
      const t1 = parseInt(predictions[game.id]?.team1);
      const t2 = parseInt(predictions[game.id]?.team2);
      if (isNaN(t1) || isNaN(t2) || t1 < 0 || t2 < 0) {
        invalid.push(game.id);
      }
    });
    
    if (invalid.length > 0) {
      setInvalidScores(invalid);
      setShowPopup('invalidScores');
      return;
    }
    
    // STEP 5 VALIDATION: Check for tied games (playoff games NEVER tie!)
    const tiedGames = [];
    currentWeekData.games.forEach(game => {
      const t1 = parseInt(predictions[game.id]?.team1);
      const t2 = parseInt(predictions[game.id]?.team2);
      if (t1 === t2) {
        tiedGames.push(game.id);
      }
    });
    
    if (tiedGames.length > 0) {
      setMissingGames(tiedGames); // Reuse missingGames state for highlighting
      setShowPopup('tiedGames');
      return;
    }

    // Check if no changes were made
    if (!hasUnsavedChanges) {
      setShowPopup('noChanges');
      return;
    }

    try {
      // CRITICAL FIX: Query Firebase DIRECTLY to check for existing pick
      // This prevents race conditions and duplicate entries
      const picksRef = ref(database, 'picks');
      const snapshot = await get(picksRef);
      
      let existingPick = null;
      let existingFirebaseKey = null;
      
      if (snapshot.exists()) {
        const allFirebasePicks = snapshot.val();
        // Find existing pick for this playerCode + week combination
        for (const [key, pick] of Object.entries(allFirebasePicks)) {
          if (pick.playerCode === playerCode && pick.week === currentWeek) {
            existingPick = pick;
            existingFirebaseKey = key;
            break;
          }
        }
      }

      const pickData = {
        playerName,
        playerCode,
        week: currentWeek,
        predictions,
        timestamp: existingPick ? existingPick.timestamp : Date.now(),
        lastUpdated: Date.now()
      };

      if (existingFirebaseKey) {
        // Update existing pick - NEVER create a duplicate!
        await set(ref(database, `picks/${existingFirebaseKey}`), pickData);
      } else {
        // Create new pick - only if one doesn't exist!
        await push(ref(database, 'picks'), pickData);
      }
      
      console.log('✅✅✅ SUBMIT SUCCESS ✅✅✅');
      setSubmitted(true);
      
      console.log('📦 Creating deep copy of predictions for originalPicks');
      const deepCopy = JSON.parse(JSON.stringify(predictions));
      setOriginalPicks(deepCopy);
      
      console.log('🔄 Setting hasUnsavedChanges to FALSE');
      setHasUnsavedChanges(false);
      setShowPopup('success');
      console.log('✅✅✅ SUBMIT COMPLETE - allPicks will update but NOT trigger reload! ✅✅✅');
      
      setTimeout(() => {
        const picksTable = document.querySelector('.all-picks');
        if (picksTable) {
          picksTable.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    } catch (error) {
      console.error('Error submitting picks:', error);
      alert('Error submitting picks. Please try again.');
    }
  };

  const currentWeekData = PLAYOFF_WEEKS[currentWeek];

  // Calculate all player totals BEFORE rendering (pre-calculation)
  const playerTotals = useMemo(() => {
    const totals = {};
    
    // For Super Bowl, get ALL unique players from ANY week (so we show everyone's totals even if they haven't entered Week 4)
    // For other weeks, only show players who entered picks for that specific week
    const weekPicks = currentWeek === 'superbowl' 
      ? (() => {
          // Get all unique players from all weeks
          const uniquePlayers = new Map();
          allPicks.forEach(pick => {
            if (!uniquePlayers.has(pick.playerName)) {
              uniquePlayers.set(pick.playerName, {
                playerName: pick.playerName,
                playerCode: pick.playerCode,
                week: currentWeek, // Set to superbowl
                predictions: allPicks.find(p => p.playerCode === pick.playerCode && p.week === 'superbowl')?.predictions || {}
              });
            }
          });
          return Array.from(uniquePlayers.values());
        })()
      : allPicks.filter(pick => pick.week === currentWeek);
    
    weekPicks.forEach(pick => {
      if (!totals[pick.playerName]) {
        totals[pick.playerName] = {
          week4: 0,
          week3: 0,
          week2: 0,
          week1: 0,
          grand: 0,
          current: 0
        };
      }
      
      // Calculate current week total (sum of predicted scores)
      let currentTotal = 0;
      const weekGames = PLAYOFF_WEEKS[currentWeek].games;
      weekGames.forEach(game => {
        const pred = pick.predictions[game.id];
        if (pred && pred.team1 && pred.team2) {
          currentTotal += (parseInt(pred.team1) || 0) + (parseInt(pred.team2) || 0);
        }
      });
      totals[pick.playerName].current = currentTotal;
      
      // For Super Bowl, calculate all weeks (PREDICTED TOTALS - sum of predicted scores)
      // CRITICAL: Player rows should ALWAYS calculate independently - NEVER use header overrides!
      if (currentWeek === 'superbowl') {
        // Helper function to calculate predicted total for any week
        const calculatePredictedTotal = (playerCode, weekName) => {
          const playerPick = allPicks.find(p => p.playerCode === playerCode && p.week === weekName);
          if (!playerPick || !playerPick.predictions) return 0;
          
          let total = 0;
          Object.values(playerPick.predictions).forEach(pred => {
            if (pred && pred.team1 && pred.team2) {
              total += (parseInt(pred.team1) || 0) + (parseInt(pred.team2) || 0);
            }
          });
          return total;
        };
        
        totals[pick.playerName].week4 = calculatePredictedTotal(pick.playerCode, 'superbowl');
        totals[pick.playerName].week3 = calculatePredictedTotal(pick.playerCode, 'conference');
        totals[pick.playerName].week2 = calculatePredictedTotal(pick.playerCode, 'divisional');
        totals[pick.playerName].week1 = calculatePredictedTotal(pick.playerCode, 'wildcard');
        
        // Grand Total (sum of all 4 weeks for this player)
        totals[pick.playerName].grand = 
          totals[pick.playerName].week1 + 
          totals[pick.playerName].week2 + 
          totals[pick.playerName].week3 + 
          totals[pick.playerName].week4;
      }
    });
    
    return totals;
  }, [allPicks, currentWeek, actualScores]);

  return (
    <div className="App">
      <header>
        <h1>🏈 Richard's NFL Playoff Pool 2025</h1>
        <p>Enter your score predictions for each NFL Playoff 2025 game</p>
        <p style={{fontSize: "0.85rem", marginTop: "10px", opacity: 0.8}}>
          v2.2-PLAYOFF-SCHEDULE-{new Date().toISOString().slice(0,10).replace(/-/g,"")}
        </p>
        <div style={{marginTop: "15px", display: "flex", flexDirection: "column", gap: "10px", alignItems: "center"}}>
          <div style={{display: "flex", gap: "15px", flexWrap: "wrap", justifyContent: "center"}}>
            <a 
              // href={`${process.env.PUBLIC_URL}/Playoff_Pool_Quick_Rules.pdf`}
              href="/nfl-playoff-pool/Playoff_Pool_Quick_Rules.pdf"
              target="_blank" 
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                padding: '10px 20px',
                backgroundColor: '#0984e3',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '5px',
                fontSize: '0.95rem',
                fontWeight: 'bold',
                transition: 'background-color 0.3s ease',
                cursor: 'pointer'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#74b9ff'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#0984e3'}
            >
              📋 View Quick Rules (2 Pages)
            </a>
            <a 
              // href={`${process.env.PUBLIC_URL}/Richards_Playoff_Pool_LIX_Rulebook.pdf`}
              href="/nfl-playoff-pool/Richards_Playoff_Pool_LIX_Rulebook.pdf"
              target="_blank" 
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                padding: '10px 20px',
                backgroundColor: '#6c5ce7',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '5px',
                fontSize: '0.95rem',
                fontWeight: 'bold',
                transition: 'background-color 0.3s ease',
                cursor: 'pointer'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#a29bfe'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#6c5ce7'}
            >
              📖 View Full Rulebook (13 Pages)
            </a>
          </div>
          <p style={{fontSize: '1.1em', marginTop: '10px', color: '#ffffff', fontWeight: '500'}}>
            Entry Fee: $20 - Must be paid before end of regular season
          </p>
        </div>
      </header>

      <div className="container">
        {/* 🔒 NEW: Pool Manager Week Lock Controls */}
        {isPoolManager() && codeValidated && (
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            padding: '15px 20px',
            borderRadius: '8px',
            marginBottom: '20px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '10px'}}>
              <span>👑</span>
              <span>POOL MANAGER - WEEK LOCK CONTROLS</span>
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '10px'
            }}>
              {Object.keys(PLAYOFF_WEEKS).map(weekKey => {
                const isLocked = weekLockStatus[weekKey]?.locked;
                const autoLocked = shouldAutoLock(weekKey);
                const effectivelyLocked = isLocked || autoLocked;
                
                return (
                  <div key={weekKey} style={{
                    background: 'rgba(255,255,255,0.15)',
                    padding: '12px',
                    borderRadius: '6px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontWeight: 'bold',
                      fontSize: '0.9rem'
                    }}>
                      <span>{effectivelyLocked ? '🔒' : '🔓'} Week {weekKey === 'wildcard' ? '1' : weekKey === 'divisional' ? '2' : weekKey === 'conference' ? '3' : '4'}</span>
                      <span style={{fontSize: '0.75rem', opacity: 0.9}}>
                        {weekLockStatus[weekKey]?.autoLockDate}
                      </span>
                    </div>
                    {autoLocked && !isLocked && (
                      <div style={{
                        fontSize: '0.7rem',
                        padding: '4px 8px',
                        background: 'rgba(255,193,7,0.3)',
                        borderRadius: '4px',
                        border: '1px solid rgba(255,193,7,0.5)'
                      }}>
                        🕐 AUTO-LOCKED
                      </div>
                    )}
                    {isLocked && (
                      <div style={{
                        fontSize: '0.7rem',
                        padding: '4px 8px',
                        background: 'rgba(220,53,69,0.3)',
                        borderRadius: '4px',
                        border: '1px solid rgba(220,53,69,0.5)'
                      }}>
                        🔒 MANUALLY LOCKED
                      </div>
                    )}
                    <button
                      onClick={() => handleWeekLockToggle(weekKey)}
                      style={{
                        padding: '8px 12px',
                        background: isLocked ? '#28a745' : '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: '600',
                        transition: 'all 0.2s'
                      }}
                    >
                      {isLocked ? '🔓 Unlock Week' : '🔒 Lock Week'}
                    </button>
                    
                    {/* Clear Week Data Button */}
                    <button
                      onClick={() => setShowClearWeekConfirm(weekKey)}
                      style={{
                        padding: '8px 12px',
                        background: '#e67e22',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: '600',
                        transition: 'all 0.2s',
                        marginTop: '8px'
                      }}
                    >
                      🗑️ Clear Week Data
                    </button>
                  </div>
                );
              })}
            </div>
            <p style={{fontSize: '0.8rem', marginTop: '12px', marginBottom: '0', opacity: 0.9}}>
              ℹ️ Manual locks override automatic locks. Players cannot edit picks for locked weeks.
            </p>
          </div>
        )}

        {/* 👑 POOL MANAGER OVERRIDE - ENTER PICKS FOR ANY PLAYER */}
        {isPoolManager() && codeValidated && (
          <div style={{
            background: 'linear-gradient(135deg, #f39c12 0%, #e74c3c 100%)',
            color: 'white',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '20px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '10px'}}>
              <span>⚡</span>
              <span>POOL MANAGER OVERRIDE - ENTER/EDIT PICKS FOR ANY PLAYER</span>
            </h3>
            
            {!overrideMode ? (
              <div>
                <p style={{marginBottom: '15px', fontSize: '0.9rem'}}>
                  ℹ️ Enter picks on behalf of players who missed the deadline or need assistance.
                  Works even when week is locked.
                </p>
                <button
                  onClick={() => setOverrideMode(true)}
                  style={{
                    padding: '12px 24px',
                    background: 'white',
                    color: '#e74c3c',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    fontWeight: '700',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }}
                >
                  🚀 Enter Override Mode
                </button>
              </div>
            ) : (
              <div>
                {/* Player Selection Dropdown */}
                <div style={{marginBottom: '20px'}}>
                  <label style={{display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '0.95rem'}}>
                    Select Player:
                  </label>
                  <select
                    value={selectedPlayerForOverride}
                    onChange={(e) => {
                      setSelectedPlayerForOverride(e.target.value);
                      setOverrideAction(null);
                      setRngPreview(null);
                      setShowRngPreview(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '12px',
                      fontSize: '1rem',
                      borderRadius: '6px',
                      border: '2px solid white',
                      background: 'rgba(255,255,255,0.95)',
                      color: '#333',
                      fontWeight: '600'
                    }}
                  >
                    <option value="">-- Select a Player --</option>
                    {Object.keys(PLAYER_CODES).sort((a, b) => {
                      const nameA = PLAYER_CODES[a].toUpperCase();
                      const nameB = PLAYER_CODES[b].toUpperCase();
                      return nameA.localeCompare(nameB);
                    }).map(code => (
                      <option key={code} value={code}>
                        {PLAYER_CODES[code]} ({code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Player Status and Action Buttons */}
                {selectedPlayerForOverride && (
                  <div style={{
                    background: 'rgba(255,255,255,0.2)',
                    padding: '15px',
                    borderRadius: '6px',
                    marginBottom: '15px'
                  }}>
                    <div style={{marginBottom: '15px'}}>
                      <strong>Selected:</strong> {PLAYER_CODES[selectedPlayerForOverride]} ({selectedPlayerForOverride})
                      <br/>
                      <strong>Week:</strong> {currentWeek === 'wildcard' ? 'Week 1' : currentWeek === 'divisional' ? 'Week 2' : currentWeek === 'conference' ? 'Week 3' : 'Week 4'}
                      <br/>
                      <strong>Status:</strong> {
                        allPicks.find(p => p.playerCode === selectedPlayerForOverride && p.week === currentWeek)
                          ? '✅ HAS PICKS'
                          : '❌ NO PICKS'
                      }
                    </div>

                    <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap'}}>
                      <button
                        onClick={generateRNGPicks}
                        style={{
                          flex: '1',
                          minWidth: '150px',
                          padding: '12px',
                          background: '#9b59b6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                          fontWeight: '600'
                        }}
                      >
                        🎲 Generate RNG Picks
                      </button>
                      
                      <button
                        onClick={loadPlayerPicksForOverride}
                        style={{
                          flex: '1',
                          minWidth: '150px',
                          padding: '12px',
                          background: '#3498db',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                          fontWeight: '600'
                        }}
                      >
                        📝 Enter/Edit Manually
                      </button>
                    </div>

                    {/* Delete Buttons - Only show if player has picks */}
                    {allPicks.find(p => p.playerCode === selectedPlayerForOverride) && (
                      <div style={{
                        marginTop: '15px',
                        padding: '15px',
                        background: 'rgba(220, 53, 69, 0.1)',
                        borderRadius: '6px',
                        border: '2px solid rgba(220, 53, 69, 0.3)'
                      }}>
                        <div style={{marginBottom: '10px', fontWeight: '600', color: '#dc3545'}}>
                          ⚠️ Danger Zone - Delete Operations
                        </div>
                        
                        <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap'}}>
                          <button
                            onClick={() => setShowDeleteConfirm('week')}
                            style={{
                              flex: '1',
                              minWidth: '150px',
                              padding: '12px',
                              background: '#e67e22',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '0.9rem',
                              fontWeight: '600'
                            }}
                          >
                            🗑️ Delete This Week Only
                          </button>
                          
                          <button
                            onClick={() => setShowDeleteConfirm('all')}
                            style={{
                              flex: '1',
                              minWidth: '150px',
                              padding: '12px',
                              background: '#c0392b',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '0.9rem',
                              fontWeight: '600'
                            }}
                          >
                            💥 Delete ALL Weeks
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Cancel Override Mode Button */}
                <button
                  onClick={() => {
                    setOverrideMode(false);
                    setSelectedPlayerForOverride('');
                    setOverrideAction(null);
                    setRngPreview(null);
                    setShowRngPreview(false);
                  }}
                  style={{
                    padding: '10px 20px',
                    background: '#95a5a6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: '600'
                  }}
                >
                  ❌ Exit Override Mode
                </button>
              </div>
            )}
          </div>
        )}

        {/* RNG Preview Popup */}
        {showRngPreview && rngPreview && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px'
          }}>
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '30px',
              maxWidth: '600px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
            }}>
              <h3 style={{marginTop: 0, color: '#9b59b6'}}>🎲 RNG PICKS GENERATED</h3>
              <p style={{color: '#666', marginBottom: '20px'}}>
                Player: <strong>{PLAYER_CODES[selectedPlayerForOverride]}</strong><br/>
                Week: <strong>{currentWeek === 'wildcard' ? 'Week 1' : currentWeek === 'divisional' ? 'Week 2' : currentWeek === 'conference' ? 'Week 3' : 'Week 4'}</strong>
              </p>
              
              <div style={{marginBottom: '20px'}}>
                {PLAYOFF_WEEKS[currentWeek].games.map(game => (
                  <div key={game.id} style={{
                    padding: '12px',
                    background: '#f8f9fa',
                    borderRadius: '6px',
                    marginBottom: '10px',
                    border: '2px solid #e9ecef'
                  }}>
                    <div style={{fontWeight: '600', marginBottom: '5px', color: '#333'}}>
                      Game {game.id}: {game.team1} vs {game.team2}
                    </div>
                    <div style={{fontSize: '1.2rem', fontWeight: '700', color: '#9b59b6'}}>
                      {rngPreview[game.id].team1} - {rngPreview[game.id].team2}
                      {rngPreview[game.id].team1 > rngPreview[game.id].team2 
                        ? ` (${game.team1} wins)` 
                        : ` (${game.team2} wins)`}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{
                background: '#d4edda',
                border: '1px solid #c3e6cb',
                color: '#155724',
                padding: '12px',
                borderRadius: '6px',
                marginBottom: '20px',
                fontSize: '0.9rem'
              }}>
                ✅ All scores between 10-50 (inclusive)<br/>
                ✅ No tied games<br/>
                ✅ Will be marked as "POOL_MANAGER_RNG" in database
              </div>

              <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap'}}>
                <button
                  onClick={submitRNGPicks}
                  style={{
                    flex: '1',
                    padding: '14px 24px',
                    background: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    fontWeight: '700'
                  }}
                >
                  ✅ Submit RNG Picks
                </button>
                
                <button
                  onClick={generateRNGPicks}
                  style={{
                    flex: '1',
                    padding: '14px 24px',
                    background: '#ffc107',
                    color: '#333',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    fontWeight: '700'
                  }}
                >
                  🔄 Regenerate
                </button>
                
                <button
                  onClick={() => {
                    setShowRngPreview(false);
                    setRngPreview(null);
                  }}
                  style={{
                    padding: '14px 24px',
                    background: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    fontWeight: '700'
                  }}
                >
                  ❌ Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Popups */}
        {showDeleteConfirm && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px'
          }}>
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '30px',
              maxWidth: '500px',
              width: '100%',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
            }}>
              {showDeleteConfirm === 'week' ? (
                <>
                  <h3 style={{marginTop: 0, color: '#e67e22', display: 'flex', alignItems: 'center', gap: '10px'}}>
                    <span>⚠️</span>
                    <span>DELETE PICKS FOR THIS WEEK?</span>
                  </h3>
                  <div style={{marginBottom: '20px', color: '#666'}}>
                    <p><strong>Player:</strong> {PLAYER_CODES[selectedPlayerForOverride]}</p>
                    <p><strong>Week:</strong> {currentWeek === 'wildcard' ? 'Week 1 (Wildcard)' : currentWeek === 'divisional' ? 'Week 2 (Divisional)' : currentWeek === 'conference' ? 'Week 3 (Conference)' : 'Week 4 (Super Bowl)'}</p>
                  </div>
                  <div style={{
                    background: '#fff3cd',
                    border: '1px solid #ffc107',
                    color: '#856404',
                    padding: '15px',
                    borderRadius: '6px',
                    marginBottom: '20px',
                    fontSize: '0.95rem'
                  }}>
                    <strong>⚠️ Warning:</strong> This will DELETE {PLAYER_CODES[selectedPlayerForOverride]}'s picks for this week only.<br/>
                    <strong>This action CANNOT be undone!</strong>
                  </div>
                  <div style={{display: 'flex', gap: '10px'}}>
                    <button
                      onClick={() => setShowDeleteConfirm(null)}
                      style={{
                        flex: '1',
                        padding: '14px',
                        background: '#95a5a6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '1rem',
                        fontWeight: '700'
                      }}
                    >
                      ❌ Cancel
                    </button>
                    <button
                      onClick={deletePicksForWeek}
                      style={{
                        flex: '1',
                        padding: '14px',
                        background: '#e67e22',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '1rem',
                        fontWeight: '700'
                      }}
                    >
                      🗑️ Yes, Delete This Week
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h3 style={{marginTop: 0, color: '#c0392b', display: 'flex', alignItems: 'center', gap: '10px'}}>
                    <span>🚨</span>
                    <span>DELETE ALL PICKS?</span>
                  </h3>
                  <div style={{marginBottom: '20px', color: '#666'}}>
                    <p><strong>Player:</strong> {PLAYER_CODES[selectedPlayerForOverride]}</p>
                  </div>
                  <div style={{
                    background: '#f8d7da',
                    border: '2px solid #dc3545',
                    color: '#721c24',
                    padding: '15px',
                    borderRadius: '6px',
                    marginBottom: '20px',
                    fontSize: '0.95rem'
                  }}>
                    <strong>🚨 DANGER:</strong> This will DELETE ALL of {PLAYER_CODES[selectedPlayerForOverride]}'s picks:<br/><br/>
                    {allPicks.filter(p => p.playerCode === selectedPlayerForOverride).map(pick => (
                      <div key={pick.week} style={{marginLeft: '20px'}}>
                        ✓ {pick.week === 'wildcard' ? 'Week 1' : pick.week === 'divisional' ? 'Week 2' : pick.week === 'conference' ? 'Week 3' : 'Week 4'} picks
                      </div>
                    ))}
                    <br/>
                    <strong>This action CANNOT be undone!</strong><br/>
                    <strong>Are you absolutely sure?</strong>
                  </div>
                  <div style={{display: 'flex', gap: '10px'}}>
                    <button
                      onClick={() => setShowDeleteConfirm(null)}
                      style={{
                        flex: '1',
                        padding: '14px',
                        background: '#95a5a6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '1rem',
                        fontWeight: '700'
                      }}
                    >
                      ❌ Cancel
                    </button>
                    <button
                      onClick={deleteAllPicksForPlayer}
                      style={{
                        flex: '1',
                        padding: '14px',
                        background: '#c0392b',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '1rem',
                        fontWeight: '700'
                      }}
                    >
                      💥 Yes, Delete Everything
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Clear Week Data Confirmation Popup */}
        {showClearWeekConfirm && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px'
          }}>
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '30px',
              maxWidth: '500px',
              width: '100%',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
            }}>
              <h3 style={{marginTop: 0, color: '#e67e22', display: 'flex', alignItems: 'center', gap: '10px'}}>
                <span>🗑️</span>
                <span>CLEAR WEEK DATA?</span>
              </h3>
              <div style={{marginBottom: '20px', color: '#666'}}>
                <p><strong>Week:</strong> {showClearWeekConfirm === 'wildcard' ? 'Week 1 (Wildcard)' : showClearWeekConfirm === 'divisional' ? 'Week 2 (Divisional)' : showClearWeekConfirm === 'conference' ? 'Week 3 (Conference)' : 'Week 4 (Super Bowl)'}</p>
              </div>
              <div style={{
                background: '#fff3cd',
                border: '2px solid #ffc107',
                color: '#856404',
                padding: '15px',
                borderRadius: '6px',
                marginBottom: '20px',
                fontSize: '0.95rem'
              }}>
                <strong>⚠️ This will DELETE:</strong>
                <div style={{marginLeft: '20px', marginTop: '10px'}}>
                  ✓ All team names for this week<br/>
                  ✓ All actual scores for this week<br/>
                  ✓ All game statuses (FINAL/LIVE) for this week
                </div>
                <br/>
                <strong style={{color: '#d63031'}}>✅ This will KEEP:</strong>
                <div style={{marginLeft: '20px', marginTop: '5px'}}>
                  ✓ ALL player picks (NOT deleted!)
                </div>
                <br/>
                <strong>This action CANNOT be undone!</strong>
              </div>
              <div style={{display: 'flex', gap: '10px'}}>
                <button
                  onClick={() => setShowClearWeekConfirm(null)}
                  style={{
                    flex: '1',
                    padding: '14px',
                    background: '#95a5a6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    fontWeight: '700'
                  }}
                >
                  ❌ Cancel
                </button>
                <button
                  onClick={() => clearWeekData(showClearWeekConfirm)}
                  style={{
                    flex: '1',
                    padding: '14px',
                    background: '#e67e22',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    fontWeight: '700'
                  }}
                >
                  🗑️ Yes, Clear Week Data
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 📡 ESPN API Controls (Pool Manager Only) */}
        {isPoolManager() && codeValidated && (
          <ESPNControls
            currentWeek={currentWeek}
            games={currentWeekData.games}
            actualScores={actualScores}
            teamCodes={teamCodes}
            onScoresFetched={handleESPNFetch}
            onGameLockToggle={handleGameLockToggle}
            gameLocks={gameLocks}
            espnAutoRefresh={espnAutoRefresh}
          />
        )}

        {/* 🎲 POOL MANAGER RNG - Quick Test Data (Pool Manager Only) */}
        {isPoolManager() && codeValidated && (
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '20px',
            boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)'
          }}>
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
              <div>
                <h3 style={{margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '10px'}}>
                  <span>🎲</span>
                  <span>POOL MANAGER RNG - Quick Test Data</span>
                </h3>
                <p style={{margin: 0, fontSize: '0.9rem', opacity: 0.9}}>
                  Auto-populate teams, scores, and mark games as FINAL for testing
                </p>
              </div>
              <button
                onClick={handlePoolManagerRNG}
                style={{
                  padding: '12px 24px',
                  background: 'white',
                  color: '#667eea',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: '700',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                  transition: 'all 0.3s ease',
                  whiteSpace: 'nowrap'
                }}
                onMouseOver={(e) => {
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 6px 16px rgba(0,0,0,0.3)';
                }}
                onMouseOut={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
                }}
              >
                🎲 Generate Test Data
              </button>
            </div>
          </div>
        )}

        {/* 👥 NEW: Player Codes Display for Pool Manager */}
        {isPoolManager() && codeValidated && (
          <div style={{
            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            color: 'white',
            padding: '15px 20px',
            borderRadius: '8px',
            marginBottom: '20px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '10px'}}>
              <span>🔑</span>
              <span>ALL PLAYER CODES</span>
            </h3>
            <div style={{
              background: 'rgba(255,255,255,0.95)',
              padding: '15px',
              borderRadius: '6px',
              maxHeight: '300px',
              overflowY: 'auto'
            }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.9rem'
              }}>
                <thead>
                  <tr style={{
                    background: '#f8f9fa',
                    borderBottom: '2px solid #dee2e6'
                  }}>
                    <th style={{
                      padding: '10px',
                      textAlign: 'left',
                      color: '#495057',
                      fontWeight: '600'
                    }}>Player Code</th>
                    <th style={{
                      padding: '10px',
                      textAlign: 'left',
                      color: '#495057',
                      fontWeight: '600'
                    }}>Player Name</th>
                    <th style={{
                      padding: '10px',
                      textAlign: 'center',
                      color: '#495057',
                      fontWeight: '600'
                    }}>Role</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(PLAYER_CODES)
                    .sort((a, b) => {
                      // Pool managers first
                      const aIsManager = POOL_MANAGER_CODES.includes(a[0]);
                      const bIsManager = POOL_MANAGER_CODES.includes(b[0]);
                      if (aIsManager && !bIsManager) return -1;
                      if (!aIsManager && bIsManager) return 1;
                      // Then alphabetical by name
                      return a[1].localeCompare(b[1]);
                    })
                    .map(([code, name], index) => {
                      const isManager = POOL_MANAGER_CODES.includes(code);
                      return (
                        <tr key={code} style={{
                          background: index % 2 === 0 ? '#ffffff' : '#f8f9fa',
                          borderBottom: '1px solid #dee2e6'
                        }}>
                          <td style={{
                            padding: '10px',
                            color: '#212529',
                            fontFamily: 'monospace',
                            fontWeight: 'bold',
                            fontSize: '1rem'
                          }}>{code}</td>
                          <td style={{
                            padding: '10px',
                            color: '#212529'
                          }}>{name}</td>
                          <td style={{
                            padding: '10px',
                            textAlign: 'center'
                          }}>
                            {isManager ? (
                              <span style={{
                                padding: '4px 8px',
                                background: '#dc3545',
                                color: 'white',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: '600'
                              }}>👑 MANAGER</span>
                            ) : (
                              <span style={{
                                padding: '4px 8px',
                                background: '#28a745',
                                color: 'white',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: '600'
                              }}>✓ PLAYER</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            <p style={{fontSize: '0.8rem', marginTop: '12px', marginBottom: '0', opacity: 0.9}}>
              📋 Total Players: {Object.keys(PLAYER_CODES).length} | Pool Managers: {POOL_MANAGER_CODES.length} | Regular Players: {Object.keys(PLAYER_CODES).length - POOL_MANAGER_CODES.length}
            </p>
          </div>
        )}

        {/* 🆕 STEP 5: Week Selector - Complete with lock status and validation */}
        {codeValidated && (
          <WeekSelector
            currentWeek={currentWeek}
            onWeekChange={handleWeekChange}
            weekPicks={weekPicksStatus}
            weekLockStatus={weekLockStatus}
            hasUnsavedChanges={hasUnsavedChanges}
            isPoolManager={isPoolManager()}
          />
        )}
        
        {/* 🆕 Navigation Buttons - Show after code validation */}
        {codeValidated && (
          <div className="view-navigation">
            <button
              className={`nav-btn ${currentView === 'picks' ? 'active' : ''}`}
              onClick={() => setCurrentView('picks')}
            >
              📝 Make Picks
              {currentView === 'picks' && (
                <span style={{
                  marginLeft: '8px',
                  fontSize: '0.75rem',
                  opacity: 0.9,
                  fontStyle: 'italic'
                }}>
                  (you are here)
                </span>
              )}
            </button>
            <button
              className={`nav-btn ${currentView === 'standings' ? 'active' : ''}`}
              onClick={() => setCurrentView('standings')}
            >
              🏆 Standings & Prizes
              {currentView === 'standings' && (
                <span style={{
                  marginLeft: '8px',
                  fontSize: '0.75rem',
                  opacity: 0.9,
                  fontStyle: 'italic'
                }}>
                  (you are here)
                </span>
              )}
            </button>
          </div>
        )}

        {/* Conditional Content Based on View */}
        {currentView === 'standings' && codeValidated ? (
          <StandingsPage 
            allPicks={allPicks} 
            actualScores={actualScores}
            currentWeek={currentWeek}
            playerName={playerName}
            playerCode={playerCode}
            isPoolManager={isPoolManager()}
            prizePool={prizePool}
            officialWinners={officialWinners}
            onLogout={handleLogout}
          />
        ) : (
          <>
        {/* Code Entry */}
        {!codeValidated ? (        
          <div className="prediction-form">
            <div className="code-entry-section">
              <h3>🔐 Enter Your Player Code</h3>
              <p style={{marginBottom: '20px', color: '#666'}}>
                You received a 6-character code when you paid your $20 entry fee.
              </p>
              <p style={{marginBottom: '20px', color: '#666', fontSize: '0.9rem', fontStyle: 'italic'}}>
                💡 Have multiple entries? Enter one code at a time.
              </p>
              <div className="code-input-group">
                <label htmlFor="playerCode">
                  Player Code (6 characters)
                </label>
                <input
                  type="text"
                  id="playerCode"
                  className="code-input"
                  value={playerCode}
                  onChange={(e) => setPlayerCode(e.target.value.toUpperCase())}
                  placeholder="A7K9M2"
                  maxLength="6"
                  autoComplete="off"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleCodeValidation();
                    }
                  }}
                />
                <button 
                  className="validate-btn"
                  onClick={handleCodeValidation}
                >
                  Validate Code & Continue
                </button>
                <div style={{
                  marginTop: '20px',
                  padding: '15px',
                  background: '#fff3cd',
                  border: '2px solid #ffc107',
                  borderRadius: '8px',
                  textAlign: 'left'
                }}>
                  <h4 style={{margin: '0 0 10px 0', color: '#856404'}}>💰 Entry Fee Payment</h4>
                  <p style={{margin: '5px 0', fontSize: '0.9rem', color: '#856404'}}>
                    <strong>Cost:</strong> $20 per entry
                  </p>
                  <p style={{margin: '5px 0', fontSize: '0.9rem', color: '#856404'}}>
                    <strong>Send e-Transfer to:</strong> gammoneer2b@gmail.com
                  </p>
                  <p style={{margin: '5px 0', fontSize: '0.9rem', color: '#856404'}}>
                    <strong>Password:</strong> nflpool
                  </p>
                  <p style={{margin: '10px 0 5px 0', fontSize: '0.85rem', color: '#856404', fontStyle: 'italic'}}>
                    You will receive your player code after payment is confirmed.
                  </p>
                </div>
                <p style={{marginTop: '15px', fontSize: '0.9rem', color: '#666', textAlign: 'center'}}>
                  Questions? Contact: gammoneer2b@gmail.com
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Player Confirmed */}
            <div className="player-confirmed">
              <span className="confirmation-badge">✓ VERIFIED</span>
              <h3>
                Welcome, <span className="player-name-highlight">{playerName}</span>!
                {isPoolManager() && <span style={{marginLeft: '10px', color: '#d63031'}}>👑 POOL MANAGER</span>}
              </h3>
              <p style={{color: '#000'}}>Making picks for: <strong>{currentWeekData.name}</strong></p>
              {/* 🔒 NEW: Show lock status */}
              {isWeekLocked(currentWeek) && !isPoolManager() && (
                <div style={{
                  marginTop: '10px',
                  padding: '10px 15px',
                  background: '#fff3cd',
                  border: '2px solid #ffc107',
                  borderRadius: '6px',
                  color: '#856404',
                  fontWeight: '600'
                }}>
                  🔒 This week is LOCKED - You can view your picks but cannot edit them
                </div>
              )}
              <button 
                className="validate-btn" 
                style={{marginTop: '15px', padding: '10px 20px', fontSize: '0.9rem'}}
                onClick={handleLogout}
              >
                🚪 Logout / Switch Entry
              </button>
              <p style={{
                fontSize: '0.85rem',
                color: '#666',
                marginTop: '10px',
                fontStyle: 'italic'
              }}>
                💡 Playing with multiple entries? Logout to switch between your codes.
              </p>
            </div>

            {/* Lockout Warning */}
            {!isSubmissionAllowed() && (
              <div className="closed-warning">
                ⛔ PICKS ARE LOCKED (Playoff Weekend: Friday 11:59 PM - Monday 12:01 AM PST)
              </div>
            )}

            {/* Prediction Form */}
            <div className="prediction-form">
              {overrideAction === 'manual' ? (
                <h2 style={{color: '#e74c3c'}}>
                  ⚡ OVERRIDE MODE: Entering Picks for {PLAYER_CODES[selectedPlayerForOverride]}
                </h2>
              ) : (
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px', gap: '15px'}}>
                  <h2 style={{margin: 0, flex: '1'}}>Enter Your Predictions</h2>
                  {!isWeekLocked(currentWeek) && (
                    <button
                      type="button"
                      onClick={handleRNGPick}
                      style={{
                        padding: '10px 20px',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '0.95rem',
                        fontWeight: '600',
                        boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
                        transition: 'all 0.3s ease'
                      }}
                      onMouseOver={(e) => {
                        e.target.style.transform = 'translateY(-2px)';
                        e.target.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.6)';
                      }}
                      onMouseOut={(e) => {
                        e.target.style.transform = 'translateY(0)';
                        e.target.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
                      }}
                    >
                      🎲 Quick RNG Pick - Auto-fill all games
                    </button>
                  )}
                </div>
              )}
              
              {/* Progress Indicator */}
              <div className="progress-indicator">
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px'}}>
                  <strong>Progress:</strong>
                  <span>
                    {Object.keys(predictions).filter(gameId => predictions[gameId] && predictions[gameId].team1 && predictions[gameId].team2).length} 
                    {' of '} 
                    {currentWeekData.games.length} games completed
                  </span>
                </div>
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{
                      width: `${(Object.keys(predictions).filter(gameId => 
                        predictions[gameId] && predictions[gameId].team1 && predictions[gameId].team2
                      ).length / currentWeekData.games.length) * 100}%`
                    }}
                  >
                    {Math.round((Object.keys(predictions).filter(gameId => 
                      predictions[gameId] && predictions[gameId].team1 && predictions[gameId].team2
                    ).length / currentWeekData.games.length) * 100)}%
                  </div>
                </div>
              </div>

              <form onSubmit={overrideAction === 'manual' ? submitPicksForPlayer : handleSubmit}>
                {currentWeekData.games.map(game => (
                  <div key={game.id} className="game-prediction">
                    <h3>
                      Game {game.id}: {game.team1} @ {game.team2}
                      {/* Show team codes if available */}
                      {teamCodes[currentWeek]?.[game.id] && (
                        <span style={{fontSize: '0.9rem', color: '#666', marginLeft: '10px'}}>
                          ({teamCodes[currentWeek][game.id].team1 || '?'} @ {teamCodes[currentWeek][game.id].team2 || '?'})
                        </span>
                      )}
                    </h3>
                    
                    {/* Show actual scores if available */}
                    {actualScores[currentWeek]?.[game.id] && (
                      <div style={{
                        padding: '10px 15px',
                        background: '#ffffff',
                        border: '3px solid #4caf50',
                        borderRadius: '6px',
                        marginBottom: '12px',
                        fontSize: '1rem'
                      }}>
                        <strong style={{color: '#000', fontSize: '1.05rem'}}>Actual Score:</strong>{' '}
                        <span style={{color: '#000', fontWeight: '700', fontSize: '1.1rem'}}>
                          {actualScores[currentWeek][game.id].team1 || '-'} - {actualScores[currentWeek][game.id].team2 || '-'}
                        </span>
                        {gameStatus[currentWeek]?.[game.id] === 'final' && (
                          <span style={{
                            marginLeft: '10px',
                            padding: '2px 8px',
                            background: '#4caf50',
                            color: 'white',
                            borderRadius: '4px',
                            fontSize: '0.8rem',
                            fontWeight: 'bold'
                          }}>✅ FINAL</span>
                        )}
                        {gameStatus[currentWeek]?.[game.id] === 'live' && (
                          <span style={{
                            marginLeft: '10px',
                            padding: '2px 8px',
                            background: '#ff9800',
                            color: 'white',
                            borderRadius: '4px',
                            fontSize: '0.8rem',
                            fontWeight: 'bold'
                          }}>🔴 LIVE</span>
                        )}
                      </div>
                    )}
                    
                    <div className="score-inputs">
                      <div className="team-score">
                        <label>
                          <span className="team-designation">AWAY TEAM</span>
                          <span className="team-name-label" style={{color: '#ffffff', fontWeight: '700'}}>{game.team1}</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="99"
                          value={predictions[game.id]?.team1 || ''}
                          onChange={(e) => handleScoreChange(game.id, 'team1', e.target.value)}
                          placeholder="0"
                          required
                          disabled={isWeekLocked(currentWeek)}
                          key={`${game.id}-team1-${playerName}`}
                        />
                      </div>
                      
                      <div className="vs">VS</div>
                      
                      <div className="team-score">
                        <label>
                          <span className="team-designation">HOME TEAM</span>
                          <span className="team-name-label" style={{color: '#ffffff', fontWeight: '700'}}>{game.team2}</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="99"
                          value={predictions[game.id]?.team2 || ''}
                          onChange={(e) => handleScoreChange(game.id, 'team2', e.target.value)}
                          placeholder="0"
                          required
                          disabled={isWeekLocked(currentWeek)}
                          key={`${game.id}-team2-${playerName}`}
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <div style={{display: 'flex', gap: '15px', marginTop: '20px'}}>
                  <button 
                    type="submit" 
                    className="submit-btn"
                    disabled={overrideAction === 'manual' ? false : (!isSubmissionAllowed() || isWeekLocked(currentWeek))}
                    style={overrideAction === 'manual' ? {
                      background: '#e74c3c',
                      fontSize: '1.1rem',
                      fontWeight: '700',
                      flex: '1'
                    } : {flex: '1'}}
                  >
                    {overrideAction === 'manual' 
                      ? `⚡ Submit for ${PLAYER_CODES[selectedPlayerForOverride]}`
                      : isWeekLocked(currentWeek) && !isPoolManager()
                        ? '🔒 Week Locked - Cannot Edit Picks'
                        : isSubmissionAllowed() 
                          ? '📤 Submit / Update My Picks' 
                          : '⛔ Submissions Locked (Playoff Weekend)'}
                  </button>
                  
                  {!isWeekLocked(currentWeek) && overrideAction !== 'manual' && (
                    <button
                      type="button"
                      onClick={handleCancelPicks}
                      style={{
                        padding: '15px 30px',
                        background: '#6c757d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '1.1rem',
                        fontWeight: '600',
                        transition: 'all 0.3s ease',
                        flex: '0 0 auto',
                        minWidth: '150px'
                      }}
                      onMouseOver={(e) => {
                        e.target.style.background = '#5a6268';
                      }}
                      onMouseOut={(e) => {
                        e.target.style.background = '#6c757d';
                      }}
                    >
                      ❌ Cancel
                    </button>
                  )}
                </div>
                
                {isSubmissionAllowed() && !isWeekLocked(currentWeek) && (
                  <p style={{textAlign: 'center', marginTop: '15px', color: '#666', fontSize: '0.9rem'}}>
                    You can edit and resubmit your picks as many times as you want until Friday 11:59 PM PST (before game weekends)
                  </p>
                )}
              </form>
            </div>
          </>
        )}

        {/* All Picks Table */}
        <div className="all-picks">
          <h2>
            All Player Picks - {currentWeekData.name}
            <button 
              onClick={downloadPicksAsCSV}
              style={{
                marginLeft: '15px',
                padding: '8px 16px',
                background: '#4caf50',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: '600'
              }}
            >
              📥 Download CSV
            </button>
            <div style={{
              fontSize: '0.75rem',
              color: '#666',
              marginTop: '5px',
              fontStyle: 'italic'
            }}>
              📱 Mobile: Open the DOWNLOADABLE CSV file with Google Sheets (free app) or MS Office EXCEL
            </div>
            <button 
              onClick={() => window.location.reload()}
              style={{
                marginLeft: '10px',
                padding: '8px 16px',
                background: '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: '600'
              }}
            >
              🔄 Refresh Picks Table
            </button>
          </h2>

          {allPicks.filter(pick => pick.week === currentWeek).length === 0 ? (
            <p className="no-picks">No picks submitted yet for this week.</p>
          ) : (
            <div className="picks-table-container">
              <table className="picks-table">
                <thead>
                  <tr>
                    <th rowSpan="2">Player</th>
                    {currentWeekData.games.map(game => (
                      <th key={game.id} colSpan="2">
                        Game {game.id}<br/>
                        <small style={{color: '#ffffff', fontWeight: '700'}}>{game.team1} @ {game.team2}</small>
                        {/* Team codes row for Pool Manager */}
                        {isPoolManager() && (
                          <div style={{marginTop: '5px', display: 'flex', gap: '5px', justifyContent: 'center', alignItems: 'center'}}>
                            <input
                              type="text"
                              maxLength="3"
                              value={teamCodes[currentWeek]?.[game.id]?.team1 || ''}
                              onChange={(e) => handleTeamCodeChange(game.id, 'team1', e.target.value)}
                              placeholder="PIT"
                              style={{
                                width: '45px',
                                padding: '4px',
                                textAlign: 'center',
                                fontSize: '0.8rem',
                                fontWeight: 'bold',
                                border: '2px solid #667eea',
                                borderRadius: '4px'
                              }}
                            />
                            <span style={{fontSize: '0.8rem'}}>@</span>
                            <input
                              type="text"
                              maxLength="3"
                              value={teamCodes[currentWeek]?.[game.id]?.team2 || ''}
                              onChange={(e) => handleTeamCodeChange(game.id, 'team2', e.target.value)}
                              placeholder="BUF"
                              style={{
                                width: '45px',
                                padding: '4px',
                                textAlign: 'center',
                                fontSize: '0.8rem',
                                fontWeight: 'bold',
                                border: '2px solid #667eea',
                                borderRadius: '4px'
                              }}
                            />
                          </div>
                        )}
                        {/* Team codes display for players */}
                        {!isPoolManager() && teamCodes[currentWeek]?.[game.id] && (
                          <div style={{fontSize: '0.8rem', color: '#ffffff', fontWeight: '700', marginTop: '3px'}}>
                            {teamCodes[currentWeek][game.id].team1 || '?'} @ {teamCodes[currentWeek][game.id].team2 || '?'}
                          </div>
                        )}
                      </th>
                    ))}
                    
                    {/* CORRECT PICKS COLUMN */}
                    <th rowSpan="2" style={{backgroundColor: '#e8f5e9', fontWeight: 'bold', color: '#2e7d32', minWidth: '60px', fontSize: '0.75rem', padding: '8px 4px'}}>
                      <div style={{marginBottom: '2px'}}>Correct</div>
                      <div>Picks</div>
                    </th>
                    
                    {currentWeek === 'superbowl' ? (
                      <>
                        <th rowSpan="2" style={{backgroundColor: '#fff3cd', fontWeight: 'bold', color: '#000'}}>
                          {/* Official Total Input at top */}
                          {isPoolManager() ? (
                            <div style={{marginBottom: '8px'}}>
                              <div style={{fontSize: '0.7rem', marginBottom: '4px', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px'}}>
                                OFFICIAL {manualOverrides.superbowl_week4 ? '✏️' : '✓'}
                                {manualOverrides.superbowl_week4 && (
                                  <button
                                    onClick={() => clearManualOverride('superbowl_week4')}
                                    title="Return to auto-calculation"
                                    style={{
                                      padding: '2px 6px',
                                      fontSize: '0.65rem',
                                      background: '#e74c3c',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '3px',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Clear
                                  </button>
                                )}
                              </div>
                              <input
                                type="number"
                                min="0"
                                value={getHeaderDisplayValue('superbowl_week4', 'superbowl')}
                                onChange={(e) => handleManualTotalChange('superbowl_week4', e.target.value)}
                                placeholder="Auto"
                                title={manualOverrides.superbowl_week4 ? 'Manually overridden - click Clear to return to auto' : 'Auto-calculated - click to override'}
                                style={{
                                  width: '60px',
                                  padding: '4px',
                                  textAlign: 'center',
                                  fontSize: '1rem',
                                  fontWeight: 'bold',
                                  border: manualOverrides.superbowl_week4 ? '2px solid #e74c3c' : '2px solid #27ae60',
                                  borderRadius: '4px',
                                  color: '#000',
                                  backgroundColor: manualOverrides.superbowl_week4 ? '#ffe5e5' : '#e8f8f5'
                                }}
                              />
                            </div>
                          ) : (
                            <div style={{marginBottom: '8px'}}>
                              <div style={{fontSize: '0.7rem', color: '#000', marginBottom: '2px'}}>
                                Official {manualOverrides.superbowl_week4 ? '✏️' : '✓'}
                              </div>
                              <div style={{fontSize: '1rem', fontWeight: 'bold', color: '#d63031'}}>
                                {getHeaderDisplayValue('superbowl_week4', 'superbowl') || '-'}
                              </div>
                            </div>
                          )}
                          Week 4<br/>Total
                        </th>
                        <th rowSpan="2" style={{backgroundColor: '#d1ecf1', fontWeight: 'bold', color: '#000'}}>
                          {/* Official Total Input at top */}
                          {isPoolManager() ? (
                            <div style={{marginBottom: '8px'}}>
                              <div style={{fontSize: '0.7rem', marginBottom: '4px', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px'}}>
                                OFFICIAL {manualOverrides.superbowl_week3 ? '✏️' : '✓'}
                                {manualOverrides.superbowl_week3 && (
                                  <button
                                    onClick={() => clearManualOverride('superbowl_week3')}
                                    title="Return to auto-calculation"
                                    style={{
                                      padding: '2px 6px',
                                      fontSize: '0.65rem',
                                      background: '#e74c3c',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '3px',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Clear
                                  </button>
                                )}
                              </div>
                              <input
                                type="number"
                                min="0"
                                value={getHeaderDisplayValue('superbowl_week3', 'conference')}
                                onChange={(e) => handleManualTotalChange('superbowl_week3', e.target.value)}
                                placeholder="Auto"
                                title={manualOverrides.superbowl_week3 ? 'Manually overridden - click Clear to return to auto' : 'Auto-calculated - click to override'}
                                style={{
                                  width: '60px',
                                  padding: '4px',
                                  textAlign: 'center',
                                  fontSize: '1rem',
                                  fontWeight: 'bold',
                                  border: manualOverrides.superbowl_week3 ? '2px solid #e74c3c' : '2px solid #27ae60',
                                  borderRadius: '4px',
                                  color: '#000',
                                  backgroundColor: manualOverrides.superbowl_week3 ? '#ffe5e5' : '#e8f8f5'
                                }}
                              />
                            </div>
                          ) : (
                            <div style={{marginBottom: '8px'}}>
                              <div style={{fontSize: '0.7rem', color: '#000', marginBottom: '2px'}}>
                                Official {manualOverrides.superbowl_week3 ? '✏️' : '✓'}
                              </div>
                              <div style={{fontSize: '1rem', fontWeight: 'bold', color: '#d63031'}}>
                                {getHeaderDisplayValue('superbowl_week3', 'conference') || '-'}
                              </div>
                            </div>
                          )}
                          Week 3<br/>Total
                        </th>
                        <th rowSpan="2" style={{backgroundColor: '#d4edda', fontWeight: 'bold', color: '#000'}}>
                          {/* Official Total Input at top */}
                          {isPoolManager() ? (
                            <div style={{marginBottom: '8px'}}>
                              <div style={{fontSize: '0.7rem', marginBottom: '4px', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px'}}>
                                OFFICIAL {manualOverrides.superbowl_week2 ? '✏️' : '✓'}
                                {manualOverrides.superbowl_week2 && (
                                  <button
                                    onClick={() => clearManualOverride('superbowl_week2')}
                                    title="Return to auto-calculation"
                                    style={{
                                      padding: '2px 6px',
                                      fontSize: '0.65rem',
                                      background: '#e74c3c',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '3px',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Clear
                                  </button>
                                )}
                              </div>
                              <input
                                type="number"
                                min="0"
                                value={getHeaderDisplayValue('superbowl_week2', 'divisional')}
                                onChange={(e) => handleManualTotalChange('superbowl_week2', e.target.value)}
                                placeholder="Auto"
                                title={manualOverrides.superbowl_week2 ? 'Manually overridden - click Clear to return to auto' : 'Auto-calculated - click to override'}
                                style={{
                                  width: '60px',
                                  padding: '4px',
                                  textAlign: 'center',
                                  fontSize: '1rem',
                                  fontWeight: 'bold',
                                  border: manualOverrides.superbowl_week2 ? '2px solid #e74c3c' : '2px solid #27ae60',
                                  borderRadius: '4px',
                                  color: '#000',
                                  backgroundColor: manualOverrides.superbowl_week2 ? '#ffe5e5' : '#e8f8f5'
                                }}
                              />
                            </div>
                          ) : (
                            <div style={{marginBottom: '8px'}}>
                              <div style={{fontSize: '0.7rem', color: '#000', marginBottom: '2px'}}>
                                Official {manualOverrides.superbowl_week2 ? '✏️' : '✓'}
                              </div>
                              <div style={{fontSize: '1rem', fontWeight: 'bold', color: '#d63031'}}>
                                {getHeaderDisplayValue('superbowl_week2', 'divisional') || '-'}
                              </div>
                            </div>
                          )}
                          Week 2<br/>Total
                        </th>
                        <th rowSpan="2" style={{backgroundColor: '#f8d7da', fontWeight: 'bold', color: '#000'}}>
                          {/* Official Total Input at top */}
                          {isPoolManager() ? (
                            <div style={{marginBottom: '8px'}}>
                              <div style={{fontSize: '0.7rem', marginBottom: '4px', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px'}}>
                                OFFICIAL {manualOverrides.superbowl_week1 ? '✏️' : '✓'}
                                {manualOverrides.superbowl_week1 && (
                                  <button
                                    onClick={() => clearManualOverride('superbowl_week1')}
                                    title="Return to auto-calculation"
                                    style={{
                                      padding: '2px 6px',
                                      fontSize: '0.65rem',
                                      background: '#e74c3c',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '3px',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Clear
                                  </button>
                                )}
                              </div>
                              <input
                                type="number"
                                min="0"
                                value={getHeaderDisplayValue('superbowl_week1', 'wildcard')}
                                onChange={(e) => handleManualTotalChange('superbowl_week1', e.target.value)}
                                placeholder="Auto"
                                title={manualOverrides.superbowl_week1 ? 'Manually overridden - click Clear to return to auto' : 'Auto-calculated - click to override'}
                                style={{
                                  width: '60px',
                                  padding: '4px',
                                  textAlign: 'center',
                                  fontSize: '1rem',
                                  fontWeight: 'bold',
                                  border: manualOverrides.superbowl_week1 ? '2px solid #e74c3c' : '2px solid #27ae60',
                                  borderRadius: '4px',
                                  color: '#000',
                                  backgroundColor: manualOverrides.superbowl_week1 ? '#ffe5e5' : '#e8f8f5'
                                }}
                              />
                            </div>
                          ) : (
                            <div style={{marginBottom: '8px'}}>
                              <div style={{fontSize: '0.7rem', color: '#000', marginBottom: '2px'}}>
                                Official {manualOverrides.superbowl_week1 ? '✏️' : '✓'}
                              </div>
                              <div style={{fontSize: '1rem', fontWeight: 'bold', color: '#d63031'}}>
                                {getHeaderDisplayValue('superbowl_week1', 'wildcard') || '-'}
                              </div>
                            </div>
                          )}
                          Week 1<br/>Total
                        </th>
                        <th rowSpan="2" className="grand-total">
                          {/* Official Total Input */}
                          {isPoolManager() ? (
                            <div style={{marginBottom: '8px'}}>
                              <div style={{fontSize: '0.7rem', marginBottom: '4px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px'}}>
                                {manualOverrides.superbowl_grand ? '✏️' : '✓'} over
                                {manualOverrides.superbowl_grand && (
                                  <button
                                    onClick={() => clearManualOverride('superbowl_grand')}
                                    title="Return to auto-calculation"
                                    style={{
                                      padding: '2px 6px',
                                      fontSize: '0.65rem',
                                      background: '#e74c3c',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '3px',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Clear
                                  </button>
                                )}
                              </div>
                              <input
                                type="number"
                                min="0"
                                value={getGrandTotalHeaderValue()}
                                onChange={(e) => handleManualTotalChange('superbowl_grand', e.target.value)}
                                placeholder="Auto"
                                title={manualOverrides.superbowl_grand ? 'Manually overridden - click Clear to return to auto' : 'Auto-calculated - click to override'}
                                style={{
                                  width: '70px',
                                  padding: '4px',
                                  textAlign: 'center',
                                  fontSize: '1rem',
                                  fontWeight: 'bold',
                                  border: manualOverrides.superbowl_grand ? '3px solid #e74c3c' : '3px solid #27ae60',
                                  borderRadius: '4px',
                                  backgroundColor: manualOverrides.superbowl_grand ? '#ffe5e5' : '#e8f8f5',
                                  color: '#000'
                                }}
                              />
                            </div>
                          ) : (
                            <div style={{marginBottom: '8px'}}>
                              <div style={{fontSize: '0.7rem', color: '#fff', marginBottom: '2px'}}>
                                {manualOverrides.superbowl_grand ? '✏️ ' : '✓ '}Official
                              </div>
                              <div style={{fontSize: '1.2rem', fontWeight: 'bold', color: '#fff'}}>
                                {getGrandTotalHeaderValue() || '-'}
                              </div>
                            </div>
                          )}
                          
                          GRAND<br/>TOTAL
                        </th>
                      </>
                    ) : (
                      <th rowSpan="2" style={{backgroundColor: '#f8f9fa', fontWeight: 'bold', color: '#000'}}>
                        {/* Show auto-calculated ONLY if no override */}
                        {!manualWeekTotals[currentWeek] && (() => {
                          const actualTotal = currentWeekData.games.reduce((sum, game) => {
                            const score1 = parseInt(actualScores[currentWeek]?.[game.id]?.team1) || 0;
                            const score2 = parseInt(actualScores[currentWeek]?.[game.id]?.team2) || 0;
                            return sum + score1 + score2;
                          }, 0);
                          
                          return (
                            <div style={{fontSize: '0.85rem', color: '#16a085', marginBottom: '6px', fontWeight: '700'}}>
                              Total: {actualTotal > 0 ? actualTotal : '-'}
                            </div>
                          );
                        })()}
                        
                        {/* Official Total Input */}
                        {isPoolManager() ? (
                          <div style={{marginBottom: '8px'}}>
                            <input
                              type="number"
                              min="0"
                              value={manualWeekTotals[currentWeek] || ''}
                              onChange={(e) => handleManualTotalChange(currentWeek, e.target.value)}
                              placeholder="override"
                              style={{
                                width: '60px',
                                padding: '4px',
                                textAlign: 'center',
                                fontSize: '0.9rem',
                                fontWeight: 'bold',
                                border: '2px solid #f39c12',
                                borderRadius: '4px',
                                color: '#000'
                              }}
                            />
                          </div>
                        ) : null}
                        
                        {/* Show official override if set */}
                        {manualWeekTotals[currentWeek] && (
                          <div style={{marginBottom: '8px'}}>
                            <div style={{fontSize: '0.7rem', color: '#000', marginBottom: '2px'}}>Official</div>
                            <div style={{fontSize: '1rem', fontWeight: 'bold', color: '#d63031'}}>
                              {manualWeekTotals[currentWeek]}
                            </div>
                          </div>
                        )}
                        
                        Official<br/>Total
                      </th>
                    )}
                    <th rowSpan="2">Submitted</th>
                  </tr>
                  
                  {/* ACTUAL SCORES ROW - Enhanced visibility */}
                  <tr style={{background: '#ffffff', borderTop: '3px solid #4caf50', borderBottom: '3px solid #4caf50'}}>
                    {currentWeekData.games.map(game => (
                      <React.Fragment key={`actual-${game.id}`}>
                        <th style={{padding: '8px 4px', background: '#ffffff', borderLeft: '1px solid #ddd'}}>
                          {isPoolManager() ? (
                            <div>
                              <input
                                type="number"
                                min="0"
                                max="99"
                                value={actualScores[currentWeek]?.[game.id]?.team1 || ''}
                                onChange={(e) => handleActualScoreChange(game.id, 'team1', e.target.value)}
                                placeholder="-"
                                style={{
                                  width: '50px',
                                  padding: '4px',
                                  textAlign: 'center',
                                  fontSize: '1rem',
                                  fontWeight: 'bold',
                                  border: '2px solid #4caf50',
                                  borderRadius: '4px',
                                  color: '#000',
                                  background: '#f0fff0'
                                }}
                              />
                              <div style={{fontSize: '0.75rem', marginTop: '3px', color: '#000', fontWeight: '700'}}>ACTUAL</div>
                            </div>
                          ) : (
                            <div>
                              <div style={{fontSize: '1.1rem', fontWeight: 'bold', color: '#000'}}>
                                {actualScores[currentWeek]?.[game.id]?.team1 || '-'}
                              </div>
                              <div style={{fontSize: '0.75rem', color: '#000', fontWeight: '700'}}>ACTUAL</div>
                            </div>
                          )}
                        </th>
                        <th style={{padding: '8px 4px', background: '#ffffff', borderRight: '1px solid #ddd'}}>
                          {isPoolManager() ? (
                            <div>
                              <input
                                type="number"
                                min="0"
                                max="99"
                                value={actualScores[currentWeek]?.[game.id]?.team2 || ''}
                                onChange={(e) => handleActualScoreChange(game.id, 'team2', e.target.value)}
                                placeholder="-"
                                style={{
                                  width: '50px',
                                  padding: '4px',
                                  textAlign: 'center',
                                  fontSize: '1rem',
                                  fontWeight: 'bold',
                                  border: '2px solid #4caf50',
                                  borderRadius: '4px',
                                  color: '#000',
                                  background: '#f0fff0'
                                }}
                              />
                              <div style={{fontSize: '0.75rem', marginTop: '3px', color: '#000', fontWeight: '700'}}>ACTUAL</div>
                              {/* Game Status Dropdown */}
                              <select
                                value={gameStatus[currentWeek]?.[game.id] || ''}
                                onChange={(e) => handleGameStatusChange(game.id, e.target.value)}
                                style={{
                                  width: '60px',
                                  padding: '2px',
                                  fontSize: '0.7rem',
                                  marginTop: '4px',
                                  borderRadius: '3px',
                                  border: '1px solid #999'
                                }}
                              >
                                <option value="">--</option>
                                <option value="live">🔴 LIVE</option>
                                <option value="final">✅ FINAL</option>
                              </select>
                            </div>
                          ) : (
                            <div>
                              <div style={{fontSize: '1.1rem', fontWeight: 'bold', color: '#000'}}>
                                {actualScores[currentWeek]?.[game.id]?.team2 || '-'}
                              </div>
                              <div style={{fontSize: '0.75rem', color: '#000', fontWeight: '700'}}>ACTUAL</div>
                              {/* Status Badge */}
                              {gameStatus[currentWeek]?.[game.id] === 'final' && (
                                <div style={{
                                  display: 'inline-block',
                                  padding: '2px 6px',
                                  background: '#4caf50',
                                  color: 'white',
                                  borderRadius: '3px',
                                  fontSize: '0.65rem',
                                  fontWeight: 'bold',
                                  marginTop: '4px'
                                }}>✅ FINAL</div>
                              )}
                              {gameStatus[currentWeek]?.[game.id] === 'live' && (
                                <div style={{
                                  display: 'inline-block',
                                  padding: '2px 6px',
                                  background: '#ff9800',
                                  color: 'white',
                                  borderRadius: '3px',
                                  fontSize: '0.65rem',
                                  fontWeight: 'bold',
                                  marginTop: '4px'
                                }}>🔴 LIVE</div>
                              )}
                            </div>
                          )}
                        </th>
                      </React.Fragment>
                    ))}
                  </tr>
                  
                  {/* 🗑️ REMOVED: Manual Week Totals header row deleted per user request */}
                </thead>
                <tbody>
                  {allPicks
                    .filter(pick => pick.week === currentWeek)
                    .sort((a, b) => (b.lastUpdated || b.timestamp) - (a.lastUpdated || a.timestamp))
                    .map((pick, idx) => {
                      // Check if any prediction matches actual score (winner)
                      const hasCorrectPrediction = (gameId) => {
                        const actual = actualScores[currentWeek]?.[gameId];
                        const pred = pick.predictions[gameId];
                        if (!actual || !pred) return false;
                        
                        const actualTeam1 = parseInt(actual.team1);
                        const actualTeam2 = parseInt(actual.team2);
                        const predTeam1 = parseInt(pred.team1);
                        const predTeam2 = parseInt(pred.team2);
                        
                        if (isNaN(actualTeam1) || isNaN(actualTeam2)) return false;
                        
                        // Check if prediction matches the winner
                        const actualWinner = actualTeam1 > actualTeam2 ? 'team1' : actualTeam2 > actualTeam1 ? 'team2' : 'tie';
                        const predWinner = predTeam1 > predTeam2 ? 'team1' : predTeam2 > predTeam1 ? 'team2' : 'tie';
                        
                        return actualWinner === predWinner && actualWinner !== 'tie';
                      };
                      
                      return (
                        <tr key={idx}>
                          <td className="player-name">{pick.playerName}</td>
                          {currentWeekData.games.map(game => {
                            const pred = pick.predictions[game.id];
                            const actual = actualScores[currentWeek]?.[game.id];
                            const status = gameStatus[currentWeek]?.[game.id];
                            
                            // Get highlighting for each cell
                            const team1Style = getCellHighlight(
                              pred?.team1,
                              pred?.team2,
                              actual?.team1,
                              actual?.team2,
                              status,
                              true // isTeam1Cell
                            );
                            
                            const team2Style = getCellHighlight(
                              pred?.team1,
                              pred?.team2,
                              actual?.team1,
                              actual?.team2,
                              status,
                              false // isTeam2Cell
                            );
                            
                            return (
                              <React.Fragment key={`${idx}-${game.id}`}>
                                <td 
                                  className="score"
                                  style={{
                                    background: team1Style.background,
                                    color: team1Style.color,
                                    fontWeight: team1Style.background !== 'transparent' ? 'bold' : 'normal'
                                  }}
                                >
                                  {pick.predictions[game.id]?.team1 || '-'}
                                </td>
                                <td 
                                  className="score"
                                  style={{
                                    background: team2Style.background,
                                    color: team2Style.color,
                                    fontWeight: team2Style.background !== 'transparent' ? 'bold' : 'normal'
                                  }}
                                >
                                  {pick.predictions[game.id]?.team2 || '-'}
                                </td>
                              </React.Fragment>
                            );
                          })}
                          
                          {/* CORRECT PICKS CELL */}
                          {(() => {
                            let correctCount = 0;
                            currentWeekData.games.forEach(game => {
                              if (hasCorrectPrediction(game.id)) {
                                correctCount++;
                              }
                            });
                            return (
                              <td style={{
                                backgroundColor: '#f1f8f4',
                                fontWeight: 'bold',
                                fontSize: '1rem',
                                color: correctCount > 0 ? '#2e7d32' : '#999',
                                textAlign: 'center',
                                padding: '8px 4px'
                              }}>
                                {correctCount}
                              </td>
                            );
                          })()}
                          
                          {/* Total Points Columns */}
                          {currentWeek === 'superbowl' ? (
                            <>
                              {(() => {
                                const week4Display = formatWeeklyDisplay(pick.playerCode, 'superbowl', 4);
                                const week3Display = formatWeeklyDisplay(pick.playerCode, 'conference', 3);
                                const week2Display = formatWeeklyDisplay(pick.playerCode, 'divisional', 2);
                                const week1Display = formatWeeklyDisplay(pick.playerCode, 'wildcard', 1);
                                const grandDisplay = formatGrandDisplay(pick.playerCode);
                                
                                return (
                                  <>
                                    <td 
                                      style={{backgroundColor: '#fff3cd', fontWeight: 'bold', fontSize: week4Display.fontSize}}
                                      title={week4Display.tooltip}
                                    >
                                      <span style={{color: '#000'}}>{week4Display.display}</span>
                                    </td>
                                    <td 
                                      style={{backgroundColor: '#d1ecf1', fontWeight: 'bold', fontSize: week3Display.fontSize}}
                                      title={week3Display.tooltip}
                                    >
                                      <span style={{color: '#000'}}>{week3Display.display}</span>
                                    </td>
                                    <td 
                                      style={{backgroundColor: '#d4edda', fontWeight: 'bold', fontSize: week2Display.fontSize}}
                                      title={week2Display.tooltip}
                                    >
                                      <span style={{color: '#000'}}>{week2Display.display}</span>
                                    </td>
                                    <td 
                                      style={{backgroundColor: '#f8d7da', fontWeight: 'bold', fontSize: week1Display.fontSize}}
                                      title={week1Display.tooltip}
                                    >
                                      <span style={{color: '#000'}}>{week1Display.display}</span>
                                    </td>
                                    <td 
                                      className="grand-total"
                                      style={{fontSize: grandDisplay.fontSize}}
                                      title={grandDisplay.tooltip}
                                    >
                                      {grandDisplay.display}
                                    </td>
                                  </>
                                );
                              })()}
                            </>
                          ) : (
                            <td style={{backgroundColor: '#f8f9fa', fontWeight: 'bold', fontSize: '16px'}}>
                              <span style={{color: '#000'}}>{playerTotals[pick.playerName]?.current || 0}</span>
                            </td>
                          )}
                          
                          <td className="timestamp">
                            {new Date(pick.lastUpdated || pick.timestamp).toLocaleString('en-US', {
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            })}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}

          {/* 🆕 STEP 5: Prize Leaders Display */}
          {codeValidated && (
            <>
              {/* 📊 Smart P Notation Legend - Only on Super Bowl page */}
              {currentWeek === 'superbowl' && (
                <div style={{
                  marginTop: '40px',
                  marginBottom: '40px',
                  padding: '30px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  borderRadius: '12px',
                  border: '3px solid #5a67d8',
                  boxShadow: '0 8px 20px rgba(0,0,0,0.15)'
                }}>
                  <h3 style={{
                    color: '#fff',
                    marginBottom: '20px',
                    fontSize: '1.4rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}>
                    📊 Format Guide - How to Read the Totals
                  </h3>
                  
                  <div style={{
                    background: 'rgba(255,255,255,0.95)',
                    padding: '25px',
                    borderRadius: '10px',
                    color: '#333'
                  }}>
                    {/* Grand Total Format */}
                    <div style={{marginBottom: '25px'}}>
                      <p style={{
                        fontWeight: 'bold',
                        color: '#5a67d8',
                        marginBottom: '12px',
                        fontSize: '1.1rem'
                      }}>
                        Grand Total Format:
                      </p>
                      <ul style={{
                        listStyle: 'none',
                        padding: 0,
                        margin: 0,
                        lineHeight: '2.2'
                      }}>
                        <li>
                          <strong>Complete Entry:</strong> <code style={{
                            background: '#f0f4f8',
                            padding: '4px 10px',
                            borderRadius: '5px',
                            fontWeight: 'bold',
                            color: '#2d3748'
                          }}>784</code> - All 4 weeks entered
                        </li>
                        <li>
                          <strong>During Season:</strong> <code style={{
                            background: '#f0f4f8',
                            padding: '4px 10px',
                            borderRadius: '5px',
                            fontWeight: 'bold',
                            color: '#2d3748'
                          }}>784/598/35</code> - Full Pred / Played Weeks / Difference
                        </li>
                        <li>
                          <strong>After Season:</strong> <code style={{
                            background: '#f0f4f8',
                            padding: '4px 10px',
                            borderRadius: '5px',
                            fontWeight: 'bold',
                            color: '#2d3748'
                          }}>784/55</code> - Full Pred / Total Difference
                        </li>
                        <li>
                          <strong>Abnormal Pattern:</strong> <code style={{
                            background: '#fff3cd',
                            padding: '4px 10px',
                            borderRadius: '5px',
                            fontWeight: 'bold',
                            color: '#856404',
                            border: '2px solid #ffc107'
                          }}>P13/415</code> - P = Partial (weeks 1 & 3 only - unusual!)
                        </li>
                      </ul>
                    </div>
                    
                    {/* Special Indicators */}
                    <div style={{marginBottom: '25px'}}>
                      <p style={{
                        fontWeight: 'bold',
                        color: '#5a67d8',
                        marginBottom: '12px',
                        fontSize: '1.1rem'
                      }}>
                        Special Indicators:
                      </p>
                      <ul style={{
                        listStyle: 'none',
                        padding: 0,
                        margin: 0,
                        lineHeight: '2.2'
                      }}>
                        <li>
                          <strong>Asterisk (*):</strong> <code style={{
                            background: '#f0f4f8',
                            padding: '4px 10px',
                            borderRadius: '5px',
                            fontWeight: 'bold',
                            color: '#2d3748'
                          }}>234*</code> - Pick filled by RNG/Pool Manager
                        </li>
                        <li>
                          <strong>P Notation:</strong> Shows which weeks entered when pattern is unusual (e.g., P13 = weeks 1 & 3, skipped 2)
                        </li>
                        <li>
                          <strong>Dash (-):</strong> Week not entered yet
                        </li>
                      </ul>
                    </div>
                    
                    {/* Examples */}
                    <div style={{marginBottom: '15px'}}>
                      <p style={{
                        fontWeight: 'bold',
                        color: '#5a67d8',
                        marginBottom: '12px',
                        fontSize: '1.1rem'
                      }}>
                        Examples:
                      </p>
                      <ul style={{
                        listStyle: 'none',
                        padding: 0,
                        margin: 0,
                        lineHeight: '2.2'
                      }}>
                        <li>
                          Richard: <code style={{background: '#f0f4f8', padding: '4px 10px', borderRadius: '5px', fontWeight: 'bold'}}>784</code> - Entered all 4 weeks normally
                        </li>
                        <li>
                          Neema: <code style={{background: '#f0f4f8', padding: '4px 10px', borderRadius: '5px', fontWeight: 'bold'}}>533/287/22</code> - 2 weeks played so far, 22 points off
                        </li>
                        <li>
                          Bob: <code style={{background: '#fff3cd', padding: '4px 10px', borderRadius: '5px', fontWeight: 'bold', border: '2px solid #ffc107'}}>P13/415</code> - Entered weeks 1 & 3 only (skipped 2) - unusual!
                        </li>
                        <li>
                          After RNG fills Bob's week 2: <code style={{background: '#f0f4f8', padding: '4px 10px', borderRadius: '5px', fontWeight: 'bold'}}>649</code> - P notation drops (normalized)
                        </li>
                      </ul>
                    </div>
                    
                    {/* Tip */}
                    <div style={{
                      paddingTop: '20px',
                      borderTop: '2px solid #cbd5e0',
                      marginTop: '15px'
                    }}>
                      <p style={{
                        color: '#4a5568',
                        fontStyle: 'italic',
                        fontSize: '1rem',
                        margin: 0
                      }}>
                        💡 <strong>Tip:</strong> Hover over any number for detailed breakdown! The P notation only appears for unusual entry patterns and disappears once normalized.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              <div style={{marginTop: '60px'}}>
                <LeaderDisplay
                  allPicks={allPicks}
                  actualScores={actualScores}
                  games={PLAYOFF_WEEKS}
                  officialWinners={officialWinners}
                  weekData={PLAYOFF_WEEKS}
                />
              </div>
            </>
          )}

          {/* 💰 PHASE 2: ENHANCED PRIZE POOL & WINNER DECLARATION - Pool Manager Only */}
          {codeValidated && isPoolManager() && (
            <div style={{marginTop: '40px', marginBottom: '40px'}}>
              
              {/* Prize Pool Setup Section */}
              <div style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                padding: '25px',
                borderRadius: '12px',
                marginBottom: '30px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
              }}>
                <h2 style={{margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '10px'}}>
                  <span>💰</span>
                  <span>PRIZE POOL MANAGEMENT</span>
                </h2>
                
                {prizePool.totalFees > 0 ? (
                  <div>
                    <div style={{
                      background: 'rgba(255,255,255,0.2)',
                      padding: '20px',
                      borderRadius: '8px',
                      marginBottom: '15px'
                    }}>
                      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '15px'}}>
                        <div>
                          <div style={{fontSize: '0.85rem', opacity: 0.9}}>Total Pool Fees</div>
                          <div style={{fontSize: '1.8rem', fontWeight: 'bold'}}>${prizePool.totalFees.toFixed(2)}</div>
                        </div>
                        <div>
                          <div style={{fontSize: '0.85rem', opacity: 0.9}}>Number of Players</div>
                          <div style={{fontSize: '1.8rem', fontWeight: 'bold'}}>{prizePool.numberOfPlayers}</div>
                        </div>
                        <div>
                          <div style={{fontSize: '0.85rem', opacity: 0.9}}>Each Prize (10%)</div>
                          <div style={{fontSize: '1.8rem', fontWeight: 'bold'}}>${prizePool.prizeValue.toFixed(2)}</div>
                        </div>
                      </div>
                      <div style={{fontSize: '0.85rem', opacity: 0.8}}>
                        Entry Fee: ${prizePool.entryFee} per player
                      </div>
                    </div>
                    <button
                      onClick={() => setShowPrizePoolSetup(true)}
                      style={{
                        padding: '10px 20px',
                        background: 'rgba(255,255,255,0.3)',
                        color: 'white',
                        border: '2px solid white',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: '600'
                      }}
                    >
                      ⚙️ Edit Prize Pool Setup
                    </button>
                  </div>
                ) : (
                  <div>
                    <p style={{marginBottom: '15px'}}>
                      ℹ️ Set up your prize pool to enable winner declarations.
                    </p>
                    <button
                      onClick={() => setShowPrizePoolSetup(true)}
                      style={{
                        padding: '12px 24px',
                        background: 'white',
                        color: '#667eea',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: '700',
                        fontSize: '1rem'
                      }}
                    >
                      💰 Set Up Prize Pool
                    </button>
                  </div>
                )}
              </div>

              {/* Winner Declaration Section */}
              {prizePool.totalFees > 0 && (
                <div style={{
                  background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                  color: 'white',
                  padding: '25px',
                  borderRadius: '12px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}>
                  <h2 style={{margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '10px'}}>
                    <span>🏆</span>
                    <span>DECLARE PRIZE WINNERS</span>
                  </h2>
                  
                  <button
                    onClick={() => setShowWinnerDeclaration(true)}
                    style={{
                      padding: '14px 28px',
                      background: 'white',
                      color: '#f5576c',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '700',
                      fontSize: '1.1rem',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}
                  >
                    🏆 Declare Winner(s) for a Prize
                  </button>
                  
                  {/* Show Current Declarations */}
                  {Object.keys(officialWinners).length > 0 && (
                    <div style={{marginTop: '25px'}}>
                      <h3 style={{marginBottom: '15px', fontSize: '1.1rem'}}>📋 Current Prize Winners:</h3>
                      <div style={{
                        background: 'rgba(255,255,255,0.2)',
                        padding: '15px',
                        borderRadius: '8px',
                        maxHeight: '400px',
                        overflowY: 'auto'
                      }}>
                        {Object.entries(officialWinners).sort((a, b) => {
                          const prizeA = a[1].prizeNumber;
                          const prizeB = b[1].prizeNumber;
                          return prizeA - prizeB;
                        }).map(([key, prize]) => (
                          <div key={key} style={{
                            background: 'rgba(255,255,255,0.9)',
                            color: '#333',
                            padding: '15px',
                            borderRadius: '6px',
                            marginBottom: '12px'
                          }}>
                            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px'}}>
                              <div>
                                <div style={{fontWeight: 'bold', fontSize: '1rem', marginBottom: '5px'}}>
                                  {prize.prizeName}
                                </div>
                                <div style={{fontSize: '0.9rem', color: '#666'}}>
                                  Prize Value: ${prize.prizeValue.toFixed(2)}
                                </div>
                              </div>
                              <button
                                onClick={() => deletePrizeDeclaration(prize.prizeNumber)}
                                style={{
                                  padding: '6px 12px',
                                  background: '#e74c3c',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '0.85rem',
                                  fontWeight: '600'
                                }}
                              >
                                🗑️ Delete
                              </button>
                            </div>
                            <div style={{paddingLeft: '15px'}}>
                              {prize.winners.map((winner, idx) => (
                                <div key={idx} style={{
                                  padding: '8px 0',
                                  borderBottom: idx < prize.winners.length - 1 ? '1px solid #eee' : 'none'
                                }}>
                                  <span style={{fontWeight: '600'}}>🏆 {winner.playerName}</span>
                                  <span style={{marginLeft: '15px', color: '#666'}}>
                                    {winner.percentage.toFixed(2)}% = ${winner.amount.toFixed(2)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 💰 PRIZE POOL SETUP POPUP */}
          {showPrizePoolSetup && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.85)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000,
              padding: '20px'
            }}>
              <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '30px',
                maxWidth: '600px',
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
              }}>
                <h2 style={{marginTop: 0, color: '#667eea'}}>💰 Prize Pool Setup</h2>
                
                <div style={{marginBottom: '20px'}}>
                  <label style={{display: 'block', marginBottom: '8px', fontWeight: '600'}}>
                    Total Pool Fees Collected:
                  </label>
                  <input
                    type="number"
                    id="totalFees"
                    defaultValue={prizePool.totalFees || ''}
                    placeholder="1000"
                    style={{
                      width: '100%',
                      padding: '12px',
                      fontSize: '1.1rem',
                      border: '2px solid #667eea',
                      borderRadius: '6px'
                    }}
                  />
                  <div style={{fontSize: '0.85rem', color: '#666', marginTop: '5px'}}>
                    Total money collected from all players
                  </div>
                </div>
                
                <div style={{marginBottom: '20px'}}>
                  <label style={{display: 'block', marginBottom: '8px', fontWeight: '600'}}>
                    Number of Players:
                  </label>
                  <input
                    type="number"
                    id="numberOfPlayers"
                    defaultValue={prizePool.numberOfPlayers || ''}
                    placeholder="50"
                    style={{
                      width: '100%',
                      padding: '12px',
                      fontSize: '1.1rem',
                      border: '2px solid #667eea',
                      borderRadius: '6px'
                    }}
                  />
                  <div style={{fontSize: '0.85rem', color: '#666', marginTop: '5px'}}>
                    Total number of players in the pool
                  </div>
                </div>
                
                <div style={{marginBottom: '20px'}}>
                  <label style={{display: 'block', marginBottom: '8px', fontWeight: '600'}}>
                    Entry Fee per Player:
                  </label>
                  <input
                    type="number"
                    id="entryFee"
                    defaultValue={prizePool.entryFee || 20}
                    placeholder="20"
                    style={{
                      width: '100%',
                      padding: '12px',
                      fontSize: '1.1rem',
                      border: '2px solid #667eea',
                      borderRadius: '6px'
                    }}
                  />
                  <div style={{fontSize: '0.85rem', color: '#666', marginTop: '5px'}}>
                    Amount each player paid to enter ($20, $50, etc.)
                  </div>
                </div>
                
                <div style={{
                  background: '#f0f8ff',
                  padding: '15px',
                  borderRadius: '8px',
                  marginBottom: '20px'
                }}>
                  <div style={{fontWeight: '600', marginBottom: '10px'}}>📊 Calculation Preview:</div>
                  <div style={{fontSize: '0.9rem', lineHeight: '1.6'}}>
                    Each Prize = Total Pool ÷ 10<br/>
                    <span id="prizePreview" style={{fontWeight: 'bold', color: '#667eea'}}>
                      Example: $1,000 ÷ 10 = $100 per prize
                    </span>
                  </div>
                </div>
                
                <div style={{display: 'flex', gap: '10px'}}>
                  <button
                    onClick={() => setShowPrizePoolSetup(false)}
                    style={{
                      flex: '1',
                      padding: '14px',
                      background: '#95a5a6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      fontWeight: '700'
                    }}
                  >
                    ❌ Cancel
                  </button>
                  <button
                    onClick={() => {
                      const totalFees = document.getElementById('totalFees').value;
                      const numberOfPlayers = document.getElementById('numberOfPlayers').value;
                      const entryFee = document.getElementById('entryFee').value;
                      
                      if (!totalFees || totalFees <= 0) {
                        alert('❌ Please enter a valid total pool amount.');
                        return;
                      }
                      
                      savePrizePool(totalFees, numberOfPlayers, entryFee);
                    }}
                    style={{
                      flex: '1',
                      padding: '14px',
                      background: '#667eea',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      fontWeight: '700'
                    }}
                  >
                    💾 Save Prize Pool
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 🏆 WINNER DECLARATION POPUP */}
          {showWinnerDeclaration && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.85)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000,
              padding: '20px'
            }}>
              <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '30px',
                maxWidth: '700px',
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
              }}>
                <h2 style={{marginTop: 0, color: '#f5576c'}}>🏆 Declare Prize Winner(s)</h2>
                
                {/* Prize Selection */}
                <div style={{marginBottom: '20px'}}>
                  <label style={{display: 'block', marginBottom: '8px', fontWeight: '600'}}>
                    Select Prize:
                  </label>
                  <select
                    value={selectedPrize}
                    onChange={(e) => setSelectedPrize(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      fontSize: '1rem',
                      border: '2px solid #f5576c',
                      borderRadius: '6px'
                    }}
                  >
                    <option value="">-- Select Prize --</option>
                    {[1,2,3,4,5,6,7,8,9,10].map(num => (
                      <option key={num} value={num}>{getPrizeName(num)}</option>
                    ))}
                  </select>
                  {selectedPrize && (
                    <div style={{marginTop: '8px', fontSize: '0.9rem', color: '#666'}}>
                      Prize Value: ${prizePool.prizeValue.toFixed(2)} (10% of pool)
                    </div>
                  )}
                </div>
                
                {selectedPrize && (
                  <>
                    {/* Number of Winners */}
                    <div style={{marginBottom: '20px'}}>
                      <label style={{display: 'block', marginBottom: '8px', fontWeight: '600'}}>
                        Number of Winners (Tie?):
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={numberOfWinners}
                        onChange={(e) => {
                          const num = parseInt(e.target.value) || 1;
                          setNumberOfWinners(num);
                          setSelectedWinners(Array(num).fill(null).map(() => ({ name: '', code: '' })));
                          const splits = calculateSplit(prizePool.prizeValue, num);
                          setCustomSplits(splits);
                        }}
                        style={{
                          width: '100%',
                          padding: '12px',
                          fontSize: '1rem',
                          border: '2px solid #f5576c',
                          borderRadius: '6px'
                        }}
                      />
                      <div style={{fontSize: '0.85rem', color: '#666', marginTop: '5px'}}>
                        How many players are tied? (1 = single winner, 2+ = tie)
                      </div>
                    </div>
                    
                    {/* Winner Selection */}
                    <div style={{marginBottom: '20px'}}>
                      <label style={{display: 'block', marginBottom: '12px', fontWeight: '600'}}>
                        Select Winner(s):
                      </label>
                      {Array(numberOfWinners).fill(0).map((_, idx) => {
                        const autoSplit = !useCustomSplit ? calculateSplit(prizePool.prizeValue, numberOfWinners)[idx] : null;
                        return (
                          <div key={idx} style={{
                            background: '#f8f9fa',
                            padding: '15px',
                            borderRadius: '8px',
                            marginBottom: '12px'
                          }}>
                            <div style={{marginBottom: '10px', fontWeight: '600'}}>
                              Winner {idx + 1}:
                            </div>
                            <select
                              value={selectedWinners[idx]?.code || ''}
                              onChange={(e) => {
                                const player = Object.entries(PLAYER_CODES).find(([code]) => code === e.target.value);
                                const newWinners = [...selectedWinners];
                                newWinners[idx] = { code: e.target.value, name: player ? player[1] : '' };
                                setSelectedWinners(newWinners);
                              }}
                              style={{
                                width: '100%',
                                padding: '10px',
                                fontSize: '1rem',
                                border: '1px solid #ddd',
                                borderRadius: '6px',
                                marginBottom: '8px'
                              }}
                            >
                              <option value="">-- Select Player --</option>
                              {Object.entries(PLAYER_CODES).sort((a, b) => a[1].localeCompare(b[1])).map(([code, name]) => (
                                <option key={code} value={code}>{name}</option>
                              ))}
                            </select>
                            {!useCustomSplit && autoSplit && (
                              <div style={{fontSize: '0.9rem', color: '#666'}}>
                                Share: {autoSplit.percentage.toFixed(2)}% = ${autoSplit.amount.toFixed(2)}
                                {idx === numberOfWinners - 1 && numberOfWinners > 1 && (
                                  <span style={{marginLeft: '10px', fontSize: '0.85rem', color: '#f5576c'}}>
                                    (includes extra penny)
                                  </span>
                                )}
                              </div>
                            )}
                            {useCustomSplit && (
                              <div style={{display: 'flex', gap: '10px', marginTop: '8px'}}>
                                <input
                                  type="number"
                                  placeholder="%"
                                  step="0.01"
                                  value={customSplits[idx]?.percentage || ''}
                                  onChange={(e) => {
                                    const newSplits = [...customSplits];
                                    const percent = parseFloat(e.target.value) || 0;
                                    newSplits[idx] = {
                                      ...newSplits[idx],
                                      percentage: percent,
                                      amount: (prizePool.prizeValue * percent / 100)
                                    };
                                    setCustomSplits(newSplits);
                                  }}
                                  style={{
                                    flex: '1',
                                    padding: '8px',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px'
                                  }}
                                />
                                <input
                                  type="number"
                                  placeholder="$"
                                  step="0.01"
                                  value={customSplits[idx]?.amount || ''}
                                  onChange={(e) => {
                                    const newSplits = [...customSplits];
                                    const amount = parseFloat(e.target.value) || 0;
                                    newSplits[idx] = {
                                      ...newSplits[idx],
                                      amount: amount,
                                      percentage: (amount / prizePool.prizeValue * 100)
                                    };
                                    setCustomSplits(newSplits);
                                  }}
                                  style={{
                                    flex: '1',
                                    padding: '8px',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px'
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Manual Override Toggle */}
                    <div style={{marginBottom: '20px'}}>
                      <label style={{display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer'}}>
                        <input
                          type="checkbox"
                          checked={useCustomSplit}
                          onChange={(e) => setUseCustomSplit(e.target.checked)}
                          style={{width: '18px', height: '18px'}}
                        />
                        <span style={{fontWeight: '600'}}>Use custom percentages/amounts (manual override)</span>
                      </label>
                    </div>
                    
                    {/* Summary */}
                    <div style={{
                      background: '#fff3cd',
                      border: '2px solid #ffc107',
                      padding: '15px',
                      borderRadius: '8px',
                      marginBottom: '20px',
                      color: '#000' // BLACK TEXT FOR READABILITY
                    }}>
                      <div style={{fontWeight: '700', marginBottom: '10px', color: '#000', fontSize: '1.05rem'}}>📊 Summary:</div>
                      {selectedWinners.every(w => w.name) ? (
                        <div style={{color: '#000'}}>
                          {selectedWinners.map((winner, idx) => {
                            const split = useCustomSplit ? customSplits[idx] : calculateSplit(prizePool.prizeValue, numberOfWinners)[idx];
                            return (
                              <div key={idx} style={{marginBottom: '5px', color: '#000', fontWeight: '600'}}>
                                🏆 {winner.name}: {split?.percentage.toFixed(2)}% = ${split?.amount.toFixed(2)}
                              </div>
                            );
                          })}
                          <div style={{marginTop: '10px', paddingTop: '10px', borderTop: '2px solid #856404', fontWeight: '700', color: '#000'}}>
                            Total: {useCustomSplit 
                              ? customSplits.reduce((sum, s) => sum + (s.percentage || 0), 0).toFixed(2)
                              : '100.00'}% = $
                            {useCustomSplit
                              ? customSplits.reduce((sum, s) => sum + (s.amount || 0), 0).toFixed(2)
                              : prizePool.prizeValue.toFixed(2)}
                          </div>
                        </div>
                      ) : (
                        <div style={{color: '#856404', fontWeight: '600'}}>Select all winners to see summary</div>
                      )}
                    </div>
                  </>
                )}
                
                <div style={{display: 'flex', gap: '10px'}}>
                  <button
                    onClick={() => {
                      setShowWinnerDeclaration(false);
                      setSelectedPrize('');
                      setNumberOfWinners(1);
                      setSelectedWinners([]);
                      setUseCustomSplit(false);
                      setCustomSplits([]);
                    }}
                    style={{
                      flex: '1',
                      padding: '14px',
                      background: '#95a5a6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      fontWeight: '700'
                    }}
                  >
                    ❌ Cancel
                  </button>
                  <button
                    onClick={declareWinners}
                    disabled={!selectedPrize || !selectedWinners.every(w => w.name)}
                    style={{
                      flex: '1',
                      padding: '14px',
                      background: selectedPrize && selectedWinners.every(w => w.name) ? '#f5576c' : '#ccc',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: selectedPrize && selectedWinners.every(w => w.name) ? 'pointer' : 'not-allowed',
                      fontSize: '1rem',
                      fontWeight: '700'
                    }}
                  >
                    🏆 Declare Winner(s)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 🆕 STEP 5: All Validation Popups */}
          {showPopup === 'unsavedChanges' && (
            <UnsavedChangesPopup
              currentWeek={PLAYOFF_WEEKS[currentWeek].name}
              onDiscard={() => {
                setCurrentWeek(pendingWeekChange);
                loadWeekPicks(pendingWeekChange);
                setShowPopup(null);
              }}
              onSaveAndSwitch={async () => {
                // Submit current week's picks
                await handleSubmit(new Event('submit'));
                // Always switch to the new week after saving
                // (handleSubmit will show success popup, but we'll switch anyway)
                setTimeout(() => {
                  setCurrentWeek(pendingWeekChange);
                  loadWeekPicks(pendingWeekChange);
                  setShowPopup(null);
                  setPendingWeekChange(null);
                }, 100);
              }}
              onCancel={() => {
                setPendingWeekChange(null);
                setShowPopup(null);
              }}
            />
          )}

          {showPopup === 'discardChanges' && (
            <DiscardChangesPopup
              onKeepEditing={() => setShowPopup(null)}
              onDiscard={() => {
                setPredictions({...originalPicks});
                setHasUnsavedChanges(false);
                setShowPopup(null);
              }}
            />
          )}

          {showPopup === 'incomplete' && (
            <IncompleteEntryError
              missingGames={missingGames}
              totalGames={currentWeekData.games.length}
              onClose={() => setShowPopup(null)}
            />
          )}

          {showPopup === 'invalidScores' && (
            <InvalidScoresError
              invalidScores={invalidScores}
              onClose={() => setShowPopup(null)}
            />
          )}

          {showPopup === 'success' && (
            <SuccessConfirmation
              weekName={currentWeekData.name}
              deadline={currentWeekData.deadline}
              onClose={() => setShowPopup(null)}
            />
          )}

          {showPopup === 'noChanges' && (
            <NoChangesInfo
              onClose={() => setShowPopup(null)}
            />
          )}

          {showPopup === 'tiedGames' && (
            <TiedGamesError
              tiedGames={missingGames}
              gameData={currentWeekData.games}
              onClose={() => setShowPopup(null)}
            />
          )}
        </div>
          </>
        )}
      </div>

      <footer>
        <p>Richard's NFL Playoff Pool 2025 | Good luck! 🏈</p>
        <p style={{fontSize: '0.85rem', marginTop: '5px'}}>
          Questions? Contact: gammoneer2b@gmail.com
        </p>
      </footer>
    </div>
  );
}

export default App;
