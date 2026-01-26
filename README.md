NSU Commute Optimizer V2.4

Overview

Enhanced version of the Medical Student Commute Optimizer with three major new features:
1. Custom Block Builder - Create flexible rotation schedules with varying locations
2. Backend-Ready Architecture - Easily deployable with dynamic CSV updates
3. Help & Instructions System - User-friendly guides for all features

License & Usage

For NSU MD Medical Students: This software is free for you to use forever, for any purpose. No restrictions.

For Everyone Else: Free for personal and educational use. Commercial use requires permission.

This project is licensed under a custom non-commercial license. See the [LICENSE](LICENSE) file for full details.

What This Means:
- NSU MD students: Use freely, even after graduation
- Other students/researchers: Use for personal learning and education
- Medical schools: Contact for commercial licensing
- Companies: Cannot resell or provide as paid service without permission

Commercial Inquiries: skyler_colwell@yahoo.com

New Features

1. Custom Block Builder (planned future)

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

2. Custom Locations System (planned future)

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
- Click "How to Use" button on main page

Contents:
- Getting home coordinates from Google Maps
- Using the Custom Block Builder
- Adding custom locations
- Tips for optimal use

File Structure

```
nsu-optimizer-v3/
├── index.html               Main application
├── LICENSE                  License file
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
- No tracking or analytics

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
- Contact: skyler_colwell@yahoo.com

Credits
Developed by Skyler Colwell  
Version 2.4 - January 2026

---

Note: This tool was created to help NSU MD medical students make informed housing decisions and advocate for equitable rotation assignments. If you're from another medical school and want to adapt this for your institution, feel free to reach out—I'm happy to help!
