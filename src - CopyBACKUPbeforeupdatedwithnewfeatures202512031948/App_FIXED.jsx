import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, push, onValue, set, update } from 'firebase/database';
import './App.css';
import StandingsPage from './StandingsPage';
import ESPNControls from './ESPNControls';
import { fetchESPNScores, mapESPNGameToPlayoffGame, ESPNAutoRefresh } from './espnService';
import WeekSelector from './WeekSelector_Richard';
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
const PLAYOFF_SEASON = {
  firstFriday: "2026-01-09",
  lastMonday: "2026-02-09"
};

// ============================================
// 📅 AUTOMATIC WEEK LOCK DATES
// ============================================
const AUTO_LOCK_DATES = {
  wildcard: "2026-01-10",
  divisional: "2026-01-17",
  conference: "2026-01-25",
  superbowl: "2026-02-08"
};

// ============================================
// 🔧 POOL MANAGER CONFIGURATION
// ============================================
const POOL_MANAGER_CODES = ["76BB89", "Z9Y8X7"];

// ============================================
// 👥 PLAYER CODES
// ============================================
const PLAYER_CODES = {
  "76BB89": "POOL MANAGER - Richard",
  "Z9Y8X7": "POOL MANAGER - Dennis",
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
};

// Playoff structure
const PLAYOFF_WEEKS = {
  wildcard: {
    name: "Wild Card Round (Jan 10-12, 2026)",
    deadline: "Fri Jan 9, 11:59 PM PST",
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
    deadline: "Fri Jan 16, 11:59 PM PST",
    games: [
      { id: 7, team1: "AFC Winner 1", team2: "AFC #1" },
      { id: 8, team1: "AFC Winner 2", team2: "AFC Winner 3" },
      { id: 9, team1: "NFC Winner 1", team2: "NFC #1" },
      { id: 10, team1: "NFC Winner 2", team2: "NFC Winner 3" }
    ]
  },
  conference: {
    name: "Conference Championships (Jan 25, 2026)",
    deadline: "Fri Jan 23, 11:59 PM PST",
    games: [
      { id: 11, team1: "AFC Winner A", team2: "AFC Winner B" },
      { id: 12, team1: "NFC Winner A", team2: "NFC Winner B" }
    ]
  },
  superbowl: {
    name: "Super Bowl LIX (Feb 8, 2026)",
    deadline: "Fri Feb 6, 11:59 PM PST",
    games: [
      { id: 13, team1: "AFC Champion", team2: "NFC Champion" }
    ]
  }
};

function App() {
  // Existing state
  const [playerCode, setPlayerCode] = useState('');
  const [codeValidated, setCodeValidated] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [currentWeek, setCurrentWeek] = useState('wildcard');
  const [predictions, setPredictions] = useState({});
  const [allPicks, setAllPicks] = useState([]);
  const [actualScores, setActualScores] = useState({});
  const [gameStatus, setGameStatus] = useState({});
  const [showStandings, setShowStandings] = useState(false);
  const [weekLocks, setWeekLocks] = useState({});
  const [espnData, setEspnData] = useState({});
  // ============================================
  // STEP 5 STATE VARIABLES (no duplicates!)
  // ============================================
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showPopup, setShowPopup] = useState(null);
  const [pendingWeekChange, setPendingWeekChange] = useState(null);
  const [missingGames, setMissingGames] = useState([]);
  const [invalidScores, setInvalidScores] = useState([]);
  const [officialWinners, setOfficialWinners] = useState({});
  const [weekLockStatus, setWeekLockStatus] = useState({
    wildcard: { locked: false },
    divisional: { locked: false },
    conference: { locked: false },
    superbowl: { locked: false }
  });
  const [originalPicks, setOriginalPicks] = useState({});
  const [weekPicksStatus, setWeekPicksStatus] = useState({});

  // ============================================
  // HELPER FUNCTIONS
  // ============================================

  const isPoolManager = () => POOL_MANAGER_CODES.includes(playerCode);

  const isWeekLocked = (week) => {
    if (weekLocks[week]?.lockedByManager) return true;
    
    const lockDate = new Date(AUTO_LOCK_DATES[week] + 'T00:01:00-08:00');
    const now = new Date();
    return now >= lockDate;
  };

  // ============================================
  // 🆕 NEW HELPER FUNCTIONS FOR STEP 5
  // ============================================

  // Check if user has unsaved changes
  const checkUnsavedChanges = () => {
    return JSON.stringify(predictions) !== JSON.stringify(originalPicks);
  };

  // Update unsaved changes state whenever predictions change
  useEffect(() => {
    setHasUnsavedChanges(checkUnsavedChanges());
  }, [predictions, originalPicks]);

  // Handle week change with unsaved changes check
  const handleWeekChange = (newWeek) => {
    if (hasUnsavedChanges) {
      setPendingWeekChange(newWeek);
      setShowPopup('unsavedChanges');
    } else {
      setCurrentWeek(newWeek);
      // Load picks for new week
      loadPicksForWeek(newWeek);
    }
  };

  // Load picks for a specific week
  const loadPicksForWeek = (week) => {
    const weekPicks = allPicks.find(p => p.week === week && p.playerCode === playerCode);
    if (weekPicks) {
      setPredictions(weekPicks.predictions || {});
      setOriginalPicks(weekPicks.predictions || {});
    } else {
      setPredictions({});
      setOriginalPicks({});
    }
  };

  // Validate all games filled
  const validateAllGames = () => {
    const games = currentWeekData.games;
    const missing = [];
    
    games.forEach(game => {
      const pick = predictions[game.id];
      if (!pick || !pick.team1 || !pick.team2) {
        missing.push(game);
      }
    });
    
    return missing;
  };

  // Validate score range (10-50)
  const validateScoreRange = () => {
    const games = currentWeekData.games;
    const invalid = [];
    
    games.forEach(game => {
      const pick = predictions[game.id];
      if (pick) {
        if (pick.team1 < 10 || pick.team1 > 50) {
          invalid.push({ team: game.team1, score: pick.team1 });
        }
        if (pick.team2 < 10 || pick.team2 > 50) {
          invalid.push({ team: game.team2, score: pick.team2 });
        }
      }
    });
    
    return invalid;
  };

  // Handle save picks with validation (REPLACES YOUR OLD handleSubmitPicks)
  const handleSavePicks = async () => {
    // Check for changes
    if (!hasUnsavedChanges) {
      setShowPopup('noChanges');
      return;
    }

    // Validate all games filled
    const missing = validateAllGames();
    if (missing.length > 0) {
      setMissingGames(missing);
      setShowPopup('incomplete');
      return;
    }

    // Validate score range
    const invalid = validateScoreRange();
    if (invalid.length > 0) {
      setInvalidScores(invalid);
      setShowPopup('invalidScores');
      return;
    }

    // All valid - save to Firebase
    try {
      const pickData = {
        playerCode,
        playerName,
        week: currentWeek,
        predictions,
        timestamp: Date.now(),
        lastUpdated: Date.now()
      };

      await push(ref(database, 'picks'), pickData);
      
      setOriginalPicks({...predictions});
      setHasUnsavedChanges(false);
      setShowPopup('success');
    } catch (error) {
      console.error('Save failed:', error);
      alert('Failed to save picks. Please try again.');
    }
  };

  // Handle cancel with unsaved changes check
  const handleCancelPicks = () => {
    if (hasUnsavedChanges) {
      setShowPopup('discardChanges');
    } else {
      // Just reload original picks
      setPredictions({...originalPicks});
    }
  };

  // Pool Manager: Declare winner
  const handleDeclareWinner = async (prizeNumber, winner) => {
    if (winner) {
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
        alert(`Winner declared for Prize #${prizeNumber}: ${winner.playerName}`);
      } catch (error) {
        console.error('Failed to save winner:', error);
        alert('Failed to save winner. Please try again.');
      }
    } else {
      // Remove winner
      const updated = {...officialWinners};
      delete updated[prizeNumber];
      setOfficialWinners(updated);
      
      // Remove from Firebase
      try {
        await set(ref(database, `winners/${prizeNumber}`), null);
        alert(`Winner removed for Prize #${prizeNumber}`);
      } catch (error) {
        console.error('Failed to remove winner:', error);
      }
    }
  };

  // ============================================
  // FIREBASE LISTENERS
  // ============================================

  useEffect(() => {
    // Listen for picks
    const picksRef = ref(database, 'picks');
    const unsubscribePicks = onValue(picksRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const picksArray = Object.entries(data).map(([key, value]) => ({
          key,
          ...value
        }));
        setAllPicks(picksArray);
        
        // Update week picks status for WeekSelector
        const status = {};
        ['wildcard', 'divisional', 'conference', 'superbowl'].forEach(week => {
          const weekPick = picksArray.find(p => p.week === week && p.playerCode === playerCode);
          if (weekPick && weekPick.predictions) {
            const gameCount = PLAYOFF_WEEKS[week].games.length;
            const filledCount = Object.keys(weekPick.predictions).length;
            status[week] = { complete: filledCount === gameCount };
          }
        });
        setWeekPicksStatus(status);
      }
    });

    // Listen for actual scores
    const scoresRef = ref(database, 'actualScores');
    const unsubscribeScores = onValue(scoresRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setActualScores(data);
    });

    // Listen for game status
    const statusRef = ref(database, 'gameStatus');
    const unsubscribeStatus = onValue(statusRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setGameStatus(data);
    });

    // Listen for week locks
    const locksRef = ref(database, 'weekLocks');
    const unsubscribeLocks = onValue(locksRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setWeekLocks(data);
        // Update weekLockStatus for WeekSelector
        const lockStatus = {};
        Object.keys(PLAYOFF_WEEKS).forEach(week => {
          lockStatus[week] = {
            locked: data[week]?.lockedByManager || isWeekLocked(week)
          };
        });
        setWeekLockStatus(lockStatus);
      }
    });

    // Listen for official winners
    const winnersRef = ref(database, 'winners');
    const unsubscribeWinners = onValue(winnersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setOfficialWinners(data);
    });

    // Listen for ESPN data
    const espnRef = ref(database, 'espnScores');
    const unsubscribeEspn = onValue(espnRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setEspnData(data);
    });

    return () => {
      unsubscribePicks();
      unsubscribeScores();
      unsubscribeStatus();
      unsubscribeLocks();
      unsubscribeWinners();
      unsubscribeEspn();
    };
  }, [playerCode]);

  // Load picks when week changes
  useEffect(() => {
    if (codeValidated) {
      loadPicksForWeek(currentWeek);
    }
  }, [currentWeek, codeValidated]);

  // ============================================
  // EXISTING HANDLERS (keeping your logic)
  // ============================================

  const handleCodeSubmit = (e) => {
    e.preventDefault();
    const code = playerCode.trim().toUpperCase();
    
    if (PLAYER_CODES[code]) {
      setCodeValidated(true);
      setPlayerName(PLAYER_CODES[code]);
      setPlayerCode(code);
    } else {
      alert('Invalid player code. Please try again.');
    }
  };

  const handlePredictionChange = (gameId, team, value) => {
    const numValue = parseInt(value);
    if (value === '' || (numValue >= 0 && numValue <= 99)) {
      setPredictions(prev => ({
        ...prev,
        [gameId]: {
          ...prev[gameId],
          [team]: value === '' ? '' : numValue
        }
      }));
    }
  };

  const handleActualScoreChange = async (gameId, team, value) => {
    const numValue = parseInt(value);
    if (value === '' || (numValue >= 0 && numValue <= 99)) {
      const newScores = {
        ...actualScores,
        [currentWeek]: {
          ...actualScores[currentWeek],
          [gameId]: {
            ...actualScores[currentWeek]?.[gameId],
            [team]: value === '' ? '' : numValue
          }
        }
      };
      setActualScores(newScores);
      
      try {
        await set(ref(database, `actualScores/${currentWeek}/${gameId}/${team}`), value === '' ? null : numValue);
      } catch (error) {
        console.error('Error saving actual score:', error);
      }
    }
  };

  const handleGameStatusChange = async (gameId, status) => {
    const newStatus = {
      ...gameStatus,
      [currentWeek]: {
        ...gameStatus[currentWeek],
        [gameId]: status
      }
    };
    setGameStatus(newStatus);
    
    try {
      await set(ref(database, `gameStatus/${currentWeek}/${gameId}`), status || null);
    } catch (error) {
      console.error('Error saving game status:', error);
    }
  };

  const toggleWeekLock = async (week) => {
    const currentLockState = weekLocks[week]?.lockedByManager || false;
    const newLockState = !currentLockState;
    
    try {
      await update(ref(database, `weekLocks/${week}`), {
        lockedByManager: newLockState,
        lockedAt: new Date().toISOString(),
        lockedBy: playerCode
      });
    } catch (error) {
      console.error('Error toggling week lock:', error);
      alert('Failed to toggle lock. Please try again.');
    }
  };

  // ============================================
  // COMPUTED VALUES
  // ============================================

  const currentWeekData = PLAYOFF_WEEKS[currentWeek];

  const playerTotals = useMemo(() => {
    const totals = {};
    
    allPicks.forEach(pick => {
      if (!totals[pick.playerName]) {
        totals[pick.playerName] = {
          week1: 0,
          week2: 0,
          week3: 0,
          week4: 0,
          current: 0,
          grand: 0
        };
      }
      
      let weekTotal = 0;
      Object.values(pick.predictions).forEach(pred => {
        const t1 = parseInt(pred.team1) || 0;
        const t2 = parseInt(pred.team2) || 0;
        weekTotal += t1 + t2;
      });
      
      if (pick.week === 'wildcard') totals[pick.playerName].week1 = weekTotal;
      if (pick.week === 'divisional') totals[pick.playerName].week2 = weekTotal;
      if (pick.week === 'conference') totals[pick.playerName].week3 = weekTotal;
      if (pick.week === 'superbowl') totals[pick.playerName].week4 = weekTotal;
      
      if (pick.week === currentWeek) {
        totals[pick.playerName].current = weekTotal;
      }
    });
    
    Object.keys(totals).forEach(name => {
      totals[name].grand = 
        totals[name].week1 + 
        totals[name].week2 + 
        totals[name].week3 + 
        totals[name].week4;
    });
    
    return totals;
  }, [allPicks, currentWeek]);

  // ============================================
  // RENDER
  // ============================================

  if (!codeValidated) {
    return (
      <div className="App">
        <header className="App-header">
          <h1>🏈 Richard's NFL Playoff Pool 2025 🏈</h1>
        </header>
        
        <div className="login-container">
          <div className="login-box">
            <h2>🔐 ENTER YOUR PLAYER CODE</h2>
            <p>You received a 6-character code when you paid your $20 entry fee.</p>
            
            <form onSubmit={handleCodeSubmit}>
              <input
                type="text"
                value={playerCode}
                onChange={(e) => setPlayerCode(e.target.value.toUpperCase())}
                placeholder="A7K9M2"
                maxLength="6"
                style={{
                  width: '200px',
                  padding: '12px',
                  fontSize: '1.5rem',
                  textAlign: 'center',
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  border: '2px solid #667eea',
                  borderRadius: '8px',
                  margin: '20px 0'
                }}
              />
              <br />
              <button 
                type="submit"
                style={{
                  padding: '12px 40px',
                  fontSize: '1.1rem',
                  backgroundColor: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Enter Code & Continue
              </button>
            </form>

            <div style={{
              marginTop: '40px',
              padding: '20px',
              background: '#f8f9fa',
              borderRadius: '8px',
              border: '2px solid #e0e0e0'
            }}>
              <h3>💰 Don't have a code yet?</h3>
              <p><strong>Entry Fee:</strong> $20 per entry</p>
              <p><strong>Send e-Transfer to:</strong> gammoneer2b@gmail.com</p>
              <p><strong>Password:</strong> nflpool</p>
              <p>You'll receive your code after payment is confirmed.</p>
              <p><strong>Questions?</strong> Email: gammoneer2b@gmail.com</p>
            </div>
          </div>
        </div>

        <footer>
          <p>Richard's NFL Playoff Pool 2025 | Good luck! 🏈</p>
        </footer>
      </div>
    );
  }

  if (showStandings) {
    return (
      <div className="App">
        <header className="App-header">
          <h1>🏈 Richard's NFL Playoff Pool 2025 🏈</h1>
          <div style={{fontSize: '1rem', marginTop: '10px'}}>
            ✓ Logged in as: <strong>{playerName}</strong>
            {isPoolManager() && <span style={{marginLeft: '10px', color: '#ffd700'}}>👑 POOL MANAGER</span>}
          </div>
        </header>

        <div className="navigation-buttons">
          <button onClick={() => setShowStandings(false)}>
            ← Back to Make Picks
          </button>
          <button onClick={() => setPlayerCode('')}>
            🔄 Switch to Different Code
          </button>
        </div>

        <StandingsPage 
          allPicks={allPicks}
          actualScores={actualScores}
          gameStatus={gameStatus}
          playoffWeeks={PLAYOFF_WEEKS}
        />

        <footer>
          <p>Richard's NFL Playoff Pool 2025 | Good luck! 🏈</p>
        </footer>
      </div>
    );
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>🏈 Richard's NFL Playoff Pool 2025 🏈</h1>
        <div style={{fontSize: '1rem', marginTop: '10px'}}>
          ✓ Logged in as: <strong>{playerName}</strong>
          {isPoolManager() && <span style={{marginLeft: '10px', color: '#ffd700'}}>👑 POOL MANAGER</span>}
        </div>
      </header>

      <div className="navigation-buttons">
        <button onClick={() => setShowStandings(true)}>
          View Standings & Prize Leaders
        </button>
        <button onClick={() => setPlayerCode('')}>
          🔄 Switch to Different Code
        </button>
      </div>

      {/* ============================================
          🆕 STEP 5: WEEK SELECTOR COMPONENT
          ============================================ */}
      <WeekSelector
        currentWeek={currentWeek}
        onWeekChange={handleWeekChange}
        weekPicks={weekPicksStatus}
        weekLockStatus={weekLockStatus}
        hasUnsavedChanges={hasUnsavedChanges}
      />

      <div className="content-container">
        {isPoolManager() && (
          <ESPNControls
            currentWeek={currentWeek}
            onScoresUpdate={(scores) => {
              Object.entries(scores).forEach(([gameId, score]) => {
                handleActualScoreChange(parseInt(gameId), 'team1', score.team1);
                handleActualScoreChange(parseInt(gameId), 'team2', score.team2);
              });
            }}
            espnData={espnData}
            playoffWeeks={PLAYOFF_WEEKS}
          />
        )}

        <div className="week-section">
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: '20px',
            borderRadius: '10px',
            marginBottom: '20px',
            color: 'white',
            textAlign: 'center'
          }}>
            <h2 style={{margin: '0 0 10px 0', fontSize: '1.5rem'}}>
              🏈 YOU ARE MAKING PICKS FOR:
            </h2>
            <h3 style={{margin: '0 0 5px 0', fontSize: '1.3rem'}}>
              {currentWeekData.name}
            </h3>
            <p style={{margin: '0', fontSize: '1rem'}}>
              Deadline: {currentWeekData.deadline}
            </p>
            {isWeekLocked(currentWeek) ? (
              <p style={{
                margin: '10px 0 0 0',
                padding: '8px 15px',
                background: '#dc3545',
                borderRadius: '6px',
                display: 'inline-block',
                fontWeight: 'bold'
              }}>
                🔒 LOCKED - Cannot edit picks
              </p>
            ) : (
              <p style={{
                margin: '10px 0 0 0',
                padding: '8px 15px',
                background: 'rgba(255,255,255,0.2)',
                borderRadius: '6px',
                display: 'inline-block'
              }}>
                📝 You can edit until deadline
              </p>
            )}
          </div>

          {isPoolManager() && (
            <div style={{
              marginBottom: '20px',
              padding: '15px',
              background: '#fff3cd',
              borderRadius: '8px',
              border: '2px solid #ffc107'
            }}>
              <h3 style={{margin: '0 0 10px 0'}}>👑 Pool Manager Controls</h3>
              <button
                onClick={() => toggleWeekLock(currentWeek)}
                style={{
                  padding: '10px 20px',
                  fontSize: '1rem',
                  backgroundColor: weekLocks[currentWeek]?.lockedByManager ? '#dc3545' : '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                {weekLocks[currentWeek]?.lockedByManager ? '🔓 Unlock Week' : '🔒 Lock Week'}
              </button>
            </div>
          )}

          {isWeekLocked(currentWeek) && !isPoolManager() ? (
            <div style={{
              padding: '30px',
              background: '#f8d7da',
              border: '2px solid #dc3545',
              borderRadius: '10px',
              textAlign: 'center',
              fontSize: '1.2rem',
              color: '#721c24'
            }}>
              <div style={{fontSize: '3rem', marginBottom: '15px'}}>🔒</div>
              <strong>This week is locked.</strong>
              <p>You can no longer make or edit picks for this week.</p>
            </div>
          ) : (
            <>
              <div className="predictions-grid">
                {currentWeekData.games.map(game => (
                  <div key={game.id} className="game-card">
                    <div className="game-header">Game {game.id}</div>
                    <div className="game-matchup">
                      <div className="team-section">
                        <div className="team-name">{game.team1}</div>
                        <input
                          type="number"
                          min="10"
                          max="50"
                          value={predictions[game.id]?.team1 || ''}
                          onChange={(e) => handlePredictionChange(game.id, 'team1', e.target.value)}
                          placeholder="10-50"
                          disabled={isWeekLocked(currentWeek) && !isPoolManager()}
                        />
                      </div>
                      <div className="vs-divider">VS</div>
                      <div className="team-section">
                        <div className="team-name">{game.team2}</div>
                        <input
                          type="number"
                          min="10"
                          max="50"
                          value={predictions[game.id]?.team2 || ''}
                          onChange={(e) => handlePredictionChange(game.id, 'team2', e.target.value)}
                          placeholder="10-50"
                          disabled={isWeekLocked(currentWeek) && !isPoolManager()}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {!isWeekLocked(currentWeek) && (
                <div className="form-actions">
                  <button 
                    className="submit-btn"
                    onClick={handleSavePicks}
                  >
                    💾 Save Picks
                  </button>
                  <button 
                    className="cancel-btn"
                    onClick={handleCancelPicks}
                  >
                    ❌ Cancel
                  </button>
                </div>
              )}

              <div className="all-picks-section">
                <h2>📊 All Submitted Picks - {currentWeekData.name}</h2>
                <div className="table-container">
                  <table className="picks-table">
                    <thead>
                      <tr>
                        <th rowSpan="2" className="player-header">Player</th>
                        {currentWeekData.games.map(game => (
                          <th key={game.id} colSpan="2" className="game-header">
                            <div style={{fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '5px'}}>
                              Game {game.id}
                            </div>
                            <div style={{fontSize: '0.85rem', color: '#555'}}>
                              {game.team1}
                            </div>
                            <div style={{fontSize: '0.7rem', margin: '2px 0'}}>vs</div>
                            <div style={{fontSize: '0.85rem', color: '#555'}}>
                              {game.team2}
                            </div>
                          </th>
                        ))}
                        {currentWeek === 'superbowl' ? (
                          <>
                            <th rowSpan="2" style={{backgroundColor: '#fff3cd', color: '#000'}}>
                              Week 4<br/>Total
                            </th>
                            <th rowSpan="2" style={{backgroundColor: '#d1ecf1', color: '#000'}}>
                              Week 3<br/>Total
                            </th>
                            <th rowSpan="2" style={{backgroundColor: '#d4edda', color: '#000'}}>
                              Week 2<br/>Total
                            </th>
                            <th rowSpan="2" style={{backgroundColor: '#f8d7da', color: '#000'}}>
                              Week 1<br/>Total
                            </th>
                            <th rowSpan="2" className="grand-total-header">
                              GRAND<br/>TOTAL
                            </th>
                          </>
                        ) : (
                          <th rowSpan="2" style={{backgroundColor: '#f8f9fa', color: '#000'}}>
                            Week<br/>Total
                          </th>
                        )}
                        <th rowSpan="2" className="timestamp-header">Last Updated</th>
                      </tr>
                      <tr>
                        {currentWeekData.games.map(game => (
                          <React.Fragment key={`header-${game.id}`}>
                            <th className="score-header">
                              {game.team1.split(' ').pop()}
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
                            <th className="score-header">
                              {game.team2.split(' ').pop()}
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
                    </thead>
                    <tbody>
                      {allPicks
                        .filter(pick => pick.week === currentWeek)
                        .sort((a, b) => (b.lastUpdated || b.timestamp) - (a.lastUpdated || a.timestamp))
                        .map((pick, idx) => {
                          const hasCorrectPrediction = (gameId) => {
                            const actual = actualScores[currentWeek]?.[gameId];
                            const pred = pick.predictions[gameId];
                            if (!actual || !pred) return false;
                            
                            const actualTeam1 = parseInt(actual.team1);
                            const actualTeam2 = parseInt(actual.team2);
                            const predTeam1 = parseInt(pred.team1);
                            const predTeam2 = parseInt(pred.team2);
                            
                            if (isNaN(actualTeam1) || isNaN(actualTeam2)) return false;
                            
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
              </div>
            </>
          )}
        </div>

        {/* ============================================
            🆕 STEP 5: LEADER DISPLAY COMPONENT
            ============================================ */}
        <LeaderDisplay
          allPicks={allPicks}
          actualScores={actualScores}
          games={PLAYOFF_WEEKS}
          officialWinners={officialWinners}
          weekData={PLAYOFF_WEEKS}
        />

        {/* ============================================
            🆕 STEP 5: WINNER DECLARATION (POOL MANAGER ONLY)
            ============================================ */}
        {isPoolManager() && (
          <WinnerDeclaration
            allPicks={allPicks}
            actualScores={actualScores}
            games={PLAYOFF_WEEKS}
            officialWinners={officialWinners}
            onDeclareWinner={handleDeclareWinner}
            isPoolManager={true}
          />
        )}
      </div>

      {/* ============================================
          🆕 STEP 5: VALIDATION POPUPS
          ============================================ */}
      
      {showPopup === 'unsavedChanges' && (
        <UnsavedChangesPopup
          currentWeek={currentWeek}
          onDiscard={() => {
            setCurrentWeek(pendingWeekChange);
            setHasUnsavedChanges(false);
            setShowPopup(null);
            setPendingWeekChange(null);
          }}
          onSaveAndSwitch={async () => {
            await handleSavePicks();
            // Only switch if save was successful (no popup shown)
            if (showPopup === 'unsavedChanges') {
              setCurrentWeek(pendingWeekChange);
              setShowPopup(null);
              setPendingWeekChange(null);
            }
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
