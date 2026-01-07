// ============================================================================
// MASTER WINNER CALCULATION FUNCTION
// ============================================================================
// Add this function to your App.jsx (before the return statement)

/**
 * Calculate all prize winners for all weeks
 * Converts app data format to calculation format, runs all calculations
 */
const calculateAllPrizeWinners = () => {
  console.log('🏆 Starting winner calculations...');
  
  // STEP 1: Convert allPicks array to object format the functions expect
  const picksObject = {};
  
  allPicks.forEach(pick => {
    if (pick.firebaseKey && pick.playerCode && pick.predictions) {
      // Initialize player if not exists
      if (!picksObject[pick.playerCode]) {
        picksObject[pick.playerCode] = {
          name: pick.playerName,
          picks: {}
        };
      }
      
      // Convert predictions array to object (skip index 0)
      const predictionsObj = {};
      
      if (Array.isArray(pick.predictions)) {
        pick.predictions.forEach((pred, index) => {
          if (index > 0 && pred) {
            predictionsObj[index.toString()] = pred;
          }
        });
      } else {
        Object.assign(predictionsObj, pick.predictions);
      }
      
      // Add this week's picks to the player
      picksObject[pick.playerCode].picks[pick.week] = predictionsObj;
    }
  });
  
  // STEP 2: Convert actualScores arrays to objects
  const actualScoresObj = {};
  
  Object.keys(actualScores).forEach(week => {
    if (Array.isArray(actualScores[week])) {
      const weekObj = {};
      actualScores[week].forEach((score, index) => {
        if (index > 0 && score) {
          weekObj[index.toString()] = score;
        }
      });
      actualScoresObj[week] = weekObj;
    } else {
      actualScoresObj[week] = actualScores[week];
    }
  });
  
  console.log('📊 Converted picks:', Object.keys(picksObject).length, 'players');
  console.log('📊 Converted scores:', Object.keys(actualScoresObj));
  
  // STEP 3: Run all calculations
  const results = {
    week1: {
      prize1: calculateWeekPrize1(picksObject, actualScoresObj, 'wildcard'),
      prize2: calculateWeekPrize2(picksObject, actualScoresObj, 'wildcard')
    },
    week2: {
      prize1: calculateWeekPrize1(picksObject, actualScoresObj, 'divisional'),
      prize2: calculateWeekPrize2(picksObject, actualScoresObj, 'divisional')
    },
    week3: {
      prize1: calculateWeekPrize1(picksObject, actualScoresObj, 'conference'),
      prize2: calculateWeekPrize2(picksObject, actualScoresObj, 'conference')
    },
    week4: {
      prize1: calculateWeek4Prize1(picksObject, actualScoresObj),
      prize2: calculateWeek4Prize2(picksObject, actualScoresObj)
    },
    grandPrize: {
      prize1: calculateGrandPrize1(picksObject, actualScoresObj),
      prize2: calculateGrandPrize2(picksObject, actualScoresObj)
    }
  };
  
  console.log('✅ All calculations complete!');
  console.log('📊 Results:', results);
  
  return results;
};
