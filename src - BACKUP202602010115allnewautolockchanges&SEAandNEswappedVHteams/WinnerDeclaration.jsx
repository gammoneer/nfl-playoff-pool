// ============================================
// WINNER DECLARATION COMPONENT - NEW REVIEW WORKFLOW
// Pool Manager Review → Override → Confirm → Publish
// ============================================

import React, { useState } from 'react';
import './WinnerDeclaration.css';
import WinnerReviewPanel from './WinnerReviewPanel';
import WinnerOverrideModal from './WinnerOverrideModal';
import PublishConfirmation from './PublishConfirmation';

const PRIZE_INFO = {
  1: { name: 'Most Correct Winners', week: 'wildcard', weekName: 'Week 1 - Wild Card', prizeNum: 1 },
  2: { name: 'Closest Total Points', week: 'wildcard', weekName: 'Week 1 - Wild Card', prizeNum: 2 },
  3: { name: 'Most Correct Winners', week: 'divisional', weekName: 'Week 2 - Divisional', prizeNum: 3 },
  4: { name: 'Closest Total Points', week: 'divisional', weekName: 'Week 2 - Divisional', prizeNum: 4 },
  5: { name: 'Most Correct Winners', week: 'conference', weekName: 'Week 3 - Conference', prizeNum: 5 },
  6: { name: 'Closest Total Points', week: 'conference', weekName: 'Week 3 - Conference', prizeNum: 6 },
  7: { name: 'Most Correct Winners', week: 'superbowl', weekName: 'Week 4 - Super Bowl', prizeNum: 7 },
  8: { name: 'Closest Total Points', week: 'superbowl', weekName: 'Week 4 - Super Bowl', prizeNum: 8 },
  9: { name: 'Overall Most Correct Winners', week: 'all', weekName: 'Grand Prize', prizeNum: 9 },
  10: { name: 'Overall Closest Total Points', week: 'all', weekName: 'Grand Prize', prizeNum: 10 }
};

const PRIZE_NAMES = {
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

/**
 * Calculate winners for a specific prize
 */
function calculatePrizeWinners(prizeNumber, allPicks, actualScores, weekData) {
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
    
    results.sort((a, b) => b.score - a.score);
    
    // Find ties at top score
    const topScore = results[0].score;
    const winners = results.filter(r => r.score === topScore);
    
    return winners;
    
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
    
    results.sort((a, b) => a.difference - b.difference);
    
    // Find ties at best (lowest) difference
    const bestDiff = results[0].difference;
    const winners = results.filter(r => r.difference === bestDiff);
    
    return winners;
  }
}

/**
 * Week Management Button
 */
function WeekManagementButton({ 
  weekKey, 
  weekName, 
  isPublished,
  gamesComplete,
  onReview,
  onUnpublish 
}) {
  const getStatus = () => {
    if (isPublished) return { text: '✅ Published', color: '#4caf50' };
    if (gamesComplete) return { text: '⚠️ Ready for Review', color: '#ff9800' };
    return { text: '🔒 Games In Progress', color: '#999' };
  };

  const status = getStatus();

  return (
    <div style={{
      padding: '20px',
      backgroundColor: '#f9f9f9',
      border: '2px solid #ddd',
      borderRadius: '8px',
      marginBottom: '15px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h3 style={{ margin: '0 0 5px 0', fontSize: '18px', fontWeight: 'bold', color: '#000' }}>
            {weekName}
          </h3>
          <p style={{ margin: 0, fontSize: '14px', color: '#000', fontWeight: 'bold' }}>
            Status: <span style={{ color: status.color }}>{status.text}</span>
          </p>
          {isPublished && (
            <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#666' }}>
              Published on {new Date().toLocaleDateString()}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {isPublished ? (
            <button
              onClick={onUnpublish}
              style={{
                padding: '12px 24px',
                backgroundColor: '#ff5722',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold',
                minHeight: '44px'
              }}
            >
              📝 UNPUBLISH TO EDIT
            </button>
          ) : gamesComplete ? (
            <button
              onClick={onReview}
              style={{
                padding: '12px 24px',
                backgroundColor: '#2196F3',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold',
                minHeight: '44px'
              }}
            >
              🔍 REVIEW & PUBLISH
            </button>
          ) : (
            <button
              disabled
              style={{
                padding: '12px 24px',
                backgroundColor: '#ccc',
                color: '#666',
                border: 'none',
                borderRadius: '6px',
                cursor: 'not-allowed',
                fontSize: '16px',
                fontWeight: 'bold',
                minHeight: '44px'
              }}
            >
              🔒 Waiting for Games
            </button>
          )}
        </div>
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
  onPublishWinners,
  onUnpublishWinners,
  isPoolManager,
  totalPrizePool,
  weekCompletionStatus
}) {
  const [showReview, setShowReview] = useState(false);
  const [currentWeek, setCurrentWeek] = useState(null);
  const [showOverride, setShowOverride] = useState(false);
  const [overridePrize, setOverridePrize] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [reviewPrizes, setReviewPrizes] = useState([]);

  if (!isPoolManager) {
    return null;
  }

  const prizeAmount = totalPrizePool * 0.1; // 10% per prize

  const handleReviewWeek = (weekKey) => {
    setCurrentWeek(weekKey);
    
    // Calculate prizes for this week
    const weekPrizeNumbers = {
      'wildcard': [1, 2],
      'divisional': [3, 4],
      'conference': [5, 6],
      'superbowl': [7, 8],
      'grand': [9, 10]
    }[weekKey];

    const calculatedPrizes = weekPrizeNumbers.map(prizeNum => {
      const winners = calculatePrizeWinners(prizeNum, allPicks, actualScores, games);
      
      return {
        prizeNumber: prizeNum,
        winners: winners.map(w => ({
          playerCode: w.playerCode,
          playerName: w.playerName,
          score: w.score,
          amount: prizeAmount / winners.length,
          percentage: 100 / winners.length
        })),
        isOverride: false,
        overrideNote: ''
      };
    });

    setReviewPrizes(calculatedPrizes);
    setShowReview(true);
  };

  const handleOverride = (prizeNumber, currentPrize) => {
    setOverridePrize({
      prizeNumber,
      prizeName: PRIZE_NAMES[prizeNumber],
      currentWinners: currentPrize.winners,
      prizeAmount
    });
    setShowOverride(true);
  };

  const handleSaveOverride = (overrideData) => {
    // Update the review prizes with override
    setReviewPrizes(prevPrizes => 
      prevPrizes.map(p => 
        p.prizeNumber === overrideData.prizeNumber 
          ? { ...p, winners: overrideData.winners, overrideNote: overrideData.overrideNote, isOverride: true }
          : p
      )
    );
    setShowOverride(false);
    setOverridePrize(null);
  };

  const handlePublish = () => {
    setShowConfirm(true);
  };

  const handleConfirmPublish = () => {
    // Call the parent's publish function
    onPublishWinners(currentWeek, reviewPrizes);
    
    // Close all modals
    setShowConfirm(false);
    setShowReview(false);
    setCurrentWeek(null);
    setReviewPrizes([]);
  };

  const handleUnpublish = (weekKey) => {
    if (window.confirm(`Are you sure you want to unpublish ${weekKey} winners? They will no longer be visible to players.`)) {
      onUnpublishWinners(weekKey);
    }
  };

  const handleCancel = () => {
    setShowReview(false);
    setCurrentWeek(null);
    setReviewPrizes([]);
  };

  const weekInfo = {
    wildcard: { name: 'Week 1 - Wild Card', key: 'wildcard' },
    divisional: { name: 'Week 2 - Divisional', key: 'divisional' },
    conference: { name: 'Week 3 - Conference Championships', key: 'conference' },
    superbowl: { name: 'Week 4 - Super Bowl', key: 'superbowl' },
    grand: { name: 'Grand Prizes (Full Season)', key: 'grand' }
  };

  return (
    <div className="winner-declaration-section">
      <div style={{ marginBottom: '30px' }}>
        <h2 style={{ margin: '0 0 10px 0', fontSize: '28px', fontWeight: 'bold', color: '#000' }}>
          🏆 Winner Management - Pool Manager
        </h2>
        <p style={{ margin: 0, fontSize: '16px', color: '#000', lineHeight: '1.6' }}>
          Review calculated winners, make overrides if needed, then publish results for players to see.
        </p>
        <div style={{
          marginTop: '15px',
          padding: '15px',
          backgroundColor: '#e3f2fd',
          border: '2px solid #2196F3',
          borderRadius: '8px'
        }}>
          <p style={{ margin: 0, fontSize: '14px', color: '#000', fontWeight: 'bold' }}>
            💰 Total Prize Pool: ${totalPrizePool.toFixed(2)} | Each Prize: ${prizeAmount.toFixed(2)} (10%)
          </p>
        </div>
      </div>

      {Object.values(weekInfo).map(week => {
        const isPublished = officialWinners?.[week.key]?.published || false;
        const gamesComplete = weekCompletionStatus?.[week.key] || false;

        return (
          <WeekManagementButton
            key={week.key}
            weekKey={week.key}
            weekName={week.name}
            isPublished={isPublished}
            gamesComplete={gamesComplete}
            onReview={() => handleReviewWeek(week.key)}
            onUnpublish={() => handleUnpublish(week.key)}
          />
        );
      })}

      {/* Review Panel */}
      {showReview && (
        <WinnerReviewPanel
          week={currentWeek}
          weekName={weekInfo[currentWeek]?.name}
          prizes={reviewPrizes}
          allPlayers={allPicks}
          totalPool={totalPrizePool}
          prizeAmount={prizeAmount}
          onPublish={handlePublish}
          onCancel={handleCancel}
          onOverride={handleOverride}
        />
      )}

      {/* Override Modal */}
      {showOverride && overridePrize && (
        <WinnerOverrideModal
          prizeNumber={overridePrize.prizeNumber}
          prizeName={overridePrize.prizeName}
          prizeAmount={overridePrize.prizeAmount}
          currentWinners={overridePrize.currentWinners}
          allPlayers={allPicks.map(p => ({ playerCode: p.playerCode, playerName: p.playerName }))}
          onSave={handleSaveOverride}
          onCancel={() => {
            setShowOverride(false);
            setOverridePrize(null);
          }}
        />
      )}

      {/* Publish Confirmation */}
      {showConfirm && (
        <PublishConfirmation
          weekName={weekInfo[currentWeek]?.name}
          prizes={reviewPrizes}
          onConfirm={handleConfirmPublish}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
}

export default WinnerDeclaration;
