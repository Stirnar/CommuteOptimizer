NSU Commute Optimizer V3

Overview
Enhanced version of the Medical Student Commute Optimizer with three major new features:
1. Custom Block Builder - Create flexible rotation schedules with varying locations
2. Backend-Ready Architecture - Easily deployable with dynamic CSV updates
3. Help & Instructions System - User-friendly guides for all features

New Features

 1. Custom Block Builder

What it does:
- Create custom rotation blocks with flexible weekly schedules
- Define different locations for different days of the week
- Add custom locations not in the standard database
- Specify week-by-week variations

How to use:
1. Click "Build Custom Block" button on main page
2. Enter a name for your custom block
3. Add weeks and days as needed
4. Select locations for each day
5. Toggle Wednesday campus trips if applicable
6. Save - it will appear in your track dropdown

Example Use Cases:
- Elective rotations at non-standard sites
- Research blocks with variable schedules
- Part-time rotations with specific day patterns
- Combined rotations at multiple sites

 2. Custom Locations System

Adding Custom Locations:
1. In Custom Block Builder, find "Custom Locations" section
2. Get coordinates from Google Maps:
   - Search for location in Google Maps
   - Right-click on the location
   - Click the coordinates to copy them
3. Enter location name and coordinates
4. Click "Add Location"
5. Location is now available in all dropdowns

Features:
- Persistent storage (saved in browser localStorage)
- Can be used across multiple custom blocks
- Easy removal with delete button
- Displays coordinates for verification

 3. Help & Instructions Modal

Access:
- Click "Help & Instructions" button on main page

Contents:
- Getting home coordinates from Google Maps
- Using the Custom Block Builder
- Adding custom locations
- Tips for optimal use

Deployment Guide

 Option 1: Static Hosting (Current Mode)
The application currently works in "embedded" mode with data hardcoded in the HTML file.

Pros:
- Single file deployment
- No server required
- Works anywhere (email, USB drive, etc.)

Cons:
- Must rebuild HTML to update data
- Larger file size

 Option 2: Backend Hosting (Recommended for Production)

 Step 1: Prepare Backend
1. Set up a simple web server (Node.js, Python, PHP, etc.)
2. Place CSV files in a `/api` directory
3. Enable CORS if needed
4. Serve CSV files at:
   - `/api/locations.csv`
   - `/api/tracks.csv`
   - `/api/variance.csv`

 Step 2: Configure Application
In the HTML file, change this line:
```javascript
const DATA_SOURCE_MODE = 'backend'; // Change from 'embedded' to 'backend'
const BACKEND_URL = '/api'; // Or your full backend URL
```

 Step 3: Deploy
Upload all files to your web server.

 Simple Backend Examples

 Python (Flask)
```python
from flask import Flask, send_file
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route('/api/<filename>')
def serve_csv(filename):
    return send_file(f'data/{filename}', mimetype='text/csv')

if __name__ == '__main__':
    app.run(port=5000)
```

 Node.js (Express)
```javascript
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use('/api', express.static('data'));

app.listen(5000, () => {
    console.log('Server running on port 5000');
});
```

 Static File Server (Simplest)
Just place CSVs in a folder and use any static file server:
```bash
 Python
python -m http.server 8000

 Node
npx serve

 PHP
php -S localhost:8000
```

 Updating Data

 Embedded Mode
1. Open HTML file in text editor
2. Find the embedded CSV data (search for `LOCATIONS_CSV`, `TRACKS_CSV`, `VARIANCE_CSV`)
3. Update the data
4. Save file

 Backend Mode
1. Simply update the CSV files on your server
2. No code changes needed
3. Changes take effect immediately

 File Structure

```
nsu-optimizer-v3/
├── index.html               Main application
├── Locations.csv            Location coordinates
├── Tracks.csv              Track schedules
├── Variance.csv            Block variations
└── README.md               This file
```

 Data Format

 Locations.csv
```csv
Locations,Coordinates
Kendall,"25.731069957230403, -80.38628700352972"
```

 Tracks.csv
```csv
Current Track,Apr-26 (03/30/26-04/24/26),May-26 (04/27/26-05/22/26),...
Track 1,Radiology Clerkship @ HCA Florida Kendall Hospital,...
```

 Variance.csv
```csv
Block,Locations,Within Week Changes,Within Block Changes,Block Length (wks),Wednesday Exception
Surgery Clerkship @ HCA Florida Kendall Hospital,Kendall,N/A,N/A,8,n
```

 Browser Compatibility
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

 Storage
- Custom blocks: Stored in localStorage
- Custom locations: Stored in localStorage
- Data persists between sessions
- Clear browser data to reset

 Privacy
- All calculations done client-side
- No data sent to external servers (except OSRM routing)
- Location data never leaves your browser

 Technical Details

 Routing
- Uses OpenStreetMap OSRM routing service
- Real driving routes and times
- Includes traffic patterns
- Fallback to straight-line distance if API fails

 Optimization
- Grid search algorithm for optimal location
- Tests 441 candidate locations
- Refines top 5 candidates with real routing
- Typical runtime: 30-60 seconds

 Cost Calculations
- Gas: Total miles ÷ MPG × Price per gallon
- Maintenance: Total miles × $0.0986/mile (AAA average)
- Opportunity cost: Hours × Resident hourly rate
- UWorld: Hours × 60 ÷ 1.5 mins/question

 Troubleshooting

 "Error loading data"
- Check internet connection
- Verify CSV files are accessible
- Check browser console for errors

 Custom blocks not saving
- Check browser localStorage is enabled
- Try different browser
- Clear and re-add blocks

 Routing errors
- OSRM service may be temporarily down
- Uses fallback calculations automatically
- Refresh page and try again

 Coordinates not working
- Ensure format is: latitude, longitude
- No extra spaces or characters
- Use Google Maps format

 Future Enhancements
- Export results to PDF
- Compare multiple tracks side-by-side
- Historical data tracking
- Mobile app version
- Carpooling optimization

 Support
For questions or issues:
- Check Help & Instructions in app
- Review this README
- Contact: [Your contact info]

 Credits
Developed by Skyler Colwell
Version 3.0 - January 2026

 License
[Your chosen license]
