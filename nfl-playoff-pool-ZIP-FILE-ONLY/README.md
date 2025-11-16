# 🏈 NFL Playoff Pool 2025

A free, web-based NFL playoff pool where players can submit their score predictions and see everyone else's picks in real-time!

## ✨ Features

- ✅ Submit score predictions for all playoff games
- ✅ View all players' picks in real-time
- ✅ Organized by playoff week (Wild Card, Divisional, Conference, Super Bowl)
- ✅ Mobile-friendly design
- ✅ 100% FREE - hosted on GitHub Pages
- ✅ Data stored in Firebase (free tier)

---

## 🚀 Quick Setup Guide (15 minutes)

### Step 1: Set up Firebase (FREE Database)

1. **Go to [Firebase Console](https://console.firebase.google.com/)**
   
2. **Click "Add project"**
   - Enter a project name (e.g., "nfl-playoff-pool")
   - Disable Google Analytics (not needed)
   - Click "Create project"

3. **Create a Realtime Database**
   - In the left sidebar, click "Build" → "Realtime Database"
   - Click "Create Database"
   - Choose location (United States)
   - **Start in TEST MODE** (we'll secure it later)
   - Click "Enable"

4. **Get your Firebase configuration**
   - Click the gear icon ⚙️ next to "Project Overview"
   - Click "Project settings"
   - Scroll down to "Your apps" section
   - Click the web icon `</>`
   - Register your app with a nickname (e.g., "playoff-pool")
   - Click "Register app"
   - **COPY** the `firebaseConfig` object (you'll need this!)

   It looks like this:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSyC...",
     authDomain: "your-project.firebaseapp.com",
     databaseURL: "https://your-project-default-rtdb.firebaseio.com",
     projectId: "your-project",
     storageBucket: "your-project.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abc123"
   };
   ```

5. **Set Database Rules** (Important!)
   - Go back to "Realtime Database" in Firebase
   - Click the "Rules" tab
   - Replace the rules with this:
   ```json
   {
     "rules": {
       "picks": {
         ".read": true,
         ".write": true
       }
     }
   }
   ```
   - Click "Publish"
   
   ⚠️ **Note**: These rules allow anyone to read and write. For production, you may want to add authentication.

---

### Step 2: Configure Your App

1. **Open `src/App.jsx`**

2. **Replace the Firebase config** (around line 7) with YOUR config from Step 1:
   ```javascript
   const firebaseConfig = {
     apiKey: "YOUR_API_KEY",           // ← Paste your values here
     authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
     databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
     projectId: "YOUR_PROJECT_ID",
     storageBucket: "YOUR_PROJECT_ID.appspot.com",
     messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
     appId: "YOUR_APP_ID"
   };
   ```

3. **Save the file**

---

### Step 3: Test Locally

1. **Install Node.js** (if you haven't already)
   - Download from [nodejs.org](https://nodejs.org/)
   - Install the LTS version

2. **Open Terminal/Command Prompt** in this folder

3. **Install dependencies:**
   ```bash
   npm install
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```

5. **Open your browser** to `http://localhost:5173`

6. **Test it!**
   - Enter your name
   - Make some predictions
   - Submit
   - You should see your picks appear in the table below!

---

### Step 4: Deploy to GitHub Pages (FREE Hosting!)

1. **Create a GitHub Account** (if you don't have one)
   - Go to [github.com](https://github.com)
   - Sign up for free

2. **Create a New Repository**
   - Click the "+" icon → "New repository"
   - Name it: `nfl-playoff-pool` (or whatever you want)
   - Make it **Public**
   - **DO NOT** initialize with README
   - Click "Create repository"

3. **Update `vite.config.js`**
   - Open `vite.config.js`
   - Change `base: '/nfl-playoff-pool/'` to match YOUR repo name
   - Example: if your repo is named `playoff-picks`, use `base: '/playoff-picks/'`

4. **Push Your Code to GitHub**
   
   In Terminal/Command Prompt, run these commands:
   
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/nfl-playoff-pool.git
   git push -u origin main
   ```
   
   (Replace `YOUR_USERNAME` with your GitHub username)

5. **Deploy to GitHub Pages**
   ```bash
   npm run deploy
   ```

6. **Enable GitHub Pages**
   - Go to your repo on GitHub
   - Click "Settings" → "Pages"
   - Under "Source", select `gh-pages` branch
   - Click "Save"

7. **Your Site is LIVE! 🎉**
   - URL: `https://YOUR_USERNAME.github.io/nfl-playoff-pool/`
   - Share this link with your pool members!

---

## 🔄 Making Updates

When you want to update team names or make changes:

1. **Edit the files** (e.g., update team names in `App.jsx`)
2. **Test locally:**
   ```bash
   npm run dev
   ```
3. **Deploy updates:**
   ```bash
   git add .
   git commit -m "Updated team names"
   git push origin main
   npm run deploy
   ```

---

## 📝 Updating Team Names

Before the playoffs start, update the team names in `src/App.jsx`:

Find the `PLAYOFF_WEEKS` object (around line 20) and replace the placeholder teams with actual teams:

```javascript
const PLAYOFF_WEEKS = {
  wildcard: {
    name: "Wild Card Round",
    games: [
      { id: 1, team1: "Steelers", team2: "Bills" },  // ← Update these
      { id: 2, team1: "Chargers", team2: "Ravens" },
      // ... etc
    ]
  },
  // ... other weeks
};
```

---

## 🎨 Customization

### Change Colors
Edit `src/App.css` to change the color scheme:
- Background gradient: lines 12-13
- Primary color: search for `#667eea`
- Success/submit button: search for `#4caf50`

### Add Scoring Rules
You can add point calculation logic in `App.jsx` to automatically score predictions against actual results!

---

## 💡 Tips

- **Share the link** with your pool members
- Players can update their picks by submitting again (with same name)
- You can export data from Firebase console if needed
- Mobile-friendly - works great on phones!

---

## ⚠️ Troubleshooting

**Picks aren't showing up?**
- Check Firebase console to verify data is being written
- Check browser console for errors (F12)
- Verify Firebase config is correct in `App.jsx`

**Can't deploy to GitHub Pages?**
- Make sure `base` in `vite.config.js` matches your repo name
- Run `npm install` if you get errors
- Check that `gh-pages` branch was created

**Database rules error?**
- Go to Firebase → Realtime Database → Rules
- Make sure `.read` and `.write` are both `true`

---

## 📞 Need Help?

- Check the Firebase docs: [firebase.google.com/docs](https://firebase.google.com/docs)
- GitHub Pages docs: [pages.github.com](https://pages.github.com)
- Open an issue on GitHub if you have problems!

---

## 🏆 Enjoy Your Pool!

Good luck to all participants! 🏈
