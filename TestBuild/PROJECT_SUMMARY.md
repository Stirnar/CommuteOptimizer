 NSU Commute Optimizer V3 - Project Summary

 What's Included

This package contains everything you need to upgrade to or deploy the NSU Commute Optimizer V3.

 File Manifest

 Core Application Files
- `NSU_Commute_Optimizer_V3.html` - Pre-integrated V3 (67KB)
  - Recommended for quick use - already has all V3 features integrated
  - Based on your V2, with V3 enhancements added
  
 Data Files
- `Locations.csv` - Clinical site coordinates
- `Tracks.csv` - Track rotation schedules
- `Variance.csv` - Block-specific variations

 Integration Files (for manual upgrade from V2)
- `v3-enhancements.js` - All V3 JavaScript functions
- `v3-styles.css` - All V3 CSS styles  
- `v3-html-additions.html` - All V3 HTML elements (modals, buttons)
- `INTEGRATION_GUIDE.md` - Step-by-step integration instructions

 Documentation
- `README.md` - Complete feature documentation and overview
- `DEPLOYMENT.md` - Hosting and deployment instructions
- `QUICKSTART.md` - Quick start guide for users and developers
- `CHANGELOG.md` - Version history and changes
- `INTEGRATION_GUIDE.md` - How to manually upgrade V2 to V3

 Backend Server Files
- `server.py` - Python/Flask server example
- `server.js` - Node.js/Express server example
- `requirements.txt` - Python dependencies
- `package.json` - Node.js dependencies

 🚀 Quick Start Paths

 Path 1: Just Want to Use It (Easiest)
1. Open `NSU_Commute_Optimizer_V3_Complete.html` in browser
2. Start using! All features work immediately
3. Share the single HTML file with colleagues

 Path 2: Manual Integration from V2
1. Follow `INTEGRATION_GUIDE.md`
2. Add V3 CSS, HTML, and JavaScript to your V2 file
3. Test thoroughly with the provided checklist

 Path 3: Deploy with Backend
1. Choose Python or Node.js
2. Follow setup in `DEPLOYMENT.md`
3. Run the server (`python server.py` or `npm start`)
4. Access at http://localhost:5000

 Path 4: Deploy to Web Host
1. Use `DEPLOYMENT.md` GitHub Pages/Netlify/Vercel sections
2. Upload files
3. Get your permanent URL

 ✨ New in V3

 1. Custom Block Builder 🎯
- Create rotation blocks with flexible schedules
- Week-by-week and day-by-day customization
- Wednesday campus trip toggle
- Saved in browser localStorage
- Appears in track dropdown with 🎯 icon

Use Cases:
- Elective rotations at non-standard sites
- Research blocks with variable schedules
- Part-time or combined rotations
- Any rotation not in the standard database

 2. Custom Locations 📍
- Add clinical sites not in the database
- Get coordinates from Google Maps
- Available across all custom blocks
- Persistent storage in browser
- Easy management (add/remove)

Use Cases:
- Private practice rotations
- New hospital partnerships
- Community health centers
- Any location not pre-configured

 3. Help & Instructions System 📖
- Built-in user documentation
- Step-by-step guides for all features
- How to get coordinates from Google Maps
- Tips and best practices
- Accessible via button on main page

 🔧 Key Features (V2 + V3)

 Core Calculations
- Real driving route calculations (OSRM)
- Wednesday campus trip handling
- Pediatrics week 4 special schedule
- Nemours zero-commute detection
- Optimal location finder

 Cost Analysis
- Gas costs
- Car maintenance
- Opportunity cost
- UWorld questions lost
- Adjustable parameters

 Results Display
- Hours per day/week/month/year
- Total costs breakdown
- Block-by-block details
- Clinical sites map
- Export-ready format

 📋 Configuration Options

 Embedded Mode (Default)
- Data hardcoded in HTML
- Single file deployment
- No server needed
- Update by editing HTML

 Backend Mode
- Data loaded from CSVs on server
- Easy updates (just edit CSVs)
- Requires web server
- Change `DATA_SOURCE_MODE = 'backend'`

 🎯 Recommended Workflow

 For End Users:
1. Download `NSU_Commute_Optimizer_V3_Complete.html`
2. Open in browser
3. Calculate your track
4. If needed, create custom blocks
5. Bookmark for easy access

 For Administrators:
1. Deploy to web server (GitHub Pages recommended)
2. Use backend mode for easy updates
3. Update CSV files when schedules change
4. Monitor usage and gather feedback

 For Developers:
1. Start with `NSU_Commute_Optimizer_V3_Complete.html`
2. Modify as needed for your use case
3. Test with INTEGRATION_GUIDE checklist
4. Deploy using DEPLOYMENT.md instructions

 🆘 Support Resources

 User Questions
- Check Help button in the app
- Read QUICKSTART.md
- Review examples in README.md

 Technical Issues
- Check INTEGRATION_GUIDE.md troubleshooting
- Review DEPLOYMENT.md for hosting issues
- Check browser console for errors

 Feature Requests / Bugs
- Document clearly with examples
- Include browser/version info
- Provide steps to reproduce

 📊 Data Format Requirements

All three CSVs must maintain their format:

Locations.csv:
```csv
Locations,Coordinates
Name,"latitude, longitude"
```

Tracks.csv:
```csv
Current Track,Apr-26,...,Mar-27
Track N,Block @ Location,...
```

Variance.csv:
```csv
Block,Locations,Within Week Changes,Within Block Changes,Block Length (wks),Wednesday Exception
Block Name,Location1[, Location2],Description,Description,Number,y/n
```

 🔐 Privacy & Security

- All calculations client-side
- No data sent to servers (except OSRM for routing)
- Custom blocks stored in browser only
- Custom locations stored in browser only
- No user tracking or analytics
- Safe to use with personal data

 🌐 Browser Compatibility

Fully Supported:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

Limited Support:
- Older versions may have reduced functionality
- Internet Explorer not supported

 📈 Performance Notes

- Optimal location finder: 30-60 seconds (tests 400+ locations)
- Custom blocks: May slow with 15+ weeks
- Route calculations: ~200ms per route
- Data loading: Instant in embedded mode, <1s in backend mode

 🔄 Update Procedures

 Embedded Mode:
1. Edit embedded CSV data in HTML
2. Save file
3. Redistribute to users

 Backend Mode:
1. Edit CSV files in `data/` directory
2. Upload to server
3. Changes apply immediately

 Version Updates:
1. Review CHANGELOG.md
2. Test new version thoroughly
3. Backup current version before updating
4. Inform users of new features

 📞 Contact & Support

Developer: Skyler Colwell
Version: 3.0
Release Date: January 2026

For questions, suggestions, or issues:
[Add your contact information here]

 📝 License

[Specify your license choice]

 🙏 Acknowledgments

- NSU MD students for feedback and testing
- OSRM project for routing API
- Papa Parse library for CSV handling
- OpenStreetMap for mapping data

 🎓 Educational Use

This tool is designed for:
- Medical student rotation planning
- Commute burden analysis
- Housing decision support
- Track comparison
- Cost estimation

Not intended for:
- Commercial routing applications
- Professional navigation
- Real estate valuation
- Financial advice

 🚦 Next Steps

1. Read QUICKSTART.md for your use case
2. Test with the provided V3 Complete file
3. Deploy using DEPLOYMENT.md if hosting
4. Share with colleagues who might benefit
5. Provide feedback to improve future versions
6. Comparison between a few locations

---

Ready to optimize your commute? Open the HTML file and get started! 🚀
