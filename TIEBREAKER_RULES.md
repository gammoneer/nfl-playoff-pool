# NFL Playoff Pool — Complete Tiebreaker & Perfect Score Rules
## Verified and coded as of March 2026

---

## OVERVIEW

- **Pool #1: Pick the Score** — 10 prizes (#1–#10)
- **Pool #2: Pick the Lines** — 5 prizes (#11–#15)
- **Perfect Score Bonus** — separate from all 15 prizes
- All tiebreaker rules are implemented in `winnerCalculations.js`
- Pool Manager codes filtered from ALL calculations: `["TEST01", "76BB89", "Z9Y8X7"]`

---

## TIMESTAMP TIEBREAKER RULE — CRITICAL

**`lastUpdated` is used — NOT the original submission timestamp.**

- Every time a player edits and re-saves their picks, their `lastUpdated` timestamp moves to NOW
- The player who submitted most recently (latest `lastUpdated`) LOSES the tiebreaker
- The player who submitted earliest and never edited WINS the tiebreaker
- **Editing your picks gives up your timestamp advantage**
- Each prize uses the timestamp for its SPECIFIC week only:
  - Week 1 prizes → Week 1 submission time
  - Week 2 prizes → Week 2 submission time
  - Week 3 prizes → Week 3 submission time
  - Week 4 prizes → Week 4 submission time
  - Grand prizes (#9, #10) → Week 4 (Super Bowl) submission time
  - Pool #2 weekly prizes → That specific week's Pool #2 submission time
  - Pool #2 grand prize → Week 4 (Super Bowl) Pool #2 submission time

---

## POOL #1: PICK THE SCORE — ALL 10 PRIZES

### Prize #1 — Week 1 (Wild Card): Most Correct Winners
**Full chain:** Most correct → Week 1 score diff → Submission timestamp → True tie (split)

1. **Most correct game winners** — player who correctly predicted the most winning teams
2. **Week 1 total score diff** — closest predicted combined score to actual combined score
3. **Earlier submission timestamp** (Week 1 `lastUpdated`) — earlier wins
4. **True tie** — prize split equally if still tied after all steps

---

### Prize #2 — Week 1 (Wild Card): Closest Total Points
**Full chain:** Week 1 diff → Submission timestamp → True tie (split)

1. **Week 1 total score diff** — closest predicted combined score to actual combined score
2. **Earlier submission timestamp** (Week 1 `lastUpdated`) — earlier wins
3. **True tie** — prize split equally if still tied

---

### Prize #3 — Week 2 (Divisional): Most Correct Winners
**Full chain:** Most correct → Week 2 diff → Week 1 diff → Submission timestamp → True tie (split)

1. **Most correct game winners** — Week 2 games
2. **Week 2 total score diff** — closest to actual Week 2 combined score
3. **Week 1 total score diff** — closest to actual Week 1 combined score
4. **Earlier submission timestamp** (Week 2 `lastUpdated`) — earlier wins
5. **True tie** — prize split equally

---

### Prize #4 — Week 2 (Divisional): Closest Total Points
**Full chain:** Week 2 diff → Week 1 diff → Submission timestamp → True tie (split)

1. **Week 2 total score diff**
2. **Week 1 total score diff**
3. **Earlier submission timestamp** (Week 2 `lastUpdated`) — earlier wins
4. **True tie** — prize split equally

---

### Prize #5 — Week 3 (Conference): Most Correct Winners
**Full chain:** Most correct → Week 3 diff → Week 2 diff → Week 1 diff → Submission timestamp → True tie (split)

1. **Most correct game winners** — Week 3 games
2. **Week 3 total score diff**
3. **Week 2 total score diff**
4. **Week 1 total score diff**
5. **Earlier submission timestamp** (Week 3 `lastUpdated`) — earlier wins
6. **True tie** — prize split equally

---

### Prize #6 — Week 3 (Conference): Closest Total Points
**Full chain:** Week 3 diff → Week 2 diff → Week 1 diff → Submission timestamp → True tie (split)

1. **Week 3 total score diff**
2. **Week 2 total score diff**
3. **Week 1 total score diff**
4. **Earlier submission timestamp** (Week 3 `lastUpdated`) — earlier wins
5. **True tie** — prize split equally

---

### Prize #7 — Week 4 (Super Bowl): Correct Super Bowl Winner
**Full chain:** Correct SB winner → Week 1 diff → Week 2 diff → Week 3 diff → Week 4 diff → Submission timestamp → True tie (split)

1. **Correctly predicted the Super Bowl winning team** — only eligible players proceed
2. If nobody picked correctly → prize awarded by tiebreaker to ALL players using steps below
3. **Week 1 total score diff**
4. **Week 2 total score diff**
5. **Week 3 total score diff**
6. **Week 4 (Super Bowl) total score diff**
7. **Earlier submission timestamp** (Week 4 `lastUpdated`) — earlier wins
8. **True tie** — prize split equally

---

### Prize #8 — Week 4 (Super Bowl): Closest Super Bowl Total
**Full chain:** Week 4 diff → Week 3 diff → Week 2 diff → Week 1 diff → Submission timestamp → True tie (split)

1. **Week 4 (Super Bowl) total score diff**
2. **Week 3 total score diff**
3. **Week 2 total score diff**
4. **Week 1 total score diff**
5. **Earlier submission timestamp** (Week 4 `lastUpdated`) — earlier wins
6. **True tie** — prize split equally

---

### Prize #9 — Grand Prize: Most Correct Winners (All 4 Weeks)
**Full chain:** Total correct → Grand total diff → Week 4 diff → Week 3 diff → Week 2 diff → Week 1 diff → Submission timestamp → True tie (split)

1. **Total correct game winners across all 4 weeks** (max 13 games: 6+4+2+1)
2. **Grand total diff** — closest predicted total across ALL games ALL weeks vs actual
3. **Week 4 total score diff**
4. **Week 3 total score diff**
5. **Week 2 total score diff**
6. **Week 1 total score diff**
7. **Earlier submission timestamp** (Week 4 `lastUpdated`) — earlier wins
8. **True tie** — prize split equally

---

### Prize #10 — Grand Prize: Closest Overall Total (All 4 Weeks)
**Full chain:** Grand total diff → Week 4 diff → Week 3 diff → Week 2 diff → Week 1 diff → Submission timestamp → True tie (split)

1. **Grand total diff** — closest predicted total across ALL games ALL weeks vs actual
2. **Week 4 total score diff**
3. **Week 3 total score diff**
4. **Week 2 total score diff**
5. **Week 1 total score diff**
6. **Earlier submission timestamp** (Week 4 `lastUpdated`) — earlier wins
7. **True tie** — prize split equally

---

## POOL #2: PICK THE LINES — ALL 5 PRIZES

### Scoring
- Correct Winner pick = **2 pts**
- Correct ATS pick = **3 pts**
- Correct O/U pick = **3 pts**
- Maximum per game = **8 pts**
- Maximum per week:
  - Wild Card (6 games) = **48 pts**
  - Divisional (4 games) = **32 pts**
  - Conference (2 games) = **16 pts**
  - Super Bowl (1 game) = **8 pts**

### Tiebreaker principle for Pool #2
**ALL Pool #2 tiebreakers are exhausted BEFORE going to Pool #1 tiebreakers.**

---

### Prize #11 — Pool #2 Week 1 (Wild Card): Most Points
**Full chain:** P2 Week 1 pts → Pool #1 Week 1 diff → Submission timestamp → True tie (split)

1. **Most Pool #2 points this week**
2. **Pool #1 Week 1 total score diff** (closest predicted combined score)
3. **Earlier submission timestamp** (Week 1 Pool #2 `lastUpdated`) — earlier wins
4. **True tie** — prize split equally

---

### Prize #12 — Pool #2 Week 2 (Divisional): Most Points
**Full chain:** P2 Week 2 pts → P2 Week 1 pts → Pool #1 Week 2 diff → Pool #1 Week 1 diff → Submission timestamp → True tie (split)

1. **Most Pool #2 points Week 2**
2. **Most Pool #2 points Week 1** (previous week)
3. **Pool #1 Week 2 total score diff**
4. **Pool #1 Week 1 total score diff**
5. **Earlier submission timestamp** (Week 2 Pool #2 `lastUpdated`) — earlier wins
6. **True tie** — prize split equally

---

### Prize #13 — Pool #2 Week 3 (Conference): Most Points
**Full chain:** P2 Week 3 pts → P2 Week 2 pts → P2 Week 1 pts → Pool #1 Week 3 diff → Pool #1 Week 2 diff → Pool #1 Week 1 diff → Submission timestamp → True tie (split)

1. **Most Pool #2 points Week 3**
2. **Most Pool #2 points Week 2**
3. **Most Pool #2 points Week 1**
4. **Pool #1 Week 3 total score diff**
5. **Pool #1 Week 2 total score diff**
6. **Pool #1 Week 1 total score diff**
7. **Earlier submission timestamp** (Week 3 Pool #2 `lastUpdated`) — earlier wins
8. **True tie** — prize split equally

---

### Prize #14 — Pool #2 Week 4 (Super Bowl): Most Points
**Full chain:** P2 Week 4 pts → P2 Week 3 pts → P2 Week 2 pts → P2 Week 1 pts → Pool #1 Week 4 diff → Pool #1 Week 3 diff → Pool #1 Week 2 diff → Pool #1 Week 1 diff → Submission timestamp → True tie (split)

1. **Most Pool #2 points Week 4**
2. **Most Pool #2 points Week 3**
3. **Most Pool #2 points Week 2**
4. **Most Pool #2 points Week 1**
5. **Pool #1 Week 4 (Super Bowl) total score diff**
6. **Pool #1 Week 3 total score diff**
7. **Pool #1 Week 2 total score diff**
8. **Pool #1 Week 1 total score diff**
9. **Earlier submission timestamp** (Week 4 Pool #2 `lastUpdated`) — earlier wins
10. **True tie** — prize split equally

---

### Prize #15 — Pool #2 Grand Prize: Most Cumulative Points (All 4 Weeks)
**Full chain:** Total P2 pts → P2 Week 4 pts → P2 Week 3 pts → P2 Week 2 pts → P2 Week 1 pts → Pool #1 grand total diff → Pool #1 Week 4 diff → Pool #1 Week 3 diff → Pool #1 Week 2 diff → Pool #1 Week 1 diff → Submission timestamp → True tie (split)

1. **Total Pool #2 points across all 4 weeks**
2. **Pool #2 Week 4 points** (individual week breakdown)
3. **Pool #2 Week 3 points**
4. **Pool #2 Week 2 points**
5. **Pool #2 Week 1 points**
6. **Pool #1 grand total diff** (sum of all predicted scores vs actual across all 4 weeks)
7. **Pool #1 Week 4 total score diff**
8. **Pool #1 Week 3 total score diff**
9. **Pool #1 Week 2 total score diff**
10. **Pool #1 Week 1 total score diff**
11. **Earlier submission timestamp** (Week 4 Pool #2 `lastUpdated`) — earlier wins
12. **True tie** — prize split equally

---

## PERFECT SCORE BONUS

### What counts as a perfect score
- A player predicts **both team scores exactly right** for a single game in **Pool #1 only**
- Example: Actual KC 27 — JAC 6, Player predicted KC 27 — JAC 6 → ✅ Perfect Score
- Pool #2 picks do NOT count toward Perfect Score bonus

### How many perfect scores are possible
- Wild Card: up to 6 per player (one per game) × number of players
- Divisional: up to 4 per player
- Conference: up to 2 per player
- Super Bowl: up to 1 per player
- A single player CAN hit multiple perfect scores in the same week and across the season

### The pot
- **10% of total entry fees** set aside as Perfect Score reserve
- Example: 54 players × $20 = $1,080 total → $108 Perfect Score pot
- The remaining 90% is split equally among the 15 regular prizes

### How it pays out
- Wait until ALL 4 weeks are fully complete
- Count every single perfect score hit by every player across all 4 weeks
- **Divide the pot equally** by total number of perfect score hits
- Each hit = one equal share — same player can win multiple shares
- Example: Player A hits 3 times, Player B hits 1 time, Player C hits 1 time = 5 total hits
  - $108 ÷ 5 = $21.60 per hit
  - Player A receives $64.80 (3 × $21.60)
  - Player B receives $21.60
  - Player C receives $21.60

### If nobody hits a perfect score all season
- The entire Perfect Score pot ($108) is returned to the main prize pool
- Split equally among all 15 regular prizes
- Each regular prize increases by $108 ÷ 15 = $7.20

### Perfect Score display
- Visible to ALL players during the season as games go final
- Shows player name, week, game number, teams, predicted score, actual score
- Updates live as ESPN marks games final
- Pool Manager can override (add or remove) any perfect score hit if app made an error

---

## TRUE TIE — WHEN IT APPLIES

A true tie only occurs if two or more players are still tied after ALL tiebreaker steps have been exhausted including the timestamp step. This is extremely unlikely given the number of tiebreaker levels.

**When a true tie is declared:**
- Prize money is split equally among all tied winners
- Displayed as "Winners: [Name] and [Name] — prize split equally"
- No further resolution — the tie stands

---

## GENERAL RULES

- Pool Manager codes are filtered from ALL prize calculations
- All calculations run automatically when ESPN marks games final
- Pool Manager can override any prize result — override is invisible to players
- Players see results immediately when all games in a week are final
- No manual publish step required — app handles everything automatically
- Tiebreaker rules apply to ALL prizes — there is always a winner (or true split)

---

*These rules are implemented in `winnerCalculations.js` and verified correct as of March 2026.*
*Pool Manager: Richard Biletski | App developed with Claude (Anthropic)*
