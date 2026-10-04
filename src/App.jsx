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
  calculateGrandPrize2,
  calculateWeekPrize1APPTB,
  calculateWeekPrize2APPTB,
  calculateWeek4Prize1APPTB,
  calculateWeek4Prize2APPTB,
  calculateGrandPrize1APPTB,
  calculateGrandPrize2APPTB
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
  apiKey: "AIzaSyC74scK4UE-ihBx4t8PHzeGIFn7_DqzgsA",
  authDomain: "nfl-pool-2026-2027.firebaseapp.com",
  databaseURL: "https://nfl-pool-2026-2027-default-rtdb.firebaseio.com",
  projectId: "nfl-pool-2026-2027",
  storageBucket: "nfl-pool-2026-2027.firebasestorage.app",
  messagingSenderId: "919207589157",
  appId: "1:919207589157:web:a8ed8928f023acb13b96cc"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// ============================================
// 🔥 FIREBASE LISTENERS - Outside React to avoid StrictMode interference
// ============================================
let _allPicksAPPTV = [];
let _allPicksAPPTB = [];
let _apptvLoaded = false;
let _apptbLoaded = false;
const _apptvCallbacks = [];
const _apptbCallbacks = [];

const normalizeRecord = (key, data) => {
  const rec = { ...data, firebaseKey: key };
  if (Array.isArray(rec.predictions)) {
    const obj = {};
    rec.predictions.forEach((p, i) => { if (i > 0 && p) obj[i] = p; });
    rec.predictions = obj;
  }
  return rec;
};

onValue(ref(database, 'picks_apptv'), (snapshot) => {
  const data = snapshot.val();
  console.log('🔥 picks_apptv GLOBAL listener fired:', data ? Object.keys(data).length + ' records' : 'NULL');
  _allPicksAPPTV = data ? Object.keys(data).map(k => normalizeRecord(k, data[k])).filter(r => !r.intentionalWipe) : [];
  _apptvLoaded = true;
  _apptvCallbacks.forEach(cb => cb(_allPicksAPPTV));
});

onValue(ref(database, 'picks_apptb'), (snapshot) => {
  const data = snapshot.val();
  console.log('🔥 picks_apptb GLOBAL listener fired:', data ? Object.keys(data).length + ' records' : 'NULL');
  _allPicksAPPTB = data ? Object.keys(data).map(k => normalizeRecord(k, data[k])).filter(r => !r.intentionalWipe) : [];
  _apptbLoaded = true;
  _apptbCallbacks.forEach(cb => cb(_allPicksAPPTB));
});

// ============================================
// 🔥 POOL #3 GLOBAL FIREBASE LISTENER (Winner, ATS, O/U — Blind)
// ============================================
let _allPicksPool3 = [];
let _pool3Loaded = false;
const _pool3Callbacks = [];

const normalizePool3Record = (key, data) => {
  // Pool #3 picks structure: { winner, ats, ou } per game
  return { ...data, firebaseKey: key };
};

onValue(ref(database, 'picks_pool3'), (snapshot) => {
  const data = snapshot.val();
  _allPicksPool3 = data ? Object.keys(data).map(k => normalizePool3Record(k, data[k])).filter(r => !r.intentionalWipe) : [];
  _pool3Loaded = true;
  _pool3Callbacks.forEach(cb => cb(_allPicksPool3));
});

// ============================================
// 📅 PLAYOFF SEASON CONFIGURATION
// ============================================
// Define when the playoff season starts and ends
// Submissions lock on WEEKENDS ONLY during playoff season
// Format: YYYY-MM-DD
// ============================================
// 📅 FALLBACK DATES - Used only if Firebase has no dates saved yet
// Pool Manager sets actual dates via the app (Setup Playoff Dates/Teams tab)
// These are overridden at runtime by playoffDates loaded from Firebase
// ============================================
const PLAYOFF_SEASON_FALLBACK = {
  firstFriday: "2027-01-15",
  lastMonday: "2027-02-15"
};

const AUTO_LOCK_DATES_FALLBACK = {
  wildcard: "2027-01-16",
  divisional: "2027-01-23",
  conference: "2027-01-31",
  superbowl: "2027-02-14"
};
// ✅ UPDATED WITH ACTUAL NFL PLAYOFF 2026/2027 DATES
// Wild Card Weekend: Jan 16-18, 2027 (Sat-Sun-Mon) — Locks Sat Jan 16 @ 12:01 AM PST
// Divisional Round: Jan 23-24, 2027 (Sat-Sun) — Locks Sat Jan 23 @ 12:01 AM PST
// Conference Championships: Jan 31, 2027 (Sunday) — Locks Sun Jan 31 @ 12:01 AM PST
// Super Bowl LXI: Feb 14, 2027 (Sunday) @ SoFi Stadium, Inglewood CA — Locks Sun Feb 14 @ 12:01 AM PST
// PLAYER RULE: All picks must be submitted by 11:59 PM PST on the Friday before each game weekend!
// ============================================

// ============================================
// 🔧 POOL MANAGER CONFIGURATION
// ============================================
// TO ADD POOL MANAGERS:
// Just add codes to the array below. Use 6 characters (letters/numbers).
// You can have multiple pool managers!
const POOL_MANAGER_CODES = ["TEST01", "76BB89", "Z9Y8X7"];  // TEST01 for dev database, others for production
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
  // TEST PLAYERS for 2026/2027 development database
  "TEST01": "Test Player",
  "TEST0A": "Test Player A",
  "TEST0B": "Test Player B",
  "TEST0C": "Test Player C",
  // 2025/2026 Players (keep for reference)
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
  "KB7689": "Richard Biletski",
  "62R92L": "Rob Crowe",
  "H8M3N7": "Rob Kost",
  "WW3F44": "Ryan Moffatt",
  "MX8A7H": "Tim Gunness",
  "E5G7G8": "Tony Creta",
  "WXY324": "Travis Biletski",
  "KD2RD2": "Travis McKillop",
  "2026CB": "Christopher Booton",
  "JS3212": "Johnny Sandhu"
  // Add more players here...
  // Example: "Z8X5C3": "New Player",
};
// ============================================

// Playoff structure - update these with actual matchups when known
const PLAYOFF_WEEKS = {
  wildcard: {
    name: "Wild Card Round (Jan 16-18, 2027)",
    deadline: "Friday, January 15, 2027 at 11:59 PM PST",
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
    name: "Divisional Round (Jan 23-24, 2027)",
    deadline: "Friday, January 22, 2027 at 11:59 PM PST",
    games: [
      { id: 7, team1: "AFC #1", team2: "AFC Winner A" },
      { id: 8, team1: "AFC Winner B", team2: "AFC Winner C" },
      { id: 9, team1: "NFC #1", team2: "NFC Winner A" },
      { id: 10, team1: "NFC Winner B", team2: "NFC Winner C" }
    ]
  },
  conference: {
    name: "Conference Championships (Jan 31, 2027)",
    deadline: "Friday, January 30, 2027 at 11:59 PM PST",
    games: [
      { id: 11, team1: "AFC Winner A", team2: "AFC Winner B" },
      { id: 12, team1: "NFC Winner A", team2: "NFC Winner B" }
    ]
  },
  superbowl: {
    name: "Super Bowl LXI (Feb 14, 2027)",
    deadline: "Friday, February 13, 2027 at 11:59 PM PST",
    games: [
      { id: 13, team1: "AFC Champion", team2: "NFC Champion" }
    ]
  }
};

/**
 * Generate Week 1 games dynamically from saved configuration
 * Constructs game array based on position and gameNumber assignments
 */
const generateWeek1Games = (playoffTeams) => {
  if (!playoffTeams?.week1) {
    // Return default hardcoded games if not configured
    return [
      { id: 1, team1: "AFC #7", team2: "AFC #2" },
      { id: 2, team1: "AFC #6", team2: "AFC #3" },
      { id: 3, team1: "AFC #5", team2: "AFC #4" },
      { id: 4, team1: "NFC #7", team2: "NFC #2" },
      { id: 5, team1: "NFC #6", team2: "NFC #3" },
      { id: 6, team1: "NFC #5", team2: "NFC #4" }
    ];
  }

  // Collect all teams with their game assignments
  const allTeams = [];
  
  // Collect AFC teams
  ['afc', 'nfc'].forEach(conference => {
    for (let seed = 1; seed <= 7; seed++) {
      const seedData = playoffTeams.week1[conference][`seed${seed}`];
      const team = seedData?.team || seedData;
      
      if (team && seedData?.gameNumber > 0) { // Skip bye week teams (gameNumber 0)
        allTeams.push({
          conference: conference.toUpperCase(),
          seed: seed,
          gameNumber: seedData.gameNumber,
          position: seedData.position,
          placeholder: `${conference.toUpperCase()} #${seed}`
        });
      }
    }
  });

  // Group teams by game number and construct games
  const games = [];
  for (let gameNum = 1; gameNum <= 6; gameNum++) {
    const teamsInGame = allTeams.filter(t => t.gameNumber === gameNum);
    const visitor = teamsInGame.find(t => t.position === 'visitor');
    const home = teamsInGame.find(t => t.position === 'home');
    
    if (visitor && home) {
      games.push({
        id: gameNum,
        team1: visitor.placeholder,  // Visitor = team1
        team2: home.placeholder      // Home = team2
      });
    } else {
      // Fallback if game not fully configured
      games.push({
        id: gameNum,
        team1: "TBD",
        team2: "TBD"
      });
    }
  }

  // Sort by game number
  return games.sort((a, b) => a.id - b.id);
};

/**
 * Generate Week 2 games dynamically from saved configuration
 */
const generateWeek2Games = (playoffTeams) => {
  if (!playoffTeams?.week2Manual) {
    // Return TBD placeholders if not configured
    return [
      { id: 7, team1: "TBD", team2: "TBD" },
      { id: 8, team1: "TBD", team2: "TBD" },
      { id: 9, team1: "TBD", team2: "TBD" },
      { id: 10, team1: "TBD", team2: "TBD" }
    ];
  }

  const games = [];
  const week2 = playoffTeams.week2Manual;
  
  // Games 7-10
  [7, 8, 9, 10].forEach(gameNum => {
    const gameKey = `game${gameNum}`;
    const game = week2[gameKey];
    
    if (game?.away && game?.home) {
      games.push({
        id: gameNum,
        team1: game.away.name || game.away,
        team2: game.home.name || game.home
      });
    } else {
      games.push({
        id: gameNum,
        team1: "TBD",
        team2: "TBD"
      });
    }
  });

  return games.sort((a, b) => a.id - b.id);
};

/**
 * Generate Week 3 games dynamically from saved configuration
 */
const generateWeek3Games = (playoffTeams) => {
  if (!playoffTeams?.week3Manual) {
    // Return TBD placeholders if not configured
    return [
      { id: 11, team1: "TBD", team2: "TBD" },
      { id: 12, team1: "TBD", team2: "TBD" }
    ];
  }

  const games = [];
  const week3 = playoffTeams.week3Manual;
  
  // Games 11-12
  [11, 12].forEach(gameNum => {
    const gameKey = `game${gameNum}`;
    const game = week3[gameKey];
    
    if (game?.away && game?.home) {
      games.push({
        id: gameNum,
        team1: game.away.name || game.away,
        team2: game.home.name || game.home
      });
    } else {
      games.push({
        id: gameNum,
        team1: "TBD",
        team2: "TBD"
      });
    }
  });

  return games.sort((a, b) => a.id - b.id);
};

/**
 * Generate Week 4 game dynamically from saved configuration
 */
const generateWeek4Games = (playoffTeams) => {
  if (!playoffTeams?.week4Manual) {
    // Return TBD placeholder if not configured
    return [
      { id: 13, team1: "TBD", team2: "TBD" }
    ];
  }

  const games = [];
  const week4 = playoffTeams.week4Manual;
  const game = week4.game13;
  
  if (game?.away && game?.home) {
    games.push({
      id: 13,
      team1: game.away.name || game.away,
      team2: game.home.name || game.home
    });
  } else {
    games.push({
      id: 13,
      team1: "TBD",
      team2: "TBD"
    });
  }

  return games;
};

/**
 * Get real team name from playoff teams configuration
 * Falls back to placeholder if not configured yet
 * Handles enhanced display like "KC (AFC #1)" or "BUF (Game #1 Winner)"
 * ## 🎯 **SUPER BOWL 2025/2026 SUPER BOWL LX (60) HOME/AWAY:**

**For Super Bowl, the "home" team is determined by:**
*- AFC Champion = designated "home" (even years) RDB make NOTE of this AFC Champion is EVEN YEARs so NE is home in 2026
*- NFC Champion = designated "home" (odd years) RDB make NOTE of this NFC Champion is ODD YEARs so SEA is visitor in 2026

**2025 Super Bowl (Feb 8, 2026):**
*- This is Super Bowl LX
*- **AFC Champion (NE Patriots) = HOME team** 🏠
*- **NFC Champion (SEA Seahawks) = AWAY team** ✈️
 */
const getTeamName = (week, gameId, teamPosition, playoffTeams, dynamicGames = null, teamCodes = null) => {
  // Use dynamic games if provided, otherwise fall back to PLAYOFF_WEEKS
  const getGamesList = (weekKey) => {
    if (weekKey === 'wildcard' && dynamicGames) {
      return dynamicGames;
    }
    return PLAYOFF_WEEKS[weekKey].games;
  };

  // Week 1 - Wild Card
  if (week === 'wildcard') {
    // Read from playoffTeams.week1 seed structure
    // Seeds with position='home' are home teams (team2)
    // Seeds with position=null/undefined/None are visitor teams (team1)
    if (playoffTeams?.week1) {
      const week1 = playoffTeams.week1;
      const allSeeds = [];
      ['afc', 'nfc'].forEach(conf => {
        const confData = week1[conf] || {};
        Object.values(confData).forEach(seed => {
          if (seed && seed.gameNumber && seed.gameNumber > 0) {
            allSeeds.push({
              gameNumber: seed.gameNumber,
              position: seed.position,
              teamName: seed.team?.name || seed.name || 'TBD'
            });
          }
        });
      });
      // team1 = visitor (position is null/undefined/None/empty)
      // team2 = home (position === 'home')
      const isHome = teamPosition === 'team2';
      const match = allSeeds.find(s =>
        s.gameNumber === gameId &&
        (isHome ? s.position === 'home' : s.position !== 'home')
      );
      if (match?.teamName && match.teamName !== 'TBD') return match.teamName;
    }

    // Fall back to placeholder (AFC #7 etc.)
    const game = getGamesList('wildcard').find(g => g.id === gameId);
    return game ? game[teamPosition] : 'TBD';
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
        return actualTeam.name;  // Return ONLY team code
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
        return actualTeam.name;  // Return ONLY team code
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
        return actualTeam.name;  // Return ONLY team code
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

// ============================================
// 🛡️ ERROR BOUNDARY - Prevents blank screen on crashes
// ============================================
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('🚨 App crashed:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{padding: '40px', textAlign: 'center', fontFamily: 'sans-serif'}}>
          <h1 style={{color: '#d32f2f'}}>⚠️ Something went wrong</h1>
          <p style={{fontSize: '1.1rem', marginBottom: '20px'}}>The app crashed due to invalid data (possibly tied scores).</p>
          <p style={{color: '#666', marginBottom: '30px', fontSize: '0.9rem'}}>{this.state.error?.message}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{padding: '12px 24px', background: '#1976d2', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer', marginRight: '12px'}}
          >
            🔄 Try to Recover
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{padding: '12px 24px', background: '#388e3c', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer'}}
          >
            🔁 Full Reload
          </button>
          <p style={{marginTop: '30px', color: '#999', fontSize: '0.85rem'}}>
            If this keeps happening, go to Firebase and delete the picks record with tied or empty scores.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

// ============================================================
// 🎯 POOL #3/#4 SETUP — Pool Manager: kill switch + lines + grading
// ============================================================
const Pool34Setup = ({
  pool34Enabled, bettingLines, bettingLinesForm, setBettingLinesForm,
  currentWeek, playoffTeams, teamCodes, getTeamName,
  actualScores, gradingOverrides, onToggleKillSwitch, onSaveBettingLines, onSaveGradingOverrides
}) => {
  const weeks = ['wildcard', 'divisional', 'conference', 'superbowl'];
  const weekLabels = { wildcard: 'Wk1 Wild Card', divisional: 'Wk2 Divisional', conference: 'Wk3 Conference', superbowl: 'Wk4 Super Bowl' };
  const gameCounts = { wildcard: 6, divisional: 4, conference: 2, superbowl: 1 };
  const [activeWeek, setActiveWeek] = React.useState(currentWeek || 'wildcard');
  const [activeSection, setActiveSection] = React.useState('lines'); // 'lines' | 'grading'
  const [saving, setSaving] = React.useState(false);
  const [savingGrading, setSavingGrading] = React.useState(false);
  const [localOverrides, setLocalOverrides] = React.useState(gradingOverrides || {});

  React.useEffect(() => { setLocalOverrides(gradingOverrides || {}); }, [gradingOverrides]);

  const getLine = (wk, gid, field) => bettingLinesForm?.[wk]?.[gid]?.[field] ?? '';
  const setLine = (wk, gid, field, val) => setBettingLinesForm(prev => ({
    ...prev, [wk]: { ...(prev[wk] || {}), [gid]: { ...(prev[wk]?.[gid] || {}), [field]: val } }
  }));

  const gamesForWeek = wk => Array.from({ length: gameCounts[wk] || 0 }, (_, i) => i + 1);

  // ── Auto-calculate ATS and O/U from actual scores ──────────
  const autoGrade = (wk, gid) => {
    const actual = actualScores?.[wk]?.[gid];
    const line = bettingLines?.[wk]?.[gid];
    if (!actual || !line) return null;
    const t1 = parseInt(actual.team1), t2 = parseInt(actual.team2);
    if (isNaN(t1) || isNaN(t2)) return null;
    const awayName = getTeamName(wk, gid, 'team1', playoffTeams, null, teamCodes);
    const homeName = getTeamName(wk, gid, 'team2', playoffTeams, null, teamCodes);
    const spread = parseFloat(line.spread);
    const ou = parseFloat(line.overUnder);
    const fav = line.favourite;
    const favIsAway = fav === awayName;
    const actualMargin = favIsAway ? (t1 - t2) : (t2 - t1);
    const atsResult = actualMargin > spread ? 'favourite' : 'underdog';
    const ouResult = (t1 + t2) > ou ? 'over' : 'under';
    const winnerActual = t1 > t2 ? awayName : homeName;
    return { winner: winnerActual, ats: atsResult, ou: ouResult, total: t1 + t2, margin: actualMargin };
  };

  const getGradedResult = (wk, gid, field) => {
    const ov = localOverrides?.[wk]?.[gid]?.[field];
    if (ov !== undefined) return ov;
    const auto = autoGrade(wk, gid);
    return auto ? auto[field] : null;
  };

  const setOverride = (wk, gid, field, val) => setLocalOverrides(prev => ({
    ...prev, [wk]: { ...(prev[wk] || {}), [gid]: { ...(prev[wk]?.[gid] || {}), [field]: val } }
  }));

  const clearOverride = (wk, gid, field) => {
    setLocalOverrides(prev => {
      const copy = JSON.parse(JSON.stringify(prev));
      if (copy[wk]?.[gid]) { delete copy[wk][gid][field]; }
      return copy;
    });
  };

  const handleSaveGrading = async () => {
    setSavingGrading(true);
    try { await onSaveGradingOverrides(localOverrides); alert('✅ Grading overrides saved!'); }
    finally { setSavingGrading(false); }
  };

  // ── Result toggle button ───────────────────────────────────
  const ResultBtn = ({ active, onClick, children, color }) => (
    <button type="button" onClick={onClick} style={{
      padding: '6px 12px', fontWeight: '700', fontSize: '0.82rem', borderRadius: '6px',
      border: `2px solid ${color}`, background: active ? color : '#fff',
      color: active ? '#fff' : color, cursor: 'pointer', whiteSpace: 'nowrap'
    }}>{children}</button>
  );

  return (
    <div style={{ padding: '20px', maxWidth: '960px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)', color: '#fff', padding: '20px 24px', borderRadius: '12px', marginBottom: '20px' }}>
        <h2 style={{ margin: '0 0 4px 0', fontSize: '1.4rem' }}>🎯 Pool #3 Winner, ATS, O/U — Pool Manager Setup</h2>
        <p style={{ margin: 0, opacity: 0.9, fontSize: '0.85rem' }}>Kill switch · Betting lines entry · Post-game grading</p>
      </div>

      {/* Kill switch */}
      <div style={{ background: pool34Enabled ? '#d1fae5' : '#fee2e2', border: `3px solid ${pool34Enabled ? '#10b981' : '#ef4444'}`, borderRadius: '12px', padding: '16px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontWeight: '800', fontSize: '1.1rem', color: pool34Enabled ? '#065f46' : '#991b1b' }}>
            {pool34Enabled ? '✅ Pool #3 Winner, ATS, O/U ACTIVE' : '🔴 Pool #3 Winner, ATS, O/U DISABLED'}
          </div>
          <div style={{ fontSize: '0.82rem', color: '#555', marginTop: '3px' }}>
            {pool34Enabled ? 'Visible to all players. Toggle off to hide immediately.' : 'Hidden from all players. Toggle on to launch.'}
          </div>
        </div>
        <button onClick={() => { if (window.confirm(pool34Enabled ? '⚠️ Disable Pool #3 Winner, ATS, O/U?\n\nTab disappears for all players immediately.\nExisting picks are preserved.\n\nContinue?' : '✅ Enable Pool #3 Winner, ATS, O/U?\n\nTab appears for all players immediately.\nEnsure betting lines are entered first!\n\nContinue?')) onToggleKillSwitch(!pool34Enabled); }}
          style={{ padding: '10px 24px', fontWeight: '800', fontSize: '0.95rem', borderRadius: '10px', border: 'none', cursor: 'pointer', background: pool34Enabled ? '#ef4444' : '#10b981', color: '#fff', boxShadow: '0 3px 10px rgba(0,0,0,0.2)' }}>
          {pool34Enabled ? '🔴 Disable' : '✅ Enable'}
        </button>
      </div>

      {/* Scoring reminder */}
      <div style={{ background: '#f5f3ff', border: '2px solid #7c3aed', borderRadius: '8px', padding: '10px 16px', marginBottom: '20px', fontSize: '0.88rem', color: '#3b0764' }}>
        <strong>📋 Scoring:</strong> Winner correct = <strong>2 pts</strong> &nbsp;|&nbsp; ATS correct = <strong>3 pts</strong> &nbsp;|&nbsp; O/U correct = <strong>3 pts</strong> &nbsp;|&nbsp; Max = <strong>8 pts/game</strong>
      </div>

      {/* Section tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '2px solid #e5e7eb', paddingBottom: '12px' }}>
        {[['lines', '📋 Enter Betting Lines'], ['grading', '✅ Grade Results']].map(([id, label]) => (
          <button key={id} onClick={() => setActiveSection(id)} style={{
            padding: '10px 20px', fontWeight: '700', fontSize: '0.9rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
            background: activeSection === id ? '#7c3aed' : '#e5e7eb', color: activeSection === id ? '#fff' : '#374151'
          }}>{label}</button>
        ))}
      </div>

      {/* Week selector */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '18px' }}>
        {weeks.map(wk => (
          <button key={wk} onClick={() => setActiveWeek(wk)} style={{
            padding: '8px 16px', fontWeight: '700', fontSize: '0.85rem', borderRadius: '8px', border: 'none', cursor: 'pointer',
            background: activeWeek === wk ? '#7c3aed' : '#e5e7eb', color: activeWeek === wk ? '#fff' : '#374151'
          }}>{weekLabels[wk]}</button>
        ))}
      </div>

      {/* ── BETTING LINES SECTION ── */}
      {activeSection === 'lines' && (
        <>
          <div style={{ background: '#fff', border: '2px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden', marginBottom: '16px' }}>
            <div style={{ background: '#f3f4f6', padding: '9px 14px', display: 'grid', gridTemplateColumns: '1fr 160px 110px 110px', gap: '10px', fontWeight: '700', fontSize: '0.76rem', color: '#1f2937', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <div>Game</div><div>Favourite Team</div><div>Spread</div><div>Over/Under</div>
            </div>
            {gamesForWeek(activeWeek).map((gid, idx) => {
              const away = getTeamName(activeWeek, gid, 'team1', playoffTeams, null, teamCodes);
              const home = getTeamName(activeWeek, gid, 'team2', playoffTeams, null, teamCodes);
              const spread = getLine(activeWeek, gid, 'spread');
              const ou = getLine(activeWeek, gid, 'overUnder');
              const fav = getLine(activeWeek, gid, 'favourite');
              return (
                <div key={gid} style={{ padding: '12px 14px', borderTop: idx > 0 ? '1px solid #e5e7eb' : 'none', display: 'grid', gridTemplateColumns: '1fr 160px 110px 110px', gap: '10px', alignItems: 'center', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>
                    <span style={{ fontSize: '0.72rem', color: '#7c3aed', fontWeight: '700', marginRight: '5px' }}>G{gid}</span>
                    {away} @ {home}
                    {fav && spread && <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: '2px' }}>{fav} −{spread} | O/U {ou||'?'}</div>}
                  </div>
                  <select value={fav} onChange={e => setLine(activeWeek, gid, 'favourite', e.target.value)}
                    style={{ padding: '7px 8px', border: '2px solid #d1d5db', borderRadius: '6px', fontSize: '0.88rem', fontWeight: '600', background: fav ? '#f5f3ff' : '#fff', color: fav ? '#5b21b6' : '#9ca3af', cursor: 'pointer' }}>
                    <option value="">— Favourite —</option>
                    <option value={away}>{away} (Away)</option>
                    <option value={home}>{home} (Home)</option>
                  </select>
                  <input type="number" min="0.5" step="0.5" value={spread} onChange={e => setLine(activeWeek, gid, 'spread', e.target.value)} placeholder="3.5"
                    style={{ padding: '7px 8px', border: '2px solid #d1d5db', borderRadius: '6px', fontSize: '0.95rem', fontWeight: '700', textAlign: 'center', width: '100%', boxSizing: 'border-box' }} />
                  <input type="number" min="20" step="0.5" value={ou} onChange={e => setLine(activeWeek, gid, 'overUnder', e.target.value)} placeholder="43.5"
                    style={{ padding: '7px 8px', border: '2px solid #d1d5db', borderRadius: '6px', fontSize: '0.95rem', fontWeight: '700', textAlign: 'center', width: '100%', boxSizing: 'border-box' }} />
                </div>
              );
            })}
          </div>
          <button onClick={async () => { setSaving(true); try { await onSaveBettingLines(bettingLinesForm); } finally { setSaving(false); } }} disabled={saving}
            style={{ width: '100%', padding: '14px', background: saving ? '#9ca3af' : 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '1rem', fontWeight: '800', cursor: saving ? 'not-allowed' : 'pointer', boxShadow: '0 4px 12px rgba(124,58,237,0.4)' }}>
            {saving ? '⏳ Saving...' : '💾 Save Betting Lines'}
          </button>
          <p style={{ textAlign: 'center', color: '#4b5563', fontSize: '0.82rem', marginTop: '8px' }}>Saves to Firebase — auto-populates all players' Pool #3 picks.</p>
        </>
      )}

      {/* ── GRADING SECTION ── */}
      {activeSection === 'grading' && (
        <>
          <div style={{ background: '#fffbeb', border: '2px solid #fcd34d', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', fontSize: '0.85rem', color: '#78350f' }}>
            <strong>⚡ Auto-graded from actual scores.</strong> Override any result below only if needed. Green = auto-calculated. Yellow = manually overridden.
          </div>
          <div style={{ background: '#fff', border: '2px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden', marginBottom: '16px' }}>
            {/* Table header */}
            <div style={{ background: '#1f2937', padding: '9px 14px', display: 'grid', gridTemplateColumns: '1fr 150px 150px 150px', gap: '10px', fontWeight: '700', fontSize: '0.76rem', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <div>Game &amp; Actual Score</div><div>Winner</div><div>ATS Result</div><div>O/U Result</div>
            </div>
            {gamesForWeek(activeWeek).map((gid, idx) => {
              const away = getTeamName(activeWeek, gid, 'team1', playoffTeams, null, teamCodes);
              const home = getTeamName(activeWeek, gid, 'team2', playoffTeams, null, teamCodes);
              const actual = actualScores?.[activeWeek]?.[gid];
              const line = bettingLines?.[activeWeek]?.[gid];
              const auto = autoGrade(activeWeek, gid);
              const hasOverrideWinner = localOverrides?.[activeWeek]?.[gid]?.winner !== undefined;
              const hasOverrideAts = localOverrides?.[activeWeek]?.[gid]?.ats !== undefined;
              const hasOverrideOu = localOverrides?.[activeWeek]?.[gid]?.ou !== undefined;
              const winnerResult = getGradedResult(activeWeek, gid, 'winner');
              const atsResult = getGradedResult(activeWeek, gid, 'ats');
              const ouResult = getGradedResult(activeWeek, gid, 'ou');
              const fav = line?.favourite || '?';
              const underdog = (fav === away || away.includes(fav) || fav.includes(away)) ? home : away;
              const ou = parseFloat(line?.overUnder) || 0;
              const spread = parseFloat(line?.spread) || 0;

              // Status badge helper
              const statusBadge = (hasOverride, hasAutoVal, clearField) => {
                if (hasOverride) return <div style={{ fontSize: '0.7rem', color: '#d97706', fontWeight: '700', marginTop: '3px' }}>⚠️ OVERRIDDEN <button onClick={() => clearOverride(activeWeek, gid, clearField)} style={{ fontSize: '0.7rem', background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontWeight: '700' }}>✕ Reset</button></div>;
                if (hasAutoVal) return <div style={{ fontSize: '0.7rem', color: '#059669', fontWeight: '700', marginTop: '3px' }}>✅ Auto-graded</div>;
                return <div style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: '600', marginTop: '3px' }}>— Not set yet</div>;
              };

              return (
                <div key={gid} style={{ padding: '12px 14px', borderTop: idx > 0 ? '1px solid #e5e7eb' : 'none', display: 'grid', gridTemplateColumns: '1fr 150px 150px 150px', gap: '10px', alignItems: 'start', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>

                  {/* Game info */}
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>
                      <span style={{ fontSize: '0.72rem', color: '#7c3aed', fontWeight: '700', marginRight: '5px' }}>G{gid}</span>
                      {away} @ {home}
                    </div>
                    {actual?.team1 && actual?.team2
                      ? <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1f2937', marginTop: '3px' }}>{away} {actual.team1} — {home} {actual.team2}{auto && <span style={{ fontSize: '0.75rem', color: '#374151', fontWeight: '400' }}> | margin {auto.margin > 0 ? '+' : ''}{auto.margin} | total {auto.total}</span>}</div>
                      : <div style={{ fontSize: '0.78rem', color: '#b45309', fontStyle: 'italic', marginTop: '3px', fontWeight: '600' }}>⚠️ No scores yet — you can pre-set results below</div>
                    }
                    {line && <div style={{ fontSize: '0.75rem', color: '#374151', marginTop: '2px' }}>{fav} −{spread} | O/U {ou}</div>}
                  </div>

                  {/* Winner — always visible */}
                  <div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <ResultBtn active={winnerResult === away} onClick={() => setOverride(activeWeek, gid, 'winner', away)} color="#1d4ed8">{away || 'Away'}</ResultBtn>
                      <ResultBtn active={winnerResult === home} onClick={() => setOverride(activeWeek, gid, 'winner', home)} color="#1d4ed8">{home || 'Home'}</ResultBtn>
                    </div>
                    {statusBadge(hasOverrideWinner, !!auto?.winner, 'winner')}
                  </div>

                  {/* ATS — always visible */}
                  <div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <ResultBtn active={atsResult === 'favourite'} onClick={() => setOverride(activeWeek, gid, 'ats', 'favourite')} color="#7c3aed">{fav} covers</ResultBtn>
                      <ResultBtn active={atsResult === 'underdog'} onClick={() => setOverride(activeWeek, gid, 'ats', 'underdog')} color="#7c3aed">{underdog} covers</ResultBtn>
                    </div>
                    {statusBadge(hasOverrideAts, !!auto?.ats, 'ats')}
                  </div>

                  {/* O/U — always visible */}
                  <div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <ResultBtn active={ouResult === 'over'} onClick={() => setOverride(activeWeek, gid, 'ou', 'over')} color="#0891b2">Over {ou || '?'}</ResultBtn>
                      <ResultBtn active={ouResult === 'under'} onClick={() => setOverride(activeWeek, gid, 'ou', 'under')} color="#0891b2">Under {ou || '?'}</ResultBtn>
                    </div>
                    {statusBadge(hasOverrideOu, !!auto?.ou, 'ou')}
                  </div>
                </div>
              );
            })}
          </div>
          <button onClick={handleSaveGrading} disabled={savingGrading}
            style={{ width: '100%', padding: '14px', background: savingGrading ? '#9ca3af' : 'linear-gradient(135deg, #059669 0%, #047857 100%)', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '1rem', fontWeight: '800', cursor: savingGrading ? 'not-allowed' : 'pointer', boxShadow: '0 4px 12px rgba(5,150,105,0.4)' }}>
            {savingGrading ? '⏳ Saving...' : '💾 Save Grading Overrides'}
          </button>
          <p style={{ textAlign: 'center', color: '#4b5563', fontSize: '0.82rem', marginTop: '8px' }}>Auto-grading is live — only save if you made manual overrides.</p>
        </>
      )}
    </div>
  );
};

// ============================================================
// 🎯 POOL #3/#4 PICKS — Player pick entry (Visible + Blind rows)
// ============================================================
const Pool34Picks = ({
  playerName, playerCode, currentWeek, currentWeekData, playoffTeams, getTeamName,
  bettingLines, predictionsPool3, setPredictionsPool3,
  predictionsAPPTV, predictionsAPPTB, allPicksPool3, allPicksAPPTV, allPicksAPPTB,
  pool3Dirty, setPool3Dirty,
  pool3CancelSnapshot, setPool3CancelSnapshot,
  pool3ManuallyEdited, setPool3ManuallyEdited,
  isWeekLocked, isSubmissionAllowed, database
}) => {
  const weekLines = bettingLines?.[currentWeek] || {};
  const hasLines = Object.keys(weekLines).length > 0;

  // ── Auto-populate from Pool #1/#2 scores ──────────────────
  const autoPopulatePool3 = () => {
    if (!hasLines) { alert('⚠️ No betting lines entered yet for this week. Go to Pool #3 Setup and enter lines first.'); return; }
    const firebaseRecordAPPTB = allPicksAPPTB.find(p => p.playerCode === playerCode && p.week === currentWeek);
    if (!firebaseRecordAPPTB) { alert('⚠️ No Pool #2 (Blind) picks found for this week.\n\nPlease submit your Pool #2 score predictions first, then import.'); return; }
    const sourcePreds = firebaseRecordAPPTB?.predictions || {};
    const newPicks = {};
    currentWeekData.games.forEach(game => {
      const t1 = parseInt(sourcePreds[game.id]?.team1);
      const t2 = parseInt(sourcePreds[game.id]?.team2);
      const line = weekLines[game.id];
      if (!line || isNaN(t1) || isNaN(t2)) return;
      const awayName = getTeamName(currentWeek, game.id, 'team1', playoffTeams);
      const homeName = getTeamName(currentWeek, game.id, 'team2', playoffTeams);
      const winner = t1 > t2 ? awayName : homeName;
      // ATS: favourite margin needed = spread, actual margin = winner margin
      const favMatch = (name, fav) => name === fav || name.includes(fav) || fav.includes(name);
      const favIsAway = favMatch(awayName, line.favourite);
      const margin = favIsAway ? (t1 - t2) : (t2 - t1);
      const ats = margin > parseFloat(line.spread) ? line.favourite
                : (favIsAway ? homeName : awayName);
      const total = t1 + t2;
      const ou = total > parseFloat(line.overUnder) ? 'over' : 'under';
      newPicks[game.id] = { winner, ats, ou };
    });
    setPredictionsPool3(newPicks);
    setPool3Dirty(true);
    setPool3ManuallyEdited(false); // Reset — player chose to sync back to auto
  };



  // ── Submit handlers ────────────────────────────────────────
  const handleSubmitPool3 = async () => {
    if (isWeekLocked(currentWeek)) { alert('🔒 WEEK LOCKED — picks are permanently locked for this round.'); return; }
    if (!isSubmissionAllowed()) { alert('⛔ SUBMISSIONS CLOSED during playoff weekend.'); return; }
    // Validate all games filled
    const missing = currentWeekData.games.filter(g => {
      const p = predictionsPool3[g.id];
      return !p || !p.winner || !p.ats || !p.ou;
    }).map(g => g.id);
    if (missing.length > 0) { alert(`⚠️ Pool #3 INCOMPLETE\n\nPlease complete all three picks for Game(s): ${missing.join(', ')}`); return; }
    const hasExistingP3 = allPicksPool3.some(p => p.playerCode === playerCode && p.week === currentWeek);
    if (!pool3Dirty && hasExistingP3) { alert('ℹ️ No changes made to your Pool #3 picks.'); return; }
    try {
      const existing = allPicksPool3.find(p => p.playerCode === playerCode && p.week === currentWeek);
      const pickData = {
        playerName, playerCode, week: currentWeek, picks: predictionsPool3,
        timestamp: existing ? existing.timestamp : Date.now(),
        lastUpdated: Date.now(),
        autoFilled: false,
        autoCalculated: false,
        manuallyConfirmed: true,
        manuallyConfirmedAt: Date.now()
      };
      if (existing?.firebaseKey) { await set(ref(database, `picks_pool3/${existing.firebaseKey}`), pickData); }
      else { await push(ref(database, 'picks_pool3'), pickData); }
      setPool3Dirty(false);
      setPool3CancelSnapshot(null);
      alert('✅ Pool #3 (Winner, ATS, O/U) picks saved! 🔒 Your picks are blind until Friday deadline.');
    } catch (err) { alert('❌ Error saving Pool #3 picks: ' + err.message); }
  };



  // ── Pick toggle helper ─────────────────────────────────────
  const setPick3 = (gameId, field, value) => {
    if (!pool3CancelSnapshot) {
      setPool3CancelSnapshot(JSON.parse(JSON.stringify(predictionsPool3)));
    }
    setPredictionsPool3(prev => ({ ...prev, [gameId]: { ...(prev[gameId] || {}), [field]: value } }));
    setPool3Dirty(true);
    setPool3ManuallyEdited(true); // Protect from auto-overwrite going forward
  };



  const weekNum = { wildcard: '1', divisional: '2', conference: '3', superbowl: '4' }[currentWeek] || '?';

  // ── Progress counters ──────────────────────────────────────
  const countComplete = (preds) => currentWeekData.games.filter(g => { const p = preds[g.id]; return p?.winner && p?.ats && p?.ou; }).length;

  const PickButton = ({ active, onClick, children, color, compact }) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: compact ? '7px 8px' : '8px 14px',
        fontWeight: '700',
        fontSize: compact ? '0.8rem' : '0.88rem',
        borderRadius: '8px', border: `2px solid ${color}`,
        background: active ? color : '#fff', color: active ? '#fff' : color,
        cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
        flex: compact ? '1' : undefined,
        minWidth: compact ? '0' : '90px'
      }}
    >
      {children}
    </button>
  );

  if (!hasLines) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⏳</div>
        <h2 style={{ color: '#fcfbfd' }}>Betting Lines Not Yet Available</h2>
        <p style={{ color: '#fcfbfd', fontSize: '1rem', lineHeight: '1.6' }}>
          The Pool Manager hasn't entered the betting lines for this week yet.<br />
          Check back once the lines are posted — usually a few days before game day.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '860px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)', color: '#fff', padding: '16px 20px', borderRadius: '12px', marginBottom: '20px' }}>
        <h2 style={{ margin: '0 0 4px 0', fontSize: '1.3rem' }}>🎯 Pool #3 Winner, ATS, O/U — Week {weekNum}</h2>
        <p style={{ margin: 0, opacity: 0.9, fontSize: '0.85rem' }}>Winner = 2 pts &nbsp;|&nbsp; ATS = 3 pts &nbsp;|&nbsp; O/U = 3 pts &nbsp;|&nbsp; Max 8 pts per game</p>
      </div>

      {/* Auto-populate banner */}
      <div style={{ background: '#f0fdf4', border: '2px solid #86efac', borderRadius: '10px', padding: '14px 18px', marginBottom: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: '1', minWidth: '200px', fontSize: '0.9rem', color: '#14532d' }}>
          <strong>⚡ Auto-fill from your Pool #2 (Blind) picks</strong><br />
          <span style={{ fontSize: '0.82rem', opacity: 0.85 }}>Calculates Winner, ATS, and O/U from your blind score predictions. You can edit after importing.</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={autoPopulatePool3} style={{ padding: '8px 16px', background: '#eff6ff', border: '2px solid #1976d2', borderRadius: '8px', fontWeight: '700', fontSize: '0.85rem', color: '#1565c0', cursor: 'pointer' }}>
            ⚡🔵 Import from Pool #2 (Blind)
          </button>
          <button onClick={() => {
            if (!hasLines) return;
            const firebaseRecordAPPTV = allPicksAPPTV.find(p => p.playerCode === playerCode && p.week === currentWeek);
            if (!firebaseRecordAPPTV) { alert('⚠️ No Pool #1 (Visible) picks found for this week.\n\nPlease submit your Pool #1 score predictions first, then import.'); return; }
            const sourcePredsP1 = firebaseRecordAPPTV?.predictions || {};
            const newPicks = {};
            currentWeekData.games.forEach(game => {
              const t1 = parseInt(sourcePredsP1[game.id]?.team1);
              const t2 = parseInt(sourcePredsP1[game.id]?.team2);
              const line = weekLines[game.id];
              if (!line || isNaN(t1) || isNaN(t2)) return;
              const awayName = getTeamName(currentWeek, game.id, 'team1', playoffTeams);
              const homeName = getTeamName(currentWeek, game.id, 'team2', playoffTeams);
              const winner = t1 > t2 ? awayName : homeName;
              const favMatchL = (name, fav) => name === fav || name.includes(fav) || fav.includes(name);
              const favIsAway = favMatchL(awayName, line.favourite);
              const margin = favIsAway ? (t1 - t2) : (t2 - t1);
              const ats = margin > parseFloat(line.spread) ? line.favourite : (favIsAway ? homeName : awayName);
              const total = t1 + t2;
              const ou = total > parseFloat(line.overUnder) ? 'over' : 'under';
              newPicks[game.id] = { winner, ats, ou };
            });
            setPredictionsPool3(newPicks);
            setPool3Dirty(true);
            setPool3ManuallyEdited(false);
          }} style={{ padding: '8px 16px', background: '#fffbea', border: '2px solid #f59e0b', borderRadius: '8px', fontWeight: '700', fontSize: '0.85rem', color: '#92400e', cursor: 'pointer' }}>
            ⚡🟡 Import from Pool #1 (Visible)
          </button>
        </div>
      </div>

      {/* Pool #3 blind notice */}
      <div style={{ margin: '0 0 16px 0', padding: '10px 16px', background: '#e3f2fd', border: '2px solid #1976d2', borderRadius: '8px', fontSize: '0.88rem', color: '#0d47a1', lineHeight: '1.5' }}>
        🔒 <strong>Pool #3 is Blind</strong> — your picks are hidden from other players until Friday 11:59 PM PST.
        Earlier submission locks in your tiebreaker timestamp advantage.
      </div>

      {/* Progress bar — Pool #3 */}
      {(() => {
        const count = countComplete(predictionsPool3);
        return (
          <div style={{ marginBottom: '20px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '5px' }}>
              <span style={{ color: '#7c3aed', fontWeight: '700' }}>🎯 Pool #3 Progress</span>
              <span>{count}/{currentWeekData.games.length} games complete</span>
            </div>
            <div style={{ height: '8px', background: '#e5e7eb', borderRadius: '4px' }}>
              <div style={{ height: '100%', width: `${(count / currentWeekData.games.length) * 100}%`, background: '#7c3aed', borderRadius: '4px', transition: 'width 0.3s' }} />
            </div>
          </div>
        );
      })()}

      {/* ── GAME CARDS ── */}
      {currentWeekData.games.map(game => {
        const awayName = getTeamName(currentWeek, game.id, 'team1', playoffTeams);
        const homeName = getTeamName(currentWeek, game.id, 'team2', playoffTeams);
        const line = weekLines[game.id] || {};
        const spread = parseFloat(line.spread) || 0;
        const ou = parseFloat(line.overUnder) || 0;
        const fav = line.favourite || '';
        const favMatchU = (name, fav) => !!name && !!fav && (name === fav || name.includes(fav) || fav.includes(name));
        const underdog = favMatchU(awayName, fav) ? homeName : awayName;
        const isLocked = isWeekLocked(currentWeek);

        const p3 = predictionsPool3[game.id] || {};
        // ATS active: stored value may be abbreviation or full name — use fuzzy match
        const p3AtsFav = p3.ats && (p3.ats === fav || favMatchU(p3.ats, fav));
        const p3AtsUnderdog = p3.ats && !p3AtsFav && (p3.ats === underdog || favMatchU(p3.ats, underdog));

        return (
          <div key={game.id} style={{ marginBottom: '20px', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb' }}>
            {/* Game title */}
            <div style={{ background: '#1f2937', color: '#fff', padding: '10px 16px', fontWeight: 'bold', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <span>Game {game.id}: {awayName} @ {homeName}</span>
              {line.spread && (
                <span style={{ fontSize: '0.8rem', background: '#374151', padding: '3px 10px', borderRadius: '10px', fontWeight: '600' }}>
                  {fav} −{spread} &nbsp;|&nbsp; O/U {ou}
                </span>
              )}
            </div>

            {/* Column headers */}
            <div style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', padding: '6px 16px', display: 'grid', gridTemplateColumns: '110px 1fr 1fr 1fr', gap: '8px', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280' }}>
              <div>Pool</div>
              <div>🏆 Winner (2 pts)</div>
              <div>📊 ATS (3 pts)<br /><span style={{ fontWeight: '400', textTransform: 'none' }}>{fav} −{spread} or {underdog} +{spread}</span></div>
              <div>📈 O/U (3 pts)<br /><span style={{ fontWeight: '400', textTransform: 'none' }}>Over/Under {ou}</span></div>
            </div>

            {/* 🎯 POOL #3 ROW */}
            <div style={{ background: '#ede9fe', padding: '12px 16px', display: 'grid', gridTemplateColumns: '110px 1fr 1fr 1fr', gap: '8px', alignItems: 'center' }}>
              <div style={{ fontWeight: '700', fontSize: '0.85rem', color: '#5b21b6' }}>🎯 Pool #3<br /><span style={{ fontSize: '0.72rem', fontWeight: '400', color: '#7c3aed' }}>🔒 Blind</span></div>
              {/* Winner */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <PickButton active={p3.winner === awayName} onClick={() => !isLocked && setPick3(game.id, 'winner', awayName)} color="#7c3aed">{awayName}</PickButton>
                <PickButton active={p3.winner === homeName} onClick={() => !isLocked && setPick3(game.id, 'winner', homeName)} color="#7c3aed">{homeName}</PickButton>
              </div>
              {/* ATS */}
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'nowrap' }}>
                <PickButton compact active={p3AtsFav} onClick={() => !isLocked && setPick3(game.id, 'ats', fav)} color="#7c3aed">{fav} −{spread}</PickButton>
                <PickButton compact active={p3AtsUnderdog} onClick={() => !isLocked && setPick3(game.id, 'ats', underdog)} color="#7c3aed">{underdog} +{spread}</PickButton>
              </div>
              {/* O/U */}
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'nowrap' }}>
                <PickButton compact active={p3.ou === 'over'} onClick={() => !isLocked && setPick3(game.id, 'ou', 'over')} color="#7c3aed">Over {ou}</PickButton>
                <PickButton compact active={p3.ou === 'under'} onClick={() => !isLocked && setPick3(game.id, 'ou', 'under')} color="#7c3aed">Under {ou}</PickButton>
              </div>
            </div>


          </div>
        );
      })}

      {/* ── SUBMIT BUTTONS ── */}
      <div style={{ marginTop: '24px' }}>
        <div style={{ padding: '10px 14px', background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: '8px', fontSize: '0.85rem', color: '#0d47a1', marginBottom: '16px', lineHeight: '1.5' }}>
          💡 <strong>Tiebreaker tip:</strong> Submit before Wednesday 11:59 PM PST to lock in an earlier timestamp — the tiebreaker edge if tied for first in Pool #3.
        </div>

        {/* 🎲 RNG Override button — always visible when submissions open and not locked */}
        {!isWeekLocked(currentWeek) && isSubmissionAllowed() && (
          <div style={{ marginBottom: '12px' }}>
            <button
              onClick={() => {
                if (!hasLines) {
                  alert('⚠️ No betting lines entered yet for this week.\n\nBetting lines are required to generate ATS and O/U picks.\n\nAsk the pool manager to enter the lines in Pool #3 Setup first.');
                  return;
                }
                const hasCurrent = Object.keys(predictionsPool3 || {}).length > 0;
                const msg = hasCurrent
                  ? '🎲 Override with Random Picks?\n\nThis will REPLACE your current Pool #3 picks with randomly generated ones.\n\nYou can still adjust any pick before submitting.\n\nClick OK to randomize, Cancel to keep current picks.'
                  : '🎲 Generate Random Pool #3 Picks?\n\nThis will randomly generate Winner, ATS, and O/U picks for each game.\n\nYou can adjust any pick before submitting.\n\nClick OK to generate.';
                if (!window.confirm(msg)) return;

                // Generate RNG picks using betting lines
                const rngPicks = {};
                currentWeekData.games.forEach(game => {
                  const line = weekLines[game.id];
                  if (!line?.favourite || !line?.spread || !line?.overUnder) return;
                  const awayName = getTeamName(currentWeek, game.id, 'team1', playoffTeams);
                  const homeName = getTeamName(currentWeek, game.id, 'team2', playoffTeams);
                  // Random winner
                  const winner = Math.random() < 0.5 ? awayName : homeName;
                  // Random ATS — favourite or underdog
                  const favIsAway = awayName && line.favourite && (awayName === line.favourite || awayName.includes(line.favourite) || line.favourite.includes(awayName));
                  const underdog = favIsAway ? homeName : awayName;
                  const ats = Math.random() < 0.5 ? line.favourite : underdog;
                  // Random O/U
                  const ou = Math.random() < 0.5 ? 'over' : 'under';
                  rngPicks[game.id] = { winner, ats, ou };
                });

                if (Object.keys(rngPicks).length === 0) {
                  alert('⚠️ Could not generate picks — betting lines may be incomplete. Check with the pool manager.');
                  return;
                }

                if (!pool3CancelSnapshot) setPool3CancelSnapshot({ ...predictionsPool3 });
                setPredictionsPool3(rngPicks);
                setPool3Dirty(true);
                setPool3ManuallyEdited(true);
              }}
              style={{
                width: '100%', padding: '14px 20px', lineHeight: '1.4',
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: '#fff', border: 'none', borderRadius: '10px', fontSize: '1rem', fontWeight: '700',
                cursor: 'pointer', boxShadow: '0 4px 12px rgba(245,158,11,0.4)'
              }}
            >
              🎲 Override with Random Pool #3 Picks<br />
              <span style={{ fontSize: '0.75rem', fontWeight: '400', opacity: 0.9 }}>Generates random Winner / ATS / O-U — you can adjust before submitting</span>
            </button>
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1', minWidth: '180px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Save as Blank button — visible when picks are empty */}
            {Object.keys(predictionsPool3 || {}).length === 0 && !isWeekLocked(currentWeek) && isSubmissionAllowed() && (
              <button
                onClick={async () => {
                  if (!window.confirm('💾 Save Pool #3 as blank?\n\nThis saves your Pool #3 as empty for now. The RNG system will auto-generate picks for you on Friday if you still have no picks by then.\n\nYou can come back and fill in picks any time before Friday 11:59 PM PST.\n\nClick OK to save blank, Cancel to keep.')) return;
                  try {
                    const existing = allPicksPool3.find(p => p.playerCode === playerCode && p.week === currentWeek);
                    const blankRecord = {
                      playerName, playerCode, week: currentWeek,
                      picks: {},
                      timestamp: existing?.timestamp || Date.now(),
                      lastUpdated: Date.now(),
                      autoFilled: false,
                      autoCalculated: false,
                      manuallyConfirmed: false,
                      clearedByPlayer: true
                    };
                    if (existing?.firebaseKey) {
                      await set(ref(database, `picks_pool3/${existing.firebaseKey}`), blankRecord);
                    } else {
                      await push(ref(database, 'picks_pool3'), blankRecord);
                    }
                    setPool3Dirty(false);
                    alert('✅ Pool #3 saved as blank.\n\nThe RNG system will auto-generate your Pool #3 picks from your Pool #1 picks on Friday if you have not filled them in by then.');
                  } catch(e) { alert('Error saving blank Pool #3: ' + e.message); }
                }}
                style={{
                  padding: '16px 20px', lineHeight: '1.4',
                  background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  color: '#fff', border: 'none', borderRadius: '10px', fontSize: '1rem', fontWeight: '700',
                  cursor: 'pointer', boxShadow: '0 4px 12px rgba(5,150,105,0.4)', marginBottom: '8px'
                }}
              >
                💾 Save Pool #3 as Blank for Now<br />
                <span style={{ fontSize: '0.75rem', fontWeight: '400', opacity: 0.9 }}>RNG will auto-fill from Pool #1 on Friday if not completed</span>
              </button>
            )}
            <button
              onClick={handleSubmitPool3}
              disabled={!isSubmissionAllowed() || isWeekLocked(currentWeek)}
              style={{
                padding: '16px 20px', lineHeight: '1.4',
                background: (!isSubmissionAllowed() || isWeekLocked(currentWeek)) ? '#ccc' : 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
                color: '#fff', border: 'none', borderRadius: '10px', fontSize: '1rem', fontWeight: '700',
                cursor: (!isSubmissionAllowed() || isWeekLocked(currentWeek)) ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(124,58,237,0.4)'
              }}
            >
              🎯 Submit Pool #3 (Winner, ATS, O/U)<br />
              <span style={{ fontSize: '0.75rem', fontWeight: '400', opacity: 0.9 }}>🔒 Blind — hidden until Friday deadline</span>
            </button>
            {pool3Dirty && pool3CancelSnapshot && (
              <button
                onClick={() => {
                  setPredictionsPool3(pool3CancelSnapshot);
                  setPool3Dirty(false);
                  setPool3CancelSnapshot(null);
                }}
                style={{ padding: '8px 16px', background: '#f5f5f5', color: '#555', border: '1px solid #bbb', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600' }}
              >
                ✖ Cancel — keep original Pool #3 picks
              </button>
            )}
            <button
              onClick={async () => {
                if (!window.confirm('🗑️ Clear ALL Pool #3 picks?\n\nThis will blank out all your Winner / ATS / O-U selections and save as empty.\n\nClick OK to clear, Cancel to keep.')) return;
                setPredictionsPool3({});
                setPool3Dirty(false);
                setPool3CancelSnapshot(null);
                // Save blank record to Firebase so it is properly wiped
                try {
                  const existing = allPicksPool3.find(p => p.playerCode === playerCode && p.week === currentWeek);
                  const blankRecord = {
                    playerName, playerCode, week: currentWeek,
                    picks: {},
                    timestamp: existing?.timestamp || Date.now(),
                    lastUpdated: Date.now(),
                    autoFilled: false,
                    autoCalculated: false,
                    manuallyConfirmed: true,
                    manuallyConfirmedAt: Date.now(),
                    clearedByPlayer: true
                  };
                  if (existing?.firebaseKey) {
                    await set(ref(database, `picks_pool3/${existing.firebaseKey}`), blankRecord);
                  } else {
                    await push(ref(database, 'picks_pool3'), blankRecord);
                  }
                  alert('✅ Pool #3 picks cleared and saved as blank.\n\nIf you have no Pool #1 picks by Friday 11:59 PM PST, the system will auto-generate picks for you.');
                } catch(e) { alert('Error saving blank Pool #3: ' + e.message); }
              }}
              disabled={isWeekLocked(currentWeek)}
              style={{ padding: '8px 16px', background: '#fff0f0', color: '#c0392b', border: '1px solid #e74c3c', borderRadius: '8px', cursor: isWeekLocked(currentWeek) ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: '600' }}
            >
              🗑️ Clear All Pool #3 Picks
            </button>
          </div>

        </div>

        {isSubmissionAllowed() && !isWeekLocked(currentWeek) && (
          <p style={{ textAlign: 'center', marginTop: '12px', color: '#666', fontSize: '0.85rem' }}>
            You can edit and resubmit as many times as you want until Friday 11:59 PM PST
          </p>
        )}
      </div>
    </div>
  );
};

// ============================================================
// 🏆 POOL #3/#4 PRIZE CALCULATIONS
// ============================================================

// Grade a single player's picks for one week — returns { points, winnerPts, atsPts, ouPts, gameBreakdown }
const gradePool34Week = (picks, weekKey, bettingLines, actualScores, gradingOverrides) => {
  if (!picks?.picks) return { points: 0, winnerPts: 0, atsPts: 0, ouPts: 0, gameBreakdown: {} };
  const weekLines = bettingLines?.[weekKey] || {};
  const weekActual = actualScores?.[weekKey] || {};
  const gameCounts = { wildcard: 6, divisional: 4, conference: 2, superbowl: 1 };
  const gameIds = Array.from({ length: gameCounts[weekKey] || 0 }, (_, i) => i + 1);
  let points = 0, winnerPts = 0, atsPts = 0, ouPts = 0;
  const gameBreakdown = {};

  gameIds.forEach(gid => {
    const pick = picks.picks[gid];
    const actual = weekActual[gid];
    const line = weekLines[gid];
    if (!pick || !actual || !line) return;
    const t1 = parseInt(actual.team1), t2 = parseInt(actual.team2);
    if (isNaN(t1) || isNaN(t2)) return;

    // Determine actual results — use override if set, otherwise auto-calculate
    const overrideAts = gradingOverrides?.[weekKey]?.[gid]?.ats;
    const overrideOu = gradingOverrides?.[weekKey]?.[gid]?.ou;
    const spread = parseFloat(line.spread);
    const ou = parseFloat(line.overUnder);
    const fav = line.favourite;
    // We need getTeamName equivalent here — favourite is stored as actual team name string
    const favIsAway = fav === line.awayName; // stored during line entry
    // Determine away/home names from actual pick data (player's winner pick gives us the names used)
    const actualMargin = t1 > t2 ? t1 - t2 : t2 - t1; // absolute margin
    // Recalculate: is the favourite the away or home team?
    // We rely on the line.favourite field being the exact team name
    const actualWinner = t1 > t2 ? '_away' : '_home'; // relative
    const actualTotal = t1 + t2;

    // ATS: favourite covers if their actual margin > spread
    // We need to know if favourite won and by how much
    // Since favourite name is stored in line.favourite, we derive:
    // If actual score has away winning and fav = awayName, check margin
    // We use the stored favourite name and compare to actual winner name from picks
    const autoAts = (() => {
      // Use pick.winner to determine away/home mapping at pick time
      // Actually, simplest: rebuild from actual scores
      // favourite is named team — we don't have exact name here without getTeamName
      // BUT: we stored the ATS pick as the team name too, so we can compare
      // ATS is correct if: actual score shows fav won by > spread
      // We'll approximate: if abs margin > spread, fav covered; else underdog covered
      // We need to know who actually won to check if it's the fav
      // Use the favourite field directly compared against who won
      const atsResult = (() => {
        // If we have the favourite name and can check actual scores:
        // team1 is away, team2 is home — we'd need getTeamName
        // Simpler: we check if the spread was covered by comparing
        // favourite's actual score minus underdog's score > spread
        // Since we stored pick.ats as team name, and we can compare to favourite
        if (t1 > t2) {
          // away won — is away the favourite? Check pick context
          // We'll use overrideAts if available, otherwise derive from margin
          const favWon = true; // placeholder — actual logic below
        }
        // Full logic: compare actual margin to spread
        // If favourite won AND margin > spread → favourite covered
        // If underdog won, or favourite won by ≤ spread → underdog covered
        // Since we stored favourite as team name, we need a mapping
        // We'll use a proxy: store the favourite name in line, compare to actual picks
        return null; // will be resolved in the outer scope
      })();
    })();

    // Cleaner approach using stored pick values
    // pick.winner = team name they picked to win
    // pick.ats = team name they picked to cover
    // pick.ou = 'over' | 'under'
    // line.favourite = team name of favourite
    // actual.team1 / actual.team2 = final scores

    // Determine actual ATS result
    const actualAtsResult = overrideAts || (() => {
      // We need to know which team is which in actual scores
      // Since picks.winner stores the team name, we can use game structure
      // t1 = away score, t2 = home score
      // We don't have team names here without getTeamName, but we CAN use:
      // The player's pick.winner tells us the team names used in the UI
      // So we compare: did the favourite (line.favourite) win by > spread?
      // If t1 > t2 → away won. We compare line.favourite to determine if they are away.
      // The favourite was set to either awayName or homeName in the betting lines UI
      // We detect this by checking if any pick in this week has the fav as winner
      // SIMPLEST: just store alongside betting lines which position (1=away,2=home) is fav
      // For now: use the margin approach — if |margin| > spread, favourite likely covered
      // This works perfectly since half-points eliminate pushes
      // If absolute margin > spread, someone covered — we check who won vs fav
      return null; // resolved below using position-based approach
    })();

    // Position-based ATS: we store favourite as team name during line entry
    // We know game structure: team1 = away, team2 = home
    // We need to match favourite name to position — stored in line.favouritePosition or derive from team names
    // Since we didn't store position, use the pick data to infer:
    // pick.winner is the team name the player predicted to win
    // We know t1/t2, we know who actually won, we know the spread
    // Final clean implementation:

    // Auto-determine ATS result using actual scores and spread
    const deterministicAts = overrideAts || (() => {
      const absMargin = Math.abs(t1 - t2);
      // The spread is always a half-point so absMargin > spread means somebody covered cleanly
      // Favourite covered if: |favourite score - underdog score| > spread AND favourite won
      // We can determine favourite won if: the team with more points matches line.favourite name
      // We use pick.ats values to map back to positions, but actually:
      // The most reliable: check if fav won (higher score belongs to fav position)
      // We stored favourite as team name string — we need position mapping
      // Store it: when Pool Manager picks favourite, also store position (1 or 2)
      // For backward compat without position: absMargin > spread → determine winner name from pick context
      // Since we have no direct position lookup here, use this heuristic:
      // If any player's ats pick for this game equals line.favourite, and actual higher score team wins → check margin
      // DEFINITIVE SOLUTION: store favourite position in betting lines
      // For now, use null and let override handle edge cases
      return null;
    })();

    // Final resolution: use override or fall back to position-independent scoring
    // We'll use a pragmatic approach: compare pick.ats to who actually won with margin check
    // If pick.ats === line.favourite → correct if fav won by > spread (margin > spread since fav won)
    // If pick.ats !== line.favourite → correct if fav did NOT cover (lost or margin ≤ spread)
    // We determine "fav won by > spread" as: the actual margin > spread (since half-points, no push)
    // AND the favourite actually won — but we need to know if fav = t1 or t2
    // STORE POSITION in betting lines going forward: favouritePosition: 1 or 2

    // Since we can't fully resolve without position, mark as needing position field
    // Grading will work once we add favouritePosition to the betting lines form
    gameBreakdown[gid] = { gamePts: 0, winnerCorrect: false, atsCorrect: false, ouCorrect: false };
  });

  return { points, winnerPts, atsPts, ouPts, gameBreakdown };
};

// Full grading engine — use favourite position stored in betting lines
const gradePool34WeekFull = (picks, weekKey, bettingLines, actualScores, gradingOverrides, playoffTeams, getTeamNameFn) => {
  if (!picks?.picks) return { points: 0, winnerPts: 0, atsPts: 0, ouPts: 0, gameBreakdown: {} };
  const weekLines = bettingLines?.[weekKey] || {};
  const weekActual = actualScores?.[weekKey] || {};
  const gameCounts = { wildcard: 6, divisional: 4, conference: 2, superbowl: 1 };
  const gameIds = Array.from({ length: gameCounts[weekKey] || 0 }, (_, i) => i + 1);
  let points = 0, winnerPts = 0, atsPts = 0, ouPts = 0;
  const gameBreakdown = {};

  gameIds.forEach(gid => {
    const pick = picks.picks[gid];
    const actual = weekActual[gid];
    const line = weekLines[gid];
    if (!pick || !actual || !line || !line.favourite || !line.spread || !line.overUnder) return;
    const t1 = parseInt(actual.team1), t2 = parseInt(actual.team2);
    if (isNaN(t1) || isNaN(t2)) return;

    const awayName = getTeamNameFn(weekKey, gid, 'team1', playoffTeams);
    const homeName = getTeamNameFn(weekKey, gid, 'team2', playoffTeams);
    const fav = line.favourite;
    const spread = parseFloat(line.spread);
    const ou = parseFloat(line.overUnder);

    // Actual winner
    const actualWinnerName = t1 > t2 ? awayName : homeName;
    // Favourite margin: positive = fav won by that much, negative = fav lost
    const favMatch2 = (name, fav) => name === fav || name.includes(fav) || fav.includes(name);
    const favIsAway = favMatch2(awayName, fav);
    const favScore = favIsAway ? t1 : t2;
    const dogScore = favIsAway ? t2 : t1;
    const favMargin = favScore - dogScore;

    // ATS result: favourite covered if favMargin > spread (half-points → no push)
    const autoAtsResult = favMargin > spread ? 'favourite' : 'underdog';
    const atsResult = gradingOverrides?.[weekKey]?.[gid]?.ats || autoAtsResult;
    const underdog = favIsAway ? homeName : awayName;

    // O/U result
    const autoOuResult = (t1 + t2) > ou ? 'over' : 'under';
    const ouResult = gradingOverrides?.[weekKey]?.[gid]?.ou || autoOuResult;

    // Score each pick
    const winnerCorrect = pick.winner === actualWinnerName;
    const atsCorrect = pick.ats === fav ? atsResult === 'favourite' : atsResult === 'underdog';
    const ouCorrect = pick.ou === ouResult;

    const wPts = winnerCorrect ? 2 : 0;
    const aPts = atsCorrect ? 3 : 0;
    const oPts = ouCorrect ? 3 : 0;
    const gamePts = wPts + aPts + oPts;

    points += gamePts; winnerPts += wPts; atsPts += aPts; ouPts += oPts;
    gameBreakdown[gid] = { gamePts, winnerCorrect, atsCorrect, ouCorrect, wPts, aPts, oPts };
  });

  return { points, winnerPts, atsPts, ouPts, gameBreakdown };
};

// Calculate weekly and overall prize winners for Pool #3 or #4
const calculatePool34Prizes = (allPicks, weekKey, bettingLines, actualScores, gradingOverrides, playoffTeams, getTeamNameFn, lockDates, isPool4) => {
  if (!allPicks?.length) return null;
  const weekPicks = allPicks.filter(p => p.week === weekKey);
  if (!weekPicks.length) return null;

  // Grade all players
  const graded = weekPicks.map(pick => ({
    ...pick,
    ...gradePool34WeekFull(pick, weekKey, bettingLines, actualScores, gradingOverrides, playoffTeams, getTeamNameFn)
  }));

  // Wednesday tiebreaker for Pool #4 only
  const wednesdayDeadlineTs = (() => {
    if (!isPool4 || !lockDates?.[weekKey]) return null;
    const [y, m, d] = lockDates[weekKey].split('-').map(Number);
    const gameDay = new Date(y, m - 1, d);
    const daysBack = gameDay.getDay() === 6 ? 4 : gameDay.getDay() === 0 ? 4 : 3;
    const wed = new Date(gameDay);
    wed.setDate(gameDay.getDate() - daysBack);
    wed.setHours(23, 59, 59, 999);
    return wed.getTime();
  })();

  const tiebreak = (a, b) => {
    if (isPool4 && wednesdayDeadlineTs) {
      const aWed = (a.lastUpdated || a.timestamp) <= wednesdayDeadlineTs;
      const bWed = (b.lastUpdated || b.timestamp) <= wednesdayDeadlineTs;
      if (aWed && !bWed) return -1;
      if (!aWed && bWed) return 1;
    }
    const aTs = a.lastUpdated || a.timestamp || Infinity;
    const bTs = b.lastUpdated || b.timestamp || Infinity;
    return aTs - bTs;
  };

  const sorted = [...graded].sort((a, b) => b.points - a.points || tiebreak(a, b));
  if (!sorted.length) return null;
  const topPts = sorted[0].points;
  // No winner until at least one player has scored points
  if (topPts <= 0) return { pending: true, message: 'Results not yet available — waiting for games to be played and graded' };
  // Deduplicate tied players by playerCode
  const seenCodes = new Set();
  const uniqueSorted = sorted.filter(p => { if (seenCodes.has(p.playerCode)) return false; seenCodes.add(p.playerCode); return true; });
  const tied = uniqueSorted.filter(p => p.points === topPts);
  return tied.length === 1 ? { winner: tied[0], tied: [] } : { winner: tied[0], tied };
};

// Overall (cumulative) prize — rank by total points across all weeks
const calculatePool34Overall = (allPicks, bettingLines, actualScores, gradingOverrides, playoffTeams, getTeamNameFn, lockDates, isPool4, rank) => {
  if (!allPicks?.length) return null;
  const weeks = ['wildcard', 'divisional', 'conference', 'superbowl'];
  const players = {};

  // Aggregate points across all weeks
  allPicks.forEach(pick => {
    const key = pick.playerCode;
    if (!players[key]) players[key] = { playerName: pick.playerName, playerCode: pick.playerCode, totalPoints: 0, lastUpdated: 0, timestamp: 0, weekPoints: {} };
    const graded = gradePool34WeekFull(pick, pick.week, bettingLines, actualScores, gradingOverrides, playoffTeams, getTeamNameFn);
    players[key].totalPoints += graded.points;
    players[key].weekPoints[pick.week] = graded.points;
    const ts = pick.lastUpdated || pick.timestamp || 0;
    if (ts > players[key].lastUpdated) players[key].lastUpdated = ts;
    if (!players[key].timestamp || (pick.timestamp && pick.timestamp < players[key].timestamp)) players[key].timestamp = pick.timestamp;
  });

  const wednesdayDeadlineTs = (() => {
    if (!isPool4 || !lockDates?.wildcard) return null;
    const [y, m, d] = lockDates.wildcard.split('-').map(Number);
    const gameDay = new Date(y, m - 1, d);
    const daysBack = 4;
    const wed = new Date(gameDay); wed.setDate(gameDay.getDate() - daysBack); wed.setHours(23, 59, 59, 999);
    return wed.getTime();
  })();

  const tiebreak = (a, b) => {
    if (isPool4 && wednesdayDeadlineTs) {
      const aWed = (a.lastUpdated || a.timestamp) <= wednesdayDeadlineTs;
      const bWed = (b.lastUpdated || b.timestamp) <= wednesdayDeadlineTs;
      if (aWed && !bWed) return -1; if (!aWed && bWed) return 1;
    }
    return (a.lastUpdated || a.timestamp || Infinity) - (b.lastUpdated || b.timestamp || Infinity);
  };

  const sorted = Object.values(players).sort((a, b) => b.totalPoints - a.totalPoints || tiebreak(a, b));
  if (sorted.length < rank) return null;
  // No winner until at least one player has scored points
  if (sorted[0].totalPoints <= 0) return { pending: true, message: 'Results not yet available — waiting for games to be played and graded' };
  // Exclude rank-1 winner from rank-2 calculation
  if (rank === 2) {
    const first = sorted[0];
    const remaining = sorted.filter(p => p.playerCode !== first.playerCode);
    if (!remaining.length) return null;
    const topPts = remaining[0].totalPoints;
    if (topPts <= 0) return { pending: true, message: 'Results not yet available' };
    const tied = remaining.filter(p => p.totalPoints === topPts);
    return tied.length === 1 ? { winner: tied[0], tied: [] } : { winner: tied[0], tied };
  }
  const topPts = sorted[0].totalPoints;
  const tied = sorted.filter(p => p.totalPoints === topPts);
  return tied.length === 1 ? { winner: tied[0], tied: [] } : { winner: tied[0], tied };
};

// ============================================================
// 🏆 POOL #3/#4 PRIZES DISPLAY
// ============================================================
const Pool34Prizes = ({ allPicksPool3, bettingLines, actualScores, gradingOverrides, playoffTeams, getTeamName, lockDates, prizePool, psOverrides = [] }) => {
  const weeks = ['wildcard', 'divisional', 'conference', 'superbowl'];
  const weekLabels = { wildcard: 'Week 1 — Wild Card', divisional: 'Week 2 — Divisional', conference: 'Week 3 — Conference', superbowl: 'Week 4 — Super Bowl' };

  // Derive prize value per prize from prizePool — 25 equal prizes
  const hasPrizePool = prizePool?.totalFees > 0;
  const prizeWithPS = prizePool?.prizePerPrizeWithPS || prizePool?.pool34PrizeWithPS || (prizePool?.totalFees ? Math.floor(prizePool.totalFees * 0.90 / 25 * 100) / 100 : 0);
  const prizeNoPS   = prizePool?.prizePerPrizeNoPS  || prizePool?.pool34PrizeNoPS  || (prizePool?.totalFees ? Math.floor(prizePool.totalFees / 25 * 100) / 100 : 0);
  // Show higher prize until a perfect score is actually hit
  const psHitExists = psOverrides && psOverrides.length > 0;
  const currentPrize = psHitExists ? prizeWithPS : prizeNoPS;

  const WinnerCard = ({ label, result, poolColor, poolLabel, prizeAmt }) => {
    if (!result || result.pending) return (
      <div style={{ padding: '14px 16px', background: '#f9fafb', border: '2px dashed #e5e7eb', borderRadius: '8px', marginBottom: '10px' }}>
        <div style={{ fontWeight: '700', color: '#1f2937', fontSize: '0.88rem' }}>{poolLabel}</div>
        <div style={{ fontWeight: '600', color: '#374151', fontSize: '0.82rem', marginTop: '2px' }}>{label}</div>
        {prizeAmt > 0 && <div style={{ fontSize: '0.8rem', color: poolColor, fontWeight: '700', marginTop: '4px' }}>${prizeAmt.toFixed(2)} prize</div>}
        <div style={{ fontSize: '0.78rem', color: '#4b5563', marginTop: '4px', fontStyle: 'italic' }}>
          ⏳ {result?.message || 'Results not yet available — waiting for games to be played and graded'}
        </div>
      </div>
    );
    const { winner, tied } = result;
    return (
      <div style={{ padding: '14px 16px', background: '#fff', border: `2px solid ${poolColor}`, borderRadius: '8px', marginBottom: '10px' }}>
        <div style={{ fontWeight: '700', color: poolColor, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{poolLabel}</div>
        <div style={{ fontWeight: '600', color: '#374151', fontSize: '0.82rem', marginTop: '1px', marginBottom: '6px' }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ fontWeight: '800', fontSize: '1rem', color: '#1f2937' }}>🏆 {winner.playerName}</div>
          <div style={{ background: poolColor, color: '#fff', padding: '2px 8px', borderRadius: '8px', fontWeight: '700', fontSize: '0.82rem' }}>
            {winner.totalPoints !== undefined ? `${winner.totalPoints} pts` : `${winner.points} pts`}
          </div>
          {prizeAmt > 0 && <div style={{ color: poolColor, fontWeight: '700', fontSize: '0.82rem' }}>${prizeAmt.toFixed(2)}</div>}
        </div>
        {tied?.length > 1 && (
          <div style={{ fontSize: '0.76rem', color: '#6b7280', marginTop: '4px' }}>
            🤝 Tied: {tied.filter(p => p.playerCode !== winner.playerCode).map(p => p.playerName).join(', ')} — split ${prizeAmt > 0 ? prizeAmt.toFixed(2) : 'prize'} equally
          </div>
        )}
      </div>
    );
  };

  const weeklyPrizes3 = weeks.map(wk => calculatePool34Prizes(allPicksPool3, wk, bettingLines, actualScores, gradingOverrides, playoffTeams, getTeamName, lockDates, false));

  const overall3 = calculatePool34Overall(allPicksPool3, bettingLines, actualScores, gradingOverrides, playoffTeams, getTeamName, lockDates, false, 1);


  return (
    <div style={{ padding: '20px', maxWidth: '860px', margin: '0 auto' }}>
      <div style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)', color: '#fff', padding: '16px 20px', borderRadius: '12px', marginBottom: '20px' }}>
        <h2 style={{ margin: '0 0 4px 0', fontSize: '1.3rem' }}>🏆 Pool #3 Winner, ATS, O/U Prize Winners</h2>
        <p style={{ margin: '0 0 8px 0', opacity: 0.9, fontSize: '0.82rem' }}>5 prizes per pool · Winner 2pts · ATS 3pts · O/U 3pts · Max 8pts/game</p>
        {hasPrizePool && (
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '0.82rem', background: 'rgba(255,255,255,0.15)', padding: '8px 12px', borderRadius: '8px' }}>
            <span>💰 Per prize if perfect score paid: <strong>${prizeWithPS.toFixed(2)}</strong></span>
            <span>💰 Per prize if no perfect score: <strong>${prizeNoPS.toFixed(2)}</strong></span>
          </div>
        )}
      </div>

      {/* Weekly prizes */}
      <h3 style={{ color: '#ffffff', borderBottom: '2px solid #f9fbfd', paddingBottom: '8px', marginBottom: '16px', fontSize: '1.25rem' }}>📅 Weekly Prizes (Prizes #21–25 for this Pool #3)</h3>
      {weeks.map((wk, i) => (
        <div key={wk} style={{ marginBottom: '18px' }}>
          <div style={{ fontWeight: '800', fontSize: '1.25rem', color: '#ffffff', marginBottom: '8px' }}>
            Prize #{i + 21} — {weekLabels[wk]}
          </div>
          <WinnerCard label={`Most points — ${weekLabels[wk]}`} result={weeklyPrizes3[i]} poolColor="#7c3aed" poolLabel="🎯 Pool #3 Winner, ATS, O/U" prizeAmt={currentPrize} />
        </div>
      ))}

      {/* Overall prize */}
      <h3 style={{ color: '#ffffff', borderBottom: '2px solid #041220', paddingBottom: '8px', marginBottom: '16px', marginTop: '28px', fontSize: '1.25rem' }}>🏆 Season Overall Prize (Prize #25)</h3>
      <WinnerCard label="Most cumulative points — all 4 weeks" result={overall3} poolColor="#7c3aed" poolLabel="🎯 Pool #3 Winner, ATS, O/U" prizeAmt={currentPrize} />

      {hasPrizePool && (
        <div style={{ marginTop: '20px', padding: '12px 16px', background: '#f5f3ff', border: '2px solid #7c3aed', borderRadius: '8px', fontSize: '0.82rem', color: '#3b0764' }}>
          <strong>💡 Prize note:</strong> Values shown use the "perfect score paid out" amount (${prizeWithPS.toFixed(2)} each).
          If no perfect score occurs this season, each prize increases to <strong>${prizeNoPS.toFixed(2)}</strong>.
        </div>
      )}
    </div>
  );
};

// ============================================================
// 🗓️ NEW SEASON SETUP COMPONENT
// ============================================================
function NewSeasonSetup({ database, POOL_MANAGER_CODES }) {
  const [confirmText, setConfirmText] = useState('');
  const [wiping, setWiping] = useState(false);
  const [wipeLog, setWipeLog] = useState([]);
  const [wipeComplete, setWipeComplete] = useState(false);

  // Always-wiped nodes (checked, not optional)
  const NODES_ALWAYS = [
    { key: 'players',              label: 'Players (all registrations & access codes)' },
    { key: 'picks_apptv',          label: 'Pool #1 picks (picks_apptv)' },
    { key: 'picks_apptb',          label: 'Pool #2 picks (picks_apptb)' },
    { key: 'picks_pool3',          label: 'Pool #3 picks (picks_pool3)' },
    { key: 'actualScores',         label: 'Actual scores' },
    { key: 'betting_lines',        label: 'Betting lines' },
    { key: 'calculatedWinners',    label: 'Calculated winners' },
    { key: 'officialWinners',      label: 'Official winners (published)' },
    { key: 'publishedWinners',     label: 'Published winner flags' },
    { key: 'psOverrides',          label: 'Perfect score overrides' },
    { key: 'prizeOverrides',       label: 'Prize overrides' },
    { key: 'weekCompletionStatus', label: 'Week completion status' },
    { key: 'weekLockStatus',       label: 'Week lock status' },
    { key: 'gameStatus',           label: 'Game status' },
    { key: 'gameLocks',            label: 'Game lock overrides' },
    { key: 'grading_overrides',    label: 'Grading overrides' },
    { key: 'manualWeekTotals',     label: 'Manual week totals' },
    { key: 'pool2_revealed',       label: 'Pool #2 revealed flag' },
    // pool34_enabled intentionally excluded — it's a permanent setting, not seasonal data
    { key: 'playoffTeams',         label: 'Playoff teams' },
    { key: 'teamCodes',            label: 'Team codes' },
  ];

  // Optional nodes — unchecked by default (pool manager may have already set these up for new season)
  const NODES_OPTIONAL = [
    { key: 'playoffDates', label: 'Playoff dates & lock schedule', hint: 'Uncheck if you have already entered dates for the new season' },
    { key: 'prizePool',    label: 'Prize pool settings',           hint: 'Uncheck if you have already configured the prize pool for the new season' },
  ];

  const [optionalChecked, setOptionalChecked] = useState(
    Object.fromEntries(NODES_OPTIONAL.map(n => [n.key, false]))
  );

  const toggleOptional = (key) => setOptionalChecked(prev => ({ ...prev, [key]: !prev[key] }));

  const handleWipe = async () => {
    if (confirmText !== 'NEW SEASON') {
      alert('❌ You must type NEW SEASON exactly to confirm.');
      return;
    }

    const optionalToWipe = NODES_OPTIONAL.filter(n => optionalChecked[n.key]);
    const totalNodes = NODES_ALWAYS.length + optionalToWipe.length;
    const optionalWarning = optionalToWipe.length > 0
      ? `\n\nOptional items that WILL also be wiped:\n${optionalToWipe.map(n => `• ${n.label}`).join('\n')}`
      : '\n\nPlayoff dates and prize pool settings will be KEPT (unchecked).';

    if (!window.confirm(
      '🚨 FINAL WARNING — THIS CANNOT BE UNDONE\n\n' +
      `You are about to permanently delete ${totalNodes} data nodes including ALL player registrations, picks, scores, betting lines, winners, and prize data.\n\n` +
      'Players will need to re-register for the new season using their existing codes.' +
      optionalWarning +
      '\n\nClick OK to proceed with the wipe.'
    )) return;

    setWiping(true);
    setWipeLog([]);
    setWipeComplete(false);
    const log = [];

    const allToWipe = [...NODES_ALWAYS, ...optionalToWipe];
    for (const node of allToWipe) {
      try {
        await set(ref(database, node.key), null);
        log.push({ label: node.label, ok: true });
        setWipeLog([...log]);
      } catch (e) {
        log.push({ label: node.label, ok: false, error: e.message });
        setWipeLog([...log]);
      }
    }

    setWiping(false);
    setWipeComplete(true);
    setConfirmText('');
  };

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', padding: '24px 16px' }}>
      <h2 style={{ color: '#dc2626', marginBottom: '6px' }}>🗓️ New Season Setup</h2>
      <p style={{ color: '#374151', marginBottom: '24px', fontSize: '0.95rem' }}>
        Use this screen at the start of each new season to wipe all player data and start fresh.
        Players keep their access codes and simply re-register for the new season.
      </p>

      {/* Always-wiped nodes */}
      <div style={{ background: '#fef2f2', border: '2px solid #fca5a5', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
        <div style={{ fontWeight: '800', color: '#dc2626', marginBottom: '12px', fontSize: '1rem' }}>
          🗑️ The following data will always be permanently deleted:
        </div>
        {NODES_ALWAYS.map(n => (
          <div key={n.key} style={{ fontSize: '0.88rem', color: '#374151', padding: '3px 0', borderBottom: '1px solid #fee2e2' }}>
            ❌ {n.label}
          </div>
        ))}
      </div>

      {/* Optional nodes with checkboxes */}
      <div style={{ background: '#fffbeb', border: '2px solid #fcd34d', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
        <div style={{ fontWeight: '800', color: '#92400e', marginBottom: '4px', fontSize: '1rem' }}>
          ⚙️ Optional — check to also wipe these:
        </div>
        <div style={{ fontSize: '0.82rem', color: '#78350f', marginBottom: '12px' }}>
          These are unchecked by default in case you have already set them up for the new season.
        </div>
        {NODES_OPTIONAL.map(n => (
          <div key={n.key} style={{ padding: '8px 0', borderBottom: '1px solid #fde68a' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={optionalChecked[n.key]}
                onChange={() => toggleOptional(n.key)}
                style={{ marginTop: '2px', width: '16px', height: '16px', cursor: 'pointer', accentColor: '#dc2626' }}
              />
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: '700', color: '#374151' }}>
                  {optionalChecked[n.key] ? '❌' : '✅'} {n.label}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#78350f', marginTop: '2px' }}>{n.hint}</div>
              </div>
            </label>
          </div>
        ))}
      </div>

      {/* Confirmation input */}
      {!wipeComplete && (
        <div style={{ background: '#fff', border: '2px solid #dc2626', borderRadius: '12px', padding: '20px' }}>
          <div style={{ fontWeight: '700', color: '#dc2626', marginBottom: '10px', fontSize: '0.95rem' }}>
            ⚠️ Type NEW SEASON below to confirm the wipe:
          </div>
          <input
            type="text"
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            placeholder="Type: NEW SEASON"
            style={{ width: '100%', padding: '12px', fontSize: '1.1rem', border: '2px solid #d1d5db', borderRadius: '8px', boxSizing: 'border-box', marginBottom: '14px', fontWeight: '700', letterSpacing: '2px' }}
          />
          <button
            onClick={handleWipe}
            disabled={wiping || confirmText !== 'NEW SEASON'}
            style={{
              width: '100%', padding: '14px', fontSize: '1rem', fontWeight: '800',
              background: confirmText === 'NEW SEASON' ? '#dc2626' : '#e5e7eb',
              color: confirmText === 'NEW SEASON' ? 'white' : '#9ca3af',
              border: 'none', borderRadius: '8px', cursor: confirmText === 'NEW SEASON' ? 'pointer' : 'not-allowed'
            }}
          >
            {wiping ? '⏳ Wiping data...' : '🗑️ Wipe All Data — Start New Season'}
          </button>
        </div>
      )}

      {/* Wipe progress log */}
      {wipeLog.length > 0 && (
        <div style={{ marginTop: '20px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontWeight: '700', marginBottom: '10px', color: '#374151' }}>Wipe Progress:</div>
          {wipeLog.map((entry, i) => (
            <div key={i} style={{ fontSize: '0.88rem', padding: '4px 0', color: entry.ok ? '#166534' : '#dc2626' }}>
              {entry.ok ? '✅' : '❌'} {entry.label} {entry.error ? `— Error: ${entry.error}` : ''}
            </div>
          ))}
        </div>
      )}

      {/* Success message */}
      {wipeComplete && (
        <div style={{ marginTop: '20px', background: '#f0fdf4', border: '2px solid #86efac', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>✅</div>
          <div style={{ fontWeight: '800', color: '#166534', fontSize: '1.1rem', marginBottom: '6px' }}>
            New Season Wipe Complete!
          </div>
          <div style={{ color: '#374151', fontSize: '0.9rem' }}>
            All selected data has been cleared. You are ready to start a new season.
          </div>
          <div style={{ marginTop: '12px', fontSize: '0.85rem', color: '#374151' }}>
            Next steps: Players re-register using their existing codes → mark as Paid → set Visible. Set up playoff dates and prize pool if not already done.
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  // Navigation state for switching between views
  const [currentView, setCurrentView] = useState('picks'); // 'picks' or 'standings'
  const [playerName, setPlayerName] = useState('');
  const [playerCode, setPlayerCode] = useState('');
  const [codeValidated, setCodeValidated] = useState(false);
  const [currentWeek, setCurrentWeek] = useState('wildcard');
  const [predictions, setPredictions] = useState({}); // Keep for backward compatibility
  // NEW - Separate predictions for dual tables
  const [predictionsAPPTV, setPredictionsAPPTV] = useState({});
  const [predictionsAPPTB, setPredictionsAPPTB] = useState({});
  const [allPicks, setAllPicks] = useState([]);
  // NEW - Dual table states for 2026/2027
  const [allPicksAPPTV, setAllPicksAPPTV] = useState([]);
  const [allPicksAPPTB, setAllPicksAPPTB] = useState([]);
  const [currentTableView, setCurrentTableView] = useState('apptv'); // 'apptv' or 'apptb' — used for all-players table filter only
  const [allPlayersFilter, setAllPlayersFilter] = useState('all'); // 'all', 'apptv', 'apptb' — filters the All Players Picks Table only

  // ============================================
  // 🎯 POOL #3/#4 STATE (Spread/O/U Pools)
  // ============================================
  const [pool34Enabled, setPool34Enabled] = useState(false);          // Master kill switch
  const [bettingLines, setBettingLines] = useState({});               // { wildcard: { 1: { favourite: 'HOU', spread: 3.5, overUnder: 43.5 }, ... } }
  const [allPicksPool3, setAllPicksPool3] = useState([]);             // Pool #3 (Winner, ATS, O/U — Blind) picks
  const [predictionsPool3, setPredictionsPool3] = useState({});       // Current player's Pool #3 picks { gameId: { winner, ats, ou } }
  const [pool3Dirty, setPool3Dirty] = useState(false);                // Pool #3 unsaved changes
  const [pool3ManuallyEdited, setPool3ManuallyEdited] = useState(false); // Player actively changed Pool #3 picks — protect from auto-overwrite
  const [pool3CancelSnapshot, setPool3CancelSnapshot] = useState(null);  // for Cancel on Pool #3
  const [gradingOverrides, setGradingOverrides] = useState({});       // Pool Manager manual ATS/O/U overrides
  // Pool Manager betting lines entry form state
  const [bettingLinesForm, setBettingLinesForm] = useState({});       // Local edits before saving
  const [showDraftRestoreModal, setShowDraftRestoreModal] = useState(false);
  const [draftData, setDraftData] = useState({ apptv: null, apptb: null });
  const [draftModalShown, setDraftModalShown] = useState(false); // Prevent showing multiple times
  const [submitted, setSubmitted] = useState(false);
  const [showScoreAnalysis, setShowScoreAnalysis] = useState(false);
  const [showTableJumpWarning, setShowTableJumpWarning] = useState(null); // { targetTable, existingTimestamp, isBlind }
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
  const [psOverrides, setPsOverrides] = useState([]); // Perfect score manual overrides
  // Playoff Teams Configuration
  const [playoffTeams, setPlayoffTeams] = useState({});
  const [playoffDates, setPlayoffDates] = useState(null);
  const [showWinnersPage, setShowWinnersPage] = useState(false);

  // Dynamically generate playoff weeks with games from configuration for ALL weeks
  const dynamicPlayoffWeeks = useMemo(() => {
    const weeks = { ...PLAYOFF_WEEKS };
    
    // Override Week 1 games with dynamically generated ones
    weeks.wildcard = {
      ...weeks.wildcard,
      games: generateWeek1Games(playoffTeams)
    };
    
    // Override Week 2 games
    weeks.divisional = {
      ...weeks.divisional,
      games: generateWeek2Games(playoffTeams)
    };
    
    // Override Week 3 games
    weeks.conference = {
      ...weeks.conference,
      games: generateWeek3Games(playoffTeams)
    };
    
    // Override Week 4 game
    weeks.superbowl = {
      ...weeks.superbowl,
      games: generateWeek4Games(playoffTeams)
    };
    
    return weeks;
  }, [playoffTeams]);

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
    wildcard: { locked: false, lockDate: null, autoLockDate: AUTO_LOCK_DATES_FALLBACK.wildcard },
    divisional: { locked: false, lockDate: null, autoLockDate: AUTO_LOCK_DATES_FALLBACK.divisional },
    conference: { locked: false, lockDate: null, autoLockDate: AUTO_LOCK_DATES_FALLBACK.conference },
    superbowl: { locked: false, lockDate: null, autoLockDate: AUTO_LOCK_DATES_FALLBACK.superbowl }
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
  const [showPool34Prompt, setShowPool34Prompt] = useState(false); // Post-submit Pool #3 dialog
  const [wipedWeeks, setWipedWeeks] = useState(new Set()); // Weeks where player intentionally wiped all picks
  const [pool3TableFilter, setPool3TableFilter] = useState('all'); // Filter for Pool #3 all-players table
  const [pool3SortCol, setPool3SortCol] = useState('timestamp'); // Pool #3 table sort column
  const [pool3SortDir, setPool3SortDir] = useState('desc'); // Pool #3 table sort direction
  const [pendingWeekChange, setPendingWeekChange] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false); // For refresh button feedback
  const [missingGames, setMissingGames] = useState([]);
  const [invalidScores, setInvalidScores] = useState([]);
  const [initialValidationData, setInitialValidationData] = useState(null); // For initial picks validation
  
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
  const [rngUseDeadlineTimestamp, setRngUseDeadlineTimestamp] = useState(false);
  const [showRngPreview, setShowRngPreview] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null); // 'week' or 'all'
  const [showClearWeekConfirm, setShowClearWeekConfirm] = useState(null); // weekKey to clear
  // 👑 NEW - Table target + per-table scores and timestamps
  const [overrideTableTarget, setOverrideTableTarget] = useState(''); // 'apptv' | 'apptb' | 'both'
  const [predictionsOverrideAPPTV, setPredictionsOverrideAPPTV] = useState({});
  const [predictionsOverrideAPPTB, setPredictionsOverrideAPPTB] = useState({});
  const [overrideTimestampAPPTV, setOverrideTimestampAPPTV] = useState('');
  const [overrideTimestampAPPTB, setOverrideTimestampAPPTB] = useState('');
  const [overrideTimestampMsAPPTV, setOverrideTimestampMsAPPTV] = useState('000');
  const [overrideTimestampMsAPPTB, setOverrideTimestampMsAPPTB] = useState('000');
  
  // 🎯 PERFECT SCORE FORM STATE (for Prize Pool Setup modal)
  const [perfectScoreBonusEnabled, setPerfectScoreBonusEnabled] = useState(false);
  const [perfectScorePrizeType, setPerfectScorePrizeType] = useState('dollar');
  const [perfectScorePrizeAmount, setPerfectScorePrizeAmount] = useState('');
  const [perfectScoreCutoff, setPerfectScoreCutoff] = useState('');
  // 💰 PRIZE POOL FORM STATE — controlled inputs so values always reflect saved data
  const [ppTotalFees, setPpTotalFees] = useState('');
  const [ppNumPlayers, setPpNumPlayers] = useState('');
  const [ppEntryFee, setPpEntryFee] = useState('');
  
  // 🎲 RNG ALERT STATE (ADD THESE 2 LINES) ⬇️
  const [showRNGAlert, setShowRNGAlert] = useState(true);
  const [rngAlertDismissed, setRngAlertDismissed] = useState(false);
  // 🔵🟡 DUAL-ROW PICK ENTRY STATE
  const [blindEditWarningShown, setBlindEditWarningShown] = useState(false); // once per session
  const [blindPicksDirty, setBlindPicksDirty] = useState(false);   // BLIND fields edited since last save
  const [visiblePicksDirty, setVisiblePicksDirty] = useState(false); // VISIBLE fields edited since last save
  const [blindPicksSavedOnce, setBlindPicksSavedOnce] = useState(false); // BLIND submitted at least once
  const [blindCancelSnapshot, setBlindCancelSnapshot] = useState(null); // snapshot for Cancel on BLIND
  const [visibleCancelSnapshot, setVisibleCancelSnapshot] = useState(null); // snapshot for Cancel on VISIBLE
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
        const weekGames = dynamicPlayoffWeeks[currentWeek].games;
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
      const playerNameVal = PLAYER_CODES[playerCode] || playerCode;

      // Generate independent predictions for each table (no ties, different scores)
      const generateIndependentPreds = () => {
        const weekGames = dynamicPlayoffWeeks[week]?.games || [];
        const preds = {};
        weekGames.forEach(game => { preds[game.id] = generateRNGScore(); });
        return preds;
      };

      // Use already-loaded state to find existing keys — avoids broken get() calls
      const existingAPPTV = allPicksAPPTV.find(p => p.playerCode === playerCode && p.week === week);
      const existingAPPTB = allPicksAPPTB.find(p => p.playerCode === playerCode && p.week === week);

      const buildPickData = (preds) => ({
        playerCode,
        playerName: playerNameVal,
        week,
        predictions: preds,
        timestamp: existingAPPTV?.timestamp || existingAPPTB?.timestamp || Date.now(),
        lastUpdated: Date.now(),
        enteredBy,
        enteredByCode: playerCode,
        enteredByName: playerNameVal
      });

      // Save to APPTV — delete existing first, then push new
      if (existingAPPTV?.firebaseKey) {
        await remove(ref(database, `picks_apptv/${existingAPPTV.firebaseKey}`));
      }
      await push(ref(database, 'picks_apptv'), buildPickData(predictions));

      // Save to APPTB — independent scores
      if (existingAPPTB?.firebaseKey) {
        await remove(ref(database, `picks_apptb/${existingAPPTB.firebaseKey}`));
      }
      await push(ref(database, 'picks_apptb'), buildPickData(generateIndependentPreds()));

      // Auto-derive Pool #3 from Pool #1 RNG picks + betting lines
      try {
        const weekGames = dynamicPlayoffWeeks[week]?.games || [];
        const weekLines = bettingLines?.[week] || {};
        const pool3Picks = {};
        weekGames.forEach(game => {
          const pred = predictions[game.id];
          const line = weekLines[game.id] || weekLines[String(game.id)];
          if (!pred || !line?.favourite || !line?.spread || !line?.overUnder) return;
          const t1 = parseInt(pred.team1), t2 = parseInt(pred.team2);
          if (isNaN(t1) || isNaN(t2)) return;
          const awayName = getTeamName(week, game.id, 'team1', playoffTeams);
          const homeName = getTeamName(week, game.id, 'team2', playoffTeams);
          const winner = t1 > t2 ? awayName : homeName;
          const favMatch = (name, fav) => name && fav && (name === fav || name.includes(fav) || fav.includes(name));
          const favIsAway = favMatch(awayName, line.favourite);
          const favMargin = favIsAway ? (t1 - t2) : (t2 - t1);
          const underdog = favIsAway ? homeName : awayName;
          const ats = favMargin > parseFloat(line.spread) ? line.favourite : underdog;
          const ou = (t1 + t2) > parseFloat(line.overUnder) ? 'over' : 'under';
          pool3Picks[game.id] = { winner, ats, ou };
        });
        if (Object.keys(pool3Picks).length > 0) {
          const existingPool3 = allPicksPool3.find(p => p.playerCode === playerCode && p.week === week);
          // Only auto-set Pool #3 if not manually confirmed
          if (!existingPool3?.manuallyConfirmed) {
            const p3Timestamp = Date.now();
            const p3Record = {
              playerCode, playerName: playerNameVal, week,
              picks: pool3Picks,
              timestamp: p3Timestamp,
              lastUpdated: p3Timestamp,
              autoFilled: true,
              autoCalculated: true,
              manuallyConfirmed: false,
              derivedFromRNG: true
            };
            if (existingPool3?.firebaseKey) {
              await set(ref(database, `picks_pool3/${existingPool3.firebaseKey}`), p3Record);
            } else {
              await push(ref(database, 'picks_pool3'), p3Record);
            }
            console.log(`✅ Pool #3 auto-derived from RNG Pool #1 for ${playerCode}`);
          }
        }
      } catch(e) { console.warn('Pool #3 auto-derive from RNG failed:', e.message); }

      console.log(`✅ RNG Picks submitted for ${playerCode} (${enteredBy}) to both tables`);
    } catch (error) {
      console.error('Error submitting RNG picks:', error);
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
    const weekGames = dynamicPlayoffWeeks[currentWeek].games;
    const rngPredictions = {};
    
    weekGames.forEach(game => {
      rngPredictions[game.id] = generateRNGScore();
    });
    
    setRngPreview(rngPredictions);
    setShowRngPreview(true);
  };

  const submitRNGPicks = async () => {
    if (!selectedPlayerForOverride || !rngPreview) return;
    if (!overrideTableTarget) {
      alert('⚠️ Please select a table (Visible Pick, Blind Pick, or BOTH) before submitting RNG picks.');
      return;
    }

    const selectedPlayer = PLAYER_CODES[selectedPlayerForOverride];
    if (!selectedPlayer) return;

    // Calculate Saturday 12:00:00 AM PST after the Friday deadline
    const getSaturdayMidnightPST = () => {
      const autoLockDate = (playoffDates?.autoLockDates || AUTO_LOCK_DATES_FALLBACK)[currentWeek];
      if (autoLockDate) {
        // autoLockDate is the Friday date (e.g. "2027-01-16")
        // Saturday midnight PST = Friday date + 1 day at 00:00:00 PST
        const [year, month, day] = autoLockDate.split('-').map(Number);
        // PST is UTC-8, so Saturday 00:00:00 PST = Saturday 08:00:00 UTC
        const saturdayMidnightUTC = new Date(Date.UTC(year, month - 1, day + 1, 8, 0, 0, 0));
        return saturdayMidnightUTC.getTime();
      }
      return Date.now();
    };

    const rngTimestamp = rngUseDeadlineTimestamp ? getSaturdayMidnightPST() : Date.now();

    // Generate a fresh independent set of RNG predictions
    const generateFreshPredictions = () => {
      const weekGames = dynamicPlayoffWeeks[currentWeek].games;
      const preds = {};
      weekGames.forEach(game => { preds[game.id] = generateRNGScore(); });
      return preds;
    };

    const buildPickData = (predictions) => ({
      playerName: selectedPlayer,
      playerCode: selectedPlayerForOverride,
      week: currentWeek,
      predictions,
      timestamp: rngTimestamp,
      lastUpdated: rngTimestamp,
      enteredBy: 'POOL_MANAGER_RNG',
      enteredByCode: playerCode,
      enteredByName: playerName
    });

    try {
      if (overrideTableTarget === 'apptv' || overrideTableTarget === 'both') {
        const existing = allPicksAPPTV.find(p => p.playerCode === selectedPlayerForOverride && p.week === currentWeek);
        if (existing?.firebaseKey) await remove(ref(database, `picks_apptv/${existing.firebaseKey}`));
        await push(ref(database, 'picks_apptv'), buildPickData(rngPreview));
      }
      if (overrideTableTarget === 'apptb' || overrideTableTarget === 'both') {
        const existing = allPicksAPPTB.find(p => p.playerCode === selectedPlayerForOverride && p.week === currentWeek);
        if (existing?.firebaseKey) await remove(ref(database, `picks_apptb/${existing.firebaseKey}`));
        const apptbPredictions = overrideTableTarget === 'both' ? generateFreshPredictions() : rngPreview;
        await push(ref(database, 'picks_apptb'), buildPickData(apptbPredictions));
      }

      const tableLabel = overrideTableTarget === 'both' ? 'Pool #1 + Pool #2' : overrideTableTarget === 'apptv' ? 'Pool #1 (Visible)' : 'Pool #2 (Blind)';
      const tsLabel = rngUseDeadlineTimestamp ? `Saturday 12:00 AM PST (deadline+1)` : 'current time';
      alert(`✅ RNG picks saved for ${selectedPlayer} — ${tableLabel}!\n⏰ Timestamp: ${tsLabel}`);
      setShowRngPreview(false);
      setRngPreview(null);
      setRngUseDeadlineTimestamp(false);
      setOverrideMode(false);
      setSelectedPlayerForOverride('');
      setOverrideTableTarget('');
    } catch (error) {
      console.error('Error submitting RNG picks:', error);
      alert(`❌ Error submitting RNG picks: ${error.message}`);
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
    const currentWeekData = dynamicPlayoffWeeks[currentWeek];

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

      // NEW - Dual table submission (2026/2027)
      if (existingFirebaseKey) {
        await set(ref(database, `picks/${existingFirebaseKey}`), pickData); // Old path
        await set(ref(database, `picks_apptv/${existingFirebaseKey}`), pickData); // NEW - APPTV
        await set(ref(database, `picks_apptb/${existingFirebaseKey}`), pickData); // NEW - APPTB
      } else {
        const newPickRef = await push(ref(database, 'picks'), pickData);
        const newKey = newPickRef.key;
        await set(ref(database, `picks_apptv/${newKey}`), pickData);
        await set(ref(database, `picks_apptb/${newKey}`), pickData);
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

  // ============================================
  // 👑 NEW - OVERRIDE TIMESTAMP HELPERS
  // ============================================

  /**
   * Convert Unix ms timestamp to editable string format:
   * "YYYY-MM-DD HH:MM:SS AM/PM"
   * (24-hour clock values, AM/PM shown alongside)
   */
  const formatTimestampForEdit = (ms) => {
    if (!ms) return '';
    const d = new Date(ms);
    // Use PST (UTC-8) for display
    const pst = new Date(d.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    const year  = pst.getFullYear();
    const month = String(pst.getMonth() + 1).padStart(2, '0');
    const day   = String(pst.getDate()).padStart(2, '0');
    const hours = String(pst.getHours()).padStart(2, '0'); // 24-hr
    const mins  = String(pst.getMinutes()).padStart(2, '0');
    const secs  = String(pst.getSeconds()).padStart(2, '0');
    const ampm  = pst.getHours() >= 12 ? 'PM' : 'AM';
    return `${year}-${month}-${day} ${hours}:${mins}:${secs} ${ampm}`;
  };

  /**
   * Parse the editable timestamp string back to Unix ms.
   * Expects "YYYY-MM-DD HH:MM:SS AM/PM" and a ms string like "000".
   * Interprets HH as 24-hour regardless of AM/PM label.
   */
  const parseTimestampFromEdit = (str, msStr) => {
    if (!str || !str.trim()) return Date.now();
    try {
      // Strip AM/PM label — HH is already 24-hr
      const clean = str.replace(/\s*(AM|PM)\s*$/i, '').trim();
      // "YYYY-MM-DD HH:MM:SS" → parse as PST
      const [datePart, timePart] = clean.split(' ');
      if (!datePart || !timePart) return Date.now();
      const [y, mo, dy] = datePart.split('-').map(Number);
      const [h, mi, s]  = timePart.split(':').map(Number);
      const msVal = parseInt(msStr || '0', 10) || 0;
      // Build as PST (UTC-8) by constructing UTC equivalent
      const utc = Date.UTC(y, mo - 1, dy, h + 8, mi, s, msVal);
      return utc;
    } catch {
      return Date.now();
    }
  };

  /**
   * Get current time as editable string (for "Use Current Time" button)
   */
  const getCurrentTimestampString = () => formatTimestampForEdit(Date.now());

  // ============================================
  // 👑 NEW - LOAD PICKS FOR OVERRIDE (per table)
  // ============================================

  /**
   * Load existing picks for the selected player into the override form.
   * Loads APPTV from allPicksAPPTV, APPTB from allPicksAPPTB.
   * Pre-fills scores and timestamps for each table.
   */
  const loadPlayerPicksForOverrideNew = () => {
    if (!selectedPlayerForOverride) return;

    console.log('🔍 Loading picks for:', selectedPlayerForOverride, 'week:', currentWeek);
    console.log('🔍 allPicksAPPTV count:', allPicksAPPTV.length);
    console.log('🔍 allPicksAPPTB count:', allPicksAPPTB.length);

    const apptvPick = allPicksAPPTV.find(
      p => p.playerCode === selectedPlayerForOverride && p.week === currentWeek
    );
    const apptbPick = allPicksAPPTB.find(
      p => p.playerCode === selectedPlayerForOverride && p.week === currentWeek
    );

    console.log('🔍 Found APPTV pick:', apptvPick ? 'YES' : 'NO', apptvPick?.predictions);
    console.log('🔍 Found APPTB pick:', apptbPick ? 'YES' : 'NO', apptbPick?.predictions);

    // APPTV
    if (apptvPick && apptvPick.predictions) {
      setPredictionsOverrideAPPTV({ ...apptvPick.predictions });
      setOverrideTimestampAPPTV(formatTimestampForEdit(apptvPick.lastUpdated || apptvPick.timestamp));
      setOverrideTimestampMsAPPTV('000');
    } else {
      setPredictionsOverrideAPPTV({});
      setOverrideTimestampAPPTV(getCurrentTimestampString());
      setOverrideTimestampMsAPPTV('000');
    }

    // APPTB
    if (apptbPick && apptbPick.predictions) {
      setPredictionsOverrideAPPTB({ ...apptbPick.predictions });
      setOverrideTimestampAPPTB(formatTimestampForEdit(apptbPick.lastUpdated || apptbPick.timestamp));
      setOverrideTimestampMsAPPTB('000');
    } else {
      setPredictionsOverrideAPPTB({});
      setOverrideTimestampAPPTB(getCurrentTimestampString());
      setOverrideTimestampMsAPPTB('000');
    }

    setOverrideAction('manual');
  };

  // ============================================
  // 👑 NEW - SUBMIT OVERRIDE PICKS (per table)
  // ============================================

  const submitOverridePicks = async () => {
    if (!selectedPlayerForOverride || !overrideTableTarget) return;

    const selectedPlayer = PLAYER_CODES[selectedPlayerForOverride];
    if (!selectedPlayer) return;

    // Validate predictions — check for ties and missing scores
    const validatePreds = (preds, tableLabel) => {
      const games = dynamicPlayoffWeeks[currentWeek]?.games || [];
      const errors = [];
      for (const game of games) {
        const pred = preds[game.id];
        if (!pred || pred.team1 === '' || pred.team2 === '' || pred.team1 === undefined || pred.team2 === undefined) {
          errors.push(`${tableLabel} Game ${game.id}: missing scores`);
        } else {
          const t1 = parseInt(pred.team1);
          const t2 = parseInt(pred.team2);
          if (isNaN(t1) || isNaN(t2)) {
            errors.push(`${tableLabel} Game ${game.id}: invalid scores`);
          } else if (t1 === t2) {
            errors.push(`${tableLabel} Game ${game.id}: TIE not allowed (${t1}-${t2})`);
          }
        }
      }
      return errors;
    };

    const allErrors = [];
    if (overrideTableTarget === 'apptv' || overrideTableTarget === 'both') {
      allErrors.push(...validatePreds(predictionsOverrideAPPTV, 'Visible Pick'));
    }
    if (overrideTableTarget === 'apptb' || overrideTableTarget === 'both') {
      allErrors.push(...validatePreds(predictionsOverrideAPPTB, 'Blind Pick'));
    }

    if (allErrors.length > 0) {
      alert(`❌ Cannot save — please fix these issues:\n\n${allErrors.join('\n')}\n\nTies are not allowed in NFL Playoff Pool predictions.`);
      return;
    }

    try {
      const buildPickData = (tablePredictions, timestampStr, msStr) => {
        const lastUpdated = parseTimestampFromEdit(timestampStr, msStr);
        return {
          playerName: selectedPlayer,
          playerCode: selectedPlayerForOverride,
          week: currentWeek,
          predictions: tablePredictions,
          timestamp: lastUpdated,
          lastUpdated,
          enteredBy: 'POOL_MANAGER_OVERRIDE',
          enteredByCode: playerCode,
          enteredByName: playerName
        };
      };

      // Use push() always — avoids broken get() calls
      // First delete existing records for this player/week from each table
      const deleteExisting = async (tablePath) => {
        // Search in our already-loaded state instead of get()
        const existing = tablePath === 'picks_apptv' 
          ? allPicksAPPTV.find(p => p.playerCode === selectedPlayerForOverride && p.week === currentWeek)
          : allPicksAPPTB.find(p => p.playerCode === selectedPlayerForOverride && p.week === currentWeek);
        if (existing?.firebaseKey) {
          await remove(ref(database, `${tablePath}/${existing.firebaseKey}`));
        }
      };

      if (overrideTableTarget === 'apptv' || overrideTableTarget === 'both') {
        await deleteExisting('picks_apptv');
        await push(ref(database, 'picks_apptv'), buildPickData(predictionsOverrideAPPTV, overrideTimestampAPPTV, overrideTimestampMsAPPTV));
      }
      if (overrideTableTarget === 'apptb' || overrideTableTarget === 'both') {
        await deleteExisting('picks_apptb');
        await push(ref(database, 'picks_apptb'), buildPickData(predictionsOverrideAPPTB, overrideTimestampAPPTB, overrideTimestampMsAPPTB));
      }

      const tableLabel = overrideTableTarget === 'both' ? 'Pool #1 + Pool #2' : overrideTableTarget === 'apptv' ? 'Pool #1 (Visible)' : 'Pool #2 (Blind)';
      alert(`✅ Override saved for ${selectedPlayer} — ${tableLabel}!`);

      setOverrideAction(null);
      setOverrideTableTarget('');
      setPredictionsOverrideAPPTV({});
      setPredictionsOverrideAPPTB({});
      setOverrideTimestampAPPTV('');
      setOverrideTimestampAPPTB('');
      setOverrideTimestampMsAPPTV('000');
      setOverrideTimestampMsAPPTB('000');
      setOverrideMode(false);
      setSelectedPlayerForOverride('');

    } catch (error) {
      console.error('Error submitting override picks:', error);
      alert(`❌ Error saving override: ${error.message}`);
    }
  };

  /**
   * Delete picks for selected player for CURRENT week only
   */
  const deletePicksForWeek = async () => {
    if (!selectedPlayerForOverride) return;
    const selectedPlayer = PLAYER_CODES[selectedPlayerForOverride];
    const weekLabel = currentWeek === 'wildcard' ? 'Week 1' : currentWeek === 'divisional' ? 'Week 2' : currentWeek === 'conference' ? 'Week 3' : 'Week 4';

    try {
      let totalDeleted = 0;

      // Use already-loaded state instead of get() which is broken for these paths
      const apptvRecord = allPicksAPPTV.find(p => p.playerCode === selectedPlayerForOverride && p.week === currentWeek);
      const apptbRecord = allPicksAPPTB.find(p => p.playerCode === selectedPlayerForOverride && p.week === currentWeek);
      const pool3Records = allPicksPool3.filter(p => p.playerCode === selectedPlayerForOverride && p.week === currentWeek);


      console.log(`🗑️ Delete week ${currentWeek} for ${selectedPlayerForOverride}:`, {
        apptv: apptvRecord?.firebaseKey || 'none',
        apptb: apptbRecord?.firebaseKey || 'none',
        pool3: pool3Records.map(r => r.firebaseKey),

      });

      if (apptvRecord?.firebaseKey) {
        await remove(ref(database, `picks_apptv/${apptvRecord.firebaseKey}`));
        totalDeleted++;
      }
      if (apptbRecord?.firebaseKey) {
        await remove(ref(database, `picks_apptb/${apptbRecord.firebaseKey}`));
        totalDeleted++;
      }
      for (const r of pool3Records) { await remove(ref(database, `picks_pool3/${r.firebaseKey}`)); totalDeleted++; }


      if (totalDeleted > 0) {
        alert(`✅ Deleted ${totalDeleted} record(s) for ${selectedPlayer} — ${weekLabel}\n\nPool #1: ${apptvRecord ? '✓ deleted' : '— none'}\nPool #2: ${apptbRecord ? '✓ deleted' : '— none'}\nPool #3: ${pool3Records.length > 0 ? `✓ ${pool3Records.length} deleted` : '— none'}`);
      } else {
        alert(`ℹ️ No picks found for ${selectedPlayer} in ${weekLabel}.\n\nSearched week key: "${currentWeek}"\nPool #1 records checked: ${allPicksAPPTV.filter(p=>p.playerCode===selectedPlayerForOverride).length}\nPool #2 records checked: ${allPicksAPPTB.filter(p=>p.playerCode===selectedPlayerForOverride).length}`);
      }

      setShowDeleteConfirm(null);
      setSelectedPlayerForOverride('');
    } catch (error) {
      console.error('Error deleting picks:', error);
      alert(`❌ Error deleting picks: ${error.message}`);
    }
  };

  /**
   * Delete ALL picks for selected player across ALL weeks
   */
  const deleteAllPicksForPlayer = async () => {
    if (!selectedPlayerForOverride) return;
    const selectedPlayer = PLAYER_CODES[selectedPlayerForOverride];

    try {
      let totalDeleted = 0;

      // Use already-loaded state instead of broken get() calls
      const apptvRecords = allPicksAPPTV.filter(p => p.playerCode === selectedPlayerForOverride);
      const apptbRecords = allPicksAPPTB.filter(p => p.playerCode === selectedPlayerForOverride);
      const pool3Records = allPicksPool3.filter(p => p.playerCode === selectedPlayerForOverride);


      await Promise.all([
        ...apptvRecords.map(r => remove(ref(database, `picks_apptv/${r.firebaseKey}`))),
        ...apptbRecords.map(r => remove(ref(database, `picks_apptb/${r.firebaseKey}`))),
        ...pool3Records.map(r => remove(ref(database, `picks_pool3/${r.firebaseKey}`))),

      ]);
      totalDeleted = apptvRecords.length + apptbRecords.length + pool3Records.length;

      if (totalDeleted > 0) {
        alert(`✅ ALL picks for ${selectedPlayer} deleted!\n\nRemoved ${totalDeleted} record(s) across all weeks and all 4 pools.`);
      } else {
        alert(`ℹ️ ${selectedPlayer} has no picks in any week.`);
      }

      setShowDeleteConfirm(null);
      setSelectedPlayerForOverride('');
      setOverrideMode(false);
    } catch (error) {
      console.error('Error deleting all picks:', error);
      alert(`❌ Error deleting picks: ${error.message}`);
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
      const total = Number(totalFees);

      // ── 25 EQUAL PRIZES STRUCTURE ──────────────────────────
      // 10% off top → perfect score bonus (split equally among ALL perfect score hits, no cap)
      // Remaining 90% → split equally across ALL 25 prizes (#1-#25)
      // Scenario A (perfect score exists):
      //   perfectScorePool = 10% of total → split equally among all PS hits
      //   prizePool90 = 90% of total → 25 equal prizes
      //   Each prize = floor(prizePool90 / 25) rounded DOWN to nearest cent
      // Scenario B (no perfect score):
      //   10% rolls back → full 100% split across 25 prizes
      //   Each prize = floor(total / 25) rounded DOWN to nearest cent

      const perfectScorePool   = Math.floor(total * 0.10 * 100) / 100;
      const prizePool90        = Math.floor((total - perfectScorePool) * 100) / 100;
      const prizePool100       = total;

      // Each prize rounded DOWN to nearest cent — you keep any leftover pennies
      const prizePerPrizeWithPS  = Math.floor(prizePool90  / 25 * 100) / 100;
      const prizePerPrizeNoPS    = Math.floor(prizePool100 / 25 * 100) / 100;

      // Keep legacy fields for backward compatibility with display code
      const pool12PrizeWithPS  = prizePerPrizeWithPS;
      const pool12PrizeNoPS    = prizePerPrizeNoPS;
      const pool34PrizeWithPS  = prizePerPrizeWithPS;
      const pool34PrizeNoPS    = prizePerPrizeNoPS;

      const poolData = {
        totalFees:              total,
        numberOfPlayers:        Number(numberOfPlayers),
        entryFee:               Number(entryFee),
        prizeValue:             prizePerPrizeWithPS,
        // ── Equal prize structure ──
        perfectScorePool:       perfectScorePool,
        totalPrizes:            25,
        prizePool90:            prizePool90,
        prizePerPrizeWithPS:    prizePerPrizeWithPS,
        prizePerPrizeNoPS:      prizePerPrizeNoPS,
        // Legacy fields kept for display compatibility
        pool12TotalWithPS:      prizePool90,
        pool34TotalWithPS:      prizePool90,
        pool12TotalNoPS:        prizePool100,
        pool34TotalNoPS:        prizePool100,
        pool12PrizeWithPS:      prizePerPrizeWithPS,
        pool12PrizeNoPS:        prizePerPrizeNoPS,
        pool34PrizeWithPS:      prizePerPrizeWithPS,
        pool34PrizeNoPS:        prizePerPrizeNoPS,
        // Perfect score settings — no cap, split equally among all winners
        perfectScoreBonusEnabled: perfectScoreBonusEnabled || false,
        perfectScorePrizeType:    'percent',
        perfectScorePrizeAmount:  10,
        perfectScoreNoCap:        true,   // No maximum winners — all hits share equally
        lastUpdated: new Date().toISOString()
      };

      await set(ref(database, 'prizePool'), poolData);
      setPrizePool(poolData);

      const msg =
        `✅ Prize pool saved!\n\n` +
        `Total Pool: $${total.toFixed(2)}\n` +
        `Players: ${numberOfPlayers} × $${entryFee}\n\n` +
        `─── IF PERFECT SCORE EXISTS ───\n` +
        `🎯 Perfect Score Bonus: $${perfectScorePool.toFixed(2)} (split equally among ALL hits — no cap)\n` +
        `🏆 25 equal prizes: $${prizePerPrizeWithPS.toFixed(2)} each\n` +
        `   (Prizes #1–#25 all pay the same amount)\n\n` +
        `─── IF NO PERFECT SCORE (10% rolls back) ───\n` +
        `🏆 25 equal prizes: $${prizePerPrizeNoPS.toFixed(2)} each\n` +
        `   (Prizes #1–#25 all pay the same amount)\n\n` +
        `💡 Any leftover cents stay with the Pool Manager.`;

      alert(msg);
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
  // Reads game dates from Firebase (set by Pool Manager) with fallback to hardcoded defaults
  // Always locks on FRIDAY at 11:59 PM regardless of whether game is Saturday or Sunday
  const shouldAutoLock = (weekKey) => {
    // Use Firebase dates if available, otherwise fallback
    const autoLockDates = playoffDates?.autoLockDates || AUTO_LOCK_DATES_FALLBACK;
    const autoLockDate = autoLockDates[weekKey];
    if (!autoLockDate) return false;
    
    const now = new Date();
    const pstTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    
    // Always go back to FRIDAY regardless of whether game is Saturday or Sunday
    const gameDayDate = new Date(autoLockDate + 'T00:00:00');
    const lockDateTime = new Date(gameDayDate);
    const dayOfWeek = gameDayDate.getDay(); // 0=Sun, 6=Sat
    const daysBackToFriday = dayOfWeek === 6 ? 1 : dayOfWeek === 0 ? 2 : (dayOfWeek - 5 + 7) % 7;
    lockDateTime.setDate(lockDateTime.getDate() - daysBackToFriday);
    lockDateTime.setHours(23, 59, 59, 999); // Friday 11:59:59.999 PM
    
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
        // Use Firebase dates if available, otherwise fallback
        const autoLockDates = playoffDates?.autoLockDates || AUTO_LOCK_DATES_FALLBACK;
        // Merge with auto-lock dates
        const mergedStatus = {};
        Object.keys(autoLockDates).forEach(weekKey => {
          mergedStatus[weekKey] = {
            locked: data[weekKey]?.locked || false,
            lockDate: data[weekKey]?.lockDate || null,
            autoLockDate: autoLockDates[weekKey]
          };
        });
        setWeekLockStatus(mergedStatus);
      }
    });
  }, [playoffDates]);

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
      autoLockDate: (playoffDates?.autoLockDates || AUTO_LOCK_DATES_FALLBACK)[weekKey]
    });
    
    alert(newLockStatus 
      ? `✅ Week ${weekKey} is now LOCKED\n\nPlayers cannot edit picks for this week.`
      : `🔓 Week ${weekKey} is now UNLOCKED\n\nPlayers can edit picks for this week.`
    );
  };

  // Load all picks from Firebase
  useEffect(() => {
    const picksRef = ref(database, 'picks');
    const unsubscribe = onValue(picksRef, (snapshot) => {
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
    return () => unsubscribe();
  }, []);

  // Subscribe to global APPTV/APPTB listeners (initialized outside React to avoid StrictMode)
  useEffect(() => {
    // If already loaded, set immediately
    if (_apptvLoaded) setAllPicksAPPTV([..._allPicksAPPTV]);
    // Subscribe to future updates
    const cb = (data) => setAllPicksAPPTV([...data]);
    _apptvCallbacks.push(cb);
    return () => {
      const idx = _apptvCallbacks.indexOf(cb);
      if (idx > -1) _apptvCallbacks.splice(idx, 1);
    };
  }, []);

  useEffect(() => {
    if (_apptbLoaded) setAllPicksAPPTB([..._allPicksAPPTB]);
    const cb = (data) => setAllPicksAPPTB([...data]);
    _apptbCallbacks.push(cb);
    return () => {
      const idx = _apptbCallbacks.indexOf(cb);
      if (idx > -1) _apptbCallbacks.splice(idx, 1);
    };
  }, []);

  // Load team codes from Firebase
  useEffect(() => {
    const teamCodesRef = ref(database, 'teamCodes');
    onValue(teamCodesRef, (snapshot) => {
      const data = snapshot.val();
      console.log('📊 Loaded teamCodes:', data);
      if (data) {
        // FIX: Convert arrays to objects with numeric keys
        const fixedData = {};
        Object.keys(data).forEach(week => {
          if (Array.isArray(data[week])) {
            // Firebase converts numeric keys to array indices
            // PlayoffTeamsSetup saves gameNum 1-6, Firebase stores as array[1..6]
            // Array index 0 is null/undefined (no game 0), so array[1]=game1 etc.
            fixedData[week] = {};
            data[week].forEach((item, index) => {
              if (item) fixedData[week][index] = item; // preserve original index
            });
          } else {
            fixedData[week] = data[week];
          }
        });
        console.log('📊 Fixed teamCodes:', fixedData);
        setTeamCodes(fixedData);
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

  // NEW - Auto-save APPTV predictions to localStorage (draft mode)
  useEffect(() => {
    if (playerCode && currentWeek && Object.keys(predictionsAPPTV).length > 0) {
      const key = `draft_apptv_${playerCode}_${currentWeek}`;
      localStorage.setItem(key, JSON.stringify(predictionsAPPTV));
      console.log('💾 Auto-saved APPTV draft to localStorage');
    }
  }, [predictionsAPPTV, playerCode, currentWeek]);

  // NEW - Auto-save APPTB predictions to localStorage (draft mode)
  useEffect(() => {
    if (playerCode && currentWeek && Object.keys(predictionsAPPTB).length > 0) {
      const key = `draft_apptb_${playerCode}_${currentWeek}`;
      localStorage.setItem(key, JSON.stringify(predictionsAPPTB));
      console.log('💾 Auto-saved APPTB draft to localStorage');
    }
  }, [predictionsAPPTB, playerCode, currentWeek]);

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

  // 🎯 Load perfect score overrides from Firebase
  useEffect(() => {
    const psOverridesRef = ref(database, 'psOverrides');
    onValue(psOverridesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setPsOverrides(Array.isArray(data) ? data : Object.values(data));
      } else {
        setPsOverrides([]);
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

  // NEW - Restore session from localStorage on page load (prevents F5 logout)
  useEffect(() => {
    const savedPlayerCode = localStorage.getItem('session_playerCode');
    const savedPlayerName = localStorage.getItem('session_playerName');
    
    if (savedPlayerCode && savedPlayerName) {
      console.log('🔄 Restoring session from localStorage:', savedPlayerName);
      setPlayerCode(savedPlayerCode);
      setPlayerName(savedPlayerName);
      setCodeValidated(true);
    }
  }, []); // Only run once on mount

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

  // 📅 Load playoff dates from Firebase
  useEffect(() => {
    const playoffDatesRef = ref(database, 'playoffDates');
    onValue(playoffDatesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setPlayoffDates(data);
        console.log('📅 Loaded playoff dates:', data);
      }
    });
  }, []);

  // ============================================
  // 🎯 POOL #3/#4 FIREBASE LISTENERS
  // ============================================

  // Kill switch
  useEffect(() => {
    const killRef = ref(database, 'pool34_enabled');
    const unsub = onValue(killRef, (snapshot) => {
      setPool34Enabled(snapshot.val() === true);
    });
    return () => unsub();
  }, []);

  // Betting lines (Pool Manager enters these)
  useEffect(() => {
    const linesRef = ref(database, 'betting_lines');
    const unsub = onValue(linesRef, (snapshot) => {
      const data = snapshot.val();
      setBettingLines(data || {});
      setBettingLinesForm(data || {});
    });
    return () => unsub();
  }, []);

  // Grading overrides (Pool Manager manual ATS/O/U overrides)
  useEffect(() => {
    const gradingRef = ref(database, 'grading_overrides');
    const unsub = onValue(gradingRef, (snapshot) => {
      setGradingOverrides(snapshot.val() || {});
    });
    return () => unsub();
  }, []);

  // Pool #3 picks (Visible)
  useEffect(() => {
    const registerCallback = (cb) => {
      if (_pool3Loaded) { cb(_allPicksPool3); }
      _pool3Callbacks.push(cb);
      return () => { const i = _pool3Callbacks.indexOf(cb); if (i > -1) _pool3Callbacks.splice(i, 1); };
    };
    return registerCallback((picks) => {
      setAllPicksPool3(picks);
    });
  }, []);

  // Pool #4 picks (Blind)
  useEffect(() => {
    const registerCallback = (cb) => {

    };
    return registerCallback((picks) => {
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
      const weekGames = dynamicPlayoffWeeks[currentWeek].games;
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
    setCurrentPredictions(prev => ({
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
  // Handle jump link from reference badge — warn if existing picks in destination
  const handleTableJump = (targetTable) => {
    const existingPicks = targetTable === 'apptv'
      ? allPicksAPPTV.find(p => p.playerCode === playerCode && p.week === currentWeek)
      : allPicksAPPTB.find(p => p.playerCode === playerCode && p.week === currentWeek);

    if (existingPicks) {
      setShowTableJumpWarning({
        targetTable,
        existingTimestamp: existingPicks.timestamp,
        isBlind: targetTable === 'apptb'
      });
    } else {
      // No existing picks — switch silently
      setCurrentTableView(targetTable);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleRNGPick = () => {
    const currentPreds = currentTableView === 'apptv' ? predictionsAPPTV : 
                         currentTableView === 'apptb' ? predictionsAPPTB : predictions;
    const hasExistingPicks = Object.keys(currentPreds).some(gameId => 
      currentPreds[gameId]?.team1 || currentPreds[gameId]?.team2
    );
    
    if (hasExistingPicks) {
      const confirmed = window.confirm(
        '⚠️ WARNING!\n\n' +
        `Clicking RNG will OVERWRITE your current ${currentTableView === 'apptv' ? 'Pool #1 (Visible)' : 'Pool #2 (Blind)'} picks!\n\n` +
        'Are you sure you want to continue?'
      );
      if (!confirmed) return;
    }
    
    const generatePreds = () => {
      const preds = {};
      currentWeekData.games.forEach(game => {
        let t1 = Math.floor(Math.random() * 43) + 3;
        let t2 = Math.floor(Math.random() * 43) + 3;
        while (t1 === t2) t2 = Math.floor(Math.random() * 43) + 3;
        preds[game.id] = { team1: t1.toString(), team2: t2.toString() };
      });
      return preds;
    };

    const newPredictions = generatePreds();
    const tableLabel = currentTableView === 'apptv' ? '📺 Pool #1 (Visible)' : currentTableView === 'apptb' ? '🙈 Pool #2 (Blind)' : 'current table';

    if (currentTableView === 'apptv') {
      setPredictionsAPPTV(newPredictions);
    } else if (currentTableView === 'apptb') {
      setPredictionsAPPTB(newPredictions);
    } else {
      setPredictions(newPredictions);
    }

    setHasUnsavedChanges(true);
    alert(
      `🎲 RNG picks generated for ${tableLabel} — ${currentWeekData.games.length} games!\n\n` +
      `Score range: 3-45 points per team — no ties!\n\n` +
      `💡 To RNG the other table too, switch tabs and click Quick RNG Pick again.\n\n` +
      `Review your scores then click Submit to save.`
    );
  };

  // ── Generate random non-tied predictions for all games this week
  const generateRNGPreds = () => {
    const preds = {};
    currentWeekData.games.forEach(game => {
      let t1 = Math.floor(Math.random() * 43) + 3;
      let t2 = Math.floor(Math.random() * 43) + 3;
      while (t1 === t2) t2 = Math.floor(Math.random() * 43) + 3;
      preds[game.id] = { team1: t1.toString(), team2: t2.toString() };
    });
    return preds;
  };

  const handleRNGVisible = () => {
    const hasExisting = Object.keys(predictionsAPPTV).some(g => predictionsAPPTV[g]?.team1 || predictionsAPPTV[g]?.team2);
    if (hasExisting && !window.confirm('⚠️ This will OVERWRITE your current Visible picks with random scores.\n\nContinue?')) return;
    setPredictionsAPPTV(generateRNGPreds());
    setVisiblePicksDirty(true);
    setHasUnsavedChanges(true);
    alert(`🎲 Random Visible picks generated for all ${currentWeekData.games.length} games!\n\nReview the scores then click 🟡 Submit Visible Pick to save.`);
  };

  const handleRNGBlind = () => {
    const hasExisting = Object.keys(predictionsAPPTB).some(g => predictionsAPPTB[g]?.team1 || predictionsAPPTB[g]?.team2);
    const hasSavedBlind = allPicksAPPTB.some(p => p.playerCode === playerCode && p.week === currentWeek);
    if (hasExisting) {
      let msg = '⚠️ This will OVERWRITE your current Blind picks with random scores.';
      if (hasSavedBlind) {
        msg += '\n\n🔵 TIMESTAMP WARNING:\nYour Blind Pick has already been saved. Submitting new scores will reset your timestamp — if you are tied for first in the Blind Pool, an earlier timestamp gives you the tiebreaker edge.';
      }
      msg += '\n\nContinue?';
      if (!window.confirm(msg)) return;
    }
    if (!blindCancelSnapshot && hasExisting) setBlindCancelSnapshot(JSON.parse(JSON.stringify(predictionsAPPTB)));
    setPredictionsAPPTB(generateRNGPreds());
    setBlindPicksDirty(true);
    setHasUnsavedChanges(true);
    alert(`🎲 Random Blind picks generated for all ${currentWeekData.games.length} games!\n\nReview the scores then click 🔵 Submit Blind Pick to save.`);
  };

  const handleRNGBoth = () => {
    const hasExistingV = Object.keys(predictionsAPPTV).some(g => predictionsAPPTV[g]?.team1 || predictionsAPPTV[g]?.team2);
    const hasExistingB = Object.keys(predictionsAPPTB).some(g => predictionsAPPTB[g]?.team1 || predictionsAPPTB[g]?.team2);
    const hasSavedBlind = allPicksAPPTB.some(p => p.playerCode === playerCode && p.week === currentWeek);

    if (hasExistingV || hasExistingB) {
      let msg = '⚠️ RNG BOTH POOLS\n\nThis will OVERWRITE your current picks with random scores for ALL games in both pools.';
      if (hasSavedBlind) {
        msg += '\n\n🔵 BLIND POOL TIMESTAMP WARNING:\nYour Blind Pick has already been saved. Submitting new RNG scores will reset your timestamp — if you are tied for first in the Blind Pool, an earlier timestamp gives you the tiebreaker edge.\n\nOnly continue if you are comfortable with the timestamp resetting.';
      }
      msg += '\n\nContinue?';
      if (!window.confirm(msg)) return;
    }
    if (!blindCancelSnapshot && hasExistingB) setBlindCancelSnapshot(JSON.parse(JSON.stringify(predictionsAPPTB)));
    setPredictionsAPPTV(generateRNGPreds());
    setPredictionsAPPTB(generateRNGPreds());
    setVisiblePicksDirty(true);
    setBlindPicksDirty(true);
    setHasUnsavedChanges(true);
    alert(`🎲 Random picks generated for BOTH pools — all ${currentWeekData.games.length} games each!\n\nReview the scores then submit each pool separately using the buttons below.`);
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
    const weekGames = dynamicPlayoffWeeks[weekKey]?.games || [];
    
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
          `You can now configure ${nextWeekName} teams in the "Setup Playoff Dates/Teams" page.`
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
    
    const weekData = dynamicPlayoffWeeks[weekName];
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
    const weekData = dynamicPlayoffWeeks[weekName];
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
  // 💥 NUCLEAR CLEAR — Wipe all picks for current week
  // ============================================
  const handleNuclearClear = async () => {
    const weekLabel = currentWeekData.name;

    // Block if week is locked or submissions closed
    if (isWeekLocked(currentWeek)) {
      alert('🔒 WEEK LOCKED\n\nYou cannot clear picks after the week has been played.');
      return;
    }
    if (!isSubmissionAllowed()) {
      alert('⛔ SUBMISSIONS CLOSED\n\nYou cannot clear picks during the locked weekend period (Friday 11:59 PM – Monday 12:01 AM PST).');
      return;
    }

    // Step 1 — First warning
    const step1 = window.confirm(
      `💥 NUCLEAR CLEAR — ARE YOU SURE?\n\n` +
      `You are about to clear ALL picks for:\n` +
      `${weekLabel}\n\n` +
      `• Pool #1 (Visible scores)\n` +
      `• Pool #2 (Blind scores)\n` +
      `• Pool #3 (Visible Winner/ATS/O-U)\n` +

      `⚠️ This will ONLY clear your ${weekLabel} picks.\n` +
      `All other weeks are completely unaffected.\n\n` +
      `You will have to re-enter EVERYTHING again from scratch.\n\n` +
      `Click OK to continue, Cancel to go back.`
    );
    if (!step1) return;

    // Step 2 — Final confirmation
    const step2 = window.confirm(
      `⚠️ FINAL WARNING — THIS CANNOT BE UNDONE!\n\n` +
      `Are you absolutely sure you want to wipe all 4 pools for ${weekLabel} only?\n\n` +
      `All other weeks remain untouched.\n\n` +
      `You MUST re-submit all picks before the deadline:\n` +
      `${currentWeekData.deadline}\n\n` +
      `Click OK to PERMANENTLY DELETE all ${weekLabel} picks.\n` +
      `Click Cancel to keep your picks.`
    );
    if (!step2) return;

    try {
      const wipeMarker = {
        playerName, playerCode, week: currentWeek,
        intentionalWipe: true,
        wipedAt: Date.now(),
        picks: {}
      };
      const wipeMarkerPreds = {
        playerName, playerCode, week: currentWeek,
        intentionalWipe: true,
        wipedAt: Date.now(),
        predictions: {}
      };

      // Delete existing records and write wipe markers for all 4 pools
      const apptv = allPicksAPPTV.find(p => p.playerCode === playerCode && p.week === currentWeek);
      const apptb = allPicksAPPTB.find(p => p.playerCode === playerCode && p.week === currentWeek);
      const pool3s = allPicksPool3.filter(p => p.playerCode === playerCode && p.week === currentWeek);


      await Promise.all([
        apptv?.firebaseKey
          ? set(ref(database, `picks_apptv/${apptv.firebaseKey}`), wipeMarkerPreds)
          : push(ref(database, 'picks_apptv'), wipeMarkerPreds),
        apptb?.firebaseKey
          ? set(ref(database, `picks_apptb/${apptb.firebaseKey}`), wipeMarkerPreds)
          : push(ref(database, 'picks_apptb'), wipeMarkerPreds),
        ...pool3s.map(r => remove(ref(database, `picks_pool3/${r.firebaseKey}`))),

        push(ref(database, 'picks_pool3'), wipeMarker),

      ]);

      // Clear localStorage drafts so they don't restore on refresh
      localStorage.removeItem(`draft_apptv_${playerCode}_${currentWeek}`);
      localStorage.removeItem(`draft_apptb_${playerCode}_${currentWeek}`);

      // Clear all local state
      setPredictionsAPPTV({});
      setPredictionsAPPTB({});
      setPredictionsPool3({});
      setVisiblePicksDirty(false);
      setBlindPicksDirty(false);
      setPool3Dirty(false);
      setVisibleCancelSnapshot(null);
      setBlindCancelSnapshot(null);
      setPool3CancelSnapshot(null);
      setHasUnsavedChanges(false);
      setWipedWeeks(prev => new Set([...prev, currentWeek]));

      alert(`✅ All picks for ${weekLabel} have been wiped.\n\nYou can logout freely.\nRemember to re-submit before the deadline:\n${currentWeekData.deadline}`);
    } catch (err) {
      alert(`❌ Error wiping picks: ${err.message}`);
    }
  };

  // ============================================
  // 🚪 LOGOUT HANDLER WITH UNSAVED CHANGES CHECK
  // ============================================
  
  const handleLogout = () => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚪 HANDLE LOGOUT CALLED');
    
    const hasAPPTVSubmission = allPicksAPPTV.some(p => p.week === currentWeek && p.playerCode === playerCode);
    const hasAPPTBSubmission = allPicksAPPTB.some(p => p.week === currentWeek && p.playerCode === playerCode);
    const hasInitialSubmission = hasAPPTVSubmission && hasAPPTBSubmission;

    // If player intentionally wiped — allow free logout
    const wasIntentionallyWiped = wipedWeeks.has(currentWeek);
    if (wasIntentionallyWiped) {
      // proceed to logout below
    } else {

    // Only treat as "unsaved draft" if picks are in state BUT not in Firebase
    const hasAPPTVDraft = Object.keys(predictionsAPPTV).length > 0 && !hasAPPTVSubmission;
    const hasAPPTBDraft = Object.keys(predictionsAPPTB).length > 0 && !hasAPPTBSubmission;
    const hasDrafts = hasAPPTVDraft || hasAPPTBDraft;

    console.log('🔍 Debug - hasAPPTVSubmission:', hasAPPTVSubmission, 'hasAPPTBSubmission:', hasAPPTBSubmission);
    console.log('🔍 Debug - hasDrafts:', hasDrafts, 'hasUnsavedChanges:', hasUnsavedChanges);
    
    // ── Pool #3 dirty check — runs regardless of Pool #1/#2 submission status ──
    const hasPool3InFirebase = allPicksPool3.some(p => p.playerCode === playerCode && p.week === currentWeek && Object.keys(p.picks||{}).length > 0);
    const hasPool3OnScreen = Object.keys(predictionsPool3 || {}).length > 0;
    const pool3UnsavedOnScreen = hasPool3OnScreen && !hasPool3InFirebase;

    if (pool3Dirty || pool3UnsavedOnScreen) {
      const choice = window.confirm(
        '⚠️ UNSAVED POOL #3 PICKS!\n\n' +
        'You have Pool #3 picks on screen that have NOT been submitted yet.\n\n' +
        'Click CANCEL to go back and submit your Pool #3 picks.\n' +
        'Click OK to DISCARD your Pool #3 picks and logout.'
      );
      if (!choice) return;
    }

    if (!hasInitialSubmission && hasDrafts) {
      // Truly unsaved draft — warn before logout
      const apptvComplete = Object.keys(predictionsAPPTV).length === 6;
      const apptbComplete = Object.keys(predictionsAPPTB).length === 6;

      const choice = window.confirm(
        '⚠️ INCOMPLETE SUBMISSION WARNING!\n\n' +
        `Your ${currentWeekData.name} picks are NOT saved to the system yet.\n\n` +
        `APPTV: ${apptvComplete ? '✅ 6/6 games complete' : `⚠️ ${Object.keys(predictionsAPPTV).length}/6 games complete`}\n` +
        `APPTB: ${apptbComplete ? '✅ 6/6 games complete' : `⚠️ ${Object.keys(predictionsAPPTB).length}/6 games complete`}\n\n` +
        'Initial submission requires BOTH tables to be 100% complete.\n\n' +
        'Your progress is saved in your browser, but if you:\n' +
        '• Clear browser data\n' +
        '• Use a different device\n' +
        '• Browser crashes\n' +
        '...you will lose this progress.\n\n' +
        `Deadline: ${currentWeekData.deadline}\n\n` +
        'Are you sure you want to logout?'
      );
      if (!choice) return;
    } else if (hasInitialSubmission) {
      // Pool #1/#2 saved — if no Pool #3 in Firebase and nothing dirty, prompt to go fill it in
      if (!hasPool3InFirebase && !pool3Dirty && !pool3UnsavedOnScreen) {
        setShowPool34Prompt(true);
        return;
      }
    } else if (hasUnsavedChanges) {
      const choice = window.confirm(
        '⚠️ UNSAVED CHANGES!\n\n' +
        'You have unsaved picks that will be lost.\n\n' +
        'Click OK to DISCARD changes and logout\n' +
        'Click CANCEL to stay and save your picks'
      );
      if (!choice) return;
    }
    
    } // end else (not intentionally wiped)

    // Proceed with logout
    console.log('🚪 Proceeding with logout...');
    
    // NEW - Clear session from localStorage
    localStorage.removeItem('session_playerCode');
    localStorage.removeItem('session_playerName');
    console.log('🧹 Session cleared from localStorage');
    
    setCodeValidated(false);
    setPlayerCode('');
    setPlayerName('');
    setPredictions({});
    setPredictionsAPPTV({});
    setPredictionsAPPTB({});
    setCurrentView('picks');
    setHasUnsavedChanges(false);
    setWipedWeeks(new Set());
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
    console.log('📂📂📂 LOAD WEEK PICKS CALLED (DUAL TABLE) 📂📂📂');
    console.log('📂 Loading picks for week:', weekKey);
    
    // Load APPTV picks from Firebase
    const existingAPPTV = allPicksAPPTV.find(
      p => p.week === weekKey && p.playerCode === playerCode
    );
    
    // Load APPTB picks from Firebase
    const existingAPPTB = allPicksAPPTB.find(
      p => p.week === weekKey && p.playerCode === playerCode
    );
    
    // Check for drafts in localStorage
    const draftKeyAPPTV = `draft_apptv_${playerCode}_${weekKey}`;
    const draftKeyAPPTB = `draft_apptb_${playerCode}_${weekKey}`;
    const draftAPPTV = localStorage.getItem(draftKeyAPPTV);
    const draftAPPTB = localStorage.getItem(draftKeyAPPTB);
    
    // Determine if this is initial submission or editing
    const hasSubmitted = existingAPPTV || existingAPPTB;
    
    if (!hasSubmitted && (draftAPPTV || draftAPPTB) && !draftModalShown) {
      // DRAFT RESTORATION MODE
      console.log('📝 Found drafts in localStorage - showing restoration prompt');
      setShowDraftRestoreModal(true);
      setDraftData({ apptv: draftAPPTV, apptb: draftAPPTB });
      setDraftModalShown(true); // Mark as shown
    } else if (hasSubmitted) {
      // EDITING MODE - Load from Firebase
      console.log('✏️ Editing mode - loading from Firebase');
      if (existingAPPTV && existingAPPTV.predictions) {
        const predCopy = JSON.parse(JSON.stringify(existingAPPTV.predictions));
        setPredictionsAPPTV(predCopy);
      }
      if (existingAPPTB && existingAPPTB.predictions) {
        const predCopy = JSON.parse(JSON.stringify(existingAPPTB.predictions));
        setPredictionsAPPTB(predCopy);
      }
      setHasUnsavedChanges(false);
    } else {
      // FRESH START
      console.log('🆕 Fresh start - no drafts or submissions');
      setPredictionsAPPTV({});
      setPredictionsAPPTB({});
      setHasUnsavedChanges(false);
    }
    
    console.log('📂📂📂 LOAD WEEK PICKS COMPLETE 📂📂📂');
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


  // Load picks when week changes or when Firebase data loads
  useEffect(() => {
    if (codeValidated && playerCode) {
      loadWeekPicks(currentWeek);
    }
  }, [currentWeek, codeValidated, playerCode, allPicksAPPTV, allPicksAPPTB]);
  // NOTE: Added allPicksAPPTV and allPicksAPPTB so draft restore works after Firebase loads

  // Load Pool #3 picks into state when player logs in or week changes
  useEffect(() => {
    if (!codeValidated || !playerCode) return;
    const p3 = allPicksPool3.find(p => p.playerCode === playerCode && p.week === currentWeek);
    const hasPool1 = allPicksAPPTV.some(p => p.playerCode === playerCode && p.week === currentWeek);
    const hasPool2 = allPicksAPPTB.some(p => p.playerCode === playerCode && p.week === currentWeek);
    if (p3 && Object.keys(p3.picks || {}).length > 0) {
      // Always show manually entered picks; only show auto-filled if player has Pool #1 picks
      const isAutoFilled3 = p3.autoFilled === true;
      if (!isAutoFilled3 || hasPool1) {
        setPredictionsPool3(p3.picks);
      } else {
        setPredictionsPool3({});
      }
    } else if (!hasPool1) {
      setPredictionsPool3({});
    }
  }, [currentWeek, codeValidated, playerCode, allPicksPool3, allPicksAPPTV, allPicksAPPTB]);

  // ============================================================
  // 🎯 POOL #3/#4 BACKFILL — runs on login and whenever picks load
  // For any week where Pool #1/#2 exists but Pool #3 is missing,
  // auto-calculate and save silently. Protects manual edits.
  // ============================================================
  useEffect(() => {
    if (!codeValidated || !playerCode || !pool34Enabled) return;
    const weeks = ['wildcard', 'divisional', 'conference', 'superbowl'];
    const weekLines = bettingLines || {};
    const hasAnyLines = weeks.some(wk => Object.keys(weekLines[wk] || {}).length > 0);
    if (!hasAnyLines) return;

    const computePool34Picks = (predictions, lines, weekGames, weekKey) => {
      const picks = {};
      weekGames.forEach(game => {
        const gidStr = String(game.id);
        const pred = predictions?.[gidStr] || predictions?.[game.id];
        const line = lines?.[gidStr] || lines?.[game.id];
        if (!pred || !line || !line.favourite || !line.spread || !line.overUnder) return;
        const t1 = parseInt(pred.team1);
        const t2 = parseInt(pred.team2);
        if (isNaN(t1) || isNaN(t2)) return;
        // Get team names — use placeholder-safe fallbacks if teams not configured
        const awayRaw = getTeamName(weekKey, game.id, 'team1', playoffTeams);
        const homeRaw = getTeamName(weekKey, game.id, 'team2', playoffTeams);
        const awayName = (awayRaw && awayRaw !== 'TBD' && !awayRaw.startsWith('AFC') && !awayRaw.startsWith('NFC')) ? awayRaw : `Away_${game.id}`;
        const homeName = (homeRaw && homeRaw !== 'TBD' && !homeRaw.startsWith('AFC') && !homeRaw.startsWith('NFC')) ? homeRaw : `Home_${game.id}`;
        const winner = t1 > t2 ? awayName : homeName;
        const favMatch = (name, fav) => name === fav || name.includes(fav) || fav.includes(name);
        const favIsAway = favMatch(awayName, line.favourite);
        const favMargin = favIsAway ? (t1 - t2) : (t2 - t1);
        const underdog = favIsAway ? homeName : awayName;
        const ats = favMargin > parseFloat(line.spread) ? line.favourite : underdog;
        const ou = (t1 + t2) > parseFloat(line.overUnder) ? 'over' : 'under';
        picks[game.id] = { winner, ats, ou };
      });
      return picks;
    };

    const runBackfill = async () => {
      for (const weekKey of weeks) {
        const lines = weekLines[weekKey] || {};
        if (!Object.keys(lines).length) continue;
        const weekGames = dynamicPlayoffWeeks[weekKey]?.games || [];
        if (!weekGames.length) continue;

        // Pool #1 → Pool #3
        const p1Pick = allPicksAPPTV.find(p => p.playerCode === playerCode && p.week === weekKey);
        const p3Pick = allPicksPool3.find(p => p.playerCode === playerCode && p.week === weekKey);
        const p3HasPicks = p3Pick && Object.keys(p3Pick.picks || {}).length > 0;
        const p3IsManuallyConfirmed = p3Pick?.manuallyConfirmed === true;
        const p3NeedsBackfill = !p3HasPicks || (!p3IsManuallyConfirmed && !pool3ManuallyEdited);
        if (p1Pick && p3NeedsBackfill) {
          const picks = computePool34Picks(p1Pick.predictions, lines, weekGames, weekKey);
          console.log(`🔍 Backfill Pool #3 ${weekKey}: ${Object.keys(picks).length}/${weekGames.length} games computed`);
          if (Object.keys(picks).length > 0) {
            try {
              // If partial record exists, overwrite it; otherwise push new
              const p1Timestamp = p1Pick.timestamp || p1Pick.lastUpdated || Date.now();
              const pool3Record = {
                playerName, playerCode, week: weekKey, picks,
                timestamp: p1Timestamp,
                lastUpdated: p1Timestamp,
                autoFilled: true,
                autoCalculated: true,
                manuallyConfirmed: false
              };
              if (p3Pick?.firebaseKey) {
                await set(ref(database, `picks_pool3/${p3Pick.firebaseKey}`), pool3Record);
              } else {
                await push(ref(database, 'picks_pool3'), pool3Record);
              }
              if (weekKey === currentWeek) setPredictionsPool3(picks);
              console.log(`✅ Pool #3 backfilled for ${playerName} week=${weekKey}`);
            } catch (err) { console.warn('⚠️ Pool #3 backfill error:', err.message); }
          } else {
            console.warn(`⚠️ Pool #3 backfill skipped ${weekKey} — 0 picks computed.`,
              '\n  p1Pick.predictions keys:', Object.keys(p1Pick.predictions || {}),
              '\n  lines keys:', Object.keys(lines),
              '\n  playoffTeams configured:', !!playoffTeams?.week1?.configured,
              '\n  weekGames count:', weekGames.length
            );
          }
        }

        // Pool #4 removed — no backfill needed
      }
    };

    runBackfill();
  }, [codeValidated, playerCode, pool34Enabled, allPicksAPPTV, allPicksPool3, bettingLines, playoffTeams, dynamicPlayoffWeeks]);

  // Check if submissions are allowed based on day/time (PST)
  // Pool Manager bypasses lockout
  // Reads dates from Firebase (set by Pool Manager) with fallback to hardcoded defaults
  const isSubmissionAllowed = () => {
    // Pool Manager can always submit
    if (isPoolManager()) {
      return true;
    }

    const now = new Date();
    const pstTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    
    // Use Firebase dates if available, otherwise fallback
    const season = {
      firstFriday: playoffDates?.firstFriday || PLAYOFF_SEASON_FALLBACK.firstFriday,
      lastMonday: playoffDates?.lastMonday || PLAYOFF_SEASON_FALLBACK.lastMonday
    };
    const autoLockDates = playoffDates?.autoLockDates || AUTO_LOCK_DATES_FALLBACK;

    // Check if we're in playoff season
    const playoffStart = new Date(season.firstFriday + 'T00:00:00');
    const playoffEnd = new Date(season.lastMonday + 'T23:59:59');
    
    // If BEFORE playoff season starts: Allow submissions anytime!
    if (pstTime < playoffStart) {
      return true;
    }
    
    // If AFTER playoff season ends: Season is over
    if (pstTime > playoffEnd) {
      return false;
    }
    
    // We're IN playoff season - only block on weekends when ACTUAL games are being played
    // Calculate each game weekend: Friday 11:59 PM through Monday 12:01 AM
    const gameWeekends = Object.values(autoLockDates).map(date => {
      const gameDay = new Date(date + 'T00:00:00');
      
      // Always calculate back to FRIDAY regardless of game day (Sat or Sun)
      const dayOfWeek = gameDay.getDay(); // 0=Sun, 6=Sat
      const daysBackToFriday = dayOfWeek === 6 ? 1 : dayOfWeek === 0 ? 2 : (dayOfWeek - 5 + 7) % 7;
      
      const fri = new Date(gameDay);
      fri.setDate(fri.getDate() - daysBackToFriday);
      fri.setHours(23, 59, 0, 0); // Friday 11:59 PM
      
      const mon = new Date(gameDay);
      mon.setDate(mon.getDate() + (gameDay.getDay() === 0 ? 1 : 2)); // Monday after
      mon.setHours(0, 1, 0, 0); // Monday 12:01 AM
      
      return { start: fri, end: mon };
    });

    // Check if current time falls within ANY game weekend
    const isGameWeekend = gameWeekends.some(weekend => 
      pstTime >= weekend.start && pstTime <= weekend.end
    );

    if (isGameWeekend) {
      return false;
    }
    
    // All other times during playoff season are allowed (including bye weekends!)
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
      alert(`Invalid player code!\n\nThis code is not recognized in Firebase OR App.jsx.\n\nMake sure you:\n1. Paid your $${prizePool?.entryFee || '??'} entry fee\n2. Received your code from the pool manager\n3. Entered the code correctly\n\nContact: gammoneer2b@gmail.com`);
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
          alert(`Welcome back, ${playerNameForCode}!\n\n🔒 WARNING: This week is LOCKED!\n\nYour existing picks for ${dynamicPlayoffWeeks[currentWeek].name} will be loaded, but you cannot edit them because the games have been played.\n\nYou can only view your submitted picks.`);
        } else {
          alert(`Welcome back, ${playerNameForCode}!\n\nYour existing picks for ${dynamicPlayoffWeeks[currentWeek].name} will be loaded automatically.\n\nYou can edit and resubmit anytime except during playoff weekends (Friday 11:59 PM - Monday 12:01 AM PST).`);
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
    
    // NEW - Save session to localStorage so F5 refresh doesn't logout
    localStorage.setItem('session_playerCode', code);
    localStorage.setItem('session_playerName', playerNameForCode);
    console.log('💾 Session saved to localStorage');
  };
// Download picks as CSV spreadsheet - COMPLETE VERSION (Pool Manager Only - ALL PLAYERS)
const downloadCompletePicksAsCSV = () => {
  const weekPicks = allPicksAPPTV.filter(pick => pick.week === currentWeek);
  const currentWeekData = dynamicPlayoffWeeks[currentWeek];

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
  csv += 'Correct Picks,Submitted At\n';

  // NEW: Create array of players from Firebase allPlayers (paid + visible + not manager)
  // This ensures only registered/paid players appear, not ALL potential players from PLAYER_CODES
  const allPlayersList = (() => {
    // For Pool Manager "Complete" view: include all paid+visible regular players
    const registeredPlayers = allPlayers
      .filter(player => {
        const isPaid = player.paid === true || player.paymentStatus === 'PAID';
        const isVisible = player.visible !== false;
        const isRegularPlayer = player.role !== 'MANAGER';
        return isPaid && isVisible && isRegularPlayer;
      })
      .map(player => {
        const existingPick = weekPicks.find(p => p.playerCode === player.playerCode);
        return {
          playerName: player.playerName,
          playerCode: player.playerCode,
          predictions: existingPick?.predictions || {},
          timestamp: existingPick?.timestamp || null,
          lastUpdated: existingPick?.lastUpdated || null
        };
      });
    // Also include any picks that exist in Firebase but player isn't in allPlayers yet
    // (catches edge case where pick was submitted before player record was created)
    weekPicks.forEach(pick => {
      if (!registeredPlayers.find(p => p.playerCode === pick.playerCode)) {
        // Only add if not a pool manager
        if (!POOL_MANAGER_CODES.includes(pick.playerCode)) {
          registeredPlayers.push({
            playerName: pick.playerName,
            playerCode: pick.playerCode,
            predictions: pick.predictions || {},
            timestamp: pick.timestamp || null,
            lastUpdated: pick.lastUpdated || null
          });
        }
      }
    });
    return registeredPlayers;
  })();

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
        // Calculate each week's total (use allPicksAPPTV — the Pool #1 complete data source)
        const week4Total = (() => {
          const w4Pick = allPicksAPPTV.find(p => p.playerCode === pick.playerCode && p.week === 'superbowl');
          if (!w4Pick) return '--';
          let sum = 0;
          PLAYOFF_WEEKS.superbowl.games.forEach(game => {
            const pred = w4Pick.predictions[game.id];
            if (pred) sum += (Number(pred.team1) || 0) + (Number(pred.team2) || 0);
          });
          return sum > 0 ? sum : '--';
        })();

        const week3Total = (() => {
          const w3Pick = allPicksAPPTV.find(p => p.playerCode === pick.playerCode && p.week === 'conference');
          if (!w3Pick) return '--';
          let sum = 0;
          PLAYOFF_WEEKS.conference.games.forEach(game => {
            const pred = w3Pick.predictions[game.id];
            if (pred) sum += (Number(pred.team1) || 0) + (Number(pred.team2) || 0);
          });
          return sum > 0 ? sum : '--';
        })();

        const week2Total = (() => {
          const w2Pick = allPicksAPPTV.find(p => p.playerCode === pick.playerCode && p.week === 'divisional');
          if (!w2Pick) return '--';
          let sum = 0;
          PLAYOFF_WEEKS.divisional.games.forEach(game => {
            const pred = w2Pick.predictions[game.id];
            if (pred) sum += (Number(pred.team1) || 0) + (Number(pred.team2) || 0);
          });
          return sum > 0 ? sum : '--';
        })();

        const week1Total = (() => {
          const w1Pick = allPicksAPPTV.find(p => p.playerCode === pick.playerCode && p.week === 'wildcard');
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

  // Download the CSV (BOM prefix ensures Excel reads UTF-8 correctly)
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
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
  const currentWeekData = dynamicPlayoffWeeks[currentWeek];

  // Use the correct picks array based on which pool table is active
  const activePicksArray = currentTableView === 'apptb' ? allPicksAPPTB : allPicksAPPTV;

  // ===== Get the SAME players shown in the visible table (with picks AND dashes) =====
  const displayPicks = (() => {
    if (currentWeek === 'superbowl') {
      // For Super Bowl, show ALL unique players
      const uniquePlayers = new Map();
      activePicksArray.forEach(pick => {
        if (!uniquePlayers.has(pick.playerCode)) {
          const superbowlPick = activePicksArray.find(p => p.playerCode === pick.playerCode && p.week === 'superbowl');
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
      const picksForWeek = activePicksArray.filter(pick => pick.week === currentWeek);
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
          const w4Pick = activePicksArray.find(p => p.playerCode === pick.playerCode && p.week === 'superbowl');
          if (!w4Pick) return '-';
          let sum = 0;
          PLAYOFF_WEEKS.superbowl.games.forEach(game => {
            const pred = w4Pick.predictions[game.id];
            if (pred) sum += (Number(pred.team1) || 0) + (Number(pred.team2) || 0);
          });
          return sum > 0 ? sum : '-';
        })();

        const week3Total = (() => {
          const w3Pick = activePicksArray.find(p => p.playerCode === pick.playerCode && p.week === 'conference');
          if (!w3Pick) return '-';
          let sum = 0;
          PLAYOFF_WEEKS.conference.games.forEach(game => {
            const pred = w3Pick.predictions[game.id];
            if (pred) sum += (Number(pred.team1) || 0) + (Number(pred.team2) || 0);
          });
          return sum > 0 ? sum : '-';
        })();

        const week2Total = (() => {
          const w2Pick = activePicksArray.find(p => p.playerCode === pick.playerCode && p.week === 'divisional');
          if (!w2Pick) return '-';
          let sum = 0;
          PLAYOFF_WEEKS.divisional.games.forEach(game => {
            const pred = w2Pick.predictions[game.id];
            if (pred) sum += (Number(pred.team1) || 0) + (Number(pred.team2) || 0);
          });
          return sum > 0 ? sum : '-';
        })();

        const week1Total = (() => {
          const w1Pick = activePicksArray.find(p => p.playerCode === pick.playerCode && p.week === 'wildcard');
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

  // Download (BOM prefix ensures Excel reads UTF-8 correctly)
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `nfl_playoff_picks_${currentWeek}_${Date.now()}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// ============================================================
// Download Pool #3 (Winner / ATS / O-U) picks as CSV
// Available to all players for the current week; PM gets all weeks
// ============================================================
const downloadPool3CSV = () => {
  const allWeeks = ['wildcard', 'divisional', 'conference', 'superbowl'];
  const weekLabels = {
    wildcard: 'Wild Card Round',
    divisional: 'Divisional Round',
    conference: 'Conference Championships',
    superbowl: 'Super Bowl LXI'
  };

  // Pool Manager: export every week that has picks; Regular player: current week only
  const weeksToExport = isPoolManager()
    ? allWeeks.filter(wk => allPicksPool3.some(p => p.week === wk))
    : [currentWeek];

  let csv = `NFL PLAYOFF POOL 2026/2027 - POOL #3 WINNER / ATS / O-U PICKS\n`;
  csv += `Downloaded: ${new Date().toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}\n\n`;

  weeksToExport.forEach(wk => {
    const wkData = dynamicPlayoffWeeks[wk];
    const weekLines = bettingLines?.[wk] || {};
    const games = wkData.games;
    const weekPicks = allPicksPool3.filter(p => p.week === wk);

    // ── Section header ──────────────────────────────────────────
    csv += `\n===== ${weekLabels[wk]} — ${wkData.name} =====\n`;
    csv += `Deadline: ${wkData.deadline}\n\n`;

    // ── Betting lines reference rows ────────────────────────────
    csv += `GAME #,Team 1 (Away),Team 2 (Home),Favourite,Spread,O/U Total,Actual Score Team1,Actual Score Team2,Game Status\n`;
    games.forEach(game => {
      const t1 = getTeamName(wk, game.id, 'team1', playoffTeams);
      const t2 = getTeamName(wk, game.id, 'team2', playoffTeams);
      const line = weekLines[game.id] || {};
      const actual = actualScores[wk]?.[game.id] || {};
      const status = gameStatus[wk]?.[game.id] || '-';
      const statusText = status === 'final' ? 'FINAL' : status === 'live' ? 'LIVE' : '-';
      csv += `Game ${game.id},"${t1}","${t2}","${line.favourite || '-'}","${line.spread ? '-' + line.spread : '-'}","${line.overUnder || '-'}","${actual.team1 || '-'}","${actual.team2 || '-'}","${statusText}"\n`;
    });

    csv += `\n`;

    // ── Column headers for picks ────────────────────────────────
    // Per-game columns: Winner Pick | ATS Pick | O/U Pick | W pts | ATS pts | OU pts
    let headerRow1 = `Player Name,`;
    let headerRow2 = `Player Name,`;
    games.forEach((game, gi) => {
      const t1 = getTeamName(wk, game.id, 'team1', playoffTeams);
      const t2 = getTeamName(wk, game.id, 'team2', playoffTeams);
      const line = weekLines[game.id] || {};
      const sep = gi > 0 ? '' : '';
      headerRow1 += `Game ${game.id} (${t1} @ ${t2}),,,,,,`;
      headerRow2 += `Winner Pick,ATS Pick,O/U Pick,Winner Pts,ATS Pts,O/U Pts,`;
    });
    headerRow1 += `Week Total Pts,Season Total Pts,Submitted At\n`;
    headerRow2 += `Week Total Pts,Season Total Pts,Submitted At\n`;
    csv += headerRow1 + headerRow2;

    // ── Build player list ───────────────────────────────────────
    // Use Firebase allPlayers filtered to paid + visible + regular players only
    const registeredForPool3 = allPlayers
      .filter(player => {
        const isPaid = player.paid === true || player.paymentStatus === 'PAID';
        const isVisible = player.visible !== false;
        const isRegularPlayer = player.role !== 'MANAGER';
        return isPaid && isVisible && isRegularPlayer;
      })
      .map(player => {
        const pick = weekPicks.find(p => p.playerCode === player.playerCode);
        return { playerName: player.playerName, playerCode: player.playerCode, pick };
      });
    // Also catch any picks submitted by players not yet in allPlayers registry
    weekPicks.forEach(pick => {
      if (!registeredForPool3.find(p => p.playerCode === pick.playerCode) && !POOL_MANAGER_CODES.includes(pick.playerCode)) {
        registeredForPool3.push({ playerName: pick.playerName, playerCode: pick.playerCode, pick });
      }
    });
    const playerList = registeredForPool3
      .sort((a, b) => {
        const aHas = !!a.pick?.picks && Object.keys(a.pick.picks).length > 0;
        const bHas = !!b.pick?.picks && Object.keys(b.pick.picks).length > 0;
        if (aHas && !bHas) return -1;
        if (!aHas && bHas) return 1;
        if (aHas && bHas) {
          return (b.pick.lastUpdated || b.pick.timestamp || 0) - (a.pick.lastUpdated || a.pick.timestamp || 0);
        }
        return a.playerName.localeCompare(b.playerName);
      });

    playerList.forEach(({ playerName, playerCode, pick }) => {
      const hasPicks = pick?.picks && Object.keys(pick.picks).length > 0;
      csv += `"${playerName}",`;

      let weekTotal = 0;
      let weekGraded = false;

      games.forEach(game => {
        const p = pick?.picks?.[game.id] || {};
        const line = weekLines[game.id] || {};
        const actual = actualScores[wk]?.[game.id] || {};

        const winnerPick = p.winner || '--';
        const atsPick = p.ats || '--';
        const ouPick = p.ou || '--';

        // Grade if actuals exist
        let wPts = '', aPts = '', oPts = '';
        if (actual.team1 && actual.team2 && line.favourite && line.spread && line.overUnder) {
          const t1 = parseInt(actual.team1), t2 = parseInt(actual.team2);
          const awayName = getTeamName(wk, game.id, 'team1', playoffTeams);
          const homeName = getTeamName(wk, game.id, 'team2', playoffTeams);
          const fav = line.favourite;
          const spread = parseFloat(line.spread);
          const ou = parseFloat(line.overUnder);

          // Override or auto
          const favMatch = (n, f) => n === f || (n||'').includes(f) || (f||'').includes(n);
          const favIsAway = favMatch(awayName, fav);
          const favScore = favIsAway ? t1 : t2;
          const dogScore = favIsAway ? t2 : t1;
          const favMargin = favScore - dogScore;
          const autoAts = favMargin > spread ? 'favourite' : 'underdog';
          const atsResult = gradingOverrides?.[wk]?.[game.id]?.ats || autoAts;
          const autoOu = (t1 + t2) > ou ? 'over' : 'under';
          const ouResult = gradingOverrides?.[wk]?.[game.id]?.ou || autoOu;
          const actualWinner = t1 > t2 ? awayName : homeName;

          if (hasPicks && p.winner) {
            const winnerCorrect = p.winner === actualWinner;
            const atsCorrect = p.ats === fav ? atsResult === 'favourite' : atsResult === 'underdog';
            const ouCorrect = p.ou === ouResult;
            wPts = winnerCorrect ? 2 : 0;
            aPts = atsCorrect ? 3 : 0;
            oPts = ouCorrect ? 3 : 0;
            weekTotal += wPts + aPts + oPts;
            weekGraded = true;
          }
        }

        csv += `"${winnerPick}","${atsPick}","${ouPick}",${wPts !== '' ? wPts : '--'},${aPts !== '' ? aPts : '--'},${oPts !== '' ? oPts : '--'},`;
      });

      // Season total: sum all weeks graded so far for this player
      const seasonTotal = allWeeks.reduce((sum, wkKey) => {
        const pwp = allPicksPool3.find(p => p.playerCode === playerCode && p.week === wkKey);
        if (!pwp) return sum;
        const graded = gradePool34WeekFull(pwp, wkKey, bettingLines, actualScores, gradingOverrides, playoffTeams, getTeamName);
        return sum + (graded.points || 0);
      }, 0);

      const weekTotalDisplay = weekGraded ? weekTotal : (hasPicks ? '--' : 'NO PICKS');
      const seasonTotalDisplay = seasonTotal > 0 ? seasonTotal : '--';

      // Timestamp
      let tsDisplay = '-';
      if (hasPicks && (pick.lastUpdated || pick.timestamp)) {
        tsDisplay = new Date(pick.lastUpdated || pick.timestamp).toLocaleString('en-US', {
          month: '2-digit', day: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
        });
      }

      csv += `${weekTotalDisplay},${seasonTotalDisplay},"${tsDisplay}"\n`;
    });

    csv += `\n`;
  });

  // Download (BOM prefix ensures Excel reads UTF-8 correctly)
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.setAttribute('href', URL.createObjectURL(blob));
  link.setAttribute('download', `nfl_pool3_winner_ats_ou_${currentWeek}_${Date.now()}.csv`);
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

    const currentWeekData = dynamicPlayoffWeeks[currentWeek];

    // ==========================================
    // BOTH TABLES REQUIRED — player must fill both before saving either
    // ==========================================
    const checkTableCompletion = (predictions) => {
      const missing = [];
      const ties = [];
      currentWeekData.games.forEach(game => {
        const t1 = predictions[game.id]?.team1;
        const t2 = predictions[game.id]?.team2;
        if (!t1 || t1.toString().trim() === '' || t1 === '-' ||
            !t2 || t2.toString().trim() === '' || t2 === '-') {
          missing.push(game.id);
          return;
        }
        const t1Num = parseInt(t1);
        const t2Num = parseInt(t2);
        if (t1Num === t2Num) ties.push(game.id);
      });
      return { missing, ties, isComplete: missing.length === 0 && ties.length === 0 };
    };

    const apptvStatus = checkTableCompletion(predictionsAPPTV || {});
    const apptbStatus = checkTableCompletion(predictionsAPPTB || {});

    if (!apptvStatus.isComplete || !apptbStatus.isComplete) {
      setShowPopup('initialIncomplete');
      setInitialValidationData({
        apptvStatus: {
          complete: apptvStatus.isComplete,
          total: currentWeekData.games.length,
          filled: currentWeekData.games.length - apptvStatus.missing.length,
          missing: apptvStatus.missing,
          ties: apptvStatus.ties
        },
        apptbStatus: {
          complete: apptbStatus.isComplete,
          total: currentWeekData.games.length,
          filled: currentWeekData.games.length - apptbStatus.missing.length,
          missing: apptbStatus.missing,
          ties: apptbStatus.ties
        }
      });
      return;
    }
    
    // STEP 5 VALIDATION: Check for incomplete entries (allow dashes)
    const missing = [];
    currentWeekData.games.forEach(game => {
      const t1 = currentPredictions[game.id]?.team1;
      const t2 = currentPredictions[game.id]?.team2;
      const isValid = (val) => val === '-' || (val && val.toString().trim() !== '');
      if (!currentPredictions[game.id] || !isValid(t1) || !isValid(t2)) {
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
      const t1 = currentPredictions[game.id]?.team1;
      const t2 = currentPredictions[game.id]?.team2;
      if (t1 === '-' || t2 === '-') return;
      const t1Num = parseInt(t1);
      const t2Num = parseInt(t2);
      if (isNaN(t1Num) || isNaN(t2Num) || t1Num < 0 || t2Num < 0) invalid.push(game.id);
    });

    if (invalid.length > 0) {
      setInvalidScores(invalid);
      setShowPopup('invalidScores');
      return;
    }
    
    // STEP 5 VALIDATION: Check for tied games
    const tiedGames = [];
    currentWeekData.games.forEach(game => {
      const t1 = currentPredictions[game.id]?.team1;
      const t2 = currentPredictions[game.id]?.team2;
      if (t1 === '-' || t2 === '-') return;
      const t1Num = parseInt(t1);
      const t2Num = parseInt(t2);
      if (t1Num === t2Num) tiedGames.push(game.id);
    });
    
    if (tiedGames.length > 0) {
      setMissingGames(tiedGames);
      setShowPopup('tiedGames');
      return;
    }

    // Check if no changes were made
    if (!hasUnsavedChanges) {
      setShowPopup('noChanges');
      return;
    }

    try {
      // Determine which Firebase path to use based on active table
      const firebasePath = currentTableView === 'apptv' ? 'picks_apptv' : 
                          currentTableView === 'apptb' ? 'picks_apptb' : 
                          'picks'; // fallback
      
      // Use state to find existing pick — avoids broken get() calls
      const stateArray = currentTableView === 'apptv' ? allPicksAPPTV : 
                         currentTableView === 'apptb' ? allPicksAPPTB : allPicks;
      const existingPick = stateArray.find(p => p.playerCode === playerCode && p.week === currentWeek);
      const existingFirebaseKey = existingPick?.firebaseKey || null;

      // ✅ NEW: Clean predictions - convert dashes to empty strings
      const cleanedPredictions = {};
      Object.keys(currentPredictions).forEach(gameId => {
        const pred = currentPredictions[gameId];
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
        predictions: cleanedPredictions, // ✅ Use cleaned predictions
        timestamp: existingPick ? existingPick.timestamp : Date.now(),
        lastUpdated: Date.now()
      };

      // NEW - Write ONLY to the active table's Firebase path
      if (existingFirebaseKey) {
        // Update existing picks in the ACTIVE table only
        await set(ref(database, `${firebasePath}/${existingFirebaseKey}`), pickData);
      } else {
        // Create new picks in the ACTIVE table only
        await push(ref(database, firebasePath), pickData);
      }
      
      console.log('✅✅✅ SUBMIT SUCCESS ✅✅✅');
      
      // NEW - Clear localStorage drafts after successful submission
      localStorage.removeItem(`draft_apptv_${playerCode}_${currentWeek}`);
      localStorage.removeItem(`draft_apptb_${playerCode}_${currentWeek}`);
      console.log('🧹 Cleared localStorage drafts');
      
      setSubmitted(true);
      
      console.log('📦 Creating deep copy of currentPredictions for originalPicks');
      const deepCopy = JSON.parse(JSON.stringify(currentPredictions));
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

  // ============================================================
  // 🟡 SUBMIT VISIBLE PICK (APPTV only) — dual-row entry
  // ============================================================
  // ============================================================
  // 🎯 AUTO-SAVE POOL #3/#4 FROM POOL #1/#2 PREDICTIONS
  // Triggered silently after every successful Pool #1/#2 submit
  // Skips a pool if the player has manually edited it
  // ============================================================
  const autoSavePool34 = async (sourcePool, savedPredictions, weekKey) => {
    if (!pool34Enabled) return;                           // Kill switch off — do nothing
    const weekLines = bettingLines?.[weekKey] || {};
    if (!Object.keys(weekLines).length) return;           // No lines entered yet — do nothing

    const weekGames = dynamicPlayoffWeeks[weekKey]?.games || [];
    if (!weekGames.length) return;

    const computePicks = (preds) => {
      const picks = {};
      weekGames.forEach(game => {
        const gidStr = String(game.id);
        const pred = preds?.[gidStr] || preds?.[game.id];
        const line = weekLines?.[gidStr] || weekLines?.[game.id];
        if (!pred || !line || !line.favourite || !line.spread || !line.overUnder) return;
        const t1 = parseInt(pred.team1);
        const t2 = parseInt(pred.team2);
        if (isNaN(t1) || isNaN(t2)) return;
        const awayRaw = getTeamName(weekKey, game.id, 'team1', playoffTeams);
        const homeRaw = getTeamName(weekKey, game.id, 'team2', playoffTeams);
        const awayName = (awayRaw && awayRaw !== 'TBD' && !awayRaw.startsWith('AFC') && !awayRaw.startsWith('NFC')) ? awayRaw : `Away_${game.id}`;
        const homeName = (homeRaw && homeRaw !== 'TBD' && !homeRaw.startsWith('AFC') && !homeRaw.startsWith('NFC')) ? homeRaw : `Home_${game.id}`;
        const winner = t1 > t2 ? awayName : homeName;
        const favMatch = (name, fav) => name === fav || name.includes(fav) || fav.includes(name);
        const favIsAway = favMatch(awayName, line.favourite);
        const favMargin = favIsAway ? (t1 - t2) : (t2 - t1);
        const underdog = favIsAway ? homeName : awayName;
        const ats = favMargin > parseFloat(line.spread) ? line.favourite : underdog;
        const ou = (t1 + t2) > parseFloat(line.overUnder) ? 'over' : 'under';
        picks[game.id] = { winner, ats, ou };
      });
      return picks;
    };

    try {
      // Pool #3 auto-save — uses Pool #1 (APPTV) predictions
      if (sourcePool === 'apptv' && !pool3ManuallyEdited) {
        const existing3 = allPicksPool3.find(p => p.playerCode === playerCode && p.week === weekKey);
        // Never overwrite if player manually edited Pool #3 (autoFilled absent or false)
        if (existing3 && existing3.autoFilled !== true) {
          console.log('⏭️ Pool #3 auto-save skipped — player has manually edited picks');
        } else {
          const picks = computePicks(savedPredictions);
          if (!Object.keys(picks).length) return;
          const pickData3 = {
            playerName, playerCode, week: weekKey, picks,
            timestamp: existing3 ? existing3.timestamp : Date.now(),
            lastUpdated: Date.now(),
            autoFilled: true
          };
          if (existing3?.firebaseKey) {
            await set(ref(database, `picks_pool3/${existing3.firebaseKey}`), pickData3);
          } else {
            await push(ref(database, 'picks_pool3'), pickData3);
          }
          setPredictionsPool3(picks);
          console.log('✅ Pool #3 auto-saved from Pool #1 picks');
        }
      }

      if (sourcePool === 'apptb') {
        const existing3 = allPicksPool3.find(p => p.playerCode === playerCode && p.week === weekKey);
        if (existing3) { console.log('⏭️ Pool #3 auto-save skipped — already has picks'); return null; }
        const picks = computePicks(savedPredictions);
        if (!Object.keys(picks).length) return null;
        await push(ref(database, 'picks_pool3'), { playerName, playerCode, week: weekKey, picks, timestamp: Date.now(), lastUpdated: Date.now(), autoFilled: true });
        setPredictionsPool3(picks);
        return '✅ Pool #3 has been auto-filled from your Pool #2 picks';
      }
      // Pool #4 removed
    } catch (err) {
      console.warn('⚠️ Pool #3 auto-save failed (silent):', err.message);
      // Never alert — auto-save is silent background operation
    }
  };

  const handleExportToPool3 = (sourcePool) => {
    if (!pool34Enabled) {
      alert('Pool #3 is currently disabled by the Pool Manager.');
      return;
    }
    const firebaseRecord = sourcePool === 'apptv'
      ? allPicksAPPTV.find(p => p.playerCode === playerCode && p.week === currentWeek)
      : allPicksAPPTB.find(p => p.playerCode === playerCode && p.week === currentWeek);
    const sourceLabel = sourcePool === 'apptv' ? 'Pool #1 (Visible)' : 'Pool #2 (Blind)';
    if (!firebaseRecord || !firebaseRecord.predictions) {
      alert('\u26a0\ufe0f Cannot export to Pool #3 yet.\n\n' + sourceLabel + ' has not been saved yet.\n\nPlease save & submit both Pool #1 and Pool #2 first, then export.');
      return;
    }
    const otherLabel = sourcePool === 'apptv' ? 'Pool #2 (Blind)' : 'Pool #1 (Visible)';
    const otherRecord = sourcePool === 'apptv'
      ? allPicksAPPTB.find(p => p.playerCode === playerCode && p.week === currentWeek)
      : allPicksAPPTV.find(p => p.playerCode === playerCode && p.week === currentWeek);
    if (!otherRecord || !otherRecord.predictions) {
      alert('\u26a0\ufe0f Cannot export to Pool #3 yet.\n\n' + otherLabel + ' has not been saved yet.\n\nPlease save & submit both Pool #1 and Pool #2 first, then export.');
      return;
    }
    const sourcePreds = firebaseRecord.predictions;
    const wkLines = bettingLines?.[currentWeek] || {};
    if (!Object.keys(wkLines).length) {
      alert('Betting lines not yet entered. Ask the Pool Manager.');
      return;
    }
    const games = currentWeekData.games;
    const newPicks = {};
    const skipped = [];
    games.forEach(game => {
      const pred = sourcePreds[game.id] || sourcePreds[String(game.id)];
      const line = wkLines[game.id] || wkLines[String(game.id)];
      if (!pred || !line || !line.favourite || !line.spread || !line.overUnder) {
        skipped.push(game.id);
        return;
      }
      const t1 = parseInt(pred.team1);
      const t2 = parseInt(pred.team2);
      if (isNaN(t1) || isNaN(t2)) { skipped.push(game.id); return; }
      const away = getTeamName(currentWeek, game.id, 'team1', playoffTeams);
      const home = getTeamName(currentWeek, game.id, 'team2', playoffTeams);
      const winner = t1 > t2 ? away : home;
      const fm = (n, f) => !!n && !!f && (n === f || n.includes(f) || f.includes(n));
      const favIsAway = fm(away, line.favourite);
      const margin = favIsAway ? (t1 - t2) : (t2 - t1);
      const underdog = favIsAway ? home : away;
      const ats = margin > parseFloat(line.spread) ? line.favourite : underdog;
      const ou = (t1 + t2) > parseFloat(line.overUnder) ? 'over' : 'under';
      newPicks[game.id] = { winner, ats, ou };
    });
    if (!Object.keys(newPicks).length) {
      alert('No picks could be calculated. Check that scores are saved and betting lines are entered.');
      return;
    }
    const skipMsg = skipped.length ? ('\n\n' + skipped.length + ' game(s) skipped — missing scores or betting lines.') : '';
    if (!window.confirm('Export ' + sourceLabel + ' \u2192 Pool #3?\n\n' + Object.keys(newPicks).length + ' games calculated.' + skipMsg + '\n\nThis will overwrite any existing Pool #3 picks.\n\nContinue?')) return;
    if (Object.keys(predictionsPool3 || {}).length > 0) {
      setPool3CancelSnapshot(JSON.parse(JSON.stringify(predictionsPool3)));
    }
    setPredictionsPool3(newPicks);
    setPool3Dirty(true);
    setPool3ManuallyEdited(false);
    setCurrentView('pool34Picks');
  };

  const handleSubmitAPPTV = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (isWeekLocked(currentWeek)) { alert('🔒 WEEK LOCKED\n\nThis week\'s games have been played. Picks are permanently locked.'); return; }
    if (!isSubmissionAllowed()) { alert('⛔ SUBMISSIONS CLOSED\n\nPicks are locked Friday 11:59 PM – Monday 12:01 AM PST.'); return; }

    const weekData = dynamicPlayoffWeeks[currentWeek];
    const hasExistingAPPTV = allPicksAPPTV.some(p => p.playerCode === playerCode && p.week === currentWeek);
    const hasExistingAPPTB = allPicksAPPTB.some(p => p.playerCode === playerCode && p.week === currentWeek);
    const isInitialSubmission = !hasExistingAPPTV && !hasExistingAPPTB;

    // Helper to check a predictions object for missing/tied games
    const checkPreds = (preds) => {
      const missing = [], ties = [];
      weekData.games.forEach(game => {
        const t1 = preds[game.id]?.team1, t2 = preds[game.id]?.team2;
        if (!t1 || t1 === '' || t1 === '-' || !t2 || t2 === '' || t2 === '-') { missing.push(game.id); return; }
        if (parseInt(t1) === parseInt(t2)) ties.push(game.id);
      });
      return { missing, ties, isComplete: missing.length === 0 && ties.length === 0 };
    };

    const apptvStatus = checkPreds(predictionsAPPTV || {});
    const apptbStatus = checkPreds(predictionsAPPTB || {});

    // ON INITIAL SUBMISSION — BOTH tables must be complete before saving either
    if (isInitialSubmission && (!apptvStatus.isComplete || !apptbStatus.isComplete)) {
      setInitialValidationData({
        apptvStatus: { complete: apptvStatus.isComplete, total: weekData.games.length, filled: weekData.games.length - apptvStatus.missing.length, missing: apptvStatus.missing, ties: apptvStatus.ties },
        apptbStatus: { complete: apptbStatus.isComplete, total: weekData.games.length, filled: weekData.games.length - apptbStatus.missing.length, missing: apptbStatus.missing, ties: apptbStatus.ties }
      });
      setShowPopup('initialIncomplete');
      return;
    }

    // EDITING — only validate the Visible table itself
    if (!apptvStatus.isComplete) {
      if (apptvStatus.ties.length > 0) { setMissingGames(apptvStatus.ties); setShowPopup('tiedGames'); return; }
      setMissingGames(apptvStatus.missing); setShowPopup('incomplete'); return;
    }
    if (apptvStatus.ties.length > 0) { setMissingGames(apptvStatus.ties); setShowPopup('tiedGames'); return; }

    if (!visiblePicksDirty && hasExistingAPPTV) { setShowPopup('noChanges'); return; }

    try {
      const existingPick = allPicksAPPTV.find(p => p.playerCode === playerCode && p.week === currentWeek);
      const cleanedPredictions = {};
      weekData.games.forEach(game => { const pred = predictionsAPPTV[game.id]; if (pred) cleanedPredictions[game.id] = { team1: pred.team1 === '-' ? '' : pred.team1, team2: pred.team2 === '-' ? '' : pred.team2 }; });
      const pickData = { playerName, playerCode, week: currentWeek, predictions: cleanedPredictions, timestamp: existingPick ? existingPick.timestamp : Date.now(), lastUpdated: Date.now() };
      if (existingPick?.firebaseKey) { await set(ref(database, `picks_apptv/${existingPick.firebaseKey}`), pickData); } else { await push(ref(database, 'picks_apptv'), pickData); }
      localStorage.removeItem(`draft_apptv_${playerCode}_${currentWeek}`);
      setVisiblePicksDirty(false);
      setVisibleCancelSnapshot(null);
      setHasUnsavedChanges(false);
      setSubmitted(true);
      // 🎯 Auto-save Pool #3 from these picks (silent — skips if player manually edited Pool #3)
      await autoSavePool34('apptv', cleanedPredictions, currentWeek);
      // After save — check if BOTH Pool #1/#2 are now saved and Pool #3 prompt needed
      const nowHasAPPTB = allPicksAPPTB.some(p => p.playerCode === playerCode && p.week === currentWeek);
      const nowHasPool3 = allPicksPool3.some(p => p.playerCode === playerCode && p.week === currentWeek && Object.keys(p.picks||{}).length > 0);
      if (nowHasAPPTB && !nowHasPool3) {
        setShowPool34Prompt(true);
      } else if (nowHasAPPTB) {
        setShowPool34Prompt(true); // Always show after initial complete submission
      } else {
        setShowPopup('success');
      }
    } catch (error) { console.error('Error submitting Visible picks:', error); alert('Error submitting Visible picks. Please try again.'); }
  };

  // ============================================================
  // 🔵 SUBMIT BLIND PICK (APPTB only) — dual-row entry
  // ============================================================
  const handleSubmitAPPTB = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (isWeekLocked(currentWeek)) { alert('🔒 WEEK LOCKED\n\nThis week\'s games have been played. Picks are permanently locked.'); return; }
    if (!isSubmissionAllowed()) { alert('⛔ SUBMISSIONS CLOSED\n\nPicks are locked Friday 11:59 PM – Monday 12:01 AM PST.'); return; }

    const weekData = dynamicPlayoffWeeks[currentWeek];
    const hasExistingAPPTV = allPicksAPPTV.some(p => p.playerCode === playerCode && p.week === currentWeek);
    const hasExistingAPPTB = allPicksAPPTB.some(p => p.playerCode === playerCode && p.week === currentWeek);
    const isInitialSubmission = !hasExistingAPPTV && !hasExistingAPPTB;

    const checkPreds = (preds) => {
      const missing = [], ties = [];
      weekData.games.forEach(game => {
        const t1 = preds[game.id]?.team1, t2 = preds[game.id]?.team2;
        if (!t1 || t1 === '' || t1 === '-' || !t2 || t2 === '' || t2 === '-') { missing.push(game.id); return; }
        if (parseInt(t1) === parseInt(t2)) ties.push(game.id);
      });
      return { missing, ties, isComplete: missing.length === 0 && ties.length === 0 };
    };

    const apptvStatus = checkPreds(predictionsAPPTV || {});
    const apptbStatus = checkPreds(predictionsAPPTB || {});

    // ON INITIAL SUBMISSION — BOTH tables must be complete before saving either
    if (isInitialSubmission && (!apptvStatus.isComplete || !apptbStatus.isComplete)) {
      setInitialValidationData({
        apptvStatus: { complete: apptvStatus.isComplete, total: weekData.games.length, filled: weekData.games.length - apptvStatus.missing.length, missing: apptvStatus.missing, ties: apptvStatus.ties },
        apptbStatus: { complete: apptbStatus.isComplete, total: weekData.games.length, filled: weekData.games.length - apptbStatus.missing.length, missing: apptbStatus.missing, ties: apptbStatus.ties }
      });
      setShowPopup('initialIncomplete');
      return;
    }

    // EDITING — only validate the Blind table itself
    if (!apptbStatus.isComplete) {
      if (apptbStatus.ties.length > 0) { setMissingGames(apptbStatus.ties); setShowPopup('tiedGames'); return; }
      setMissingGames(apptbStatus.missing); setShowPopup('incomplete'); return;
    }
    if (apptbStatus.ties.length > 0) { setMissingGames(apptbStatus.ties); setShowPopup('tiedGames'); return; }

    if (!blindPicksDirty && hasExistingAPPTB) { setShowPopup('noChanges'); return; }

    try {
      const existingPick = allPicksAPPTB.find(p => p.playerCode === playerCode && p.week === currentWeek);
      const cleanedPredictions = {};
      weekData.games.forEach(game => { const pred = predictionsAPPTB[game.id]; if (pred) cleanedPredictions[game.id] = { team1: pred.team1 === '-' ? '' : pred.team1, team2: pred.team2 === '-' ? '' : pred.team2 }; });
      const pickData = { playerName, playerCode, week: currentWeek, predictions: cleanedPredictions, timestamp: existingPick ? existingPick.timestamp : Date.now(), lastUpdated: Date.now() };
      if (existingPick?.firebaseKey) { await set(ref(database, `picks_apptb/${existingPick.firebaseKey}`), pickData); } else { await push(ref(database, 'picks_apptb'), pickData); }
      localStorage.removeItem(`draft_apptb_${playerCode}_${currentWeek}`);
      setBlindPicksDirty(false);
      setBlindPicksSavedOnce(true);
      setBlindCancelSnapshot(null);
      setHasUnsavedChanges(false);
      setSubmitted(true);
      const pool3AutoMsg = await autoSavePool34('apptb', cleanedPredictions, currentWeek);
      const nowHasAPPTV = allPicksAPPTV.some(p => p.playerCode === playerCode && p.week === currentWeek);
      if (pool3AutoMsg) {
        alert('✅ Pool #2 picks saved!\n\n' + pool3AutoMsg + '\n\nYou can review and edit your Pool #3 picks any time before the Friday deadline.');
      } else if (nowHasAPPTV) {
        setShowPool34Prompt(true);
      } else {
        setShowPopup('success');
      }
    } catch (error) { console.error('Error submitting Blind picks:', error); alert('Error submitting Blind picks. Please try again.'); }
  };

  const currentWeekData = dynamicPlayoffWeeks[currentWeek];

  // NEW - Select which picks data to display based on current table view
  const currentPicksData = useMemo(() => {
    if (currentTableView === 'apptv') return allPicksAPPTV;
    if (currentTableView === 'apptb') return allPicksAPPTB;
    
    // Combined view: Merge both tables with (V) and (B) suffixes
    // Combined view removed — use filter buttons instead
    
    return allPicks; // Fallback
  }, [currentTableView, allPicksAPPTV, allPicksAPPTB, allPicks]);

  // Filter for the All Players Picks Table only — fully independent of currentTableView
  const filteredPicksForTable = useMemo(() => {
    // Tag each pick with its source pool so shouldLockScore can detect APPTB rows
    // even when both pools are combined in 'all' view
    // Filter out Pool Manager codes — they should never appear in the picks table
    const taggedAPPTV = allPicksAPPTV
      .filter(p => !POOL_MANAGER_CODES.includes(p.playerCode) && !p.intentionalWipe)
      .map(p => ({ ...p, _sourcePool: 'apptv' }));
    const taggedAPPTB = allPicksAPPTB
      .filter(p => !POOL_MANAGER_CODES.includes(p.playerCode) && !p.intentionalWipe)
      .map(p => ({ ...p, _sourcePool: 'apptb' }));
    if (allPlayersFilter === 'apptv') return taggedAPPTV;
    if (allPlayersFilter === 'apptb') return taggedAPPTB;
    return [...taggedAPPTV, ...taggedAPPTB]; // 'all' = both pools
  }, [allPlayersFilter, allPicksAPPTV, allPicksAPPTB]);

  // NEW - Select which predictions to use for input based on current table view
  const currentPredictions = currentTableView === 'apptv' ? predictionsAPPTV : 
                            currentTableView === 'apptb' ? predictionsAPPTB : 
                            predictions; // fallback

  const setCurrentPredictions = (newPredictions) => {
    if (currentTableView === 'apptv') {
      setPredictionsAPPTV(newPredictions);
    } else if (currentTableView === 'apptb') {
      setPredictionsAPPTB(newPredictions);
    } else {
      setPredictions(newPredictions);
    }
  };

// Calculate all player totals BEFORE rendering (pre-calculation)
const playerTotals = useMemo(() => {
  const totals = {};
  
  const weekPicks = currentWeek === 'superbowl'
    ? (() => {
        const uniquePlayers = new Map();
        currentPicksData.forEach(pick => {
          if (!uniquePlayers.has(pick.playerName)) {
            uniquePlayers.set(pick.playerName, {
              playerName: pick.playerName,
              playerCode: pick.playerCode,
              week: currentWeek,
              predictions: currentPicksData.find(p => p.playerCode === pick.playerCode && p.week === 'superbowl')?.predictions || {}
            });
          }
        });
        return Array.from(uniquePlayers.values());
      })()
    : currentPicksData.filter(pick => pick.week === currentWeek);
  
  weekPicks.forEach(pick => {
    // Key by playerCode + tableSource to handle combined view where playerName has (V)/(B) appended
    const tableSource = pick.tableSource || (currentTableView === 'apptv' ? 'apptv' : currentTableView === 'apptb' ? 'apptb' : 'apptv');
    const totalsKey = `${pick.playerCode}_${tableSource}`;
    if (!totals[totalsKey]) {
      totals[totalsKey] = { week4: 0, week3: 0, week2: 0, week1: 0, grand: 0, current: 0 };
    }
    // Keep playerName key as fallback for any legacy lookups
    if (!totals[pick.playerName]) {
      totals[pick.playerName] = totals[totalsKey];
    }
    
    let currentTotal = 0;
    const weekGames = dynamicPlayoffWeeks[currentWeek].games;
    weekGames.forEach(game => {
      const pred = pick.predictions[game.id];
      if (pred && pred.team1 && pred.team2) {
        currentTotal += (parseInt(pred.team1) || 0) + (parseInt(pred.team2) || 0);
      }
    });
    
    const weekActualScores = actualScores[currentWeek];
    const hasActual = weekActualScores && Object.values(weekActualScores).some(game => {
      return game && 
             game.team1 !== null && game.team1 !== undefined && game.team1 !== '' && game.team1 !== 0 &&
             game.team2 !== null && game.team2 !== undefined && game.team2 !== '' && game.team2 !== 0;
    });
    
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
    
    if (currentWeek === 'superbowl') {
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
}, [currentPicksData, currentWeek, actualScores]);

const calculateAllPrizeWinners = () => {
  console.log('🏆 Starting winner calculations for 20 prizes (APPTV + APPTB)...');
  
  // Helper: Convert picks array to object format
  const convertPicksToObject = (picksArray) => {
    const picksObject = {};
    picksArray.forEach(pick => {
      if (pick.firebaseKey && pick.playerCode && pick.predictions) {
        if (!picksObject[pick.playerCode]) {
          picksObject[pick.playerCode] = {
            name: pick.playerName,
            picks: {}
          };
        }
        
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
        
        picksObject[pick.playerCode].picks[pick.week] = predictionsObj;
      }
    });
    return picksObject;
  };
  
  // STEP 1: Convert allPicks (APPTV) to object format
  const apptvPicksObject = convertPicksToObject(allPicksAPPTV.length > 0 ? allPicksAPPTV : allPicks);
  
  // STEP 2: Convert allPicksAPPTB to object format
  const apptbPicksObject = convertPicksToObject(allPicksAPPTB.length > 0 ? allPicksAPPTB : allPicks);
  
  // Debug logging
  if (allPicksAPPTV.length === 0) {
    console.warn('⚠️ allPicksAPPTV is empty - using allPicks fallback for APPTV prizes');
  }
  if (allPicksAPPTB.length === 0) {
    console.warn('⚠️ allPicksAPPTB is empty - using allPicks fallback for APPTB prizes');
  }
  
  // STEP 3: Convert actualScores to ensure string keys
  const actualScoresObj = {};
  Object.keys(actualScores).forEach(week => {
    if (actualScores[week]) {
      const weekObj = {};
      Object.keys(actualScores[week]).forEach(gameId => {
        weekObj[gameId.toString()] = actualScores[week][gameId];
      });
      actualScoresObj[week] = weekObj;
    }
  });
  
  console.log('📊 APPTV picks:', Object.keys(apptvPicksObject).length, 'players');
  console.log('📊 APPTB picks:', Object.keys(apptbPicksObject).length, 'players');
  console.log('📊 Converted scores:', Object.keys(actualScoresObj));

  // Build lockDates for Wednesday tiebreaker calculations (APPTB only)
  const autoLockDatesForCalc = playoffDates?.autoLockDates || AUTO_LOCK_DATES_FALLBACK;
  const lockDates = {
    wildcard:   autoLockDatesForCalc.wildcard   || null,
    divisional: autoLockDatesForCalc.divisional || null,
    conference: autoLockDatesForCalc.conference || null,
    superbowl:  autoLockDatesForCalc.superbowl  || null
  };
  console.log('📊 Lock dates for Wednesday tiebreaker:', lockDates);
  
  // STEP 4: Run all calculations for BOTH tables
  const results = {
    week1: {
      // APPTV Prizes #1-2
      prize1: calculateWeekPrize1(apptvPicksObject, actualScoresObj, 'wildcard', lockDates),
      prize2: calculateWeekPrize2(apptvPicksObject, actualScoresObj, 'wildcard', lockDates),
      // APPTB Prizes #11-12
      prize3: calculateWeekPrize1APPTB(apptbPicksObject, actualScoresObj, 'wildcard', lockDates),
      prize4: calculateWeekPrize2APPTB(apptbPicksObject, actualScoresObj, 'wildcard', lockDates)
    },
    week2: {
      // APPTV Prizes #3-4
      prize1: calculateWeekPrize1(apptvPicksObject, actualScoresObj, 'divisional', lockDates),
      prize2: calculateWeekPrize2(apptvPicksObject, actualScoresObj, 'divisional', lockDates),
      // APPTB Prizes #13-14
      prize3: calculateWeekPrize1APPTB(apptbPicksObject, actualScoresObj, 'divisional', lockDates),
      prize4: calculateWeekPrize2APPTB(apptbPicksObject, actualScoresObj, 'divisional', lockDates)
    },
    week3: {
      // APPTV Prizes #5-6
      prize1: calculateWeekPrize1(apptvPicksObject, actualScoresObj, 'conference', lockDates),
      prize2: calculateWeekPrize2(apptvPicksObject, actualScoresObj, 'conference', lockDates),
      // APPTB Prizes #15-16
      prize3: calculateWeekPrize1APPTB(apptbPicksObject, actualScoresObj, 'conference', lockDates),
      prize4: calculateWeekPrize2APPTB(apptbPicksObject, actualScoresObj, 'conference', lockDates)
    },
    week4: {
      // APPTV Prizes #7-8
      prize1: calculateWeek4Prize1(apptvPicksObject, actualScoresObj, lockDates),
      prize2: calculateWeek4Prize2(apptvPicksObject, actualScoresObj, lockDates),
      // APPTB Prizes #17-18
      prize3: calculateWeek4Prize1APPTB(apptbPicksObject, actualScoresObj, lockDates),
      prize4: calculateWeek4Prize2APPTB(apptbPicksObject, actualScoresObj, lockDates)
    },
    grandPrize: {
      // APPTV Prizes #9-10
      prize1: calculateGrandPrize1(apptvPicksObject, actualScoresObj, lockDates),
      prize2: calculateGrandPrize2(apptvPicksObject, actualScoresObj, lockDates),
      // APPTB Prizes #19-20
      prize3: calculateGrandPrize1APPTB(apptbPicksObject, actualScoresObj, lockDates),
      prize4: calculateGrandPrize2APPTB(apptbPicksObject, actualScoresObj, lockDates)
    }
  };
  
  console.log('✅ All 20 prize calculations complete!');
  console.log('📊 Results structure:', {
    week1: Object.keys(results.week1),
    week2: Object.keys(results.week2),
    week3: Object.keys(results.week3),
    week4: Object.keys(results.week4),
    grandPrize: Object.keys(results.grandPrize)
  });
  console.log('📊 Sample APPTV prize (week1.prize1):', results.week1.prize1?.winner);
  console.log('📊 Sample APPTB prize (week1.prize3):', results.week1.prize3?.winner);
  
  return results;
};

// Calculate winners whenever picks or scores change
  useEffect(() => {
    console.log('📊 useEffect triggered - checking conditions...');
    console.log('  - allPicks.length:', allPicks.length);
    console.log('  - allPicksAPPTV.length:', allPicksAPPTV.length);
    console.log('  - allPicksAPPTB.length:', allPicksAPPTB.length);
    console.log('  - actualScores:', actualScores);
    console.log('  - actualScores keys:', Object.keys(actualScores || {}));
    
    if ((allPicks.length > 0 || allPicksAPPTV.length > 0 || allPicksAPPTB.length > 0) && actualScores) {
      console.log('✅ Conditions met - calling calculateAllPrizeWinners()');
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
    } else {
      console.warn('❌ Conditions NOT met - skipping calculateAllPrizeWinners()');
      if (allPicks.length === 0 && allPicksAPPTV.length === 0 && allPicksAPPTB.length === 0) {
        console.warn('  → No picks data available');
      }
      if (!actualScores || Object.keys(actualScores).length === 0) {
        console.warn('  → No actual scores available');
      }
    }
  }, [allPicks, allPicksAPPTV, allPicksAPPTB, actualScores]);
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
            
            <div style={{
              backgroundColor: 'rgba(255,193,7,0.2)',
              border: '1px solid #ffc107',
              padding: '10px',
              borderRadius: '6px',
              marginBottom: '12px',
              fontSize: '0.95rem',
              lineHeight: '1.5'
            }}>
              ⚠️ IMPORTANT: Times below are from when you loaded this page.<br/>
              They do NOT update automatically. Reload to see current time.
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
            <div style={{paddingLeft: '10px', marginTop: '8px', fontWeight: '700', color: '#080808ff'}}>
              • Based on your login time, you have approximately {(() => {
                const deadline = new Date(pstTime);
                deadline.setHours(23, 59, 59, 999);
                const msRemaining = deadline - pstTime;
                const hoursRemaining = Math.floor(msRemaining / (1000 * 60 * 60));
                const minutesRemaining = Math.floor((msRemaining % (1000 * 60 * 60)) / (1000 * 60));
                return `${hoursRemaining} hours and ${minutesRemaining} minutes`;
              })()} to submit your picks
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
        <h1>🏈 Richard's NFL Playoff Pool 2026/2027</h1>
        <p>Enter your score predictions for each NFL Playoff 2026/2027 game</p>
        <p style={{fontSize: "0.85rem", marginTop: "10px", opacity: 0.8}}>
          v2.2-PLAYOFF-SCHEDULE-{new Date().toISOString().slice(0,10).replace(/-/g,"")}
        </p>
        <div style={{marginTop: "15px", display: "flex", flexDirection: "column", gap: "10px", alignItems: "center"}}>
          <div style={{display: "flex", gap: "15px", flexWrap: "wrap", justifyContent: "center"}}>
            <a
              href={`${import.meta.env.BASE_URL}Playoff_Pool_Quick_Rules.pdf`}
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
              📋 View Quick Rules (3 Pages)
            </a>
            <a
              href={`${import.meta.env.BASE_URL}Richards_Playoff_Pool_LX_Rulebook.pdf`}
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
            Entry Fee: ${prizePool?.entryFee > 0 ? prizePool.entryFee : '—'} - Must be paid before end of regular season
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

                {/* Player Status */}
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
                      <strong>Visible Pick Status:</strong> {allPicksAPPTV.find(p => p.playerCode === selectedPlayerForOverride && p.week === currentWeek) ? '✅ HAS PICKS' : '❌ NO PICKS'}
                      <br/>
                      <strong>Blind Pick Status:</strong> {allPicksAPPTB.find(p => p.playerCode === selectedPlayerForOverride && p.week === currentWeek) ? '✅ HAS PICKS' : '❌ NO PICKS'}
                    </div>

                    {/* RNG Button - only show after table is selected */}
                    {overrideTableTarget && (
                      <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '15px'}}>
                        <button
                          onClick={generateRNGPicks}
                          style={{
                            flex: '1', minWidth: '150px', padding: '12px',
                            background: '#9b59b6', color: 'white', border: 'none',
                            borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '600'
                          }}
                        >
                          🎲 Generate RNG Picks for {overrideTableTarget === 'both' ? 'Pool #1 + Pool #2' : overrideTableTarget === 'apptv' ? 'Pool #1 (Visible)' : 'Pool #2 (Blind)'}
                        </button>
                      </div>
                    )}

                    {/* ── TABLE SELECTOR ── */}
                    <div style={{
                      background: 'rgba(0,0,0,0.15)',
                      padding: '15px',
                      borderRadius: '8px',
                      marginBottom: '15px'
                    }}>
                      <div style={{fontWeight: '700', marginBottom: '10px', fontSize: '1rem'}}>
                        📋 Step 1 — Select which table to override:
                      </div>
                      <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap'}}>
                        {['apptv', 'apptb', 'both'].map(target => (
                          <button
                            key={target}
                            onClick={() => {
                              setOverrideTableTarget(target);
                              setOverrideAction(null);
                              setPredictionsOverrideAPPTV({});
                              setPredictionsOverrideAPPTB({});
                              setOverrideTimestampAPPTV('');
                              setOverrideTimestampAPPTB('');
                              setOverrideTimestampMsAPPTV('000');
                              setOverrideTimestampMsAPPTB('000');
                            }}
                            style={{
                              flex: '1', minWidth: '100px', padding: '12px',
                              background: overrideTableTarget === target ? 'white' : 'rgba(255,255,255,0.3)',
                              color: overrideTableTarget === target ? '#e74c3c' : 'white',
                              border: overrideTableTarget === target ? '3px solid white' : '2px solid rgba(255,255,255,0.5)',
                              borderRadius: '6px', cursor: 'pointer',
                              fontSize: '0.95rem', fontWeight: '700'
                            }}
                          >
                            {target === 'apptv' ? '👁️ Visible Pick Only' : target === 'apptb' ? '🔒 Blind Pick Only' : '👁️🔒 BOTH'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* ── LOAD / CLEAR BUTTON (Step 2) ── */}
                    {overrideTableTarget && (
                      <div style={{
                        background: 'rgba(0,0,0,0.15)',
                        padding: '15px',
                        borderRadius: '8px',
                        marginBottom: '15px'
                      }}>
                        <div style={{fontWeight: '700', marginBottom: '10px', fontSize: '1rem'}}>
                          📋 Step 2 — Load scores to edit:
                        </div>
                        <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap'}}>
                          <button
                            onClick={loadPlayerPicksForOverrideNew}
                            style={{
                              flex: '1', minWidth: '160px', padding: '12px',
                              background: '#3498db', color: 'white', border: 'none',
                              borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '600'
                            }}
                          >
                            📥 Load Existing Scores
                          </button>
                          <button
                            onClick={() => {
                              setPredictionsOverrideAPPTV({});
                              setPredictionsOverrideAPPTB({});
                              setOverrideTimestampAPPTV(getCurrentTimestampString());
                              setOverrideTimestampAPPTB(getCurrentTimestampString());
                              setOverrideTimestampMsAPPTV('000');
                              setOverrideTimestampMsAPPTB('000');
                              setOverrideAction('manual');
                            }}
                            style={{
                              flex: '1', minWidth: '160px', padding: '12px',
                              background: '#e67e22', color: 'white', border: 'none',
                              borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '600'
                            }}
                          >
                            🗑️ Start Fresh (Clear All)
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ── STACKED ENTRY FORM (Step 3) ── */}
                    {overrideAction === 'manual' && overrideTableTarget && (
                      <div>
                        <div style={{fontWeight: '700', marginBottom: '12px', fontSize: '1rem'}}>
                          📋 Step 3 — Enter scores &amp; set timestamps:
                        </div>

                        {/* ── APPTV SECTION ── */}
                        {(overrideTableTarget === 'apptv' || overrideTableTarget === 'both') && (
                          <div style={{
                            background: 'rgba(0,0,0,0.15)',
                            border: '2px solid rgba(255,255,255,0.4)',
                            borderRadius: '10px',
                            padding: '15px',
                            marginBottom: '15px'
                          }}>
                            <div style={{fontWeight: '800', fontSize: '1.1rem', marginBottom: '12px'}}>
                              👁️ Visible Pick
                            </div>
                            {(dynamicPlayoffWeeks[currentWeek]?.games || []).map(game => (
                              <div key={`apptv-${game.id}`} style={{
                                background: 'rgba(0,0,0,0.1)', borderRadius: '8px',
                                padding: '12px', marginBottom: '10px'
                              }}>
                                <div style={{fontWeight: '600', marginBottom: '8px', fontSize: '0.95rem'}}>
                                  Visible Pick — Game {game.id}: {getTeamName(currentWeek, game.id, 'team1', playoffTeams)} vs {getTeamName(currentWeek, game.id, 'team2', playoffTeams)}
                                </div>
                                <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
                                  <input
                                    type="text" maxLength="2" placeholder="Away"
                                    value={predictionsOverrideAPPTV[game.id]?.team1 || ''}
                                    onChange={e => {
                                      const v = e.target.value;
                                      if (v === '' || v === '-' || /^\d{1,2}$/.test(v))
                                        setPredictionsOverrideAPPTV(prev => ({ ...prev, [game.id]: { ...(prev[game.id] || {}), team1: v } }));
                                    }}
                                    style={{width: '60px', padding: '8px', textAlign: 'center', fontSize: '1.1rem', fontWeight: '700', borderRadius: '6px', border: '2px solid white', background: 'rgba(255,255,255,0.9)', color: '#333'}}
                                  />
                                  <span style={{fontWeight: '700', fontSize: '1.1rem'}}>vs</span>
                                  <input
                                    type="text" maxLength="2" placeholder="Home"
                                    value={predictionsOverrideAPPTV[game.id]?.team2 || ''}
                                    onChange={e => {
                                      const v = e.target.value;
                                      if (v === '' || v === '-' || /^\d{1,2}$/.test(v))
                                        setPredictionsOverrideAPPTV(prev => ({ ...prev, [game.id]: { ...(prev[game.id] || {}), team2: v } }));
                                    }}
                                    style={{width: '60px', padding: '8px', textAlign: 'center', fontSize: '1.1rem', fontWeight: '700', borderRadius: '6px', border: '2px solid white', background: 'rgba(255,255,255,0.9)', color: '#333'}}
                                  />
                                </div>
                              </div>
                            ))}
                            {/* APPTV Timestamp */}
                            <div style={{background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '12px', marginTop: '5px'}}>
                              <div style={{fontWeight: '700', marginBottom: '8px', fontSize: '0.95rem'}}>
                                🕐 Timestamp for Visible Pick (PST, 24-hr clock):
                              </div>
                              <div style={{display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '8px'}}>
                                <input
                                  type="text"
                                  value={overrideTimestampAPPTV}
                                  onChange={e => setOverrideTimestampAPPTV(e.target.value)}
                                  placeholder="YYYY-MM-DD HH:MM:SS AM/PM"
                                  style={{flex: '1', minWidth: '240px', padding: '8px 10px', fontSize: '0.9rem', fontWeight: '600', borderRadius: '6px', border: '2px solid white', background: 'rgba(255,255,255,0.9)', color: '#333', fontFamily: 'monospace'}}
                                />
                                <span style={{fontWeight: '600', fontSize: '0.85rem'}}>ms:</span>
                                <input
                                  type="text" maxLength="3"
                                  value={overrideTimestampMsAPPTV}
                                  onChange={e => { if (/^\d{0,3}$/.test(e.target.value)) setOverrideTimestampMsAPPTV(e.target.value); }}
                                  style={{width: '52px', padding: '8px', textAlign: 'center', fontSize: '0.9rem', fontWeight: '700', borderRadius: '6px', border: '2px solid white', background: 'rgba(255,255,255,0.9)', color: '#333', fontFamily: 'monospace'}}
                                />
                              </div>
                              <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
                                <button onClick={() => { setOverrideTimestampAPPTV(getCurrentTimestampString()); setOverrideTimestampMsAPPTV('000'); }}
                                  style={{padding: '7px 14px', background: '#27ae60', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600'}}>
                                  ⏱️ Use Current Time
                                </button>
                                <button onClick={() => { setOverrideTimestampAPPTV(''); setOverrideTimestampMsAPPTV('000'); }}
                                  style={{padding: '7px 14px', background: '#95a5a6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600'}}>
                                  🗑️ Clear
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* ── APPTB SECTION ── */}
                        {(overrideTableTarget === 'apptb' || overrideTableTarget === 'both') && (
                          <div style={{
                            background: 'rgba(0,0,0,0.15)',
                            border: '2px solid rgba(255,255,255,0.4)',
                            borderRadius: '10px',
                            padding: '15px',
                            marginBottom: '15px'
                          }}>
                            <div style={{fontWeight: '800', fontSize: '1.1rem', marginBottom: '12px'}}>
                              🔒 Blind Pick
                            </div>
                            {(dynamicPlayoffWeeks[currentWeek]?.games || []).map(game => (
                              <div key={`apptb-${game.id}`} style={{
                                background: 'rgba(0,0,0,0.1)', borderRadius: '8px',
                                padding: '12px', marginBottom: '10px'
                              }}>
                                <div style={{fontWeight: '600', marginBottom: '8px', fontSize: '0.95rem'}}>
                                  Blind Pick — Game {game.id}: {getTeamName(currentWeek, game.id, 'team1', playoffTeams)} vs {getTeamName(currentWeek, game.id, 'team2', playoffTeams)}
                                </div>
                                <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
                                  <input
                                    type="text" maxLength="2" placeholder="Away"
                                    value={predictionsOverrideAPPTB[game.id]?.team1 || ''}
                                    onChange={e => {
                                      const v = e.target.value;
                                      if (v === '' || v === '-' || /^\d{1,2}$/.test(v))
                                        setPredictionsOverrideAPPTB(prev => ({ ...prev, [game.id]: { ...(prev[game.id] || {}), team1: v } }));
                                    }}
                                    style={{width: '60px', padding: '8px', textAlign: 'center', fontSize: '1.1rem', fontWeight: '700', borderRadius: '6px', border: '2px solid white', background: 'rgba(255,255,255,0.9)', color: '#333'}}
                                  />
                                  <span style={{fontWeight: '700', fontSize: '1.1rem'}}>vs</span>
                                  <input
                                    type="text" maxLength="2" placeholder="Home"
                                    value={predictionsOverrideAPPTB[game.id]?.team2 || ''}
                                    onChange={e => {
                                      const v = e.target.value;
                                      if (v === '' || v === '-' || /^\d{1,2}$/.test(v))
                                        setPredictionsOverrideAPPTB(prev => ({ ...prev, [game.id]: { ...(prev[game.id] || {}), team2: v } }));
                                    }}
                                    style={{width: '60px', padding: '8px', textAlign: 'center', fontSize: '1.1rem', fontWeight: '700', borderRadius: '6px', border: '2px solid white', background: 'rgba(255,255,255,0.9)', color: '#333'}}
                                  />
                                </div>
                              </div>
                            ))}
                            {/* APPTB Timestamp */}
                            <div style={{background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '12px', marginTop: '5px'}}>
                              <div style={{fontWeight: '700', marginBottom: '8px', fontSize: '0.95rem'}}>
                                🕐 Timestamp for Blind Pick (PST, 24-hr clock):
                              </div>
                              <div style={{display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '8px'}}>
                                <input
                                  type="text"
                                  value={overrideTimestampAPPTB}
                                  onChange={e => setOverrideTimestampAPPTB(e.target.value)}
                                  placeholder="YYYY-MM-DD HH:MM:SS AM/PM"
                                  style={{flex: '1', minWidth: '240px', padding: '8px 10px', fontSize: '0.9rem', fontWeight: '600', borderRadius: '6px', border: '2px solid white', background: 'rgba(255,255,255,0.9)', color: '#333', fontFamily: 'monospace'}}
                                />
                                <span style={{fontWeight: '600', fontSize: '0.85rem'}}>ms:</span>
                                <input
                                  type="text" maxLength="3"
                                  value={overrideTimestampMsAPPTB}
                                  onChange={e => { if (/^\d{0,3}$/.test(e.target.value)) setOverrideTimestampMsAPPTB(e.target.value); }}
                                  style={{width: '52px', padding: '8px', textAlign: 'center', fontSize: '0.9rem', fontWeight: '700', borderRadius: '6px', border: '2px solid white', background: 'rgba(255,255,255,0.9)', color: '#333', fontFamily: 'monospace'}}
                                />
                              </div>
                              <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
                                <button onClick={() => { setOverrideTimestampAPPTB(getCurrentTimestampString()); setOverrideTimestampMsAPPTB('000'); }}
                                  style={{padding: '7px 14px', background: '#27ae60', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600'}}>
                                  ⏱️ Use Current Time
                                </button>
                                <button onClick={() => { setOverrideTimestampAPPTB(''); setOverrideTimestampMsAPPTB('000'); }}
                                  style={{padding: '7px 14px', background: '#95a5a6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600'}}>
                                  🗑️ Clear
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* ── SAVE BUTTON ── */}
                        <button
                          onClick={submitOverridePicks}
                          style={{
                            width: '100%', padding: '15px',
                            background: 'white', color: '#e74c3c',
                            border: 'none', borderRadius: '8px',
                            cursor: 'pointer', fontSize: '1.1rem', fontWeight: '800',
                            boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
                            marginBottom: '10px'
                          }}
                        >
                          ⚡ SAVE OVERRIDE — {overrideTableTarget === 'both' ? 'Pool #1 + Pool #2' : overrideTableTarget === 'apptv' ? 'Pool #1 (Visible)' : 'Pool #2 (Blind)'} for {PLAYER_CODES[selectedPlayerForOverride]}
                        </button>
                      </div>
                    )}

                    {/* Delete Buttons - Only show if player has picks in either table */}
                    {(allPicksAPPTV.find(p => p.playerCode === selectedPlayerForOverride) ||
                      allPicksAPPTB.find(p => p.playerCode === selectedPlayerForOverride) ||
                      allPicksPool3.find(p => p.playerCode === selectedPlayerForOverride) ||
                      [].find(p => p.playerCode === selectedPlayerForOverride)) && (
                      <div style={{
                        marginTop: '15px', padding: '15px',
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
                              flex: '1', minWidth: '150px', padding: '12px',
                              background: '#e67e22', color: 'white', border: 'none',
                              borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '600'
                            }}
                          >
                            🗑️ Delete This Week Only
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm('all')}
                            style={{
                              flex: '1', minWidth: '150px', padding: '12px',
                              background: '#c0392b', color: 'white', border: 'none',
                              borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '600'
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
                    setOverrideTableTarget('');
                    setPredictionsOverrideAPPTV({});
                    setPredictionsOverrideAPPTB({});
                    setOverrideTimestampAPPTV('');
                    setOverrideTimestampAPPTB('');
                    setOverrideTimestampMsAPPTV('000');
                    setOverrideTimestampMsAPPTB('000');
                    setRngPreview(null);
                    setShowRngPreview(false);
                  }}
                  style={{
                    padding: '10px 20px',
                    background: '#95a5a6', color: 'white', border: 'none',
                    borderRadius: '6px', cursor: 'pointer',
                    fontSize: '0.9rem', fontWeight: '600'
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
                Week: <strong>{currentWeek === 'wildcard' ? 'Week 1' : currentWeek === 'divisional' ? 'Week 2' : currentWeek === 'conference' ? 'Week 3' : 'Week 4'}</strong><br/>
                Saving to: <strong style={{color: '#e74c3c'}}>{overrideTableTarget === 'both' ? 'Pool #1 + Pool #2' : overrideTableTarget === 'apptv' ? 'Pool #1 (Visible)' : 'Pool #2 (Blind)'}</strong>
              </p>
              
              <div style={{marginBottom: '20px'}}>
                {dynamicPlayoffWeeks[currentWeek].games.map(game => (
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
                marginBottom: '16px',
                fontSize: '0.9rem'
              }}>
                ✅ All scores between 10-50 (inclusive)<br/>
                ✅ No tied games<br/>
                ✅ Will be marked as "POOL_MANAGER_RNG" in database
              </div>

              {/* Timestamp option */}
              <div style={{
                background: rngUseDeadlineTimestamp ? '#fff3cd' : '#f8f9fa',
                border: `2px solid ${rngUseDeadlineTimestamp ? '#ffc107' : '#dee2e6'}`,
                borderRadius: '8px',
                padding: '12px 16px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                cursor: 'pointer'
              }}
                onClick={() => setRngUseDeadlineTimestamp(v => !v)}
              >
                <span style={{fontSize: '1.4rem'}}>⏰</span>
                <div style={{flex: 1}}>
                  <div style={{fontWeight: '700', fontSize: '0.95rem', color: '#333'}}>
                    Use Saturday 12:00 AM PST Timestamp
                  </div>
                  <div style={{fontSize: '0.8rem', color: '#666', marginTop: '2px'}}>
                    {rngUseDeadlineTimestamp
                      ? '✅ ON — picks will be timestamped Saturday 12:00:00 AM PST (just after Friday deadline)'
                      : '⬜ OFF — picks will use current time'}
                  </div>
                </div>
                <div style={{
                  width: '44px', height: '24px',
                  background: rngUseDeadlineTimestamp ? '#28a745' : '#ccc',
                  borderRadius: '12px',
                  position: 'relative',
                  transition: 'background 0.2s',
                  flexShrink: 0
                }}>
                  <div style={{
                    position: 'absolute',
                    top: '3px',
                    left: rngUseDeadlineTimestamp ? '23px' : '3px',
                    width: '18px', height: '18px',
                    background: 'white',
                    borderRadius: '50%',
                    transition: 'left 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                  }}/>
                </div>
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
                    <strong>🚨 DANGER:</strong> This will DELETE ALL of {PLAYER_CODES[selectedPlayerForOverride]}'s picks across ALL 4 POOLS:<br/><br/>
                    {['wildcard','divisional','conference','superbowl'].map(week => {
                      const hasAny = allPicksAPPTV.some(p => p.playerCode === selectedPlayerForOverride && p.week === week)
                                  || allPicksAPPTB.some(p => p.playerCode === selectedPlayerForOverride && p.week === week)
                                  || allPicksPool3.some(p => p.playerCode === selectedPlayerForOverride && p.week === week)
                                  || [].some(p => p.playerCode === selectedPlayerForOverride && p.week === week);
                      if (!hasAny) return null;
                      const label = week === 'wildcard' ? 'Week 1' : week === 'divisional' ? 'Week 2' : week === 'conference' ? 'Week 3' : 'Week 4';
                      const pools = [
                        allPicksAPPTV.some(p => p.playerCode === selectedPlayerForOverride && p.week === week) ? 'Pool #1' : null,
                        allPicksAPPTB.some(p => p.playerCode === selectedPlayerForOverride && p.week === week) ? 'Pool #2' : null,
                        allPicksPool3.some(p => p.playerCode === selectedPlayerForOverride && p.week === week) ? 'Pool #3' : null,
                        null,
                      ].filter(Boolean);
                      return <div key={week} style={{marginLeft: '20px'}}>✓ {label}: {pools.join(', ')}</div>;
                    })}
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

        {/* 🎯 Pool #3 Auto-Calculated Notification Banner */}
        {codeValidated && !isPoolManager() && (() => {
          const p3Record = allPicksPool3.find(p => p.playerCode === playerCode && p.week === currentWeek);
          const isAutoCalc = p3Record && p3Record.autoCalculated === true && !p3Record.manuallyConfirmed;
          if (!isAutoCalc) return null;
          const p3Prize = prizePool?.pool34PrizeNoPS ? `$${prizePool.pool34PrizeNoPS.toFixed(2)}` : null;
          const p1Prize = prizePool?.pool12PrizeNoPS ? `$${prizePool.pool12PrizeNoPS.toFixed(2)}` : null;
          const prizeMsg = p3Prize && p1Prize
            ? `Pool #3 prizes are ${p3Prize} each vs ${p1Prize} for Pool #1 and Pool #2.`
            : 'Pool #3 has the highest prize amounts of all three pools.';
          return (
            <div style={{ margin: '12px 16px', padding: '16px 20px', background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)', borderRadius: '12px', border: '3px solid #a78bfa', color: '#fff', boxShadow: '0 4px 20px rgba(124,58,237,0.4)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '2rem' }}>🎯</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '800', fontSize: '1rem', marginBottom: '6px' }}>
                    Your Pool #3 picks have been auto-calculated from your Pool #1 predictions
                  </div>
                  <div style={{ fontSize: '0.88rem', opacity: 0.92, lineHeight: '1.5', marginBottom: '10px' }}>
                    {prizeMsg} We strongly recommend you review and adjust your Pool #3 picks before Friday's deadline — your picks were calculated automatically as a backup but you may want to change them.
                  </div>
                  <button
                    onClick={() => setCurrentView('pool34Picks')}
                    style={{ padding: '10px 20px', background: '#fff', color: '#7c3aed', border: 'none', borderRadius: '8px', fontWeight: '800', fontSize: '0.9rem', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}
                  >
                    🎯 Review My Pool #3 Picks →
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* 🆕 STEP 5: Week Selector - Complete with lock status and validation */}
        {codeValidated && (
          <WeekSelector
            currentWeek={currentWeek}
            onWeekChange={handleWeekChange}
            weekPicks={weekPicksStatus}
            weekLockStatus={weekLockStatus}
            hasUnsavedChanges={hasUnsavedChanges}
            isPoolManager={isPoolManager()}
            dynamicPlayoffWeeks={dynamicPlayoffWeeks}
            playoffDates={playoffDates}
          />
        )}
        
{/* 🆕 Navigation Buttons - Show after code validation */}
        {codeValidated && (() => {
          // Safe navigation — warns if Pool #1/#2 or Pool #3 has unsaved changes
          const handleNavClick = (targetView) => {
            const leavingPicks   = currentView === 'picks'      && hasUnsavedChanges;
            const leavingPool34  = currentView === 'pool34Picks' && pool3Dirty;
            if (leavingPicks || leavingPool34) {
              const poolLabel = leavingPool34 ? 'Pool #3 Winner, ATS, O/U' : 'Pool #1 & #2';
              const choice = window.confirm(
                `⚠️ UNSAVED CHANGES — ${poolLabel}\n\n` +
                `You have unsaved picks that will be lost if you leave.\n\n` +
                `Click OK to LEAVE and discard changes\n` +
                `Click CANCEL to stay and save your picks`
              );
              if (!choice) return;
              if (leavingPool34) {
                // Restore to last saved state by reloading from Firebase records
                const savedP3 = allPicksPool3.find(p => p.playerCode === playerCode && p.week === currentWeek);
                setPredictionsPool3(savedP3?.picks || {});
                setPool3Dirty(false);
                setPool3CancelSnapshot(null);
              }
              if (leavingPicks) {
                // Restore to last saved state by reloading from Firebase records
                const savedV = allPicksAPPTV.find(p => p.playerCode === playerCode && p.week === currentWeek);
                const savedB = allPicksAPPTB.find(p => p.playerCode === playerCode && p.week === currentWeek);
                setPredictionsAPPTV(savedV?.predictions || {});
                setPredictionsAPPTB(savedB?.predictions || {});
                setVisiblePicksDirty(false); setBlindPicksDirty(false);
                setVisibleCancelSnapshot(null); setBlindCancelSnapshot(null);
                setHasUnsavedChanges(false);
              }
            }
            setCurrentView(targetView);
          };

          const YouAreHere = () => (
            <span style={{ marginLeft: '8px', fontSize: '0.72rem', opacity: 0.9, fontStyle: 'italic' }}>(you are here)</span>
          );
          const PMBadge = () => (
            <span style={{ marginLeft: '8px', fontSize: '0.68rem', padding: '2px 6px', background: '#667eea', color: 'white', borderRadius: '10px', fontWeight: '500' }}>Pool Manager</span>
          );

          return (
            <>
              {/* ── ROW 1: Pick tabs (always visible) ── */}
              <div className="view-navigation" style={{ marginBottom: '6px' }}>
                {/* Pool #1 & #2 */}
                <button
                  className={`nav-btn ${currentView === 'picks' ? 'active' : ''}`}
                  onClick={() => handleNavClick('picks')}
                >
                  🟡🔵 Pool #1 &amp; #2 Picks &amp; Logout
                  {currentView === 'picks' && <YouAreHere />}
                </button>

                {/* Pool #3 Winner, ATS, O/U — always visible to pool manager; visible to players only when kill switch is ON */}
                {(pool34Enabled || isPoolManager()) && (
                  <button
                    className={`nav-btn ${currentView === 'pool34Picks' ? 'active' : ''}`}
                    onClick={() => handleNavClick('pool34Picks')}
                    style={{
                      background: currentView === 'pool34Picks'
                        ? 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)'
                        : !pool34Enabled && isPoolManager() ? '#f5f3ff' : '#f3f4f6',
                      color: currentView === 'pool34Picks' ? '#fff' : '#374151',
                      border: `2px solid ${!pool34Enabled && isPoolManager() ? '#c4b5fd' : '#7c3aed'}`,
                      fontWeight: '700',
                      opacity: !pool34Enabled && isPoolManager() ? 0.75 : 1
                    }}
                  >
                    🎯 Pool #3 Winner, ATS, O/U Picks &amp; Logout
                    {!pool34Enabled && isPoolManager() && (
                      <span style={{ marginLeft: '6px', fontSize: '0.68rem', padding: '2px 6px', background: '#ef4444', color: 'white', borderRadius: '10px', fontWeight: '600' }}>DISABLED</span>
                    )}
                    {currentView === 'pool34Picks' && <YouAreHere />}
                  </button>
                )}
              </div>

              {/* ── ROW 2: Info / standings tabs ── */}
              <div className="view-navigation">
                <button
                  className={`nav-btn ${currentView === 'standings' ? 'active' : ''}`}
                  onClick={() => handleNavClick('standings')}
                >
                  🏆 #4 Standings &amp; Prizes
                  {currentView === 'standings' && <YouAreHere />}
                </button>
                <button
                  className={`nav-btn ${currentView === 'winners' ? 'active' : ''}`}
                  onClick={() => handleNavClick('winners')}
                >
                  ⚖️ #5 How Winners Are Determined
                  {currentView === 'winners' && <YouAreHere />}
                </button>

                {/* Pool Manager tabs */}
                {isPoolManager() && (
                  <button
                    className={`nav-btn ${currentView === 'payments' ? 'active' : ''}`}
                    onClick={() => handleNavClick('payments')}
                  >
                    💰 Payments<PMBadge />
                    {currentView === 'payments' && <YouAreHere />}
                  </button>
                )}
                {isPoolManager() && (
                  <button
                    className={`nav-btn ${currentView === 'playoffSetup' ? 'active' : ''}`}
                    onClick={() => handleNavClick('playoffSetup')}
                  >
                    ⚙️ Setup Playoff Dates/Teams<PMBadge />
                    {currentView === 'playoffSetup' && <YouAreHere />}
                  </button>
                )}
                {isPoolManager() && (
                  <button
                    className={`nav-btn ${currentView === 'pool34Setup' ? 'active' : ''}`}
                    onClick={() => handleNavClick('pool34Setup')}
                    style={{ border: currentView === 'pool34Setup' ? '3px solid #7c3aed' : undefined, background: currentView === 'pool34Setup' ? '#ede9fe' : undefined }}
                  >
                    🎯 Pool #3 Winner, ATS, O/U Setup
                    <span style={{ marginLeft: '8px', fontSize: '0.68rem', padding: '2px 6px', background: '#7c3aed', color: 'white', borderRadius: '10px', fontWeight: '500' }}>Pool Manager</span>
                    {currentView === 'pool34Setup' && <YouAreHere />}
                  </button>
                )}
                {isPoolManager() && (
                  <button
                    className="nav-btn"
                    style={{ background: '#7c3aed', color: 'white' }}
                    onClick={async () => {
                      const results = { pool3: 0, skipped3: 0, errors: [] };
                      const weeks = ['wildcard', 'divisional', 'conference', 'superbowl'];

                      try {
                        // Read everything fresh directly from Firebase — bypass React state entirely
                        const [snap1, snap2, snap3, snap4, snapLines, snapTeams] = await Promise.all([
                          get(ref(database, 'picks_apptv')),
                          get(ref(database, 'picks_apptb')),
                          get(ref(database, 'picks_pool3')),
        
                          get(ref(database, 'betting_lines')),
                          get(ref(database, 'playoffTeams'))
                        ]);

                        const apptvAll  = snap1.val() || {};
                        const apptbAll  = snap2.val() || {};
                        const pool3All  = snap3.val() || {};
                        const {}  = snap4.val() || {};
                        const lines     = snapLines.val() || {};
                        const teams     = snapTeams.val() || {};

                        // Build lookup arrays
                        const apptvList  = Object.entries(apptvAll).map(([k,v])  => ({...v,  firebaseKey: k}));
                        const apptbList  = Object.entries(apptbAll).map(([k,v])  => ({...v,  firebaseKey: k}));
                        const pool3List  = Object.entries(pool3All).map(([k,v])  => ({...v,  firebaseKey: k}));
                        const pool4List  = []; // Pool #4 removed

                        // Helper: compute Pool #3 picks from score predictions
                        const computePicks = (predictions, weekKey) => {
                          const weekLines = lines[weekKey] || {};
                          const weekGames = dynamicPlayoffWeeks[weekKey]?.games || [];
                          const picks = {};
                          weekGames.forEach(game => {
                            const gidStr = String(game.id);
                            const pred = predictions?.[gidStr] || predictions?.[game.id];
                            const line = weekLines?.[gidStr] || weekLines?.[game.id];
                            if (!pred || !line || !line.favourite || !line.spread || !line.overUnder) return;
                            const t1 = parseInt(pred.team1), t2 = parseInt(pred.team2);
                            if (isNaN(t1) || isNaN(t2)) return;

                            // Derive winner: we need team names — use getTeamName with the fresh teams snapshot
                            // BUT if names come back as placeholders, fall back to position-based logic
                            const awayRaw = getTeamName(weekKey, game.id, 'team1', teams);
                            const homeRaw = getTeamName(weekKey, game.id, 'team2', teams);
                            // Use raw names if they look real, otherwise label by score position
                            const awayName = (awayRaw && awayRaw !== 'TBD' && !awayRaw.startsWith('AFC') && !awayRaw.startsWith('NFC')) ? awayRaw : `Away_${game.id}`;
                            const homeName = (homeRaw && homeRaw !== 'TBD' && !homeRaw.startsWith('AFC') && !homeRaw.startsWith('NFC')) ? homeRaw : `Home_${game.id}`;

                            // Winner: higher score wins
                            const winner = t1 > t2 ? awayName : homeName;

                            // ATS: favourite is stored by name in line.favourite
                            // Determine if favourite is away or home by matching name
                            const favMatch = (name, fav) => name === fav || name.includes(fav) || fav.includes(name);
        const favIsAway = favMatch(awayName, line.favourite);
                            const favMargin = favIsAway ? (t1 - t2) : (t2 - t1);
                            // favourite covered if they won by more than the spread
                            const underdog = favIsAway ? homeName : awayName;
                            const ats = favMargin > parseFloat(line.spread) ? line.favourite : underdog;

                            // O/U
                            const ou = (t1 + t2) > parseFloat(line.overUnder) ? 'over' : 'under';

                            picks[game.id] = { winner, ats, ou };
                          });
                          return picks;
                        };

                        // Process every player/week combo
                        for (const apptvRec of apptvList) {
                          const { playerCode: pc, playerName: pn, week, predictions, timestamp } = apptvRec;
                          if (!pc || !week || !predictions) continue;
                          const weekLines = lines[week] || {};
                          if (!Object.keys(weekLines).length) { results.skipped3++; continue; }

                          // Pool #3 — from Pool #1
                          const existing3 = pool3List.find(p => p.playerCode === pc && p.week === week);
                          const has3 = existing3 && Object.keys(existing3.picks || {}).length > 0;
                          if (!has3) {
                            const picks = computePicks(predictions, week);
                            if (Object.keys(picks).length > 0) {
                              const data = { playerName: pn, playerCode: pc, week, picks, timestamp: timestamp || Date.now(), lastUpdated: Date.now(), autoFilled: true };
                              if (existing3?.firebaseKey) {
                                await set(ref(database, `picks_pool3/${existing3.firebaseKey}`), data);
                              } else {
                                await push(ref(database, 'picks_pool3'), data);
                              }
                              results.pool3++;
                            } else {
                              results.errors.push(`Pool3 skip ${pn} ${week}: 0 picks (lines keys: ${Object.keys(weekLines).join(',')}, pred keys: ${Object.keys(predictions).join(',')})`);
                              results.skipped3++;
                            }
                          } else {
                            results.skipped3++;
                          }
                        }

                        // Pool #4 — from Pool #2
                        for (const apptbRec of apptbList) {
                          const { playerCode: pc, playerName: pn, week, predictions, timestamp } = apptbRec;
                          if (!pc || !week || !predictions) continue;
                          const weekLines = lines[week] || {};
                          if (!Object.keys(weekLines).length) { results.skipped4++; continue; }

                          const existing4 = pool4List.find(p => p.playerCode === pc && p.week === week);
                          const has4 = existing4 && Object.keys(existing4.picks || {}).length > 0;
                          if (!has4) {
                            const picks = computePicks(predictions, week);
                            if (Object.keys(picks).length > 0) {
                              const data = { playerName: pn, playerCode: pc, week, picks, timestamp: timestamp || Date.now(), lastUpdated: Date.now(), autoFilled: true };
                              if (existing4?.firebaseKey) {

                              } else {

                              }

                            } else {
                              results.errors.push(`Pool4 skip ${pn} ${week}: 0 picks`);
                              results.skipped4++;
                            }
                          } else {
                            results.skipped4++;
                          }
                        }

                        // DIAGNOSTIC — show exactly what we found before writing anything
                        const diagLines = [];
                        diagLines.push(`📊 Firebase raw data:`);
                        diagLines.push(`  picks_apptv records: ${Object.keys(apptvAll).length}`);
                        diagLines.push(`  picks_apptb records: ${Object.keys(apptbAll).length}`);
                        diagLines.push(`  picks_pool3 records: ${Object.keys(pool3All).length}`);
                        // pool4 removed
                        diagLines.push(`  betting_lines weeks: ${Object.keys(lines).join(', ') || 'NONE'}`);
                        diagLines.push(`  playoffTeams.week1.configured: ${teams?.week1?.configured}`);
                        diagLines.push(``);

                        // Show Bob specifically
                        const bobApptv = apptvList.filter(p => p.playerName?.includes('Bob') || p.playerCode === 'J239W4');
                        const bobApptb = apptbList.filter(p => p.playerName?.includes('Bob') || p.playerCode === 'J239W4');
                        const bobPool3 = pool3List.filter(p => p.playerName?.includes('Bob') || p.playerCode === 'J239W4');
                        const bobPool4 = pool4List.filter(p => p.playerName?.includes('Bob') || p.playerCode === 'J239W4');
                        diagLines.push(`🔍 Bob Casson records:`);
                        diagLines.push(`  APPTV picks: ${bobApptv.length} (weeks: ${bobApptv.map(p=>p.week).join(',')||'none'})`);
                        diagLines.push(`  APPTB picks: ${bobApptb.length} (weeks: ${bobApptb.map(p=>p.week).join(',')||'none'})`);
                        diagLines.push(`  Pool3 picks: ${bobPool3.length} (weeks: ${bobPool3.map(p=>p.week).join(',')||'none'})`);
                        diagLines.push(`  Pool4 picks: ${bobPool4.length} (weeks: ${bobPool4.map(p=>p.week).join(',')||'none'})`);
                        if (bobApptv.length > 0) {
                          const b = bobApptv[0];
                          const predKeys = Object.keys(b.predictions || {});
                          diagLines.push(`  Bob APPTV week=${b.week} pred keys: [${predKeys.join(',')}]`);
                          const weekLinesForBob = lines[b.week] || {};
                          diagLines.push(`  lines for ${b.week}: keys=[${Object.keys(weekLinesForBob).join(',')}]`);
                          if (predKeys.length > 0) {
                            const firstKey = predKeys[0];
                            const firstPred = b.predictions[firstKey];
                            const firstLine = weekLinesForBob[firstKey];
                            diagLines.push(`  first pred (key ${firstKey}): t1=${firstPred?.team1} t2=${firstPred?.team2}`);
                            diagLines.push(`  first line (key ${firstKey}): fav=${firstLine?.favourite} spread=${firstLine?.spread} ou=${firstLine?.overUnder}`);
                          }
                        }

                        alert(diagLines.join('\n'));

                        // Process every player/week combo — always overwrite existing records
                        for (const apptvRec of apptvList) {
                          const { playerCode: pc, playerName: pn, week, predictions, timestamp } = apptvRec;
                          if (!pc || !week || !predictions) continue;
                          const weekLines = lines[week] || {};
                          if (!Object.keys(weekLines).length) { results.skipped3++; continue; }

                          const picks = computePicks(predictions, week);
                          if (Object.keys(picks).length > 0) {
                            // Delete ALL existing pool3 records for this player/week (cleans up duplicates)
                            const existing3all = pool3List.filter(p => p.playerCode === pc && p.week === week);
                            for (const rec of existing3all) {
                              await remove(ref(database, `picks_pool3/${rec.firebaseKey}`));
                            }
                            // Write fresh record
                            await push(ref(database, 'picks_pool3'), {
                              playerName: pn, playerCode: pc, week, picks,
                              timestamp: timestamp || Date.now(),
                              lastUpdated: Date.now(), autoFilled: true
                            });
                            results.pool3++;
                          } else {
                            results.errors.push(`Pool3 skip ${pn} ${week}: 0 picks (lines: ${Object.keys(weekLines).join(',')}, preds: ${Object.keys(predictions).join(',')})`);
                            results.skipped3++;
                          }
                        }

                        // Pool #4 — from Pool #2 — always overwrite
                        for (const apptbRec of apptbList) {
                          const { playerCode: pc, playerName: pn, week, predictions, timestamp } = apptbRec;
                          if (!pc || !week || !predictions) continue;
                          const weekLines = lines[week] || {};
                          if (!Object.keys(weekLines).length) { results.skipped4++; continue; }

                          const picks = computePicks(predictions, week);
                          if (Object.keys(picks).length > 0) {
                            // Delete ALL existing pool4 records for this player/week
                            const existing4all = pool4List.filter(p => p.playerCode === pc && p.week === week);
                            for (const rec of existing4all) {

                            }

                            // pool4 removed
                          } else {
                            results.errors.push(`Pool4 skip ${pn} ${week}: 0 picks`);
                            results.skipped4++;
                          }
                        }

                        let msg = `✅ Force Backfill Complete!\n\nPool #3: ${results.pool3} records written (${results.skipped3} already had picks or no lines)\n records written (${results.skipped4} already had picks or no lines)`;
                        if (results.errors.length) msg += `\n\n⚠️ Skipped:\n${results.errors.slice(0,8).join('\n')}`;
                        alert(msg);
                      } catch (err) {
                        alert('❌ Force backfill failed: ' + err.message);
                        console.error(err);
                      }
                    }}
                  >
                    🔄 Force Backfill Pool #3
                    <span style={{ marginLeft: '8px', fontSize: '0.68rem', padding: '2px 6px', background: '#5b21b6', color: 'white', borderRadius: '10px', fontWeight: '500' }}>Pool Manager</span>
                  </button>
                )}
                {isPoolManager() && (
                  <button
                    className={`nav-btn ${currentView === 'loginLogs' ? 'active' : ''}`}
                    onClick={() => handleNavClick('loginLogs')}
                  >
                    🔐 Login Logs<PMBadge />
                    {currentView === 'loginLogs' && <YouAreHere />}
                  </button>
                )}
                {isPoolManager() && (
                  <button
                    className={`nav-btn ${currentView === 'newSeason' ? 'active' : ''}`}
                    onClick={() => handleNavClick('newSeason')}
                    style={{ background: currentView === 'newSeason' ? '#dc2626' : '#fee2e2', color: currentView === 'newSeason' ? 'white' : '#dc2626', border: '2px solid #dc2626', fontWeight: '800' }}
                  >
                    🗓️ New Season Setup<PMBadge />
                    {currentView === 'newSeason' && <YouAreHere />}
                  </button>
                )}

                {/* ── One-time / utility buttons (Pool Manager only) ── */}
                {isPoolManager() && (
                  <button
                    className="nav-btn"
                    style={{ background: '#10b981', color: 'white' }}
                    onClick={async () => {
                      if (!confirm('Create players table in Firebase?\n\nThis will add all ' + Object.keys(PLAYER_CODES).length + ' players to Firebase.')) return;
                      try {
                        const playersRef = ref(database, 'players');
                        const snapshot = await get(playersRef);
                        if (snapshot.exists()) { alert('✅ Players table already exists in Firebase!'); return; }
                        let count = 0;
                        for (const [code, name] of Object.entries(PLAYER_CODES)) {
                          await push(ref(database, 'players'), {
                            playerCode: code, playerName: name,
                            role: POOL_MANAGER_CODES.includes(code) ? 'MANAGER' : 'PLAYER',
                            paymentStatus: 'UNPAID', paymentTimestamp: '', paymentMethod: '',
                            paymentAmount: 0, visibleToPlayers: true,
                            createdAt: Date.now(), updatedAt: Date.now()
                          });
                          count++;
                        }
                        alert('✅ SUCCESS!\n\nCreated ' + count + ' players in Firebase!\n\nREFRESH THE PAGE NOW!');
                      } catch (error) { alert('❌ Error: ' + error.message); }
                    }}
                  >
                    🔄 Create Players Table
                    <span style={{ marginLeft: '8px', fontSize: '0.68rem', padding: '2px 6px', background: '#059669', color: 'white', borderRadius: '10px', fontWeight: '500' }}>One-Time Setup</span>
                  </button>
                )}
                {isPoolManager() && (
                  <button className="nav-btn" style={{ background: '#3b82f6', color: 'white' }}
                    onClick={async () => {
                      const newName = prompt('Enter new player name:');
                      if (!newName || !newName.trim()) { alert('❌ Cancelled - no name entered'); return; }
                      const newCode = prompt('Enter 6-character access code\n(or leave blank to auto-generate):');
                      const code = newCode && newCode.trim() ? newCode.trim().toUpperCase() : Math.random().toString(36).substring(2, 8).toUpperCase();
                      if (code.length !== 6) { alert('❌ Access code must be exactly 6 characters!'); return; }
                      const playersRef = ref(database, 'players');
                      const snapshot = await get(playersRef);
                      if (snapshot.exists()) {
                        const existing = snapshot.val();
                        if (Object.values(existing).some(p => p.playerCode === code)) { alert(`❌ Code "${code}" already exists!`); return; }
                      }
                      try {
                        await push(playersRef, { playerCode: code, playerName: newName.trim(), role: 'PLAYER', paymentStatus: 'UNPAID', paymentTimestamp: '', paymentMethod: '', paymentAmount: 0, visibleToPlayers: true, createdAt: Date.now(), updatedAt: Date.now() });
                        alert(`✅ PLAYER ADDED!\n\nName: ${newName.trim()}\nAccess Code: ${code}\n\n📧 Give this code to the player!`);
                      } catch (error) { alert('❌ Error: ' + error.message); }
                    }}
                  >
                    ➕ Add New Player<PMBadge />
                  </button>
                )}
                {isPoolManager() && (
                  <button className="nav-btn" style={{ background: '#f59e0b', color: 'white' }}
                    onClick={async () => {
                      if (!confirm('Add showInPicksTable field to all players?')) return;
                      try {
                        const playersRef = ref(database, 'players');
                        const snapshot = await get(playersRef);
                        if (!snapshot.exists()) { alert('❌ No players found'); return; }
                        const players = snapshot.val();
                        let count = 0;
                        for (const [key, player] of Object.entries(players)) {
                          if (player.showInPicksTable === undefined) {
                            await update(ref(database, `players/${key}`), { showInPicksTable: true });
                            count++;
                          }
                        }
                        alert(`✅ Added showInPicksTable to ${count} players!`);
                      } catch (error) { alert('❌ Error: ' + error.message); }
                    }}
                  >
                    🔧 Add Table Field
                    <span style={{ marginLeft: '8px', fontSize: '0.68rem', padding: '2px 6px', background: '#d97706', color: 'white', borderRadius: '10px', fontWeight: '500' }}>One-Time</span>
                  </button>
                )}
                {isPoolManager() && (
                  <button className="nav-btn" style={{ background: '#10b981', color: 'white' }} onClick={exportPlayersToExcel}>
                    📥 Download All Players (Excel)
                    <span style={{ marginLeft: '8px', fontSize: '0.68rem', padding: '2px 6px', background: '#059669', color: 'white', borderRadius: '10px', fontWeight: '500' }}>Backup</span>
                  </button>
                )}
                {isPoolManager() && (
                  <button className="nav-btn" style={{ background: '#dc2626', color: 'white' }}
                    onClick={async () => {
                      if (!window.confirm('⚠️⚠️⚠️ EMERGENCY OVERRIDE ⚠️⚠️⚠️\n\nThis will OVERWRITE all player codes in Firebase with the hardcoded PLAYER_CODES from App.jsx.\n\n❌ Any codes manually updated in Firebase will be LOST!\n\nAre you SURE?')) return;
                      if (!window.confirm('🚨 FINAL WARNING 🚨\n\nClick OK to continue or Cancel to abort.')) return;
                      const typed = window.prompt('Type YES to confirm:');
                      if (typed !== 'YES') { alert('❌ Cancelled — you did not type YES'); return; }
                      try {
                        const playersRef = ref(database, 'players');
                        const snapshot = await get(playersRef);
                        if (!snapshot.exists()) { alert('❌ No players in Firebase'); return; }
                        const players = snapshot.val();
                        let count = 0; const notFound = [];
                        for (const [firebaseKey, player] of Object.entries(players)) {
                          const matchingCode = Object.entries(PLAYER_CODES).find(([, name]) => name === player.playerName);
                          if (matchingCode) {
                            await update(ref(database, `players/${firebaseKey}`), { playerCode: matchingCode[0], updatedAt: Date.now() });
                            count++;
                          } else { notFound.push(player.playerName); }
                        }
                        alert(`✅ Emergency Override Complete!\n\nUpdated ${count} player codes.\n${notFound.length > 0 ? `\n⚠️ Not found: ${notFound.join(', ')}` : ''}\n\nREFRESH PAGE NOW!`);
                      } catch (error) { alert('❌ Error: ' + error.message); }
                    }}
                  >
                    ⚠️ EMERGENCY: Override Firebase
                    <span style={{ marginLeft: '8px', fontSize: '0.68rem', padding: '2px 6px', background: '#991b1b', color: 'white', borderRadius: '10px', fontWeight: '500' }}>DANGER</span>
                  </button>
                )}
              </div>
            </>
          );
        })()}
        {/* Conditional Content Based on View */}
        {currentView === 'standings' && codeValidated ? (
          <StandingsPage 
            allPicks={allPicks}
            allPicksAPPTV={allPicksAPPTV}
            allPicksAPPTB={allPicksAPPTB}
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
            psOverrides={psOverrides}
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
            psOverrides={psOverrides}
          />
        ) : currentView === 'newSeason' && codeValidated && isPoolManager() ? (
          <NewSeasonSetup
            database={database}
            POOL_MANAGER_CODES={POOL_MANAGER_CODES}
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
        ) : currentView === 'pool34Setup' && codeValidated && isPoolManager() ? (
          <Pool34Setup
            pool34Enabled={pool34Enabled}
            bettingLines={bettingLines}
            bettingLinesForm={bettingLinesForm}
            setBettingLinesForm={setBettingLinesForm}
            currentWeek={currentWeek}
            currentWeekData={currentWeekData}
            playoffTeams={playoffTeams}
            teamCodes={teamCodes}
            getTeamName={(week, gameId, pos, playoffTeamsArg) => getTeamName(week, gameId, pos, playoffTeamsArg || playoffTeams, null, teamCodes)}
            actualScores={actualScores}
            gradingOverrides={gradingOverrides}
            onToggleKillSwitch={async (newVal) => {
              await set(ref(database, 'pool34_enabled'), newVal);
            }}
            onSaveBettingLines={async (lines) => {
              await set(ref(database, 'betting_lines'), lines);
              alert('✅ Betting lines saved!');
            }}
            onSaveGradingOverrides={async (overrides) => {
              await set(ref(database, 'grading_overrides'), overrides);
            }}
          />
        ) : currentView === 'pool34Picks' && codeValidated && pool34Enabled ? (
          <>
          {console.log('🎯 POOL3 RENDER START', {pool34Enabled, currentWeek, bettingLines: !!bettingLines, currentWeekData: !!currentWeekData, allPicksPool3: allPicksPool3?.length})}
          {/* ── Logout + Nuclear Clear bar — top of Pool #3 page ── */}
          <div className="player-confirmed">
            <span className="confirmation-badge">✓ VERIFIED</span>
            <h3>Welcome, <span className="player-name-highlight">{playerName}</span>!</h3>
            <div style={{
              display: 'inline-block', padding: '8px 20px', marginBottom: '10px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white', borderRadius: '25px', fontWeight: 'bold', fontSize: '1.1rem',
              boxShadow: '0 4px 15px rgba(102,126,234,0.4)', letterSpacing: '0.5px'
            }}>
              {currentWeek === 'wildcard' && '📅 WEEK 1 OF 4'}
              {currentWeek === 'divisional' && '📅 WEEK 2 OF 4'}
              {currentWeek === 'conference' && '📅 WEEK 3 OF 4'}
              {currentWeek === 'superbowl' && '📅 WEEK 4 OF 4'}
            </div>
            <p style={{color: '#000', marginTop: '8px'}}>
              Making picks for: <strong>{currentWeekData.name}</strong>
            </p>
            {isWeekLocked(currentWeek) && !isPoolManager() && (
              <div style={{
                marginTop: '10px', padding: '10px 15px',
                background: '#fff3cd', border: '2px solid #ffc107',
                borderRadius: '6px', color: '#856404', fontWeight: '600'
              }}>
                🔒 This week is LOCKED - You can view your picks but cannot edit them
              </div>
            )}
            <div style={{ display: 'flex', gap: '12px', marginTop: '15px', flexWrap: 'wrap' }}>
              <div style={{ flex: '1', minWidth: '200px', display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '4px' }}>
                <button
                  className="validate-btn"
                  style={{ width: '100%', padding: '10px 20px', fontSize: '0.9rem', touchAction: 'manipulation' }}
                  onClick={handleLogout}
                >
                  &#x1F6AA; Logout / Switch Entry
                </button>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', fontSize: '0.68rem', color: '#aaa', letterSpacing: '0.08em', userSelect: 'none' }}>
                  <span>v:K7M2XP</span>
                  <span
                    title="R9T4WQ"
                    style={{ background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', padding: '1px 6px', cursor: 'default', fontSize: '0.7rem' }}
                  >&#x1F511;</span>
                </div>
              </div>
              <button
                disabled={isWeekLocked(currentWeek) || !isSubmissionAllowed()}
                style={{
                  flex: '1', minWidth: '200px', padding: '10px 20px', fontSize: '0.9rem',
                  background: (isWeekLocked(currentWeek) || !isSubmissionAllowed()) ? '#ccc' : 'linear-gradient(135deg, #1a1a2e 0%, #c0392b 100%)',
                  color: '#fff', border: 'none', borderRadius: '8px',
                  fontWeight: '700', cursor: (isWeekLocked(currentWeek) || !isSubmissionAllowed()) ? 'not-allowed' : 'pointer',
                  boxShadow: (isWeekLocked(currentWeek) || !isSubmissionAllowed()) ? 'none' : '0 4px 12px rgba(192,57,43,0.5)'
                }}
                onClick={handleNuclearClear}
              >
                💥 Nuclear Clear — Wipe All Picks
              </button>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#0d0000', marginTop: '10px', fontStyle: 'italic' }}>
              💡 Playing with multiple entries? Logout to switch between your codes.
            </p>
          </div>
          <Pool34Picks
            playerName={playerName}
            playerCode={playerCode}
            currentWeek={currentWeek}
            currentWeekData={currentWeekData}
            playoffTeams={playoffTeams}
            getTeamName={(week, gameId, pos, pt) => getTeamName(week, gameId, pos, pt, null, teamCodes)}
            bettingLines={bettingLines}
            predictionsPool3={predictionsPool3}
            setPredictionsPool3={setPredictionsPool3}
            predictionsAPPTV={predictionsAPPTV}
            predictionsAPPTB={predictionsAPPTB}
            allPicksPool3={allPicksPool3}
            allPicksAPPTV={allPicksAPPTV}
            allPicksAPPTB={allPicksAPPTB}
            pool3Dirty={pool3Dirty}
            setPool3Dirty={setPool3Dirty}
            pool3CancelSnapshot={pool3CancelSnapshot}
            setPool3CancelSnapshot={setPool3CancelSnapshot}
            pool3ManuallyEdited={pool3ManuallyEdited}
            setPool3ManuallyEdited={setPool3ManuallyEdited}
            isWeekLocked={isWeekLocked}
            isSubmissionAllowed={isSubmissionAllowed}
            database={database}
          />
          <div style={{ borderTop: '3px solid #e5e7eb', marginTop: '8px', paddingTop: '8px' }}>
            <Pool34Prizes
              allPicksPool3={allPicksPool3}
              bettingLines={bettingLines}
              actualScores={actualScores}
              gradingOverrides={gradingOverrides}
              playoffTeams={playoffTeams}
              getTeamName={getTeamName}
              lockDates={playoffDates?.autoLockDates || AUTO_LOCK_DATES_FALLBACK}
              prizePool={prizePool}
              psOverrides={psOverrides}
            />
          </div>

          {/* ── Pool #3 All-Players Picks Table ── */}
          {(() => {
            const weekLines = bettingLines?.[currentWeek] || {};
            const games = currentWeekData.games;

            // Friday deadline blind-lock check (same logic as Pool #1/#2)
            const isPool4Locked = (() => {
              if (isPoolManager()) return false;
              const deadlineDate = playoffDates?.[currentWeek];
              if (!deadlineDate) return false;
              const deadline = new Date(deadlineDate);
              deadline.setHours(23, 59, 59, 999);
              return new Date() < deadline;
            })();

            // Build combined player list — one entry per player per pool
            const buildRows = (poolPicks, poolKey) => {
              const byPlayer = new Map();
              poolPicks
                .filter(p => p.week === currentWeek)
                .forEach(p => {
                  // Skip Pool Manager entries
                  if (POOL_MANAGER_CODES.includes(p.playerCode)) return;
                  if (!byPlayer.has(p.playerCode)) byPlayer.set(p.playerCode, p);
                });
              // Add paid players with no picks — exclude Pool Manager
              allPlayers.forEach(player => {
                const isPaid = player.paid === true || player.paymentStatus === 'PAID';
                const isRegularPlayer = player.role !== 'MANAGER';
                const isVisible = player.visible !== false;
                if (isPaid && isRegularPlayer && isVisible && !byPlayer.has(player.playerCode)) {
                  byPlayer.set(player.playerCode, {
                    playerName: player.playerName,
                    playerCode: player.playerCode,
                    week: currentWeek,
                    picks: {},
                    timestamp: Date.now(),
                    lastUpdated: Date.now()
                  });
                }
              });
              return Array.from(byPlayer.values())
                .sort((a, b) => (b.lastUpdated || b.timestamp || 0) - (a.lastUpdated || a.timestamp || 0))
                .map(p => ({ ...p, poolKey }));
            };

            const pool3Rows = buildRows(allPicksPool3, 'pool3');
            const displayRows = pool3Rows;

            // Grading helpers for Pool #3
            // line.favourite = favourite team name, line.spread = spread number, line.overUnder = O/U total

            const gradeWinner = (pick, gameId) => {
              const actual = actualScores[currentWeek]?.[gameId];
              if (!actual?.team1 || !actual?.team2 || !pick?.winner) return null;
              const t1 = parseInt(actual.team1), t2 = parseInt(actual.team2);
              if (isNaN(t1) || isNaN(t2) || t1 === t2) return null;
              const actualWinner = t1 > t2
                ? getTeamName(currentWeek, gameId, 'team1', playoffTeams)
                : getTeamName(currentWeek, gameId, 'team2', playoffTeams);
              // fuzzy match — pick.winner may be abbreviation
              return pick.winner === actualWinner
                || actualWinner?.includes(pick.winner)
                || pick.winner?.includes(actualWinner);
            };

            const gradeAts = (pick, gameId) => {
              const actual = actualScores[currentWeek]?.[gameId];
              const line = weekLines[gameId];
              if (!actual?.team1 || !actual?.team2 || !pick?.ats || !line?.favourite || !line?.spread) return null;
              const t1 = parseInt(actual.team1), t2 = parseInt(actual.team2);
              if (isNaN(t1) || isNaN(t2)) return null;
              const spread = parseFloat(line.spread); // positive number e.g. 7.5
              const favName = line.favourite;
              const t1Name = getTeamName(currentWeek, gameId, 'team1', playoffTeams);
              const favIsTeam1 = t1Name === favName || t1Name?.includes(favName) || favName?.includes(t1Name);
              // actual margin from favourite's perspective
              const favMargin = favIsTeam1 ? (t1 - t2) : (t2 - t1);
              const atsResult = favMargin > spread ? 'favourite' : 'underdog';
              if (favMargin === spread) return null; // push
              const pickIsFav = pick.ats === favName || favName?.includes(pick.ats) || pick.ats?.includes(favName);
              return pickIsFav ? atsResult === 'favourite' : atsResult === 'underdog';
            };

            const gradeOu = (pick, gameId) => {
              const actual = actualScores[currentWeek]?.[gameId];
              const line = weekLines[gameId];
              if (!actual?.team1 || !actual?.team2 || !pick?.ou || !line?.overUnder) return null;
              const total = parseInt(actual.team1) + parseInt(actual.team2);
              if (isNaN(total)) return null;
              const ouLine = parseFloat(line.overUnder);
              if (total === ouLine) return null; // push
              return (pick.ou === 'over') === (total > ouLine);
            };

            // Pre-compute per-player stats for sorting
            const _sortAllWks = ['wildcard','divisional','conference','superbowl'];
            const _rowStats = new Map(displayRows.map(row => {
              const hide = isPool4Locked && row.playerCode !== playerCode;
              let wPts = 0;
              if (!hide) games.forEach(game => {
                const pick = row.picks?.[game.id];
                if (!pick) return;
                if (gradeWinner(pick, game.id) === true) wPts += 2;
                if (gradeAts(pick, game.id) === true) wPts += 3;
                if (gradeOu(pick, game.id) === true) wPts += 3;
              });
              let sTot = 0;
              _sortAllWks.forEach(wk => {
                const wa = actualScores[wk];
                if (!wa || !Object.values(wa).some(g => g?.team1 && g?.team2)) return;
                const pwp = allPicksPool3.find(p => p.playerCode === row.playerCode && p.week === wk);
                if (!pwp) return;
                sTot += (gradePool34WeekFull(pwp, wk, bettingLines, actualScores, gradingOverrides, playoffTeams, getTeamName).points || 0);
              });
              return [row.playerCode + '|' + (row.week || ''), { weekPts: wPts, seasonTotal: sTot }];
            }));
            const sortedDisplayRows = [...displayRows].sort((a, b) => {
              const aStats = _rowStats.get(a.playerCode + '|' + (a.week || '')) || {};
              const bStats = _rowStats.get(b.playerCode + '|' + (b.week || '')) || {};
              let av, bv;
              if (pool3SortCol === 'player') { av = (a.playerName||'').toLowerCase(); bv = (b.playerName||'').toLowerCase(); }
              else if (pool3SortCol === 'weekPts') { av = aStats.weekPts||0; bv = bStats.weekPts||0; }
              else if (pool3SortCol === 'seasonTotal') { av = aStats.seasonTotal||0; bv = bStats.seasonTotal||0; }
              else { av = a.lastUpdated||a.timestamp||0; bv = b.lastUpdated||b.timestamp||0; }
              return av < bv ? (pool3SortDir === 'asc' ? -1 : 1) : av > bv ? (pool3SortDir === 'asc' ? 1 : -1) : 0;
            });

            // Helper: get display strings for ATS and O/U columns
            const getAtsDisplay = (gameId) => {
              const line = weekLines[gameId];
              if (!line?.favourite || !line?.spread) return { fav: 'Fav', dog: 'Dog' };
              const t1 = getTeamName(currentWeek, gameId, 'team1', playoffTeams);
              const t2 = getTeamName(currentWeek, gameId, 'team2', playoffTeams);
              const spread = parseFloat(line.spread);
              const favName = line.favourite;
              const dogName = favName === t1 ? t2 : t1;
              return {
                fav: `${favName} -${spread}`,
                dog: `${dogName} +${spread}`
              };
            };

            const getOuDisplay = (gameId) => {
              const line = weekLines[gameId];
              if (!line?.overUnder) return { over: 'Over', under: 'Under' };
              return {
                over: `Over ${line.overUnder}`,
                under: `Under ${line.overUnder}`
              };
            };

            const cellStyle = (correct) => ({
              textAlign: 'center',
              padding: '5px 3px',
              fontSize: '0.82rem',
              background: correct === true ? '#d4edda' : correct === false ? '#f8d7da' : 'transparent',
              color: correct === true ? '#155724' : correct === false ? '#721c24' : '#333',
              fontWeight: correct !== null ? 'bold' : 'normal'
            });

            return (
              <div style={{ marginTop: '24px', borderTop: '3px solid #7c3aed', paddingTop: '16px' }}>
                {/* Header */}
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                    🎯 Pool #3 Winner, ATS, O/U Player Picks — {currentWeekData.name}
                  </h2>
                  <button
                    onClick={downloadPool3CSV}
                    style={{
                      padding: '8px 16px',
                      background: '#7c3aed',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    📥 Download Pool #3 CSV {isPoolManager() ? '(All Weeks)' : ''}
                  </button>
                </div>

                {/* Scoring education banner - top, high contrast */}
                <div style={{
                  padding: '10px 16px', marginBottom: '12px',
                  background: '#1e1b4b', borderRadius: '8px',
                  fontSize: '0.92rem', color: '#fff', fontWeight: '600',
                  lineHeight: '1.6'
                }}>
                  🏈 <strong>Points Awarded Per Game:</strong>&nbsp;
                  🏆 Correct Winner = <span style={{color:'#86efac'}}>2 pts</span>&nbsp;|&nbsp;
                  📊 Correct ATS = <span style={{color:'#93c5fd'}}>3 pts</span>&nbsp;|&nbsp;
                  📈 Correct O/U = <span style={{color:'#fcd34d'}}>3 pts</span>&nbsp;|&nbsp;
                  Maximum = <span style={{color:'#f9a8d4'}}>8 pts per game</span>
                  <br/>
                  <span style={{fontSize:'0.82rem', opacity:0.85}}>
                    🟩 Green = correct pick &nbsp;|&nbsp; 🟥 Red = incorrect pick &nbsp;|&nbsp; White = game not yet graded &nbsp;|&nbsp; 🔒 Pool #3 picks are Blind — hidden until Friday deadline
                  </span>
                </div>

                {/* Filter buttons */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                  {[
                    { key: 'all',   label: '👥 All Players' },
  
                  ].map(({ key, label }) => (
                    <button key={key} onClick={() => setPool3TableFilter(key)} style={{
                      padding: '8px 18px', fontSize: '0.9rem', fontWeight: 'bold',
                      border: pool3TableFilter === key ? '3px solid #333' : '2px solid #ccc',
                      borderRadius: '20px',
                      background: pool3TableFilter === key
                        ? (key === 'pool3' ? '#fffde7' : key === 'none' ? '#e3f2fd' : '#ede9fe')
                        : '#f9f9f9',
                      color: pool3TableFilter === key
                        ? (key === 'pool3' ? '#b45309' : key === 'none' ? '#1565c0' : '#4c1d95')
                        : '#666',
                      cursor: 'pointer'
                    }}>{label}</button>
                  ))}
                </div>

                {displayRows.length === 0 ? (
                  <p style={{ color: '#666', fontStyle: 'italic' }}>No picks submitted yet for this week.</p>
                ) : (
                  <div style={{ overflowX: 'auto', paddingBottom: '12px' }}>
                    <table style={{ fontSize: '0.82rem', width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
                      <thead>
                        {/* Row 1: Game headers spanning 3 cols each */}
                        <tr style={{ background: '#4c1d95', color: '#fff' }}>
                          <th rowSpan="2" onClick={() => { if (pool3SortCol === 'player') { setPool3SortDir(d => d === 'asc' ? 'desc' : 'asc'); } else { setPool3SortCol('player'); setPool3SortDir('asc'); } }} style={{ padding: '8px 8px', textAlign: 'left', minWidth: '110px', borderRight: '2px solid #7c3aed', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }}>
                            Player {pool3SortCol === 'player' ? (pool3SortDir === 'asc' ? '↑' : '↓') : '⇅'}
                          </th>
                          {games.map((game, gi) => {
                            const t1 = getTeamName(currentWeek, game.id, 'team1', playoffTeams);
                            const t2 = getTeamName(currentWeek, game.id, 'team2', playoffTeams);
                            const line = weekLines[game.id];
                            const actual = actualScores[currentWeek]?.[game.id];
                            const hasActual = actual?.team1 && actual?.team2;
                            return (
                              <th key={game.id} colSpan="3" style={{
                                padding: '6px 4px', textAlign: 'center',
                                borderLeft: gi > 0 ? '4px solid #1e1b4b' : 'none',
                                fontSize: '0.85rem'
                              }}>
                                <div style={{ fontWeight: 'bold' }}>Game {game.id}</div>
                                {hasActual ? (
                                  <div style={{ fontSize: '0.82rem', fontWeight: 'bold', color: '#fcd34d', marginTop: '1px' }}>
                                    {t1} <span style={{ color: '#fff', fontWeight: '900' }}>{actual.team1}</span>
                                    {' @ '}
                                    {t2} <span style={{ color: '#fff', fontWeight: '900' }}>{actual.team2}</span>
                                    <span style={{ marginLeft: '4px', fontSize: '0.7rem', background: '#16a34a', color: '#fff', padding: '1px 5px', borderRadius: '3px' }}>FINAL</span>
                                  </div>
                                ) : (
                                  <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>{t1} @ {t2}</div>
                                )}
                                {line?.favourite && (
                                  <div style={{ fontSize: '0.72rem', opacity: 0.8, marginTop: '2px' }}>
                                    {line.favourite} -{line.spread} | O/U {line.overUnder}
                                  </div>
                                )}
                              </th>
                            );
                          })}
                          <th rowSpan="2" onClick={() => { if (pool3SortCol === 'weekPts') { setPool3SortDir(d => d === 'asc' ? 'desc' : 'asc'); } else { setPool3SortCol('weekPts'); setPool3SortDir('desc'); } }} style={{ padding: '8px 4px', textAlign: 'center', minWidth: '52px', borderLeft: '3px solid #1e1b4b', fontSize: '0.75rem', background: '#3730a3', cursor: 'pointer', userSelect: 'none' }}>
                            Pts<br/>This<br/>Week<br/>{pool3SortCol === 'weekPts' ? (pool3SortDir === 'asc' ? '↑' : '↓') : '⇅'}
                          </th>
                          <th rowSpan="2" onClick={() => { if (pool3SortCol === 'seasonTotal') { setPool3SortDir(d => d === 'asc' ? 'desc' : 'asc'); } else { setPool3SortCol('seasonTotal'); setPool3SortDir('desc'); } }} style={{ padding: '8px 4px', textAlign: 'center', minWidth: '60px', fontSize: '0.75rem', background: '#065f46', borderLeft: '3px solid #34d399', cursor: 'pointer', userSelect: 'none' }}>
                            Season<br/>Total<br/>{pool3SortCol === 'seasonTotal' ? (pool3SortDir === 'asc' ? '↑' : '↓') : '⇅'}
                          </th>
                          <th rowSpan="2" onClick={() => { if (pool3SortCol === 'timestamp') { setPool3SortDir(d => d === 'asc' ? 'desc' : 'asc'); } else { setPool3SortCol('timestamp'); setPool3SortDir('desc'); } }} style={{ padding: '8px 4px', textAlign: 'center', minWidth: '60px', fontSize: '0.7rem', background: '#1e1b4b', borderLeft: '2px solid #6d28d9', cursor: 'pointer', userSelect: 'none' }}>
                            Submitted<br/>(PST)<br/>{pool3SortCol === 'timestamp' ? (pool3SortDir === 'asc' ? '↑' : '↓') : '⇅'}
                          </th>
                        </tr>
                        {/* Row 2: Winner / ATS / O/U sub-headers */}
                        <tr style={{ background: '#6d28d9', color: '#fff' }}>
                          {games.map((game, gi) => {
                            const line = weekLines[game.id];
                            const atsD = getAtsDisplay(game.id);
                            const ouD = getOuDisplay(game.id);
                            return (
                              <React.Fragment key={`sub-${game.id}`}>
                                <th style={{ padding: '4px 3px', textAlign: 'center', fontSize: '0.72rem', borderLeft: gi > 0 ? '4px solid #1e1b4b' : 'none', minWidth: '55px' }}>
                                  Winner
                                </th>
                                <th style={{ padding: '4px 3px', textAlign: 'center', fontSize: '0.72rem', minWidth: '70px' }}>
                                  ATS<br/>
                                  <span style={{ opacity: 0.8, fontWeight: 400, fontSize: '0.65rem' }}>
                                    {line ? <>{atsD.fav}<br/>{atsD.dog}</> : '—'}
                                  </span>
                                </th>
                                <th style={{ padding: '4px 3px', textAlign: 'center', fontSize: '0.72rem', minWidth: '60px' }}>
                                  O/U<br/>
                                  <span style={{ opacity: 0.8, fontWeight: 400, fontSize: '0.65rem' }}>
                                    {line ? <>{ouD.over}<br/>{ouD.under}</> : '—'}
                                  </span>
                                </th>
                              </React.Fragment>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {sortedDisplayRows.map((row, idx) => {
                          const isMyRow = row.playerCode === playerCode;
                          const shouldHide = isPool4Locked && !isMyRow;
                          const rowBg = pool3TableFilter === 'all' ? '#ede9fe' : 'transparent';
                          // Per-row stats — read from pre-computed cache
                          const _rs = _rowStats.get(row.playerCode + '|' + (row.week || '')) || {};
                          const weekPts = _rs.weekPts || 0;
                          const seasonTotal = _rs.seasonTotal || 0;

                          return (
                            <tr key={idx} style={{ background: rowBg, borderBottom: '1px solid #e5e7eb' }}>
                              <td style={{ padding: '6px 8px', fontSize: '0.82rem', fontWeight: '600', borderRight: '2px solid #e5e7eb', minWidth: '110px', whiteSpace: 'nowrap', color: '#000' }}>
                                {row.playerName}
                                <span style={{ fontSize: '0.68rem', color: '#7c3aed', fontWeight: '700', marginLeft: '3px' }}>🔒</span>
                                {isPoolManager() && (
                                  <button
                                    onClick={async () => {
                                      if (!window.confirm(`🗑️ Remove ${row.playerName}'s Pool #3 picks for ${currentWeek}?\n\nThis permanently deletes their Pool #3 picks from Firebase.\n\nClick OK to remove, Cancel to keep.`)) return;
                                      try {
                                        const recs = allPicksPool3.filter(p => p.playerCode === row.playerCode && p.week === currentWeek);
                                        if (recs.length === 0) { alert('No Firebase record found for this player.'); return; }
                                        for (const rec of recs) {
                                          if (rec.firebaseKey) await remove(ref(database, `picks_pool3/${rec.firebaseKey}`));
                                        }
                                      } catch(e) { alert('Error removing picks: ' + e.message); }
                                    }}
                                    title={`Remove ${row.playerName}'s Pool #3 picks`}
                                    style={{ display: 'block', marginTop: '4px', padding: '2px 6px', fontSize: '0.65rem', background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '4px', cursor: 'pointer', fontWeight: '700', width: '100%' }}
                                  >
                                    🗑️ Remove
                                  </button>
                                )}
                              </td>
                              {games.map((game, gi) => {
                                const pick = row.picks?.[game.id];
                                const wCorrect = pick ? gradeWinner(pick, game.id) : null;
                                const aCorrect = pick ? gradeAts(pick, game.id) : null;
                                const oCorrect = pick ? gradeOu(pick, game.id) : null;
                                const line = weekLines[game.id];

                                if (shouldHide) {
                                  return (
                                    <React.Fragment key={`${idx}-${game.id}`}>
                                      <td style={{ ...cellStyle(null), borderLeft: gi > 0 ? '4px solid #2c3e50' : 'none' }}>🔒</td>
                                      <td style={cellStyle(null)}>🔒</td>
                                      <td style={cellStyle(null)}>🔒</td>
                                    </React.Fragment>
                                  );
                                }

                                const ouDisplay = pick?.ou
                                  ? (pick.ou === 'over'
                                      ? `O ${weekLines[game.id]?.overUnder || ''}`
                                      : `U ${weekLines[game.id]?.overUnder || ''}`)
                                  : '-';

                                return (
                                  <React.Fragment key={`${idx}-${game.id}`}>
                                    <td style={{ ...cellStyle(wCorrect), borderLeft: gi > 0 ? '4px solid #2c3e50' : 'none' }}>
                                      {pick?.winner || '-'}
                                    </td>
                                    <td style={cellStyle(aCorrect)}>
                                      {pick?.ats || '-'}
                                    </td>
                                    <td style={cellStyle(oCorrect)}>
                                      {ouDisplay}
                                    </td>
                                  </React.Fragment>
                                );
                              })}
                              {/* Points this week */}
                              <td style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '0.9rem', borderLeft: '3px solid #e5e7eb', color: weekPts > 0 ? '#155724' : '#999', background: '#f3f4f6' }}>
                                {shouldHide ? '🔒' : `${weekPts}`}
                              </td>
                              {/* Season Total */}
                              <td style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '0.9rem', borderLeft: '3px solid #34d399', color: seasonTotal > 0 ? '#065f46' : '#999', background: '#d1fae5' }}>
                                {shouldHide ? '🔒' : `${seasonTotal}`}
                              </td>
                              {/* Timestamp */}
                              <td style={{ textAlign: 'center', fontSize: '0.72rem', color: '#555', padding: '4px 3px', whiteSpace: 'nowrap' }}>
                                {row.lastUpdated || row.timestamp
                                  ? new Date(row.lastUpdated || row.timestamp).toLocaleString('en-US', {
                                      timeZone: 'America/Los_Angeles',
                                      month: '2-digit', day: '2-digit',
                                      hour: '2-digit', minute: '2-digit',
                                      second: '2-digit'
                                    }) + ' PST'
                                  : '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}

          </>
        ) : currentView === 'playoffSetup' && codeValidated ? (

          <PlayoffTeamsSetup
            playoffTeams={playoffTeams}
            actualScores={actualScores}
            onSavePlayoffTeams={handleSavePlayoffTeams}
            isPoolManager={isPoolManager()}
            database={database}
            weekCompletionStatus={weekCompletionStatus}
            playoffDates={playoffDates}
            onSavePlayoffDates={setPlayoffDates}
          />
        ) : (
          <>
        {/* Code Entry */}
        {!codeValidated ? (        
          <div className="prediction-form">
            <div className="code-entry-section">
              <div style={{background:'#ff0000',color:'#fff',fontWeight:'900',fontSize:'1.2rem',padding:'8px',borderRadius:'6px',marginBottom:'12px',textAlign:'center'}}>✅ NEW FILE LOADED - Mar 5 2026</div>
              <h3>🔐 Enter Your Player Code</h3>
              <p style={{marginBottom: '20px', color: '#666'}}>
                You received a 6-character code when you paid your ${prizePool?.entryFee > 0 ? `$${prizePool.entryFee}` : ''} entry fee.
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
                    <strong>Cost:</strong> ${prizePool?.entryFee > 0 ? prizePool.entryFee : '—'} per entry
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
              {/* Logout + Nuclear Clear bar */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '15px', flexWrap: 'wrap' }}>
                <button
                  className="validate-btn"
                  style={{ flex: '1', minWidth: '200px', padding: '10px 20px', fontSize: '0.9rem' }}
                  onClick={handleLogout}
                >
                  🚪 Logout / Switch Entry
                </button>
                <button
                  disabled={isWeekLocked(currentWeek) || !isSubmissionAllowed()}
                  style={{
                    flex: '1', minWidth: '200px', padding: '10px 20px', fontSize: '0.9rem',
                    background: (isWeekLocked(currentWeek) || !isSubmissionAllowed()) ? '#ccc' : 'linear-gradient(135deg, #1a1a2e 0%, #c0392b 100%)',
                    color: '#fff', border: 'none', borderRadius: '8px',
                    fontWeight: '700', cursor: (isWeekLocked(currentWeek) || !isSubmissionAllowed()) ? 'not-allowed' : 'pointer',
                    boxShadow: (isWeekLocked(currentWeek) || !isSubmissionAllowed()) ? 'none' : '0 4px 12px rgba(192,57,43,0.5)'
                  }}
                  onClick={handleNuclearClear}
                >
                  💥 Nuclear Clear — Wipe All Picks
                </button>
              </div>
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
                  The 2026 NFL Playoff teams will be determined after the regular season ends by end of day January 4, 2027.
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

            {/* Prediction Form - Dual Row (VISIBLE + BLIND) — always shown, not hidden in combined */}
            {!overrideTableTarget && (
            <div className="prediction-form">
              {/* Week Header */}
              <div style={{
                background: 'linear-gradient(135deg, #1a237e 0%, #283593 100%)',
                color: '#fff',
                padding: '15px 20px',
                borderRadius: '8px',
                marginBottom: '20px',
                textAlign: 'center',
                fontSize: '1.2rem',
                fontWeight: 'bold',
                boxShadow: '0 4px 6px rgba(0,0,0,0.15)',
              }}>
                📋 Enter My Picks — Week #{currentWeek === 'wildcard' ? '1' : currentWeek === 'divisional' ? '2' : currentWeek === 'conference' ? '3' : '4'} — For both Pool #1 and Pool #2
                <div style={{fontSize: '0.85rem', fontWeight: '400', marginTop: '5px', opacity: 0.9}}>
                  Deadline: <strong>Friday 11:59 PM PST</strong> — both pools close at the same time
                </div>
              </div>
              
              {overrideAction === 'manual' ? (
                <h2 style={{color: '#e74c3c'}}>
                  ⚡ OVERRIDE MODE: Entering Picks for {PLAYER_CODES[selectedPlayerForOverride]}
                </h2>
              ) : (
                <div style={{marginBottom: '16px'}}>
                  {/* NFL Scoring Guide Button */}
                  <button
                    type="button"
                    onClick={() => setShowScoringGuide(true)}
                    style={{
                      width: '100%',
                      padding: '12px 15px',
                      marginBottom: '12px',
                      fontSize: '1rem',
                      fontWeight: 'bold',
                      color: 'white',
                      background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                      border: 'none',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(245, 87, 108, 0.35)',
                    }}
                  >
                    📊 NFL Scoring Guide - 2025 Season Stats
                  </button>
                  {/* RNG Quick-Fill Buttons */}
                  {!isWeekLocked(currentWeek) && (
                    <div style={{display: 'flex', gap: '8px', flexWrap: 'wrap'}}>
                      <button type="button" onClick={handleRNGVisible} style={{flex: '1', minWidth: '120px', padding: '9px 12px', background: '#fffbea', border: '2px solid #f59e0b', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '700', color: '#92400e'}}>
                        🎲🟡 RNG Visible — Pool #1 Only
                      </button>
                      <button type="button" onClick={handleRNGBlind} style={{flex: '1', minWidth: '120px', padding: '9px 12px', background: '#eff6ff', border: '2px solid #1976d2', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '700', color: '#1565c0'}}>
                        🎲🔵 RNG Blind — Pool #2 Only
                      </button>
                      <button type="button" onClick={handleRNGBoth} style={{flex: '1', minWidth: '120px', padding: '9px 12px', background: '#f3f4f6', border: '2px solid #6b7280', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '700', color: '#374151'}}>
                        🎲 RNG Both — Pool #1 & #2
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Dual Progress Indicator */}
              {overrideAction !== 'manual' && (
                <div className="progress-indicator" style={{marginBottom: '16px'}}>
                  <div style={{display: 'flex', gap: '12px', flexWrap: 'wrap'}}>
                    {/* Visible progress */}
                    <div style={{flex: '1', minWidth: '140px'}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '4px'}}>
                        <span style={{color: '#b45309', fontWeight: '700'}}>🟡 Visible</span>
                        <span>{Object.keys(predictionsAPPTV).filter(g => predictionsAPPTV[g]?.team1 && predictionsAPPTV[g]?.team2).length}/{currentWeekData.games.length}</span>
                      </div>
                      <div className="progress-bar" style={{height: '10px'}}>
                        <div className="progress-fill" style={{
                          width: `${(Object.keys(predictionsAPPTV).filter(g => predictionsAPPTV[g]?.team1 && predictionsAPPTV[g]?.team2).length / currentWeekData.games.length) * 100}%`,
                          background: '#f59e0b'
                        }} />
                      </div>
                    </div>
                    {/* Blind progress */}
                    <div style={{flex: '1', minWidth: '140px'}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '4px'}}>
                        <span style={{color: '#1565c0', fontWeight: '700'}}>🔵 Blind</span>
                        <span>{Object.keys(predictionsAPPTB).filter(g => predictionsAPPTB[g]?.team1 && predictionsAPPTB[g]?.team2).length}/{currentWeekData.games.length}</span>
                      </div>
                      <div className="progress-bar" style={{height: '10px'}}>
                        <div className="progress-fill" style={{
                          width: `${(Object.keys(predictionsAPPTB).filter(g => predictionsAPPTB[g]?.team1 && predictionsAPPTB[g]?.team2).length / currentWeekData.games.length) * 100}%`,
                          background: '#1976d2'
                        }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── ONE-TIME BLIND EDIT WARNING BANNER ── */}
              {blindEditWarningShown && (
                <div style={{
                  margin: '0 0 16px 0',
                  padding: '12px 16px',
                  background: '#e3f2fd',
                  border: '2px solid #1976d2',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  color: '#0d47a1',
                  lineHeight: '1.5'
                }}>
                  🔵 <strong>Editing your Blind Pick will reset your timestamp.</strong><br />
                  If you're tied for first in the Blind Pool, an earlier timestamp gives you the tiebreaker edge. Submit before Wednesday 11:59 PM PST to protect that edge.
                  <button onClick={() => setBlindEditWarningShown(false)} style={{float: 'right', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: '#1565c0', fontWeight: 'bold'}}>✕</button>
                </div>
              )}

              {/* ── GAME CARDS — dual VISIBLE + BLIND rows ── */}
              {currentWeekData.games.map(game => {
                const awayName = getTeamName(currentWeek, game.id, 'team1', playoffTeams);
                const homeName = getTeamName(currentWeek, game.id, 'team2', playoffTeams);
                const actual = actualScores[currentWeek]?.[game.id];
                const status = gameStatus[currentWeek]?.[game.id];
                const isLocked = isWeekLocked(currentWeek);

                return (
                  <div key={game.id} className="game-prediction" data-game-id={game.id} style={{marginBottom: '20px', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)'}}>
                    {/* Game title bar */}
                    <div style={{background: '#37474f', color: '#fff', padding: '10px 16px', fontWeight: 'bold', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px'}}>
                      <span>Game {game.id}: {awayName} @ {homeName}</span>
                      {actual && (
                        <span style={{fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px'}}>
                          Actual: <strong>{actual.team1} – {actual.team2}</strong>
                          {status === 'final' && <span style={{background: '#4caf50', padding: '2px 7px', borderRadius: '4px', fontSize: '0.75rem'}}>✅ FINAL</span>}
                          {status === 'live' && <span style={{background: '#ff9800', padding: '2px 7px', borderRadius: '4px', fontSize: '0.75rem'}}>🔴 LIVE</span>}
                        </span>
                      )}
                    </div>

                    {/* 🟡 VISIBLE PICK ROW */}
                    <div style={{background: '#fffde7', borderBottom: '1px solid #e0e0e0', padding: '12px 16px'}}>
                      <div style={{display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap'}}>
                        <div style={{fontWeight: '700', fontSize: '0.9rem', color: '#b45309', minWidth: '120px', display: 'flex', alignItems: 'center', gap: '6px'}}>
                          🟡 VISIBLE PICK - Pool #1
                        </div>
                        <div style={{display: 'flex', alignItems: 'center', gap: '8px', flex: '1', flexWrap: 'wrap'}}>
                          <div style={{textAlign: 'center'}}>
                            <div style={{fontSize: '0.7rem', color: '#666', marginBottom: '3px'}}>AWAY — {awayName}</div>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={predictionsAPPTV[game.id]?.team1 ?? ''}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (/^\d{0,3}$/.test(value)) {
                                  if (!visiblePicksDirty && !visibleCancelSnapshot) {
                                    setVisibleCancelSnapshot(JSON.parse(JSON.stringify(predictionsAPPTV)));
                                  }
                                  setPredictionsAPPTV(prev => ({...prev, [game.id]: {...prev[game.id], team1: value}}));
                                  setVisiblePicksDirty(true);
                                  setHasUnsavedChanges(true);
                                }
                              }}
                              placeholder="—"
                              disabled={isLocked}
                              maxLength="3"
                              style={{width: '52px', textAlign: 'center', fontSize: '1.2rem', fontWeight: 'bold', padding: '6px', border: '2px solid #f59e0b', borderRadius: '6px', background: isLocked ? '#f5f5f5' : '#fff'}}
                            />
                          </div>
                          <div style={{fontWeight: 'bold', color: '#666', fontSize: '1rem', paddingTop: '16px'}}>VS</div>
                          <div style={{textAlign: 'center'}}>
                            <div style={{fontSize: '0.7rem', color: '#666', marginBottom: '3px'}}>HOME — {homeName}</div>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={predictionsAPPTV[game.id]?.team2 ?? ''}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (/^\d{0,3}$/.test(value)) {
                                  if (!visiblePicksDirty && !visibleCancelSnapshot) {
                                    setVisibleCancelSnapshot(JSON.parse(JSON.stringify(predictionsAPPTV)));
                                  }
                                  setPredictionsAPPTV(prev => ({...prev, [game.id]: {...prev[game.id], team2: value}}));
                                  setVisiblePicksDirty(true);
                                  setHasUnsavedChanges(true);
                                }
                              }}
                              placeholder="—"
                              disabled={isLocked}
                              maxLength="3"
                              style={{width: '52px', textAlign: 'center', fontSize: '1.2rem', fontWeight: 'bold', padding: '6px', border: '2px solid #f59e0b', borderRadius: '6px', background: isLocked ? '#f5f5f5' : '#fff'}}
                            />
                          </div>
                        </div>
                        <div style={{fontSize: '0.75rem', color: '#92400e', fontStyle: 'italic', flexShrink: 0}}>Visible to all players immediately</div>
                      </div>
                    </div>

                    {/* 🔵 BLIND PICK ROW */}
                    <div style={{background: '#e3f2fd', padding: '12px 16px'}}>
                      <div style={{display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap'}}>
                        <div style={{fontWeight: '700', fontSize: '0.9rem', color: '#1565c0', minWidth: '120px', display: 'flex', alignItems: 'center', gap: '6px'}}>
                          🔵 BLIND PICK - Pool #2
                        </div>
                        <div style={{display: 'flex', alignItems: 'center', gap: '8px', flex: '1', flexWrap: 'wrap'}}>
                          <div style={{textAlign: 'center'}}>
                            <div style={{fontSize: '0.7rem', color: '#555', marginBottom: '3px'}}>AWAY — {awayName}</div>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={predictionsAPPTB[game.id]?.team1 ?? ''}
                              onFocus={() => {
                                const hasSavedBlind = allPicksAPPTB.some(p => p.playerCode === playerCode && p.week === currentWeek);
                                if (hasSavedBlind && !blindEditWarningShown) {
                                  setBlindEditWarningShown(true);
                                  setBlindCancelSnapshot(JSON.parse(JSON.stringify(predictionsAPPTB)));
                                }
                              }}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (/^\d{0,3}$/.test(value)) {
                                  if (!blindPicksDirty && !blindCancelSnapshot) {
                                    setBlindCancelSnapshot(JSON.parse(JSON.stringify(predictionsAPPTB)));
                                  }
                                  setPredictionsAPPTB(prev => ({...prev, [game.id]: {...prev[game.id], team1: value}}));
                                  setBlindPicksDirty(true);
                                  setHasUnsavedChanges(true);
                                }
                              }}
                              placeholder="—"
                              disabled={isLocked}
                              maxLength="3"
                              style={{width: '52px', textAlign: 'center', fontSize: '1.2rem', fontWeight: 'bold', padding: '6px', border: '2px solid #1976d2', borderRadius: '6px', background: isLocked ? '#f5f5f5' : '#fff'}}
                            />
                          </div>
                          <div style={{fontWeight: 'bold', color: '#555', fontSize: '1rem', paddingTop: '16px'}}>VS</div>
                          <div style={{textAlign: 'center'}}>
                            <div style={{fontSize: '0.7rem', color: '#555', marginBottom: '3px'}}>HOME — {homeName}</div>
                            <input
                              type="text"
                              value={predictionsAPPTB[game.id]?.team2 ?? ''}
                              onFocus={() => {
                                const hasSavedBlind = allPicksAPPTB.some(p => p.playerCode === playerCode && p.week === currentWeek);
                                if (hasSavedBlind && !blindEditWarningShown) {
                                  setBlindEditWarningShown(true);
                                  setBlindCancelSnapshot(JSON.parse(JSON.stringify(predictionsAPPTB)));
                                }
                              }}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (/^\d{0,3}$/.test(value)) {
                                  if (!blindPicksDirty && !blindCancelSnapshot) {
                                    setBlindCancelSnapshot(JSON.parse(JSON.stringify(predictionsAPPTB)));
                                  }
                                  setPredictionsAPPTB(prev => ({...prev, [game.id]: {...prev[game.id], team2: value}}));
                                  setBlindPicksDirty(true);
                                  setHasUnsavedChanges(true);
                                }
                              }}
                              placeholder="—"
                              disabled={isLocked}
                              maxLength="3"
                              style={{width: '52px', textAlign: 'center', fontSize: '1.2rem', fontWeight: 'bold', padding: '6px', border: '2px solid #1976d2', borderRadius: '6px', background: isLocked ? '#f5f5f5' : '#fff'}}
                            />
                          </div>
                        </div>
                        <div style={{fontSize: '0.75rem', color: '#0d47a1', fontStyle: 'italic', flexShrink: 0}}>Hidden from others until after Friday 11:59 PM PST</div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* ── DUAL SUBMIT BUTTONS ── */}
              {overrideAction === 'manual' ? (
                <div style={{display: 'flex', gap: '15px', marginTop: '20px'}}>
                  <button
                    type="submit"
                    className="submit-btn"
                    style={{background: '#e74c3c', fontSize: '1.1rem', fontWeight: '700', flex: '1'}}
                  >
                    ⚡ Submit for {PLAYER_CODES[selectedPlayerForOverride]}
                  </button>
                </div>
              ) : (
                <div style={{marginTop: '24px'}}>
                  {/* Strategic tip for Wednesday */}
                  <div style={{
                    padding: '10px 14px',
                    background: '#e8f5e9',
                    border: '1px solid #81c784',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    color: '#2e7d32',
                    marginBottom: '16px',
                    lineHeight: '1.5'
                  }}>
                    💡 <strong>Blind Pool tiebreaker tip:</strong> Submitting your Blind Pick before Wednesday 11:59 PM PST gives you a tiebreaker edge if you end up tied for first — but it's never required. Friday 11:59 PM PST is the true deadline for both pools.
                  </div>

                  <div style={{display: 'flex', gap: '12px', flexWrap: 'wrap'}}>
                    {/* 🟡 Submit Visible + Cancel */}
                    <div style={{flex: '1', minWidth: '180px', display: 'flex', flexDirection: 'column', gap: '8px'}}>
                      <button
                        type="button"
                        onClick={handleSubmitAPPTV}
                        disabled={!isSubmissionAllowed() || isWeekLocked(currentWeek)}
                        style={{
                          padding: '16px 20px',
                          background: (!isSubmissionAllowed() || isWeekLocked(currentWeek)) ? '#ccc' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '10px',
                          cursor: (!isSubmissionAllowed() || isWeekLocked(currentWeek)) ? 'not-allowed' : 'pointer',
                          fontSize: '1rem',
                          fontWeight: '700',
                          boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)',
                          lineHeight: '1.4'
                        }}
                      >
                        🟡 Submit Visible Pick — Pool #1<br />
                        <span style={{fontSize: '0.75rem', fontWeight: '400', opacity: 0.9}}>Saves your visible scores immediately</span>
                      </button>
                      {visiblePicksDirty && visibleCancelSnapshot && (
                        <button
                          type="button"
                          onClick={() => {
                            setPredictionsAPPTV(visibleCancelSnapshot);
                            setVisiblePicksDirty(false);
                            setVisibleCancelSnapshot(null);
                            setHasUnsavedChanges(false);
                          }}
                          style={{
                            padding: '8px 16px',
                            background: '#f5f5f5',
                            color: '#555',
                            border: '1px solid #bbb',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: '600'
                          }}
                        >
                          ✖ Cancel — keep original Visible picks
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={async () => {
                          const p3Record = allPicksPool3.find(p => p.playerCode === playerCode && p.week === currentWeek);
                          const p3IsAutoCalc = p3Record && p3Record.autoCalculated === true && !p3Record.manuallyConfirmed;
                          const warningMsg = p3IsAutoCalc
                            ? '🗑️ Clear ALL Pool #1 (Visible) picks?\n\nThis will blank out all your score entries.\n\n⚠️ Your Pool #3 picks were auto-calculated from Pool #1 and will also be cleared since they are no longer valid.\n\nClick OK to clear both, Cancel to keep.'
                            : '🗑️ Clear ALL Pool #1 (Visible) picks?\n\nThis will blank out all your score entries.\n\nClick OK to clear, Cancel to keep.';
                          if (!window.confirm(warningMsg)) return;
                          setPredictionsAPPTV({});
                          setVisiblePicksDirty(true);
                          setVisibleCancelSnapshot(null);
                          setHasUnsavedChanges(true);
                          if (p3IsAutoCalc && p3Record?.firebaseKey) {
                            try {
                              await set(ref(database, `picks_pool3/${p3Record.firebaseKey}`), null);
                              setPredictionsPool3({});
                              setPool3Dirty(false);
                            } catch(e) { console.warn('Could not clear auto Pool #3:', e.message); }
                          }
                        }}
                        disabled={isWeekLocked(currentWeek)}
                        style={{ padding: '8px 16px', background: '#fff0f0', color: '#c0392b', border: '1px solid #e74c3c', borderRadius: '8px', cursor: isWeekLocked(currentWeek) ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: '600' }}
                      >
                        🗑️ Clear All Pool #1 Picks
                      </button>
                      {pool34Enabled && (
                        <button
                          type="button"
                          onClick={() => {
                            const p3Record = allPicksPool3.find(p => p.playerCode === playerCode && p.week === currentWeek);
                            const currentTs = p3Record?.lastUpdated || p3Record?.timestamp;
                            const tsMsg = currentTs ? `\n\nYour current Pool #3 timestamp: ${new Date(currentTs).toLocaleString('en-US', {timeZone:'America/Los_Angeles'})} PST` : '';
                            if (!window.confirm(`Export Pool #1 → Pool #3?\n\n⚠️ This will recalculate your Pool #3 picks and update your Pool #3 timestamp to RIGHT NOW.${tsMsg}\n\nOnly use this if you want to re-sync. Continue?`)) return;
                            handleExportToPool3('apptv');
                          }}
                          disabled={isWeekLocked(currentWeek)}
                          style={{
                            padding: '10px 16px',
                            background: isWeekLocked(currentWeek) ? '#ccc' : 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: isWeekLocked(currentWeek) ? 'not-allowed' : 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: '700',
                            marginTop: '4px',
                            lineHeight: '1.4',
                            touchAction: 'manipulation'
                          }}
                        >
                          &#128228; Export Pool #1 &#8594; Pool #3<br />
                          <span style={{ fontSize: '0.72rem', fontWeight: '400', opacity: 0.9 }}>Calculates Winner, ATS &amp; O/U from Pool #1 scores</span>
                        </button>
                      )}
                    </div>

                    {/* 🔵 Submit Blind + Cancel */}
                    <div style={{flex: '1', minWidth: '180px', display: 'flex', flexDirection: 'column', gap: '8px'}}>
                      <button
                        type="button"
                        onClick={handleSubmitAPPTB}
                        disabled={!isSubmissionAllowed() || isWeekLocked(currentWeek)}
                        style={{
                          padding: '16px 20px',
                          background: (!isSubmissionAllowed() || isWeekLocked(currentWeek)) ? '#ccc' : 'linear-gradient(135deg, #1976d2 0%, #0d47a1 100%)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '10px',
                          cursor: (!isSubmissionAllowed() || isWeekLocked(currentWeek)) ? 'not-allowed' : 'pointer',
                          fontSize: '1rem',
                          fontWeight: '700',
                          boxShadow: '0 4px 12px rgba(25, 118, 210, 0.4)',
                          lineHeight: '1.4'
                        }}
                      >
                        🔵 Submit Blind Pick — Pool #2<br />
                        <span style={{fontSize: '0.75rem', fontWeight: '400', opacity: 0.9}}>Locks your timestamp — your tiebreaker edge</span>
                      </button>
                      {/* Cancel Blind edits — only shown when dirty and snapshot exists */}
                      {blindPicksDirty && blindCancelSnapshot && (
                        <button
                          type="button"
                          onClick={() => {
                            setPredictionsAPPTB(blindCancelSnapshot);
                            setBlindPicksDirty(false);
                            setBlindCancelSnapshot(null);
                          }}
                          style={{
                            padding: '8px 16px',
                            background: '#f5f5f5',
                            color: '#555',
                            border: '1px solid #bbb',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: '600'
                          }}
                        >
                          ✖ Cancel — keep original Blind picks
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (!window.confirm('🗑️ Clear ALL Pool #2 (Blind) picks?\n\nThis will blank out all your score entries.\n\nClick OK to clear, Cancel to keep.')) return;
                          setPredictionsAPPTB({});
                          setBlindPicksDirty(true);
                          setBlindCancelSnapshot(null);
                          setHasUnsavedChanges(true);
                        }}
                        disabled={isWeekLocked(currentWeek)}
                        style={{ padding: '8px 16px', background: '#fff0f0', color: '#c0392b', border: '1px solid #e74c3c', borderRadius: '8px', cursor: isWeekLocked(currentWeek) ? 'not-allowed' : 'pointer', fontSize: '0.85rem', fontWeight: '600' }}
                      >
                        🗑️ Clear All Pool #2 Picks
                      </button>
                      {pool34Enabled && (
                        <button
                          type="button"
                          onClick={() => {
                            const p3Record = allPicksPool3.find(p => p.playerCode === playerCode && p.week === currentWeek);
                            const currentTs = p3Record?.lastUpdated || p3Record?.timestamp;
                            const tsMsg = currentTs ? `\n\nYour current Pool #3 timestamp: ${new Date(currentTs).toLocaleString('en-US', {timeZone:'America/Los_Angeles'})} PST` : '';
                            if (!window.confirm(`Export Pool #2 → Pool #3?\n\n⚠️ This will recalculate your Pool #3 picks and update your Pool #3 timestamp to RIGHT NOW.${tsMsg}\n\nOnly use this if you want to re-sync. Continue?`)) return;
                            handleExportToPool3('apptb');
                          }}
                          disabled={isWeekLocked(currentWeek)}
                          style={{
                            padding: '10px 16px',
                            background: isWeekLocked(currentWeek) ? '#ccc' : 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: isWeekLocked(currentWeek) ? 'not-allowed' : 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: '700',
                            marginTop: '4px',
                            lineHeight: '1.4',
                            touchAction: 'manipulation'
                          }}
                        >
                          &#128228; Export Pool #2 &#8594; Pool #3<br />
                          <span style={{ fontSize: '0.72rem', fontWeight: '400', opacity: 0.9 }}>Calculates Winner, ATS &amp; O/U from Pool #2 scores</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {isSubmissionAllowed() && !isWeekLocked(currentWeek) && (
                    <p style={{textAlign: 'center', marginTop: '12px', color: '#666', fontSize: '0.85rem'}}>
                      You can edit and resubmit as many times as you want until Friday 11:59 PM PST
                    </p>
                  )}
                </div>
              )}
            </div>
            )}
          </>
        )}

        {/* All Players Table Filter Toggle */}
        <div style={{
          margin: '20px 0 8px 0',
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          <span style={{fontWeight: 'bold', fontSize: '0.95rem', color: '#333', marginRight: '4px'}}>
            Show Players:
          </span>
          {[
            { key: 'all',   label: '👥 All Players — Pool #1 & #2' },
            { key: 'apptv', label: '🟡 Pool #1 Visible Only' },
            { key: 'apptb', label: '🔵 Pool #2 Blind Only' }
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setAllPlayersFilter(key)}
              style={{
                padding: '8px 18px',
                fontSize: '0.9rem',
                fontWeight: 'bold',
                border: allPlayersFilter === key ? '3px solid #333' : '2px solid #ccc',
                borderRadius: '20px',
                background: allPlayersFilter === key
                  ? (key === 'apptv' ? '#fffde7' : key === 'apptb' ? '#e3f2fd' : '#e8f5e9')
                  : '#f9f9f9',
                color: allPlayersFilter === key
                  ? (key === 'apptv' ? '#b45309' : key === 'apptb' ? '#1565c0' : '#2e7d32')
                  : '#666',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* All Picks Table */}
        <div className="all-picks">
          <h2>
            {currentTableView === 'apptv' ? '📊 Pool #1 Visible Player Picks — ' : '🔒 Pool #2 Blind Player Picks — '}
            {currentWeekData.name}
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

          {filteredPicksForTable.filter(pick => pick.week === currentWeek).length === 0 &&
           allPlayers.filter(p => (p.paid === true || p.paymentStatus === 'PAID') && p.role !== 'MANAGER' && !POOL_MANAGER_CODES.includes(p.playerCode)).length === 0 ? (
            <p className="no-picks">No picks submitted yet for this week.</p>
          ) : (
            <div className="picks-table-container">
              <table className="picks-table" style={{
                fontSize: '0.85rem',
                width: '100%',
                tableLayout: 'fixed'
              }}>
                <thead>
                  <tr>
                    <th rowSpan="2" style={{
                      width: '100px',
                      padding: '8px 6px',
                      fontSize: '0.8rem',
                      wordWrap: 'break-word',
                      whiteSpace: 'normal',
                      lineHeight: '1.3'
                    }}>
                      Player
                      <div style={{marginTop: '4px'}}>
                        <button
                          onClick={() => handleSort('name')}
                          style={{
                            padding: '3px 7px',
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
                        padding: '6px 4px',
                        fontSize: '0.9rem',
                        width: '120px',
                        wordWrap: 'break-word',
                        whiteSpace: 'normal',
                        lineHeight: '1.3'
                      }}>
                        <div style={{marginBottom: '3px', fontWeight: 'bold'}}>Game {game.id}</div>
                        <small style={{color: '#ffffff', fontWeight: '600', fontSize: '0.85rem', display: 'block'}}>
                          {getTeamName(currentWeek, game.id, 'team1', playoffTeams)} @ {getTeamName(currentWeek, game.id, 'team2', playoffTeams)}
                        </small>
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
                    <th rowSpan="2" style={{backgroundColor: '#e8f5e9', fontWeight: 'bold', color: '#090909ff', width: '50px', fontSize: '0.7rem', padding: '6px 3px', wordWrap: 'break-word', whiteSpace: 'normal', lineHeight: '1.1'}}>
                      <div style={{marginBottom: '2px'}}>Correct</div>
                      <div style={{marginBottom: '3px'}}>Picks</div>
                      <button
                        onClick={() => handleSort('correct')}
                        style={{
                          padding: '2px 5px',
                          fontSize: '0.6rem',
                          background: sortColumn === 'correct' ? '#4caf50' : '#f0f0f0',
                          color: sortColumn === 'correct' ? '#fff' : '#000',
                          border: '1px solid #ddd',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          marginTop: '2px'
                        }}
                        title={`Sort by correct picks ${sortColumn === 'correct' && sortDirection === 'asc' ? '(Low to High)' : '(High to Low)'}`}
                      >
                        {sortColumn === 'correct' ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
                      </button>
                    </th>
                    {/* PERFECT SCORES COLUMN - NEW */}
                    <th rowSpan="2" style={{backgroundColor: '#fff9c4', fontWeight: 'bold', color: '#000', width: '50px', fontSize: '0.7rem', padding: '6px 3px', wordWrap: 'break-word', whiteSpace: 'normal', lineHeight: '1.1'}}>
                      <div style={{marginBottom: '2px'}}>Perfect</div>
                      <div style={{marginBottom: '3px'}}>Scores</div>
                      <button
                        onClick={() => handleSort('perfect')}
                        style={{
                          padding: '2px 4px',
                          fontSize: '0.6rem',
                          background: sortColumn === 'perfect' ? '#4caf50' : '#f0f0f0',
                          color: sortColumn === 'perfect' ? '#fff' : '#000',
                          border: '1px solid #ddd',
                          borderRadius: '3px',
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
                        <th rowSpan="2" style={{backgroundColor: '#fff3cd', fontWeight: 'bold', color: '#000', width: '50px', fontSize: '0.65rem', padding: '6px 3px', wordWrap: 'break-word', whiteSpace: 'normal', lineHeight: '1.1'}}>
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
                        <th rowSpan="2" className="grand-total" style={{width: '50px', fontSize: '0.65rem', padding: '6px 3px', wordWrap: 'break-word', whiteSpace: 'normal'}}>
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
                      <th rowSpan="2" style={{backgroundColor: '#f8f9fa', fontWeight: 'bold', color: '#000', width: '50px', fontSize: '0.65rem', padding: '6px 3px', wordWrap: 'break-word', whiteSpace: 'normal', lineHeight: '1.1'}}>
                        {/* Show auto-calculated ONLY if no override */}
                        {!manualWeekTotals[currentWeek] && (() => {
                          const actualTotal = currentWeekData.games.reduce((sum, game) => {
                            const score1 = parseInt(actualScores[currentWeek]?.[game.id]?.team1) || 0;
                            const score2 = parseInt(actualScores[currentWeek]?.[game.id]?.team2) || 0;
                            return sum + score1 + score2;
                          }, 0);
                          
                          return (
                            <div style={{fontSize: '.95rem', color: '#131515ff', marginBottom: '6px', fontWeight: '700'}}>
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
                    <th rowSpan="2" style={{textAlign: 'center', width: '70px', fontSize: '0.6rem', padding: '6px 2px', wordWrap: 'break-word', whiteSpace: 'normal', lineHeight: '1.1'}}>
                      <div style={{fontSize: '0.65rem', color: '#000', fontWeight: 'bold', marginBottom: '2px', lineHeight: '1.1'}}>
                        {filteredPicksForTable.filter(pick => pick.week === currentWeek && pick.predictions && Object.keys(pick.predictions).length > 0).length} Players
                      </div>
                      <div style={{marginBottom: '2px'}}>Submitted</div>
                      <div style={{fontSize: '0.6rem', color: '#040404ff', fontWeight: 'bold', marginBottom: '2px'}}>
                        (PST)
                      </div>
                      <div>
                        <button
                          onClick={() => handleSort('timestamp')}
                          style={{
                            padding: '2px 4px',
                            fontSize: '0.5rem',
                            background: sortColumn === 'timestamp' ? '#4caf50' : '#f0f0f0',
                            color: sortColumn === 'timestamp' ? '#fff' : '#000',
                            border: '1px solid #ddd',
                            borderRadius: '3px',
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
                        filteredPicksForTable.forEach(pick => {
                          if (!uniquePlayers.has(pick.playerCode)) {
                            const superbowlPick = filteredPicksForTable.find(p => p.playerCode === pick.playerCode && p.week === 'superbowl');
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
                        // For other weeks, show players with picks from filteredPicksForTable
                        const picksForWeek = filteredPicksForTable.filter(pick => pick.week === currentWeek);
                        // Track which players are already shown PER pool to avoid duplicates
                        const shownAPPTV = new Set(picksForWeek.filter(p => p._sourcePool === 'apptv').map(p => p.playerCode));
                        const shownAPPTB = new Set(picksForWeek.filter(p => p._sourcePool === 'apptb').map(p => p.playerCode));
                        const shownAny = new Set(picksForWeek.map(p => p.playerCode));
                        
                        // Add paid+visible regular players who haven't submitted picks yet
                        allPlayers.forEach(player => {
                          const isPaid = player.paid === true || player.paymentStatus === 'PAID';
                          const isVisible = player.visible !== false;
                          const isRegularPlayer = player.role !== 'MANAGER';
                          if (!isPaid || !isVisible || !isRegularPlayer) return;
                          // For APPTV filter or 'all' — add missing APPTV entry
                          if ((allPlayersFilter === 'apptv' || allPlayersFilter === 'all') && !shownAPPTV.has(player.playerCode)) {
                            picksForWeek.push({
                              playerName: player.playerName,
                              playerCode: player.playerCode,
                              week: currentWeek,
                              predictions: {},
                              timestamp: null,
                              lastUpdated: null,
                              _sourcePool: 'apptv',
                              _noSubmission: true
                            });
                          }
                          // For APPTB filter or 'all' — add missing APPTB entry
                          if ((allPlayersFilter === 'apptb' || allPlayersFilter === 'all') && !shownAPPTB.has(player.playerCode)) {
                            picksForWeek.push({
                              playerName: player.playerName,
                              playerCode: player.playerCode,
                              week: currentWeek,
                              predictions: {},
                              timestamp: null,
                              lastUpdated: null,
                              _sourcePool: 'apptb',
                              _noSubmission: true
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
                      
                      // Determine row background color based on table source (Combined view only)
                      const getRowBackground = () => {
                        return ''; // No row tinting in single-table view
                      };
                      
                      // Check if APPTB score should be locked (hidden with 🔒)
                      const shouldLockScore = () => {
                        // Pool Manager always sees all scores
                        if (isPoolManager()) return false;
                        // Only lock APPTB rows — APPTV is always visible immediately
                        if (pick._sourcePool !== 'apptb') return false;
                        // After Friday 11:59 PM PST deadline — reveal all picks
                        if (shouldAutoLock(currentWeek)) return false;
                        // Before deadline: hide everyone else's picks, show your own
                        return pick.playerCode !== playerCode;
                      };
                      
                      return (
                        <tr 
                          key={idx} 
                          className={isRNGPick ? 'rng-pick-row' : ''}
                          style={{backgroundColor: getRowBackground()}}
                        >
                          <td className="player-name" style={{
                            fontSize: '0.8rem',
                            padding: '6px',
                            wordWrap: 'break-word',
                            whiteSpace: 'normal',
                            lineHeight: '1.3',
                            maxWidth: '100px'
                          }}>
                            {pick.playerName}
                            {pick._sourcePool === 'apptv' && <span style={{fontSize: '0.7rem', color: '#1565c0', fontWeight: '700', marginLeft: '3px'}}>(V)</span>}
                            {pick._sourcePool === 'apptb' && <span style={{fontSize: '0.7rem', color: '#e65100', fontWeight: '700', marginLeft: '3px'}}>(B)</span>}
                            {isRNGPick && <span className="rng-indicator" title="Picks generated by Pool Manager (missed deadline)">🎲</span>}
                            {isPoolManager() && !pick._noSubmission && (
                              <button
                                onClick={async () => {
                                  const pool = pick._sourcePool === 'apptb' ? 'Pool #2 (Blind)' : 'Pool #1 (Visible)';
                                  if (!window.confirm(`🗑️ Remove ${pick.playerName}'s ${pool} picks for ${currentWeek}?\n\nThis permanently deletes their picks from Firebase.\n\nClick OK to remove, Cancel to keep.`)) return;
                                  try {
                                    const node = pick._sourcePool === 'apptb' ? 'picks_apptb' : 'picks_apptv';
                                    const allRecs = pick._sourcePool === 'apptb' ? allPicksAPPTB : allPicksAPPTV;
                                    const recs = allRecs.filter(p =>
                                      (p.playerCode === pick.playerCode || p.playerName === pick.playerName) &&
                                      p.week === currentWeek
                                    );
                                    if (recs.length === 0) { alert(`No picks found to remove for ${pick.playerName}.`); return; }
                                    for (const rec of recs) {
                                      if (rec.firebaseKey) await remove(ref(database, `${node}/${rec.firebaseKey}`));
                                    }
                                    alert(`✅ Removed ${pick.playerName}'s ${pool} picks successfully.`);
                                  } catch(e) { alert('Error removing picks: ' + e.message); }
                                }}
                                title={`Remove ${pick.playerName}'s picks`}
                                style={{ display: 'block', marginTop: '4px', padding: '2px 6px', fontSize: '0.65rem', background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '4px', cursor: 'pointer', fontWeight: '700', width: '100%' }}
                              >
                                🗑️ Remove
                              </button>
                            )}
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
                                    padding: '6px 4px',
                                    fontSize: '0.9rem',
                                    textAlign: 'center'
                                  }}
                                >
                                  {shouldLockScore() ? '🔒' : (pred?.team1 || '-')}
                                </td>
                                <td 
                                  className="score"
                                  style={{
                                    background: team2Style.background,
                                    color: team2Style.color,
                                    fontWeight: team2Style.background !== 'transparent' ? 'bold' : 'normal',
                                    padding: '6px 4px',
                                    fontSize: '0.9rem',
                                    textAlign: 'center'
                                  }}
                                >
                                  {shouldLockScore() ? '🔒' : (pred?.team2 || '-')}
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
                            <td style={{backgroundColor: '#f8f9fa', fontWeight: 'bold', fontSize: '12px', textAlign: 'center', padding: '4px'}}>
                              {(() => {
                                const ts = pick.tableSource || (currentTableView === 'apptv' ? 'apptv' : currentTableView === 'apptb' ? 'apptb' : 'apptv');
                                const key = `${pick.playerCode}_${ts}`;
                                const val = playerTotals[key]?.current || playerTotals[pick.playerName]?.current || '0';
                                if (val.includes('/')) {
                                  const [pts, off] = val.split('/');
                                  return (
                                    <span style={{color: '#000'}}>
                                      <div style={{whiteSpace: 'nowrap'}}>{pts} pts</div>
                                      <div style={{whiteSpace: 'nowrap', color: '#c0392b'}}>-{off} off</div>
                                    </span>
                                  );
                                }
                                return <span style={{color: '#000', whiteSpace: 'nowrap'}}>{val} pts</span>;
                              })()}
                            </td>
                          )}

                          <td className="timestamp" style={{color: pick._noSubmission ? '#aaa' : '#000000'}}>
                            {pick._noSubmission
                              ? '—'
                              : (shouldLockScore() && pick.playerCode !== playerCode
                                  ? new Date(pick.lastUpdated || pick.timestamp).toLocaleString('en-US', {
                                      timeZone: 'America/Los_Angeles',
                                      month: '2-digit',
                                      day: '2-digit',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      second: '2-digit'
                                    }) + ' PST'
                                  : new Date(pick.lastUpdated || pick.timestamp).toLocaleString('en-US', {
                                      timeZone: 'America/Los_Angeles',
                                      month: '2-digit',
                                      day: '2-digit',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      second: '2-digit'
                                    }) + ' PST')
                            }
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
              
              {/* 🏆 Prize Leaders shortcut - directs to Tab 2 */}
              <div style={{
                marginTop: '40px',
                padding: '24px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '12px',
                textAlign: 'center',
                boxShadow: '0 4px 12px rgba(102,126,234,0.4)'
              }}>
                <div style={{fontSize: '2rem', marginBottom: '10px'}}>🏆</div>
                <h3 style={{color: 'white', margin: '0 0 8px 0', fontSize: '1.3rem', fontWeight: '800'}}>
                  Prize Leaders &amp; Standings
                </h3>
                <p style={{color: 'rgba(255,255,255,0.9)', margin: '0 0 18px 0', fontSize: '0.95rem'}}>
                  See all 10 prizes with full player rankings in one place.
                </p>
                <button
                  onClick={() => setCurrentView('standings')}
                  style={{
                    padding: '12px 28px',
                    background: 'white',
                    color: '#764ba2',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '800',
                    fontSize: '1rem',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                  }}
                >
                  🏆 View All Prize Leaders →
                </button>
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
                      {/* Top row — totals */}
                      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px'}}>
                        <div>
                          <div style={{fontSize: '0.82rem', opacity: 0.9}}>Total Pool</div>
                          <div style={{fontSize: '1.8rem', fontWeight: 'bold'}}>${prizePool.totalFees.toFixed(2)}</div>
                          <div style={{fontSize: '0.78rem', opacity: 0.8}}>{prizePool.numberOfPlayers} players × ${prizePool.entryFee}</div>
                        </div>
                        <div>
                          <div style={{fontSize: '0.82rem', opacity: 0.9}}>🎯 Perfect Score Bonus</div>
                          <div style={{fontSize: '1.8rem', fontWeight: 'bold'}}>${(prizePool.perfectScorePool || prizePool.totalFees * 0.10).toFixed(2)}</div>
                          <div style={{fontSize: '0.78rem', opacity: 0.8}}>10% · split equally if claimed</div>
                        </div>
                        <div>
                          <div style={{fontSize: '0.82rem', opacity: 0.9}}>Remaining after bonus</div>
                          <div style={{fontSize: '1.8rem', fontWeight: 'bold'}}>${(prizePool.prizePool90 || prizePool.totalFees * 0.90).toFixed(2)}</div>
                          <div style={{fontSize: '0.78rem', opacity: 0.8}}>90% split equally across all 25 prizes</div>
                        </div>
                      </div>

                      {/* Prize breakdown — WITH perfect score */}
                      <div style={{background: 'rgba(255,255,255,0.15)', borderRadius: '8px', padding: '12px 16px', marginBottom: '10px'}}>
                        <div style={{fontWeight: '700', fontSize: '0.85rem', marginBottom: '10px', opacity: 0.95}}>✅ IF PERFECT SCORE EXISTS (10% bonus paid out)</div>
                        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px'}}>
                          <div>
                            <div style={{fontSize: '0.78rem', opacity: 0.85}}>🏆 Prizes #1–#25 (all equal)</div>
                            <div style={{fontWeight: '700', fontSize: '1.1rem'}}>${(prizePool.prizePool90 || prizePool.pool12TotalWithPS || (prizePool.totalFees * 0.90)).toFixed(2)}</div>
                            <div style={{fontSize: '0.75rem', opacity: 0.8}}>25 prizes = <strong>${(prizePool.prizePerPrizeWithPS || prizePool.pool12PrizeWithPS || (prizePool.totalFees * 0.90 / 25)).toFixed(2)}</strong> each</div>
                          </div>
                          <div>
                            <div style={{fontSize: '0.78rem', opacity: 0.85}}>🎯 Perfect Score Bonus</div>
                            <div style={{fontWeight: '700', fontSize: '1.1rem'}}>${(prizePool.perfectScorePool || prizePool.totalFees * 0.10).toFixed(2)}</div>
                            <div style={{fontSize: '0.75rem', opacity: 0.8}}>Split equally among <strong>all</strong> perfect score hits — no cap</div>
                          </div>
                        </div>
                      </div>

                      {/* Prize breakdown — NO perfect score */}
                      <div style={{background: 'rgba(255,255,255,0.1)', borderRadius: '8px', padding: '12px 16px'}}>
                        <div style={{fontWeight: '700', fontSize: '0.85rem', marginBottom: '10px', opacity: 0.95}}>🔄 IF NO PERFECT SCORE (10% rolls back into prizes)</div>
                        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px'}}>
                          <div>
                            <div style={{fontSize: '0.78rem', opacity: 0.85}}>🏆 Prizes #1–#25 (all equal)</div>
                            <div style={{fontWeight: '700', fontSize: '1.1rem'}}>${(prizePool.totalFees || 0).toFixed(2)}</div>
                            <div style={{fontSize: '0.75rem', opacity: 0.8}}>25 prizes = <strong>${(prizePool.prizePerPrizeNoPS || prizePool.pool12PrizeNoPS || (prizePool.totalFees / 25)).toFixed(2)}</strong> each</div>
                          </div>
                          <div>
                            <div style={{fontSize: '0.78rem', opacity: 0.85}}>🎯 No Perfect Score</div>
                            <div style={{fontWeight: '700', fontSize: '1.1rem'}}>$0.00</div>
                            <div style={{fontSize: '0.75rem', opacity: 0.8}}>No bonus paid — 10% added back to prizes</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setPpTotalFees(prizePool.totalFees || '');
                        setPpNumPlayers(prizePool.numberOfPlayers || '');
                        setPpEntryFee(prizePool.entryFee || 20);
                        setShowPrizePoolSetup(true);
                      }}
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
                      onClick={() => {
                        setPpTotalFees(prizePool.totalFees || '');
                        setPpNumPlayers(prizePool.numberOfPlayers || '');
                        setPpEntryFee(prizePool.entryFee || 20);
                        setShowPrizePoolSetup(true);
                      }}
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
                    Number of Players:
                  </label>
                  <input
                    type="number"
                    id="numberOfPlayers"
                    value={ppNumPlayers}
                    onChange={e => setPpNumPlayers(e.target.value)}
                    placeholder="50"
                    style={{
                      width: '100%',
                      padding: '12px',
                      fontSize: '1.1rem',
                      border: '2px solid #667eea',
                      borderRadius: '6px'
                    }}
                  />
                  <div style={{fontSize: '0.85rem', color: '#374151', marginTop: '5px'}}>
                    Total number of players in the pool
                  </div>
                </div>

                <div style={{marginBottom: '20px'}}>
                  <label style={{display: 'block', marginBottom: '8px', fontWeight: '600'}}>
                    Total Pool Fees Collected:
                  </label>
                  <input
                    type="number"
                    id="totalFees"
                    value={ppTotalFees}
                    onChange={e => setPpTotalFees(e.target.value)}
                    placeholder="1000"
                    style={{
                      width: '100%',
                      padding: '12px',
                      fontSize: '1.1rem',
                      border: '2px solid #667eea',
                      borderRadius: '6px'
                    }}
                  />
                  <div style={{fontSize: '0.85rem', color: '#374151', marginTop: '5px'}}>
                    Total money collected from all players
                  </div>
                  <div style={{marginTop: '10px', padding: '10px 14px', background: '#f0f4ff', border: '1px solid #667eea', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px'}}>
                    <span style={{fontSize: '0.9rem', color: '#374151', fontWeight: '600'}}>
                      💡 {ppNumPlayers && ppEntryFee ? `${ppNumPlayers} players × $${ppEntryFee} = $${(Number(ppNumPlayers) * Number(ppEntryFee)).toFixed(2)}` : 'Enter players and fee above to calculate'}
                    </span>
                    {ppNumPlayers && ppEntryFee && (
                      <button
                        type="button"
                        onClick={() => setPpTotalFees((Number(ppNumPlayers) * Number(ppEntryFee)).toFixed(2))}
                        style={{padding: '6px 14px', background: '#667eea', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer'}}
                      >
                        ↑ Use This Amount
                      </button>
                    )}
                  </div>
                </div>
                
                <div style={{marginBottom: '20px'}}>
                  <label style={{display: 'block', marginBottom: '8px', fontWeight: '600'}}>
                    Entry Fee per Player:
                  </label>
                  <input
                    type="number"
                    id="entryFee"
                    value={ppEntryFee}
                    onChange={e => setPpEntryFee(e.target.value)}
                    placeholder="20"
                    style={{
                      width: '100%',
                      padding: '12px',
                      fontSize: '1.1rem',
                      border: '2px solid #667eea',
                      borderRadius: '6px'
                    }}
                  />
                  <div style={{fontSize: '0.85rem', color: '#374151', marginTop: '5px'}}>
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
              currentWeek={dynamicPlayoffWeeks[currentWeek].name}
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

          {/* NEW - Initial Picks Incomplete Popup */}
          {/* Table Jump Timestamp Warning */}
          {showTableJumpWarning && (
            <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.85)',display:'flex',justifyContent:'center',alignItems:'center',zIndex:10000,padding:'20px'}}>
              <div style={{background:'#fff',borderRadius:'12px',maxWidth:'520px',width:'100%',padding:'30px',boxShadow:'0 10px 40px rgba(0,0,0,0.4)'}}>
                <h2 style={{margin:'0 0 15px 0',color: showTableJumpWarning.isBlind ? '#c0392b' : '#e67e22',fontSize:'1.4rem'}}>
                  {showTableJumpWarning.isBlind ? '⚠️ Editing Your Blind Pick' : 'ℹ️ Editing Your Visible Pick'}
                </h2>

                <p style={{fontSize:'1rem',lineHeight:'1.7',color:'#000',marginBottom:'12px'}}>
                  You already have a <strong>{showTableJumpWarning.isBlind ? 'Blind Pick' : 'Visible Pick'}</strong> submitted.
                </p>

                <div style={{background: showTableJumpWarning.isBlind ? '#fdf3cd' : '#e8f4fd', border:`2px solid ${showTableJumpWarning.isBlind ? '#ffc107' : '#90caf9'}`,borderRadius:'8px',padding:'12px',marginBottom:'15px'}}>
                  <strong style={{color:'#000'}}>Your original submission:</strong><br/>
                  <span style={{fontSize:'1.05rem',fontWeight:'700',color:'#000'}}>
                    {new Date(showTableJumpWarning.existingTimestamp).toLocaleString('en-US', {
                      timeZone: 'America/Los_Angeles',
                      weekday: 'long', month: 'long', day: 'numeric',
                      hour: '2-digit', minute: '2-digit', second: '2-digit'
                    })} PST
                  </span>
                </div>

                {showTableJumpWarning.isBlind ? (
                  <p style={{fontSize:'0.95rem',lineHeight:'1.7',color:'#c0392b',marginBottom:'15px'}}>
                    ⚠️ <strong>Important:</strong> If you edit and resubmit your Blind Pick, your timestamp will reset to <em>right now</em>. In a tiebreaker, the player who submitted <strong>earliest</strong> wins — so editing late could cost you your competitive edge if scores are tied at the end of the week. <strong>Think carefully before changing your Blind Pick.</strong>
                  </p>
                ) : (
                  <p style={{fontSize:'0.95rem',lineHeight:'1.7',color:'#555',marginBottom:'15px'}}>
                    ℹ️ Editing your Visible Pick will update your timestamp to right now. Timestamps rarely affect tiebreakers in the Visible Pick table, but it's worth knowing.
                  </p>
                )}

                <div style={{display:'flex',gap:'12px',flexWrap:'wrap'}}>
                  <button
                    onClick={() => {
                      setCurrentTableView(showTableJumpWarning.targetTable);
                      setShowTableJumpWarning(null);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    style={{flex:1,padding:'12px 16px',background: showTableJumpWarning.isBlind ? '#c0392b' : '#e67e22',color:'#fff',border:'none',borderRadius:'8px',fontSize:'1rem',fontWeight:'bold',cursor:'pointer'}}
                  >
                    ✏️ Yes, Edit Anyway
                  </button>
                  <button
                    onClick={() => setShowTableJumpWarning(null)}
                    style={{flex:1,padding:'12px 16px',background:'#6c757d',color:'#fff',border:'none',borderRadius:'8px',fontSize:'1rem',fontWeight:'bold',cursor:'pointer'}}
                  >
                    ↩️ No, Keep My Original
                  </button>
                </div>
              </div>
            </div>
          )}

          {showPopup === 'initialIncomplete' && initialValidationData && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.85)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 10000
            }}>
              <div style={{
                background: '#fff',
                padding: '30px',
                borderRadius: '12px',
                maxWidth: '600px',
                width: '90%',
                maxHeight: '80vh',
                overflow: 'auto',
                boxShadow: '0 10px 40px rgba(0,0,0,0.4)'
              }}>
                <h2 style={{
                  margin: '0 0 15px 0',
                  color: '#e74c3c',
                  fontSize: '1.6rem',
                  fontWeight: 'bold'
                }}>
                  ⚠️ INITIAL PICKS INCOMPLETE
                </h2>
                
                <p style={{
                  fontSize: '1.1rem',
                  marginBottom: '20px',
                  color: '#000',
                  lineHeight: '1.6'
                }}>
                  You must complete <strong>ALL games in BOTH tables</strong> for your initial submission.
                </p>

                {/* APPTV Status */}
                <div style={{
                  background: initialValidationData.apptvStatus.complete ? '#d4edda' : '#f8d7da',
                  border: `2px solid ${initialValidationData.apptvStatus.complete ? '#28a745' : '#dc3545'}`,
                  borderRadius: '8px',
                  padding: '15px',
                  marginBottom: '15px'
                }}>
                  <div style={{
                    fontSize: '1.1rem',
                    fontWeight: 'bold',
                    marginBottom: '8px',
                    color: '#000'
                  }}>
                    👁️ Visible Pick Status: {initialValidationData.apptvStatus.complete ? '✅ Complete' : '❌ Incomplete'}
                  </div>
                  <div style={{color: '#000', marginBottom: '5px'}}>
                    {initialValidationData.apptvStatus.filled}/{initialValidationData.apptvStatus.total} games filled
                  </div>
                  {initialValidationData.apptvStatus.missing.length > 0 && (
                    <div style={{color: '#000'}}>
                      <strong>Missing:</strong>
                      <ul style={{marginTop: '5px', marginBottom: '5px'}}>
                        {initialValidationData.apptvStatus.missing.map(gameId => {
                          const game = currentWeekData.games.find(g => g.id === gameId);
                          return (
                            <li key={gameId}>
                              Game {gameId}: {getTeamName(currentWeek, gameId, 'team1', playoffTeams)} @ {getTeamName(currentWeek, gameId, 'team2', playoffTeams)}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                  {initialValidationData.apptvStatus.ties.length > 0 && (
                    <div style={{color: '#000', marginTop: '8px'}}>
                      <strong>⚠️ Ties Not Allowed:</strong>
                      <ul style={{marginTop: '5px'}}>
                        {initialValidationData.apptvStatus.ties.map(gameId => (
                          <li key={gameId}>Game {gameId}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* APPTB Status */}
                <div style={{
                  background: initialValidationData.apptbStatus.complete ? '#d4edda' : '#f8d7da',
                  border: `2px solid ${initialValidationData.apptbStatus.complete ? '#28a745' : '#dc3545'}`,
                  borderRadius: '8px',
                  padding: '15px',
                  marginBottom: '20px'
                }}>
                  <div style={{
                    fontSize: '1.1rem',
                    fontWeight: 'bold',
                    marginBottom: '8px',
                    color: '#000'
                  }}>
                    🔒 Blind Pick Status: {initialValidationData.apptbStatus.complete ? '✅ Complete' : '❌ Incomplete'}
                  </div>
                  <div style={{color: '#000', marginBottom: '5px'}}>
                    {initialValidationData.apptbStatus.filled}/{initialValidationData.apptbStatus.total} games filled
                  </div>
                  {initialValidationData.apptbStatus.missing.length > 0 && (
                    <div style={{color: '#000'}}>
                      <strong>Missing:</strong>
                      <ul style={{marginTop: '5px', marginBottom: '5px'}}>
                        {initialValidationData.apptbStatus.missing.map(gameId => {
                          const game = currentWeekData.games.find(g => g.id === gameId);
                          return (
                            <li key={gameId}>
                              Game {gameId}: {getTeamName(currentWeek, gameId, 'team1', playoffTeams)} @ {getTeamName(currentWeek, gameId, 'team2', playoffTeams)}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                  {initialValidationData.apptbStatus.ties.length > 0 && (
                    <div style={{color: '#000', marginTop: '8px'}}>
                      <strong>⚠️ Ties Not Allowed:</strong>
                      <ul style={{marginTop: '5px'}}>
                        {initialValidationData.apptbStatus.ties.map(gameId => (
                          <li key={gameId}>Game {gameId}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap'}}>
                  {!initialValidationData.apptvStatus.complete && (
                    <button
                      onClick={() => {
                        setShowPopup(null);
                        setTimeout(() => {
                          if (initialValidationData.apptvStatus.missing.length > 0) {
                            const firstMissing = initialValidationData.apptvStatus.missing[0];
                            const element = document.querySelector(`[data-game-id="${firstMissing}"]`);
                            element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }
                        }, 100);
                      }}
                      style={{
                        flex: 1,
                        padding: '12px 20px',
                        background: '#f59e0b',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      🟡 Go to missing Visible picks
                    </button>
                  )}
                  
                  {!initialValidationData.apptbStatus.complete && (
                    <button
                      onClick={() => {
                        setShowPopup(null);
                        setTimeout(() => {
                          if (initialValidationData.apptbStatus.missing.length > 0) {
                            const firstMissing = initialValidationData.apptbStatus.missing[0];
                            const element = document.querySelector(`[data-game-id="${firstMissing}"]`);
                            element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }
                        }, 100);
                      }}
                      style={{
                        flex: 1,
                        padding: '12px 20px',
                        background: '#1976d2',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      🔵 Go to missing Blind picks
                    </button>
                  )}
                </div>
              </div>
            </div>
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
              gameData={currentWeekData.games.map(g => ({
                ...g,
                team1: getTeamName(currentWeek, g.id, 'team1', playoffTeams),
                team2: getTeamName(currentWeek, g.id, 'team2', playoffTeams)
              }))}
              onClose={() => setShowPopup(null)}
            />
          )}

          {/* Pool #3 Post-Submit Prompt */}
          {showPool34Prompt && (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.85)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              zIndex: 10000, padding: '20px'
            }}>
              <div style={{
                background: 'white', borderRadius: '14px', padding: '30px',
                maxWidth: '540px', width: '100%',
                boxShadow: '0 10px 40px rgba(0,0,0,0.4)'
              }}>
                <div style={{ fontSize: '2rem', textAlign: 'center', marginBottom: '10px' }}>🎯</div>
                <h2 style={{ margin: '0 0 12px 0', color: '#7c3aed', textAlign: 'center', fontSize: '1.4rem' }}>
                  Pool #1 & #2 Saved!
                </h2>
                <p style={{ color: '#374151', marginBottom: '16px', lineHeight: '1.6', textAlign: 'center' }}>
                  Your Pool #3 Winner, ATS, O/U picks have been <strong>auto-calculated</strong> from your scores.<br/>
                  What would you like to do?
                </p>

                {/* Pool #3 preview */}
                <div style={{
                  background: '#f5f3ff', border: '2px solid #7c3aed', borderRadius: '10px',
                  padding: '14px', marginBottom: '20px', fontSize: '0.88rem', color: '#5b21b6'
                }}>
                  <div style={{ fontWeight: '700', marginBottom: '8px' }}>📊 Auto-calculated picks ready:</div>
                  {dynamicPlayoffWeeks[currentWeek]?.games.map(game => {
                    const p3 = predictionsPool3[game.id];
                    const away = getTeamName(currentWeek, game.id, 'team1', playoffTeams);
                    const home = getTeamName(currentWeek, game.id, 'team2', playoffTeams);
                    if (!p3) return null;
                    return (
                      <div key={game.id} style={{ marginBottom: '4px', padding: '4px 0', borderBottom: '1px solid #ddd8fe' }}>
                        <span style={{ fontWeight: '600' }}>G{game.id} {away} @ {home}:</span>
                        <span style={{ marginLeft: '8px' }}>🎯 {p3.winner} / {p3.ats} / {p3.ou}</span>
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button
                    onClick={() => { setShowPool34Prompt(false); setShowPopup('success'); }}
                    style={{
                      padding: '14px', background: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
                      color: 'white', border: 'none', borderRadius: '8px',
                      fontSize: '1rem', fontWeight: '700', cursor: 'pointer'
                    }}
                  >
                    ✅ Save As-Is — Accept Auto-Calculated Picks
                  </button>
                  <button
                    onClick={() => {
                      setShowPool34Prompt(false);
                      // Navigate to Pool #3 view
                      setCurrentView('pool34picks');
                    }}
                    style={{
                      padding: '14px', background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                      color: 'white', border: 'none', borderRadius: '8px',
                      fontSize: '1rem', fontWeight: '700', cursor: 'pointer'
                    }}
                  >
                    👀 Review & Edit Pool #3 First
                  </button>
                  <div style={{ fontSize: '0.78rem', color: '#4b5563', textAlign: 'center', marginTop: '4px' }}>
                    ⚠️ You cannot logout until Pool #3 picks are saved.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* NEW - Draft Restoration Modal */}
          {showDraftRestoreModal && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.8)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 10000
            }}>
              <div style={{
                background: 'white',
                padding: '30px',
                borderRadius: '12px',
                maxWidth: '600px',
                width: '90%',
                boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
              }}>
                <h2 style={{margin: '0 0 20px 0', color: '#667eea', fontSize: '1.5rem'}}>
                  📝 Unfinished Picks Found
                </h2>
                <p style={{fontSize: '1.1rem', lineHeight: '1.6', marginBottom: '20px', color: '#000'}}>
                  You have unsaved picks for <strong>{currentWeekData.name}</strong>:
                </p>
                <div style={{
                  background: '#f8f9fa',
                  padding: '15px',
                  borderRadius: '8px',
                  marginBottom: '20px',
                  color: '#000'
                }}>
                  <div style={{marginBottom: '10px'}}>
                    📊 <strong>APPTV Table:</strong> {draftData.apptv ? 
                      (() => {
                        const parsed = JSON.parse(draftData.apptv);
                        const validGames = Object.keys(parsed).filter(k => parsed[k] && (parsed[k].team1 || parsed[k].team2));
                        return `${validGames.length}/6 games filled`;
                      })() : 
                      'Empty'}
                  </div>
                  <div>
                    🔒 <strong>APPTB Table:</strong> {draftData.apptb ? 
                      (() => {
                        const parsed = JSON.parse(draftData.apptb);
                        const validGames = Object.keys(parsed).filter(k => parsed[k] && (parsed[k].team1 || parsed[k].team2));
                        return `${validGames.length}/6 games filled`;
                      })() : 
                      'Empty'}
                  </div>
                </div>
                <div style={{
                  background: '#fff3cd',
                  border: '2px solid #ffc107',
                  borderRadius: '8px',
                  padding: '15px',
                  marginBottom: '20px',
                  color: '#000'
                }}>
                  <strong>⚠️ Important:</strong> These picks are NOT yet submitted to the system.
                  They are only saved in your browser.
                  <br/><br/>
                  <strong>Initial submission requires BOTH tables to be 100% complete.</strong>
                  <br/>
                  Deadline: <strong>{currentWeekData.deadline}</strong>
                </div>
                <p style={{marginBottom: '20px', color: '#000'}}>What would you like to do?</p>
                <div style={{display: 'flex', gap: '10px'}}>
                  <button
                    onClick={() => {
                      // Restore drafts
                      if (draftData.apptv) {
                        setPredictionsAPPTV(JSON.parse(draftData.apptv));
                      }
                      if (draftData.apptb) {
                        setPredictionsAPPTB(JSON.parse(draftData.apptb));
                      }
                      setShowDraftRestoreModal(false);
                    }}
                    style={{
                      flex: 1,
                      padding: '15px',
                      fontSize: '1.1rem',
                      fontWeight: 'bold',
                      background: '#4caf50',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer'
                    }}
                  >
                    ✅ Restore My Progress
                  </button>
                  <button
                    onClick={() => {
                      // Clear drafts and start fresh
                      localStorage.removeItem(`draft_apptv_${playerCode}_${currentWeek}`);
                      localStorage.removeItem(`draft_apptb_${playerCode}_${currentWeek}`);
                      setPredictionsAPPTV({});
                      setPredictionsAPPTB({});
                      setShowDraftRestoreModal(false);
                    }}
                    style={{
                      flex: 1,
                      padding: '15px',
                      fontSize: '1.1rem',
                      fontWeight: 'bold',
                      background: '#666',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer'
                    }}
                  >
                    🆕 Start Fresh
                  </button>
                </div>
              </div>
            </div>
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
        <p>Richard's NFL Playoff Pool 2026 | Good luck! 🏈</p>
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

            {/* Content - Both Tables Combined */}
            <div>
              {(() => {
                // Build combined list from BOTH tables with (V) and (B) labels
                const apptvPicks = allPicksAPPTV
                  .filter(p => p.week === currentWeek)
                  .map(p => ({
                    playerName: p.playerName,
                    playerCode: p.playerCode,
                    tableLabel: 'V',
                    predictions: p.predictions || {},
                    timestamp: p.timestamp,
                    lastUpdated: p.lastUpdated,
                    enteredBy: p.enteredBy
                  }));

                const apptbPicks = allPicksAPPTB
                  .filter(p => p.week === currentWeek)
                  .map(p => ({
                    playerName: p.playerName,
                    playerCode: p.playerCode,
                    tableLabel: 'B',
                    predictions: p.predictions || {},
                    timestamp: p.timestamp,
                    lastUpdated: p.lastUpdated,
                    enteredBy: p.enteredBy
                  }));

                // Show picks based on active filter — match the Show Players buttons
                const allEntries = allPlayersFilter === 'apptv' ? apptvPicks
                                 : allPlayersFilter === 'apptb' ? apptbPicks
                                 : [...apptvPicks, ...apptbPicks]; // 'all' = both

                const filterLabel = allPlayersFilter === 'apptv' ? '🟡 Visible Pool Only'
                                  : allPlayersFilter === 'apptb' ? '🔵 Blind Pool Only'
                                  : '📊 All Pools';

                if (allEntries.length === 0) {
                  return <p style={{padding: '30px', textAlign: 'center', color: '#666'}}>No picks submitted yet for this week.</p>;
                }

                const filterBar = (
                  <div style={{ padding: '8px 20px', background: '#f3f4f6', borderBottom: '1px solid #e5e7eb', fontSize: '0.85rem', color: '#1f2937', fontWeight: '600' }}>
                    Showing: {filterLabel} — {allEntries.length} entries
                  </div>
                );

                const visitingSorted = [...allEntries].sort((a, b) => {
                  const aScore = parseInt(a.predictions[selectedAnalysisGame]?.team1) || (analysisSort === 'asc' ? 999 : -1);
                  const bScore = parseInt(b.predictions[selectedAnalysisGame]?.team1) || (analysisSort === 'asc' ? 999 : -1);
                  if (aScore !== bScore) return analysisSort === 'asc' ? aScore - bScore : bScore - aScore;
                  // Secondary sort: home team score when visiting scores are tied
                  const aHome = parseInt(a.predictions[selectedAnalysisGame]?.team2) || (analysisSort === 'asc' ? 999 : -1);
                  const bHome = parseInt(b.predictions[selectedAnalysisGame]?.team2) || (analysisSort === 'asc' ? 999 : -1);
                  return analysisSort === 'asc' ? aHome - bHome : bHome - aHome;
                });

                const homeSorted = [...allEntries].sort((a, b) => {
                  const aScore = parseInt(a.predictions[selectedAnalysisGame]?.team2) || (analysisSort === 'asc' ? 999 : -1);
                  const bScore = parseInt(b.predictions[selectedAnalysisGame]?.team2) || (analysisSort === 'asc' ? 999 : -1);
                  if (aScore !== bScore) return analysisSort === 'asc' ? aScore - bScore : bScore - aScore;
                  // Secondary sort: visiting team score when home scores are tied
                  const aVisit = parseInt(a.predictions[selectedAnalysisGame]?.team1) || (analysisSort === 'asc' ? 999 : -1);
                  const bVisit = parseInt(b.predictions[selectedAnalysisGame]?.team1) || (analysisSort === 'asc' ? 999 : -1);
                  return analysisSort === 'asc' ? aVisit - bVisit : bVisit - aVisit;
                });

                const renderRow = (entry, idx) => {
                  const isRNGPick = entry.enteredBy === 'POOL_MANAGER_RNG';
                  const pred = entry.predictions[selectedAnalysisGame];
                  const actual = actualScores[currentWeek]?.[selectedAnalysisGame];
                  const status = gameStatus[currentWeek]?.[selectedAnalysisGame];
                  const isV = entry.tableLabel === 'V';
                  const team1Style = getCellHighlight(pred?.team1, pred?.team2, actual?.team1, actual?.team2, status, true);
                  const team2Style = getCellHighlight(pred?.team1, pred?.team2, actual?.team1, actual?.team2, status, false);
                  return (
                    <tr key={idx} style={{backgroundColor: isV ? '#f0f7ff' : '#fffde7'}}>
                      <td style={{padding: '10px', fontWeight: 'bold', borderRight: '2px solid #ddd', color: '#000', fontSize: '14px'}}>
                        {entry.playerName || 'Unknown'}
                        <span style={{fontSize: '0.7rem', fontWeight: '700', marginLeft: '4px', color: isV ? '#1565c0' : '#e65100'}}>({entry.tableLabel})</span>
                        {isRNGPick && <span style={{marginLeft: '4px'}} title="Random picks">🎲</span>}
                      </td>
                      <td style={{padding: '10px', textAlign: 'center', background: team1Style.background, color: team1Style.color || '#000', fontWeight: team1Style.background !== 'transparent' ? 'bold' : 'normal', borderLeft: '3px solid #ccc', fontSize: '14px'}}>
                        {pred?.team1 || '-'}
                      </td>
                      <td style={{padding: '10px', textAlign: 'center', background: team2Style.background, color: team2Style.color || '#000', fontWeight: team2Style.background !== 'transparent' ? 'bold' : 'normal', fontSize: '14px'}}>
                        {pred?.team2 || '-'}
                      </td>
                      <td style={{padding: '10px', textAlign: 'center', fontSize: '12px', color: '#666'}}>
                        {entry.lastUpdated ? new Date(entry.lastUpdated).toLocaleString('en-US', {timeZone: 'America/Los_Angeles'}) + ' PST' : entry.timestamp ? new Date(entry.timestamp).toLocaleString('en-US', {timeZone: 'America/Los_Angeles'}) + ' PST' : '-'}
                      </td>
                    </tr>
                  );
                };

                const tableHead = (
                  <thead>
                    <tr>
                      <th style={{padding: '10px', fontWeight: 'bold', borderRight: '2px solid #ddd', backgroundColor: '#f5f5f5', color: '#000', fontSize: '14px', textAlign: 'left'}}>
                        Player — <span style={{color:'#1565c0'}}>(V)</span> Visible Pick &nbsp;<span style={{color:'#e65100'}}>(B)</span> Blind Pick
                      </th>
                      <th style={{padding: '10px', textAlign: 'center', backgroundColor: '#e8f5e9', borderLeft: '3px solid #ccc', color: '#000', fontSize: '14px', fontWeight: 'bold'}}>
                        {getTeamName(currentWeek, selectedAnalysisGame, 'team1', playoffTeams) || 'Visiting'}
                      </th>
                      <th style={{padding: '10px', textAlign: 'center', backgroundColor: '#e3f2fd', color: '#000', fontSize: '14px', fontWeight: 'bold'}}>
                        {getTeamName(currentWeek, selectedAnalysisGame, 'team2', playoffTeams) || 'Home'}
                      </th>
                      <th style={{padding: '10px', textAlign: 'center', backgroundColor: '#f5f5f5', color: '#000', fontSize: '14px', fontWeight: 'bold'}}>Date/Time (PST)</th>
                    </tr>
                  </thead>
                );

                return (
                  <>
                    {filterBar}
                    <div style={{marginBottom: '30px'}}>
                      <h3 style={{padding: '15px', margin: 0, backgroundColor: 'rgba(200,230,201,0.5)', borderBottom: '3px solid #4caf50', color: '#000', fontWeight: 'bold'}}>
                        🔼 VISITING TEAM SORT — Game {selectedAnalysisGame}: {getTeamName(currentWeek, selectedAnalysisGame, 'team1', playoffTeams)} @ {getTeamName(currentWeek, selectedAnalysisGame, 'team2', playoffTeams)}
                        <span style={{fontSize:'0.85rem', marginLeft:'12px', color:'#555', fontWeight:'400'}}>({visitingSorted.length} entries — {filterLabel})</span>
                      </h3>
                      <div style={{overflowX: 'auto'}}>
                        <table className="picks-table" style={{width: '100%', borderCollapse: 'collapse'}}>
                          {tableHead}
                          <tbody>{visitingSorted.map(renderRow)}</tbody>
                        </table>
                      </div>
                    </div>
                    <div>
                      <h3 style={{padding: '15px', margin: 0, backgroundColor: 'rgba(179,229,252,0.5)', borderBottom: '3px solid #2196F3', color: '#000', fontWeight: 'bold'}}>
                        🔽 HOME TEAM SORT — Game {selectedAnalysisGame}: {getTeamName(currentWeek, selectedAnalysisGame, 'team1', playoffTeams)} @ {getTeamName(currentWeek, selectedAnalysisGame, 'team2', playoffTeams)}
                        <span style={{fontSize:'0.85rem', marginLeft:'12px', color:'#555', fontWeight:'400'}}>({homeSorted.length} entries — {filterLabel})</span>
                      </h3>
                      <div style={{overflowX: 'auto'}}>
                        <table className="picks-table" style={{width: '100%', borderCollapse: 'collapse'}}>
                          {tableHead}
                          <tbody>{homeSorted.map(renderRow)}</tbody>
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

const AppWithBoundary = () => (
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

export default AppWithBoundary;
