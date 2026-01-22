# Deployment Guide for NSU Commute Optimizer V3

## Quick Start Options

### Option 1: Single HTML File (Easiest)
**Best for: Sharing with colleagues, personal use, no server needed**

1. Use the `index.html` file provided
2. Open directly in any web browser
3. Share via email, USB, or cloud storage
4. No installation required

**Pros:**
- Zero setup
- Works offline after first load
- Portable
- No hosting costs

**Cons:**
- To update data, must edit HTML file
- Larger file size (~150KB)

---

### Option 2: Static Website Hosting (Recommended)
**Best for: Public access, easy updates, professional deployment**

#### GitHub Pages (Free)
1. Create GitHub repository
2. Upload all files:
   ```
   nsu-optimizer-v3/
   ├── index.html
   ├── Locations.csv
   ├── Tracks.csv
   └── Variance.csv
   ```
3. Enable GitHub Pages in repository settings
4. Access at: `https://yourusername.github.io/nsu-optimizer`

#### Netlify (Free)
1. Create account at netlify.com
2. Drag and drop folder
3. Automatic deployment
4. Custom domain available

#### Vercel (Free)
1. Create account at vercel.com
2. Import from GitHub or upload files
3. Automatic deployments
4. Great performance

---

### Option 3: Traditional Web Hosting
**Best for: Existing website, full control**

#### Requirements
- Web server (Apache, Nginx, or any static file server)
- HTTPS recommended (for modern browser features)

#### Setup Steps
1. Upload files to web server
2. Ensure CSVs are accessible at `/api/` path
3. Update `DATA_SOURCE_MODE` in HTML to `'backend'`
4. Set correct `BACKEND_URL`

---

## Switching Between Embedded and Backend Modes

### Current Mode: Embedded (Default)
Data is hardcoded in the HTML file.

```javascript
const DATA_SOURCE_MODE = 'embedded';
```

### Switching to Backend Mode

1. Open `index.html` in text editor
2. Find line ~620 (in script section):
   ```javascript
   const DATA_SOURCE_MODE = 'embedded'; // Change this
   const BACKEND_URL = '/api'; // And this
   ```
3. Change to:
   ```javascript
   const DATA_SOURCE_MODE = 'backend';
   const BACKEND_URL = '/api'; // Or full URL: 'https://yourdomain.com/api'
   ```
4. Ensure CSV files are accessible at the backend URL

---

## Updating Data

### Embedded Mode
**When to do this:** After track assignments change, new locations added, schedule updates

**Steps:**
1. Open `index.html` in text editor (VS Code, Sublime, Notepad++)
2. Find these sections (around lines 650-800):
   ```javascript
   const LOCATIONS_CSV = `...`;
   const TRACKS_CSV = `...`;
   const VARIANCE_CSV = `...`;
   ```
3. Update the data inside the backticks
4. Save file
5. Test by opening in browser

**Tips:**
- Keep CSV format exactly the same
- Check for proper quotes and commas
- Test with one change at a time

### Backend Mode
**When to do this:** Same as above, but much easier!

**Steps:**
1. Edit `Locations.csv`, `Tracks.csv`, or `Variance.csv`
2. Upload to server
3. Changes take effect immediately
4. No HTML changes needed

---

## Backend Server Setup Examples

### Python Flask Server

**Install:**
```bash
pip install flask flask-cors
```

**Server code** (`server.py`):
```python
from flask import Flask, send_from_directory
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app)  # Allow cross-origin requests

# Serve CSV files
@app.route('/api/<path:filename>')
def serve_csv(filename):
    return send_from_directory('data', filename)

# Serve HTML
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
```

**Run:**
```bash
python server.py
```

**Access:** http://localhost:5000

---

### Node.js Express Server

**Install:**
```bash
npm init -y
npm install express cors
```

**Server code** (`server.js`):
```javascript
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 5000;

// Enable CORS
app.use(cors());

// Serve CSV files from 'data' directory
app.use('/api', express.static(path.join(__dirname, 'data')));

// Serve HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
```

**Run:**
```bash
node server.js
```

---

### PHP Simple Server

**Structure:**
```
public/
├── index.html
├── api/
│   ├── Locations.csv
│   ├── Tracks.csv
│   └── Variance.csv
```

**Run:**
```bash
cd public
php -S localhost:8000
```

That's it! PHP serves static files automatically.

---

### Nginx Configuration

**Config file** (`/etc/nginx/sites-available/nsu-optimizer`):
```nginx
server {
    listen 80;
    server_name nsu-optimizer.yourdomain.com;
    
    root /var/www/nsu-optimizer;
    index index.html;
    
    location / {
        try_files $uri $uri/ =404;
    }
    
    location /api/ {
        alias /var/www/nsu-optimizer/data/;
        add_header Access-Control-Allow-Origin *;
    }
}
```

---

## Testing Your Deployment

### Checklist
- [ ] HTML loads in browser
- [ ] No console errors (F12 → Console tab)
- [ ] Track dropdown populates
- [ ] Can enter home coordinates
- [ ] Calculate button works
- [ ] Results display correctly
- [ ] Custom block builder opens
- [ ] Can add custom locations
- [ ] Help modal opens
- [ ] Cost settings modal works

### Common Issues

**Issue:** Track dropdown is empty
- **Fix:** Check CSV loading in Network tab (F12)
- **Fix:** Verify CSV files are accessible
- **Fix:** Check console for parse errors

**Issue:** CORS error in console
- **Fix:** Add CORS headers to server
- **Fix:** Use same domain for HTML and CSVs
- **Fix:** Use backend mode if on different domains

**Issue:** Results not calculating
- **Fix:** Check console for routing errors
- **Fix:** Test with simple track first
- **Fix:** Verify coordinates format

---

## Security Considerations

### For Public Deployment
1. **HTTPS:** Always use HTTPS for production
2. **Input Validation:** Application validates all user inputs
3. **Rate Limiting:** Consider rate limiting OSRM requests
4. **CSP Headers:** Add Content Security Policy headers
5. **Data Privacy:** No personal data stored on servers

### Recommended Headers
```
Content-Security-Policy: default-src 'self' https://router.project-osrm.org https://unpkg.com; script-src 'self' 'unsafe-inline' https://unpkg.com; style-src 'self' 'unsafe-inline';
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
```

---

## Monitoring and Maintenance

### What to Monitor
- CSV file updates (track changes)
- User feedback on custom blocks
- OSRM API availability
- Browser compatibility issues

### Regular Maintenance
- **Weekly:** Check for track schedule changes
- **Monthly:** Update location database if new sites added
- **Quarterly:** Review and update cost parameters
- **Annually:** Check browser compatibility

---

## Backup and Version Control

### Using Git
```bash
# Initialize repository
git init
git add .
git commit -m "Initial commit"

# After updates
git add Locations.csv Tracks.csv Variance.csv
git commit -m "Updated track schedules for Spring 2026"
git push
```

### Manual Backups
1. Keep dated copies of CSV files
2. Name format: `Tracks_2026-01-21.csv`
3. Store in separate backup location
4. Document changes in CHANGELOG.md

---

## Scaling Considerations

### If Usage Grows
1. **Caching:** Add CDN for static files
2. **API:** Consider your own routing API
3. **Database:** Move from CSV to database
4. **Analytics:** Add usage tracking
5. **Authentication:** Add user accounts for saved data

### Performance Optimization
- Minify HTML/CSS/JS
- Compress CSV files
- Use CDN for libraries
- Enable gzip compression
- Add service worker for offline use

---

## Support and Documentation

### For Users
- Point them to Help & Instructions button in app
- Provide README.md
- Create video tutorial (optional)

### For Maintainers
- Document CSV format requirements
- Keep update procedures documented
- Maintain changelog
- Test after every data update

---

## Next Steps After Deployment

1. **Test Thoroughly:** Test all features with real data
2. **Gather Feedback:** Get feedback from initial users
3. **Document Issues:** Keep list of known issues
4. **Plan Updates:** Schedule regular data updates
5. **Monitor Usage:** Track which features are used most

---

## Getting Help

If you encounter issues:
1. Check browser console (F12)
2. Verify CSV file formats
3. Test with embedded mode first
4. Check network requests in DevTools
5. Consult README.md troubleshooting section

For development help:
- HTML/CSS/JavaScript: MDN Web Docs
- Papa Parse: https://www.papaparse.com/docs
- OSRM API: https://project-osrm.org/docs/v5.5.1/api/

---

## Success Metrics

Track these to measure success:
- Number of active users
- Custom blocks created
- Calculate button clicks
- Help modal views
- Average time spent in app
- User feedback/ratings

---

Good luck with your deployment! 🚀
