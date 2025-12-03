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
    const winnersRef = ref(database, 'winners');
    onValue(winnersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setOfficialWinners(data);
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
    
    // Save to Firebase
    set(ref(database, `manualWeekTotals/${weekKey}`), value);
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
    const existingPick = allPicks.find(
      p => p.week === weekKey && p.playerCode === playerCode
    );
    
    if (existingPick && existingPick.predictions) {
      setPredictions(existingPick.predictions);
      setOriginalPicks(existingPick.predictions);
      setHasUnsavedChanges(false);
    } else {
      setPredictions({});
      setOriginalPicks({});
      setHasUnsavedChanges(false);
    }
  };

  // Detect unsaved changes
  useEffect(() => {
    const hasChanges = JSON.stringify(predictions) !== JSON.stringify(originalPicks);
    setHasUnsavedChanges(hasChanges);
  }, [predictions, originalPicks]);

  // Load picks when week changes
  useEffect(() => {
    if (codeValidated && playerCode) {
      loadWeekPicks(currentWeek);
    }
  }, [currentWeek, codeValidated, playerCode, allPicks]);

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
      
      setSubmitted(true);
      setOriginalPicks({...predictions});
      setHasUnsavedChanges(false);
      setShowPopup('success');
      
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
    
    // Get all unique player names from current week
    const weekPicks = allPicks.filter(pick => pick.week === currentWeek);
    
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
      
      // Calculate current week total
      let currentTotal = 0;
      const weekGames = PLAYOFF_WEEKS[currentWeek].games;
      weekGames.forEach(game => {
        const pred = pick.predictions[game.id];
        if (pred && pred.team1 && pred.team2) {
          currentTotal += (parseInt(pred.team1) || 0) + (parseInt(pred.team2) || 0);
        }
      });
      totals[pick.playerName].current = currentTotal;
      
      // For Super Bowl, calculate all weeks
      if (currentWeek === 'superbowl') {
        // Week 4 (Super Bowl)
        const w4Pick = allPicks.find(p => p.playerName === pick.playerName && p.week === 'superbowl');
        if (w4Pick && w4Pick.predictions) {
          let w4Total = 0;
          PLAYOFF_WEEKS.superbowl.games.forEach(game => {
            const pred = w4Pick.predictions[game.id];
            if (pred) w4Total += (Number(pred.team1) || 0) + (Number(pred.team2) || 0);
          });
          totals[pick.playerName].week4 = w4Total;
        }
        
        // Week 3 (Conference)
        const w3Pick = allPicks.find(p => p.playerName === pick.playerName && p.week === 'conference');
        if (w3Pick && w3Pick.predictions) {
          let w3Total = 0;
          PLAYOFF_WEEKS.conference.games.forEach(game => {
            const pred = w3Pick.predictions[game.id];
            if (pred) w3Total += (Number(pred.team1) || 0) + (Number(pred.team2) || 0);
          });
          totals[pick.playerName].week3 = w3Total;
        }
        
        // Week 2 (Divisional)
        const w2Pick = allPicks.find(p => p.playerName === pick.playerName && p.week === 'divisional');
        if (w2Pick && w2Pick.predictions) {
          let w2Total = 0;
          PLAYOFF_WEEKS.divisional.games.forEach(game => {
            const pred = w2Pick.predictions[game.id];
            if (pred) w2Total += (Number(pred.team1) || 0) + (Number(pred.team2) || 0);
          });
          totals[pick.playerName].week2 = w2Total;
        }
        
        // Week 1 (Wild Card)
        const w1Pick = allPicks.find(p => p.playerName === pick.playerName && p.week === 'wildcard');
        if (w1Pick && w1Pick.predictions) {
          let w1Total = 0;
          PLAYOFF_WEEKS.wildcard.games.forEach(game => {
            const pred = w1Pick.predictions[game.id];
            if (pred) w1Total += (Number(pred.team1) || 0) + (Number(pred.team2) || 0);
          });
          totals[pick.playerName].week1 = w1Total;
        }
        
        // Grand Total
        totals[pick.playerName].grand = 
          totals[pick.playerName].week1 + 
          totals[pick.playerName].week2 + 
          totals[pick.playerName].week3 + 
          totals[pick.playerName].week4;
      }
    });
    
    return totals;
  }, [allPicks, currentWeek]);

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
            </button>
            <button
              className={`nav-btn ${currentView === 'standings' ? 'active' : ''}`}
              onClick={() => setCurrentView('standings')}
            >
              🏆 Standings & Prizes
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
            onLogout={() => {
              setCodeValidated(false);
              setPlayerCode('');
              setPlayerName('');
              setPredictions({});
              setCurrentView('picks'); // Go back to picks view
            }}
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
                onClick={() => {
                  setCodeValidated(false);
                  setPlayerCode('');
                  setPlayerName('');
                  setPredictions({});
                }}
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
                <h2>Enter Your Predictions</h2>
              )}
              
              {/* Progress Indicator */}
              <div className="progress-indicator">
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px'}}>
                  <strong>Progress:</strong>
                  <span>
                    {Object.keys(predictions).filter(gameId => predictions[gameId].team1 && predictions[gameId].team2).length} 
                    {' of '} 
                    {currentWeekData.games.length} games completed
                  </span>
                </div>
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{
                      width: `${(Object.keys(predictions).filter(gameId => 
                        predictions[gameId].team1 && predictions[gameId].team2
                      ).length / currentWeekData.games.length) * 100}%`
                    }}
                  >
                    {Math.round((Object.keys(predictions).filter(gameId => 
                      predictions[gameId].team1 && predictions[gameId].team2
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
                          <span className="team-name-label">{game.team1}</span>
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
                          <span className="team-name-label">{game.team2}</span>
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

                <button 
                  type="submit" 
                  className="submit-btn"
                  disabled={overrideAction === 'manual' ? false : (!isSubmissionAllowed() || isWeekLocked(currentWeek))}
                  style={overrideAction === 'manual' ? {
                    background: '#e74c3c',
                    fontSize: '1.1rem',
                    fontWeight: '700'
                  } : {}}
                >
                  {overrideAction === 'manual' 
                    ? `⚡ Submit for ${PLAYER_CODES[selectedPlayerForOverride]}`
                    : isWeekLocked(currentWeek) && !isPoolManager()
                      ? '🔒 Week Locked - Cannot Edit Picks'
                      : isSubmissionAllowed() 
                        ? '📤 Submit / Update My Picks' 
                        : '⛔ Submissions Locked (Playoff Weekend)'}
                </button>
                
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
              📱 Mobile: Open with Google Sheets (free app)
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
                        <small>{game.team1} @ {game.team2}</small>
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
                          <div style={{fontSize: '0.8rem', color: '#666', marginTop: '3px'}}>
                            {teamCodes[currentWeek][game.id].team1 || '?'} @ {teamCodes[currentWeek][game.id].team2 || '?'}
                          </div>
                        )}
                      </th>
                    ))}
                    {currentWeek === 'superbowl' ? (
                      <>
                        <th rowSpan="2" style={{backgroundColor: '#fff3cd', fontWeight: 'bold', color: '#000'}}>
                          {/* Official Total Input at top */}
                          {isPoolManager() ? (
                            <div style={{marginBottom: '8px'}}>
                              <div style={{fontSize: '0.7rem', marginBottom: '4px', color: '#000'}}>OFFICIAL</div>
                              <input
                                type="number"
                                min="0"
                                value={manualWeekTotals.superbowl_week4 || ''}
                                onChange={(e) => handleManualTotalChange('superbowl_week4', e.target.value)}
                                placeholder="-"
                                style={{
                                  width: '60px',
                                  padding: '4px',
                                  textAlign: 'center',
                                  fontSize: '1rem',
                                  fontWeight: 'bold',
                                  border: '2px solid #f39c12',
                                  borderRadius: '4px',
                                  color: '#000'
                                }}
                              />
                            </div>
                          ) : (
                            <div style={{marginBottom: '8px'}}>
                              <div style={{fontSize: '0.7rem', color: '#000', marginBottom: '2px'}}>Official</div>
                              <div style={{fontSize: '1rem', fontWeight: 'bold', color: '#d63031'}}>
                                {manualWeekTotals.superbowl_week4 || '-'}
                              </div>
                            </div>
                          )}
                          Week 4<br/>Total
                        </th>
                        <th rowSpan="2" style={{backgroundColor: '#d1ecf1', fontWeight: 'bold', color: '#000'}}>
                          {/* Official Total Input at top */}
                          {isPoolManager() ? (
                            <div style={{marginBottom: '8px'}}>
                              <div style={{fontSize: '0.7rem', marginBottom: '4px', color: '#000'}}>OFFICIAL</div>
                              <input
                                type="number"
                                min="0"
                                value={manualWeekTotals.superbowl_week3 || ''}
                                onChange={(e) => handleManualTotalChange('superbowl_week3', e.target.value)}
                                placeholder="-"
                                style={{
                                  width: '60px',
                                  padding: '4px',
                                  textAlign: 'center',
                                  fontSize: '1rem',
                                  fontWeight: 'bold',
                                  border: '2px solid #f39c12',
                                  borderRadius: '4px',
                                  color: '#000'
                                }}
                              />
                            </div>
                          ) : (
                            <div style={{marginBottom: '8px'}}>
                              <div style={{fontSize: '0.7rem', color: '#000', marginBottom: '2px'}}>Official</div>
                              <div style={{fontSize: '1rem', fontWeight: 'bold', color: '#d63031'}}>
                                {manualWeekTotals.superbowl_week3 || '-'}
                              </div>
                            </div>
                          )}
                          Week 3<br/>Total
                        </th>
                        <th rowSpan="2" style={{backgroundColor: '#d4edda', fontWeight: 'bold', color: '#000'}}>
                          {/* Official Total Input at top */}
                          {isPoolManager() ? (
                            <div style={{marginBottom: '8px'}}>
                              <div style={{fontSize: '0.7rem', marginBottom: '4px', color: '#000'}}>OFFICIAL</div>
                              <input
                                type="number"
                                min="0"
                                value={manualWeekTotals.superbowl_week2 || ''}
                                onChange={(e) => handleManualTotalChange('superbowl_week2', e.target.value)}
                                placeholder="-"
                                style={{
                                  width: '60px',
                                  padding: '4px',
                                  textAlign: 'center',
                                  fontSize: '1rem',
                                  fontWeight: 'bold',
                                  border: '2px solid #f39c12',
                                  borderRadius: '4px',
                                  color: '#000'
                                }}
                              />
                            </div>
                          ) : (
                            <div style={{marginBottom: '8px'}}>
                              <div style={{fontSize: '0.7rem', color: '#000', marginBottom: '2px'}}>Official</div>
                              <div style={{fontSize: '1rem', fontWeight: 'bold', color: '#d63031'}}>
                                {manualWeekTotals.superbowl_week2 || '-'}
                              </div>
                            </div>
                          )}
                          Week 2<br/>Total
                        </th>
                        <th rowSpan="2" style={{backgroundColor: '#f8d7da', fontWeight: 'bold', color: '#000'}}>
                          {/* Official Total Input at top */}
                          {isPoolManager() ? (
                            <div style={{marginBottom: '8px'}}>
                              <div style={{fontSize: '0.7rem', marginBottom: '4px', color: '#000'}}>OFFICIAL</div>
                              <input
                                type="number"
                                min="0"
                                value={manualWeekTotals.superbowl_week1 || ''}
                                onChange={(e) => handleManualTotalChange('superbowl_week1', e.target.value)}
                                placeholder="-"
                                style={{
                                  width: '60px',
                                  padding: '4px',
                                  textAlign: 'center',
                                  fontSize: '1rem',
                                  fontWeight: 'bold',
                                  border: '2px solid #f39c12',
                                  borderRadius: '4px',
                                  color: '#000'
                                }}
                              />
                            </div>
                          ) : (
                            <div style={{marginBottom: '8px'}}>
                              <div style={{fontSize: '0.7rem', color: '#000', marginBottom: '2px'}}>Official</div>
                              <div style={{fontSize: '1rem', fontWeight: 'bold', color: '#d63031'}}>
                                {manualWeekTotals.superbowl_week1 || '-'}
                              </div>
                            </div>
                          )}
                          Week 1<br/>Total
                        </th>
                        <th rowSpan="2" className="grand-total">
                          {/* Official Total Input at top */}
                          {isPoolManager() ? (
                            <div style={{marginBottom: '8px'}}>
                              <div style={{fontSize: '0.7rem', marginBottom: '4px', color: '#fff'}}>OFFICIAL</div>
                              <input
                                type="number"
                                min="0"
                                value={manualWeekTotals.superbowl_grand || ''}
                                onChange={(e) => handleManualTotalChange('superbowl_grand', e.target.value)}
                                placeholder="-"
                                style={{
                                  width: '70px',
                                  padding: '4px',
                                  textAlign: 'center',
                                  fontSize: '1.1rem',
                                  fontWeight: 'bold',
                                  border: '3px solid #f39c12',
                                  borderRadius: '4px',
                                  backgroundColor: '#fff',
                                  color: '#000'
                                }}
                              />
                            </div>
                          ) : (
                            <div style={{marginBottom: '8px'}}>
                              <div style={{fontSize: '0.7rem', color: '#fff', marginBottom: '2px'}}>Official</div>
                              <div style={{fontSize: '1.2rem', fontWeight: 'bold', color: '#fff'}}>
                                {manualWeekTotals.superbowl_grand || '-'}
                              </div>
                            </div>
                          )}
                          GRAND<br/>TOTAL
                        </th>
                      </>
                    ) : (
                      <th rowSpan="2" style={{backgroundColor: '#f8f9fa', fontWeight: 'bold', color: '#000'}}>
                        {/* Official Total Input at top */}
                        {isPoolManager() ? (
                          <div style={{marginBottom: '8px'}}>
                            <div style={{fontSize: '0.7rem', marginBottom: '4px', color: '#000'}}>OFFICIAL</div>
                            <input
                              type="number"
                              min="0"
                              value={manualWeekTotals[currentWeek] || ''}
                              onChange={(e) => handleManualTotalChange(currentWeek, e.target.value)}
                              placeholder="-"
                              style={{
                                width: '60px',
                                padding: '4px',
                                textAlign: 'center',
                                fontSize: '1rem',
                                fontWeight: 'bold',
                                border: '2px solid #f39c12',
                                borderRadius: '4px',
                                color: '#000'
                              }}
                            />
                          </div>
                        ) : (
                          <div style={{marginBottom: '8px'}}>
                            <div style={{fontSize: '0.7rem', color: '#000', marginBottom: '2px'}}>Official</div>
                            <div style={{fontSize: '1rem', fontWeight: 'bold', color: '#d63031'}}>
                              {manualWeekTotals[currentWeek] || '-'}
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
                            const isCorrect = hasCorrectPrediction(game.id);
                            return (
                              <React.Fragment key={`${idx}-${game.id}`}>
                                <td className={`score ${isCorrect ? 'score-winner' : ''}`}>
                                  {pick.predictions[game.id]?.team1 || '-'}
                                </td>
                                <td className={`score ${isCorrect ? 'score-winner' : ''}`}>
                                  {pick.predictions[game.id]?.team2 || '-'}
                                </td>
                              </React.Fragment>
                            );
                          })}
                          
                          {/* Total Points Columns */}
                          {currentWeek === 'superbowl' ? (
                            <>
                              <td style={{backgroundColor: '#fff3cd', fontWeight: 'bold', fontSize: '16px'}}>
                                <span style={{color: '#000'}}>{playerTotals[pick.playerName]?.week4 || 0}</span>
                              </td>
                              <td style={{backgroundColor: '#d1ecf1', fontWeight: 'bold', fontSize: '16px'}}>
                                <span style={{color: '#000'}}>{playerTotals[pick.playerName]?.week3 || 0}</span>
                              </td>
                              <td style={{backgroundColor: '#d4edda', fontWeight: 'bold', fontSize: '16px'}}>
                                <span style={{color: '#000'}}>{playerTotals[pick.playerName]?.week2 || 0}</span>
                              </td>
                              <td style={{backgroundColor: '#f8d7da', fontWeight: 'bold', fontSize: '16px'}}>
                                <span style={{color: '#000'}}>{playerTotals[pick.playerName]?.week1 || 0}</span>
                              </td>
                              <td className="grand-total">
                                {playerTotals[pick.playerName]?.grand || 0}
                              </td>
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
                              minute: '2-digit'
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
            <div style={{marginTop: '60px'}}>
              <LeaderDisplay
                allPicks={allPicks}
                actualScores={actualScores}
                games={PLAYOFF_WEEKS}
                officialWinners={officialWinners}
                weekData={PLAYOFF_WEEKS}
              />
            </div>
          )}

          {/* 🆕 STEP 5: Winner Declaration - Pool Manager Only */}
          {codeValidated && isPoolManager() && (
            <div style={{marginTop: '40px'}}>
              <WinnerDeclaration
                allPicks={allPicks}
                actualScores={actualScores}
                games={PLAYOFF_WEEKS}
                officialWinners={officialWinners}
                onDeclareWinner={handleDeclareWinner}
                isPoolManager={true}
              />
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
