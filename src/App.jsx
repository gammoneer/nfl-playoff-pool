import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, push, onValue } from 'firebase/database';
import './App.css';

// Firebase configuration - USER WILL NEED TO REPLACE THESE
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

// Playoff structure - update these with actual matchups when known
const PLAYOFF_WEEKS = {
  wildcard: {
    name: "Wild Card Round",
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
    name: "Divisional Round",
    games: [
      { id: 7, team1: "AFC Winner 1", team2: "AFC #1" },
      { id: 8, team1: "AFC Winner 2", team2: "AFC Winner 3" },
      { id: 9, team1: "NFC Winner 1", team2: "NFC #1" },
      { id: 10, team1: "NFC Winner 2", team2: "NFC Winner 3" }
    ]
  },
  conference: {
    name: "Conference Championships",
    games: [
      { id: 11, team1: "AFC Winner A", team2: "AFC Winner B" },
      { id: 12, team1: "NFC Winner A", team2: "NFC Winner B" }
    ]
  },
  superbowl: {
    name: "Super Bowl LIX",
    games: [
      { id: 13, team1: "AFC Champion", team2: "NFC Champion" }
    ]
  }
};

function App() {
  const [playerName, setPlayerName] = useState('');
  const [currentWeek, setCurrentWeek] = useState('wildcard');
  const [predictions, setPredictions] = useState({});
  const [allPicks, setAllPicks] = useState([]);
  const [submitted, setSubmitted] = useState(false);

  // Load all picks from Firebase
  useEffect(() => {
    const picksRef = ref(database, 'picks');
    onValue(picksRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const picksArray = Object.values(data);
        setAllPicks(picksArray);
      }
    });
  }, []);

  const handleScoreChange = (gameId, team, score) => {
    setPredictions(prev => ({
      ...prev,
      [gameId]: {
        ...prev[gameId],
        [team]: score
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!playerName.trim()) {
      alert('Please enter your name');
      return;
    }

    const weekGames = PLAYOFF_WEEKS[currentWeek].games;
    const incompletePredictions = weekGames.some(game => 
      !predictions[game.id]?.team1 || !predictions[game.id]?.team2
    );

    if (incompletePredictions) {
      alert('Please enter scores for all games');
      return;
    }

    const pickData = {
      playerName: playerName.trim(),
      week: currentWeek,
      weekName: PLAYOFF_WEEKS[currentWeek].name,
      predictions: predictions,
      timestamp: Date.now()
    };

    try {
      const picksRef = ref(database, 'picks');
      await push(picksRef, pickData);
      setSubmitted(true);
      alert('Picks submitted successfully!');
      
      // Reset form
      setPredictions({});
      setPlayerName('');
      setTimeout(() => setSubmitted(false), 3000);
    } catch (error) {
      alert('Error submitting picks: ' + error.message);
    }
  };

  const currentWeekData = PLAYOFF_WEEKS[currentWeek];

  return (
    <div className="App">
      <header>
        <h1>🏈 NFL Playoff Pool 2025</h1>
        <p>Enter your score predictions for each game</p>
      </header>

      <div className="container">
        {/* Week Selector */}
        <div className="week-selector">
          <button 
            className={currentWeek === 'wildcard' ? 'active' : ''} 
            onClick={() => setCurrentWeek('wildcard')}
          >
            Wild Card
          </button>
          <button 
            className={currentWeek === 'divisional' ? 'active' : ''} 
            onClick={() => setCurrentWeek('divisional')}
          >
            Divisional
          </button>
          <button 
            className={currentWeek === 'conference' ? 'active' : ''} 
            onClick={() => setCurrentWeek('conference')}
          >
            Conference
          </button>
          <button 
            className={currentWeek === 'superbowl' ? 'active' : ''} 
            onClick={() => setCurrentWeek('superbowl')}
          >
            Super Bowl
          </button>
        </div>

        {/* Prediction Form */}
        <div className="prediction-form">
          <h2>{currentWeekData.name}</h2>
          
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Your Name:</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name"
                required
              />
            </div>

            {currentWeekData.games.map(game => (
              <div key={game.id} className="game-prediction">
                <h3>Game {game.id}</h3>
                <div className="score-inputs">
                  <div className="team-score">
                    <label>{game.team1}</label>
                    <input
                      type="number"
                      min="0"
                      max="99"
                      value={predictions[game.id]?.team1 || ''}
                      onChange={(e) => handleScoreChange(game.id, 'team1', e.target.value)}
                      required
                    />
                  </div>
                  <span className="vs">vs</span>
                  <div className="team-score">
                    <label>{game.team2}</label>
                    <input
                      type="number"
                      min="0"
                      max="99"
                      value={predictions[game.id]?.team2 || ''}
                      onChange={(e) => handleScoreChange(game.id, 'team2', e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>
            ))}

            <button type="submit" className="submit-btn">
              {submitted ? '✓ Submitted!' : 'Submit Picks'}
            </button>
          </form>
        </div>

        {/* Display All Picks */}
        <div className="all-picks">
          <h2>All Player Picks - {currentWeekData.name}</h2>
          
          {allPicks.filter(pick => pick.week === currentWeek).length === 0 ? (
            <p className="no-picks">No picks submitted yet for this week.</p>
          ) : (
            <div className="picks-table-container">
              <table className="picks-table">
                <thead>
                  <tr>
                    <th>Player</th>
                    {currentWeekData.games.map(game => (
                      <th key={game.id} colSpan="2">
                        Game {game.id}<br/>
                        <small>{game.team1} vs {game.team2}</small>
                      </th>
                    ))}
                    <th>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {allPicks
                    .filter(pick => pick.week === currentWeek)
                    .sort((a, b) => a.timestamp - b.timestamp)
                    .map((pick, idx) => (
                      <tr key={idx}>
                        <td className="player-name">{pick.playerName}</td>
                        {currentWeekData.games.map(game => (
                          <React.Fragment key={game.id}>
                            <td className="score">{pick.predictions[game.id]?.team1 || '-'}</td>
                            <td className="score">{pick.predictions[game.id]?.team2 || '-'}</td>
                          </React.Fragment>
                        ))}
                        <td className="timestamp">
                          {new Date(pick.timestamp).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <footer>
        <p>NFL Playoff Pool 2025 • Updates in real-time</p>
      </footer>
    </div>
  );
}

export default App;
