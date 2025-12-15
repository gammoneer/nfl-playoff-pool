import React, { useState } from 'react';
import './HowWinnersAreDetermined.css';

// ============================================================================
// HOW WINNERS ARE DETERMINED - COMPONENT
// ============================================================================

const HowWinnersAreDetermined = ({ 
  calculatedWinners, 
  publishedWinners, 
  isPoolManager,
  onPublishPrize,
  onUnpublishPrize 
}) => {
  
  // Track which prize details are expanded
  const [expandedPrizes, setExpandedPrizes] = useState({});
  
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
    </div>
  );
};

export default HowWinnersAreDetermined;
