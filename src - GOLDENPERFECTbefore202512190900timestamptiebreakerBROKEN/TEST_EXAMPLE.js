// ============================================================================
// TEST EXAMPLE - How to Use winnerCalculations.js
// ============================================================================

import { calculateWeekPrize2 } from './winnerCalculations.js';

// ============================================================================
// EXAMPLE DATA (from your Firebase structure)
// ============================================================================

const exampleAllPicks = {
  "ABC123": {
    name: "Richard Biletski",
    picks: {
      wildcard: {
        "1": { team1: 30, team2: 27 },
        "2": { team1: 28, team2: 24 },
        "3": { team1: 21, team2: 20 },
        "4": { team1: 31, team2: 28 },
        "5": { team1: 27, team2: 24 },
        "6": { team1: 28, team2: 17 }
      }
    }
  },
  "DEF456": {
    name: "Neema Dadmand",
    picks: {
      wildcard: {
        "1": { team1: 24, team2: 21 },
        "2": { team1: 31, team2: 27 },
        "3": { team1: 24, team2: 17 },
        "4": { team1: 35, team2: 31 },
        "5": { team1: 21, team2: 17 },
        "6": { team1: 31, team2: 17 }
      }
    }
  },
  "GHI789": {
    name: "Bob Smith",
    picks: {
      wildcard: {
        "1": { team1: 27, team2: 24 },
        "2": { team1: 30, team2: 20 },
        "3": { team1: 21, team2: 17 },
        "4": { team1: 35, team2: 28 },
        "5": { team1: 24, team2: 21 },
        "6": { team1: 31, team2: 17 }
      }
    }
  }
};

const exampleActualScores = {
  wildcard: {
    "1": { team1: 27, team2: 24 }, // Total: 51
    "2": { team1: 30, team2: 20 }, // Total: 50
    "3": { team1: 21, team2: 17 }, // Total: 38
    "4": { team1: 35, team2: 28 }, // Total: 63
    "5": { team1: 24, team2: 21 }, // Total: 45
    "6": { team1: 31, team2: 17 }  // Total: 48
  }
  // Actual Week 1 Total: 295 points
};

// ============================================================================
// RUN THE CALCULATION
// ============================================================================

const result = calculateWeekPrize2(exampleAllPicks, exampleActualScores, 'wildcard');

console.log('Week 1 Prize #2 Result:', JSON.stringify(result, null, 2));

// ============================================================================
// EXPECTED OUTPUT:
// ============================================================================
/*
{
  "status": "calculated",
  "winner": "Bob Smith",
  "winnerCode": "GHI789",
  "actualTotal": 295,
  "predictedTotal": 293,
  "difference": 2,
  "tiebreakerUsed": false,
  "isTrueTie": false,
  "tiedPlayers": null,
  "allPlayerResults": [
    {
      "name": "Bob Smith",
      "code": "GHI789",
      "predictedTotal": 293,
      "difference": 2
    },
    {
      "name": "Richard Biletski",
      "code": "ABC123",
      "predictedTotal": 305,
      "difference": 10
    },
    {
      "name": "Neema Dadmand",
      "code": "DEF456",
      "predictedTotal": 296,
      "difference": 1
    }
  ]
}
*/

// ============================================================================
// HOW TO USE IN YOUR APP.JSX
// ============================================================================

/*
import { calculateWeekPrize2 } from './winnerCalculations.js';

// In your component or useEffect:
const week1Prize2 = calculateWeekPrize2(allPicks, actualScores, 'wildcard');

// Save to Firebase:
const winnerRef = ref(database, 'calculatedWinners/week1/prize2');
set(winnerRef, week1Prize2);

// Display to users:
if (week1Prize2.status === 'calculated') {
  console.log(`Winner: ${week1Prize2.winner}`);
  console.log(`Off by: ${week1Prize2.difference} points`);
  
  if (week1Prize2.isTrueTie) {
    console.log(`TRUE TIE! Winners: ${week1Prize2.winner.join(', ')}`);
  }
}
*/
