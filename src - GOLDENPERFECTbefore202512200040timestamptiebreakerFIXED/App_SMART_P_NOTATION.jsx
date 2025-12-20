import React, { useState, useEffect } from 'react';
import { X, Calendar, Users, Trophy, FileText, Menu, ChevronDown, ChevronUp, Mail, LogOut } from 'lucide-react';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [playerCode, setPlayerCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('week1');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [expandedWeek, setExpandedWeek] = useState(null);

  // Sample data - in production this would come from a backend
  const players = {
    'RICH01': { name: 'Richard', password: 'pass123', email: 'richard@example.com' },
    'NEEM01': { name: 'Neema', password: 'pass123', email: 'neema@example.com' },
    'BOB01': { name: 'Bob', password: 'pass123', email: 'bob@example.com' },
    'ALIC01': { name: 'Alice', password: 'pass123', email: 'alice@example.com' }
  };

  // Sample picks data structure
  // isRNG: true means this pick was filled by RNG/Pool Manager
  const [playerPicks, setPlayerPicks] = useState({
    'RICH01': {
      week1: { 
        HOU: { prediction: 24, actual: null, isRNG: false },
        LAC: { prediction: 27, actual: null, isRNG: false },
        PIT: { prediction: 20, actual: null, isRNG: false },
        BAL: { prediction: 30, actual: null, isRNG: false },
        BUF: { prediction: 28, actual: null, isRNG: false },
        DEN: { prediction: 24, actual: null, isRNG: false },
        GB: { prediction: 31, actual: null, isRNG: false },
        PHI: { prediction: 27, actual: null, isRNG: false },
        TB: { prediction: 23, actual: null, isRNG: false },
        WSH: { prediction: 20, actual: null, isRNG: false },
        LAR: { prediction: 26, actual: null, isRNG: false },
        MIN: { prediction: 28, actual: null, isRNG: false }
      },
      week2: {
        // Empty for now - player will enter before week 2 deadline
      },
      week3: {
        // Empty for now
      },
      week4: {
        // Empty for now
      }
    },
    'NEEM01': {
      week1: {
        HOU: { prediction: 21, actual: null, isRNG: false },
        LAC: { prediction: 24, actual: null, isRNG: false },
        PIT: { prediction: 23, actual: null, isRNG: false },
        BAL: { prediction: 27, actual: null, isRNG: false },
        BUF: { prediction: 26, actual: null, isRNG: false },
        DEN: { prediction: 20, actual: null, isRNG: false },
        GB: { prediction: 28, actual: null, isRNG: false },
        PHI: { prediction: 25, actual: null, isRNG: false },
        TB: { prediction: 22, actual: null, isRNG: false },
        WSH: { prediction: 19, actual: null, isRNG: false },
        LAR: { prediction: 24, actual: null, isRNG: false },
        MIN: { prediction: 28, actual: null, isRNG: false }
      },
      week2: {},
      week3: {},
      week4: {}
    },
    'BOB01': {
      week1: {
        HOU: { prediction: 22, actual: null, isRNG: false },
        LAC: { prediction: 26, actual: null, isRNG: false },
        PIT: { prediction: 21, actual: null, isRNG: false },
        BAL: { prediction: 28, actual: null, isRNG: false },
        BUF: { prediction: 27, actual: null, isRNG: false },
        DEN: { prediction: 22, actual: null, isRNG: false },
        GB: { prediction: 30, actual: null, isRNG: false },
        PHI: { prediction: 26, actual: null, isRNG: false },
        TB: { prediction: 24, actual: null, isRNG: false },
        WSH: { prediction: 18, actual: null, isRNG: false },
        LAR: { prediction: 25, actual: null, isRNG: false },
        MIN: { prediction: 31, actual: null, isRNG: false }
      },
      week2: {},
      week3: {
        // Bob entered week 3 early (abnormal pattern - skipped week 2)
        KC: { prediction: 28, actual: null, isRNG: false },
        BAL: { prediction: 26, actual: null, isRNG: false },
        BUF: { prediction: 31, actual: null, isRNG: false },
        PHI: { prediction: 30, actual: null, isRNG: false }
      },
      week4: {}
    },
    'ALIC01': {
      week1: {
        HOU: { prediction: 23, actual: null, isRNG: false },
        LAC: { prediction: 25, actual: null, isRNG: false },
        PIT: { prediction: 22, actual: null, isRNG: false },
        BAL: { prediction: 29, actual: null, isRNG: false },
        BUF: { prediction: 27, actual: null, isRNG: false },
        DEN: { prediction: 21, actual: null, isRNG: false },
        GB: { prediction: 29, actual: null, isRNG: false },
        PHI: { prediction: 26, actual: null, isRNG: false },
        TB: { prediction: 23, actual: null, isRNG: false },
        WSH: { prediction: 20, actual: null, isRNG: false },
        LAR: { prediction: 25, actual: null, isRNG: false },
        MIN: { prediction: 30, actual: null, isRNG: false }
      },
      week2: {
        HOU: { prediction: 24, actual: null, isRNG: false },
        BAL: { prediction: 27, actual: null, isRNG: false },
        LAR: { prediction: 26, actual: null, isRNG: false },
        PHI: { prediction: 28, actual: null, isRNG: false },
        BUF: { prediction: 30, actual: null, isRNG: false },
        GB: { prediction: 29, actual: null, isRNG: false },
        DEN: { prediction: 23, actual: null, isRNG: false },
        WSH: { prediction: 22, actual: null, isRNG: false }
      },
      week3: {
        KC: { prediction: 29, actual: null, isRNG: false },
        BAL: { prediction: 27, actual: null, isRNG: false },
        BUF: { prediction: 32, actual: null, isRNG: false },
        PHI: { prediction: 31, actual: null, isRNG: false }
      },
      week4: {
        TEAM_A: { prediction: 28, actual: null, isRNG: false },
        TEAM_B: { prediction: 25, actual: null, isRNG: false }
      }
    }
  });

  // Game schedules
  const gameSchedules = {
    week1: {
      title: 'Wild Card Weekend',
      date: 'January 10-12, 2026',
      games: [
        { id: 'HOU', homeTeam: 'Texans', awayTeam: 'Chargers' },
        { id: 'LAC', homeTeam: 'Chargers', awayTeam: 'Texans' },
        { id: 'PIT', homeTeam: 'Steelers', awayTeam: 'Ravens' },
        { id: 'BAL', homeTeam: 'Ravens', awayTeam: 'Steelers' },
        { id: 'BUF', homeTeam: 'Bills', awayTeam: 'Broncos' },
        { id: 'DEN', homeTeam: 'Broncos', awayTeam: 'Bills' },
        { id: 'GB', homeTeam: 'Packers', awayTeam: 'Eagles' },
        { id: 'PHI', homeTeam: 'Eagles', awayTeam: 'Packers' },
        { id: 'TB', homeTeam: 'Buccaneers', awayTeam: 'Commanders' },
        { id: 'WSH', homeTeam: 'Commanders', awayTeam: 'Buccaneers' },
        { id: 'LAR', homeTeam: 'Rams', awayTeam: 'Vikings' },
        { id: 'MIN', homeTeam: 'Vikings', awayTeam: 'Rams' }
      ]
    },
    week2: {
      title: 'Divisional Round',
      date: 'January 17-18, 2026',
      games: [
        { id: 'HOU', homeTeam: 'Texans', awayTeam: 'TBD' },
        { id: 'BAL', homeTeam: 'Ravens', awayTeam: 'TBD' },
        { id: 'LAR', homeTeam: 'Rams', awayTeam: 'TBD' },
        { id: 'PHI', homeTeam: 'Eagles', awayTeam: 'TBD' },
        { id: 'BUF', homeTeam: 'Bills', awayTeam: 'TBD' },
        { id: 'GB', homeTeam: 'Packers', awayTeam: 'TBD' },
        { id: 'DEN', homeTeam: 'Broncos', awayTeam: 'TBD' },
        { id: 'WSH', homeTeam: 'Commanders', awayTeam: 'TBD' }
      ]
    },
    week3: {
      title: 'Conference Championships',
      date: 'January 25, 2026',
      games: [
        { id: 'KC', homeTeam: 'Chiefs', awayTeam: 'TBD' },
        { id: 'BAL', homeTeam: 'Ravens', awayTeam: 'TBD' },
        { id: 'BUF', homeTeam: 'Bills', awayTeam: 'TBD' },
        { id: 'PHI', homeTeam: 'Eagles', awayTeam: 'TBD' }
      ]
    },
    week4: {
      title: 'Super Bowl LIX',
      date: 'February 8, 2026',
      games: [
        { id: 'TEAM_A', homeTeam: 'AFC Champion', awayTeam: 'NFC Champion' },
        { id: 'TEAM_B', homeTeam: 'NFC Champion', awayTeam: 'AFC Champion' }
      ]
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    const upperCode = playerCode.toUpperCase();
    
    if (players[upperCode] && players[upperCode].password === password) {
      setIsAuthenticated(true);
      setCurrentUser({ code: upperCode, ...players[upperCode] });
      setError('');
      setPlayerCode('');
      setPassword('');
    } else {
      setError('Invalid player code or password');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    setActiveTab('week1');
  };

  const handlePasswordChange = (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }
    
    // In production, this would call an API
    players[currentUser.code].password = newPassword;
    setShowPasswordModal(false);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    alert('Password changed successfully!');
  };

  const handlePredictionChange = (week, gameId, value) => {
    const numValue = parseInt(value) || 0;
    setPlayerPicks(prev => ({
      ...prev,
      [currentUser.code]: {
        ...prev[currentUser.code],
        [week]: {
          ...prev[currentUser.code][week],
          [gameId]: { 
            prediction: numValue, 
            actual: prev[currentUser.code][week]?.[gameId]?.actual || null,
            isRNG: false // Manual entry
          }
        }
      }
    }));
  };

  // Helper function: Check which weeks a player has picks for
  const getPlayerWeeks = (playerCode) => {
    const picks = playerPicks[playerCode];
    if (!picks) return [];
    
    const weeks = [];
    if (picks.week1 && Object.keys(picks.week1).length > 0) weeks.push(1);
    if (picks.week2 && Object.keys(picks.week2).length > 0) weeks.push(2);
    if (picks.week3 && Object.keys(picks.week3).length > 0) weeks.push(3);
    if (picks.week4 && Object.keys(picks.week4).length > 0) weeks.push(4);
    
    return weeks;
  };

  // Helper function: Check if a week has any RNG picks
  const hasRNGPicks = (playerCode, week) => {
    const picks = playerPicks[playerCode]?.[week];
    if (!picks) return false;
    
    return Object.values(picks).some(pick => pick.isRNG === true);
  };

  // Helper function: Determine if pattern is abnormal for current stage
  const isAbnormalPattern = (weeks) => {
    if (weeks.length === 0) return false; // No picks yet
    if (weeks.length === 4) return false; // Complete - normal
    
    // Check if weeks are sequential from 1
    // Normal patterns: [1], [1,2], [1,2,3]
    // Abnormal patterns: [1,3], [2], [1,2,4], [2,3], etc.
    
    const isSequentialFromOne = weeks.every((week, index) => week === index + 1);
    
    return !isSequentialFromOne;
  };

  // Helper function: Calculate predicted total for a week
  const calculatePredictedTotal = (playerCode, week) => {
    const picks = playerPicks[playerCode]?.[week];
    if (!picks || Object.keys(picks).length === 0) return null;
    
    return Object.values(picks).reduce((sum, pick) => sum + (pick.prediction || 0), 0);
  };

  // Helper function: Calculate weekly total (returns object with prediction, difference, hasActual, hasRNG)
  const calculateWeeklyTotal = (playerCode, week) => {
    const picks = playerPicks[playerCode]?.[week];
    if (!picks || Object.keys(picks).length === 0) {
      return null; // No picks for this week
    }
    
    const predicted = Object.values(picks).reduce((sum, pick) => sum + (pick.prediction || 0), 0);
    
    // Check if any actual scores exist for this week
    const hasActual = Object.values(picks).some(pick => pick.actual !== null && pick.actual !== undefined);
    
    // Check if any picks are RNG
    const hasRNG = Object.values(picks).some(pick => pick.isRNG === true);
    
    if (!hasActual) {
      return { predicted, difference: null, hasActual: false, hasRNG };
    }
    
    // Calculate difference
    const difference = Object.values(picks).reduce((sum, pick) => {
      if (pick.actual !== null && pick.actual !== undefined) {
        return sum + Math.abs(pick.prediction - pick.actual);
      }
      return sum;
    }, 0);
    
    return { predicted, difference, hasActual: true, hasRNG };
  };

  // Helper function: Format weekly total for display
  const formatWeeklyTotal = (weekData) => {
    if (!weekData) return '-';
    
    const { predicted, difference, hasActual, hasRNG } = weekData;
    
    // Show asterisk if has RNG picks
    const asterisk = hasRNG ? '*' : '';
    
    if (!hasActual) {
      return `${predicted}${asterisk}`;
    }
    
    return `${predicted}${asterisk}/${difference}`;
  };

  // Helper function: Calculate grand total (returns object with all needed data)
  const calculateGrandTotal = (playerCode) => {
    const weeks = getPlayerWeeks(playerCode);
    
    if (weeks.length === 0) {
      return null; // No picks at all
    }
    
    // Calculate full predicted total (all weeks entered)
    let fullPredicted = 0;
    let playedPredicted = 0;
    let totalDifference = 0;
    let hasAnyActual = false;
    let allWeeksPlayed = true;
    
    weeks.forEach(weekNum => {
      const weekKey = `week${weekNum}`;
      const weekData = calculateWeeklyTotal(playerCode, weekKey);
      
      if (weekData) {
        fullPredicted += weekData.predicted;
        
        if (weekData.hasActual) {
          playedPredicted += weekData.predicted;
          totalDifference += weekData.difference;
          hasAnyActual = true;
        } else {
          allWeeksPlayed = false;
        }
      }
    });
    
    // Check if pattern is abnormal
    const abnormal = isAbnormalPattern(weeks);
    
    return {
      weeks,
      fullPredicted,
      playedPredicted,
      totalDifference,
      hasAnyActual,
      allWeeksPlayed,
      abnormal,
      weekCount: weeks.length
    };
  };

  // Helper function: Format P notation (P13, P123, etc.)
  const formatPNotation = (weeks) => {
    return 'P' + weeks.join('');
  };

  // Helper function: Format grand total for display
  const formatGrandTotal = (grandData) => {
    if (!grandData) return '-';
    
    const { weeks, fullPredicted, playedPredicted, totalDifference, hasAnyActual, allWeeksPlayed, abnormal, weekCount } = grandData;
    
    // If abnormal pattern, show P notation
    const prefix = abnormal ? formatPNotation(weeks) + '/' : '';
    
    // No actual scores yet
    if (!hasAnyActual) {
      return `${prefix}${fullPredicted}`;
    }
    
    // All their weeks are played
    if (allWeeksPlayed) {
      return `${prefix}${fullPredicted}/${totalDifference}`;
    }
    
    // Some weeks played, some not
    return `${prefix}${fullPredicted}/${playedPredicted}/${totalDifference}`;
  };

  // Helper function: Get dynamic font size based on display string
  const getDynamicFontSize = (displayStr) => {
    if (!displayStr) return '16px';
    
    const slashCount = (displayStr.match(/\//g) || []).length;
    
    // If 2 or more slashes (three+ numbers), use smaller font
    if (slashCount >= 2) {
      return '14px';
    }
    
    return '16px';
  };

  // Helper function: Get tooltip for weekly total
  const getWeeklyTooltip = (weekData) => {
    if (!weekData) return '';
    
    const { predicted, difference, hasActual, hasRNG } = weekData;
    
    if (!hasActual) {
      if (hasRNG) {
        return `Predicted: ${predicted} (includes RNG picks)`;
      }
      return `Predicted: ${predicted}`;
    }
    
    if (hasRNG) {
      return `Predicted: ${predicted} (includes RNG) | Difference: ${difference}`;
    }
    return `Predicted: ${predicted} | Difference: ${difference}`;
  };

  // Helper function: Get tooltip for grand total
  const getGrandTooltip = (grandData) => {
    if (!grandData) return '';
    
    const { weeks, fullPredicted, playedPredicted, totalDifference, hasAnyActual, allWeeksPlayed, abnormal } = grandData;
    
    let tooltip = '';
    
    if (abnormal) {
      tooltip += `Weeks Entered: ${weeks.join(', ')} | `;
    }
    
    if (!hasAnyActual) {
      tooltip += `Full Prediction: ${fullPredicted}`;
    } else if (allWeeksPlayed) {
      tooltip += `Full Prediction: ${fullPredicted} | Total Difference: ${totalDifference}`;
    } else {
      tooltip += `Full Prediction: ${fullPredicted} | Played Weeks: ${playedPredicted} | Difference So Far: ${totalDifference}`;
    }
    
    return tooltip;
  };

  // Calculate totals for all players
  const calculatePlayerTotals = () => {
    const totals = {};
    
    Object.keys(players).forEach(code => {
      totals[code] = {
        week1: calculateWeeklyTotal(code, 'week1'),
        week2: calculateWeeklyTotal(code, 'week2'),
        week3: calculateWeeklyTotal(code, 'week3'),
        week4: calculateWeeklyTotal(code, 'week4'),
        grand: calculateGrandTotal(code)
      };
    });
    
    return totals;
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trophy className="text-white" size={40} />
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">NFL Playoff Pool</h1>
            <p className="text-gray-600">Super Bowl LIX Edition</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Player Code
              </label>
              <input
                type="text"
                value={playerCode}
                onChange={(e) => setPlayerCode(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="Enter your player code"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="Enter your password"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 transition-all transform hover:scale-105 shadow-lg"
            >
              Sign In
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600">
            <p>Demo Codes: RICH01, NEEM01, BOB01, ALIC01</p>
            <p>Password: pass123</p>
          </div>
        </div>
      </div>
    );
  }

  const renderGameInputs = (week) => {
    const schedule = gameSchedules[week];
    const currentPicks = playerPicks[currentUser.code]?.[week] || {};

    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">{schedule.title}</h2>
            <p className="text-gray-600">{schedule.date}</p>
          </div>
          <Calendar className="text-blue-600" size={32} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {schedule.games.map((game) => (
            <div key={game.id} className="border-2 border-gray-200 rounded-lg p-4 hover:border-blue-400 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-gray-800">{game.awayTeam}</span>
                <span className="text-gray-500">@</span>
                <span className="font-semibold text-gray-800">{game.homeTeam}</span>
              </div>
              <div className="flex items-center space-x-2">
                <label className="text-sm text-gray-600 whitespace-nowrap">Combined Score:</label>
                <input
                  type="number"
                  min="0"
                  max="150"
                  value={currentPicks[game.id]?.prediction || ''}
                  onChange={(e) => handlePredictionChange(week, game.id, e.target.value)}
                  className="flex-1 px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-between items-center">
          <div className="text-lg font-semibold text-gray-700">
            Week Total: <span className="text-blue-600">
              {calculatePredictedTotal(currentUser.code, week) || 0}
            </span> points
          </div>
          <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-semibold">
            Save Picks
          </button>
        </div>
      </div>
    );
  };

  const renderSuperBowlView = () => {
    const playerTotals = calculatePlayerTotals();

    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">All Player Picks - Super Bowl LIX</h2>
            <p className="text-gray-600">Complete playoff predictions and standings</p>
          </div>
          <Trophy className="text-yellow-500" size={32} />
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="text-left py-3 px-4 font-bold text-gray-700">Player</th>
                <th className="text-center py-3 px-4 font-bold text-gray-700">Week 4<br/><span className="text-xs font-normal text-gray-500">(Super Bowl)</span></th>
                <th className="text-center py-3 px-4 font-bold text-gray-700">Week 3<br/><span className="text-xs font-normal text-gray-500">(Conference)</span></th>
                <th className="text-center py-3 px-4 font-bold text-gray-700">Week 2<br/><span className="text-xs font-normal text-gray-500">(Divisional)</span></th>
                <th className="text-center py-3 px-4 font-bold text-gray-700">Week 1<br/><span className="text-xs font-normal text-gray-500">(Wild Card)</span></th>
                <th className="text-center py-3 px-4 font-bold text-gray-700">Grand Total<br/><span className="text-xs font-normal text-gray-500">(Pred/Played/Diff)</span></th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(players).map((code) => {
                const totals = playerTotals[code];
                const grandDisplay = formatGrandTotal(totals.grand);
                const grandFontSize = getDynamicFontSize(grandDisplay);
                
                return (
                  <tr key={code} className="border-b border-gray-200 hover:bg-blue-50 transition-colors">
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center text-white font-bold">
                          {players[code].name[0]}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-800">{players[code].name}</div>
                          <div className="text-sm text-gray-500">{code}</div>
                        </div>
                      </div>
                    </td>
                    <td className="text-center py-4 px-4" title={getWeeklyTooltip(totals.week4)}>
                      <span className="font-medium text-gray-700">
                        {formatWeeklyTotal(totals.week4)}
                      </span>
                    </td>
                    <td className="text-center py-4 px-4" title={getWeeklyTooltip(totals.week3)}>
                      <span className="font-medium text-gray-700">
                        {formatWeeklyTotal(totals.week3)}
                      </span>
                    </td>
                    <td className="text-center py-4 px-4" title={getWeeklyTooltip(totals.week2)}>
                      <span className="font-medium text-gray-700">
                        {formatWeeklyTotal(totals.week2)}
                      </span>
                    </td>
                    <td className="text-center py-4 px-4" title={getWeeklyTooltip(totals.week1)}>
                      <span className="font-medium text-gray-700">
                        {formatWeeklyTotal(totals.week1)}
                      </span>
                    </td>
                    <td className="text-center py-4 px-4 bg-yellow-50" title={getGrandTooltip(totals.grand)}>
                      <span className="font-bold text-blue-700" style={{ fontSize: grandFontSize }}>
                        {grandDisplay}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="md:hidden space-y-4">
          {Object.keys(players).map((code) => {
            const totals = playerTotals[code];
            const isExpanded = expandedWeek === code;
            const grandDisplay = formatGrandTotal(totals.grand);
            
            return (
              <div key={code} className="border-2 border-gray-200 rounded-lg overflow-hidden">
                <div 
                  className="bg-blue-50 p-4 flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedWeek(isExpanded ? null : code)}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center text-white font-bold">
                      {players[code].name[0]}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-800">{players[code].name}</div>
                      <div className="text-sm text-gray-500">{code}</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-blue-700" title={getGrandTooltip(totals.grand)}>
                      {grandDisplay}
                    </span>
                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="p-4 space-y-2 bg-white">
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600">Week 1:</span>
                      <span className="font-medium" title={getWeeklyTooltip(totals.week1)}>
                        {formatWeeklyTotal(totals.week1)}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600">Week 2:</span>
                      <span className="font-medium" title={getWeeklyTooltip(totals.week2)}>
                        {formatWeeklyTotal(totals.week2)}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-gray-600">Week 3:</span>
                      <span className="font-medium" title={getWeeklyTooltip(totals.week3)}>
                        {formatWeeklyTotal(totals.week3)}
                      </span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-gray-600">Week 4:</span>
                      <span className="font-medium" title={getWeeklyTooltip(totals.week4)}>
                        {formatWeeklyTotal(totals.week4)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
            <FileText className="mr-2" size={20} />
            📊 Format Guide
          </h3>
          
          <div className="space-y-4 text-sm">
            <div>
              <p className="font-semibold text-gray-800 mb-2">Grand Total Format:</p>
              <ul className="space-y-2 text-gray-700">
                <li><strong>Complete Entry:</strong> <code className="bg-white px-2 py-1 rounded">784</code> - All 4 weeks entered</li>
                <li><strong>During Season:</strong> <code className="bg-white px-2 py-1 rounded">784/598/35</code> - Full Pred / Played Weeks / Difference</li>
                <li><strong>After Season:</strong> <code className="bg-white px-2 py-1 rounded">784/55</code> - Full Pred / Total Difference</li>
                <li><strong>Abnormal Pattern:</strong> <code className="bg-white px-2 py-1 rounded">P13/415</code> - P = Partial (weeks 1 & 3 only)</li>
              </ul>
            </div>
            
            <div>
              <p className="font-semibold text-gray-800 mb-2">Special Indicators:</p>
              <ul className="space-y-2 text-gray-700">
                <li><strong>Asterisk (*):</strong> <code className="bg-white px-2 py-1 rounded">234*</code> - Pick filled by RNG/Pool Manager</li>
                <li><strong>P Notation:</strong> Shows which weeks entered when pattern is unusual (e.g., P13 = weeks 1 & 3, skipped 2)</li>
                <li><strong>Dash (-):</strong> Week not entered yet</li>
              </ul>
            </div>
            
            <div>
              <p className="font-semibold text-gray-800 mb-2">Examples:</p>
              <ul className="space-y-2 text-gray-700">
                <li>Richard: <code className="bg-white px-2 py-1 rounded">784</code> - Entered all 4 weeks normally</li>
                <li>Neema: <code className="bg-white px-2 py-1 rounded">533/287/22</code> - 2 weeks played so far, 22 points off</li>
                <li>Bob: <code className="bg-white px-2 py-1 rounded">P13/415</code> - Entered weeks 1 & 3 only (skipped 2) - unusual!</li>
                <li>After RNG fills Bob's week 2: <code className="bg-white px-2 py-1 rounded">649</code> - P notation drops (normalized)</li>
              </ul>
            </div>
            
            <div className="pt-4 border-t-2 border-blue-200">
              <p className="text-gray-600 italic">
                💡 <strong>Tip:</strong> Hover over any number for detailed breakdown! The P notation only appears for unusual entry patterns and disappears once normalized.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-xl">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Trophy size={32} />
              <div>
                <h1 className="text-2xl font-bold">NFL Playoff Pool</h1>
                <p className="text-blue-100 text-sm">Super Bowl LIX</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="hidden md:flex items-center space-x-3 bg-blue-700 px-4 py-2 rounded-lg">
                <Users size={20} />
                <span className="font-semibold">{currentUser.name}</span>
              </div>
              
              <button
                onClick={() => setShowPasswordModal(true)}
                className="hidden md:flex items-center space-x-2 bg-blue-700 hover:bg-blue-600 px-4 py-2 rounded-lg transition-colors"
              >
                <Mail size={20} />
                <span>Change Password</span>
              </button>
              
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg transition-colors"
              >
                <LogOut size={20} />
                <span className="hidden md:inline">Logout</span>
              </button>
              
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden"
              >
                <Menu size={24} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-blue-700 text-white">
          <div className="container mx-auto px-4 py-4 space-y-2">
            <div className="flex items-center space-x-3 py-2">
              <Users size={20} />
              <span>{currentUser.name}</span>
            </div>
            <button
              onClick={() => {
                setShowPasswordModal(true);
                setIsMobileMenuOpen(false);
              }}
              className="flex items-center space-x-2 py-2 w-full"
            >
              <Mail size={20} />
              <span>Change Password</span>
            </button>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <nav className="bg-white shadow-md sticky top-0 z-10">
        <div className="container mx-auto px-4">
          <div className="flex overflow-x-auto">
            {['week1', 'week2', 'week3', 'week4', 'superbowl'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-4 font-semibold whitespace-nowrap transition-all ${
                  activeTab === tab
                    ? 'text-blue-600 border-b-4 border-blue-600'
                    : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                }`}
              >
                {tab === 'superbowl' ? 'All Picks' : `Week ${tab.slice(-1)}`}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {activeTab === 'superbowl' ? renderSuperBowlView() : renderGameInputs(activeTab)}
      </main>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Change Password</h2>
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setPasswordError('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              {passwordError && (
                <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {passwordError}
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Update Password
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
