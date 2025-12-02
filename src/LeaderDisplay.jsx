// ============================================
// LEADER DISPLAY COMPONENT - FINAL VERSION
// Shows ALL tied leaders + ALL players
// Black text on yellow backgrounds
// Official winner badge ONLY when Pool Manager declares
// ============================================

import React, { useState, useEffect } from 'react';
import './LeaderDisplay.css';

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
 * Calculate leaders for a specific prize
 */
function calculatePrizeLeaders(prizeNumber, allPicks, actualScores, weekData) {
  const prizeInfo = PRIZE_INFO[prizeNumber];
  const isCorrectWinners = [1, 3, 5, 7, 9].includes(prizeNumber);
  
  // Get picks for the specific week(s)
  let relevantPicks = [];
  let relevantScores = {};
  let games = [];
  
  if (prizeInfo.week === 'all') {
    // Overall prizes - use all weeks
    relevantPicks = allPicks;
    relevantScores = actualScores;
    // Combine all games
    Object.keys(weekData).forEach(weekKey => {
      games = games.concat(weekData[weekKey].games.map(g => ({...g, week: weekKey})));
    });
  } else {
    // Single week prize
    relevantPicks = allPicks.filter(p => p.week === prizeInfo.week);
    relevantScores = actualScores[prizeInfo.week] || {};
    games = weekData[prizeInfo.week]?.games || [];
  }
  
  if (relevantPicks.length === 0) {
    return { leaders: [], allPlayers: [], hasTie: false, tieCount: 0 };
  }
  
  if (isCorrectWinners) {
    // Calculate Most Correct Winners
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
    
    // Sort by correct count (highest first)
    results.sort((a, b) => b.score - a.score);
    
    const topScore = results[0]?.score || 0;
    const tiedLeaders = results.filter(r => r.score === topScore);
    
    return {
      leaders: tiedLeaders,
      allPlayers: results,
      hasTie: tiedLeaders.length > 1,
      tieCount: tiedLeaders.length
    };
    
  } else {
    // Calculate Closest Total Points
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
        actualTotal,
        difference
      };
    });
    
    // Sort by smallest difference
    results.sort((a, b) => a.difference - b.difference);
    
    const topDifference = results[0]?.difference || 0;
    const tiedLeaders = results.filter(r => r.difference === topDifference);
    
    return {
      leaders: tiedLeaders,
      allPlayers: results,
      hasTie: tiedLeaders.length > 1,
      tieCount: tiedLeaders.length,
      actualTotal
    };
  }
}

/**
 * Single Prize Leader Card
 */
function PrizeLeaderCard({ 
  prizeNumber, 
  allPicks, 
  actualScores, 
  weekData,
  officialWinner = null
}) {
  const [leaderData, setLeaderData] = useState(null);
  const [loading, setLoading] = useState(true);

  const prizeInfo = PRIZE_INFO[prizeNumber];
  const isCorrectWinners = [1, 3, 5, 7, 9].includes(prizeNumber);

  useEffect(() => {
    try {
      const data = calculatePrizeLeaders(prizeNumber, allPicks, actualScores, weekData);
      setLeaderData(data);
      setLoading(false);
    } catch (error) {
      console.error(`Error calculating leaders for Prize ${prizeNumber}:`, error);
      setLoading(false);
    }
  }, [prizeNumber, allPicks, actualScores, weekData]);

  if (loading) {
    return (
      <div className="leader-card loading">
        <div className="leader-card-header">
          <h3>Prize #{prizeNumber} - {prizeInfo.name}</h3>
        </div>
        <div className="leader-card-body">
          <p>Calculating leaders...</p>
        </div>
      </div>
    );
  }

  if (!leaderData || leaderData.allPlayers.length === 0) {
    return (
      <div className="leader-card no-data">
        <div className="leader-card-header">
          <h3>Prize #{prizeNumber} - {prizeInfo.name}</h3>
          <span className="prize-week">{prizeInfo.weekName}</span>
        </div>
        <div className="leader-card-body">
          <p>No picks available yet.</p>
        </div>
      </div>
    );
  }

  const { leaders, allPlayers, hasTie, tieCount } = leaderData;

  return (
    <div className={`leader-card ${hasTie ? 'has-tie' : ''}`}>
      <div className="leader-card-header">
        <h3>Prize #{prizeNumber} - {prizeInfo.name}</h3>
        <span className="prize-week">{prizeInfo.weekName}</span>
      </div>
      
      <div className="leader-card-body">
        {/* Show tie warning with BLACK text on yellow */}
        {hasTie && (
          <div className="tie-warning">
            ⚠️ {tieCount}-WAY TIE FOR 1ST PLACE!
          </div>
        )}
        
        {/* Show ALL tied leaders */}
        {hasTie && (
          <div className="tied-leaders-section">
            <h4>🏆 TIED FOR 1ST PLACE:</h4>
            <div className="leaders-list">
              {leaders.map((leader, idx) => (
                <div 
                  key={idx} 
                  className={`leader-item ${officialWinner?.playerCode === leader.playerCode ? 'official-winner' : 'tied-leader'}`}
                >
                  <span className="leader-rank">{idx + 1}.</span>
                  <span className="leader-name">{leader.playerName}</span>
                  <span className="leader-score">
                    {isCorrectWinners 
                      ? `${leader.score} correct`
                      : `${leader.score} pts (off by ${leader.difference})`
                    }
                  </span>
                  {/* Show LEADING badge if NOT the official winner */}
                  {!officialWinner && (
                    <span className="leading-badge">🏆 LEADING</span>
                  )}
                  {/* Show OFFICIAL WINNER badge ONLY if this player is declared winner */}
                  {officialWinner?.playerCode === leader.playerCode && (
                    <span className="official-badge">👑 OFFICIAL WINNER</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Show next 5-10 non-tied players after tied leaders */}
        {hasTie && allPlayers.length > tieCount && (
          <div className="next-in-line-section">
            <h4>📊 NEXT IN LINE:</h4>
            <div className="leaders-list">
              {allPlayers.slice(tieCount, tieCount + 10).map((player, idx) => (
                <div key={idx} className="leader-item">
                  <span className="leader-rank">{tieCount + idx + 1}.</span>
                  <span className="leader-name">{player.playerName}</span>
                  <span className="leader-score">
                    {isCorrectWinners 
                      ? `${player.score} correct`
                      : `${player.score} pts (off by ${player.difference})`
                    }
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Show ALL players if no tie (clear leader) */}
        {!hasTie && (
          <div className="all-players-section">
            <h4>📊 ALL PLAYERS RANKED:</h4>
            <div className="leaders-list">
              {allPlayers.map((player, idx) => (
                <div 
                  key={idx} 
                  className={`leader-item ${idx === 0 && officialWinner?.playerCode === player.playerCode ? 'official-winner' : ''}`}
                >
                  <span className="leader-rank">{idx + 1}.</span>
                  <span className="leader-name">{player.playerName}</span>
                  <span className="leader-score">
                    {isCorrectWinners 
                      ? `${player.score} correct`
                      : `${player.score} pts (off by ${player.difference})`
                    }
                  </span>
                  {idx === 0 && !officialWinner && (
                    <span className="leading-badge">🏆 LEADING</span>
                  )}
                  {idx === 0 && officialWinner?.playerCode === player.playerCode && (
                    <span className="official-badge">👑 OFFICIAL WINNER</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Show official winner status */}
        {!officialWinner && (
          <div className="no-official-winner">
            <em>No official winner declared yet</em>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Main Leader Display Component
 */
function LeaderDisplay({ allPicks, actualScores, games, officialWinners, weekData }) {
  return (
    <div className="leaders-section">
      <h2>🏆 Prize Leaders</h2>
      <p className="leaders-description">
        Current standings for all 10 prizes. Winners will be officially announced by the Pool Manager.
      </p>
      
      <div className="prize-grid">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(prizeNum => (
          <PrizeLeaderCard
            key={prizeNum}
            prizeNumber={prizeNum}
            allPicks={allPicks}
            actualScores={actualScores}
            weekData={weekData}
            officialWinner={officialWinners?.[prizeNum]}
          />
        ))}
      </div>
    </div>
  );
}

export default LeaderDisplay;
