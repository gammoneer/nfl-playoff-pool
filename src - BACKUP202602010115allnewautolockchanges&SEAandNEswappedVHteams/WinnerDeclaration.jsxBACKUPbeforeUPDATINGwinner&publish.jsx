// ============================================
// WINNER DECLARATION COMPONENT - FINAL VERSION
// ALWAYS shows dropdown (even if no picks)
// Shows ALL players in dropdown (no limit)
// ============================================

import React, { useState } from 'react';
import './WinnerDeclaration.css';

const PRIZE_INFO = {
  1: { name: 'Most Correct Winners', week: 'wildcard', weekName: 'Week 1' },
  2: { name: 'Closest Total Points', week: 'wildcard', weekName: 'Week 1' },
  3: { name: 'Most Correct Winners', week: 'divisional', weekName: 'Week 2' },
  4: { name: 'Closest Total Points', week: 'divisional', weekName: 'Week 2' },
  5: { name: 'Most Correct Winners', week: 'conference', weekName: 'Week 3' },
  6: { name: 'Closest Total Points', week: 'conference', weekName: 'Week 3' },
  7: { name: 'Most Correct Winners', week: 'superbowl', weekName: 'Week 4' },
  8: { name: 'Closest Total Points', week: 'superbowl', weekName: 'Week 4' },
  9: { name: 'Overall Most Correct Winners', week: 'all', weekName: 'All Weeks' },
  10: { name: 'Overall Closest Total Points', week: 'all', weekName: 'All Weeks' }
};

/**
 * Calculate leaders for dropdown (ALL players)
 */
function calculatePrizeLeaders(prizeNumber, allPicks, actualScores, weekData) {
  const prizeInfo = PRIZE_INFO[prizeNumber];
  const isCorrectWinners = [1, 3, 5, 7, 9].includes(prizeNumber);
  
  let relevantPicks = [];
  let relevantScores = {};
  let games = [];
  
  if (prizeInfo.week === 'all') {
    relevantPicks = allPicks;
    relevantScores = actualScores;
    Object.keys(weekData).forEach(weekKey => {
      games = games.concat(weekData[weekKey].games.map(g => ({...g, week: weekKey})));
    });
  } else {
    relevantPicks = allPicks.filter(p => p.week === prizeInfo.week);
    relevantScores = actualScores[prizeInfo.week] || {};
    games = weekData[prizeInfo.week]?.games || [];
  }
  
  if (relevantPicks.length === 0) {
    return [];
  }
  
  if (isCorrectWinners) {
    const results = relevantPicks.map(pick => {
      let correctCount = 0;
      
      games.forEach(game => {
        const playerPrediction = pick.predictions?.[game.id];
        const actualScore = prizeInfo.week === 'all' 
          ? actualScores[game.week]?.[game.id]
          : relevantScores[game.id];
        
        if (!playerPrediction || !actualScore) return;
        
        const playerWinner = parseInt(playerPrediction.team1) > parseInt(playerPrediction.team2) ? 'team1' : 'team2';
        const actualWinner = parseInt(actualScore.team1) > parseInt(actualScore.team2) ? 'team1' : 'team2';
        
        if (playerWinner === actualWinner) {
          correctCount++;
        }
      });
      
      return {
        playerCode: pick.playerCode,
        playerName: pick.playerName,
        score: correctCount
      };
    });
    
    return results.sort((a, b) => b.score - a.score);
    
  } else {
    let actualTotal = 0;
    
    games.forEach(game => {
      const score = prizeInfo.week === 'all'
        ? actualScores[game.week]?.[game.id]
        : relevantScores[game.id];
      
      if (score) {
        actualTotal += (parseInt(score.team1) || 0) + (parseInt(score.team2) || 0);
      }
    });
    
    const results = relevantPicks.map(pick => {
      let playerTotal = 0;
      
      games.forEach(game => {
        const prediction = pick.predictions?.[game.id];
        if (prediction) {
          playerTotal += (parseInt(prediction.team1) || 0) + (parseInt(prediction.team2) || 0);
        }
      });
      
      const difference = Math.abs(playerTotal - actualTotal);
      
      return {
        playerCode: pick.playerCode,
        playerName: pick.playerName,
        score: playerTotal,
        difference
      };
    });
    
    return results.sort((a, b) => a.difference - b.difference);
  }
}

/**
 * Single Prize Declaration Card
 */
function PrizeDeclarationCard({ 
  prizeNumber, 
  allPicks, 
  actualScores, 
  weekData,
  officialWinner,
  onDeclareWinner 
}) {
  const [selectedWinner, setSelectedWinner] = useState(
    officialWinner ? `${officialWinner.playerCode}|${officialWinner.playerName}` : ''
  );

  const prizeInfo = PRIZE_INFO[prizeNumber];
  const allPlayers = calculatePrizeLeaders(prizeNumber, allPicks, actualScores, weekData);
  const isCorrectWinners = [1, 3, 5, 7, 9].includes(prizeNumber);

  const handleDeclare = () => {
    if (!selectedWinner) {
      onDeclareWinner(prizeNumber, null);
      return;
    }

    if (selectedWinner === 'TIE') {
      onDeclareWinner(prizeNumber, {
        playerCode: 'TIE',
        playerName: 'TIE - Multiple Winners',
        score: 'TIE'
      });
      return;
    }

    const [playerCode, playerName] = selectedWinner.split('|');
    const player = allPlayers.find(p => p.playerCode === playerCode);
    
    onDeclareWinner(prizeNumber, {
      playerCode,
      playerName,
      score: player?.score || 0
    });
  };

  return (
    <div className="prize-declaration-card">
      <div className="prize-header">
        <h3>Prize #{prizeNumber}</h3>
        <span className="prize-type">{prizeInfo.name}</span>
        <span className="prize-week">{prizeInfo.weekName}</span>
      </div>

      <div className="prize-body">
        {/* ALWAYS show this section, even if no picks */}
        {allPlayers.length === 0 ? (
          <div className="no-picks-warning">
            ❌ No picks submitted yet for this week
          </div>
        ) : (
          <div className="current-leaders">
            <h4>📊 ALL PLAYERS RANKED:</h4>
            <ol className="all-players-list">
              {allPlayers.map((player, idx) => (
                <li key={idx}>
                  {player.playerName} - {' '}
                  {isCorrectWinners 
                    ? `${player.score} correct`
                    : `${player.score} pts (off by ${player.difference})`
                  }
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* ALWAYS show winner selection - even if no picks */}
        <div className="winner-selection">
          <label>
            <strong>Declare Official Winner:</strong>
            <select 
              value={selectedWinner} 
              onChange={(e) => setSelectedWinner(e.target.value)}
              className="winner-dropdown"
            >
              <option value="">-- No Winner Declared --</option>
              <option value="TIE">🏆 DECLARE TIE</option>
              {/* Show ALL players in dropdown, no limit */}
              {allPlayers.map((player, idx) => (
                <option 
                  key={idx} 
                  value={`${player.playerCode}|${player.playerName}`}
                >
                  {player.playerName} ({isCorrectWinners 
                    ? `${player.score} correct`
                    : `off by ${player.difference}`
                  })
                </option>
              ))}
            </select>
          </label>
          
          <button 
            className="btn-declare" 
            onClick={handleDeclare}
          >
            {selectedWinner ? '👑 Declare Winner' : '🗑️ Remove Winner'}
          </button>
        </div>

        {officialWinner && (
          <div className="current-winner">
            ✅ Official Winner: <strong>{officialWinner.playerName}</strong>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Main Winner Declaration Component
 */
function WinnerDeclaration({ 
  allPicks, 
  actualScores, 
  games, 
  officialWinners, 
  onDeclareWinner,
  isPoolManager 
}) {
  if (!isPoolManager) {
    return null;
  }

  return (
    <div className="winner-declaration-section">
      <h2>👑 Pool Manager: Declare Official Winners</h2>
      <p className="declaration-description">
        Select the official winner for each prize. You can choose from calculated leaders or declare a tie.
        <strong> Dropdowns are available even if no picks have been submitted yet.</strong>
      </p>

      <div className="prize-grid">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(prizeNum => (
          <PrizeDeclarationCard
            key={prizeNum}
            prizeNumber={prizeNum}
            allPicks={allPicks}
            actualScores={actualScores}
            weekData={games}
            officialWinner={officialWinners?.[prizeNum]}
            onDeclareWinner={onDeclareWinner}
          />
        ))}
      </div>
    </div>
  );
}

export default WinnerDeclaration;
