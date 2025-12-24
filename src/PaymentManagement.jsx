import React, { useState, useMemo } from 'react';
import './PaymentManagement.css';

/**
 * Payment Management Component
 * Pool Manager only - track player payments, hide/show players, batch entry
 */
const PaymentManagement = ({ 
  players = [],
  onUpdatePayment,
  onTogglePlayerVisibility,
  onRemovePlayer
}) => {
  
  const [batchText, setBatchText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all, paid, unpaid, pending
  const [sortBy, setSortBy] = useState('name'); // name, status, time

  // Parse batch entry text
  const parseBatchEntry = (text) => {
    const lines = text.trim().split('\n').filter(line => line.trim());
    const entries = [];
    
    lines.forEach((line, index) => {
      // Format: Name - YYYYMMDDHHMM - method
      const parts = line.split('-').map(p => p.trim());
      
      if (parts.length !== 3) {
        console.warn(`Line ${index + 1} invalid format: ${line}`);
        return;
      }
      
      const [name, timestamp, method] = parts;
      
      // Validate timestamp format (YYYYMMDDHHMM - 12 digits)
      if (!/^\d{12}$/.test(timestamp)) {
        console.warn(`Line ${index + 1} invalid timestamp: ${timestamp}`);
        return;
      }
      
      entries.push({ name, timestamp, method });
    });
    
    return entries;
  };

  // Handle batch save
  const handleBatchSave = () => {
    const entries = parseBatchEntry(batchText);
    
    if (entries.length === 0) {
      alert('❌ No valid entries found. Check format:\nName - YYYYMMDDHHMM - method');
      return;
    }
    
    let successCount = 0;
    let failCount = 0;
    
    entries.forEach(entry => {
      const player = players.find(p => 
        p.playerName.toLowerCase().includes(entry.name.toLowerCase())
      );
      
      if (player) {
        onUpdatePayment(player.playerCode, {
          status: 'PAID',
          timestamp: entry.timestamp,
          method: entry.method.toUpperCase(),
          amount: 20
        });
        successCount++;
      } else {
        console.warn(`Player not found: ${entry.name}`);
        failCount++;
      }
    });
    
    if (successCount > 0) {
      alert(`✅ ${successCount} payment(s) saved successfully!${failCount > 0 ? `\n⚠️ ${failCount} player(s) not found.` : ''}`);
      setBatchText('');
    } else {
      alert('❌ No players found. Check player names.');
    }
  };

  // Filter and sort players
  const filteredPlayers = useMemo(() => {
    let filtered = [...players];
    
    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(p => 
        p.playerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.playerCode.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(p => {
        const status = p.paymentStatus || 'UNPAID';
        return status.toLowerCase() === filterStatus.toLowerCase();
      });
    }
    
    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'name') {
        return a.playerName.localeCompare(b.playerName);
      } else if (sortBy === 'status') {
        const statusA = a.paymentStatus || 'UNPAID';
        const statusB = b.paymentStatus || 'UNPAID';
        return statusA.localeCompare(statusB);
      } else if (sortBy === 'time') {
        const timeA = a.paymentTimestamp || '0';
        const timeB = b.paymentTimestamp || '0';
        return timeB.localeCompare(timeA); // Newest first
      }
      return 0;
    });
    
    return filtered;
  }, [players, searchTerm, filterStatus, sortBy]);

  // Calculate summary stats
  const stats = useMemo(() => {
    const paid = players.filter(p => p.paymentStatus === 'PAID').length;
    const unpaid = players.filter(p => !p.paymentStatus || p.paymentStatus === 'UNPAID').length;
    const pending = players.filter(p => p.paymentStatus === 'PENDING').length;
    const totalCollected = players.filter(p => p.paymentStatus === 'PAID')
      .reduce((sum, p) => sum + (p.paymentAmount || 20), 0);
    
    return { paid, unpaid, pending, totalCollected, total: players.length };
  }, [players]);

  // Quick mark as paid
  const handleQuickPaid = (playerCode, playerName) => {
    const timestamp = prompt(
      `Mark ${playerName} as PAID\n\nEnter payment timestamp (YYYYMMDDHHMM):\nExample: 202412202130`,
      ''
    );
    
    if (!timestamp) return;
    
    if (!/^\d{12}$/.test(timestamp)) {
      alert('❌ Invalid timestamp format. Must be 12 digits (YYYYMMDDHHMM)');
      return;
    }
    
    const method = prompt('Payment method:', 'E-TRANSFER');
    
    if (method) {
      onUpdatePayment(playerCode, {
        status: 'PAID',
        timestamp: timestamp,
        method: method.toUpperCase(),
        amount: 20
      });
    }
  };

  // Mark as unpaid
  const handleMarkUnpaid = (playerCode) => {
    if (confirm('Mark this player as UNPAID?')) {
      onUpdatePayment(playerCode, {
        status: 'UNPAID',
        timestamp: null,
        method: null,
        amount: null
      });
    }
  };

  // Toggle visibility
  const handleToggleVisibility = (playerCode, currentVisibility) => {
    const action = currentVisibility === false ? 'SHOW' : 'HIDE';
    if (confirm(`${action} this player from regular player view?`)) {
      onTogglePlayerVisibility(playerCode);
    }
  };

  // Remove permanently
  const handleRemovePermanently = (playerCode, playerName) => {
    const confirmed = confirm(
      `⚠️ PERMANENTLY REMOVE ${playerName}?\n\n` +
      `This will delete the player from ALL views (Pool Manager + Players).\n\n` +
      `This CANNOT be undone!\n\n` +
      `Type the player name to confirm:`
    );
    
    if (confirmed) {
      const confirmName = prompt(`Type "${playerName}" to confirm deletion:`);
      if (confirmName === playerName) {
        onRemovePlayer(playerCode);
        alert(`✅ ${playerName} has been permanently removed.`);
      } else {
        alert('❌ Name did not match. Deletion cancelled.');
      }
    }
  };

  return (
    <div className="payment-management-container">
      <h2>💰 Payment Management</h2>
      <p className="subtitle">Track player payments, manage visibility, and process batch entries</p>

      {/* Summary Stats */}
      <div className="payment-stats">
        <div className="stat-box paid">
          <div className="stat-value">{stats.paid}</div>
          <div className="stat-label">Paid Players</div>
        </div>
        <div className="stat-box unpaid">
          <div className="stat-value">{stats.unpaid}</div>
          <div className="stat-label">Unpaid Players</div>
        </div>
        <div className="stat-box pending">
          <div className="stat-value">{stats.pending}</div>
          <div className="stat-label">Pending</div>
        </div>
        <div className="stat-box total">
          <div className="stat-value">${stats.totalCollected}</div>
          <div className="stat-label">Total Collected</div>
        </div>
      </div>

      {/* Batch Entry Mode */}
      <div className="batch-entry-section">
        <h3>📋 Quick Batch Entry</h3>
        <p className="batch-instructions">
          Enter payments (one per line)<br />
          <strong>Format:</strong> Name - YYYYMMDDHHMM - method<br />
          <strong>Example:</strong> Bob Casson - 202412200815 - etransfer
        </p>
        
        <textarea
          className="batch-input"
          value={batchText}
          onChange={(e) => setBatchText(e.target.value)}
          placeholder="Bob Casson - 202412200815 - etransfer
Bonnie Biletski - 202412201430 - cash
Richard Smith - 202412212130 - etransfer"
          rows={8}
        />
        
        <div className="batch-buttons">
          <button className="save-batch-btn" onClick={handleBatchSave}>
            💾 Save All Payments
          </button>
          <button className="clear-batch-btn" onClick={() => setBatchText('')}>
            🔄 Clear
          </button>
        </div>
      </div>

      {/* Payment Table */}
      <div className="payment-table-section">
        <h3>📊 All Players - Payment Status</h3>
        
        {/* Search and Filters */}
        <div className="table-controls">
          <input
            type="text"
            className="search-input"
            placeholder="🔍 Search by name or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          
          <div className="filter-buttons">
            <button 
              className={filterStatus === 'all' ? 'active' : ''}
              onClick={() => setFilterStatus('all')}
            >
              All ({players.length})
            </button>
            <button 
              className={filterStatus === 'paid' ? 'active' : ''}
              onClick={() => setFilterStatus('paid')}
            >
              Paid ({stats.paid})
            </button>
            <button 
              className={filterStatus === 'unpaid' ? 'active' : ''}
              onClick={() => setFilterStatus('unpaid')}
            >
              Unpaid ({stats.unpaid})
            </button>
            {stats.pending > 0 && (
              <button 
                className={filterStatus === 'pending' ? 'active' : ''}
                onClick={() => setFilterStatus('pending')}
              >
                Pending ({stats.pending})
              </button>
            )}
          </div>
          
          <select 
            className="sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="name">Sort by Name</option>
            <option value="status">Sort by Status</option>
            <option value="time">Sort by Payment Time</option>
          </select>
        </div>

        {/* Player Table */}
        <div className="payment-table-wrapper">
          <table className="payment-table">
            <thead>
              <tr>
                <th>Player Name</th>
                <th>Code</th>
                <th>Status</th>
                <th>Payment Time</th>
                <th>Method</th>
                <th>Amount</th>
                <th>Visibility</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlayers.length === 0 ? (
                <tr>
                  <td colSpan="8" className="no-results">
                    No players found
                  </td>
                </tr>
              ) : (
                filteredPlayers.map(player => {
                  const status = player.paymentStatus || 'UNPAID';
                  const isVisible = player.visibleToPlayers !== false;
                  
                  return (
                    <tr key={player.playerCode} className={`status-${status.toLowerCase()}`}>
                      <td className="player-name-cell">{player.playerName}</td>
                      <td className="code-cell">{player.playerCode}</td>
                      <td className="status-cell">
                        {status === 'PAID' && <span className="status-badge paid">💰 PAID</span>}
                        {status === 'UNPAID' && <span className="status-badge unpaid">⏳ UNPAID</span>}
                        {status === 'PENDING' && <span className="status-badge pending">⏱️ PENDING</span>}
                      </td>
                      <td className="time-cell">{player.paymentTimestamp || '—'}</td>
                      <td className="method-cell">{player.paymentMethod || '—'}</td>
                      <td className="amount-cell">{player.paymentAmount ? `$${player.paymentAmount}` : '—'}</td>
                      <td className="visibility-cell">
                        {isVisible ? (
                          <span className="visibility-badge visible">👁️ VISIBLE</span>
                        ) : (
                          <span className="visibility-badge hidden">🚫 HIDDEN</span>
                        )}
                      </td>
                      <td className="actions-cell">
                        <div className="action-buttons">
                          {status !== 'PAID' ? (
                            <button 
                              className="action-btn paid-btn"
                              onClick={() => handleQuickPaid(player.playerCode, player.playerName)}
                              title="Mark as Paid"
                            >
                              💰 Mark Paid
                            </button>
                          ) : (
                            <button 
                              className="action-btn unpaid-btn"
                              onClick={() => handleMarkUnpaid(player.playerCode)}
                              title="Mark as Unpaid"
                            >
                              ⏳ Mark Unpaid
                            </button>
                          )}
                          
                          <button 
                            className="action-btn visibility-btn"
                            onClick={() => handleToggleVisibility(player.playerCode, isVisible)}
                            title={isVisible ? "Hide from Players" : "Show to Players"}
                          >
                            {isVisible ? '🚫 Hide' : '👁️ Show'}
                          </button>
                          
                          <button 
                            className="action-btn remove-btn"
                            onClick={() => handleRemovePermanently(player.playerCode, player.playerName)}
                            title="Remove Permanently"
                          >
                            🗑️ Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="table-footer">
          Showing {filteredPlayers.length} of {players.length} players
        </div>
      </div>
    </div>
  );
};

export default PaymentManagement;
