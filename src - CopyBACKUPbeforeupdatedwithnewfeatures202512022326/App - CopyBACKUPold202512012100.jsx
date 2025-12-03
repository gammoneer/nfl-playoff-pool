import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, push, onValue, set } from 'firebase/database';
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
  NoChangesInfo
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
    games: [
      { id: 7, team1: "AFC Winner 1", team2: "AFC #1" },
      { id: 8, team1: "AFC Winner 2", team2: "AFC Winner 3" },
      { id: 9, team1: "NFC Winner 1", team2: "NFC #1" },
      { id: 10, team1: "NFC Winner 2", team2: "NFC Winner 3" }
    ]
  },
  conference: {
    name: "Conference Championships (Jan 25, 2026)",
    games: [
      { id: 11, team1: "AFC Winner A", team2: "AFC Winner B" },
      { id: 12, team1: "NFC Winner A", team2: "NFC Winner B" }
    ]
  },
  superbowl: {
    name: "Super Bowl LIX (Feb 8, 2026)",
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


  // Check if current user is Pool Manager
  const isPoolManager = () => {
    return POOL_MANAGER_CODES.includes(playerCode) && codeValidated;
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
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // 🔒 FIX #1: Check if week is locked
    if (isWeekLocked(currentWeek)) {
      alert('🔒 WEEK LOCKED\n\nThis week\'s games have been played.\nPicks are permanently locked.\n\nYou can view your picks but cannot edit them.\n\nPlease select a different week to make picks.');
      return;
    }
    
    if (!isSubmissionAllowed()) {
      const now = new Date();
      const pstTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
      const playoffStart = new Date(PLAYOFF_SEASON.firstFriday + 'T00:00:00');
      
      if (pstTime < playoffStart) {
        // Should never happen, but just in case
        alert('⛔ SUBMISSIONS CLOSED\n\nPicks are currently locked.\n\nPlease contact the pool manager for assistance.');
      } else {
        alert('⛔ SUBMISSIONS CLOSED\n\nDuring playoff weekends, picks are locked from:\n• Friday 11:59 PM PST\n• Through Monday 12:01 AM PST\n\nPicks will reopen Monday at 12:01 AM PST.\n\nYou have all week to make your picks!');
      }
      return;
    }

    const currentWeekData = PLAYOFF_WEEKS[currentWeek];
    const requiredGames = currentWeekData.games.length;
    const submittedGames = Object.keys(predictions).filter(gameId => 
      predictions[gameId].team1 && predictions[gameId].team2
    ).length;

    if (submittedGames < requiredGames) {
      alert(`Please complete all ${requiredGames} games before submitting!\n\nYou've completed ${submittedGames} of ${requiredGames} games.`);
      return;
    }

    // Check if player already has picks for this week
    const existingPick = allPicks.find(
      pick => pick.playerName === playerName && pick.week === currentWeek
    );

    const pickData = {
      playerName,
      week: currentWeek,
      predictions,
      timestamp: existingPick ? existingPick.timestamp : Date.now(),
      lastUpdated: Date.now()
    };

    try {
      if (existingPick) {
        // Update existing pick
        await set(ref(database, `picks/${existingPick.firebaseKey}`), pickData);
        alert(`✅ PICKS UPDATED!\n\n${playerName}, your picks for ${currentWeekData.name} have been updated successfully!\n\nYou can edit and resubmit anytime except during playoff weekends (Friday 11:59 PM - Monday 12:01 AM PST).`);
      } else {
        // Add new pick
        await push(ref(database, 'picks'), pickData);
        alert(`🎉 PICKS SUBMITTED!\n\n${playerName}, your picks for ${currentWeekData.name} have been submitted successfully!\n\nYou can edit and resubmit anytime except during playoff weekends (Friday 11:59 PM - Monday 12:01 AM PST).`);
      }
      
      setSubmitted(true);
      
      // Scroll to show the picks table
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
          <p style={{fontSize: '0.8rem', marginTop: '10px', color: '#000'}}>
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

        {/* Week Selector */}
        <div className="week-selector">
          {Object.keys(PLAYOFF_WEEKS).map(weekKey => {
            const isLocked = isWeekLocked(weekKey);
            return (
              <button
                key={weekKey}
                className={currentWeek === weekKey ? 'active' : ''}
                onClick={() => setCurrentWeek(weekKey)}
                style={{
                  position: 'relative',
                  opacity: isLocked && !isPoolManager() ? 0.7 : 1
                }}
              >
                {PLAYOFF_WEEKS[weekKey].name.split(' ')[0] + (weekKey === 'superbowl' ? ' Bowl' : '')}
                {isLocked && !isPoolManager() && (
                  <span style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    fontSize: '0.8rem'
                  }}>🔒</span>
                )}
              </button>
            );
          })}
        </div>
        
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
          />
        ) : (
          <>
        {/* Code Entry */}
        {!codeValidated ? (        
          <div className="prediction-form">
            <div className="code-entry-section">
              <h3>🔐 Enter Your Player Code</h3>
              <p style={{marginBottom: '20px', color: '#666'}}>
                You received a 6-character code when you paid your entry fee.
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
                🔄 Enter Different Code
              </button>
            </div>

            {/* Lockout Warning */}
            {!isSubmissionAllowed() && (
              <div className="closed-warning">
                ⛔ PICKS ARE LOCKED (Playoff Weekend: Friday 11:59 PM - Monday 12:01 AM PST)
              </div>
            )}

            {/* Prediction Form */}
            <div className="prediction-form">
              <h2>Enter Your Predictions</h2>
              
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

              <form onSubmit={handleSubmit}>
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
                        padding: '8px 12px',
                        background: '#e8f5e9',
                        borderRadius: '4px',
                        marginBottom: '10px',
                        fontSize: '0.9rem'
                      }}>
                        <strong>Actual Score:</strong> {actualScores[currentWeek][game.id].team1 || '-'} - {actualScores[currentWeek][game.id].team2 || '-'}
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
                  disabled={!isSubmissionAllowed() || isWeekLocked(currentWeek)}
                >
                  {isWeekLocked(currentWeek) && !isPoolManager()
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
              📥 Download to Excel
            </button>
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
                  
                  {/* ACTUAL SCORES ROW - 🔧 FIX #2: Changed white text to black */}
                  <tr style={{background: '#e3f2fd'}}>
                    {currentWeekData.games.map(game => (
                      <React.Fragment key={`actual-${game.id}`}>
                        <th style={{padding: '8px 4px', background: '#e3f2fd'}}>
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
                                  color: '#000'
                                }}
                              />
                              <div style={{fontSize: '0.7rem', marginTop: '2px', color: '#000'}}>ACTUAL</div>
                            </div>
                          ) : (
                            <div>
                              <div style={{fontSize: '1rem', fontWeight: 'bold', color: '#000'}}>
                                {actualScores[currentWeek]?.[game.id]?.team1 || '-'}
                              </div>
                              <div style={{fontSize: '0.7rem', color: '#000'}}>ACTUAL</div>
                            </div>
                          )}
                        </th>
                        <th style={{padding: '8px 4px', background: '#e3f2fd'}}>
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
                                  color: '#000'
                                }}
                              />
                              <div style={{fontSize: '0.7rem', marginTop: '2px', color: '#000'}}>ACTUAL</div>
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
                              <div style={{fontSize: '1rem', fontWeight: 'bold', color: '#000'}}>
                                {actualScores[currentWeek]?.[game.id]?.team2 || '-'}
                              </div>
                              <div style={{fontSize: '0.7rem', color: '#000'}}>ACTUAL</div>
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
