import React, { useState, useMemo } from 'react';
import './PaymentManagement.css';

/**
 * Payment Management Component - WITH SHOW IN TABLE FEATURE
 * Pool Manager only - track player payments, hide/show players, control table display
 * 
 * ELIGIBILITY RULE: Only PAID + VISIBLE players can win prizes!
 * TABLE DISPLAY: Pool Manager controls who appears in All Player Picks table
 */
const PaymentManagement = ({ 
  players = [],
  allPicks = [],
  onUpdatePayment,
  onTogglePlayerVisibility,
  onRemovePlayer,
  onToggleTableDisplay,
  onUpdatePlayerCode
}) => {
  
  const [batchText, setBatchText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all, paid, unpaid, pending
  const [sortBy, setSortBy] = useState('name'); // name, status, time

  // Check if player has submitted picks
  const playerHasPicks = (playerCode) => {
    return allPicks.some(pick => pick.playerCode === playerCode);
  };

  /**
   * Handle editing player code
   */
  const handleEditCode = (player) => {
    const currentCode = player.playerCode;
    const newCode = prompt(
      `Edit Access Code for ${player.playerName}\n\n` +
      `Current code: ${currentCode}\n\n` +
      `Enter new 6-character code (letters and numbers only):`
    );
    
    if (!newCode) return;
    
    const cleanCode = newCode.trim().toUpperCase();
    
    if (cleanCode.length !== 6) {
      alert('❌ Code must be exactly 6 characters!');
      return;
    }
    
    if (!/^[A-Z0-9]{6}$/.test(cleanCode)) {
      alert('❌ Code must contain only letters and numbers!');
      return;
    }
    
    const codeExists = players.some(p => 
      p.playerCode.toUpperCase() === cleanCode && p.playerCode !== currentCode
    );
    
    if (codeExists) {
      alert(`❌ Code "${cleanCode}" is already in use!`);
      return;
    }
    
    const confirmed = window.confirm(
      `⚠️ Change Access Code?\n\n` +
      `Player: ${player.playerName}\n` +
      `Old: ${currentCode}\n` +
      `New: ${cleanCode}\n\n` +
      `The player will need the NEW code to login!\n\n` +
      `Continue?`
    );
    
    if (!confirmed) return;
    
    onUpdatePlayerCode(currentCode, cleanCode);
  };

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

  // Calculate summary stats with eligibility
  const stats = useMemo(() => {
    const paid = players.filter(p => p.paymentStatus === 'PAID').length;
    const unpaid = players.filter(p => !p.paymentStatus || p.paymentStatus === 'UNPAID').length;
    const pending = players.filter(p => p.paymentStatus === 'PENDING').length;
    const totalCollected = players.filter(p => p.paymentStatus === 'PAID')
      .reduce((sum, p) => sum + (p.paymentAmount || 20), 0);
    
    // Eligible players (PAID + VISIBLE)
    const eligible = players.filter(p => 
      p.paymentStatus === 'PAID' && p.visibleToPlayers !== false
    ).length;
    
    const ineligible = players.length - eligible;
    
    // Players shown in table
    const inTable = players.filter(p => {
      const hasPicks = playerHasPicks(p.playerCode);
      return hasPicks || p.showInPicksTable === true;
    }).length;
    
    return { paid, unpaid, pending, totalCollected, total: players.length, eligible, ineligible, inTable };
  }, [players, allPicks]);

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

  // Mark as unpaid with warning
  const handleMarkUnpaid = (playerCode, playerName) => {
    const confirmed = confirm(
      `⚠️ MARK ${playerName} AS UNPAID?\n\n` +
      `This will make them INELIGIBLE to win prizes!\n\n` +
      `Continue?`
    );
    
    if (confirmed) {
      onUpdatePayment(playerCode, {
        status: 'UNPAID',
        timestamp: null,
        method: null,
        amount: null
      });
    }
  };

  // Toggle visibility with eligibility warning
  const handleToggleVisibility = (playerCode, playerName, currentVisibility, isPaid) => {
    const action = currentVisibility === false ? 'SHOW' : 'HIDE';
    
    // Warn if hiding a paid player
    if (action === 'HIDE' && isPaid) {
      const confirmed = confirm(
        `⚠️ HIDE ${playerName}?\n\n` +
        `This player is PAID!\n\n` +
        `Hiding them will make them INELIGIBLE to win prizes.\n\n` +
        `Continue?`
      );
      
      if (!confirmed) return;
    }
    
    onTogglePlayerVisibility(playerCode);
  };

  // Toggle table display
  const handleToggleTableDisplay = (playerCode, playerName, currentStatus, hasPicks) => {
    if (hasPicks) {
      alert(`❌ Cannot hide ${playerName} from table - they have submitted picks!`);
      return;
    }
    
    const action = currentStatus === true ? 'HIDE' : 'SHOW';
    const confirmed = confirm(
      `${action === 'SHOW' ? '✅' : '🚫'} ${action} ${playerName} IN TABLE?\n\n` +
      `This will ${action === 'SHOW' ? 'add them to' : 'remove them from'} the "All Player Picks" table.\n\n` +
      `Continue?`
    );
    
    if (confirmed) {
      onToggleTableDisplay(playerCode);
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

  // Get eligibility status
  const getEligibilityStatus = (player) => {
    const isPaid = player.paymentStatus === 'PAID';
    const isVisible = player.visibleToPlayers !== false;
    
    if (isPaid && isVisible) {
      return { eligible: true, badge: '💰✅', text: 'ELIGIBLE' };
    } else if (!isPaid && isVisible) {
      return { eligible: false, badge: '⏳❌', text: 'NOT PAID' };
    } else if (isPaid && !isVisible) {
      return { eligible: false, badge: '🚫❌', text: 'HIDDEN' };
    } else {
      return { eligible: false, badge: '⏳🚫', text: 'UNPAID+HIDDEN' };
    }
  };

  return (
    <div className="payment-management-container">
      <h2>💰 Payment Management</h2>
      <p className="subtitle">Track player payments, manage visibility, and control table display</p>

      {/* ELIGIBILITY WARNING */}
      <div className="eligibility-warning">
        <h3>⚖️ Prize Eligibility Rule</h3>
        <p>
          <strong>Only players who are PAID + VISIBLE can win prizes!</strong><br/>
          Actions that make players ineligible:
        </p>
        <ul>
          <li>❌ Mark as UNPAID → Player cannot win prizes</li>
          <li>❌ Hide Player → Player cannot win prizes</li>
          <li>✅ Mark as PAID + Show Player → Player can win prizes</li>
        </ul>
      </div>

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
        <div className="stat-box eligible">
          <div className="stat-value">{stats.eligible}</div>
          <div className="stat-label">✅ Eligible to Win</div>
        </div>
        <div className="stat-box total" style={{ background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)', border: '3px solid #0ea5e9' }}>
          <div className="stat-value">{stats.inTable}</div>
          <div className="stat-label">📊 Shown in Table</div>
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
        <h3>📊 All Players - Payment Status & Table Display</h3>
        
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
                <th>Payment Status</th>
                <th>Payment Time</th>
                <th>Method</th>
                <th>Picks</th>
                <th>Show in Table</th>
                <th>Visibility</th>
                <th>Prize Eligibility</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlayers.length === 0 ? (
                <tr>
                  <td colSpan="10" className="no-results">
                    No players found
                  </td>
                </tr>
              ) : (
                filteredPlayers.map(player => {
                  const status = player.paymentStatus || 'UNPAID';
                  const isVisible = player.visibleToPlayers !== false;
                  const isPaid = status === 'PAID';
                  const eligibility = getEligibilityStatus(player);
                  const hasPicks = playerHasPicks(player.playerCode);
                  const showInTable = player.showInPicksTable === true;
                  
                  return (
                    <tr key={player.playerCode} className={`status-${status.toLowerCase()} ${eligibility.eligible ? 'eligible-row' : 'ineligible-row'}`}>
                      <td className="player-name-cell">{player.playerName}</td>
                      <td className="code-cell">{player.playerCode}</td>
                      <td className="status-cell">
                        {status === 'PAID' && <span className="status-badge paid">💰 PAID</span>}
                        {status === 'UNPAID' && <span className="status-badge unpaid">⏳ UNPAID</span>}
                        {status === 'PENDING' && <span className="status-badge pending">⏱️ PENDING</span>}
                      </td>
                      <td className="time-cell">{player.paymentTimestamp || '—'}</td>
                      <td className="method-cell">{player.paymentMethod || '—'}</td>
                      <td className="picks-cell">
                        {hasPicks ? (
                          <span style={{ color: '#10b981', fontWeight: 'bold' }}>✓ Has Picks</span>
                        ) : (
                          <span style={{ color: '#ef4444' }}>No Picks</span>
                        )}
                      </td>
                      <td className="table-display-cell">
                        {hasPicks ? (
                          <span className="table-badge locked">
                            ✓ IN TABLE 🔒
                          </span>
                        ) : showInTable ? (
                          <button
                            className="table-toggle-btn show"
                            onClick={() => handleToggleTableDisplay(player.playerCode, player.playerName, showInTable, hasPicks)}
                          >
                            ☑️ Shown
                          </button>
                        ) : (
                          <button
                            className="table-toggle-btn hide"
                            onClick={() => handleToggleTableDisplay(player.playerCode, player.playerName, showInTable, hasPicks)}
                          >
                            ☐ Hidden
                          </button>
                        )}
                      </td>
                      <td className="visibility-cell">
                        {isVisible ? (
                          <span className="visibility-badge visible">👁️ VISIBLE</span>
                        ) : (
                          <span className="visibility-badge hidden">🚫 HIDDEN</span>
                        )}
                      </td>
                      <td className="eligibility-cell">
                        <span className={`eligibility-badge ${eligibility.eligible ? 'eligible' : 'ineligible'}`}>
                          {eligibility.badge} {eligibility.text}
                        </span>
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
                              onClick={() => handleMarkUnpaid(player.playerCode, player.playerName)}
                              title="Mark as Unpaid (Makes Ineligible!)"
                            >
                              ⏳ Mark Unpaid
                            </button>
                          )}
                          
                          <button 
                            className="action-btn visibility-btn"
                            onClick={() => handleToggleVisibility(player.playerCode, player.playerName, isVisible, isPaid)}
                            title={isVisible ? "Hide from Players (Makes Ineligible!)" : "Show to Players"}
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
          Showing {filteredPlayers.length} of {players.length} players | 
          ✅ {stats.eligible} Eligible to Win Prizes | 
          📊 {stats.inTable} Shown in Picks Table
        </div>
      </div>
    </div>
  );
};

export default PaymentManagement;
