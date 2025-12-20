import React, { useState, useMemo } from 'react';
import './HowWinnersAreDetermined.css';

// ============================================================================
// HOW WINNERS ARE DETERMINED - COMPONENT
// ============================================================================

const HowWinnersAreDetermined = ({ 
  calculatedWinners, 
  publishedWinners, 
  isPoolManager,
  onPublishPrize,
  onUnpublishPrize,
  allPicks = [],
  actualScores = {}
}) => {
  
  // Track which prize details are expanded
  const [expandedPrizes, setExpandedPrizes] = useState({});
  
  // ============================================================================
  // TIMESTAMP TIE-BREAKER ANALYSIS (TESTING ONLY)
  // ============================================================================
  
  // Playoff week configuration for timestamp analysis
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
        tiesWouldBreak: 0
      }
    };

    // Map week names to keys
    const weekMapping = {
      'Week 1': 'wildcard',
      'Week 2': 'divisional',
      'Week 3': 'conference',
      'Week 4': 'superbowl'
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

      // Find prizes for this week in our prize definitions
      const weekPrizes = prizes.filter(p => {
        const weekNum = weekInfo.weekNum;
        return p.week === `Week ${weekNum}`;
      });

      weekPrizes.forEach(prize => {
        analysis.seasonSummary.totalPrizes++;
        
        const result = getCalculatedResult(prize.calcKey);
        if (!result) return;
        
        const winners = Array.isArray(result.winner) ? result.winner : [result.winner].filter(Boolean);
        
        if (winners.length > 1) {
          // There's a tie - analyze timestamp impact
          analysis.seasonSummary.prizesWithTies++;
          
          // Get picks for all tied winners with timestamps
          const tiedPicks = winners.map(winnerCode => {
            const pick = weekPicks.find(p => p.playerCode === winnerCode);
            return {
              playerCode: winnerCode,
              playerName: pick?.playerName || winnerCode,
              timestamp: getPickTimestamp(pick),
              pick: pick
            };
          }).filter(p => p.pick);
          
          // Sort by timestamp (earliest first)
          tiedPicks.sort((a, b) => a.timestamp - b.timestamp);
          
          const prizeAnalysis = {
            prizeTitle: prize.title,
            officialResult: `${winners.length}-way tie`,
            tiedPlayers: tiedPicks,
            hypotheticalWinner: tiedPicks[0],
            timestampWouldBreak: tiedPicks.length > 1
          };
          
          if (prizeAnalysis.timestampWouldBreak) {
            analysis.seasonSummary.tiesWouldBreak++;
          }
          
          weekAnalysis.prizes.push(prizeAnalysis);
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

    return {
      currentPlayers: 50,
      tieRate,
      projections: {
        1000: {
          expectedTiesPerPrize: '15-30 way ties',
          prizeWithout: '$100 ÷ 20 = $5.00 each',
          prizeWith: '$100 ÷ 1 = $100.00',
          improvement: '+$95.00 (1900% increase)'
        },
        10000: {
          expectedTiesPerPrize: '50-200 way ties',
          prizeWithout: '$100 ÷ 100 = $1.00 each',
          prizeWith: '$100 ÷ 1 = $100.00',
          improvement: '+$99.00 (9900% increase)'
        }
      }
    };
  }, [timestampAnalysis]);
  
  // ============================================================================
  // END TIMESTAMP ANALYSIS
  // ============================================================================
  
  // Toggle expand/collapse for a prize
  const toggleExpanded = (prizeId) => {
    setExpandedPrizes(prev => ({
      ...prev,
      [prizeId]: !prev[prizeId]
    }));
  };
  
  // Prize definitions
  const prizes = [
    // Week 1
    { id: 'week1_prize1', week: 'Week 1', round: 'Wild Card Round (6 games)', title: 'Most Correct Winners', amount: '$50', calcKey: 'week1.prize1', pubKey: 'week1_prize1' },
    { id: 'week1_prize2', week: 'Week 1', round: 'Wild Card Round (6 games)', title: 'Closest Total Points', amount: '$50', calcKey: 'week1.prize2', pubKey: 'week1_prize2' },
    
    // Week 2
    { id: 'week2_prize1', week: 'Week 2', round: 'Divisional Round (4 games)', title: 'Most Correct Winners', amount: '$50', calcKey: 'week2.prize1', pubKey: 'week2_prize1' },
    { id: 'week2_prize2', week: 'Week 2', round: 'Divisional Round (4 games)', title: 'Closest Total Points', amount: '$50', calcKey: 'week2.prize2', pubKey: 'week2_prize2' },
    
    // Week 3
    { id: 'week3_prize1', week: 'Week 3', round: 'Conference Championships (2 games)', title: 'Most Correct Winners', amount: '$50', calcKey: 'week3.prize1', pubKey: 'week3_prize1' },
    { id: 'week3_prize2', week: 'Week 3', round: 'Conference Championships (2 games)', title: 'Closest Total Points', amount: '$50', calcKey: 'week3.prize2', pubKey: 'week3_prize2' },
    
    // Week 4
    { id: 'week4_prize1', week: 'Week 4', round: 'Super Bowl (1 game)', title: 'Correct Winner', amount: '$50', calcKey: 'week4.prize1', pubKey: 'week4_prize1' },
    { id: 'week4_prize2', week: 'Week 4', round: 'Super Bowl (1 game)', title: 'Closest Total Points', amount: '$50', calcKey: 'week4.prize2', pubKey: 'week4_prize2' },
    
    // Grand Prizes
    { id: 'grand_prize1', week: 'Grand Prize', round: 'Overall - All 4 Weeks', title: 'Most Correct Winners', amount: '$120', calcKey: 'grandPrize.prize1', pubKey: 'grandPrize_prize1' },
    { id: 'grand_prize2', week: 'Grand Prize', round: 'Overall - All 4 Weeks', title: 'Closest Total Points', amount: '$80', calcKey: 'grandPrize.prize2', pubKey: 'grandPrize_prize2' },
  ];
  
  // Get calculated result for a prize
  const getCalculatedResult = (calcKey) => {
    const keys = calcKey.split('.');
    let result = calculatedWinners;
    for (const key of keys) {
      if (!result) return null;
      result = result[key];
    }
    return result;
  };
  
  // Check if a prize is published
  const isPrizePublished = (pubKey) => {
    return publishedWinners && publishedWinners[pubKey] === true;
  };
  
  // Render a single prize
  const renderPrize = (prize) => {
    const isPublished = isPrizePublished(prize.pubKey);
    const calculatedResult = getCalculatedResult(prize.calcKey);
    const isExpanded = expandedPrizes[prize.id];
    
    // Determine state
    let state = 'not_scored';
    if (calculatedResult) {
      state = calculatedResult.status || 'calculated';
    }
    
    return (
      <div key={prize.id} className="prize-container">
        {renderPrizeIcon(prize.title)} <strong>{prize.title}</strong> - {prize.amount}
        
        {/* NOT SCORED STATE */}
        {state === 'not_scored' && (
          <div className="prize-status">
            <span className="status-icon">⏸️</span> Waiting for game results
          </div>
        )}
        
        {/* UNPUBLISHED STATE (Pool Manager only) */}
        {state === 'calculated' && !isPublished && (
          <>
            {isPoolManager ? (
              <div className="prize-status unpublished">
                <span className="status-icon">⏳</span> Not yet published
                <button 
                  className="review-publish-btn"
                  onClick={() => handleReviewPublish(prize, calculatedResult)}
                >
                  🔍 Review &amp; Publish
                </button>
              </div>
            ) : (
              <div className="prize-status">
                <span className="status-icon">⏳</span> Not yet published
                <div className="status-message">(Pool Manager is reviewing calculations)</div>
              </div>
            )}
          </>
        )}
        
        {/* PUBLISHED STATE */}
        {state === 'calculated' && isPublished && calculatedResult && (
          <>
            {renderModerateView(prize, calculatedResult)}
            
            <button 
              className="expand-btn"
              onClick={() => toggleExpanded(prize.id)}
            >
              {isExpanded ? '▲ Hide Full Breakdown' : '▼ Show Full Breakdown'}
            </button>
            
            {isExpanded && renderExpandedView(prize, calculatedResult)}
            
            {/* Pool Manager unpublish button */}
            {isPoolManager && (
              <button 
                className="unpublish-btn"
                onClick={() => onUnpublishPrize(prize.pubKey)}
              >
                🔄 Unpublish {prize.title}
              </button>
            )}
          </>
        )}
      </div>
    );
  };
  
  // Render prize icon
  const renderPrizeIcon = (title) => {
    if (title.includes('Correct Winner')) return '🏆';
    if (title.includes('Closest Total')) return '💰';
    return '🏆';
  };
  
  // Render moderate view (always visible when published)
  const renderModerateView = (prize, result) => {
    const winner = Array.isArray(result.winner) ? result.winner.join(', ') : result.winner;
    const isTrueTie = result.isTrueTie;
    
    return (
      <div className="moderate-view">
        <div className="winner-name">
          {isTrueTie ? '🏆 Winners (Tie): ' : '🏆 Winner: '}
          <strong>{winner}</strong>
        </div>
        
        {/* Prize-specific details */}
        {prize.title.includes('Correct Winner') && (
          <ul className="prize-details">
            <li>{result.correctWinners} correct winner{result.correctWinners !== 1 ? 's' : ''}</li>
            {result.tiebreakerUsed && result.tiedPlayers && (
              <>
                <li>{result.tiedPlayers.length} players tied with {result.correctWinners} correct</li>
                <li>Tiebreaker: {result.tiebreakerLevel}</li>
                {result.tiedPlayersDetails && renderTiedPlayersShort(result.tiedPlayersDetails)}
              </>
            )}
            {!result.tiebreakerUsed && <li>No tiebreaker needed</li>}
          </ul>
        )}
        
        {prize.title.includes('Closest Total') && (
          <ul className="prize-details">
            <li>Off by {result.difference} point{result.difference !== 1 ? 's' : ''}</li>
            <li>Predicted: {result.predictedTotal || result.overallPredictedTotal}, Actual: {result.actualTotal || result.overallActualTotal}</li>
            {result.tiebreakerUsed ? <li>Tiebreaker used</li> : <li>No tiebreaker needed</li>}
          </ul>
        )}
      </div>
    );
  };
  
  // Render short tied players info
  const renderTiedPlayersShort = (details) => {
    return (
      <li className="tied-players-short">
        {details.map((p, i) => (
          <span key={i}>
            {p.name}: {p.predictedTotal} (off by {p.difference})
            {i < details.length - 1 ? ', ' : ''}
          </span>
        ))}
      </li>
    );
  };
  
// Render expanded view (full breakdown)
  const renderExpandedView = (prize, result) => {
    // Handle different result formats
    const hasSteps = result.steps && result.steps.length > 0;
    const hasTiebreaker = result.tiebreakerUsed && result.tiedPlayersDetails && result.tiedPlayersDetails.length > 0;
    
    if (!hasSteps && !hasTiebreaker) {
      return (
        <div className="expanded-view">
          <div className="breakdown-header">═══ FULL BREAKDOWN ═══</div>
          <p>Winner determined without tiebreakers.</p>
        </div>
      );
    }
    
    // If we have steps (Week 4 and Grand Prizes), use existing logic
    if (hasSteps) {
      return (
        <div className="expanded-view">
          <div className="breakdown-header">═══ FULL TIEBREAKER BREAKDOWN ═══</div>
          
          {result.steps.map((step, index) => (
            <div key={index} className="breakdown-step">
              <div className="step-header">
                {step.layer !== undefined && <span className="layer-badge">Layer {step.layer}</span>}
                STEP {index + 1}: {step.level}
              </div>
              
              {step.actualTotal !== undefined && (
                <div className="step-detail">Actual total: {step.actualTotal} points</div>
              )}
              
              {step.remaining !== undefined && (
                <div className="step-detail">
                  {step.remaining} player{step.remaining !== 1 ? 's' : ''} remain{step.remaining === 1 ? 's' : ''}
                </div>
              )}
              
              {step.tied && step.tied.length > 1 && (
                <div className="step-detail tied-players">
                  ✅ Tied: {step.tied.join(', ')}
                </div>
              )}
              
              {step.winner && (
                <div className="step-detail winner">
                  🏆 Winner: <strong>{step.winner}</strong>
                </div>
              )}
              
              {step.eliminated > 0 && (
                <div className="step-detail eliminated">
                  ❌ {step.eliminated} player{step.eliminated !== 1 ? 's' : ''} eliminated
                </div>
              )}
              
              {step.details && step.details.length > 0 && (
                <div className="player-details">
                  {step.details.map((player, pIndex) => (
                    <div key={pIndex} className="player-row">
                      <span className="player-name">{player.name}:</span>
                      <span className="player-prediction">{player.predictedTotal} predicted</span>
                      <span className="player-diff">(off by {player.difference})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      );
    }
    
    // Week 1-3 Prize #1 format (tiedPlayersDetails)
    if (hasTiebreaker) {
      return (
        <div className="expanded-view">
          <div className="breakdown-header">═══ FULL TIEBREAKER BREAKDOWN ═══</div>
          
          <div className="breakdown-step">
            <div className="step-header">
              INITIAL TIE: {result.correctWinners} correct winner{result.correctWinners !== 1 ? 's' : ''}
            </div>
            <div className="step-detail tied-players">
              ✅ Tied: {result.tiedPlayers.join(', ')}
            </div>
          </div>
          
          <div className="breakdown-step">
            <div className="step-header">
              TIEBREAKER: {result.tiebreakerLevel}
            </div>
            <div className="step-detail">Actual total: {result.actualTotal} points</div>
            
            <div className="player-details">
              {result.tiedPlayersDetails.map((player, pIndex) => (
                <div key={pIndex} className="player-row">
                  <span className="player-name">{player.name}:</span>
                  <span className="player-prediction">{player.predictedTotal} predicted</span>
                  <span className="player-diff">(off by {player.difference})</span>
                  {player.name === result.winner && <span className="winner-badge">🏆 WINNER</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }
  };
  
  // Handle review and publish (opens modal/preview)
  const handleReviewPublish = (prize, result) => {
    // For now, just publish directly
    // In production, you'd show a preview modal first
    if (onPublishPrize) {
      onPublishPrize(prize.pubKey, prize, result);
    }
  };
  
  // Group prizes by week
  const weekGroups = [
    { title: 'Week 1 - Wild Card Round (6 games)', prizes: prizes.filter(p => p.week === 'Week 1') },
    { title: 'Week 2 - Divisional Round (4 games)', prizes: prizes.filter(p => p.week === 'Week 2') },
    { title: 'Week 3 - Conference Championships (2 games)', prizes: prizes.filter(p => p.week === 'Week 3') },
    { title: 'Week 4 - Super Bowl (1 game)', prizes: prizes.filter(p => p.week === 'Week 4') },
    { title: 'Grand Prizes', prizes: prizes.filter(p => p.week === 'Grand Prize') }
  ];
  
  return (
    <div className="how-winners-container">
      <h2>⚖️ How Winners Are Determined</h2>
      
      <p className="intro-text">
        Winners are published after the Pool Manager reviews calculations. 
        Check back after each week's games complete.
      </p>
      
      <div className="divider"></div>
      
      {weekGroups.map((group, index) => (
        <div key={index}>
          <h3 className="week-header">{group.title}</h3>
          {group.prizes.map(prize => renderPrize(prize))}
          {index < weekGroups.length - 1 && <div className="divider"></div>}
        </div>
      ))}
      
      {/* TIMESTAMP TIE-BREAKER ANALYSIS (Pool Manager Only) */}
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
