Quick Start Guide

For Users (No Installation)

Option 1: Download and Open
1. Download `index.html`
2. Double-click to open in browser
3. Start using immediately!

Option 2: Use Online (if hosted)
1. Go to the hosted URL
2. Bookmark it for easy access

Using the Application

Basic Commute Calculation
1. Select your track from the dropdown
2. (Optional) Enter your home coordinates
   - Or leave blank to find optimal location
3. Click "Calculate Commute Burden"
4. View your results!

Getting Your Home Coordinates
1. Open Google Maps
2. Search for your address
3. Right-click on your location
4. Click the coordinates to copy them
5. Paste into the "Home Location" field

Creating a Custom Block
1. Click "Build Custom Block" button
2. Name your block (e.g., "My Cardiology Elective")
3. Add weeks using "+ Add Week"
4. For each week, add days and select locations
5. Check "Wednesday Campus Trips" if applicable
6. Click "Save Custom Block"
7. Your custom block now appears in the track dropdown with a 🎯 icon

Adding Custom Locations
1. In Custom Block Builder, find "Custom Locations"
2. Enter location name (e.g., "Private Practice Dr. Smith")
3. Get coordinates from Google Maps
4. Enter as: latitude, longitude (e.g., 26.082, -80.249)
5. Click "Add Location"
6. Location is now available in all dropdowns

Viewing Help
Click the "Help & Instructions" button anytime for detailed guidance.

---

For Developers/Admins

Quick Deploy (No Server)
1. Open `index.html` in text editor
2. Verify `DATA_SOURCE_MODE = 'embedded'`
3. Share the file - that's it!

Deploy with Backend (Python)
```bash
Install dependencies
pip install -r requirements.txt

Create data directory and add CSVs
mkdir data
cp .csv data/

Run server
python server.py

Open browser to http://localhost:5000
```

Deploy with Backend (Node.js)
```bash
Install dependencies
npm install

Create data directory and add CSVs
mkdir data
cp .csv data/

Run server
npm start

Open browser to http://localhost:5000
```

Deploy to GitHub Pages
```bash
Push to GitHub
git init
git add .
git commit -m "Initial commit"
git remote add origin [your-repo-url]
git push -u origin main

Enable GitHub Pages in repository settings
Select "main" branch
Your site will be at: https://[username].github.io/[repo-name]
```

Deploy to Netlify
1. Drag and drop the `nsu-optimizer-v3` folder to netlify.com
2. Done! You get a URL automatically

pdate Data (Embedded Mode)
1. Open `index.html` in text editor
2. Find `LOCATIONS_CSV`, `TRACKS_CSV`, `VARIANCE_CSV` sections
3. Update the data
4. Save and redistribute

Update Data (Backend Mode)
1. Edit CSV files in `data/` directory
2. Upload to server
3. Changes take effect immediately

---

Common Tasks

Change Cost Parameters
1. Open the application
2. Click "View Data Sources & Adjust Cost Parameters"
3. Update values (gas price, MPG, etc.)
4. Changes apply immediately to current calculation
5. Recalculate to see updated costs

Compare Multiple Tracks
1. Calculate first track
2. Take screenshot or note the results
3. Select different track
4. Calculate again
5. Compare results side by side

Export Results
- Take screenshot of results
- Or copy values manually
- (PDF export coming in future version)

Share Custom Block
- Custom blocks saved in browser only
- To share: Recreate manually for now
- (Cloud sync coming in future version)

Reset Everything
If something goes wrong:
1. Open browser console (F12)
2. Run: `localStorage.clear()`
3. Refresh page
4. Everything resets to defaults