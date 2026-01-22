import React, { useState, useEffect } from 'react';

/**
 * WinnerOverrideModal - Pool Manager can manually select winners and set splits
 * Supports unlimited number of winners with equal splits
 */
const WinnerOverrideModal = ({ 
  prizeNumber,
  prizeName,
  prizeAmount,
  currentWinners,
  allPlayers,
  onSave,
  onCancel
}) => {
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [overrideNote, setOverrideNote] = useState('');
  const [showAllPlayers, setShowAllPlayers] = useState(false);

  useEffect(() => {
    // Pre-select current winners
    if (currentWinners && currentWinners.length > 0) {
      setSelectedPlayers(currentWinners.map(w => w.playerCode));
    }
  }, [currentWinners]);

  const handleTogglePlayer = (playerCode) => {
    if (selectedPlayers.includes(playerCode)) {
      setSelectedPlayers(selectedPlayers.filter(p => p !== playerCode));
    } else {
      setSelectedPlayers([...selectedPlayers, playerCode]);
    }
  };

  const handleSave = () => {
    if (selectedPlayers.length === 0) {
      alert('Please select at least one winner');
      return;
    }

    // Calculate equal splits with rounding adjustment
    const splitAmount = prizeAmount / selectedPlayers.length;
    const winners = selectedPlayers.map((playerCode, idx) => {
      const player = allPlayers.find(p => p.playerCode === playerCode);
      const isLast = idx === selectedPlayers.length - 1;
      // Adjust last winner for rounding to ensure total equals prizeAmount exactly
      const amount = isLast 
        ? (prizeAmount - (splitAmount * (selectedPlayers.length - 1)))
        : splitAmount;
      
      return {
        playerCode,
        playerName: player?.playerName || 'Unknown',
        amount: parseFloat(amount.toFixed(2)),
        percentage: parseFloat((100 / selectedPlayers.length).toFixed(2))
      };
    });

    onSave({
      prizeNumber,
      winners,
      overrideNote: overrideNote.trim(),
      isOverride: true
    });
  };

  const calculateSplits = () => {
    if (selectedPlayers.length === 0) return [];
    
    const splitAmount = prizeAmount / selectedPlayers.length;
    return selectedPlayers.map((playerCode, idx) => {
      const player = allPlayers.find(p => p.playerCode === playerCode);
      const isLast = idx === selectedPlayers.length - 1;
      const amount = isLast 
        ? (prizeAmount - (splitAmount * (selectedPlayers.length - 1)))
        : splitAmount;
      
      return {
        playerName: player?.playerName || 'Unknown',
        amount: amount.toFixed(2),
        percentage: (100 / selectedPlayers.length).toFixed(2)
      };
    });
  };

  const splits = calculateSplits();
  const displayPlayers = showAllPlayers ? allPlayers : allPlayers.slice(0, 10);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      zIndex: 11000,
      overflowY: 'auto',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '700px',
        margin: '0 auto',
        backgroundColor: '#fff',
        borderRadius: '12px',
        padding: '0'
      }}>
        
        {/* Header */}
        <div style={{
          padding: '20px 30px',
          backgroundColor: '#ff9800',
          color: '#000',
          borderTopLeftRadius: '12px',
          borderTopRightRadius: '12px'
        }}>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 'bold', color: '#000' }}>
            🔧 Override Winners
          </h2>
          <p style={{ margin: '8px 0 0 0', fontSize: '16px', color: '#000', fontWeight: 'bold' }}>
            {prizeName}
          </p>
          <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: '#000' }}>
            Prize Amount: ${prizeAmount.toFixed(2)}
          </p>
        </div>

        {/* Content */}
        <div style={{ padding: '30px' }}>
          
          {/* Instructions */}
          <div style={{
            padding: '15px',
            backgroundColor: '#fff3cd',
            borderRadius: '6px',
            marginBottom: '20px',
            border: '2px solid #ffc107'
          }}>
            <p style={{ margin: 0, fontSize: '14px', color: '#000', fontWeight: 'bold' }}>
              ℹ️ Select winner(s) below. Prize will be split equally among all selected players.
            </p>
          </div>

          {/* Player Selection */}
          <div>
            <p style={{ margin: '0 0 15px 0', fontSize: '16px', fontWeight: 'bold', color: '#000' }}>
              Select Winner(s):
            </p>
            
            <div style={{
              maxHeight: '300px',
              overflowY: 'auto',
              border: '2px solid #ddd',
              borderRadius: '6px',
              padding: '10px'
            }}>
              {displayPlayers.map(player => {
                const isSelected = selectedPlayers.includes(player.playerCode);
                
                return (
                  <div
                    key={player.playerCode}
                    onClick={() => handleTogglePlayer(player.playerCode)}
                    style={{
                      padding: '12px 15px',
                      marginBottom: '8px',
                      backgroundColor: isSelected ? '#e3f2fd' : '#f9f9f9',
                      border: isSelected ? '3px solid #2196F3' : '2px solid #ddd',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      minHeight: '44px'
                    }}
                  >
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '4px',
                      border: '2px solid ' + (isSelected ? '#2196F3' : '#999'),
                      backgroundColor: isSelected ? '#2196F3' : '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      {isSelected && <span style={{ color: '#fff', fontSize: '18px', fontWeight: 'bold' }}>✓</span>}
                    </div>
                    <span style={{ fontSize: '16px', fontWeight: isSelected ? 'bold' : 'normal', color: '#000' }}>
                      {player.playerName}
                    </span>
                  </div>
                );
              })}
            </div>

            {!showAllPlayers && allPlayers.length > 10 && (
              <button
                onClick={() => setShowAllPlayers(true)}
                style={{
                  marginTop: '10px',
                  padding: '10px 20px',
                  backgroundColor: '#e3f2fd',
                  color: '#000',
                  border: '2px solid #2196F3',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  width: '100%',
                  minHeight: '44px'
                }}
              >
                Show All {allPlayers.length} Players ▼
              </button>
            )}
          </div>

          {/* Split Preview */}
          {selectedPlayers.length > 0 && (
            <div style={{
              marginTop: '20px',
              padding: '15px',
              backgroundColor: '#e8f5e9',
              borderRadius: '6px',
              border: '2px solid #4caf50'
            }}>
              <p style={{ margin: '0 0 10px 0', fontSize: '16px', fontWeight: 'bold', color: '#000' }}>
                Selected: {selectedPlayers.length} winner{selectedPlayers.length > 1 ? 's' : ''}
              </p>
              <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#000', fontWeight: 'bold' }}>
                Prize Split:
              </p>
              {splits.map((split, idx) => (
                <p key={idx} style={{ margin: '5px 0', fontSize: '14px', color: '#000' }}>
                  • {split.playerName}: ${split.amount} ({split.percentage}%)
                </p>
              ))}
              <p style={{ margin: '10px 0 0 0', fontSize: '14px', fontWeight: 'bold', color: '#2e7d32' }}>
                Total: ${prizeAmount.toFixed(2)} ✓
              </p>
            </div>
          )}

          {/* Optional Note */}
          <div style={{ marginTop: '20px' }}>
            <p style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 'bold', color: '#000' }}>
              Optional Note (visible to players):
            </p>
            <textarea
              value={overrideNote}
              onChange={(e) => setOverrideNote(e.target.value)}
              placeholder="E.g., 'Prize split due to tie in points' or 'Corrected calculation error'"
              style={{
                width: '100%',
                minHeight: '80px',
                padding: '12px',
                fontSize: '14px',
                color: '#000',
                border: '2px solid #ddd',
                borderRadius: '6px',
                fontFamily: 'inherit',
                resize: 'vertical',
                boxSizing: 'border-box'
              }}
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{
          padding: '20px 30px',
          backgroundColor: '#f5f5f5',
          borderTop: '2px solid #ddd',
          display: 'flex',
          gap: '15px',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={onCancel}
            style={{
              padding: '14px 30px',
              backgroundColor: '#fff',
              color: '#000',
              border: '2px solid #ddd',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
              minHeight: '44px',
              flex: '1',
              minWidth: '120px'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={selectedPlayers.length === 0}
            style={{
              padding: '14px 30px',
              backgroundColor: selectedPlayers.length === 0 ? '#ccc' : '#ff9800',
              color: selectedPlayers.length === 0 ? '#666' : '#000',
              border: 'none',
              borderRadius: '6px',
              cursor: selectedPlayers.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
              minHeight: '44px',
              flex: '2',
              minWidth: '180px'
            }}
          >
            💾 Save Override
          </button>
        </div>

      </div>
    </div>
  );
};

export default WinnerOverrideModal;
