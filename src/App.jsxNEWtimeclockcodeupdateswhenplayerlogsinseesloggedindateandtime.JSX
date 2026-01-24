import React, { useState, useEffect, useMemo, useRef } from 'react';
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
import LoginLogsViewer from './LoginLogsViewer';
import { logSuccessfulLogin, logFailedLogin } from './loginLogging';
import { 
  calculateWeekPrize1, 
  calculateWeekPrize2,
  calculateWeek4Prize1,
  calculateWeek4Prize2,
  calculateGrandPrize1,
  calculateGrandPrize2
} from './winnerCalculations';
import HowWinnersAreDetermined from './HowWinnersAreDetermined';
import './HowWinnersAreDetermined.css';
import PlayoffTeamsSetup from './PlayoffTeamsSetup';
import './PlayoffTeamsSetup.css';
import PaymentManagement from './PaymentManagement';
import RNGAlert from './RNGAlert';

// In useEffect after loading data:
// const result = calculateWeekPrize2(allPicks, actualScores, 'wildcard');
// console.log('Week 1 Prize #2:', result);

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
  "76BB89": "POOL MANAGER - Richard",
  "Z9Y8X7": "POOL MANAGER - Dennis",
  "J239W4": "Bob Casson",
  "B7Y4X3": "Bob Desrosiers",
  "PG3MR8": "Bob Pich",
  "D4F7G5": "Bonnie Biletski",
  "536EE2": "Brian Colburg",
  "X8HH67": "Chris Neufeld",
  "W2FD56": "Colin Pich",
  "4HX33H": "Corey Denham",
  "G7R3P5": "Curtis Braun",
  "A4LJC9": "Curtis Palidwor",
  "X3P8N1": "Dallas Pylypow",
  "W32R1Z": "Daniel Bennett",
  "HM8T67": "Darrell Klassen",
  "TA89R2": "Dave Boyarski",
  "K2P9W5": "Dave Desrosiers",
  "A5K4T7": "Dennis Biletski",
  "6WRUJR": "Emily Chadwick",
  "AB6C89": "Gareth Reeve",
  "6FSH6G": "Harold Braun",
  "XX87CW": "Ian Pich",
  "D3F6G9": "Jarrod Reimer",
  "T42B67": "Jo Behr",
  "PUEFKF": "Joshua Biletski",
  "ABC378": "Ken Mcleod",
  "K9R3N6": "Kevin Pich",
  "H7P3N5": "Larry Bretecher",
  "B5R4T6": "Larry Strand",
  "BSSWRR": "Marcus Degenhardt",
  "72GG3D": "Mark Lang TSBC?",
  "2Q93DB": "Michael Pilato",
  "L2W9X2": "Michelle Desrosiers",
  "5GGPL3": "Mike Brkich",
  "PC12L3": "Natasha Biletski",
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
  "MX8A7H": "Tim Gunness",
  "E5G7G8": "Tony Creta",
  "WXY324": "Travis Biletski",
  "KD2RD2": "Travis McKillop",
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
      { id: 5, team1: "AFC #7", team2: "AFC #2" },
      { id: 3, team1: "AFC #6", team2: "AFC #3" },
      { id: 6, team1: "AFC #5", team2: "AFC #4" },
      { id: 2, team1: "NFC #7", team2: "NFC #2" },
      { id: 4, team1: "NFC #6", team2: "NFC #3" },
      { id: 1, team1: "NFC #5", team2: "NFC #4" }
    ]
  },
  divisional: {
    name: "Divisional Round (Jan 17-18, 2026)",
    deadline: "Friday, January 16, 2026 at 11:59 PM PST",
    games: [
      { id: 7, team1: "BUF", team2: "DEN" },  // BUF @ DEN - Saturday 1:30 PM PST
      { id: 8, team1: "SF", team2: "SEA" },   // SF @ SEA - Saturday 5:00 PM PST
      { id: 9, team1: "HOU", team2: "NE" },   // HOU @ NE - Sunday 12:00 PM PST
      { id: 10, team1: "LAR", team2: "CHI" }  // LAR @ CHI - Sunday 3:30 PM PST
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

/**
 * Get real team name from playoff teams configuration
 * Falls back to placeholder if not configured yet
 * Handles enhanced display like "KC (AFC #1)" or "BUF (Game #1 Winner)"
 */
const getTeamName = (week, gameId, teamPosition, playoffTeams) => {
  // If playoff teams not configured, return placeholder
  if (!playoffTeams?.week1?.configured) {
    const game = PLAYOFF_WEEKS[week].games.find(g => g.id === gameId);
    return game ? game[teamPosition] : `Team ${teamPosition}`;
  }

  // Week 1 - Wild Card
  if (week === 'wildcard') {
    const game = PLAYOFF_WEEKS.wildcard.games.find(g => g.id === gameId);
    if (!game) return 'TBD';
    
    const placeholder = game[teamPosition];
    const match = placeholder.match(/(AFC|NFC) #(\d)/);
    if (match) {
      const conference = match[1].toLowerCase();
      const seed = parseInt(match[2]);
      const team = playoffTeams.week1[conference][`seed${seed}`];
      if (team) {
        return `${team.name} (${placeholder})`;
      }
    }
    return placeholder;
  }

  // Week 2 - Divisional
  if (week === 'divisional') {
    const game = PLAYOFF_WEEKS.divisional.games.find(g => g.id === gameId);
    if (!game) return 'TBD';
    
    const placeholder = game[teamPosition];
    
    if (playoffTeams?.week2) {
      let actualTeam = null;
      
      if (gameId === 7) actualTeam = playoffTeams.week2.afc[0][teamPosition];
      else if (gameId === 8) actualTeam = playoffTeams.week2.afc[1][teamPosition];
      else if (gameId === 9) actualTeam = playoffTeams.week2.nfc[0][teamPosition];
      else if (gameId === 10) actualTeam = playoffTeams.week2.nfc[1][teamPosition];
      
      if (actualTeam) {
        return `${actualTeam.name} (${placeholder})`;
      }
    }
    
    return placeholder;
  }

  // Week 3 - Conference Championships
  if (week === 'conference') {
    const game = PLAYOFF_WEEKS.conference.games.find(g => g.id === gameId);
    if (!game) return 'TBD';
    
    const placeholder = game[teamPosition];
    
    if (playoffTeams?.week3) {
      let actualTeam = null;
      
      if (gameId === 11) actualTeam = playoffTeams.week3.afcChampionship[teamPosition];
      else if (gameId === 12) actualTeam = playoffTeams.week3.nfcChampionship[teamPosition];
      
      if (actualTeam) {
        return `${actualTeam.name} (${placeholder})`;
      }
    }
    
    return placeholder;
  }

  // Week 4 - Super Bowl
  if (week === 'superbowl') {
    const game = PLAYOFF_WEEKS.superbowl.games.find(g => g.id === gameId);
    if (!game) return 'TBD';
    
    const placeholder = game[teamPosition];
    
    if (playoffTeams?.week4) {
      const actualTeam = playoffTeams.week4.superBowl[teamPosition];
      if (actualTeam) {
        return `${actualTeam.name} (${placeholder})`;
      }
    }
    
    return placeholder;
  }

  return 'TBD';
};

// ============================================
// 📊 NFL 2025 REGULAR SEASON SCORING DATA
// ============================================
// Data from 2025 NFL Regular Season
// Shows how many times each score was recorded by Visiting and Home teams
const NFL_2025_SCORING_DATA = [
  { score: 3, visitor: 2, home: 3 },
  { score: 6, visitor: 8, home: 3 },
  { score: 7, visitor: 3, home: 4 },
  { score: 8, visitor: 2, home: 1 },
  { score: 9, visitor: 7, home: 4 },
  { score: 10, visitor: 14, home: 12 },
  { score: 11, visitor: 1, home: 0 },
  { score: 12, visitor: 2, home: 3 },
  { score: 13, visitor: 14, home: 10 },
  { score: 14, visitor: 5, home: 8 },
  { score: 15, visitor: 2, home: 4 },
  { score: 16, visitor: 9, home: 7 },
  { score: 17, visitor: 11, home: 13 },
  { score: 18, visitor: 2, home: 4 },
  { score: 19, visitor: 5, home: 9 },
  { score: 20, visitor: 19, home: 25 },
  { score: 21, visitor: 10, home: 13 },
  { score: 22, visitor: 8, home: 6 },
  { score: 23, visitor: 13, home: 9 },
  { score: 24, visitor: 23, home: 11 },
  { score: 25, visitor: 2, home: 5 },
  { score: 26, visitor: 12, home: 10 },
  { score: 27, visitor: 19, home: 19 },
  { score: 28, visitor: 7, home: 8 },
  { score: 29, visitor: 5, home: 6 },
  { score: 30, visitor: 7, home: 6 },
  { score: 31, visitor: 17, home: 6 },
  { score: 32, visitor: 3, home: 3 },
  { score: 33, visitor: 6, home: 3 },
  { score: 34, visitor: 7, home: 12 },
  { score: 35, visitor: 2, home: 3 },
  { score: 36, visitor: 0, home: 2 },
  { score: 37, visitor: 5, home: 4 },
  { score: 38, visitor: 5, home: 4 },
  { score: 39, visitor: 1, home: 1 },
  { score: 40, visitor: 4, home: 4 },
  { score: 41, visitor: 3, home: 5 },
  { score: 42, visitor: 2, home: 3 },
  { score: 43, visitor: 0, home: 0 },
  { score: 44, visitor: 2, home: 6 },
  { score: 45, visitor: 2, home: 0 },
  { score: 46, visitor: 0, home: 0 },
  { score: 47, visitor: 1, home: 0 },
  { score: 48, visitor: 1, home: 2 },
  { score: 49, visitor: 0, home: 0 },
  { score: 50, visitor: 0, home: 0 },
  { score: 51, visitor: 0, home: 0 },
  { score: 52, visitor: 0, home: 1 }
].map(item => ({
  ...item,
  total: item.visitor + item.home,
  frequency: item.visitor + item.home >= 30 ? 'very-common' :
             item.visitor + item.home >= 15 ? 'common' :
             item.visitor + item.home >= 5 ? 'less-common' : 'rare'
}));

// 🕐 PST TIME HELPER FUNCTIONS (for timezone clock)
const getPSTTime = () => {
  const now = new Date();
  const pstTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Los_Angeles"}));
  return pstTime;
};

const formatPSTTimestamp = (timestamp) => {
  const date = new Date(timestamp);
  const options = {
    timeZone: 'America/Los_Angeles',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  };
  return date.toLocaleString('en-US', options) + ' PST';
};

const getDeadline = () => {
  const pst = getPSTTime();
  const dayOfWeek = pst.getDay(); // 0=Sun, 5=Fri
  
  // Find next Friday 11:59 PM PST
  let daysUntilFriday = (5 - dayOfWeek + 7) % 7;
  if (dayOfWeek === 5 && pst.getHours() >= 23 && pst.getMinutes() >= 59) {
    daysUntilFriday = 7; // Next Friday
  }
  if (daysUntilFriday === 0 && (pst.getHours() < 23 || (pst.getHours() === 23 && pst.getMinutes() < 59))) {
    daysUntilFriday = 0; // This Friday
  }
  
  const deadline = new Date(pst);
  deadline.setDate(deadline.getDate() + daysUntilFriday);
  deadline.setHours(23, 59, 59, 999);
  return deadline;
};

const getTimeRemaining = () => {
  const now = getPSTTime();
  const deadline = getDeadline();
  const diff = deadline - now;
  
  if (diff <= 0) return { expired: true, hours: 0, minutes: 0, seconds: 0, formatted: '00:00:00' };
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  return {
    expired: false,
    hours: hours,
    minutes: minutes,
    seconds: seconds,
    formatted: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  };
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
  const [showScoreAnalysis, setShowScoreAnalysis] = useState(false);
  const [selectedAnalysisGame, setSelectedAnalysisGame] = useState(1);
  const [analysisSort, setAnalysisSort] = useState('asc');
  
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
  const [calculatedWinners, setCalculatedWinners] = useState({});
  const [publishedWinners, setPublishedWinners] = useState({});
  // Playoff Teams Configuration
  const [playoffTeams, setPlayoffTeams] = useState({});
  const [showWinnersPage, setShowWinnersPage] = useState(false);

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
  
  // Sorting state for player tables
  const [sortColumn, setSortColumn] = useState(null); // 'correct' or 'difference'
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' or 'desc'
  const [lastESPNFetch, setLastESPNFetch] = useState(null);
  
  // NFL Scoring Guide modal state
  const [showScoringGuide, setShowScoringGuide] = useState(false);

  // 🕐 PST CLOCK STATE
  const [pstTime, setPstTime] = useState(getPSTTime());
  const [timeRemaining, setTimeRemaining] = useState(getTimeRemaining());
  const [showPSTClock, setShowPSTClock] = useState(false);

  // ============================================
  // 🆕 STEP 5: COMPLETE FEATURE STATE
  // ============================================
  
  // Validation & Navigation State
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showPopup, setShowPopup] = useState(null);
  const [pendingWeekChange, setPendingWeekChange] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false); // For refresh button feedback
  const [missingGames, setMissingGames] = useState([]);
  const [invalidScores, setInvalidScores] = useState([]);
  
  // Official Winners (Pool Manager only)
  const [officialWinners, setOfficialWinners] = useState({});
  // ✅ NEW: Track which weeks are manually completed by Pool Manager
  const [weekCompletionStatus, setWeekCompletionStatus] = useState(null);
  
  // 💰 PRIZE POOL SETUP (Phase 2)
  const [prizePool, setPrizePool] = useState({
    totalFees: 0,
    prizeValue: 0,
    numberOfPlayers: 0,
    entryFee: 20,
    perfectScoreBonusEnabled: false,
    perfectScorePrizeType: 'dollar', // 'dollar' or 'percentage'
    perfectScorePrizeAmount: 0,
    perfectScoreCutoff: 30
  });
  const [showPrizePoolSetup, setShowPrizePoolSetup] = useState(false);
  
  // 🏆 ENHANCED WINNER DECLARATION (Phase 2)
  // Winner declaration state variables removed - now handled by WinnerDeclaration component
  // Note: weekCompletionStatus already declared at line 450 - using that one
  
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
  
  // 🎯 PERFECT SCORE FORM STATE (for Prize Pool Setup modal)
  const [perfectScoreBonusEnabled, setPerfectScoreBonusEnabled] = useState(false);
  const [perfectScorePrizeType, setPerfectScorePrizeType] = useState('dollar');
  const [perfectScorePrizeAmount, setPerfectScorePrizeAmount] = useState('');
  const [perfectScoreCutoff, setPerfectScoreCutoff] = useState('');
  
  // 🎲 RNG ALERT STATE (ADD THESE 2 LINES) ⬇️
  const [showRNGAlert, setShowRNGAlert] = useState(true);
  const [rngAlertDismissed, setRngAlertDismissed] = useState(false);
  // 💰 PLAYERS STATE (for payment tracking and eligibility)
  const [allPlayers, setAllPlayers] = useState([]);


  // Check if current user is Pool Manager
  // Check if current user is Pool Manager
  const isPoolManager = () => {
    return POOL_MANAGER_CODES.includes(playerCode) && codeValidated;
  };

  // ============================================
  // 💰 PAYMENT MANAGEMENT FUNCTIONS
  // ============================================

  /**
   * Update player payment information
   */
  const updatePayment = async (playerCode, paymentData) => {
    try {
      const playersRef = ref(database, 'players');
      const snapshot = await get(playersRef);
      
      if (!snapshot.exists()) {
        alert('❌ No players found in database.');
        return;
      }
      
      const allPlayers = snapshot.val();
      let playerKey = null;
      
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
      
      const playerRef = ref(database, `players/${playerKey}`);
      await update(playerRef, {
        paymentStatus: paymentData.status,
        paymentTimestamp: paymentData.timestamp,
        paymentMethod: paymentData.method,
        paymentAmount: paymentData.amount,
        updatedAt: Date.now()
      });
      
      console.log(`✅ Payment updated for ${playerCode}`);
    } catch (error) {
      console.error('Error updating payment:', error);
      alert('❌ Error updating payment. Please try again.');
    }
  };

  /**
   * Toggle player visibility (hide/show from regular players)
   */
  const togglePlayerVisibility = async (playerCode) => {
    try {
      const playersRef = ref(database, 'players');
      const snapshot = await get(playersRef);
      
      if (!snapshot.exists()) {
        alert('❌ No players found in database.');
        return;
      }
      
      const allPlayers = snapshot.val();
      let playerKey = null;
      let currentVisibility = true;
      
      for (const [key, player] of Object.entries(allPlayers)) {
        if (player.playerCode === playerCode) {
          playerKey = key;
          currentVisibility = player.visibleToPlayers !== false;
          break;
        }
      }
      
      if (!playerKey) {
        alert(`❌ Player ${playerCode} not found.`);
        return;
      }
      
      const newVisibility = !currentVisibility;
      const playerRef = ref(database, `players/${playerKey}`);
      await update(playerRef, {
        visibleToPlayers: newVisibility,
        updatedAt: Date.now()
      });
      
      console.log(`✅ Visibility toggled for ${playerCode}: ${newVisibility ? 'VISIBLE' : 'HIDDEN'}`);
      alert(`✅ Player ${currentVisibility ? 'hidden from' : 'shown to'} regular players!`);
    } catch (error) {
      console.error('Error toggling visibility:', error);
      alert('❌ Error updating visibility. Please try again.');
    }
  };

  /**
   * Permanently remove player from system
   */
  const removePlayer = async (playerCode) => {
    try {
      const playersRef = ref(database, 'players');
      const snapshot = await get(playersRef);
      
      if (!snapshot.exists()) {
        alert('❌ No players found in database.');
        return;
      }
      
      const allPlayers = snapshot.val();
      let playerKey = null;
      let playerName = '';
      
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
      
      const playerRef = ref(database, `players/${playerKey}`);
      await remove(playerRef);
      
      console.log(`✅ Player ${playerCode} removed permanently`);
      alert(`✅ ${playerName} has been permanently removed from the system.`);
    } catch (error) {
      console.error('Error removing player:', error);
      alert('❌ Error removing player. Please try again.');
    }
  };

  /**
   * Toggle player's showInPicksTable status
   */
  const toggleTableDisplay = async (playerCode) => {
    try {
      const playersRef = ref(database, 'players');
      const snapshot = await get(playersRef);
      
      if (!snapshot.exists()) {
        alert('❌ No players found in database.');
        return;
      }
      
      const allPlayersData = snapshot.val();
      let playerKey = null;
      let currentStatus = false;
      
      for (const [key, player] of Object.entries(allPlayersData)) {
        if (player.playerCode === playerCode) {
          playerKey = key;
          currentStatus = player.showInPicksTable === true;
          break;
        }
      }
      
      if (!playerKey) {
        alert(`❌ Player ${playerCode} not found.`);
        return;
      }
      
      const newStatus = !currentStatus;
      const playerRef = ref(database, `players/${playerKey}`);
      await update(playerRef, {
        showInPicksTable: newStatus,
        updatedAt: Date.now()
      });
      
      console.log(`✅ Table display toggled for ${playerCode}: ${newStatus ? 'SHOW' : 'HIDE'}`);
    } catch (error) {
      console.error('Error toggling table display:', error);
      alert('❌ Error updating table display. Please try again.');
    }
  };
/**
 * Update player's access code
 */
const updatePlayerCode = async (oldCode, newCode) => {
  try {
    const playersRef = ref(database, 'players');
    const snapshot = await get(playersRef);
    
    if (!snapshot.exists()) {
      alert('❌ No players found in database.');
      return;
    }
    
    const allPlayersData = snapshot.val();
    let playerKey = null;
    let playerName = '';
    
    // Find player by old code
    for (const [key, player] of Object.entries(allPlayersData)) {
      if (player.playerCode === oldCode) {
        playerKey = key;
        playerName = player.playerName;
        break;
      }
    }
    
    if (!playerKey) {
      alert(`❌ Player with code ${oldCode} not found.`);
      return;
    }
    
    // Update the code
    const playerRef = ref(database, `players/${playerKey}`);
    await update(playerRef, {
      playerCode: newCode,
      updatedAt: Date.now()
    });
    
    console.log(`✅ Updated ${playerName}: ${oldCode} → ${newCode}`);
    alert(`✅ Code Updated!\n\nPlayer: ${playerName}\nOld: ${oldCode}\nNew: ${newCode}\n\n📧 Make sure to tell the player their new code!`);
  } catch (error) {
    console.error('Error updating player code:', error);
    alert('❌ Error updating code: ' + error.message);
  }
};
/**
 * Export all Firebase players to Excel/CSV
 */
const exportPlayersToExcel = async () => {
  try {
    const playersRef = ref(database, 'players');
    const snapshot = await get(playersRef);
    
    if (!snapshot.exists()) {
      alert('❌ No players found in database.');
      return;
    }
    
    const players = snapshot.val();
    
    // Convert to array and format for CSV
    const playerArray = Object.entries(players).map(([firebaseKey, player]) => ({
      'Firebase Key': firebaseKey,
      'Player Name': player.playerName || '',
      'Access Code': player.playerCode || '',
      'Role': player.role || 'PLAYER',
      'Payment Status': player.paymentStatus || 'UNPAID',
      'Payment Time': player.paymentTimestamp ? new Date(player.paymentTimestamp).toLocaleString() : '',
      'Payment Method': player.paymentMethod || '',
      'Payment Amount': player.paymentAmount || 0,
      'Visible to Players': player.visibleToPlayers ? 'YES' : 'NO',
      'Show in Picks Table': player.showInPicksTable ? 'YES' : 'NO',
      'Created': player.createdAt ? new Date(player.createdAt).toLocaleString() : '',
      'Last Updated': player.updatedAt ? new Date(player.updatedAt).toLocaleString() : ''
    }));
    
    // Sort by player name
    playerArray.sort((a, b) => a['Player Name'].localeCompare(b['Player Name']));
    
    // Create CSV
    const headers = Object.keys(playerArray[0]);
    const csvContent = [
      headers.join(','),
      ...playerArray.map(row => 
        headers.map(header => {
          const value = row[header].toString();
          // Escape commas and quotes
          return value.includes(',') || value.includes('"') 
            ? `"${value.replace(/"/g, '""')}"` 
            : value;
        }).join(',')
      )
    ].join('\n');
    
    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().split('T')[0];
    
    link.setAttribute('href', url);
    link.setAttribute('download', `NFL_Pool_Players_${timestamp}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    alert(`✅ SUCCESS!\n\nDownloaded ${playerArray.length} players to CSV file!\n\nFile: NFL_Pool_Players_${timestamp}.csv\n\nOpen with Excel or Google Sheets.`);
  } catch (error) {
    console.error('Error exporting players:', error);
    alert('❌ Error exporting players: ' + error.message);
  }
};
  // ============================================
  // ============================================
  // 🎲 RNG ALERT SYSTEM FUNCTIONS
  // ============================================

  /**
   * Apply RNG to all players in list
   */
  const applyRNGToAll = async (playersList) => {
    let successCount = 0;
    let failCount = 0;

    for (const player of playersList) {
      try {
        const weekGames = PLAYOFF_WEEKS[currentWeek].games;
        const rngPredictions = {};
        
        weekGames.forEach(game => {
          rngPredictions[game.id] = generateRNGScore();
        });

        await submitRNGPicksHelper(
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

    setShowRNGAlert(false);
  };

  /**
   * Review each player manually for RNG
   */
  const reviewRNGManually = (playersList) => {
    if (playersList.length === 0) return;

    alert(
      `🔍 Manual Review Mode\n\n` +
      `You can now use the "Pool Manager Override" section to apply RNG to each player:\n\n` +
      playersList.map(p => `• ${p.playerName} (${p.playerCode})`).join('\n')
    );

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
   */
  const submitRNGPicksHelper = async (playerCode, week, predictions, enteredBy = 'PLAYER') => {
    try {
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

      const playerName = PLAYER_CODES[playerCode] || playerCode;

      const pickData = {
        playerCode,
        playerName,
        week,
        predictions,
        timestamp: existingTimestamp,
        lastUpdated: Date.now(),
        enteredBy,
        enteredByCode: playerCode,
        enteredByName: playerName
      };

      if (existingFirebaseKey) {
        await set(ref(database, `picks/${existingFirebaseKey}`), pickData);
      } else {
        await push(ref(database, 'picks'), pickData);
      }

      console.log(`✅ Picks submitted for ${playerCode} (${enteredBy})`);
    } catch (error) {
      console.error('Error submitting picks:', error);
      throw error;
    }
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
   * STATE 0 - NO ACTUAL SCORES YET (predictions only)
    // Show light blue for predicted winner BEFORE games start
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
//  const getCellHighlight = (playerTeam1, playerTeam2, actualTeam1, actualTeam2, gameStatus, isTeam1Cell) => {
    // Determine which team player predicted to win
//    const playerPredictedTeam1 = Number(playerTeam1) > Number(playerTeam2);
//    const playerPredictedTeam2 = Number(playerTeam2) > Number(playerTeam1);
    
    // If player predicted a tie or has no valid prediction, no highlighting
//    if (playerTeam1 === playerTeam2 || !playerTeam1 || !playerTeam2) {
//      return { background: 'transparent', color: '#000' };
//    }

    const getCellHighlight = (playerTeam1, playerTeam2, actualTeam1, actualTeam2, gameStatus, isTeam1Cell) => {
    // Determine which team player predicted to win
    const playerPredictedTeam1 = Number(playerTeam1) > Number(playerTeam2);
    const playerPredictedTeam2 = Number(playerTeam2) > Number(playerTeam1);
    
    // If player predicted a tie or has no valid prediction, no highlighting
    if (playerTeam1 === playerTeam2 || !playerTeam1 || !playerTeam2) {
      return { background: 'transparent', color: '#000' };
    }
    
    // ✅ NEW: STATE 0 - NO ACTUAL SCORES YET (predictions only)
    // Show light blue for predicted winner BEFORE games start
    if (!actualTeam1 && !actualTeam2) {
      if (isTeam1Cell && playerPredictedTeam1) {
        return { background: '#b3e5fc', color: '#000' }; // Light Blue - predicted winner
      }
      if (!isTeam1Cell && playerPredictedTeam2) {
        return { background: '#b3e5fc', color: '#000' }; // Light Blue - predicted winner
      }
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
  const savePrizePool = async (totalFees, numberOfPlayers, entryFee, perfectScoreBonusEnabled, perfectScorePrizeType, perfectScorePrizeAmount, perfectScoreCutoff) => {
    try {
      const prizeValue = totalFees / 10; // Each prize is 10%
      const poolData = {
        totalFees: Number(totalFees),
        prizeValue: Number(prizeValue.toFixed(2)),
        numberOfPlayers: Number(numberOfPlayers),
        entryFee: Number(entryFee),
        perfectScoreBonusEnabled: perfectScoreBonusEnabled || false,
        perfectScorePrizeType: perfectScorePrizeType || 'dollar',
        perfectScorePrizeAmount: perfectScoreBonusEnabled ? Number(perfectScorePrizeAmount) : 0,
        perfectScoreCutoff: perfectScoreBonusEnabled ? Number(perfectScoreCutoff) : 30,
        lastUpdated: new Date().toISOString()
      };
      
      await set(ref(database, 'prizePool'), poolData);
      setPrizePool(poolData);
      
      let message = `✅ Prize pool saved!\n\nTotal Pool: $${totalFees}\nEach Prize: $${prizeValue.toFixed(2)} (10%)`;
      if (perfectScoreBonusEnabled) {
        const actualPrizeAmount = perfectScorePrizeType === 'percentage' 
          ? (totalFees * perfectScorePrizeAmount / 100).toFixed(2)
          : perfectScorePrizeAmount;
        message += `\n\n🎯 Perfect Score Prizes:\nType: ${perfectScorePrizeType === 'percentage' ? perfectScorePrizeAmount + '% of total pool' : 'Fixed amount'}\nPrize Pool: $${actualPrizeAmount}\nCutoff: ${perfectScoreCutoff} perfect scores`;
      }
      alert(message);
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
   * Publish winners for a week - NEW SYSTEM
   */
  const handlePublishWinners = async (weekKey, prizes) => {
    try {
      const publishData = {
        weekKey,
        prizes,
        publishedBy: playerCode,
        publishedByName: playerName,
        publishedAt: new Date().toISOString(),
        published: true
      };

      await set(ref(database, `officialWinners/${weekKey}`), publishData);
      
      // Also update publishedWinners for HowWinnersAreDetermined compatibility
      const weekMapping = {
        'wildcard': 'week1',
        'divisional': 'week2',
        'conference': 'week3',
        'superbowl': 'week4',
        'grand': 'grand'
      };
      const weekName = weekMapping[weekKey];
      
      // Mark prizes as published
      const publishUpdates = {};
      prizes.forEach(prize => {
        const prizeNum = prize.prizeNumber;
        let pubKey;
        if (weekName === 'grand') {
          pubKey = prizeNum === 9 ? 'grand_prize1' : 'grand_prize2';
        } else {
          pubKey = `${weekName}_prize${prizeNum % 2 === 1 ? '1' : '2'}`;
        }
        publishUpdates[pubKey] = true;
      });
      
      // Update publishedWinners in Firebase
      for (const [key, value] of Object.entries(publishUpdates)) {
        await set(ref(database, `publishedWinners/${key}`), value);
      }
      
      alert(`✅ Winners published for ${weekKey}!`);
    } catch (error) {
      console.error('Error publishing winners:', error);
      alert(`❌ Error publishing winners: ${error.message}`);
    }
  };

  /**
   * Unpublish winners for a week - allows editing
   */
  const handleUnpublishWinners = async (weekKey) => {
    try {
      await set(ref(database, `officialWinners/${weekKey}/published`), false);
      
      // Also unpublish in publishedWinners for HowWinnersAreDetermined
      const weekMapping = {
        'wildcard': 'week1',
        'divisional': 'week2',
        'conference': 'week3',
        'superbowl': 'week4',
        'grand': 'grand'
      };
      const weekName = weekMapping[weekKey];
      
      // Get prize numbers for this week
      const prizeNums = weekName === 'grand' ? [9, 10] : 
                        weekName === 'week1' ? [1, 2] :
                        weekName === 'week2' ? [3, 4] :
                        weekName === 'week3' ? [5, 6] : [7, 8];
      
      // Unpublish both prizes for this week
      for (const prizeNum of prizeNums) {
        let pubKey;
        if (weekName === 'grand') {
          pubKey = prizeNum === 9 ? 'grand_prize1' : 'grand_prize2';
        } else {
          pubKey = `${weekName}_prize${prizeNum % 2 === 1 ? '1' : '2'}`;
        }
        await set(ref(database, `publishedWinners/${pubKey}`), false);
      }
      
      alert(`✅ Winners unpublished for ${weekKey}. You can now edit them.`);
    } catch (error) {
      console.error('Error unpublishing winners:', error);
      alert(`❌ Error unpublishing winners: ${error.message}`);
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

  // 🔒 Check if a week should be automatically locked based on date
  // Locks at Friday 11:59 PM (before the games start on Saturday)
  const shouldAutoLock = (weekKey) => {
    const autoLockDate = AUTO_LOCK_DATES[weekKey];
    if (!autoLockDate) return false;
    
    const now = new Date();
    const pstTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    
    // Auto-lock date is Saturday (game day)
    // We want to lock on FRIDAY at 11:59 PM (day before)
    const gameDayDate = new Date(autoLockDate + 'T00:00:00');
    const lockDateTime = new Date(gameDayDate);
    lockDateTime.setDate(lockDateTime.getDate() - 1); // Go back 1 day (Friday)
    lockDateTime.setHours(23, 59, 59, 999); // Set to 11:59:59.999 PM
    
    return pstTime >= lockDateTime;
  };

  // 🔒 NEW: Check if a week is locked (manual lock OR auto lock)
  const isWeekLocked = (weekKey) => {
    // Pool Manager bypasses all locks
    if (isPoolManager()) {
      return false;
    }
    
    // ✅ NEW: Only lock the CURRENT week being played
    // Future weeks are always editable
    if (weekKey !== currentWeek) {
      return false; // Future weeks are never locked!
    }
    
    // For current week: Check manual lock
    if (weekLockStatus[weekKey]?.locked) {
      return true;
    }
    
    // For current week: Check automatic lock based on date
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

  // 🕐 PST CLOCK: Update check (DISABLED updates to prevent dropdown closing)
  useEffect(() => {
    const updateClock = () => {
      const pst = getPSTTime();
      setPstTime(pst);
      setTimeRemaining(getTimeRemaining());
      
      // Determine if clock should show:
      // 1. Only on Fridays (day 5)
      // 2. Between 12:01 AM and 11:59 PM PST
      // 3. Only while playoffs are ongoing (not all weeks completed)
      const dayOfWeek = pst.getDay();
      const isFriday = dayOfWeek === 5;
      
      // Check if all playoff weeks are complete (Super Bowl is final)
      const playoffsComplete = gameStatus?.superbowl && 
        Object.values(gameStatus.superbowl || {}).every(status => status === 'final');
      
      // Show clock only on Fridays during active playoff season
      setShowPSTClock(isFriday && !playoffsComplete);
    };
    
    // Update ONCE on mount only - NO INTERVAL to prevent dropdown closing
    updateClock();
    
    // NO setInterval - commenting out to fix dropdown issue
    // const interval = setInterval(updateClock, 5000);
    // return () => clearInterval(interval);
  }, [gameStatus]);

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

// ✅ NEW: Load week completion status from Firebase
  useEffect(() => {
    console.log('🔄 Setting up weekCompletionStatus listener...');
    console.log('📊 database object:', database);
    console.log('📊 database type:', typeof database);
    
    try {
      const completionRef = ref(database, 'weekCompletionStatus');
      console.log('✅ ref created:', completionRef);
      
      const unsubscribe = onValue(completionRef, (snapshot) => {
        console.log('📥 ===== SNAPSHOT RECEIVED =====');
        const data = snapshot.val();
        console.log('📊 Data from Firebase:', data);
        console.log('📊 Data type:', typeof data);
        
        const finalData = data || {
          wildcard: false,
          divisional: false,
          conference: false,
          superbowl: false
        };
        
        console.log('📊 Final data to set:', finalData);
        setWeekCompletionStatus(finalData);
        console.log('✅ weekCompletionStatus state updated');
      }, (error) => {
        console.error('❌ Firebase listener error:', error);
      });
      
      console.log('✅ Listener attached successfully');
      
      return () => {
        console.log('🧹 Cleaning up listener');
        unsubscribe();
      };
    } catch (error) {
      console.error('❌ Error setting up listener:', error);
    }
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

  // 🏆 Load calculated winners from Firebase
  useEffect(() => {
    const winnersRef = ref(database, 'calculatedWinners');
    onValue(winnersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setCalculatedWinners(data);
      }
    });
  }, []);

  // 📢 Load published winners status from Firebase
  useEffect(() => {
    const publishedRef = ref(database, 'publishedWinners');
    onValue(publishedRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setPublishedWinners(data);
      }
    });
  }, []);

  // 📊 Load playoff teams configuration from Firebase
  useEffect(() => {
    const playoffTeamsRef = ref(database, 'playoffTeams');
    onValue(playoffTeamsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setPlayoffTeams(data);
        console.log('📊 Loaded playoff teams:', data);
      } else {
        setPlayoffTeams({});
      }
    });
  }, []);

  // 📡 Load game locks from Firebase
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
  // 🔥 FIX: Use ref to always call the latest version of handleESPNFetch
  const handleESPNFetchRef = useRef();
  
  useEffect(() => {
    // Wrapper function that always calls the latest handleESPNFetch
    const callESPNFetch = () => {
      if (handleESPNFetchRef.current) {
        handleESPNFetchRef.current();
      }
    };
    
    const autoRefresh = new ESPNAutoRefresh(callESPNFetch, 5);
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
          const newStatus = matchedGame.isFinal ? 'final' : matchedGame.isLive ? 'live' : '';
          
          setGameStatus(prev => ({
            ...prev,
            [currentWeek]: {
              ...prev[currentWeek],
              [gameId]: newStatus
            }
          }));
          
          // Save game status to Firebase
          if (newStatus) {
            set(ref(database, `gameStatus/${currentWeek}/${gameId}`), newStatus);
          }
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
  
  // 🔥 FIX: Update ref to always point to latest handleESPNFetch
  handleESPNFetchRef.current = handleESPNFetch;


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
  // 🐛 FIX: Debounced team code save to prevent dropdown from closing
  const teamCodeSaveTimers = React.useRef({});
  
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
    
    // 🔥 CRITICAL FIX: Also update playoffTeams so players see the correct team names!
    if (currentWeek === 'conference') {
      const teamCode = code.toUpperCase();
      const teamObject = { name: teamCode }; // Save as object with name property
      
      const updatedPlayoffTeams = {
        ...playoffTeams,
        week3: {
          ...(playoffTeams.week3 || {}),
          afcChampionship: gameId === 11 ? {
            ...(playoffTeams.week3?.afcChampionship || {}),
            [team]: teamObject
          } : playoffTeams.week3?.afcChampionship || {},
          nfcChampionship: gameId === 12 ? {
            ...(playoffTeams.week3?.nfcChampionship || {}),
            [team]: teamObject
          } : playoffTeams.week3?.nfcChampionship || {}
        }
      };
      setPlayoffTeams(updatedPlayoffTeams);
      
      // Save playoffTeams to Firebase immediately
      set(ref(database, 'playoffTeams/week3'), updatedPlayoffTeams.week3);
    }
    
    // Clear existing timer for this specific input
    const timerKey = `${currentWeek}-${gameId}-${team}`;
    if (teamCodeSaveTimers.current[timerKey]) {
      clearTimeout(teamCodeSaveTimers.current[timerKey]);
    }
    
    // Save to Firebase after 3 SECONDS of no typing (debounced) - gives time to select from dropdown
    teamCodeSaveTimers.current[timerKey] = setTimeout(() => {
      set(ref(database, `teamCodes/${currentWeek}/${gameId}/${team}`), code.toUpperCase());
    }, 3000);
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

  // ============================================
  // 💰 LOAD PLAYERS FROM FIREBASE
  // ============================================
  useEffect(() => {
    const playersRef = ref(database, 'players');
    const unsubscribe = onValue(playersRef, (snapshot) => {
      if (snapshot.exists()) {
        const playersData = snapshot.val();
        const playersArray = Object.keys(playersData).map(key => ({
          id: key,
          ...playersData[key]
        }));
        
        setAllPlayers(playersArray);
        console.log(`✅ Loaded ${playersArray.length} players from Firebase`);
      } else {
        console.log('ℹ️ No players found in Firebase. Run migration script to create players table.');
        setAllPlayers([]);
      }
    });

    return () => unsubscribe();
  }, []);

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

  // Pool Manager: Publish a prize
  const handlePublishPrize = (prizeKey, prize, result) => {
    console.log('Publishing prize:', prizeKey);
    
    // Update state
    setPublishedWinners(prev => ({
      ...prev,
      [prizeKey]: true
    }));
    
    // Save to Firebase
    set(ref(database, `publishedWinners/${prizeKey}`), true);
    
    alert(`✅ Published: ${prize.title}\n\nWinner: ${result.winner}\n\nPlayers can now see this result!`);
  };

// Pool Manager: Unpublish a prize
  const handleUnpublishPrize = (prizeKey) => {
    const confirmed = window.confirm(
      '⚠️ UNPUBLISH PRIZE?\n\n' +
      'This will hide the winner from all players.\n\n' +
      'Continue?'
    );
    
    if (!confirmed) return;
    
    console.log('Unpublishing prize:', prizeKey);

    // Update state
    setPublishedWinners(prev => ({
      ...prev,
      [prizeKey]: false
    }));
    
    // Save to Firebase
    set(ref(database, `publishedWinners/${prizeKey}`), false);
    
    alert('✅ Prize unpublished successfully!');
  };

  // ✅ NEW: Check if all games for a week are marked FINAL
  const areAllGamesFinal = (weekKey) => {
    console.log('🔍 Checking if all games final for:', weekKey);
    console.log('📊 gameStatus:', gameStatus);
    console.log('📊 gameStatus[weekKey]:', gameStatus[weekKey]);
    
    if (!gameStatus || !gameStatus[weekKey]) {
      console.log('❌ No game status found');
      return false;
    }
     
    const weekStatuses = gameStatus[weekKey];
    const weekGames = PLAYOFF_WEEKS[weekKey]?.games || [];
    
    // Check that we have status for all games in this week
    if (Object.keys(weekStatuses).length < weekGames.length) {
      return false;
    }
    
    // Check that ALL games are marked as 'final'
    return weekGames.every(game => weekStatuses[game.id] === 'final');
  };
  
  // ✅ NEW: Pool Manager closes a week and opens next week for team configuration
const handleCloseWeekAndConfigureNext = async (weekKey) => {
    console.log('🔒 ===== CLOSE WEEK BUTTON CLICKED =====');
    console.log('📊 weekKey:', weekKey);
    console.log('📊 weekCompletionStatus:', weekCompletionStatus);
    
    const weekNames = {
      wildcard: 'Week 1',
      divisional: 'Week 2',
      conference: 'Week 3',
      superbowl: 'Week 4'
    };
    
    const nextWeekMap = {
      wildcard: 'divisional',
      divisional: 'conference',
      conference: 'superbowl',
      superbowl: null
    };
    
    const currentWeekName = weekNames[weekKey];
    const nextWeek = nextWeekMap[weekKey];
    const nextWeekName = nextWeek ? weekNames[nextWeek] : null;
    
    const confirmed = window.confirm(
      `🔒 CLOSE ${currentWeekName.toUpperCase()} & CONFIGURE ${nextWeekName ? nextWeekName.toUpperCase() : 'NONE'}?\n\n` +
      `This will:\n` +
      `✓ Mark ${currentWeekName} as completed\n` +
      `✓ ${nextWeek ? `Allow you to configure ${nextWeekName} teams immediately` : 'Complete the playoffs'}\n` +
      `✓ ${currentWeekName} results are finalized\n\n` +
      `Continue?`
    );
    
    if (!confirmed) {
      console.log('❌ User cancelled');
      return;
    }
    
    console.log('✅ User confirmed, proceeding...');
    
    try {
      console.log('💾 Step 1: Creating updated status object...');
      const updatedStatus = {
        ...weekCompletionStatus,
        [weekKey]: true
      };
      console.log('📊 Updated status object:', updatedStatus);
      
      console.log('💾 Step 2: Setting local state...');
      setWeekCompletionStatus(updatedStatus);
      console.log('✅ Local state updated');
      
      console.log('💾 Step 3: Saving to Firebase...');
      console.log('📊 Firebase path:', `weekCompletionStatus/${weekKey}`);
      console.log('📊 Firebase value:', true);
      
      await set(ref(database, `weekCompletionStatus/${weekKey}`), true);
      
      console.log('✅✅✅ Firebase save successful! ✅✅✅');
      
      if (nextWeek) {
        alert(
          `✅ ${currentWeekName} closed successfully!\n\n` +
          `You can now configure ${nextWeekName} teams in the "Setup Playoff Teams" page.`
        );
      } else {
        alert(`✅ ${currentWeekName} closed successfully!\n\nAll playoffs complete!`);
      }
    } catch (error) {
      console.error('❌❌❌ ERROR CAUGHT ❌❌❌');
      console.error('Error object:', error);
      console.error('Error message:', error.message);
      console.error('Error name:', error.name);
      console.error('Error stack:', error.stack);
      alert('❌ Error closing week. Check console for details.');
    }
  };

  /**
   * Save Playoff Teams Configuration
   * Pool Manager only - saves Week 1 manual setup or Weeks 2-4 auto-generated matchups
   */
  const handleSavePlayoffTeams = async (data) => {
    if (!isPoolManager()) {
      alert('⛔ Only Pool Manager can save playoff teams configuration.');
      return;
    }

    try {
      const playoffTeamsRef = ref(database, 'playoffTeams');
      
      // Merge new data with existing data
      const currentData = playoffTeams || {};
      const updatedData = { ...currentData, ...data };
      
      await set(playoffTeamsRef, updatedData);
      
      console.log('✅ Playoff teams saved:', updatedData);
      
    } catch (error) {
      console.error('❌ Error saving playoff teams:', error);
      alert('Error saving playoff teams. Check console for details.');
    }
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
  
  // ============================================
  // 🔀 SORTING FUNCTIONS
  // ============================================
  
  /**
   * Toggle sort for a column
   */
  const handleSort = (column) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to ascending
      setSortColumn(column);
      setSortDirection('asc');
    }
  };
  
  /**
   * Sort picks array based on current sort settings
   */
  const getSortedPicks = (picks) => {
    if (!sortColumn) return picks;
    
    return [...picks].sort((a, b) => {
      let aValue, bValue;
      
      if (sortColumn === 'correct') {
        // Count correct picks
        if (currentWeek === 'superbowl') {
          // For Super Bowl table, count across ALL completed weeks
          const countCorrectForPlayer = (playerPick) => {
            let count = 0;
            const weeks = ['wildcard', 'divisional', 'conference', 'superbowl'];
            
            weeks.forEach(weekName => {
              const weekActualScores = actualScores[weekName];
              const hasActual = weekActualScores && Object.keys(weekActualScores).length > 0;
              
              if (hasActual) {
                const playerWeekPick = allPicks.find(p => p.playerCode === playerPick.playerCode && p.week === weekName);
                if (playerWeekPick && playerWeekPick.predictions) {
                  Object.keys(weekActualScores).forEach(gameId => {
                    const actual = weekActualScores[gameId];
                    const pred = playerWeekPick.predictions[gameId];
                    
                    if (pred && actual && actual.team1 && actual.team2 && pred.team1 && pred.team2) {
                      const actualTeam1 = parseInt(actual.team1);
                      const actualTeam2 = parseInt(actual.team2);
                      const predTeam1 = parseInt(pred.team1);
                      const predTeam2 = parseInt(pred.team2);
                      
                      if (!isNaN(actualTeam1) && !isNaN(actualTeam2)) {
                        const actualWinner = actualTeam1 > actualTeam2 ? 'team1' : actualTeam2 > actualTeam1 ? 'team2' : 'tie';
                        const predWinner = predTeam1 > predTeam2 ? 'team1' : predTeam2 > predTeam1 ? 'team2' : 'tie';
                        
                        if (actualWinner === predWinner && actualWinner !== 'tie') {
                          count++;
                        }
                      }
                    }
                  });
                }
              }
            });
            
            return count;
          };
          
          aValue = countCorrectForPlayer(a);
          bValue = countCorrectForPlayer(b);
        } else {
          // For individual week pages, only count current week
          aValue = currentWeekData.games.filter(game => {
            const aPred = a.predictions[game.id];
            const actual = actualScores[currentWeek]?.[game.id];
            if (!aPred || !actual || !actual.team1 || !actual.team2) return false;
            const actualWinner = parseInt(actual.team1) > parseInt(actual.team2) ? 'team1' : 'team2';
            const predWinner = parseInt(aPred.team1) > parseInt(aPred.team2) ? 'team1' : 'team2';
            return actualWinner === predWinner;
          }).length;
          
          bValue = currentWeekData.games.filter(game => {
            const bPred = b.predictions[game.id];
            const actual = actualScores[currentWeek]?.[game.id];
            if (!bPred || !actual || !actual.team1 || !actual.team2) return false;
            const actualWinner = parseInt(actual.team1) > parseInt(actual.team2) ? 'team1' : 'team2';
            const predWinner = parseInt(bPred.team1) > parseInt(bPred.team2) ? 'team1' : 'team2';
            return actualWinner === predWinner;
          }).length;
        }
      } else if (sortColumn === 'perfect') {
        // Count perfect scores (exact score matches)
        if (currentWeek === 'superbowl') {
          // For Super Bowl table, count across ALL completed weeks
          const countPerfectForPlayer = (playerPick) => {
            let count = 0;
            const weeks = ['wildcard', 'divisional', 'conference', 'superbowl'];
            
            weeks.forEach(weekName => {
              const weekActualScores = actualScores[weekName];
              const hasActual = weekActualScores && Object.values(weekActualScores).some(game => {
                return game && 
                       game.team1 !== null && game.team1 !== undefined && game.team1 !== '' && game.team1 !== 0 &&
                       game.team2 !== null && game.team2 !== undefined && game.team2 !== '' && game.team2 !== 0;
              });
              
              if (hasActual) {
                const playerWeekPick = allPicks.find(p => p.playerCode === playerPick.playerCode && p.week === weekName);
                if (playerWeekPick && playerWeekPick.predictions) {
                  Object.keys(weekActualScores).forEach(gameId => {
                    const actual = weekActualScores[gameId];
                    const pred = playerWeekPick.predictions[gameId];
                    
                    if (pred && actual && actual.team1 && actual.team2 && pred.team1 && pred.team2) {
                      const actualTeam1 = parseInt(actual.team1);
                      const actualTeam2 = parseInt(actual.team2);
                      const predTeam1 = parseInt(pred.team1);
                      const predTeam2 = parseInt(pred.team2);
                      
                      // PERFECT SCORE: Both teams exactly correct
                      if (actualTeam1 === predTeam1 && actualTeam2 === predTeam2) {
                        count++;
                      }
                    }
                  });
                }
              }
            });
            
            return count;
          };
          
          aValue = countPerfectForPlayer(a);
          bValue = countPerfectForPlayer(b);
        } else {
          // For individual week pages, only count current week
          aValue = currentWeekData.games.filter(game => {
            const aPred = a.predictions[game.id];
            const actual = actualScores[currentWeek]?.[game.id];
            if (!aPred || !actual || !actual.team1 || !actual.team2) return false;
            return parseInt(actual.team1) === parseInt(aPred.team1) && 
                   parseInt(actual.team2) === parseInt(aPred.team2);
          }).length;
          
          bValue = currentWeekData.games.filter(game => {
            const bPred = b.predictions[game.id];
            const actual = actualScores[currentWeek]?.[game.id];
            if (!bPred || !actual || !actual.team1 || !actual.team2) return false;
            return parseInt(actual.team1) === parseInt(bPred.team1) && 
                   parseInt(actual.team2) === parseInt(bPred.team2);
          }).length;
        }  
      } else if (sortColumn === 'difference') {
        // Smart sorting: 
        // - If has slash (e.g., "333/14"): sort by difference (14)
        // - If no slash (e.g., "333"): sort by predicted total (333)
        const aDisplay = playerTotals[a.playerName]?.current || '0';
        const bDisplay = playerTotals[b.playerName]?.current || '0';
        
        // Check if has slash - if yes, sort by difference; if no, sort by predicted total
        if (aDisplay.includes('/')) {
          aValue = parseInt(aDisplay.split('/')[1]); // Get difference (number after slash)
        } else {
          aValue = parseInt(aDisplay); // Get predicted total (whole number)
        }
        
        if (bDisplay.includes('/')) {
          bValue = parseInt(bDisplay.split('/')[1]); // Get difference (number after slash)
        } else {
          bValue = parseInt(bDisplay); // Get predicted total (whole number)
        }
      } else if (sortColumn === 'week1' || sortColumn === 'week2' || sortColumn === 'week3' || sortColumn === 'week4') {
        // Smart sorting for specific weeks
        const weekMap = { week1: 'wildcard', week2: 'divisional', week3: 'conference', week4: 'superbowl' };
        const weekName = weekMap[sortColumn];
        
        const aDisplay = formatWeeklyDisplay(a.playerCode, weekName, parseInt(sortColumn.replace('week', ''))).display;
        const bDisplay = formatWeeklyDisplay(b.playerCode, weekName, parseInt(sortColumn.replace('week', ''))).display;
        
        // Smart sorting: sort by difference if has slash, by predicted total if no slash
        if (aDisplay.includes('/')) {
          aValue = parseInt(aDisplay.split('/')[1]);
        } else if (aDisplay === '-') {
          aValue = 999999; // Put dashes at end
        } else {
          aValue = parseInt(aDisplay);
        }
        
        if (bDisplay.includes('/')) {
          bValue = parseInt(bDisplay.split('/')[1]);
        } else if (bDisplay === '-') {
          bValue = 999999; // Put dashes at end
        } else {
          bValue = parseInt(bDisplay);
        }
      } else if (sortColumn === 'grand') {
        // Smart sorting for Grand Total
        const aDisplay = formatGrandDisplay(a.playerCode).display;
        const bDisplay = formatGrandDisplay(b.playerCode).display;
        
        // Smart sorting: sort by difference if has slash, by predicted total if no slash
        if (aDisplay.includes('/')) {
          aValue = parseInt(aDisplay.split('/')[1]);
        } else if (aDisplay === '-') {
          aValue = 999999; // Put dashes at end
        } else {
          aValue = parseInt(aDisplay);
        }
        
        if (bDisplay.includes('/')) {
          bValue = parseInt(bDisplay.split('/')[1]);
        } else if (bDisplay === '-') {
          bValue = 999999; // Put dashes at end
        } else {
          bValue = parseInt(bDisplay);
        }
      } else if (sortColumn === 'timestamp') {
        // Sort by submission timestamp
        aValue = a.lastUpdated || a.timestamp || 0;
        bValue = b.lastUpdated || b.timestamp || 0;
      } else if (sortColumn === 'name') {
        // Sort by first name alphabetically
        const aFirstName = a.playerName.split(' ')[0].toLowerCase();
        const bFirstName = b.playerName.split(' ')[0].toLowerCase();
        
        // Use string comparison for alphabetical sorting
        if (sortDirection === 'asc') {
          return aFirstName.localeCompare(bFirstName);
        } else {
          return bFirstName.localeCompare(aFirstName);
        }
      }
      
      // Apply sort direction (for numeric values)
      if (sortDirection === 'asc') {
        return aValue - bValue;
      } else {
        return bValue - aValue;
      }
    });
  };
  
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
    console.log(`🔍 calculateWeeklyTotal for ${playerCode}, week ${week}`);
    // Find player's picks for this week
    const playerPick = allPicks.find(p => p.playerCode === playerCode && p.week === week);
    console.log('🔍 Found playerPick:', !!playerPick);
    if (!playerPick || !playerPick.predictions) return 0;
    
    // Get actual scores for this week
    const weekActualScores = actualScores[week];
    console.log('🔍 weekActualScores:', weekActualScores);
    if (!weekActualScores) return 0;
    
    // Calculate total predicted and total actual for the ENTIRE WEEK
    let totalPredicted = 0;
    let totalActual = 0;
    
    // Handle both array and object prediction formats
    if (Array.isArray(playerPick.predictions)) {
      // Array format (old picks)
      playerPick.predictions.forEach((pred, gameId) => {
        if (gameId === 0 || !pred) return; // Skip index 0
        
        const actual = weekActualScores[gameId];
        
        // if (pred && actual && pred.team1 && pred.team2 && actual.team1 && actual.team2) {
        if (pred && actual && pred.team1 && pred.team2 && actual.team1 !== "" && actual.team2 !== "") {
          totalPredicted += parseInt(pred.team1) + parseInt(pred.team2);
          totalActual += parseInt(actual.team1) + parseInt(actual.team2);
        }
      });
    } else {
      // Object format (new picks)
      Object.keys(playerPick.predictions).forEach(gameId => {
        const pred = playerPick.predictions[gameId];
        const actual = weekActualScores[gameId];

        console.log(`🔍 GameId ${gameId}: pred=${JSON.stringify(pred)}, actual=${JSON.stringify(actual)}`);
        
        // if (pred && actual && pred.team1 && pred.team2 && actual.team1 && actual.team2) {
        if (pred && actual && pred.team1 && pred.team2 && actual.team1 !== "" && actual.team2 !== "") {
          totalPredicted += parseInt(pred.team1) + parseInt(pred.team2);
          totalActual += parseInt(actual.team1) + parseInt(actual.team2);
        }
      });
    }
    
    // Return the absolute difference between total predicted and total actual
    return Math.abs(totalPredicted - totalActual);
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
    
    // ✅ FIXED: Check if actual scores have REAL values (not null/undefined/empty strings/zeros)
    const weekActualScores = actualScores[weekName];
    const hasActual = weekActualScores && Object.values(weekActualScores).some(game => {
      return game && 
             game.team1 !== null && game.team1 !== undefined && game.team1 !== '' && game.team1 !== 0 &&
             game.team2 !== null && game.team2 !== undefined && game.team2 !== '' && game.team2 !== 0;
    });
    
    if (!predicted) {
      return { display: '-', tooltip: '', fontSize: '16px' };
    }
    
    // No actual scores yet - just show prediction
    if (!hasActual || difference === 0) {
      return {
        display: `${predicted}`,
        tooltip: `Predicted: ${predicted}`,
        fontSize: '16px'
      };
    }
    
    // Show prediction/difference
    return {
      display: `${predicted}/${difference}`,
      tooltip: `Predicted: ${predicted} | Off by: ${difference}`,
      fontSize: '16px'
    };
  };
  
  /**
   * Format grand total with smart P notation
   * Returns object: { display: string, tooltip: string, fontSize: string }
   */
//  const formatGrandDisplay = (playerCode) => {
//    const weeks = getPlayerWeeks(playerCode);
  const formatGrandDisplay = (playerCode) => {
    console.log('🔍 formatGrandDisplay called for:', playerCode);
    const weeks = getPlayerWeeks(playerCode);
    console.log('🔍 Player weeks:', weeks);
    
    if (weeks.length === 0) {
      return { display: '-', tooltip: '', fontSize: '16px' };
    }
    
    // Calculate ONLY for completed weeks
    let playedPredicted = 0;
    let hasAnyActual = false;
    
    const weekMap = { 1: 'wildcard', 2: 'divisional', 3: 'conference', 4: 'superbowl' };
    
    weeks.forEach(weekNum => {
      const weekName = weekMap[weekNum];
      const pred = calculatePredictedTotal(playerCode, weekName);
      console.log(`🔍 Week ${weekNum} (${weekName}): pred=${pred}`);
  
      // ✅ FIXED: Check if actual scores have REAL values (not null/undefined/empty strings/zeros)
      const weekActualScores = actualScores[weekName];
      const hasActual = weekActualScores && Object.values(weekActualScores).some(game => {
        return game && 
               game.team1 !== null && game.team1 !== undefined && game.team1 !== '' && game.team1 !== 0 &&
               game.team2 !== null && game.team2 !== undefined && game.team2 !== '' && game.team2 !== 0;
      });
      
      // ONLY include weeks that have actual scores
      if (pred && hasActual) {
        playedPredicted += pred;
        hasAnyActual = true;
      }
    });
    
    // No games played yet
    if (!hasAnyActual) {
      return {
        display: '-',
        tooltip: 'No completed weeks yet',
        fontSize: '16px'
      };
    }
    
    // 🔥 FIX: Calculate difference from official grand total (simple subtraction, not adding weekly absolutes)
    const officialGrandTotal = getGrandTotalHeaderValue();
    const totalDifference = Math.abs(playedPredicted - (officialGrandTotal || 0));
    
    // Show only completed weeks total
    const tooltip = `Predicted: ${playedPredicted} | Off by: ${totalDifference}`;
    return {
      display: `${playedPredicted}/${totalDifference}`,
      tooltip,
      fontSize: '16px'
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
  // 🏆 COMPREHENSIVE RANKING & TIE-BREAKER SYSTEM
  // ============================================
  
  /**
   * Calculate player's correct winner count for a specific week
   */
  const calculateCorrectWinners = (playerCode, weekName) => {
    const pick = allPicks.find(p => p.playerCode === playerCode && p.week === weekName);
    if (!pick || !pick.predictions) return 0;
    
    const weekData = PLAYOFF_WEEKS[weekName];
    if (!weekData) return 0;
    
    let correctCount = 0;
    
    weekData.games.forEach(game => {
      const prediction = pick.predictions[game.id];
      const actual = actualScores[weekName]?.[game.id];
      
      if (!prediction || !actual) return;
      
      const predTeam1 = parseInt(prediction.team1) || 0;
      const predTeam2 = parseInt(prediction.team2) || 0;
      const actualTeam1 = parseInt(actual.team1) || 0;
      const actualTeam2 = parseInt(actual.team2) || 0;
      
      // Determine predicted winner
      const predWinner = predTeam1 > predTeam2 ? 'team1' : predTeam1 < predTeam2 ? 'team2' : 'tie';
      const actualWinner = actualTeam1 > actualTeam2 ? 'team1' : actualTeam1 < actualTeam2 ? 'team2' : 'tie';
      
      if (predWinner === actualWinner && predWinner !== 'tie') {
        correctCount++;
      }
    });
    
    return correctCount;
  };
  
  /**
   * Calculate player's total correct winners across all 4 weeks
   */
  const calculateTotalCorrectWinners = (playerCode) => {
    const week1 = calculateCorrectWinners(playerCode, 'wildcard');
    const week2 = calculateCorrectWinners(playerCode, 'divisional');
    const week3 = calculateCorrectWinners(playerCode, 'conference');
    const week4 = calculateCorrectWinners(playerCode, 'superbowl');
    return week1 + week2 + week3 + week4;
  };
  
  /**
   * Check if player picked correct Super Bowl winner
   */
  const pickedCorrectSuperBowlWinner = (playerCode) => {
    const pick = allPicks.find(p => p.playerCode === playerCode && p.week === 'superbowl');
    if (!pick || !pick.predictions) return false;
    
    const sbGame = PLAYOFF_WEEKS.superbowl.games[0]; // Game 13
    const prediction = pick.predictions[sbGame.id];
    const actual = actualScores.superbowl?.[sbGame.id];
    
    if (!prediction || !actual) return false;
    
    const predTeam1 = parseInt(prediction.team1) || 0;
    const predTeam2 = parseInt(prediction.team2) || 0;
    const actualTeam1 = parseInt(actual.team1) || 0;
    const actualTeam2 = parseInt(actual.team2) || 0;
    
    const predWinner = predTeam1 > predTeam2 ? 'team1' : predTeam1 < predTeam2 ? 'team2' : 'tie';
    const actualWinner = actualTeam1 > actualTeam2 ? 'team1' : actualTeam1 < actualTeam2 ? 'team2' : 'tie';
    
    return predWinner === actualWinner && predWinner !== 'tie';
  };
  
  /**
   * Check if a week is complete (all games final AND Pool Manager closed it)
   */
  const isWeekComplete = (weekName) => {
    // Check if Pool Manager closed the week
    const manuallyCompleted = weekCompletionStatus?.[weekName] === true;
    
    // Check if all games are final
    const weekData = PLAYOFF_WEEKS[weekName];
    if (!weekData) return false;
    
    const allGamesFinal = weekData.games.every(game => {
      return gameStatus[weekName]?.[game.id] === 'final';
    });
    
    return manuallyCompleted && allGamesFinal;
  };
  
  /**
   * Rank players for "Most Correct Winners" prize
   * Primary: Correct count (high to low)
   * Tie-breaker: That week's points difference (low to high)
   * If still tied on points: Go back to previous weeks' correct count
   */
  const rankMostCorrectWinners = (weekName) => {
    const playerRankings = [];
    
    // Get all unique players
    const uniquePlayers = {};
    allPicks.forEach(pick => {
      if (!uniquePlayers[pick.playerCode]) {
        uniquePlayers[pick.playerCode] = pick.playerName;
      }
    });
    
    // Calculate rankings for each player
    Object.keys(uniquePlayers).forEach(playerCode => {
      const playerName = uniquePlayers[playerCode];
      const correctCount = calculateCorrectWinners(playerCode, weekName);
      const weekDifference = calculateWeeklyTotal(playerCode, weekName);
      
      // Get previous weeks' POINTS DIFFERENCE for tie-breaking (NOT correct counts!)
      const weekOrder = ['wildcard', 'divisional', 'conference', 'superbowl'];
      const currentIndex = weekOrder.indexOf(weekName);
      const previousWeeksDifference = [];
      
      for (let i = currentIndex - 1; i >= 0; i--) {
        previousWeeksDifference.push({
          week: weekOrder[i],
          difference: calculateWeeklyTotal(playerCode, weekOrder[i])
        });
      }
      
      playerRankings.push({
        playerName,
        playerCode,
        correctCount,
        weekDifference,
        previousWeeksDifference
      });
    });
    
    // Sort by correct count (high to low), then by week difference (low to high), then by previous weeks' POINTS
    playerRankings.sort((a, b) => {
      // Primary: Correct count (higher is better)
      if (b.correctCount !== a.correctCount) {
        return b.correctCount - a.correctCount;
      }
      
      // Secondary: Week difference (lower is better)
      if (a.weekDifference !== b.weekDifference) {
        return a.weekDifference - b.weekDifference;
      }
      
      // Tertiary: Go back through previous weeks' POINTS DIFFERENCE (not correct counts!)
      for (let i = 0; i < Math.min(a.previousWeeksDifference.length, b.previousWeeksDifference.length); i++) {
        const aDiff = a.previousWeeksDifference[i].difference;
        const bDiff = b.previousWeeksDifference[i].difference;
        if (aDiff !== bDiff) {
          return aDiff - bDiff; // Lower is better
        }
      }
      
      return 0; // Complete tie - same rank
    });
    
    // Assign ranks (players with identical stats get same rank)
    let currentRank = 1;
    playerRankings.forEach((player, index) => {
      if (index === 0) {
        player.rank = 1;
      } else {
        const prev = playerRankings[index - 1];
        
        // Check if completely identical to previous player
        const sameCorrect = player.correctCount === prev.correctCount;
        const sameDifference = player.weekDifference === prev.weekDifference;
        
        let samePreviousWeeks = true;
        for (let i = 0; i < player.previousWeeksDifference.length; i++) {
          if (player.previousWeeksDifference[i].difference !== prev.previousWeeksDifference[i].difference) {
            samePreviousWeeks = false;
            break;
          }
        }
        
        if (sameCorrect && sameDifference && samePreviousWeeks) {
          player.rank = prev.rank; // Same rank (tie)
          player.tied = true;
        } else {
          currentRank = index + 1;
          player.rank = currentRank;
        }
      }
    });
    
    return playerRankings;
  };
  
  /**
   * Rank players for "Closest Points" prize
   * Primary: Points difference (low to high)
   * Tie-breaker: Go back to previous weeks' points difference
   */
  const rankClosestPoints = (weekName) => {
    const playerRankings = [];
    
    // Get all unique players
    const uniquePlayers = {};
    allPicks.forEach(pick => {
      if (!uniquePlayers[pick.playerCode]) {
        uniquePlayers[pick.playerCode] = pick.playerName;
      }
    });
    
    // Calculate rankings for each player
    Object.keys(uniquePlayers).forEach(playerCode => {
      const playerName = uniquePlayers[playerCode];
      const weekDifference = calculateWeeklyTotal(playerCode, weekName);
      
      // Get previous weeks' differences for tie-breaking
      const weekOrder = ['wildcard', 'divisional', 'conference', 'superbowl'];
      const currentIndex = weekOrder.indexOf(weekName);
      const previousWeeksDifference = [];
      
      for (let i = currentIndex - 1; i >= 0; i--) {
        previousWeeksDifference.push({
          week: weekOrder[i],
          difference: calculateWeeklyTotal(playerCode, weekOrder[i])
        });
      }
      
      playerRankings.push({
        playerName,
        playerCode,
        weekDifference,
        previousWeeksDifference
      });
    });
    
    // Sort by difference (low to high), then by previous weeks
    playerRankings.sort((a, b) => {
      // Primary: Week difference (lower is better)
      if (a.weekDifference !== b.weekDifference) {
        return a.weekDifference - b.weekDifference;
      }
      
      // Secondary: Go back through previous weeks' differences
      for (let i = 0; i < Math.min(a.previousWeeksDifference.length, b.previousWeeksDifference.length); i++) {
        const aDiff = a.previousWeeksDifference[i].difference;
        const bDiff = b.previousWeeksDifference[i].difference;
        if (aDiff !== bDiff) {
          return aDiff - bDiff; // Lower is better
        }
      }
      
      return 0; // Complete tie
    });
    
    // Assign ranks
    let currentRank = 1;
    playerRankings.forEach((player, index) => {
      if (index === 0) {
        player.rank = 1;
      } else {
        const prev = playerRankings[index - 1];
        
        // Check if completely identical
        const sameDifference = player.weekDifference === prev.weekDifference;
        
        let samePreviousWeeks = true;
        for (let i = 0; i < player.previousWeeksDifference.length; i++) {
          if (player.previousWeeksDifference[i].difference !== prev.previousWeeksDifference[i].difference) {
            samePreviousWeeks = false;
            break;
          }
        }
        
        if (sameDifference && samePreviousWeeks) {
          player.rank = prev.rank; // Same rank (tie)
          player.tied = true;
        } else {
          currentRank = index + 1;
          player.rank = currentRank;
        }
      }
    });
    
    return playerRankings;
  };
  
  /**
   * Rank players for "Correct Super Bowl Winner" prize (Prize #1 in Week 4)
   * Primary: Picked correct SB winner
   * Tie-breaker: Go back to Week 3, 2, 1 correct counts
   */
  const rankCorrectSuperBowlWinner = () => {
    const playerRankings = [];
    
    // Get all unique players
    const uniquePlayers = {};
    allPicks.forEach(pick => {
      if (!uniquePlayers[pick.playerCode]) {
        uniquePlayers[pick.playerCode] = pick.playerName;
      }
    });
    
    Object.keys(uniquePlayers).forEach(playerCode => {
      const playerName = uniquePlayers[playerCode];
      const pickedCorrect = pickedCorrectSuperBowlWinner(playerCode);
      
      // Get weeks' POINTS DIFFERENCE for tie-breaking (NOT correct counts!)
      const week4Difference = calculateWeeklyTotal(playerCode, 'superbowl');
      const week3Difference = calculateWeeklyTotal(playerCode, 'conference');
      const week2Difference = calculateWeeklyTotal(playerCode, 'divisional');
      const week1Difference = calculateWeeklyTotal(playerCode, 'wildcard');
      
      playerRankings.push({
        playerName,
        playerCode,
        pickedCorrect,
        week4Difference,
        week3Difference,
        week2Difference,
        week1Difference
      });
    });
    
    // Sort: Picked correct first (true before false), then by Week 4, 3, 2, 1 POINTS DIFFERENCE
    playerRankings.sort((a, b) => {
      // Primary: Picked correct (true comes before false)
      if (a.pickedCorrect !== b.pickedCorrect) {
        return b.pickedCorrect - a.pickedCorrect;
      }
      
      // If both picked correct (or both didn't), tie-break by Week 4 POINTS
      if (a.week4Difference !== b.week4Difference) {
        return a.week4Difference - b.week4Difference; // Lower is better
      }
      
      // If still tied, Week 3 POINTS
      if (a.week3Difference !== b.week3Difference) {
        return a.week3Difference - b.week3Difference; // Lower is better
      }
      
      // If still tied, Week 2 POINTS
      if (a.week2Difference !== b.week2Difference) {
        return a.week2Difference - b.week2Difference; // Lower is better
      }
      
      // If still tied, Week 1 POINTS
      if (a.week1Difference !== b.week1Difference) {
        return a.week1Difference - b.week1Difference; // Lower is better
      }
      
      return 0; // Complete tie
    });
    
    // Assign ranks
    let currentRank = 1;
    playerRankings.forEach((player, index) => {
      if (index === 0) {
        player.rank = 1;
      } else {
        const prev = playerRankings[index - 1];
        
        const sameCorrect = player.pickedCorrect === prev.pickedCorrect;
        const sameWeek4 = player.week4Difference === prev.week4Difference;
        const sameWeek3 = player.week3Difference === prev.week3Difference;
        const sameWeek2 = player.week2Difference === prev.week2Difference;
        const sameWeek1 = player.week1Difference === prev.week1Difference;
        
        if (sameCorrect && sameWeek4 && sameWeek3 && sameWeek2 && sameWeek1) {
          player.rank = prev.rank;
          player.tied = true;
        } else {
          currentRank = index + 1;
          player.rank = currentRank;
        }
      }
    });
    
    return playerRankings;
  };
  
  /**
   * Rank players for "Most Correct All 4 Weeks" (Prize #9)
   * Primary: Total correct across all 4 weeks
   * Tie-breaker: Grand total points difference, then Week 4, 3, 2, 1 POINTS DIFFERENCE
   */
  const rankMostCorrectAllWeeks = () => {
    const playerRankings = [];
    
    const uniquePlayers = {};
    allPicks.forEach(pick => {
      if (!uniquePlayers[pick.playerCode]) {
        uniquePlayers[pick.playerCode] = pick.playerName;
      }
    });
    
    Object.keys(uniquePlayers).forEach(playerCode => {
      const playerName = uniquePlayers[playerCode];
      const totalCorrect = calculateTotalCorrectWinners(playerCode);
      const grandDifference = calculateGrandTotal(playerCode);
      
      // Get POINTS DIFFERENCE for each week (not correct counts!)
      const week4Difference = calculateWeeklyTotal(playerCode, 'superbowl');
      const week3Difference = calculateWeeklyTotal(playerCode, 'conference');
      const week2Difference = calculateWeeklyTotal(playerCode, 'divisional');
      const week1Difference = calculateWeeklyTotal(playerCode, 'wildcard');
      
      playerRankings.push({
        playerName,
        playerCode,
        totalCorrect,
        grandDifference,
        week4Difference,
        week3Difference,
        week2Difference,
        week1Difference
      });
    });
    
    // Sort
    playerRankings.sort((a, b) => {
      // Primary: Total correct (higher is better)
      if (b.totalCorrect !== a.totalCorrect) {
        return b.totalCorrect - a.totalCorrect;
      }
      
      // Secondary: Grand total difference (lower is better)
      if (a.grandDifference !== b.grandDifference) {
        return a.grandDifference - b.grandDifference;
      }
      
      // Tertiary: Week 4, 3, 2, 1 POINTS DIFFERENCE (lower is better)
      if (a.week4Difference !== b.week4Difference) return a.week4Difference - b.week4Difference;
      if (a.week3Difference !== b.week3Difference) return a.week3Difference - b.week3Difference;
      if (a.week2Difference !== b.week2Difference) return a.week2Difference - b.week2Difference;
      if (a.week1Difference !== b.week1Difference) return a.week1Difference - b.week1Difference;
      
      return 0;
    });
    
    // Assign ranks
    let currentRank = 1;
    playerRankings.forEach((player, index) => {
      if (index === 0) {
        player.rank = 1;
      } else {
        const prev = playerRankings[index - 1];
        
        if (player.totalCorrect === prev.totalCorrect &&
            player.grandDifference === prev.grandDifference &&
            player.week4Difference === prev.week4Difference &&
            player.week3Difference === prev.week3Difference &&
            player.week2Difference === prev.week2Difference &&
            player.week1Difference === prev.week1Difference) {
          player.rank = prev.rank;
          player.tied = true;
        } else {
          currentRank = index + 1;
          player.rank = currentRank;
        }
      }
    });
    
    return playerRankings;
  };
  
  /**
   * Rank players for "Closest Points All 4 Weeks" (Prize #4 in Week 4)
   * Primary: Grand total difference (low to high)
   * Tie-breaker: Week 4, 3, 2, 1 differences
   */
  const rankClosestPointsAllWeeks = () => {
    const playerRankings = [];
    
    const uniquePlayers = {};
    allPicks.forEach(pick => {
      if (!uniquePlayers[pick.playerCode]) {
        uniquePlayers[pick.playerCode] = pick.playerName;
      }
    });
    
    Object.keys(uniquePlayers).forEach(playerCode => {
      const playerName = uniquePlayers[playerCode];
      const grandDifference = calculateGrandTotal(playerCode);
      
      const week4Difference = calculateWeeklyTotal(playerCode, 'superbowl');
      const week3Difference = calculateWeeklyTotal(playerCode, 'conference');
      const week2Difference = calculateWeeklyTotal(playerCode, 'divisional');
      const week1Difference = calculateWeeklyTotal(playerCode, 'wildcard');
      
      playerRankings.push({
        playerName,
        playerCode,
        grandDifference,
        week4Difference,
        week3Difference,
        week2Difference,
        week1Difference
      });
    });
    
    // Sort
    playerRankings.sort((a, b) => {
      // Primary: Grand difference (lower is better)
      if (a.grandDifference !== b.grandDifference) {
        return a.grandDifference - b.grandDifference;
      }
      
      // Tie-breaker: Week 4, 3, 2, 1 differences (lower is better)
      if (a.week4Difference !== b.week4Difference) return a.week4Difference - b.week4Difference;
      if (a.week3Difference !== b.week3Difference) return a.week3Difference - b.week3Difference;
      if (a.week2Difference !== b.week2Difference) return a.week2Difference - b.week2Difference;
      if (a.week1Difference !== b.week1Difference) return a.week1Difference - b.week1Difference;
      
      return 0;
    });
    
    // Assign ranks
    let currentRank = 1;
    playerRankings.forEach((player, index) => {
      if (index === 0) {
        player.rank = 1;
      } else {
        const prev = playerRankings[index - 1];
        
        if (player.grandDifference === prev.grandDifference &&
            player.week4Difference === prev.week4Difference &&
            player.week3Difference === prev.week3Difference &&
            player.week2Difference === prev.week2Difference &&
            player.week1Difference === prev.week1Difference) {
          player.rank = prev.rank;
          player.tied = true;
        } else {
          currentRank = index + 1;
          player.rank = currentRank;
        }
      }
    });
    
    return playerRankings;
  };
  
  /**
   * Rank players for "Closest Super Bowl Points" (Prize #8)
   * Primary: Closest to SB total points
   * Tie-breaker: Week 3, 2, 1 differences (SKIP Week 4 since it's redundant with SB)
   */
  const rankClosestSuperBowlPoints = () => {
    const playerRankings = [];
    
    const uniquePlayers = {};
    allPicks.forEach(pick => {
      if (!uniquePlayers[pick.playerCode]) {
        uniquePlayers[pick.playerCode] = pick.playerName;
      }
    });
    
    Object.keys(uniquePlayers).forEach(playerCode => {
      const playerName = uniquePlayers[playerCode];
      const sbDifference = calculateWeeklyTotal(playerCode, 'superbowl');
      
      // SKIP Week 4 for tie-breaking (it's the same as SB!)
      const week3Difference = calculateWeeklyTotal(playerCode, 'conference');
      const week2Difference = calculateWeeklyTotal(playerCode, 'divisional');
      const week1Difference = calculateWeeklyTotal(playerCode, 'wildcard');
      
      playerRankings.push({
        playerName,
        playerCode,
        weekDifference: sbDifference, // For display compatibility
        week3Difference,
        week2Difference,
        week1Difference
      });
    });
    
    // Sort: SB difference first, then Week 3, 2, 1 (SKIP Week 4)
    playerRankings.sort((a, b) => {
      // Primary: SB difference (lower is better)
      if (a.weekDifference !== b.weekDifference) {
        return a.weekDifference - b.weekDifference;
      }
      
      // Tie-breaker: Week 3 (SKIP Week 4!)
      if (a.week3Difference !== b.week3Difference) {
        return a.week3Difference - b.week3Difference;
      }
      
      // If still tied, Week 2
      if (a.week2Difference !== b.week2Difference) {
        return a.week2Difference - b.week2Difference;
      }
      
      // If still tied, Week 1
      if (a.week1Difference !== b.week1Difference) {
        return a.week1Difference - b.week1Difference;
      }
      
      return 0; // Complete tie
    });
    
    // Assign ranks
    let currentRank = 1;
    playerRankings.forEach((player, index) => {
      if (index === 0) {
        player.rank = 1;
      } else {
        const prev = playerRankings[index - 1];
        
        if (player.weekDifference === prev.weekDifference &&
            player.week3Difference === prev.week3Difference &&
            player.week2Difference === prev.week2Difference &&
            player.week1Difference === prev.week1Difference) {
          player.rank = prev.rank;
          player.tied = true;
        } else {
          currentRank = index + 1;
          player.rank = currentRank;
        }
      }
    });
    
    return playerRankings;
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
  // 🔄 REFRESH PICKS HANDLER
  // ============================================
  
  const handleRefreshPicks = () => {
    // Show "refreshing" feedback
    setIsRefreshing(true);
    
    // The picks are already real-time synced via Firebase onValue listener
    // So we just show feedback and then hide it after a brief moment
    setTimeout(() => {
      setIsRefreshing(false);
    }, 800);
    
    // Optional: Could force a re-fetch if needed, but onValue already handles this
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
      logFailedLogin(code, 'Empty code');
      alert('Please enter your 6-character player code');
      return;
    }
    
    // Accept 6-character alphanumeric codes
    if (code.length !== 6 || !/^[A-Z0-9]{6}$/.test(code)) {
      logFailedLogin(code, 'Invalid format - must be 6 alphanumeric characters');
      alert('Invalid code format!\n\nPlayer codes must be exactly 6 characters (letters and numbers).\nExample: A7K9M2');
      return;
    }
    
//    const playerNameForCode = PLAYER_CODES[code];
//    
//    if (!playerNameForCode) {
//      logFailedLogin(code, 'Code not recognized');
//      alert('Invalid player code!\n\nThis code is not recognized.\n\nMake sure you:\n1. Paid your $20 entry fee\n2. Received your code from the pool manager\n3. Entered the code correctly\n\nContact: gammoneer2b@gmail.com');
//      return;
//    }
    // CHECK FIREBASE FIRST (Source of Truth)
    let playerNameForCode = null;
    let foundInFirebase = false;

    // Check Firebase players
    const firebasePlayer = allPlayers.find(p => p.playerCode === code);
    if (firebasePlayer) {
      playerNameForCode = firebasePlayer.playerName;
      foundInFirebase = true;
      console.log('✅ Player found in Firebase:', playerNameForCode);
    } else {
      // Fallback to PLAYER_CODES (Emergency backup)
      playerNameForCode = PLAYER_CODES[code];
      if (playerNameForCode) {
        console.log('⚠️ Player found in App.jsx backup (not in Firebase):', playerNameForCode);
      }
    }

    if (!playerNameForCode) {
      logFailedLogin(code, 'Code not recognized');
      alert('Invalid player code!\n\nThis code is not recognized in Firebase OR App.jsx.\n\nMake sure you:\n1. Paid your $20 entry fee\n2. Received your code from the pool manager\n3. Entered the code correctly\n\nContact: gammoneer2b@gmail.com');
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
    logSuccessfulLogin(code, playerNameForCode);
    setPlayerName(playerNameForCode);
    setPlayerCode(code); // Store uppercase version
    setCodeValidated(true);
  };
// Download picks as CSV spreadsheet - COMPLETE VERSION (Pool Manager Only - ALL PLAYERS)
const downloadCompletePicksAsCSV = () => {
  const weekPicks = allPicks.filter(pick => pick.week === currentWeek);
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
  
  // Row 2: Team Names
  csv += 'TEAM NAMES:,';
  currentWeekData.games.forEach(game => {
    const team1Name = getTeamName(currentWeek, game.id, 'team1', playoffTeams);
    const team2Name = getTeamName(currentWeek, game.id, 'team2', playoffTeams);
    csv += `${team1Name},${team2Name},`;
  });
  if (currentWeek === 'superbowl') {
    csv += ',,,,'; // Empty cells for week totals columns
  }
  csv += '\n';
  
  // Row 3: Actual Scores
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
  
  // Row 4: Combined Game Totals (Team1 + Team2)
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
  
  // Row 5: Game Status
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
  
  // Row 6: Official/Manual Week Totals
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
  
  // Row 7: Blank separator row
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
    const team1Name = getTeamName(currentWeek, game.id, 'team1', playoffTeams);
    const team2Name = getTeamName(currentWeek, game.id, 'team2', playoffTeams);
    csv += `${team1Name},${team2Name},`;
  });
  
  // Add week breakdown columns for Super Bowl
  if (currentWeek === 'superbowl') {
    csv += 'Week 4 Total,Week 3 Total,Week 2 Total,Week 1 Total,GRAND TOTAL,';
  } else {
    csv += 'Total Points,';
  }
  csv += 'Submitted At\n';

  // NEW: Create array of ALL players (from PLAYER_CODES), not just those with picks
  const allPlayersList = Object.entries(PLAYER_CODES).map(([code, name]) => {
    const existingPick = weekPicks.find(p => p.playerCode === code);
    return {
      playerName: name,
      playerCode: code,
      predictions: existingPick?.predictions || {},
      timestamp: existingPick?.timestamp || null,
      lastUpdated: existingPick?.lastUpdated || null
    };
  });

  // Add data rows for ALL players
  allPlayersList
    .sort((a, b) => {
      // Sort by: 1) Has picks (yes first), 2) Timestamp (newest first), 3) Name (alphabetical)
      const aHasPicks = Object.keys(a.predictions).length > 0;
      const bHasPicks = Object.keys(b.predictions).length > 0;
      
      if (aHasPicks && !bHasPicks) return -1;
      if (!aHasPicks && bHasPicks) return 1;
      
      if (aHasPicks && bHasPicks) {
        return (b.lastUpdated || b.timestamp || 0) - (a.lastUpdated || a.timestamp || 0);
      }
      
      return a.playerName.localeCompare(b.playerName);
    })
    .forEach(pick => {
      csv += `"${pick.playerName}",`;
      
      // Add scores for each game (or dashes if no picks)
      currentWeekData.games.forEach(game => {
        const team1Score = pick.predictions[game.id]?.team1 || '--';
        const team2Score = pick.predictions[game.id]?.team2 || '--';
        csv += `${team1Score},${team2Score},`;
      });
      
      // Calculate totals
      const hasPicks = Object.keys(pick.predictions).length > 0;
      
      if (currentWeek === 'superbowl') {
        // Calculate each week's total
        const week4Total = (() => {
          const w4Pick = allPicks.find(p => p.playerCode === pick.playerCode && p.week === 'superbowl');
          if (!w4Pick) return '--';
          let sum = 0;
          PLAYOFF_WEEKS.superbowl.games.forEach(game => {
            const pred = w4Pick.predictions[game.id];
            if (pred) sum += (Number(pred.team1) || 0) + (Number(pred.team2) || 0);
          });
          return sum > 0 ? sum : '--';
        })();

        const week3Total = (() => {
          const w3Pick = allPicks.find(p => p.playerCode === pick.playerCode && p.week === 'conference');
          if (!w3Pick) return '--';
          let sum = 0;
          PLAYOFF_WEEKS.conference.games.forEach(game => {
            const pred = w3Pick.predictions[game.id];
            if (pred) sum += (Number(pred.team1) || 0) + (Number(pred.team2) || 0);
          });
          return sum > 0 ? sum : '--';
        })();

        const week2Total = (() => {
          const w2Pick = allPicks.find(p => p.playerCode === pick.playerCode && p.week === 'divisional');
          if (!w2Pick) return '--';
          let sum = 0;
          PLAYOFF_WEEKS.divisional.games.forEach(game => {
            const pred = w2Pick.predictions[game.id];
            if (pred) sum += (Number(pred.team1) || 0) + (Number(pred.team2) || 0);
          });
          return sum > 0 ? sum : '--';
        })();

        const week1Total = (() => {
          const w1Pick = allPicks.find(p => p.playerCode === pick.playerCode && p.week === 'wildcard');
          if (!w1Pick) return '--';
          let sum = 0;
          PLAYOFF_WEEKS.wildcard.games.forEach(game => {
            const pred = w1Pick.predictions[game.id];
            if (pred) sum += (Number(pred.team1) || 0) + (Number(pred.team2) || 0);
          });
          return sum > 0 ? sum : '--';
        })();

        const grandTotal = [week4Total, week3Total, week2Total, week1Total]
          .filter(t => t !== '--')
          .reduce((sum, t) => sum + t, 0);
        
        csv += `${week4Total},${week3Total},${week2Total},${week1Total},${grandTotal || '--'},`;
      } else {
        // Single total for non-Super Bowl weeks
        if (!hasPicks) {
          csv += '--,';
        } else {
          const totalPoints = currentWeekData.games.reduce((total, game) => {
            const team1Score = parseInt(pick.predictions[game.id]?.team1) || 0;
            const team2Score = parseInt(pick.predictions[game.id]?.team2) || 0;
            return total + team1Score + team2Score;
          }, 0);
          csv += `${totalPoints},`;
        }
      }
      
      // Timestamp
      // Calculate correct picks for this player
      let correctCount = 0;
      if (hasPicks) {
        currentWeekData.games.forEach(game => {
          const pred = pick.predictions[game.id];
          const actual = actualScores[currentWeek]?.[game.id];
          
          if (pred && actual && pred.team1 && pred.team2 && actual.team1 && actual.team2) {
            const actualTeam1 = parseInt(actual.team1);
            const actualTeam2 = parseInt(actual.team2);
            const predTeam1 = parseInt(pred.team1);
            const predTeam2 = parseInt(pred.team2);
            
            if (!isNaN(actualTeam1) && !isNaN(actualTeam2)) {
              const actualWinner = actualTeam1 > actualTeam2 ? 'team1' : actualTeam2 > actualTeam1 ? 'team2' : 'tie';
              const predWinner = predTeam1 > predTeam2 ? 'team1' : predTeam2 > predTeam1 ? 'team2' : 'tie';
              
              if (actualWinner === predWinner && actualWinner !== 'tie') {
                correctCount++;
              }
            }
          }
        });
      }
      
      csv += `${correctCount},`;  // <--- ADD CORRECT PICKS COUNT
      
      if (!hasPicks || !pick.timestamp) {
        csv += `"-"\n`;
      } else {
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
      }
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

// Download picks as CSV spreadsheet - REGULAR VERSION (visible players only - INCLUDING DASH ROWS)
const downloadPicksAsCSV = () => {
  const currentWeekData = PLAYOFF_WEEKS[currentWeek];

  // ===== Get the SAME players shown in the visible table (with picks AND dashes) =====
  const displayPicks = (() => {
    if (currentWeek === 'superbowl') {
      // For Super Bowl, show ALL unique players
      const uniquePlayers = new Map();
      allPicks.forEach(pick => {
        if (!uniquePlayers.has(pick.playerCode)) {
          const superbowlPick = allPicks.find(p => p.playerCode === pick.playerCode && p.week === 'superbowl');
          uniquePlayers.set(pick.playerCode, superbowlPick || {
            playerName: pick.playerName,
            playerCode: pick.playerCode,
            week: 'superbowl',
            predictions: {},
            timestamp: pick.timestamp,
            lastUpdated: pick.lastUpdated || pick.timestamp
          });
        }
      });
      
      // Add players marked as "showInPicksTable" even if no picks
      allPlayers.forEach(player => {
        if (player.showInPicksTable === true && !uniquePlayers.has(player.playerCode)) {
          uniquePlayers.set(player.playerCode, {
            playerName: player.playerName,
            playerCode: player.playerCode,
            week: 'superbowl',
            predictions: {},
            timestamp: Date.now(),
            lastUpdated: Date.now()
          });
        }
      });
      
      return Array.from(uniquePlayers.values());
    } else {
      // For other weeks, show players with picks OR all visible players
      const picksForWeek = allPicks.filter(pick => pick.week === currentWeek);
      const displayedCodes = new Set(picksForWeek.map(p => p.playerCode));
      
      // ✅ FIX: Add ALL paid, visible, regular players (even without picks)
      allPlayers.forEach(player => {
        // Show player if:
        // 1. They are paid
        // 2. They are visible (not hidden)
        // 3. They are a regular player (not pool manager)
        // 4. Not already in the list
        // const isPaid = player.paid === true;
        // const isVisible = player.visible !== false;
        // const isRegularPlayer = player.role !== 'MANAGER';
        
        // if (isPaid && isVisible && isRegularPlayer && !displayedCodes.has(player.playerCode)) {
        
        // Check if paid: either paid field OR paymentStatus field
        const isPaid = player.paid === true || player.paymentStatus === 'PAID';
        const isVisible = player.visible !== false;
        const isRegularPlayer = player.role !== 'MANAGER';
        
        if (isPaid && isVisible && isRegularPlayer && !displayedCodes.has(player.playerCode)) {
          picksForWeek.push({
            playerName: player.playerName,
            playerCode: player.playerCode,
            week: currentWeek,
            predictions: {},
            timestamp: Date.now(),
            lastUpdated: Date.now()
          });
        }
      });
      
      return picksForWeek;
    }
  })();

  if (displayPicks.length === 0) {
    alert('No picks to download for this week.');
    return;
  }

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
    csv += ',,,,';
  }
  csv += '\n';
  
  // Row 2: Team Names
  csv += 'TEAM NAMES:,';
  currentWeekData.games.forEach(game => {
    const team1Name = getTeamName(currentWeek, game.id, 'team1', playoffTeams);
    const team2Name = getTeamName(currentWeek, game.id, 'team2', playoffTeams);
    csv += `${team1Name},${team2Name},`;
  });
  if (currentWeek === 'superbowl') {
    csv += ',,,,';
  }
  csv += '\n';
  
  // Row 3: Actual Scores
  csv += 'ACTUAL SCORES:,';
  currentWeekData.games.forEach(game => {
    const actualTeam1 = actualScores[currentWeek]?.[game.id]?.team1 || '-';
    const actualTeam2 = actualScores[currentWeek]?.[game.id]?.team2 || '-';
    csv += `${actualTeam1},${actualTeam2},`;
  });
  if (currentWeek === 'superbowl') {
    csv += ',,,,';
  }
  csv += '\n';
  
  // Row 4: Combined Game Totals
  csv += 'GAME TOTALS:,';
  currentWeekData.games.forEach(game => {
    const actualTeam1 = parseInt(actualScores[currentWeek]?.[game.id]?.team1) || 0;
    const actualTeam2 = parseInt(actualScores[currentWeek]?.[game.id]?.team2) || 0;
    const gameTotal = actualTeam1 + actualTeam2;
    const gameTotalDisplay = (actualTeam1 > 0 || actualTeam2 > 0) ? gameTotal : '-';
    csv += `${gameTotalDisplay},,`;
  });
  if (currentWeek === 'superbowl') {
    csv += ',,,,';
  }
  csv += '\n';
  
  // Row 5: Game Status
  csv += 'GAME STATUS:,';
  currentWeekData.games.forEach(game => {
    const status = gameStatus[currentWeek]?.[game.id] || '-';
    const statusText = status === 'final' ? 'FINAL' : (status === 'live' ? 'LIVE' : '-');
    csv += `${statusText},,`;
  });
  if (currentWeek === 'superbowl') {
    csv += ',,,,';
  }
  csv += '\n';
  
  // Row 6: Official Totals
  csv += 'OFFICIAL TOTALS:,';
  currentWeekData.games.forEach(() => {
    csv += ',,';
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
  
  // Row 7: Blank separator
  csv += '\n';

  // Headers
  csv += ',';
  currentWeekData.games.forEach(game => {
    csv += `Game ${game.id},Game ${game.id},`;
  });
  csv += '\n';

  csv += 'Player Name,';
  currentWeekData.games.forEach(game => {
    const team1Name = getTeamName(currentWeek, game.id, 'team1', playoffTeams);
    const team2Name = getTeamName(currentWeek, game.id, 'team2', playoffTeams);
    csv += `${team1Name},${team2Name},`;
  });
  
if (currentWeek === 'superbowl') {
  csv += 'Week 4 Total,Week 3 Total,Week 2 Total,Week 1 Total,GRAND TOTAL,';
} else {
  csv += 'Total Points,';
}
csv += 'Correct Picks,';  // <--- NEW COLUMN ADDED HERE
csv += 'Perfect Scores,';  // <--- ADD THIS LINE
csv += 'Submitted At\n';

  // Data rows - Sort by picks first, then alphabetically
  displayPicks
    .sort((a, b) => {
      const aHasPicks = Object.keys(a.predictions).length > 0;
      const bHasPicks = Object.keys(b.predictions).length > 0;
      
      if (aHasPicks && !bHasPicks) return -1;
      if (!aHasPicks && bHasPicks) return 1;
      
      if (aHasPicks && bHasPicks) {
        return (b.lastUpdated || b.timestamp || 0) - (a.lastUpdated || a.timestamp || 0);
      }
      
      return a.playerName.localeCompare(b.playerName);
    })
    .forEach(pick => {
      csv += `"${pick.playerName}",`;
      
      const hasPicks = Object.keys(pick.predictions).length > 0;
      
      currentWeekData.games.forEach(game => {
        const team1Score = pick.predictions[game.id]?.team1 || '-';
        const team2Score = pick.predictions[game.id]?.team2 || '-';
        csv += `${team1Score},${team2Score},`;
      });
      
      if (currentWeek === 'superbowl') {
        const week4Total = (() => {
          const w4Pick = allPicks.find(p => p.playerCode === pick.playerCode && p.week === 'superbowl');
          if (!w4Pick) return '-';
          let sum = 0;
          PLAYOFF_WEEKS.superbowl.games.forEach(game => {
            const pred = w4Pick.predictions[game.id];
            if (pred) sum += (Number(pred.team1) || 0) + (Number(pred.team2) || 0);
          });
          return sum > 0 ? sum : '-';
        })();

        const week3Total = (() => {
          const w3Pick = allPicks.find(p => p.playerCode === pick.playerCode && p.week === 'conference');
          if (!w3Pick) return '-';
          let sum = 0;
          PLAYOFF_WEEKS.conference.games.forEach(game => {
            const pred = w3Pick.predictions[game.id];
            if (pred) sum += (Number(pred.team1) || 0) + (Number(pred.team2) || 0);
          });
          return sum > 0 ? sum : '-';
        })();

        const week2Total = (() => {
          const w2Pick = allPicks.find(p => p.playerCode === pick.playerCode && p.week === 'divisional');
          if (!w2Pick) return '-';
          let sum = 0;
          PLAYOFF_WEEKS.divisional.games.forEach(game => {
            const pred = w2Pick.predictions[game.id];
            if (pred) sum += (Number(pred.team1) || 0) + (Number(pred.team2) || 0);
          });
          return sum > 0 ? sum : '-';
        })();

        const week1Total = (() => {
          const w1Pick = allPicks.find(p => p.playerCode === pick.playerCode && p.week === 'wildcard');
          if (!w1Pick) return '-';
          let sum = 0;
          PLAYOFF_WEEKS.wildcard.games.forEach(game => {
            const pred = w1Pick.predictions[game.id];
            if (pred) sum += (Number(pred.team1) || 0) + (Number(pred.team2) || 0);
          });
          return sum > 0 ? sum : '-';
        })();

        const totals = [week4Total, week3Total, week2Total, week1Total].filter(t => t !== '-');
        const grandTotal = totals.length > 0 ? totals.reduce((sum, t) => sum + t, 0) : '-';
        
        csv += `${week4Total},${week3Total},${week2Total},${week1Total},${grandTotal},`;
      } else {
        if (!hasPicks) {
          csv += '-,';
        } else {
          const totalPoints = currentWeekData.games.reduce((total, game) => {
            const team1Score = parseInt(pick.predictions[game.id]?.team1) || 0;
            const team2Score = parseInt(pick.predictions[game.id]?.team2) || 0;
            return total + team1Score + team2Score;
          }, 0);
          csv += `${totalPoints},`;
        }
      }
      
      // Calculate correct picks for this player (BEFORE timestamp)
      let correctCount = 0;
      if (hasPicks) {
        currentWeekData.games.forEach(game => {
          const pred = pick.predictions[game.id];
          const actual = actualScores[currentWeek]?.[game.id];
          
          if (pred && actual && pred.team1 && pred.team2 && actual.team1 && actual.team2) {
            const actualTeam1 = parseInt(actual.team1);
            const actualTeam2 = parseInt(actual.team2);
            const predTeam1 = parseInt(pred.team1);
            const predTeam2 = parseInt(pred.team2);
            
            if (!isNaN(actualTeam1) && !isNaN(actualTeam2)) {
              const actualWinner = actualTeam1 > actualTeam2 ? 'team1' : actualTeam2 > actualTeam1 ? 'team2' : 'tie';
              const predWinner = predTeam1 > predTeam2 ? 'team1' : predTeam2 > predTeam1 ? 'team2' : 'tie';
              
              if (actualWinner === predWinner && actualWinner !== 'tie') {
                correctCount++;
              }
            }
          }
        });
      }
      
      // csv += `${correctCount},`;  // Add correct picks count
      
      // Now add timestamp (AFTER correct picks)
      // if (!hasPicks || !pick.timestamp) {

      csv += `${correctCount},`;  // Add correct picks count

      // Calculate perfect scores
      let perfectCount = 0;
      if (hasPicks) {
        currentWeekData.games.forEach(game => {
          const pred = pick.predictions[game.id];
          const actual = actualScores[currentWeek]?.[game.id];
          
          if (pred && actual && pred.team1 && pred.team2 && actual.team1 && actual.team2) {
            const actualTeam1 = parseInt(actual.team1);
            const actualTeam2 = parseInt(actual.team2);
            const predTeam1 = parseInt(pred.team1);
            const predTeam2 = parseInt(pred.team2);
            
            // PERFECT SCORE: Both teams exactly correct
            if (actualTeam1 === predTeam1 && actualTeam2 === predTeam2) {
              perfectCount++;
            }
          }
        });
      }

      csv += `${perfectCount},`;  // Add perfect scores count

      // Now add timestamp (AFTER perfect scores)
      if (!hasPicks || !pick.timestamp) {
        csv += `"-"\n`;
      } else {
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
      }
    });

  // Download
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
    
    // STEP 5 VALIDATION: Check for incomplete entries (allow dashes)
    const missing = [];
    currentWeekData.games.forEach(game => {
      const t1 = predictions[game.id]?.team1;
      const t2 = predictions[game.id]?.team2;
      // Allow dashes or numbers, but not empty
      const isValid = (val) => val === '-' || (val && val.toString().trim() !== '');
      if (!predictions[game.id] || !isValid(t1) || !isValid(t2)) {
        missing.push(game.id);
      }
    });
    
    if (missing.length > 0) {
      setMissingGames(missing);
      setShowPopup('incomplete');
      return;
    }   

    // STEP 5 VALIDATION: Check for invalid scores (skip validation for dashes)
    const invalid = [];
    currentWeekData.games.forEach(game => {
      const t1 = predictions[game.id]?.team1;
      const t2 = predictions[game.id]?.team2;
      
      // Skip validation if EITHER is a dash (means "no pick" or partial entry)
      if (t1 === '-' || t2 === '-') {
        return; // Valid - no validation needed for dashes
      }
      
      // Otherwise validate as numbers
      const t1Num = parseInt(t1);
      const t2Num = parseInt(t2);
      if (isNaN(t1Num) || isNaN(t2Num) || t1Num < 0 || t2Num < 0) {
        invalid.push(game.id);
      }
    });

    if (invalid.length > 0) {
      setInvalidScores(invalid);
      setShowPopup('invalidScores');
      return;
    }
    
    // STEP 5 VALIDATION: Check for tied games (skip if dashes)
    const tiedGames = [];
    currentWeekData.games.forEach(game => {
      const t1 = predictions[game.id]?.team1;
      const t2 = predictions[game.id]?.team2;
      
      // Skip if dashes
      if (t1 === '-' || t2 === '-') {
        return; // No validation needed for dashes
      }
      
      const t1Num = parseInt(t1);
      const t2Num = parseInt(t2);
      if (t1Num === t2Num) {
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

      // ✅ NEW: Clean predictions - convert dashes to empty strings
      const cleanedPredictions = {};
      Object.keys(predictions).forEach(gameId => {
        const pred = predictions[gameId];
        if (pred) {
          // If team1 or team2 is a dash "-", treat as empty string
          cleanedPredictions[gameId] = {
            team1: (pred.team1 === '-' || pred.team1 === '') ? '' : pred.team1,
            team2: (pred.team2 === '-' || pred.team2 === '') ? '' : pred.team2
          };
        }
      });

      const pickData = {
        playerName,
        playerCode,
        week: currentWeek,
        predictions: cleanedPredictions, // ✅ Use cleaned predictions instead of raw predictions
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
  
  // For Super Bowl, get ALL unique players from ANY week
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
              week: currentWeek,
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
    
    // Calculate current week total with slash format when actuals exist
    let currentTotal = 0;
    const weekGames = PLAYOFF_WEEKS[currentWeek].games;
    weekGames.forEach(game => {
      const pred = pick.predictions[game.id];
      if (pred && pred.team1 && pred.team2) {
        currentTotal += (parseInt(pred.team1) || 0) + (parseInt(pred.team2) || 0);
      }
    });
    
    // Check if current week has actual scores
    const weekActualScores = actualScores[currentWeek];
    const hasActual = weekActualScores && Object.values(weekActualScores).some(game => {
      return game && 
             game.team1 !== null && game.team1 !== undefined && game.team1 !== '' && game.team1 !== 0 &&
             game.team2 !== null && game.team2 !== undefined && game.team2 !== '' && game.team2 !== 0;
    });
    
    // Calculate difference if actuals exist
    let currentDisplay = currentTotal.toString();
    if (hasActual) {
      let actualTotal = 0;
      weekGames.forEach(game => {
        const actual = weekActualScores?.[game.id];
        if (actual && actual.team1 && actual.team2) {
          actualTotal += (parseInt(actual.team1) || 0) + (parseInt(actual.team2) || 0);
        }
      });
      
      const difference = Math.abs(currentTotal - actualTotal);
      currentDisplay = `${currentTotal}/${difference}`;
    }
    
    totals[pick.playerName].current = currentDisplay;
    
    // ✅ FIX: For Super Bowl week, calculate grand total using formatGrandDisplay
    if (currentWeek === 'superbowl') {
    // Also calculate individual week displays for the table
    totals[pick.playerName].week4Display = formatWeeklyDisplay(pick.playerCode, 'superbowl', 4).display;
    totals[pick.playerName].week3Display = formatWeeklyDisplay(pick.playerCode, 'conference', 3).display;
    totals[pick.playerName].week2Display = formatWeeklyDisplay(pick.playerCode, 'divisional', 2).display;
    totals[pick.playerName].week1Display = formatWeeklyDisplay(pick.playerCode, 'wildcard', 1).display;
    const gd = formatGrandDisplay(pick.playerCode);
    totals[pick.playerName].grand = gd.display;
    totals[pick.playerName].grandTooltip = gd.tooltip;
    totals[pick.playerName].grandFontSize = gd.fontSize;
    }
  });
    return totals;
}, [allPicks, currentWeek, actualScores]);

const calculateAllPrizeWinners = () => {
  console.log('🏆 Starting winner calculations...');
  
  // STEP 1: Convert allPicks array to object format the functions expect
  const picksObject = {};
  
  allPicks.forEach(pick => {
    if (pick.firebaseKey && pick.playerCode && pick.predictions) {
      // Initialize player if not exists
      if (!picksObject[pick.playerCode]) {
        picksObject[pick.playerCode] = {
          name: pick.playerName,
          picks: {}
        };
      }
      
      // Convert predictions array to object (skip index 0)
      const predictionsObj = {};
      
      if (Array.isArray(pick.predictions)) {
        pick.predictions.forEach((pred, index) => {
          if (index > 0 && pred) {
            predictionsObj[index.toString()] = pred;
          }
        });
      } else {
        Object.assign(predictionsObj, pick.predictions);
      }
      
      // Add this week's picks to the player
      picksObject[pick.playerCode].picks[pick.week] = predictionsObj;
    }
  });
  
// STEP 2: Convert actualScores to ensure string keys
  const actualScoresObj = {};
  
  Object.keys(actualScores).forEach(week => {
    if (actualScores[week]) {
      const weekObj = {};
      Object.keys(actualScores[week]).forEach(gameId => {
        // Ensure game ID is a string
        weekObj[gameId.toString()] = actualScores[week][gameId];
      });
      actualScoresObj[week] = weekObj;
    }
  });
  
  console.log('📊 Converted picks:', Object.keys(picksObject).length, 'players');
  console.log('📊 Converted scores:', Object.keys(actualScoresObj));
  
  // STEP 3: Run all calculations
  const results = {
    week1: {
      prize1: calculateWeekPrize1(picksObject, actualScoresObj, 'wildcard'),
      prize2: calculateWeekPrize2(picksObject, actualScoresObj, 'wildcard')
    },
    week2: {
      prize1: calculateWeekPrize1(picksObject, actualScoresObj, 'divisional'),
      prize2: calculateWeekPrize2(picksObject, actualScoresObj, 'divisional')
    },
    week3: {
      prize1: calculateWeekPrize1(picksObject, actualScoresObj, 'conference'),
      prize2: calculateWeekPrize2(picksObject, actualScoresObj, 'conference')
    },
    week4: {
      prize1: calculateWeek4Prize1(picksObject, actualScoresObj),
      prize2: calculateWeek4Prize2(picksObject, actualScoresObj)
    },
    grandPrize: {
      prize1: calculateGrandPrize1(picksObject, actualScoresObj),
      prize2: calculateGrandPrize2(picksObject, actualScoresObj)
    }
  };
  
  console.log('✅ All calculations complete!');
  console.log('📊 Results:', results);
  
  return results;
};

// Calculate winners whenever picks or scores change
  useEffect(() => {
    if (allPicks.length > 0 && actualScores) {
      try {
        const results = calculateAllPrizeWinners();
        // Only update if results are valid
        if (results && typeof results === 'object') {
          setCalculatedWinners(results);
          
          // Save to Firebase
          set(ref(database, 'calculatedWinners'), results);
        }
      } catch (error) {
        console.error('Error calculating winners:', error);
        // Don't crash - just log the error and continue
      }
    }
  }, [allPicks, actualScores]);
  return (
    <div className="App">
      {/* 🕐 PST CLOCK BANNER - Only shows Friday during playoffs */}
      {showPSTClock && (
        <div style={{
          background: timeRemaining.hours === 0 && timeRemaining.minutes < 60 && !timeRemaining.expired ? '#dc3545' : '#667eea',
          color: '#fff',
          padding: '20px',
          marginBottom: '20px',
          borderRadius: '8px',
          border: '3px solid ' + (timeRemaining.hours === 0 && timeRemaining.minutes < 60 && !timeRemaining.expired ? '#a71d2a' : '#5568d3'),
          textAlign: 'center',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          {/* Header Warning - ALL TIMES ARE PST */}
          <div style={{
            fontSize: '1.1rem',
            fontWeight: '700',
            marginBottom: '15px',
            letterSpacing: '0.5px',
            borderBottom: '2px solid rgba(255,255,255,0.3)',
            paddingBottom: '10px',
            color: '#fff'
          }}>
            ⚠️ ALL TIMES IN THIS APP ARE IN PACIFIC STANDARD TIME (PST) ⚠️
          </div>
          
          {/* Session Info - Static, no live updates */}
          <div style={{
            fontSize: '1.1rem',
            fontWeight: '600',
            marginBottom: '15px',
            color: '#fff',
            backgroundColor: 'rgba(255,255,255,0.1)',
            padding: '15px',
            borderRadius: '8px',
            lineHeight: '1.8'
          }}>
            <div style={{fontSize: '1.2rem', fontWeight: '700', marginBottom: '10px'}}>
              🕐 Your Session Info:
            </div>
            <div style={{paddingLeft: '10px'}}>
              • Player logged in and loaded page at: {pstTime.toLocaleTimeString('en-US', {
                timeZone: 'America/Los_Angeles',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
              })} PST
            </div>
            <div style={{paddingLeft: '10px'}}>
              • Today's date: {pstTime.toLocaleDateString('en-US', {
                timeZone: 'America/Los_Angeles',
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric'
              })}
            </div>
            <div style={{paddingLeft: '10px'}}>
              • Current deadline: 11:59 PM PST tonight
            </div>
          </div>
          
          {/* Deadline Warning */}
          {!timeRemaining.expired ? (
            <div style={{
              background: 'rgba(255,193,7,0.2)',
              border: '2px solid #ffc107',
              padding: '15px',
              borderRadius: '8px',
              marginTop: '10px'
            }}>
              <div style={{
                fontSize: '1.4rem',
                fontWeight: '700',
                marginBottom: '8px',
                color: '#fff'
              }}>
                ⏰ IMPORTANT: Picks must be submitted before 11:59 PM PST tonight!
              </div>
              <div style={{
                fontSize: '1rem',
                marginTop: '12px',
                padding: '12px',
                background: 'rgba(255,255,255,0.15)',
                borderRadius: '6px',
                color: '#fff',
                lineHeight: '1.6'
              }}>
                💡 TIP: This time doesn't update automatically.<br/>
                Reload your browser to see the most current information.<br/>
                <span style={{fontSize: '0.9rem', opacity: 0.9}}>
                  (On mobile: Pull down to refresh. On computer: Press F5)
                </span>
              </div>
            </div>
          ) : (
            <div style={{
              background: '#28a745',
              padding: '15px',
              borderRadius: '6px',
              fontSize: '1.3rem',
              fontWeight: '700',
              marginTop: '10px',
              color: '#fff'
            }}>
              ✅ PICKS ARE LOCKED - Games In Progress
              <div style={{fontSize: '1rem', marginTop: '8px', fontWeight: '500'}}>
                Picks closed at: 11:59 PM PST
              </div>
            </div>
          )}
        </div>
      )}
      
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
              📖 View Full Rulebook (22 Pages)
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

        {/* ✅ NEW: POOL MANAGER OVERRIDE - CLOSE WEEK & CONFIGURE NEXT */}
        {isPoolManager() && (
          <div style={{
            background: 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)',
            color: 'white',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '20px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{margin: '0 0 10px 0'}}>🔒 Close Completed Weeks & Configure Next Week</h3>
            <p style={{fontSize: '0.9rem', margin: '0 0 15px 0', opacity: 0.9}}>
              After all games for a week are FINAL, close that week to configure the next week's teams immediately.
            </p>
            
            <div style={{display: 'flex', gap: '15px', flexWrap: 'wrap'}}>
              {/* Week 1 Close Button */}
              <div style={{
                flex: '1 1 200px',
                padding: '15px',
                border: '2px solid rgba(255,255,255,0.3)',
                borderRadius: '8px',
                backgroundColor: weekCompletionStatus?.wildcard ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)'
              }}>
                <div style={{fontWeight: 'bold', marginBottom: '10px'}}>
                  Week 1 (Wildcard)
                </div>
                {weekCompletionStatus && weekCompletionStatus?.wildcard ? (
                  <div style={{color: '#fff', fontWeight: 'bold'}}>
                    ✅ Completed
                  </div>
                ) : weekCompletionStatus && areAllGamesFinal('wildcard') ? (
                  <button
                    onClick={() => handleCloseWeekAndConfigureNext('wildcard')}
                    style={{
                      padding: '10px 15px',
                      backgroundColor: '#fff',
                      color: '#4caf50',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    🔒 Close Week 1 & Configure Week 2
                  </button>
                ) : (
                  <div style={{fontSize: '0.9rem', opacity: 0.8}}>
                    ⏳ Loading...
                  </div>
                )}
              </div>

              {/* Week 2 Close Button */}
              <div style={{
                flex: '1 1 200px',
                padding: '15px',
                border: '2px solid rgba(255,255,255,0.3)',
                borderRadius: '8px',
                backgroundColor: weekCompletionStatus?.divisional ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)'
              }}>
                <div style={{fontWeight: 'bold', marginBottom: '10px'}}>
                  Week 2 (Divisional)
                </div>
                {weekCompletionStatus && weekCompletionStatus?.divisional ? (
                  <div style={{color: '#fff', fontWeight: 'bold'}}>
                    ✅ Completed
                  </div>
                ) : weekCompletionStatus && areAllGamesFinal('divisional') ? (
                  <button
                    onClick={() => handleCloseWeekAndConfigureNext('divisional')}
                    style={{
                      padding: '10px 15px',
                      backgroundColor: '#fff',
                      color: '#4caf50',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    🔒 Close Week 2 & Configure Week 3
                  </button>
                ) : (
                  <div style={{fontSize: '0.9rem', opacity: 0.8}}>
                    ⏳ Loading...
                  </div>
                )}
              </div>

              {/* Week 3 Close Button */}
              <div style={{
                flex: '1 1 200px',
                padding: '15px',
                border: '2px solid rgba(255,255,255,0.3)',
                borderRadius: '8px',
                backgroundColor: weekCompletionStatus?.conference ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)'
              }}>
                <div style={{fontWeight: 'bold', marginBottom: '10px'}}>
                  Week 3 (Conference)
                </div>
                {weekCompletionStatus && weekCompletionStatus?.conference ? (
                  <div style={{color: '#fff', fontWeight: 'bold'}}>
                    ✅ Completed
                  </div>
                ) : weekCompletionStatus && areAllGamesFinal('conference') ? (
                  <button
                    onClick={() => handleCloseWeekAndConfigureNext('conference')}
                    style={{
                      padding: '10px 15px',
                      backgroundColor: '#fff',
                      color: '#4caf50',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    🔒 Close Week 3 & Configure Week 4
                  </button>
                ) : (
                  <div style={{fontSize: '0.9rem', opacity: 0.8}}>
                    ⏳ Loading...
                  </div>
                )}
              </div>

              {/* Week 4 Close Button */}
              <div style={{
                flex: '1 1 200px',
                padding: '15px',
                border: '2px solid rgba(255,255,255,0.3)',
                borderRadius: '8px',
                backgroundColor: weekCompletionStatus?.superbowl ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)'
              }}>
                <div style={{fontWeight: 'bold', marginBottom: '10px'}}>
                  Week 4 (Super Bowl)
                </div>
                  {weekCompletionStatus && weekCompletionStatus?.superbowl ? (
                  <div style={{color: '#fff', fontWeight: 'bold'}}>
                    ✅ Completed
                  </div>
                ) : weekCompletionStatus && areAllGamesFinal('superbowl') ? (
                  <button
                    onClick={() => handleCloseWeekAndConfigureNext('superbowl')}
                    style={{
                      padding: '10px 15px',
                      backgroundColor: '#fff',
                      color: '#4caf50',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    🔒 Close Week 4 - Playoffs Complete!
                  </button>
                ) : (
                  <div style={{fontSize: '0.9rem', opacity: 0.8}}>
                    ⏳ Loading...
                  </div>
                )}
              </div>
            </div>
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
                      Game {game.id}: {getTeamName(currentWeek, game.id, 'team1', playoffTeams)} vs {getTeamName(currentWeek, game.id, 'team2', playoffTeams)}
                    </div>
                    <div style={{fontSize: '1.2rem', fontWeight: '700', color: '#9b59b6'}}>
                      {rngPreview[game.id].team1} - {rngPreview[game.id].team2}
                      {rngPreview[game.id].team1 > rngPreview[game.id].team2 
                        ? ` (${getTeamName(currentWeek, game.id, 'team1', playoffTeams)} wins)` 
                        : ` (${getTeamName(currentWeek, game.id, 'team2', playoffTeams)} wins)`}
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
              📝 #1 Make Picks & Logout
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
              🏆 #2 Standings & Prizes
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
            <button
              className={`nav-btn ${currentView === 'winners' ? 'active' : ''}`}
              onClick={() => setCurrentView('winners')}
            >
            ⚖️ #3 How Winners Are Determined
              {currentView === 'winners' && (
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
            
            {/* 💰 NEW PAYMENTS BUTTON - PASTE THIS ENTIRE BLOCK */}
            {isPoolManager() && (
              <button
                className={`nav-btn ${currentView === 'payments' ? 'active' : ''}`}
                onClick={() => setCurrentView('payments')}
              >
                💰 Payments
                <span style={{
                  marginLeft: '8px',
                  fontSize: '0.7rem',
                  padding: '2px 6px',
                  background: '#667eea',
                  color: 'white',
                  borderRadius: '10px',
                  fontWeight: '500'
                }}>
                  Pool Manager
                </span>
                {currentView === 'payments' && (
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
            )}
            {/* END NEW PAYMENTS BUTTON */}
            
            {isPoolManager() && (
              <button
                className={`nav-btn ${currentView === 'playoffSetup' ? 'active' : ''}`}
                onClick={() => setCurrentView('playoffSetup')}
              >
                ⚙️ Setup Playoff Teams
                <span style={{
                  marginLeft: '8px',
                  fontSize: '0.7rem',
                  padding: '2px 6px',
                  background: '#667eea',
                  color: 'white',
                  borderRadius: '10px',
                  fontWeight: '500'
                }}>
                  Pool Manager
                </span>
                {currentView === 'playoffSetup' && (
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
            )}
            {isPoolManager() && (
              <button
                className={`nav-btn ${currentView === 'loginLogs' ? 'active' : ''}`}
                onClick={() => setCurrentView('loginLogs')}
              >
                🔐 Login Logs
                <span style={{
                  marginLeft: '8px',
                  fontSize: '0.7rem',
                  padding: '2px 6px',
                  background: '#667eea',
                  color: 'white',
                  borderRadius: '10px',
                  fontWeight: '500'
                }}>
                  Pool Manager
                </span>
                {currentView === 'loginLogs' && (
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
            )}

            {/* 🔄 MIGRATION BUTTON - ADD THIS */}
            {isPoolManager() && (
              <button
                className="nav-btn"
                style={{ background: '#10b981', color: 'white' }}
                onClick={async () => {
                  if (!confirm('Create players table in Firebase?\n\nThis will add all ' + Object.keys(PLAYER_CODES).length + ' players to Firebase.')) return;
                  
                  try {
                    const playersRef = ref(database, 'players');
                    const snapshot = await get(playersRef);
                    
                    if (snapshot.exists()) {
                      alert('✅ Players table already exists in Firebase!');
                      return;
                    }
                    
                    let count = 0;
                    for (const [code, name] of Object.entries(PLAYER_CODES)) {
                      await push(ref(database, 'players'), {
                        playerCode: code,
                        playerName: name,
                        role: POOL_MANAGER_CODES.includes(code) ? 'MANAGER' : 'PLAYER',
                        paymentStatus: 'UNPAID',
                        paymentTimestamp: '',
                        paymentMethod: '',
                        paymentAmount: 0,
                        visibleToPlayers: true,
                        createdAt: Date.now(),
                        updatedAt: Date.now()
                      });
                      count++;
                    }
                    
                    alert('✅ SUCCESS!\n\nCreated ' + count + ' players in Firebase!\n\nREFRESH THE PAGE NOW!');
                  } catch (error) {
                    alert('❌ Error: ' + error.message);
                    console.error('Migration error:', error);
                  }
                }}
              >
                🔄 Create Players Table
                <span style={{
                  marginLeft: '8px',
                  fontSize: '0.7rem',
                  padding: '2px 6px',
                  background: '#059669',
                  color: 'white',
                  borderRadius: '10px',
                  fontWeight: '500'
                }}>
                  One-Time Setup
                </span>
              </button>
            )}
            
{/* ➕ ADD NEW PLAYER BUTTON */}
            {isPoolManager() && (
              <button
                className="nav-btn"
                style={{ background: '#3b82f6', color: 'white' }}
                onClick={async () => {
                  const newName = prompt('Enter new player name:');
                  if (!newName || !newName.trim()) {
                    alert('❌ Cancelled - no name entered');
                    return;
                  }
                  
                  const newCode = prompt('Enter 6-character access code\n(or leave blank to auto-generate):');
                  const code = newCode && newCode.trim() ? 
                               newCode.trim().toUpperCase() : 
                               Math.random().toString(36).substring(2, 8).toUpperCase();
                  
                  if (code.length !== 6) {
                    alert('❌ Access code must be exactly 6 characters!');
                    return;
                  }
                  
                  const playersRef = ref(database, 'players');
                  const snapshot = await get(playersRef);
                  
                  if (snapshot.exists()) {
                    const existingPlayers = snapshot.val();
                    const codeExists = Object.values(existingPlayers).some(p => p.playerCode === code);
                    
                    if (codeExists) {
                      alert(`❌ Code "${code}" already exists! Please use a different code.`);
                      return;
                    }
                  }
                  
                  try {
                    await push(playersRef, {
                      playerCode: code,
                      playerName: newName.trim(),
                      role: 'PLAYER',
                      paymentStatus: 'UNPAID',
                      paymentTimestamp: '',
                      paymentMethod: '',
                      paymentAmount: 0,
                      visibleToPlayers: true,
                      createdAt: Date.now(),
                      updatedAt: Date.now()
                    });
                    
                    alert(
                      `✅ PLAYER ADDED!\n\n` +
                      `Name: ${newName.trim()}\n` +
                      `Access Code: ${code}\n\n` +
                      `📧 Give this code to the player!`
                    );
                  } catch (error) {
                    alert('❌ Error: ' + error.message);
                  }
                }}
              >
                ➕ Add New Player
                <span style={{
                  marginLeft: '8px',
                  fontSize: '0.7rem',
                  padding: '2px 6px',
                  background: '#2563eb',
                  color: 'white',
                  borderRadius: '10px',
                  fontWeight: '500'
                }}>
                  Pool Manager
                </span>
              </button>
            )}
            
            {/* 🔄 ADD TABLE FIELD BUTTON - PASTE HERE! */}
            {isPoolManager() && (
              <button
                className="nav-btn"
                style={{ background: '#f59e0b', color: 'white' }}
                onClick={async () => {
                  if (!confirm('Add showInPicksTable field to all players?')) return;
                  
                  try {
                    const playersRef = ref(database, 'players');
                    const snapshot = await get(playersRef);
                    
                    if (!snapshot.exists()) {
                      alert('❌ No players found');
                      return;
                    }
                    
                    const players = snapshot.val();
                    let count = 0;
                    
                    for (const [key, player] of Object.entries(players)) {
                      if (player.showInPicksTable === undefined) {
                        const playerRef = ref(database, `players/${key}`);
                        await update(playerRef, {
                          showInPicksTable: false
                        });
                        count++;
                      }
                    }
                    
                    alert(`✅ Added showInPicksTable to ${count} players!\n\nREFRESH PAGE NOW!`);
                  } catch (error) {
                    alert('❌ Error: ' + error.message);
                  }
                }}
              >
                🔄 Add Table Field
                <span style={{
                  marginLeft: '8px',
                  fontSize: '0.7rem',
                  padding: '2px 6px',
                  background: '#d97706',
                  color: 'white',
                  borderRadius: '10px',
                  fontWeight: '500'
                }}>
                  One-Time
                </span>
              </button>
            )}
            
            {/* 📥 EXPORT PLAYERS TO EXCEL BUTTON */}
            {isPoolManager() && (
              <button
                className="nav-btn"
                style={{ background: '#10b981', color: 'white' }}
                onClick={exportPlayersToExcel}
              >
                📥 Download All Players (Excel)
                <span style={{
                  marginLeft: '8px',
                  fontSize: '0.7rem',
                  padding: '2px 6px',
                  background: '#059669',
                  color: 'white',
                  borderRadius: '10px',
                  fontWeight: '500'
                }}>
                  Backup
                </span>
              </button>
            )}

            {/* ⚠️ EMERGENCY: SYNC PLAYER CODES (App.jsx → Firebase) */}
            {isPoolManager() && (
              <button
                className="nav-btn"
                style={{ background: '#dc2626', color: 'white' }}
                onClick={async () => {
                  // STEP 1: Show checkbox confirmation dialog
                  const checkboxConfirmed = window.confirm(
                    '⚠️⚠️⚠️ EMERGENCY OVERRIDE ⚠️⚠️⚠️\n\n' +
                    'This will OVERWRITE all player codes in Firebase\n' +
                    'with the hardcoded PLAYER_CODES from App.jsx.\n\n' +
                    '❌ Any codes manually updated in Firebase will be LOST!\n' +
                    '❌ This should ONLY be used in emergencies!\n\n' +
                    'Firebase is the SOURCE OF TRUTH.\n' +
                    'App.jsx is only a backup.\n\n' +
                    'Are you SURE you want to override Firebase?'
                  );
                  
                  if (!checkboxConfirmed) return;
                  
                  // STEP 2: Final confirmation
                  const finalConfirm = window.confirm(
                    '🚨 FINAL WARNING 🚨\n\n' +
                    'Type YES in the next prompt to proceed.\n\n' +
                    'This action CANNOT be undone!\n\n' +
                    'Click OK to continue or Cancel to abort.'
                  );
                  
                  if (!finalConfirm) return;
                  
                  // STEP 3: Require typing "YES"
                  const typedConfirmation = prompt(
                    '⚠️ Type YES (all caps) to confirm:\n\n' +
                    'I understand this will ERASE all Firebase player codes\n' +
                    'and replace them with App.jsx PLAYER_CODES.'
                  );
                  
                  if (typedConfirmation !== 'YES') {
                    alert('❌ Cancelled - you must type YES exactly.');
                    return;
                  }
                  
                  // STEP 4: Execute override
                  try {
                    const playersRef = ref(database, 'players');
                    const snapshot = await get(playersRef);
                    
                    if (!snapshot.exists()) {
                      alert('❌ No players found in Firebase.');
                      return;
                    }
                    
                    const players = snapshot.val();
                    let count = 0;
                    let notFound = [];
                    
                    for (const [firebaseKey, player] of Object.entries(players)) {
                      // Find matching player in PLAYER_CODES by name
                      const matchingCode = Object.entries(PLAYER_CODES).find(
                        ([code, name]) => name === player.playerName
                      );
                      
                      if (matchingCode) {
                        const [correctCode, name] = matchingCode;
                        
                        // Update code in Firebase
                        const playerRef = ref(database, `players/${firebaseKey}`);
                        await update(playerRef, {
                          playerCode: correctCode,
                          updatedAt: Date.now()
                        });
                        count++;
                        console.log(`✅ Updated ${name}: ${player.playerCode} → ${correctCode}`);
                      } else {
                        notFound.push(player.playerName);
                      }
                    }
                    
                    let message = `✅ Emergency Override Complete!\n\n`;
                    message += `Updated ${count} player codes from App.jsx.\n\n`;
                    
                    if (notFound.length > 0) {
                      message += `⚠️ ${notFound.length} players NOT found in App.jsx PLAYER_CODES:\n`;
                      message += notFound.join(', ') + '\n\n';
                      message += `These players were NOT updated!\n\n`;
                    }
                    
                    message += `REFRESH PAGE NOW!`;
                    
                    alert(message);
                  } catch (error) {
                    alert('❌ Error: ' + error.message);
                  }
                }}
              >
                ⚠️ EMERGENCY: Override Firebase
                <span style={{
                  marginLeft: '8px',
                  fontSize: '0.7rem',
                  padding: '2px 6px',
                  background: '#991b1b',
                  color: 'white',
                  borderRadius: '10px',
                  fontWeight: '500'
                }}>
                  DANGER
                </span>
              </button>
            )}            
          </div>
        )}
        
        {/* Conditional Content Based on View */}
        {currentView === 'standings' && codeValidated ? (
          <StandingsPage 
            allPicks={allPicks} 
            actualScores={actualScores}
            gameStatus={gameStatus}
            currentWeek={currentWeek}
            playerName={playerName}
            playerCode={playerCode}
            isPoolManager={isPoolManager()}
            prizePool={prizePool}
            officialWinners={officialWinners}
            publishedWinners={publishedWinners}
            onLogout={handleLogout}
            weekCompletionStatus={weekCompletionStatus}
            rankMostCorrectWinners={rankMostCorrectWinners}
            rankClosestPoints={rankClosestPoints}
            rankCorrectSuperBowlWinner={rankCorrectSuperBowlWinner}
            rankClosestSuperBowlPoints={rankClosestSuperBowlPoints}
            rankMostCorrectAllWeeks={rankMostCorrectAllWeeks}
            rankClosestPointsAllWeeks={rankClosestPointsAllWeeks}
            isWeekComplete={isWeekComplete}
            calculateCorrectWinners={calculateCorrectWinners}
            calculateWeeklyTotal={calculateWeeklyTotal}
            calculateTotalCorrectWinners={calculateTotalCorrectWinners}
            calculateGrandTotal={calculateGrandTotal}
          />) : currentView === 'winners' && codeValidated ? (
          <HowWinnersAreDetermined 
            calculatedWinners={calculatedWinners}
            publishedWinners={publishedWinners}
            isPoolManager={isPoolManager()}
            onPublishPrize={handlePublishPrize}
            onUnpublishPrize={handleUnpublishPrize}
            allPicks={allPicks}
            actualScores={actualScores}
            prizePool={prizePool}
          />
        ) : currentView === 'loginLogs' && codeValidated ? (
          <LoginLogsViewer 
            isPoolManager={isPoolManager()}
            playerCodes={PLAYER_CODES}
            onClearLogs={async () => {
              if (window.confirm('⚠️ Are you sure you want to CLEAR ALL login logs?\n\nThis will permanently delete all login history from Firebase.\n\nThis action CANNOT be undone!')) {
                try {
                  await set(ref(database, 'loginLogs'), null);
                  alert('✅ All login logs have been cleared successfully!');
                  console.log('🗑️ Login logs cleared by Pool Manager');
                  // Force re-render by updating a state (the component should re-fetch)
                  window.location.reload();
                } catch (error) {
                  alert('❌ Error clearing login logs: ' + error.message);
                  console.error('Error clearing login logs:', error);
                }
              }
            }}
          />
        ) : currentView === 'payments' && codeValidated ? (
          <PaymentManagement
            players={allPlayers}
            allPicks={allPicks}
            onUpdatePayment={updatePayment}
            onTogglePlayerVisibility={togglePlayerVisibility}
            onRemovePlayer={removePlayer}
            onToggleTableDisplay={toggleTableDisplay}
            onUpdatePlayerCode={updatePlayerCode}
          />
        ) : currentView === 'playoffSetup' && codeValidated ? (

          <PlayoffTeamsSetup
            playoffTeams={playoffTeams}
            actualScores={actualScores}
            onSavePlayoffTeams={handleSavePlayoffTeams}
            isPoolManager={isPoolManager()}
            database={database}
            weekCompletionStatus={weekCompletionStatus}
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
                  Player Code LOGIN ACCESS (6 characters)
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
              {/* WEEK NUMBER BADGE */}
              <div style={{
                display: 'inline-block',
                padding: '8px 20px',
                marginBottom: '10px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                borderRadius: '25px',
                fontWeight: 'bold',
                fontSize: '1.1rem',
                boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
                letterSpacing: '0.5px'
              }}>
                {currentWeek === 'wildcard' && '📅 WEEK 1 OF 4'}
                {currentWeek === 'divisional' && '📅 WEEK 2 OF 4'}
                {currentWeek === 'conference' && '📅 WEEK 3 OF 4'}
                {currentWeek === 'superbowl' && '📅 WEEK 4 OF 4'}
              </div>
              <p style={{color: '#000', marginTop: '8px'}}>
                Making picks for: <strong>{currentWeekData.name}</strong>
              </p>
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

            {/* Playoff Teams Banner - Show if Week 1 not configured */}
            {!playoffTeams?.week1?.configured && (
              <div style={{
                margin: '20px 0',
                padding: '20px',
                background: 'linear-gradient(135deg, #ffd89b 0%, #19547b 100%)',
                borderRadius: '12px',
                border: '3px solid #ff9800',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                textAlign: 'center'
              }}>
                <div style={{fontSize: '2rem', marginBottom: '10px'}}>⏳</div>
                <h3 style={{
                  color: 'white',
                  margin: '0 0 10px 0',
                  fontSize: '1.3rem',
                  textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
                }}>
                  Playoff Teams Will Be Announced Soon
                </h3>
                <p style={{
                  color: 'white',
                  fontSize: '1rem',
                  margin: 0,
                  opacity: 0.95
                }}>
                  The 2025 NFL Playoff teams will be determined after the regular season ends by end of day January 4, 2026.
                  <br />
                  Pool Manager will announce the 14 playoff teams here once finalized.
                </p>
              </div>
            )}

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
                  <h2 style={{margin: 0, flex: '1'}}>
                    Enter Your Predictions: <span style={{
                      fontSize: '0.95rem',
                      color: '#667eea',
                      fontWeight: '600'
                    }}>
                      {currentWeek === 'wildcard' && 'Week 1'}
                      {currentWeek === 'divisional' && 'Week 2'}
                      {currentWeek === 'conference' && 'Week 3'}
                      {currentWeek === 'superbowl' && 'Week 4'}
                    </span>
                  </h2>
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
                  
                  {/* NFL Scoring Guide Button */}
                  <button
                    type="button"
                    onClick={() => setShowScoringGuide(true)}
                    style={{
                      width: '100%',
                      padding: '15px',
                      marginTop: '10px',
                      fontSize: '1.1rem',
                      fontWeight: 'bold',
                      color: 'white',
                      background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                      border: 'none',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      boxShadow: '0 4px 15px rgba(245, 87, 108, 0.4)',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseOver={(e) => {
                      e.target.style.transform = 'translateY(-2px)';
                      e.target.style.boxShadow = '0 6px 20px rgba(245, 87, 108, 0.6)';
                    }}
                    onMouseOut={(e) => {
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = '0 4px 15px rgba(245, 87, 108, 0.4)';
                    }}
                  >
                    📊 NFL Scoring Guide - 2025 Season Stats
                  </button>
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
                      Game {game.id}: {getTeamName(currentWeek, game.id, 'team1', playoffTeams)} @ {getTeamName(currentWeek, game.id, 'team2', playoffTeams)}
                      {/* 
                      ========================================
                      TEAM CODES DISPLAY - TEMPORARILY HIDDEN
                      ========================================
                      To re-enable: Remove the comment tags around the code below
                      This shows 3-letter team codes like (PIT @ NE) below the game heading
                      ======================================== 
                      */}
                      {/* COMMENTED OUT - Remove this line and the closing comment below to re-enable */}
                      {/* teamCodes[currentWeek]?.[game.id] && (
                        <span style={{fontSize: '0.9rem', color: '#666', marginLeft: '10px'}}>
                          ({teamCodes[currentWeek][game.id].team1 || '?'} @ {teamCodes[currentWeek][game.id].team2 || '?'})
                        </span>
                      ) */}
                      {/* END OF COMMENTED OUT SECTION */}
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
                          type="text"
                          value={predictions[game.id]?.team1 || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            // Allow: dash, empty, or numbers 0-99
                            if (value === '-' || value === '' || /^\d{1,2}$/.test(value)) {
                              handleScoreChange(game.id, 'team1', value);
                            }
                          }}
                          placeholder="-"
                          disabled={isWeekLocked(currentWeek)}
                          key={`${game.id}-team1-${playerName}`}
                          maxLength="2"
                        />
                      </div>
                      
                      <div className="vs">VS</div>
                      
                      <div className="team-score">
                        <label>
                          <span className="team-designation">HOME TEAM</span>
                          <span className="team-name-label" style={{color: '#ffffff', fontWeight: '700'}}>{game.team2}</span>
                        </label>
                        <input
                          type="text"
                          value={predictions[game.id]?.team2 || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            // Allow: dash, empty, or numbers 0-99
                            if (value === '-' || value === '' || /^\d{1,2}$/.test(value)) {
                              handleScoreChange(game.id, 'team2', value);
                            }
                          }}
                          placeholder="-"
                          disabled={isWeekLocked(currentWeek)}
                          key={`${game.id}-team2-${playerName}`}
                          maxLength="2"
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
              📥 Download CSV (Paid Players)
            </button>
            
            {/* Pool Manager Complete CSV Button */}
            {isPoolManager() && (
              <button 
                onClick={downloadCompletePicksAsCSV}
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
                📊 Download COMPLETE CSV (All Players)
              </button>
            )}
            <div style={{
              fontSize: '0.75rem',
              color: '#666',
              marginTop: '5px',
              fontStyle: 'italic'
            }}>
              📱 Mobile: Open the DOWNLOADABLE CSV file with Google Sheets (free app) or MS Office EXCEL
            </div>
            <button 
              onClick={handleRefreshPicks}
              disabled={isRefreshing}
              style={{
                marginLeft: '10px',
                padding: '8px 16px',
                background: isRefreshing ? '#a0a0a0' : '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: isRefreshing ? 'not-allowed' : 'pointer',
                fontSize: '0.9rem',
                fontWeight: '600',
                opacity: isRefreshing ? 0.7 : 1
              }}
            >
              {isRefreshing ? '✓ Refreshed!' : '🔄 Refresh Picks Table'}
            </button>
          </h2>

          {/* Score Analysis Button */}
          <button
            onClick={() => setShowScoreAnalysis(true)}
            style={{
              padding: '12px 24px',
              marginBottom: '20px',
              marginTop: '10px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}
          >
            🔍 View Score Analysis
          </button>

          {allPicks.filter(pick => pick.week === currentWeek).length === 0 ? (
            <p className="no-picks">No picks submitted yet for this week.</p>
          ) : (
            <div className="picks-table-container">
              <table className="picks-table">
                <thead>
                  <tr>
                    <th rowSpan="2">
                      Player
                      <div style={{marginTop: '4px'}}>
                        <button
                          onClick={() => handleSort('name')}
                          style={{
                            padding: '4px 8px',
                            fontSize: '0.7rem',
                            background: sortColumn === 'name' ? '#4caf50' : '#f0f0f0',
                            color: sortColumn === 'name' ? '#fff' : '#000',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                          title={`Sort by first name ${sortColumn === 'name' && sortDirection === 'asc' ? '(A-Z)' : '(Z-A)'}`}
                        >
                          {sortColumn === 'name' ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
                        </button>
                      </div>
                    </th>
                    {currentWeekData.games.map((game, gameIdx) => (
                      <th key={game.id} colSpan="2" style={{
                        borderLeft: gameIdx > 0 ? '4px solid #2c3e50' : 'none',
                        paddingLeft: gameIdx > 0 ? '12px' : '8px'
                      }}>
                        Game {game.id}<br/>
                        <small style={{color: '#ffffff', fontWeight: '700'}}>{getTeamName(currentWeek, game.id, 'team1', playoffTeams)} @ {getTeamName(currentWeek, game.id, 'team2', playoffTeams)}</small>
                        {/* Team codes row for Pool Manager */}
                        {isPoolManager() && (
                          <div style={{marginTop: '5px', display: 'flex', gap: '5px', justifyContent: 'center', alignItems: 'center'}}>
                            <select
                              value={teamCodes[currentWeek]?.[game.id]?.team1 || ''}
                              onChange={(e) => handleTeamCodeChange(game.id, 'team1', e.target.value)}
                              style={{
                                width: '80px',
                                padding: '6px 4px',
                                textAlign: 'center',
                                fontSize: '0.75rem',
                                fontWeight: 'bold',
                                border: '2px solid #667eea',
                                borderRadius: '4px',
                                background: '#fff',
                                color: '#000'
                              }}
                            >
                              <option value="">--</option>
                              <option value="ARI">ARI</option>
                              <option value="ATL">ATL</option>
                              <option value="BAL">BAL</option>
                              <option value="BUF">BUF</option>
                              <option value="CAR">CAR</option>
                              <option value="CHI">CHI</option>
                              <option value="CIN">CIN</option>
                              <option value="CLE">CLE</option>
                              <option value="DAL">DAL</option>
                              <option value="DEN">DEN</option>
                              <option value="DET">DET</option>
                              <option value="GB">GB</option>
                              <option value="HOU">HOU</option>
                              <option value="IND">IND</option>
                              <option value="JAC">JAC</option>
                              <option value="KC">KC</option>
                              <option value="LV">LV</option>
                              <option value="LAC">LAC</option>
                              <option value="LAR">LAR</option>
                              <option value="MIA">MIA</option>
                              <option value="MIN">MIN</option>
                              <option value="NE">NE</option>
                              <option value="NO">NO</option>
                              <option value="NYG">NYG</option>
                              <option value="NYJ">NYJ</option>
                              <option value="PHI">PHI</option>
                              <option value="PIT">PIT</option>
                              <option value="SF">SF</option>
                              <option value="SEA">SEA</option>
                              <option value="TB">TB</option>
                              <option value="TEN">TEN</option>
                              <option value="WAS">WAS</option>
                            </select>
                            <span style={{fontSize: '0.8rem', fontWeight: 'bold'}}>@</span>
                            <select
                              value={teamCodes[currentWeek]?.[game.id]?.team2 || ''}
                              onChange={(e) => handleTeamCodeChange(game.id, 'team2', e.target.value)}
                              style={{
                                width: '80px',
                                padding: '6px 4px',
                                textAlign: 'center',
                                fontSize: '0.75rem',
                                fontWeight: 'bold',
                                border: '2px solid #667eea',
                                borderRadius: '4px',
                                background: '#fff',
                                color: '#000'
                              }}
                            >
                              <option value="">--</option>
                              <option value="ARI">ARI</option>
                              <option value="ATL">ATL</option>
                              <option value="BAL">BAL</option>
                              <option value="BUF">BUF</option>
                              <option value="CAR">CAR</option>
                              <option value="CHI">CHI</option>
                              <option value="CIN">CIN</option>
                              <option value="CLE">CLE</option>
                              <option value="DAL">DAL</option>
                              <option value="DEN">DEN</option>
                              <option value="DET">DET</option>
                              <option value="GB">GB</option>
                              <option value="HOU">HOU</option>
                              <option value="IND">IND</option>
                              <option value="JAC">JAC</option>
                              <option value="KC">KC</option>
                              <option value="LV">LV</option>
                              <option value="LAC">LAC</option>
                              <option value="LAR">LAR</option>
                              <option value="MIA">MIA</option>
                              <option value="MIN">MIN</option>
                              <option value="NE">NE</option>
                              <option value="NO">NO</option>
                              <option value="NYG">NYG</option>
                              <option value="NYJ">NYJ</option>
                              <option value="PHI">PHI</option>
                              <option value="PIT">PIT</option>
                              <option value="SF">SF</option>
                              <option value="SEA">SEA</option>
                              <option value="TB">TB</option>
                              <option value="TEN">TEN</option>
                              <option value="WAS">WAS</option>
                            </select>
                          </div>
                        )}
                        {/* 
                        ========================================
                        TEAM CODES DISPLAY - TEMPORARILY HIDDEN
                        ========================================
                        To re-enable: Remove the comment tags around the code below
                        This shows 3-letter team codes like "PIT @ NE" in the table header
                        ======================================== 
                        */}
                        {/* COMMENTED OUT - Remove this line and the closing comment below to re-enable */}
                        {/* !isPoolManager() && teamCodes[currentWeek]?.[game.id] && (
                          <div style={{fontSize: '0.8rem', color: '#ffffff', fontWeight: '700', marginTop: '3px'}}>
                            {teamCodes[currentWeek][game.id].team1 || '?'} @ {teamCodes[currentWeek][game.id].team2 || '?'}
                          </div>
                        ) */}
                        {/* END OF COMMENTED OUT SECTION */}
                      </th>
                    ))}
                    
                    {/* CORRECT PICKS COLUMN */}
                    <th rowSpan="2" style={{backgroundColor: '#e8f5e9', fontWeight: 'bold', color: '#090909ff', minWidth: '60px', fontSize: '0.75rem', padding: '8px 4px'}}>
                      <div style={{marginBottom: '2px'}}>Correct</div>
                      <div style={{marginBottom: '4px'}}>Picks</div>
                      <button
                        onClick={() => handleSort('correct')}
                        style={{
                          padding: '4px 8px',
                          fontSize: '0.7rem',
                          background: sortColumn === 'correct' ? '#4caf50' : '#f0f0f0',
                          color: sortColumn === 'correct' ? '#fff' : '#000',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          marginTop: '2px'
                        }}
                        title={`Sort by correct picks ${sortColumn === 'correct' && sortDirection === 'asc' ? '(Low to High)' : '(High to Low)'}`}
                      >
                        {sortColumn === 'correct' ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
                      </button>
                    </th>
                    {/* PERFECT SCORES COLUMN - NEW */}
                    <th rowSpan="2" style={{backgroundColor: '#fff9c4', fontWeight: 'bold', color: '#000', minWidth: '60px', fontSize: '0.75rem', padding: '8px 4px'}}>
                      <div style={{marginBottom: '2px'}}>Perfect</div>
                      <div style={{marginBottom: '4px'}}>Scores</div>
                      <button
                        onClick={() => handleSort('perfect')}
                        style={{
                          padding: '4px 8px',
                          fontSize: '0.7rem',
                          background: sortColumn === 'perfect' ? '#4caf50' : '#f0f0f0',
                          color: sortColumn === 'perfect' ? '#fff' : '#000',
                          border: '1px solid #ddd',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          marginTop: '2px'
                        }}
                        title={`Sort by perfect scores ${sortColumn === 'perfect' && sortDirection === 'asc' ? '(Low to High)' : '(High to Low)'}`}
                      >
                        {sortColumn === 'perfect' ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
                      </button>
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
                          <div style={{marginTop: '6px'}}>
                            <button
                              onClick={() => handleSort('week4')}
                              style={{
                                padding: '4px 8px',
                                fontSize: '0.7rem',
                                background: sortColumn === 'week4' ? '#4caf50' : '#f0f0f0',
                                color: sortColumn === 'week4' ? '#fff' : '#000',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                cursor: 'pointer'
                              }}
                              title={`Sort by Week 4 difference ${sortColumn === 'week4' && sortDirection === 'asc' ? '(Low to High)' : '(High to Low)'}`}
                            >
                              {sortColumn === 'week4' ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
                            </button>
                          </div>
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
                          <div style={{marginTop: '6px'}}>
                            <button
                              onClick={() => handleSort('week3')}
                              style={{
                                padding: '4px 8px',
                                fontSize: '0.7rem',
                                background: sortColumn === 'week3' ? '#4caf50' : '#f0f0f0',
                                color: sortColumn === 'week3' ? '#fff' : '#000',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                cursor: 'pointer'
                              }}
                              title={`Sort by Week 3 difference ${sortColumn === 'week3' && sortDirection === 'asc' ? '(Low to High)' : '(High to Low)'}`}
                            >
                              {sortColumn === 'week3' ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
                            </button>
                          </div>
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
                          <div style={{marginTop: '6px'}}>
                            <button
                              onClick={() => handleSort('week2')}
                              style={{
                                padding: '4px 8px',
                                fontSize: '0.7rem',
                                background: sortColumn === 'week2' ? '#4caf50' : '#f0f0f0',
                                color: sortColumn === 'week2' ? '#fff' : '#000',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                cursor: 'pointer'
                              }}
                              title={`Sort by Week 2 difference ${sortColumn === 'week2' && sortDirection === 'asc' ? '(Low to High)' : '(High to Low)'}`}
                            >
                              {sortColumn === 'week2' ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
                            </button>
                          </div>
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
                          <div style={{marginTop: '6px'}}>
                            <button
                              onClick={() => handleSort('week1')}
                              style={{
                                padding: '4px 8px',
                                fontSize: '0.7rem',
                                background: sortColumn === 'week1' ? '#4caf50' : '#f0f0f0',
                                color: sortColumn === 'week1' ? '#fff' : '#000',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                cursor: 'pointer'
                              }}
                              title={`Sort by Week 1 difference ${sortColumn === 'week1' && sortDirection === 'asc' ? '(Low to High)' : '(High to Low)'}`}
                            >
                              {sortColumn === 'week1' ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
                            </button>
                          </div>
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
                          <div style={{marginTop: '6px'}}>
                            <button
                              onClick={() => handleSort('grand')}
                              style={{
                                padding: '4px 8px',
                                fontSize: '0.7rem',
                                background: sortColumn === 'grand' ? '#4caf50' : '#f0f0f0',
                                color: sortColumn === 'grand' ? '#fff' : '#000',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                cursor: 'pointer'
                              }}
                              title={`Sort by Grand Total difference ${sortColumn === 'grand' && sortDirection === 'asc' ? '(Low to High)' : '(High to Low)'}`}
                            >
                              {sortColumn === 'grand' ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
                            </button>
                          </div>
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
                            <div style={{fontSize: '1.05rem', color: '#131515ff', marginBottom: '6px', fontWeight: '700'}}>
                              Actual Total: {actualTotal > 0 ? actualTotal : '-'}
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
                        <div style={{marginTop: '6px'}}>
                          <button
                            onClick={() => handleSort('difference')}
                            style={{
                              padding: '4px 8px',
                              fontSize: '0.7rem',
                              background: sortColumn === 'difference' ? '#4caf50' : '#f0f0f0',
                              color: sortColumn === 'difference' ? '#fff' : '#000',
                              border: '1px solid #ddd',
                              borderRadius: '4px',
                              cursor: 'pointer'
                            }}
                            title={`Sort by difference ${sortColumn === 'difference' && sortDirection === 'asc' ? '(Low to High)' : '(High to Low)'}`}
                          >
                            {sortColumn === 'difference' ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
                          </button>
                        </div>
                      </th>
                    )}
                    <th rowSpan="2" style={{textAlign: 'center'}}>
                      <div style={{fontSize: '1rem', color: '#000', fontWeight: 'bold', marginBottom: '4px', display: 'block', lineHeight: '1.2'}}>
                        {allPicks.filter(pick => pick.week === currentWeek && pick.predictions && Object.keys(pick.predictions).length > 0).length} Players
                      </div>
                      Submitted
                      <div style={{fontSize: '0.95rem', color: '#040404ff', fontWeight: 'bold', marginTop: '2px'}}>
                        (PST)
                      </div>
                      <div style={{marginTop: '4px'}}>
                        <button
                          onClick={() => handleSort('timestamp')}
                          style={{
                            padding: '4px 8px',
                            fontSize: '0.7rem',
                            background: sortColumn === 'timestamp' ? '#4caf50' : '#f0f0f0',
                            color: sortColumn === 'timestamp' ? '#fff' : '#000',
                            border: '1px solid #ddd',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          {sortColumn === 'timestamp' ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
                        </button>
                      </div>
                    </th>
                  </tr>

                  {/* ACTUAL SCORES ROW - Enhanced visibility */}
                  <tr style={{background: '#ffffff', borderTop: '3px solid #4caf50', borderBottom: '3px solid #4caf50'}}>
                    {currentWeekData.games.map((game, gameIdx) => (
                      <React.Fragment key={`actual-${game.id}`}>
                        <th style={{
                          padding: '8px 4px', 
                          background: '#ffffff', 
                          borderLeft: gameIdx > 0 ? '4px solid #2c3e50' : '1px solid #ddd',
                          paddingLeft: gameIdx > 0 ? '12px' : '4px'
                        }}>
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
                  {(() => {
                    // For Super Bowl, show ALL players (even without Week 4 picks)
                    // For other weeks, only show players with picks for that week
                    const displayPicks = (() => {
                      if (currentWeek === 'superbowl') {
                        // For Super Bowl, show ALL unique players
                        const uniquePlayers = new Map();
                        allPicks.forEach(pick => {
                          if (!uniquePlayers.has(pick.playerCode)) {
                            const superbowlPick = allPicks.find(p => p.playerCode === pick.playerCode && p.week === 'superbowl');
                            uniquePlayers.set(pick.playerCode, superbowlPick || {
                              playerName: pick.playerName,
                              playerCode: pick.playerCode,
                              week: 'superbowl',
                              predictions: {},
                              timestamp: pick.timestamp,
                              lastUpdated: pick.lastUpdated || pick.timestamp
                            });
                          }
                        });
                        
                        // Add players marked as "showInPicksTable" even if no picks
                        allPlayers.forEach(player => {
                          if (player.showInPicksTable === true && !uniquePlayers.has(player.playerCode)) {
                            uniquePlayers.set(player.playerCode, {
                              playerName: player.playerName,
                              playerCode: player.playerCode,
                              week: 'superbowl',
                              predictions: {},
                              timestamp: Date.now(),
                              lastUpdated: Date.now()
                            });
                          }
                        });
                        
                        return Array.from(uniquePlayers.values());
                      } else {
                        // For other weeks, show players with picks OR all visible players
                        const picksForWeek = allPicks.filter(pick => pick.week === currentWeek);
                        const displayedCodes = new Set(picksForWeek.map(p => p.playerCode));
                        
                        // ✅ FIX: Add players who are paid, visible, and regular players (not managers)
                        allPlayers.forEach(player => {
                          // Show player if:
                          // 1. They are paid
                          // 2. They are visible (not hidden)
                          // 3. They are a regular player (not pool manager)
                          // 4. Not already in the list
                          // const isPaid = player.paid === true;
                          const isPaid = player.paid === true || player.paymentStatus === 'PAID';
                          const isVisible = player.visible !== false;
                          const isRegularPlayer = player.role !== 'MANAGER';
                          
                          if (isPaid && isVisible && isRegularPlayer && !displayedCodes.has(player.playerCode)) {
                            picksForWeek.push({
                              playerName: player.playerName,
                              playerCode: player.playerCode,
                              week: currentWeek,
                              predictions: {},
                              timestamp: Date.now(),
                              lastUpdated: Date.now()
                            });
                          }
                        });
                        
                        return picksForWeek;
                      }
                    })();
                    
                    // Apply custom sorting if set, otherwise sort by timestamp
                    const sortedPicks = sortColumn 
                      ? getSortedPicks(displayPicks)
                      : displayPicks.sort((a, b) => (b.lastUpdated || b.timestamp) - (a.lastUpdated || a.timestamp));
                    
                    return sortedPicks
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
                      
                      const isRNGPick = pick.enteredBy === 'POOL_MANAGER_RNG';
                      
                      return (
                        <tr key={idx} className={isRNGPick ? 'rng-pick-row' : ''}>
                          <td className="player-name">
                            {pick.playerName}
                            {isRNGPick && <span className="rng-indicator" title="Picks generated by Pool Manager (missed deadline)">🎲</span>}
                          </td>
                          {currentWeekData.games.map((game, gameIdx) => {
                            // Handle both array and object prediction formats
                            let pred;
                            if (Array.isArray(pick.predictions)) {
                              // pred = pick.predictions[gameIdx + 1]; OLD code that was screwing up entire TABLE
                              pred = pick.predictions[game.id];
                                  // DEBUG for Dallas
                                  if (pick.playerName === 'Dallas Pylypow' && gameIdx < 3) {
                                    console.log(`🔍 Dallas gameIdx=${gameIdx}, game.id=${game.id}, pred:`, pred);
                                  }
                            } else {
                              pred = pick.predictions[game.id];
                            }
                            
                            const actual = actualScores[currentWeek]?.[game.id];
                            const status = gameStatus[currentWeek]?.[game.id];
                            
                            // DEBUG for columns 4-5 (gameIdx === 1, which is Game ID 3)
                            if (idx === 0 && gameIdx === 1) {
                              console.log('🔍 COLUMNS 4-5 DEBUG:', {
                                gameIdx,
                                gameId: game.id,
                                'pred': pred,
                                'pred?.team1': pred?.team1,
                                'pred?.team2': pred?.team2,
                                'actual?.team1': actual?.team1,
                                'actual?.team2': actual?.team2,
                                'status': status
                              });
                            }
                            
                            const team1Style = getCellHighlight(
                              pred?.team1,
                              pred?.team2,
                              actual?.team1,
                              actual?.team2,
                              status,
                              true
                            );
                            
                            const team2Style = getCellHighlight(
                              pred?.team1,
                              pred?.team2,
                              actual?.team1,
                              actual?.team2,
                              status,
                              false
                            );
                            
                            return (
                              <React.Fragment key={`${idx}-${game.id}`}>
                                <td 
                                  className="score"
                                  style={{
                                    background: team1Style.background,
                                    color: team1Style.color,
                                    fontWeight: team1Style.background !== 'transparent' ? 'bold' : 'normal',
                                    borderLeft: gameIdx > 0 ? '4px solid #2c3e50' : 'none',
                                    paddingLeft: gameIdx > 0 ? '12px' : '8px'
                                  }}
                                >
                                  {pred?.team1 || '-'}
                                </td>
                                <td 
                                  className="score"
                                  style={{
                                    background: team2Style.background,
                                    color: team2Style.color,
                                    fontWeight: team2Style.background !== 'transparent' ? 'bold' : 'normal'
                                  }}
                                >
                                  {pred?.team2 || '-'}
                                </td>
                              </React.Fragment>
                            );
                          })}
                          
                          {/* CORRECT PICKS CELL */}
                          {(() => {
                            let correctCount = 0;
                            
                            // For Super Bowl table, count correct picks across ALL completed weeks
                            if (currentWeek === 'superbowl') {
                              const weeks = ['wildcard', 'divisional', 'conference', 'superbowl'];
                              weeks.forEach(weekName => {
                                const weekActualScores = actualScores[weekName];
                                // Only count if week has actual scores
                                const hasActual = weekActualScores && Object.values(weekActualScores).some(game => {
                                  return game && 
                                         game.team1 !== null && game.team1 !== undefined && game.team1 !== '' && game.team1 !== 0 &&
                                         game.team2 !== null && game.team2 !== undefined && game.team2 !== '' && game.team2 !== 0;
                                });
                                
                                if (hasActual) {
                                  const playerPick = allPicks.find(p => p.playerCode === pick.playerCode && p.week === weekName);
                                  if (playerPick && playerPick.predictions) {
                                    Object.keys(weekActualScores).forEach(gameId => {
                                      const actual = weekActualScores[gameId];
                                      const pred = playerPick.predictions[gameId];
                                      
                                      if (pred && actual && actual.team1 && actual.team2 && pred.team1 && pred.team2) {
                                        const actualTeam1 = parseInt(actual.team1);
                                        const actualTeam2 = parseInt(actual.team2);
                                        const predTeam1 = parseInt(pred.team1);
                                        const predTeam2 = parseInt(pred.team2);
                                        
                                        if (!isNaN(actualTeam1) && !isNaN(actualTeam2)) {
                                          const actualWinner = actualTeam1 > actualTeam2 ? 'team1' : actualTeam2 > actualTeam1 ? 'team2' : 'tie';
                                          const predWinner = predTeam1 > predTeam2 ? 'team1' : predTeam2 > predTeam1 ? 'team2' : 'tie';
                                          
                                          if (actualWinner === predWinner && actualWinner !== 'tie') {
                                            correctCount++;
                                          }
                                        }
                                      }
                                    });
                                  }
                                }
                              });
                            } else {
                              // For individual week pages, only count current week
                              currentWeekData.games.forEach(game => {
                                if (hasCorrectPrediction(game.id)) {
                                  correctCount++;
                                }
                              });
                            }
                            
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
                          {/* PERFECT SCORES CELL */}
                          {(() => {
                            let perfectCount = 0;
                            
                            if (currentWeek === 'superbowl') {
                              // For Super Bowl, count across ALL completed weeks
                              const weeks = ['wildcard', 'divisional', 'conference', 'superbowl'];
                              weeks.forEach(weekName => {
                                const weekActualScores = actualScores[weekName];
                                const hasActual = weekActualScores && Object.values(weekActualScores).some(game => {
                                  return game && 
                                        game.team1 !== null && game.team1 !== undefined && game.team1 !== '' && game.team1 !== 0 &&
                                        game.team2 !== null && game.team2 !== undefined && game.team2 !== '' && game.team2 !== 0;
                                });
                                
                                if (hasActual) {
                                  const playerWeekPick = allPicks.find(p => p.playerCode === pick.playerCode && p.week === weekName);
                                  if (playerWeekPick && playerWeekPick.predictions) {
                                    Object.keys(weekActualScores).forEach(gameId => {
                                      const actual = weekActualScores[gameId];
                                      const pred = playerWeekPick.predictions[gameId];
                                      
                                      if (pred && actual && actual.team1 && actual.team2 && pred.team1 && pred.team2) {
                                        const actualTeam1 = parseInt(actual.team1);
                                        const actualTeam2 = parseInt(actual.team2);
                                        const predTeam1 = parseInt(pred.team1);
                                        const predTeam2 = parseInt(pred.team2);
                                        
                                        // PERFECT SCORE: Both teams exactly correct
                                        if (actualTeam1 === predTeam1 && actualTeam2 === predTeam2) {
                                          perfectCount++;
                                        }
                                      }
                                    });
                                  }
                                }
                              });
                            } else {
                              // For individual week, only count current week
                              currentWeekData.games.forEach(game => {
                                const pred = pick.predictions[game.id];
                                const actual = actualScores[currentWeek]?.[game.id];
                                
                                if (pred && actual && actual.team1 && actual.team2 && pred.team1 && pred.team2) {
                                  const actualTeam1 = parseInt(actual.team1);
                                  const actualTeam2 = parseInt(actual.team2);
                                  const predTeam1 = parseInt(pred.team1);
                                  const predTeam2 = parseInt(pred.team2);
                                  
                                  // PERFECT SCORE: Both teams exactly correct
                                  if (actualTeam1 === predTeam1 && actualTeam2 === predTeam2) {
                                    perfectCount++;
                                  }
                                }
                              });
                            }
                            
                            return (
                              <td style={{
                                backgroundColor: '#fffbea',
                                fontWeight: 'bold',
                                fontSize: '1rem',
                                color: perfectCount > 0 ? '#f57c00' : '#999',
                                textAlign: 'center',
                                padding: '8px 4px'
                              }}>
                                {perfectCount}
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
                                    <td style={{backgroundColor: '#fff3cd', fontWeight: 'bold', fontSize: week4Display.fontSize}} title={week4Display.tooltip}>
                                      <span style={{color: '#000'}}>{week4Display.display}</span>
                                    </td>
                                    <td style={{backgroundColor: '#d1ecf1', fontWeight: 'bold', fontSize: week3Display.fontSize}} title={week3Display.tooltip}>
                                      <span style={{color: '#000'}}>{week3Display.display}</span>
                                    </td>
                                    <td style={{backgroundColor: '#d4edda', fontWeight: 'bold', fontSize: week2Display.fontSize}} title={week2Display.tooltip}>
                                      <span style={{color: '#000'}}>{week2Display.display}</span>
                                    </td>
                                    <td style={{backgroundColor: '#f8d7da', fontWeight: 'bold', fontSize: week1Display.fontSize}} title={week1Display.tooltip}>
                                      <span style={{color: '#000'}}>{week1Display.display}</span>
                                    </td>
                                    <td className="grand-total" style={{fontSize: grandDisplay.fontSize}} title={grandDisplay.tooltip}>
                                    {grandDisplay.display}
                                  </td>
                                  </>
                                );
                              })()}
                            </>
                          ) : (
                            <td style={{backgroundColor: '#f8f9fa', fontWeight: 'bold', fontSize: '16px'}}>
                              <span style={{color: '#000'}}>{playerTotals[pick.playerName]?.current || '0'}</span>
                            </td>
                          )}

                          <td className="timestamp" style={{color: '#000000'}}>
                            {new Date(pick.lastUpdated || pick.timestamp).toLocaleString('en-US', {
                              timeZone: 'America/Los_Angeles',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            })} PST
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
              <div style={{marginTop:'15px',padding:'12px 20px',background:'#f8f9fa',border:'2px solid #dee2e6',borderRadius:'8px',fontSize:'0.9rem',color:'#495057',display:'flex',alignItems:'center',gap:'8px'}}>
                <span style={{fontSize:'1.2rem'}}>🎲</span>
                <span style={{fontWeight:'600'}}>= Picks randomly generated by Pool Manager (player missed deadline)</span>
              </div>
              
              {/* Official Total Format Guide */}
              <div style={{marginTop:'10px',padding:'10px 15px',background:'#e8f5e9',border:'1px solid #81c784',borderRadius:'6px',fontSize:'0.85rem',color:'#2e7d32'}}>
                <strong>Official Total Format:</strong> 
                <span style={{marginLeft:'8px'}}><strong>333/14</strong> = Predicted 333 pts, Off by 14 pts</span>
                <span style={{marginLeft:'15px',color:'#666'}}>|</span>
                <span style={{marginLeft:'8px'}}><strong>333</strong> = Predicted 333 pts (week not played yet)</span>
              </div>
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
                    {/* Weekly Totals Format */}
                    <div style={{marginBottom: '25px'}}>
                      <p style={{
                        fontWeight: 'bold',
                        color: '#5a67d8',
                        marginBottom: '12px',
                        fontSize: '1.1rem'
                      }}>
                        Weekly Totals Format:
                      </p>
                      <ul style={{
                        listStyle: 'none',
                        padding: 0,
                        margin: 0,
                        lineHeight: '2.2'
                      }}>
                        <li>
                          <strong>Before Week is Played:</strong> <code style={{
                            background: '#f0f4f8',
                            padding: '4px 10px',
                            borderRadius: '5px',
                            fontWeight: 'bold',
                            color: '#2d3748'
                          }}>333</code> - Shows your predicted total
                        </li>
                        <li>
                          <strong>After Week is Played:</strong> <code style={{
                            background: '#f0f4f8',
                            padding: '4px 10px',
                            borderRadius: '5px',
                            fontWeight: 'bold',
                            color: '#2d3748'
                          }}>333/14</code> - Prediction / How far off
                        </li>
                        <li>
                          <strong>Week Not Entered:</strong> <code style={{
                            background: '#f0f4f8',
                            padding: '4px 10px',
                            borderRadius: '5px',
                            fontWeight: 'bold',
                            color: '#2d3748'
                          }}>-</code> - Dash means no picks made
                        </li>
                      </ul>
                    </div>
                    
                    {/* Grand Total Format */}
                    <div style={{marginBottom: '25px'}}>
                      <p style={{
                        fontWeight: 'bold',
                        color: '#5a67d8',
                        marginBottom: '12px',
                        fontSize: '1.1rem'
                      }}>
                        Grand Total Format (Shows ONLY Completed Weeks):
                      </p>
                      <ul style={{
                        listStyle: 'none',
                        padding: 0,
                        margin: 0,
                        lineHeight: '2.2'
                      }}>
                        <li>
                          <code style={{
                            background: '#f0f4f8',
                            padding: '4px 10px',
                            borderRadius: '5px',
                            fontWeight: 'bold',
                            color: '#2d3748'
                          }}>579/39</code>
                        </li>
                        <li style={{marginLeft: '20px', fontSize: '0.95rem'}}>
                          • <strong>First Number (579):</strong> Sum of predictions for completed weeks
                        </li>
                        <li style={{marginLeft: '20px', fontSize: '0.95rem'}}>
                          • <strong>Second Number (39):</strong> Sum of differences for completed weeks
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
                      
                      <div style={{marginBottom: '20px', padding: '15px', background: '#e6f7ff', borderRadius: '8px', border: '1px solid #91d5ff'}}>
                        <p style={{fontWeight: 'bold', marginBottom: '8px', color: '#0050b3'}}>Richard - Only Week 1 Complete:</p>
                        <ul style={{listStyle: 'none', padding: 0, margin: 0, lineHeight: '1.8'}}>
                          <li>Week 1: <code style={{background: '#fff', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold'}}>333/14</code> ← Played</li>
                          <li>Week 2: <code style={{background: '#fff', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold'}}>246</code> ← Not played (shows prediction)</li>
                          <li>Week 3: <code style={{background: '#fff', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold'}}>108</code> ← Not played (shows prediction)</li>
                          <li>Week 4: <code style={{background: '#fff', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold'}}>54</code> ← Not played (shows prediction)</li>
                          <li style={{marginTop: '8px', fontWeight: 'bold'}}>GRAND: <code style={{background: '#52c41a', color: 'white', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold'}}>333/14</code> ← Only Week 1</li>
                        </ul>
                      </div>
                      
                      <div style={{marginBottom: '20px', padding: '15px', background: '#fff7e6', borderRadius: '8px', border: '1px solid #ffd591'}}>
                        <p style={{fontWeight: 'bold', marginBottom: '8px', color: '#d46b08'}}>Richard - Weeks 1 & 2 Complete:</p>
                        <ul style={{listStyle: 'none', padding: 0, margin: 0, lineHeight: '1.8'}}>
                          <li>Week 1: <code style={{background: '#fff', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold'}}>333/14</code> ← Played</li>
                          <li>Week 2: <code style={{background: '#fff', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold'}}>246/25</code> ← Played</li>
                          <li>Week 3: <code style={{background: '#fff', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold'}}>108</code> ← Not played (shows prediction)</li>
                          <li>Week 4: <code style={{background: '#fff', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold'}}>54</code> ← Not played (shows prediction)</li>
                          <li style={{marginTop: '8px', fontWeight: 'bold'}}>GRAND: <code style={{background: '#52c41a', color: 'white', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold'}}>579/39</code> ← Week 1+2 (333+246=579, 14+25=39)</li>
                        </ul>
                      </div>
                    </div>
                    
                    {/* Special Indicators */}
                    <div style={{marginBottom: '15px'}}>
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
                          <strong>🎲 Dice Icon:</strong> Picks randomly generated by Pool Manager (player missed deadline)
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
                        💡 <strong>Key Point:</strong> Grand Total only includes completed weeks! Your future week predictions are visible but don't affect Grand Total until those weeks are played.
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

              {/* NEW Winner Management System */}
              {prizePool.totalFees > 0 && (
                <div style={{marginTop: '30px'}}>
                  <WinnerDeclaration
                    allPicks={allPicks}
                    actualScores={actualScores}
                    games={PLAYOFF_WEEKS}
                    officialWinners={officialWinners}
                    onPublishWinners={handlePublishWinners}
                    onUnpublishWinners={handleUnpublishWinners}
                    isPoolManager={true}
                    totalPrizePool={prizePool.totalFees}
                    weekCompletionStatus={{
                      wildcard: weekCompletionStatus?.wildcard || false,
                      divisional: weekCompletionStatus?.divisional || false,
                      conference: weekCompletionStatus?.conference || false,
                      superbowl: weekCompletionStatus?.superbowl || false,
                      grand: weekCompletionStatus?.superbowl || false
                    }}
                  />
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
                
                {/* 🎯 PERFECT SCORE PRIZES SECTION - ALL BLACK TEXT */}
                <div style={{
                  marginTop: '25px',
                  padding: '20px',
                  background: '#fff3cd',
                  border: '2px solid #ffc107',
                  borderRadius: '8px',
                  marginBottom: '20px'
                }}>
                  <h3 style={{
                    margin: '0 0 15px 0',
                    color: '#000',
                    fontSize: '1.1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}>
                    🎯 Perfect Score Prizes (Optional)
                  </h3>
                  
                  <div style={{marginBottom: '15px'}}>
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      cursor: 'pointer',
                      color: '#000',
                      fontWeight: '600',
                      fontSize: '1rem'
                    }}>
                      <input
                        type="checkbox"
                        id="perfectScoreBonusEnabled"
                        defaultChecked={prizePool.perfectScoreBonusEnabled || false}
                        onChange={(e) => {
                          const isEnabled = e.target.checked;
                          const optionsDiv = document.getElementById('perfectScoreOptions');
                          document.getElementById('perfectScorePrizeAmount').disabled = !isEnabled;
                          document.getElementById('perfectScoreCutoff').disabled = !isEnabled;
                          
                          // Update parent div styling to enable/disable all controls
                          if (optionsDiv) {
                            optionsDiv.style.opacity = isEnabled ? '1' : '0.5';
                            optionsDiv.style.pointerEvents = isEnabled ? 'auto' : 'none';
                          }
                        }}
                        style={{
                          width: '20px',
                          height: '20px',
                          cursor: 'pointer'
                        }}
                      />
                      Enable Perfect Score Prizes
                    </label>
                    <div style={{
                      fontSize: '0.85rem',
                      color: '#000',
                      marginTop: '5px',
                      marginLeft: '30px',
                      lineHeight: '1.5'
                    }}>
                      Award prizes for players who predict the exact final score of playoff games.<br/>
                      Each perfect score prediction = 1 winning entry. Players can win multiple times.
                    </div>
                  </div>

                  <div id="perfectScoreOptions" style={{
                    marginLeft: '0px',
                    opacity: prizePool.perfectScoreBonusEnabled ? '1' : '0.5',
                    pointerEvents: prizePool.perfectScoreBonusEnabled ? 'auto' : 'none'
                  }}>
                    {/* Prize Amount Type Selection */}
                    <div style={{marginBottom: '20px'}}>
                      <label style={{
                        display: 'block',
                        marginBottom: '8px',
                        fontWeight: '600',
                        color: '#000',
                        fontSize: '1rem'
                      }}>
                        Prize Amount Type:
                      </label>
                      <div style={{display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '10px'}}>
                        <label style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          cursor: 'pointer',
                          color: '#000',
                          minHeight: '44px'
                        }}>
                          <input
                            type="radio"
                            id="perfectScoreTypeDollar"
                            name="perfectScoreType"
                            value="dollar"
                            defaultChecked={prizePool.perfectScorePrizeType === 'dollar' || !prizePool.perfectScorePrizeType}
                            onChange={(e) => {
                              const amountInput = document.getElementById('perfectScorePrizeAmount');
                              const label = document.getElementById('prizeAmountLabel');
                              const helper = document.getElementById('prizeAmountHelper');
                              const totalFees = document.getElementById('totalFees').value || 560;
                              label.textContent = 'Perfect Score Prize Pool Amount ($):';
                              amountInput.placeholder = '60';
                              amountInput.max = '';
                              amountInput.step = '1';
                              helper.innerHTML = `Total $ amount for perfect score prizes (e.g., $60 from $${totalFees} total pool)`;
                              updatePerfectScoreExample();
                            }}
                            style={{width: '18px', height: '18px', cursor: 'pointer'}}
                          />
                          <span style={{fontSize: '0.95rem', fontWeight: '500'}}>Fixed Dollar Amount</span>
                        </label>
                        <label style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          cursor: 'pointer',
                          color: '#000',
                          minHeight: '44px'
                        }}>
                          <input
                            type="radio"
                            id="perfectScoreTypePercent"
                            name="perfectScoreType"
                            value="percentage"
                            defaultChecked={prizePool.perfectScorePrizeType === 'percentage'}
                            onChange={(e) => {
                              const amountInput = document.getElementById('perfectScorePrizeAmount');
                              const label = document.getElementById('prizeAmountLabel');
                              const helper = document.getElementById('prizeAmountHelper');
                              const totalFees = document.getElementById('totalFees').value || 560;
                              label.textContent = 'Perfect Score Prize Pool Percentage (%):';
                              amountInput.placeholder = '10';
                              amountInput.max = '100';
                              amountInput.step = '0.1';
                              const calcAmount = (totalFees * (amountInput.value || 10) / 100).toFixed(2);
                              helper.innerHTML = `Percentage of total pool for perfect score prizes (e.g., ${amountInput.value || 10}% of $${totalFees} = $${calcAmount})`;
                              updatePerfectScoreExample();
                            }}
                            style={{width: '18px', height: '18px', cursor: 'pointer'}}
                          />
                          <span style={{fontSize: '0.95rem', fontWeight: '500'}}>Percentage of Total Pool</span>
                        </label>
                      </div>
                    </div>

                    {/* Prize Amount Input */}
                    <div style={{marginBottom: '20px'}}>
                      <label id="prizeAmountLabel" style={{
                        display: 'block',
                        marginBottom: '8px',
                        fontWeight: '600',
                        color: '#000',
                        fontSize: '1rem'
                      }}>
                        {prizePool.perfectScorePrizeType === 'percentage' 
                          ? 'Perfect Score Prize Pool Percentage (%):' 
                          : 'Perfect Score Prize Pool Amount ($):'}
                      </label>
                      <input
                        type="number"
                        id="perfectScorePrizeAmount"
                        defaultValue={prizePool.perfectScorePrizeAmount || ''}
                        placeholder={prizePool.perfectScorePrizeType === 'percentage' ? "10" : "60"}
                        min="0"
                        max={prizePool.perfectScorePrizeType === 'percentage' ? "100" : undefined}
                        step={prizePool.perfectScorePrizeType === 'percentage' ? "0.1" : "1"}
                        disabled={!prizePool.perfectScoreBonusEnabled}
                        onChange={() => {
                          updatePerfectScoreExample();
                          const totalFees = document.getElementById('totalFees').value || 560;
                          const amountInput = document.getElementById('perfectScorePrizeAmount');
                          const helper = document.getElementById('prizeAmountHelper');
                          const isPercent = document.getElementById('perfectScoreTypePercent')?.checked;
                          if (isPercent) {
                            const calcAmount = (totalFees * (amountInput.value || 10) / 100).toFixed(2);
                            helper.innerHTML = `Percentage of total pool for perfect score prizes (e.g., ${amountInput.value || 10}% of $${totalFees} = $${calcAmount})`;
                          } else {
                            helper.innerHTML = `Total $ amount for perfect score prizes (e.g., $${amountInput.value || 60} from $${totalFees} total pool)`;
                          }
                        }}
                        style={{
                          width: '100%',
                          padding: '12px',
                          fontSize: '1rem',
                          color: '#000',
                          border: '2px solid #ffc107',
                          borderRadius: '6px',
                          minHeight: '44px',
                          background: prizePool.perfectScoreBonusEnabled ? 'white' : '#f5f5f5'
                        }}
                      />
                      <div id="prizeAmountHelper" style={{
                        fontSize: '0.85rem',
                        color: '#000',
                        marginTop: '5px'
                      }}>
                        {prizePool.perfectScorePrizeType === 'percentage' 
                          ? `Percentage of total pool for perfect score prizes (e.g., ${prizePool.perfectScorePrizeAmount || 10}% of $${prizePool.totalFees || 560} = $${((prizePool.totalFees || 560) * (prizePool.perfectScorePrizeAmount || 10) / 100).toFixed(2)})`
                          : `Total $ amount for perfect score prizes (e.g., $${prizePool.perfectScorePrizeAmount || 60} from $${prizePool.totalFees || 560} total pool)`}
                      </div>
                    </div>

                    {/* Cutoff Number */}
                    <div style={{marginBottom: '15px'}}>
                      <label style={{
                        display: 'block',
                        marginBottom: '8px',
                        fontWeight: '600',
                        color: '#000',
                        fontSize: '1rem'
                      }}>
                        Cutoff Number (Max Perfect Scores):
                      </label>
                      <input
                        type="number"
                        id="perfectScoreCutoff"
                        defaultValue={prizePool.perfectScoreCutoff || ''}
                        placeholder="30"
                        min="1"
                        disabled={!prizePool.perfectScoreBonusEnabled}
                        onChange={() => updatePerfectScoreExample()}
                        style={{
                          width: '100%',
                          padding: '12px',
                          fontSize: '1rem',
                          color: '#000',
                          border: '2px solid #ffc107',
                          borderRadius: '6px',
                          minHeight: '44px',
                          background: prizePool.perfectScoreBonusEnabled ? 'white' : '#f5f5f5'
                        }}
                      />
                      <div style={{
                        fontSize: '0.85rem',
                        color: '#000',
                        marginTop: '5px'
                      }}>
                        If total perfect scores ≤ this number → pay out. If &gt; this number → cancel prizes, return money to main pool.
                      </div>
                    </div>

                    {/* Example */}
                    <div style={{
                      marginTop: '15px',
                      padding: '15px',
                      background: 'rgba(255, 193, 7, 0.2)',
                      borderRadius: '6px',
                      border: '1px solid #ffc107'
                    }}>
                      <div style={{
                        fontWeight: '600',
                        marginBottom: '8px',
                        color: '#000',
                        fontSize: '0.95rem'
                      }}>
                        💡 Example:
                      </div>
                      <div id="perfectScoreExample" style={{
                        fontSize: '0.85rem',
                        color: '#000',
                        lineHeight: '1.6'
                      }}>
                        $60 prize pool, 30 cutoff.<br/>
                        If 6 perfect scores total → each gets $10.00.<br/>
                        If 31+ perfect scores → nobody gets paid, money goes to main prizes.
                      </div>
                    </div>
                  </div>
                </div>
                
                <script dangerouslySetInnerHTML={{__html: `
                  function updatePerfectScoreExample() {
                    const totalFees = parseFloat(document.getElementById('totalFees')?.value) || 560;
                    const isPercent = document.getElementById('perfectScoreTypePercent')?.checked;
                    const amount = parseFloat(document.getElementById('perfectScorePrizeAmount')?.value) || (isPercent ? 10 : 60);
                    const cutoff = parseInt(document.getElementById('perfectScoreCutoff')?.value) || 30;
                    
                    let prizePool;
                    if (isPercent) {
                      prizePool = (totalFees * amount / 100).toFixed(2);
                    } else {
                      prizePool = amount.toFixed(2);
                    }
                    
                    const perEntry = (prizePool / 6).toFixed(2);
                    
                    const example = document.getElementById('perfectScoreExample');
                    if (example) {
                      example.innerHTML = (isPercent 
                        ? \`\${amount}% of $\${totalFees} = $\${prizePool} prize pool, \${cutoff} cutoff.\`
                        : \`$\${prizePool} prize pool, \${cutoff} cutoff.\`) + 
                        \`<br/>If 6 perfect scores total → each gets $\${perEntry}.<br/>If \${cutoff + 1}+ perfect scores → nobody gets paid, money goes to main prizes.\`;
                    }
                  }
                  
                  // Update on total fees change
                  const totalFeesInput = document.getElementById('totalFees');
                  if (totalFeesInput) {
                    totalFeesInput.addEventListener('input', updatePerfectScoreExample);
                  }
                `}} />
                
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
                      const perfectScoreBonusEnabled = document.getElementById('perfectScoreBonusEnabled').checked;
                      const perfectScorePrizeType = document.getElementById('perfectScoreTypePercent')?.checked ? 'percentage' : 'dollar';
                      const perfectScorePrizeAmount = document.getElementById('perfectScorePrizeAmount').value;
                      const perfectScoreCutoff = document.getElementById('perfectScoreCutoff').value;
                      
                      if (!totalFees || totalFees <= 0) {
                        alert('❌ Please enter a valid total pool amount.');
                        return;
                      }
                      
                      if (perfectScoreBonusEnabled) {
                        if (!perfectScorePrizeAmount || perfectScorePrizeAmount <= 0) {
                          alert('❌ Please enter a Perfect Score Prize Amount.');
                          return;
                        }
                        if (!perfectScoreCutoff || perfectScoreCutoff <= 0) {
                          alert('❌ Please enter a Perfect Score Cutoff number.');
                          return;
                        }
                      }
                      
                      savePrizePool(totalFees, numberOfPlayers, entryFee, perfectScoreBonusEnabled, perfectScorePrizeType, perfectScorePrizeAmount, perfectScoreCutoff);
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

      {/* NFL Scoring Guide Modal */}
      {showScoringGuide && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px'
          }}
          onClick={() => setShowScoringGuide(false)}
        >
          <div 
            style={{
              background: 'white',
              borderRadius: '16px',
              maxWidth: '900px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              padding: '30px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            {/* Header with Close Button */}
            <div style={{marginBottom: '25px'}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px'}}>
                <h2 style={{
                  fontSize: '1.8rem',
                  margin: 0,
                  color: '#000',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  📊 NFL Scoring Guide
                  <span style={{
                    fontSize: '0.6rem',
                    padding: '4px 12px',
                    background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                    color: 'white',
                    borderRadius: '20px',
                    fontWeight: '500'
                  }}>
                    2025 Regular Season Data
                  </span>
                </h2>
                {/* Close button at top */}
                <button
                  onClick={() => setShowScoringGuide(false)}
                  style={{
                    padding: '8px 16px',
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    color: 'white',
                    background: '#e74c3c',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    minWidth: '80px'
                  }}
                  onMouseOver={(e) => e.target.style.background = '#c0392b'}
                  onMouseOut={(e) => e.target.style.background = '#e74c3c'}
                >
                  ✕ Close
                </button>
              </div>
              <p style={{color: '#666', margin: '0 0 10px 0', fontSize: '0.95rem'}}>
                <strong>Real data from actual 2025 NFL Regular Season games played</strong> - Use this to help you make smarter predictions!
              </p>
              <div style={{
                background: '#fff3cd',
                border: '2px solid #ffc107',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '10px'
              }}>
                <p style={{color: '#856404', margin: '0 0 8px 0', fontSize: '0.9rem', fontWeight: 'bold'}}>
                  📖 How to Read This Table:
                </p>
                <p style={{color: '#856404', margin: '0 0 6px 0', fontSize: '0.85rem'}}>
                  • <strong>Score</strong> = Final points scored by ONE team in a game
                </p>
                <p style={{color: '#856404', margin: '0 0 6px 0', fontSize: '0.85rem'}}>
                  • <strong>Visitor</strong> = How many times a visiting team finished with that score
                </p>
                <p style={{color: '#856404', margin: '0 0 6px 0', fontSize: '0.85rem'}}>
                  • <strong>Home</strong> = How many times a home team finished with that score
                </p>
                <p style={{color: '#856404', margin: '0 0 6px 0', fontSize: '0.85rem'}}>
                  • <strong>Total</strong> = Total times ANY team scored that many points
                </p>
                <p style={{color: '#856404', margin: 0, fontSize: '0.85rem', fontStyle: 'italic'}}>
                  📱 <strong>Mobile users:</strong> Rotate to landscape for best viewing
                </p>
              </div>
            </div>

            {/* Quick Summary */}
            <div style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              padding: '20px',
              borderRadius: '12px',
              marginBottom: '25px',
              color: 'white'
            }}>
              <h3 style={{margin: '0 0 12px 0', fontSize: '1.2rem'}}>🎯 Quick Insights</h3>
              <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px'}}>
                <div>
                  <strong>Most Common:</strong> 20 (44x), 27 (38x), 24 (34x)
                </div>
                <div>
                  <strong>Sweet Spot:</strong> 10-35 points
                </div>
                <div>
                  <strong>Rarely Scored:</strong> 0-9, 43-52
                </div>
              </div>
            </div>

            {/* Legend with Title */}
            <div style={{marginBottom: '20px'}}>
              <h4 style={{margin: '0 0 8px 0', fontSize: '1rem', color: '#333'}}>
                🎨 Row Color Guide - These colored boxes match the table row backgrounds below:
              </h4>
              <p style={{color: '#666', fontSize: '0.85rem', margin: '0 0 10px 0', fontStyle: 'italic'}}>
                Each row in the table is colored based on how frequently that score occurred in 2025 games
              </p>
              <div style={{
                display: 'flex',
                gap: '15px',
                flexWrap: 'wrap',
                fontSize: '0.9rem'
              }}>
              <div style={{display: 'flex', alignItems: 'center', gap: '8px', minWidth: '200px', marginBottom: '8px'}}>
                <div style={{width: '28px', height: '28px', background: '#a5d6a7', borderRadius: '4px', border: '2px solid #2e7d32', flexShrink: 0}}></div>
                <span style={{color: '#000', fontSize: '0.9rem'}}><strong>Very Common</strong> (30+ times)</span>
              </div>
              <div style={{display: 'flex', alignItems: 'center', gap: '8px', minWidth: '200px', marginBottom: '8px'}}>
                <div style={{width: '28px', height: '28px', background: '#fff59d', borderRadius: '4px', border: '2px solid #f9a825', flexShrink: 0}}></div>
                <span style={{color: '#000', fontSize: '0.9rem'}}><strong>Common</strong> (15-29 times)</span>
              </div>
              <div style={{display: 'flex', alignItems: 'center', gap: '8px', minWidth: '200px', marginBottom: '8px'}}>
                <div style={{width: '28px', height: '28px', background: '#ffcc80', borderRadius: '4px', border: '2px solid #ef6c00', flexShrink: 0}}></div>
                <span style={{color: '#000', fontSize: '0.9rem'}}><strong>Less Common</strong> (5-14 times)</span>
              </div>
              <div style={{display: 'flex', alignItems: 'center', gap: '8px', minWidth: '200px', marginBottom: '8px'}}>
                <div style={{width: '28px', height: '28px', background: '#ef9a9a', borderRadius: '4px', border: '2px solid #c62828', flexShrink: 0}}></div>
                <span style={{color: '#000', fontSize: '0.9rem'}}><strong>Rare</strong> (0-4 times)</span>
              </div>
              </div>
            </div>

            {/* Scrollable Table */}
            <div style={{overflowX: 'auto'}}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.95rem'
              }}>
                <thead>
                  <tr style={{background: '#2c3e50', color: 'white'}}>
                    <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #34495e', fontWeight: 'bold'}}>Score</th>
                    <th style={{padding: '12px', textAlign: 'center', borderBottom: '2px solid #34495e', fontWeight: 'bold'}}>Visitor</th>
                    <th style={{padding: '12px', textAlign: 'center', borderBottom: '2px solid #34495e', fontWeight: 'bold'}}>Home</th>
                    <th style={{padding: '12px', textAlign: 'center', borderBottom: '2px solid #34495e', fontWeight: 'bold'}}>Total</th>
                    <th style={{padding: '12px', textAlign: 'left', borderBottom: '2px solid #34495e', fontWeight: 'bold'}}>Frequency</th>
                  </tr>
                </thead>
                <tbody>
                  {NFL_2025_SCORING_DATA.map((item, idx) => {
                    // Use much darker, more saturated backgrounds with dark text
                    const bgColor = item.frequency === 'very-common' ? '#a5d6a7' :  // Darker green
                                    item.frequency === 'common' ? '#fff59d' :      // Darker yellow
                                    item.frequency === 'less-common' ? '#ffcc80' : // Darker orange
                                    '#ef9a9a';  // Darker red
                    
                    const barColor = item.frequency === 'very-common' ? '#2e7d32' :  // Dark green
                                     item.frequency === 'common' ? '#f9a825' :       // Dark yellow
                                     item.frequency === 'less-common' ? '#ef6c00' :  // Dark orange
                                     '#c62828';  // Dark red
                    
                    const barWidth = Math.min((item.total / 44) * 100, 100); // 44 is max (score 20)
                    
                    return (
                      <tr key={idx} style={{background: bgColor}}>
                        <td style={{padding: '10px', fontWeight: 'bold', borderBottom: '1px solid #999', color: '#000'}}>{item.score}</td>
                        <td style={{padding: '10px', textAlign: 'center', borderBottom: '1px solid #999', color: '#000'}}>{item.visitor}</td>
                        <td style={{padding: '10px', textAlign: 'center', borderBottom: '1px solid #999', color: '#000'}}>{item.home}</td>
                        <td style={{padding: '10px', textAlign: 'center', fontWeight: 'bold', borderBottom: '1px solid #999', color: '#000', fontSize: '1.05rem'}}>{item.total}</td>
                        <td style={{padding: '10px', borderBottom: '1px solid #999'}}>
                          <div style={{
                            background: '#e0e0e0',
                            height: '24px',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            position: 'relative',
                            border: '1px solid #999'
                          }}>
                            <div style={{
                              background: barColor,
                              height: '100%',
                              width: `${barWidth}%`,
                              transition: 'width 0.3s ease',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'flex-end',
                              paddingRight: '8px',
                              color: 'white',
                              fontWeight: 'bold',
                              fontSize: '0.75rem'
                            }}>
                              {barWidth > 15 ? `${item.total}x` : ''}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Close Button */}
            <button
              onClick={() => setShowScoringGuide(false)}
              style={{
                marginTop: '25px',
                width: '100%',
                padding: '12px',
                fontSize: '1rem',
                fontWeight: 'bold',
                color: 'white',
                background: '#667eea',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              ✓ Got it, thanks!
            </button>
          </div>
        </div>
      )}

      <footer>
        <p>Richard's NFL Playoff Pool 2025 | Good luck! 🏈</p>
        <p style={{fontSize: '0.85rem', marginTop: '5px'}}>
          Questions? Contact: gammoneer2b@gmail.com
        </p>
      </footer>
      {/* Score Analysis Modal */}
      {showScoreAnalysis && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          overflow: 'auto'
        }}>
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '12px',
            maxWidth: '95vw',
            maxHeight: '95vh',
            width: '100%',
            overflow: 'auto',
            boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
          }}>
            {/* Header */}
            <div style={{
              padding: '20px',
              borderBottom: '2px solid #ddd',
              backgroundColor: '#667eea',
              color: '#fff',
              borderRadius: '12px 12px 0 0',
              position: 'sticky',
              top: 0,
              zIndex: 10
            }}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <h2 style={{margin: 0}}>🔍 Score Analysis - {currentWeekData.name}</h2>
                <button
                  onClick={() => setShowScoreAnalysis(false)}
                  style={{
                    padding: '10px 20px',
                    background: '#e74c3c',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    fontWeight: 'bold'
                  }}
                >
                  ✖ Close
                </button>
              </div>

              {/* Game Selector */}
              <div style={{marginTop: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap'}}>
                {currentWeekData.games.map(game => (
                  <button
                    key={game.id}
                    onClick={() => setSelectedAnalysisGame(game.id)}
                    style={{
                      padding: '10px 15px',
                      background: selectedAnalysisGame === game.id ? '#4caf50' : '#fff',
                      color: selectedAnalysisGame === game.id ? '#fff' : '#000',
                      border: '2px solid ' + (selectedAnalysisGame === game.id ? '#4caf50' : '#ddd'),
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '0.9rem'
                    }}
                  >
                    Game {game.id}: {getTeamName(currentWeek, game.id, 'team1', playoffTeams)} @ {getTeamName(currentWeek, game.id, 'team2', playoffTeams)}
                  </button>
                ))}
                
                {/* Sort Button */}
                <button
                  onClick={() => setAnalysisSort(analysisSort === 'asc' ? 'desc' : 'asc')}
                  style={{
                    padding: '10px 20px',
                    background: '#f39c12',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '0.9rem',
                    marginLeft: 'auto'
                  }}
                >
                  Sort: {analysisSort === 'asc' ? 'Low → High ↑' : 'High → Low ↓'}
                </button>
              </div>
            </div>

            {/* Content - Two Table Sections */}
            <div>
              {/* Calculate sorted player lists */}
              {(() => {
                // Get all players with their picks for current week
                const playersWithPicks = allPlayers.map(player => {
                  const playerPick = allPicks.find(p => p.playerCode === player.playerCode && p.week === currentWeek);
                  return {
                    ...player,
                    predictions: playerPick?.predictions || {},
                    timestamp: playerPick?.timestamp,
                    lastUpdated: playerPick?.lastUpdated,
                    enteredBy: playerPick?.enteredBy
                  };
                });

                // Filter to show only paid, visible, non-manager players
                const visiblePlayers = playersWithPicks.filter(player => {
                  const isPaid = player.paid === true || player.paymentStatus === 'PAID';
                  const isVisible = player.visible !== false;
                  const isRegularPlayer = player.role !== 'MANAGER';
                  return isPaid && isVisible && isRegularPlayer;
                });

                // Sort by selected game's visiting team score
                const visitingSorted = [...visiblePlayers].sort((a, b) => {
                  const aScore = parseInt(a.predictions[selectedAnalysisGame]?.team1) || (analysisSort === 'asc' ? 999 : -1);
                  const bScore = parseInt(b.predictions[selectedAnalysisGame]?.team1) || (analysisSort === 'asc' ? 999 : -1);
                  return analysisSort === 'asc' ? aScore - bScore : bScore - aScore;
                });

                // Sort by selected game's home team score
                const homeSorted = [...visiblePlayers].sort((a, b) => {
                  const aScore = parseInt(a.predictions[selectedAnalysisGame]?.team2) || (analysisSort === 'asc' ? 999 : -1);
                  const bScore = parseInt(b.predictions[selectedAnalysisGame]?.team2) || (analysisSort === 'asc' ? 999 : -1);
                  return analysisSort === 'asc' ? aScore - bScore : bScore - aScore;
                });

                const selectedGameInfo = currentWeekData.games.find(g => g.id === selectedAnalysisGame);

                return (
                  <>
                    {/* TOP SECTION - Visiting Team Sort */}
                    <div style={{marginBottom: '30px'}}>
                      <h3 style={{
                        padding: '15px',
                        margin: 0,
                        backgroundColor: 'rgba(200, 230, 201, 0.5)',
                        borderBottom: '3px solid #4caf50',
                        color: '#000',
                        fontWeight: 'bold'
                      }}>
                        🔼 VISITING TEAM SORT - Game {selectedAnalysisGame}: {getTeamName(currentWeek, selectedAnalysisGame, 'team1', playoffTeams)} @ {getTeamName(currentWeek, selectedAnalysisGame, 'team2', playoffTeams)}
                      </h3>
                      
                      <div style={{overflowX: 'auto', backgroundColor: 'rgba(200, 230, 201, 0.15)'}}>
                        <table className="picks-table" style={{width: '100%', borderCollapse: 'collapse'}}>
                          <thead>
                            <tr>
                              <th style={{padding: '10px', fontWeight: 'bold', borderRight: '2px solid #ddd', backgroundColor: '#f5f5f5', color: '#000', fontSize: '14px', textAlign: 'left'}}>
                                Player Name
                              </th>
                              <th style={{padding: '10px', textAlign: 'center', backgroundColor: '#e8f5e9', borderLeft: '3px solid #ccc', color: '#000', fontSize: '14px', fontWeight: 'bold'}}>
                                {getTeamName(currentWeek, selectedAnalysisGame, 'team1', playoffTeams) || 'Visiting Team'}
                              </th>
                              <th style={{padding: '10px', textAlign: 'center', backgroundColor: '#e3f2fd', color: '#000', fontSize: '14px', fontWeight: 'bold'}}>
                                {getTeamName(currentWeek, selectedAnalysisGame, 'team2', playoffTeams) || 'Home Team'}
                              </th>
                              <th style={{padding: '10px', textAlign: 'center', backgroundColor: '#f5f5f5', color: '#000', fontSize: '14px', fontWeight: 'bold'}}>
                                Date/Time
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {visitingSorted.map((player, idx) => {
                              const isRNGPick = player.enteredBy === 'POOL_MANAGER_RNG';
                              const pred = player.predictions[selectedAnalysisGame];
                              const actual = actualScores[currentWeek]?.[selectedAnalysisGame];
                              const status = gameStatus[currentWeek]?.[selectedAnalysisGame];
                              
                              const team1Style = getCellHighlight(
                                pred?.team1, pred?.team2,
                                actual?.team1, actual?.team2,
                                status, true
                              );
                              const team2Style = getCellHighlight(
                                pred?.team1, pred?.team2,
                                actual?.team1, actual?.team2,
                                status, false
                              );
                              
                              return (
                                <tr key={idx} style={{backgroundColor: idx % 2 === 0 ? '#fff' : '#f9f9f9'}}>
                                  <td style={{padding: '10px', fontWeight: 'bold', borderRight: '2px solid #ddd', color: '#000', fontSize: '14px'}}>
                                    {player.playerName || 'Unknown Player'}
                                    {isRNGPick && <span style={{marginLeft: '5px'}} title="Random picks">🎲</span>}
                                  </td>
                                  <td style={{
                                    padding: '10px',
                                    textAlign: 'center',
                                    background: team1Style.background,
                                    color: team1Style.color || '#000',
                                    fontWeight: team1Style.background !== 'transparent' ? 'bold' : 'normal',
                                    borderLeft: '3px solid #ccc',
                                    fontSize: '14px'
                                  }}>
                                    {pred?.team1 || '-'}
                                  </td>
                                  <td style={{
                                    padding: '10px',
                                    textAlign: 'center',
                                    background: team2Style.background,
                                    color: team2Style.color || '#000',
                                    fontWeight: team2Style.background !== 'transparent' ? 'bold' : 'normal',
                                    fontSize: '14px'
                                  }}>
                                    {pred?.team2 || '-'}
                                  </td>
                                  <td style={{padding: '10px', textAlign: 'center', fontSize: '12px', color: '#666'}}>
                                    {player.lastUpdated ? new Date(player.lastUpdated).toLocaleString('en-US', {timeZone: 'America/Los_Angeles'}) + ' PST' : player.timestamp ? new Date(player.timestamp).toLocaleString('en-US', {timeZone: 'America/Los_Angeles'}) + ' PST' : '-'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* BOTTOM SECTION - Home Team Sort */}
                    <div>
                      <h3 style={{
                        padding: '15px',
                        margin: 0,
                        backgroundColor: 'rgba(179, 229, 252, 0.5)',
                        borderBottom: '3px solid #2196F3',
                        color: '#000',
                        fontWeight: 'bold'
                      }}>
                        🔽 HOME TEAM SORT - Game {selectedAnalysisGame}: {getTeamName(currentWeek, selectedAnalysisGame, 'team1', playoffTeams)} @ {getTeamName(currentWeek, selectedAnalysisGame, 'team2', playoffTeams)}
                      </h3>
                      
                      <div style={{overflowX: 'auto', backgroundColor: 'rgba(179, 229, 252, 0.15)'}}>
                        <table className="picks-table" style={{width: '100%', borderCollapse: 'collapse'}}>
                          <thead>
                            <tr>
                              <th style={{padding: '10px', fontWeight: 'bold', borderRight: '2px solid #ddd', backgroundColor: '#f5f5f5', color: '#000', fontSize: '14px', textAlign: 'left'}}>
                                Player Name
                              </th>
                              <th style={{padding: '10px', textAlign: 'center', backgroundColor: '#e8f5e9', borderLeft: '3px solid #ccc', color: '#000', fontSize: '14px', fontWeight: 'bold'}}>
                                {getTeamName(currentWeek, selectedAnalysisGame, 'team1', playoffTeams) || 'Visiting Team'}
                              </th>
                              <th style={{padding: '10px', textAlign: 'center', backgroundColor: '#e3f2fd', color: '#000', fontSize: '14px', fontWeight: 'bold'}}>
                                {getTeamName(currentWeek, selectedAnalysisGame, 'team2', playoffTeams) || 'Home Team'}
                              </th>
                              <th style={{padding: '10px', textAlign: 'center', backgroundColor: '#f5f5f5', color: '#000', fontSize: '14px', fontWeight: 'bold'}}>
                                Date/Time
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {homeSorted.map((player, idx) => {
                              const isRNGPick = player.enteredBy === 'POOL_MANAGER_RNG';
                              const pred = player.predictions[selectedAnalysisGame];
                              const actual = actualScores[currentWeek]?.[selectedAnalysisGame];
                              const status = gameStatus[currentWeek]?.[selectedAnalysisGame];
                              
                              const team1Style = getCellHighlight(
                                pred?.team1, pred?.team2,
                                actual?.team1, actual?.team2,
                                status, true
                              );
                              const team2Style = getCellHighlight(
                                pred?.team1, pred?.team2,
                                actual?.team1, actual?.team2,
                                status, false
                              );
                              
                              return (
                                <tr key={idx} style={{backgroundColor: idx % 2 === 0 ? '#fff' : '#f9f9f9'}}>
                                  <td style={{padding: '10px', fontWeight: 'bold', borderRight: '2px solid #ddd', color: '#000', fontSize: '14px'}}>
                                    {player.playerName || 'Unknown Player'}
                                    {isRNGPick && <span style={{marginLeft: '5px'}} title="Random picks">🎲</span>}
                                  </td>
                                  <td style={{
                                    padding: '10px',
                                    textAlign: 'center',
                                    background: team1Style.background,
                                    color: team1Style.color || '#000',
                                    fontWeight: team1Style.background !== 'transparent' ? 'bold' : 'normal',
                                    borderLeft: '3px solid #ccc',
                                    fontSize: '14px'
                                  }}>
                                    {pred?.team1 || '-'}
                                  </td>
                                  <td style={{
                                    padding: '10px',
                                    textAlign: 'center',
                                    background: team2Style.background,
                                    color: team2Style.color || '#000',
                                    fontWeight: team2Style.background !== 'transparent' ? 'bold' : 'normal',
                                    fontSize: '14px'
                                  }}>
                                    {pred?.team2 || '-'}
                                  </td>
                                  <td style={{padding: '10px', textAlign: 'center', fontSize: '12px', color: '#666'}}>
                                    {player.lastUpdated ? new Date(player.lastUpdated).toLocaleString('en-US', {timeZone: 'America/Los_Angeles'}) + ' PST' : player.timestamp ? new Date(player.timestamp).toLocaleString('en-US', {timeZone: 'America/Los_Angeles'}) + ' PST' : '-'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
