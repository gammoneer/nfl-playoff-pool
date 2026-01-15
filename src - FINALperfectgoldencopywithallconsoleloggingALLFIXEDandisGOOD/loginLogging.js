import { getDatabase, ref, push } from 'firebase/database';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LOGIN LOGGING UTILITIES
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * These functions handle logging all login attempts to Firebase.
 * 
 * Firebase Structure:
 * /loginLogs
 *   /{logId}: {
 *     timestamp: 1704067200000,
 *     playerCode: "B8L9M2",
 *     playerName: "Richard Biletski",
 *     success: true/false,
 *     errorMessage: "Invalid code",
 *     browser: "Chrome 120",
 *     device: "Desktop",
 *     userAgent: "Mozilla/5.0..."
 *   }
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * Detect browser name and version
 */
export const detectBrowser = () => {
  const ua = navigator.userAgent;
  let browser = 'Unknown';
  
  if (ua.indexOf('Firefox') > -1) {
    const match = ua.match(/Firefox\/(\d+)/);
    browser = match ? `Firefox ${match[1]}` : 'Firefox';
  } else if (ua.indexOf('SamsungBrowser') > -1) {
    browser = 'Samsung Internet';
  } else if (ua.indexOf('Opera') > -1 || ua.indexOf('OPR') > -1) {
    browser = 'Opera';
  } else if (ua.indexOf('Trident') > -1) {
    browser = 'Internet Explorer';
  } else if (ua.indexOf('Edge') > -1) {
    browser = 'Edge';
  } else if (ua.indexOf('Chrome') > -1) {
    const match = ua.match(/Chrome\/(\d+)/);
    browser = match ? `Chrome ${match[1]}` : 'Chrome';
  } else if (ua.indexOf('Safari') > -1) {
    const match = ua.match(/Version\/(\d+)/);
    browser = match ? `Safari ${match[1]}` : 'Safari';
  }
  
  return browser;
};

/**
 * Detect device type
 */
export const detectDevice = () => {
  const ua = navigator.userAgent;
  
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return 'Tablet';
  }
  if (/Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
    return 'Mobile';
  }
  return 'Desktop';
};

/**
 * Log a login attempt to Firebase
 * 
 * @param {Object} params
 * @param {string} params.playerCode - The code that was attempted
 * @param {string} params.playerName - Name if successful, null if failed
 * @param {boolean} params.success - Whether login was successful
 * @param {string} params.errorMessage - Error message if failed
 */
export const logLoginAttempt = async ({
  playerCode,
  playerName = null,
  success,
  errorMessage = null
}) => {
  try {
    const database = getDatabase();
    const logsRef = ref(database, 'loginLogs');
    
    const logEntry = {
      timestamp: Date.now(),
      playerCode: playerCode || 'EMPTY',
      playerName: playerName || null,
      success: success,
      errorMessage: errorMessage || null,
      browser: detectBrowser(),
      device: detectDevice(),
      userAgent: navigator.userAgent
    };
    
    await push(logsRef, logEntry);
    
    // Silent logging - don't show errors to users
    console.log('✅ Login attempt logged:', {
      code: playerCode,
      success,
      browser: logEntry.browser,
      device: logEntry.device
    });
    
  } catch (error) {
    // Silent fail - don't break the login flow
    console.error('⚠️ Failed to log login attempt:', error);
  }
};

/**
 * Log successful login
 */
export const logSuccessfulLogin = async (playerCode, playerName) => {
  return logLoginAttempt({
    playerCode,
    playerName,
    success: true,
    errorMessage: null
  });
};

/**
 * Log failed login
 */
export const logFailedLogin = async (playerCode, errorMessage) => {
  return logLoginAttempt({
    playerCode,
    playerName: null,
    success: false,
    errorMessage
  });
};

/**
 * Get friendly error message for logging
 */
export const getFriendlyErrorMessage = (code, playerCodes) => {
  if (!code || code.length === 0) {
    return 'Empty code';
  }
  if (code.length !== 6) {
    return `Invalid length (${code.length} characters)`;
  }
  if (!/^[A-Z0-9]{6}$/.test(code)) {
    return 'Invalid format (special characters)';
  }
  if (!playerCodes[code]) {
    return 'Code not recognized';
  }
  return 'Unknown error';
};
