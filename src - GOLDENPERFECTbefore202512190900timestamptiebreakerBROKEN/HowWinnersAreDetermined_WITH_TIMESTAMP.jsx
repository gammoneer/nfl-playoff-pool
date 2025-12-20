import React, { useMemo } from 'react';
import './HowWinnersAreDetermined.css';

const HowWinnersAreDetermined = ({ 
  calculatedWinners, 
  publishedWinners, 
  isPoolManager, 
  onPublishPrize, 
  onUnpublishPrize,
  allPicks = [],
  actualScores = {}
}) => {

  // Playoff week configuration
  const PLAYOFF_WEEKS = {
    wildcard: { name: 'Wild Card Round', weekNum: 1 },
    divisional: { name: 'Divisional Round', weekNum: 2 },
    conference: { name: 'Conference Championships', weekNum: 3 },
    superbowl: { name: 'Super Bowl LIX', weekNum: 4 }
  };

  // Get timestamp from pick (use lastUpdated, fallback to timestamp)
  const getPickTimestamp = (pick) => {
    return pick.lastUpdated || pick.timestamp || 0;
  };

  // Format timestamp for display
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'No timestamp';
    const date = new Date(timestamp);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    
    return `${month}/${day}, ${String(displayHours).padStart(2, '0')}:${minutes}:${seconds} ${ampm}`;
  };

  // Calculate timestamp analysis for all weeks
  const timestampAnalysis = useMemo(() => {
    const analysis = {
      weeks: {},
      seasonSummary: {
        weeksAnalyzed: 0,
        totalPrizes: 0,
        prizesWithTies: 0,
        tiesWouldBreak: 0,
        totalPlayersInTies: 0,
        totalTieInstances: 0
      }
    };

    Object.entries(PLAYOFF_WEEKS).forEach(([weekKey, weekInfo]) => {
      const weekPicks = allPicks.filter(p => p.week === weekKey);
      const weekScores = actualScores[weekKey];
      
      // Skip if week not started
      if (!weekScores || weekPicks.length === 0) {
        return;
      }

      analysis.seasonSummary.weeksAnalyzed++;
      
      const weekAnalysis = {
        weekName: weekInfo.name,
        prizes: []
      };

      // Analyze each prize for this week
      const prizes = calculatedWinners[weekKey] || {};
      
      Object.entries(prizes).forEach(([prizeKey, prizeData]) => {
        analysis.seasonSummary.totalPrizes++;
        
        const winners = Array.isArray(prizeData.winners) ? prizeData.winners : [prizeData.winner].filter(Boolean);
        
        if (winners.length > 1) {
          // There's a tie - analyze timestamp impact
          analysis.seasonSummary.prizesWithTies++;
          analysis.seasonSummary.totalPlayersInTies += winners.length;
          analysis.seasonSummary.totalTieInstances++;
          
          // Get picks for all tied winners with timestamps
          const tiedPicks = winners.map(winnerCode => {
            const pick = weekPicks.find(p => p.playerCode === winnerCode);
            return {
              playerCode: winnerCode,
              playerName: pick?.playerName || winnerCode,
              timestamp: getPickTimestamp(pick),
              pick: pick
            };
          }).filter(p => p.pick); // Only include those with picks found
          
          // Sort by timestamp (earliest first)
          tiedPicks.sort((a, b) => a.timestamp - b.timestamp);
          
          const prizeAnalysis = {
            prizeKey,
            prizeTitle: prizeData.title || prizeKey,
            officialResult: `${winners.length}-way tie`,
            tiedPlayers: tiedPicks,
            hypotheticalWinner: tiedPicks[0],
            timestampWouldBreak: tiedPicks.length > 1
          };
          
          if (prizeAnalysis.timestampWouldBreak) {
            analysis.seasonSummary.tiesWouldBreak++;
          }
          
          weekAnalysis.prizes.push(prizeAnalysis);
        } else if (winners.length === 1) {
          // Solo winner - timestamp not needed
          const pick = weekPicks.find(p => p.playerCode === winners[0]);
          weekAnalysis.prizes.push({
            prizeKey,
            prizeTitle: prizeData.title || prizeKey,
            officialResult: 'Solo winner',
            soloWinner: {
              playerCode: winners[0],
              playerName: pick?.playerName || winners[0],
              timestamp: getPickTimestamp(pick)
            },
            timestampWouldBreak: false
          });
        }
      });

      if (weekAnalysis.prizes.length > 0) {
        analysis.weeks[weekKey] = weekAnalysis;
      }
    });

    return analysis;
  }, [calculatedWinners, allPicks, actualScores]);

  // Calculate scale projections
  const scaleProjections = useMemo(() => {
    const { weeksAnalyzed, prizesWithTies, totalPrizes } = timestampAnalysis.seasonSummary;
    
    if (weeksAnalyzed === 0 || totalPrizes === 0) {
      return null;
    }

    const tieRate = prizesWithTies / totalPrizes;
    const currentPlayers = 50; // Your current pool size

    return {
      currentPlayers,
      tieRate,
      projections: {
        1000: {
          players: 1000,
          expectedTiesPerPrize: '15-30 way ties',
          prizeWithout: '$100 ÷ 20 = $5.00 each',
          prizeWith: '$100 ÷ 1 = $100.00',
          improvement: '+$95.00 (1900% increase)'
        },
        10000: {
          players: 10000,
          expectedTiesPerPrize: '50-200 way ties',
          prizeWithout: '$100 ÷ 100 = $1.00 each',
          prizeWith: '$100 ÷ 1 = $100.00',
          improvement: '+$99.00 (9900% increase)'
        }
      }
    };
  }, [timestampAnalysis]);

  return (
    <div className="winners-page">
      <h1>⚖️ How Winners Are Determined</h1>

      {/* Existing tie-breaker rules content */}
      <div className="rules-section">
        <div className="rule-block">
          <h2>🏆 Prize Structure</h2>
          <p>
            The pool awards <strong>10 total prizes</strong> across the 4-week playoff period:
          </p>
          <ul>
            <li><strong>Weeks 1, 2, 3:</strong> 2 prizes each (6 total)</li>
            <li><strong>Week 4 (Super Bowl):</strong> 4 prizes (4 total)</li>
          </ul>
        </div>

        <div className="rule-block">
          <h2>📊 Weekly Prizes (Weeks 1, 2, 3)</h2>
          
          <div className="prize-card">
            <h3>Prize #1: Most Correct Winners</h3>
            <p className="prize-description">
              The player who correctly predicts the most game winners for that week.
            </p>
            <div className="tiebreaker">
              <strong>Tiebreaker:</strong> Closest to the actual total points for that week
            </div>
          </div>

          <div className="prize-card">
            <h3>Prize #2: Closest to Actual Total</h3>
            <p className="prize-description">
              The player whose predicted total points is closest to the actual total points for that week.
            </p>
            <div className="tiebreaker">
              <strong>Tiebreaker:</strong> Most correct winners for that week
            </div>
          </div>
        </div>

        <div className="rule-block">
          <h2>🏈 Super Bowl Week Prizes (Week 4)</h2>
          
          <div className="prize-card">
            <h3>Week 4 Prize #1: Most Correct Winners</h3>
            <p className="prize-description">
              Same as weekly Prize #1, but for Super Bowl week only.
            </p>
            <div className="tiebreaker">
              <strong>Tiebreaker:</strong> Closest to Week 4 actual total
            </div>
          </div>

          <div className="prize-card">
            <h3>Week 4 Prize #2: Closest to Actual Total</h3>
            <p className="prize-description">
              Same as weekly Prize #2, but for Super Bowl week only.
            </p>
            <div className="tiebreaker">
              <strong>Tiebreaker:</strong> Most correct winners for Week 4
            </div>
          </div>

          <div className="prize-card">
            <h3>Grand Prize #1: Most Correct Winners (All 4 Weeks)</h3>
            <p className="prize-description">
              The player with the most total correct winners across all 4 playoff weeks combined.
            </p>
            <div className="tiebreaker">
              <strong>Tiebreaker:</strong> Closest to grand total points (all 4 weeks)
            </div>
          </div>

          <div className="prize-card">
            <h3>Grand Prize #2: Closest to Grand Total</h3>
            <p className="prize-description">
              The player whose predicted grand total is closest to the actual grand total across all 4 weeks.
            </p>
            <div className="tiebreaker">
              <strong>Tiebreaker:</strong> Most correct winners (all 4 weeks)
            </div>
          </div>
        </div>

        <div className="rule-block important-note">
          <h2>⚠️ Important Notes</h2>
          <ul>
            <li><strong>Multiple Wins:</strong> The same player can win multiple prizes</li>
            <li><strong>Tie Splits:</strong> If players remain tied after tiebreakers, the prize is split equally</li>
            <li><strong>Total Points:</strong> Sum of all predicted scores (not point differential)</li>
          </ul>
        </div>
      </div>

      {/* Official calculated results */}
      {Object.keys(calculatedWinners).length > 0 && (
        <div className="calculated-results-section">
          <h2 className="section-title">📋 Official Calculated Results</h2>
          <p className="section-subtitle">These are the winners based on current tie-breaking rules</p>
          
          {Object.entries(calculatedWinners).map(([week, prizes]) => (
            <div key={week} className="week-results">
              <h3 className="week-title">
                {week === 'wildcard' && '🏈 Week 1: Wild Card Round'}
                {week === 'divisional' && '🏈 Week 2: Divisional Round'}
                {week === 'conference' && '🏈 Week 3: Conference Championships'}
                {week === 'superbowl' && '🏈 Week 4: Super Bowl LIX'}
              </h3>

              {Object.entries(prizes).map(([prizeKey, prizeData]) => {
                const isPublished = publishedWinners[prizeKey];
                const winners = Array.isArray(prizeData.winners) 
                  ? prizeData.winners 
                  : [prizeData.winner].filter(Boolean);

                return (
                  <div key={prizeKey} className={`prize-result ${isPublished ? 'published' : 'unpublished'}`}>
                    <div className="prize-header">
                      <h4>{prizeData.title || prizeKey}</h4>
                      {isPublished && <span className="published-badge">✓ PUBLISHED</span>}
                      {!isPublished && <span className="unpublished-badge">⏳ NOT PUBLISHED</span>}
                    </div>

                    <div className="prize-details">
                      {winners.length > 1 ? (
                        <div className="tied-winners">
                          <p className="tie-notice">🔗 {winners.length}-way tie</p>
                          <ul className="winner-list">
                            {winners.map(code => (
                              <li key={code}>{code}</li>
                            ))}
                          </ul>
                        </div>
                      ) : winners.length === 1 ? (
                        <div className="solo-winner">
                          <p className="winner-name">🏆 {winners[0]}</p>
                        </div>
                      ) : (
                        <p className="no-winner">No winner determined</p>
                      )}

                      {prizeData.value !== undefined && (
                        <p className="prize-value">💰 ${prizeData.value.toFixed(2)}</p>
                      )}

                      {prizeData.breakdown && (
                        <div className="breakdown-info">
                          <small>{prizeData.breakdown}</small>
                        </div>
                      )}
                    </div>

                    {isPoolManager && (
                      <div className="manager-controls">
                        {isPublished ? (
                          <button 
                            className="unpublish-btn"
                            onClick={() => onUnpublishPrize(prizeKey)}
                          >
                            ❌ Unpublish
                          </button>
                        ) : (
                          <button 
                            className="publish-btn"
                            onClick={() => onPublishPrize(prizeKey, prizeData)}
                          >
                            ✅ Publish Prize
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Timestamp Tie-Breaker Analysis (Pool Manager Only) */}
      {isPoolManager && timestampAnalysis.seasonSummary.weeksAnalyzed > 0 && (
        <div className="timestamp-analysis-section">
          <div className="testing-warning-banner">
            <h2>⚠️ EXPERIMENTAL FEATURE - FOR TESTING ONLY</h2>
            <p>This analysis shows what WOULD happen if submission timestamp was used as a final tie-breaker.</p>
            <p><strong>This is NOT used for actual prizes this season.</strong> Data is for planning next year only.</p>
          </div>

          <div className="timestamp-analysis-content">
            <div className="analysis-header">
              <h3>📊 HYPOTHETICAL: TIMESTAMP TIE-BREAKER ANALYSIS</h3>
              <p className="last-updated">Last updated: {new Date().toLocaleString()}</p>
            </div>

            {/* Week-by-Week Analysis */}
            {Object.entries(timestampAnalysis.weeks).map(([weekKey, weekData]) => (
              <div key={weekKey} className="week-timestamp-analysis">
                <h4 className="week-analysis-title">
                  🔬 {weekData.weekName.toUpperCase()} - TIMESTAMP IMPACT
                </h4>

                {weekData.prizes.filter(p => p.timestampWouldBreak).length === 0 ? (
                  <div className="no-ties-message">
                    ✓ No ties this week - timestamp not needed
                  </div>
                ) : (
                  weekData.prizes.map((prize, idx) => (
                    prize.timestampWouldBreak ? (
                      <div key={idx} className="prize-timestamp-comparison">
                        <h5>{prize.prizeTitle}</h5>
                        
                        <div className="official-result-box">
                          <div className="box-label">📅 Official Result (Current Rules):</div>
                          <div className="box-content">
                            {prize.officialResult} - Prize split equally
                            <div className="tied-players-list">
                              {prize.tiedPlayers.map(p => p.playerName).join(', ')}
                            </div>
                          </div>
                        </div>

                        <div className="hypothetical-result-box">
                          <div className="box-label">⏰ Hypothetical (If Timestamp Was Used):</div>
                          <div className="box-content">
                            <div className="timestamp-ranking">
                              {prize.tiedPlayers.map((player, idx) => (
                                <div key={idx} className={`timestamp-entry ${idx === 0 ? 'winner' : ''}`}>
                                  <span className="rank">{idx + 1}{idx === 0 ? 'st' : idx === 1 ? 'nd' : idx === 2 ? 'rd' : 'th'}:</span>
                                  <span className="player-name">{player.playerName}</span>
                                  <span className="timestamp">{formatTimestamp(player.timestamp)}</span>
                                  {idx === 0 && <span className="winner-badge">✓ WINNER</span>}
                                </div>
                              ))}
                            </div>
                            <div className="impact-note">
                              💡 Impact: {prize.tiedPlayers.length}-way split → Solo winner
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null
                  ))
                )}
              </div>
            ))}

            {/* Season Summary Statistics */}
            <div className="season-summary-section">
              <h3 className="summary-title">📈 SEASON SUMMARY (Cumulative Statistics)</h3>
              
              <div className="summary-box current-season">
                <h4>CURRENT SEASON (50 players):</h4>
                <div className="stats-grid">
                  <div className="stat-item">
                    <span className="stat-label">Weeks Analyzed:</span>
                    <span className="stat-value">{timestampAnalysis.seasonSummary.weeksAnalyzed} / 4</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Prizes Awarded:</span>
                    <span className="stat-value">{timestampAnalysis.seasonSummary.totalPrizes} / 10</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Ties After Rules:</span>
                    <span className="stat-value">
                      {timestampAnalysis.seasonSummary.prizesWithTies} 
                      ({timestampAnalysis.seasonSummary.totalPrizes > 0 
                        ? Math.round((timestampAnalysis.seasonSummary.prizesWithTies / timestampAnalysis.seasonSummary.totalPrizes) * 100) 
                        : 0}%)
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Timestamp Would Break:</span>
                    <span className="stat-value">
                      {timestampAnalysis.seasonSummary.tiesWouldBreak}
                      ({timestampAnalysis.seasonSummary.prizesWithTies > 0
                        ? Math.round((timestampAnalysis.seasonSummary.tiesWouldBreak / timestampAnalysis.seasonSummary.prizesWithTies) * 100)
                        : 0}% of ties)
                    </span>
                  </div>
                </div>
              </div>

              {/* Scale Projections */}
              {scaleProjections && (
                <div className="scale-projections-section">
                  <h3 className="projections-title">🔮 PROJECTION: SCALING TO LARGER POOLS</h3>
                  <p className="projections-subtitle">
                    Based on current tie rate ({Math.round(scaleProjections.tieRate * 100)}% after {timestampAnalysis.seasonSummary.weeksAnalyzed} week{timestampAnalysis.seasonSummary.weeksAnalyzed !== 1 ? 's' : ''} with {scaleProjections.currentPlayers} players):
                  </p>

                  <div className="projection-box projection-1000">
                    <h4>WITH 1,000 PLAYERS:</h4>
                    <div className="projection-stats">
                      <div className="projection-item">
                        <span className="projection-label">Expected Ties per Prize:</span>
                        <span className="projection-value">{scaleProjections.projections[1000].expectedTiesPerPrize}</span>
                      </div>
                      <div className="projection-item">
                        <span className="projection-label">Timestamp Impact:</span>
                        <span className="projection-value critical">Critical</span>
                      </div>
                      <div className="projection-item">
                        <span className="projection-label">Prize Split Improvement:</span>
                        <div className="prize-comparison">
                          <div>Without: {scaleProjections.projections[1000].prizeWithout}</div>
                          <div>With: {scaleProjections.projections[1000].prizeWith}</div>
                          <div className="improvement">{scaleProjections.projections[1000].improvement}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="projection-box projection-10000">
                    <h4>WITH 10,000 PLAYERS:</h4>
                    <div className="projection-stats">
                      <div className="projection-item">
                        <span className="projection-label">Expected Ties per Prize:</span>
                        <span className="projection-value">{scaleProjections.projections[10000].expectedTiesPerPrize}</span>
                      </div>
                      <div className="projection-item">
                        <span className="projection-label">Timestamp Impact:</span>
                        <span className="projection-value essential">ESSENTIAL</span>
                      </div>
                      <div className="projection-item">
                        <span className="projection-label">Prize Split Improvement:</span>
                        <div className="prize-comparison">
                          <div>Without: {scaleProjections.projections[10000].prizeWithout}</div>
                          <div>With: {scaleProjections.projections[10000].prizeWith}</div>
                          <div className="improvement">{scaleProjections.projections[10000].improvement}</div>
                        </div>
                      </div>
                      <div className="critical-note">
                        💡 Without timestamp: Prizes become nearly worthless<br />
                        With timestamp: Meaningful prize amounts
                      </div>
                    </div>
                  </div>

                  <div className="conclusion-box">
                    <strong>⚠️ CONCLUSION:</strong> Timestamp tie-breaker becomes <strong>CRITICAL</strong> for pools with 500+ players. <strong>Essential</strong> for 1,000+.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HowWinnersAreDetermined;
