// ============================================
// LEADER DISPLAY COMPONENT
// Shows current leaders for all 10 prizes
// ============================================

import React, { useState, useEffect } from 'react';
import './LeaderDisplay.css';
import { 
  getPrizeLeaders, 
  exportToCSV, 
  downloadCSV, 
  formatTimestamp 
} from './winnerService';

const PRIZE_INFO = {
  1: { name: 'Most Correct Winners', week: 'Week 1' },
  2: { name: 'Closest Total Points', week: 'Week 1' },
  3: { name: 'Most Correct Winners', week: 'Week 2' },
  4: { name: 'Closest Total Points', week: 'Week 2' },
  5: { name: 'Most Correct Winners', week: 'Week 3' },
  6: { name: 'Closest Total Points', week: 'Week 3' },
  7: { name: 'Most Correct Winners', week: 'Week 4' },
  8: { name: 'Closest Total Points', week: 'Week 4' },
  9: { name: 'Overall Most Correct Winners', week: 'All Weeks' },
  10: { name: 'Overall Closest Total Points', week: 'All Weeks' }
};

/**
 * Single Prize Leader Card
 */
function PrizeLeaderCard({ 
  prizeNumber, 
  allPicks, 
  actualScores, 
  games, 
  officialWinner = null,
  onExport 
}) {
  const [leaders, setLeaders] = useState(null);
  const [loading, setLoading] = useState(true);

  const prizeInfo = PRIZE_INFO[prizeNumber];

  useEffect(() => {
    try {
      const leaderData = getPrizeLeaders(prizeNumber, allPicks, actualScores, games);
      setLeaders(leaderData);
      setLoading(false);
    } catch (error) {
      console.error(`Error calculating leaders for Prize ${prizeNumber}:`, error);
      setLoading(false);
    }
  }, [prizeNumber, allPicks, actualScores, games]);

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

  if (!leaders || leaders.leaders.length === 0) {
    return (
      <div className="leader-card no-data">
        <div className="leader-card-header">
          <h3>Prize #{prizeNumber} - {prizeInfo.name}</h3>
          <span className="prize-week">{prizeInfo.week}</span>
        </div>
        <div className="leader-card-body">
          <p>No picks available yet.</p>
        </div>
      </div>
    );
  }

  const { leaders: leaderList, isTie, tiedCount } = leaders;

  return (
    <div className="leader-card">
      <div className="leader-card-header">
        <div className="prize-title">
          <h3>PRIZE #{prizeNumber} - {prizeInfo.name}</h3>
          <span className="prize-week">{prizeInfo.week}</span>
        </div>
        <div className="prize-status">
          {officialWinner ? (
            <span className="status-badge announced">
              ✅ Winner Announced
            </span>
          ) : (
            <span className="status-badge pending">
              ⏳ Awaiting Official Announcement
            </span>
          )}
        </div>
      </div>

      <div className="leader-card-body">
        {officialWinner ? (
          <div className="official-winner">
            <div className="winner-icon">🏆</div>
            <div className="winner-info">
              <div className="winner-name">{officialWinner.playerName}</div>
              <div className="winner-score">
                {prizeNumber % 2 === 1 
                  ? `${officialWinner.score} Correct Winners`
                  : `${officialWinner.score} Points Difference`
                }
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="leaders-section">
              <h4>CURRENT LEADERS (Automatic Calculation):</h4>
              
              <table className="leaders-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Player</th>
                    <th>{prizeNumber % 2 === 1 ? 'Correct' : 'Difference'}</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderList.slice(0, 10).map((leader, index) => (
                    <tr 
                      key={index}
                      className={leader.isLeading ? 'leading' : ''}
                    >
                      <td className="rank-cell">{leader.rank}</td>
                      <td className="player-cell">{leader.playerName}</td>
                      <td className="score-cell">{leader.score}</td>
                      <td className="status-cell">
                        {leader.isLeading ? (
                          <span className="leading-badge">LEADING</span>
                        ) : (
                          <span className="trailing-badge">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {isTie && (
              <div className="tie-warning">
                <div className="tie-icon">⚠️</div>
                <div className="tie-message">
                  <strong>{tiedCount}-way tie detected</strong>
                  <p>
                    Pool Manager will apply tie-breaker rules and announce 
                    official winner(s) per the rulebook.
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {onExport && (
        <div className="leader-card-footer">
          <button 
            className="export-btn"
            onClick={() => onExport(prizeNumber)}
          >
            📥 Export {prizeInfo.week} - All Players & Scores
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Main LeaderDisplay Component
 * Shows all 10 prizes
 */
function LeaderDisplay({ 
  allPicks, 
  actualScores, 
  games, 
  officialWinners = {},
  weekData 
}) {

  const handleExport = (prizeNumber) => {
    try {
      const prizeInfo = PRIZE_INFO[prizeNumber];
      const weekKey = prizeInfo.week.toLowerCase().replace(/\s+/g, '');
      
      // Get week-specific data
      const weekGames = games[weekKey] || [];
      const weekActual = actualScores[weekKey] || {};
      const weekPicks = {};
      
      // Filter picks for this week
      Object.keys(allPicks).forEach(playerCode => {
        if (allPicks[playerCode][weekKey]) {
          weekPicks[playerCode] = {
            ...allPicks[playerCode],
            picks: allPicks[playerCode][weekKey]
          };
        }
      });

      // Generate CSV
      const csvContent = exportToCSV(
        weekKey,
        weekPicks,
        weekActual,
        weekGames,
        weekData[weekKey]
      );

      // Download
      const timestamp = formatTimestamp(new Date());
      const filename = `${timestamp}-${weekKey}-all-picks.csv`;
      downloadCSV(csvContent, filename);

      console.log(`Exported ${filename}`);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    }
  };

  return (
    <div className="leader-display-container">
      <div className="leader-display-header">
        <h2>🏆 PRIZE LEADERS</h2>
        <p className="subtitle">
          Current standings for all 10 prizes. Winners will be officially announced 
          by the Pool Manager after each week concludes.
        </p>
      </div>

      <div className="prize-grid">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(prizeNum => (
          <PrizeLeaderCard
            key={prizeNum}
            prizeNumber={prizeNum}
            allPicks={allPicks}
            actualScores={actualScores}
            games={games}
            officialWinner={officialWinners[prizeNum]}
            onExport={handleExport}
          />
        ))}
      </div>
    </div>
  );
}

export default LeaderDisplay;
