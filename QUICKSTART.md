Quick Start Guide

> License: Free for NSU students and personal use. See [LICENSE](LICENSE) for details.

For Users (No Installation)

Option 2: Use Online (if hosted)
1. Go to the hosted URL
2. Bookmark it for easy access

Using the Application

Basic Commute Calculation
1. Select your track from the dropdown
	- Or leave blank and just enter an address to find optimal tracks
2. (Optional) Enter your home address or coordinates
	- Or leave blank to find optimal location
3. Click "Calculate Commute Burden"
4. View your results

Getting Your Home Coordinates
1. Open Google Maps
2. Search for your address
3. Right-click on your location
4. Click the coordinates to copy them
5. Paste into the "Home Location" field

* Creating a Custom Block (planned future)
1. Click "Build Custom Block" button
2. Name your block (e.g., "My Cardiology Elective")
3. Add weeks using "+ Add Week"
4. For each week, add days and select locations
5. Check "Wednesday Campus Trips" if applicable
6. Click "Save Custom Block"
7. Your custom block now appears in the track dropdown

* Adding Custom Locations (planned future)
1. In Custom Block Builder, find "Custom Locations"
2. Enter location name (e.g., "Private Practice Dr. Smith")
3. Get coordinates from Google Maps
4. Enter as: latitude, longitude (e.g., 26.082, -80.249)
5. Click "Add Location"
6. Location is now available in all dropdowns

Viewing Help
Click the "How to Use" button anytime for detailed guidance.

---

For Developers/Admins

Note: If you're from another institution and want to use this commercially, please see [LICENSE](LICENSE) for commercial licensing information.

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

Update Data (Backend Mode)
1. Edit CSV files in `data/` directory
2. Upload to server
3. Rerun generate-optimal-data.js
4. Changes take effect immediately

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

Share Custom Block (planned future)
- Custom blocks saved in browser only
- To share: Recreate manually for now
- (Cloud sync coming in future version)

Reset Everything
If something goes wrong:
1. Open browser console (F12)
2. Run: `localStorage.clear()`
3. Refresh page
4. Everything resets to defaults

---

Questions? Check the full [README](README.md) or contact: skyler_colwell@yahoo.com