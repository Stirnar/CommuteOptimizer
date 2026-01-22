Changelog - NSU Commute Optimizer

Version 3.0 - January 2026

Major New Features

1. Custom Block Builder 🎯
- Feature: Build custom rotation blocks with flexible schedules
- Capabilities:
  - Week-by-week schedule definition
  - Day-specific location assignments
  - Wednesday campus trip toggle
  - Save and reuse custom blocks
  - Appears in track dropdown with 🎯 icon
- Use Cases:
  - Elective rotations at non-standard sites
  - Research blocks with variable schedules
  - Part-time or combined rotations
- Storage: LocalStorage (persists across sessions)

2. Custom Locations System 📍
- Feature: Add locations not in standard database
- Capabilities:
  - Add location name and coordinates
  - Get coordinates from Google Maps
  - View and manage custom locations
  - Use in custom blocks
  - Delete custom locations
- Integration: Seamlessly integrates with standard locations
- Storage: LocalStorage

3. Help & Instructions Modal 📖
- Feature: In-app documentation system
- Content:
  - How to get coordinates from Google Maps
  - Step-by-step Custom Block Builder guide
  - Adding custom locations tutorial
  - Tips and best practices
- Access: Button on main page

Architectural Improvements

Backend-Ready Structure
- Dual Mode Support:
  - Embedded mode (default): Data hardcoded for portability
  - Backend mode: Load from server for easy updates
- Switch: Change `DATA_SOURCE_MODE` constant
- Benefits:
  - Easy deployment either way
  - Update CSVs without touching code
  - Maintain single codebase

Data Management
- CSV Loading: Dynamic CSV parsing via Papa Parse
- Fallback: Embedded data if backend unavailable
- Validation: Input validation and error handling
- Persistence: Custom data saved in localStorage

UI/UX Enhancements
- New color-coded buttons (blue, green, purple)
- Improved modal styling and layouts
- Better mobile responsiveness
- Custom block indicator (🎯) in dropdown
- Clearer separation of standard vs custom content
- Enhanced error messages and user feedback

Technical Updates
- Modular JavaScript structure
- Separated concerns (data loading, UI, calculations)
- Better state management
- Improved error handling
- Code comments and documentation
- Consistent naming conventions

Bug Fixes
- Fixed custom location coordinate parsing
- Improved Wednesday campus trip calculations
- Better handling of missing data
- Fixed modal overlay z-index issues
- Corrected mobile layout issues

Performance
- Optimized route calculations
- Better caching of location data
- Reduced redundant API calls
- Faster optimal location search

Version 2.0 - December 2025

Features
- Complete track calculations
- All clinical sites
- Wednesday campus trips
- Pediatrics week 4 special handling
- Nemours zero-commute detection
- Optimal location finder
- Real-time routing via OSRM
- Cost calculations (gas, maintenance, opportunity)
- UWorld questions lost calculation
- Adjustable cost parameters
- Data sources modal
- Detailed block breakdown

Version 1.0 - November 2025

- Basic commute calculation
- Simple track selection
- Manual home location input
- Basic cost estimates
- Proof of concept

Upcoming Features (Roadmap)

Version 3.1 (Planned)
- [ ] Export results to PDF
- [ ] Email results to yourself
- [ ] Compare multiple tracks side-by-side
- [ ] Save calculation history
- [ ] Print-friendly view

Version 4.0 (Future)
- [ ] Mobile app (React Native)
- [ ] Carpooling optimizer
- [ ] Route visualization on map
- [ ] Historical commute tracking
- [ ] Share custom blocks with others
- [ ] Community features
- [ ] Advanced analytics dashboard

Breaking Changes

V2 to V3
- None - Fully backward compatible
- Custom blocks are additive feature
- Existing functionality unchanged
- localStorage key names unchanged

V1 to V2
- Complete rewrite
- New CSV structure required
- New cost calculation formulas
- Different optimal location algorithm

Known Issues

Current (V3.0)
- Very large custom blocks (20+ weeks) may slow calculation
- OSRM API occasionally times out (auto-fallback works)
- localStorage limit is 5-10MB (unlikely to hit)
- Some older browsers may not support all features

Workarounds
- Slow calculations: Break into smaller blocks
- OSRM timeout: Retry or use different time
- Storage limit: Delete unused custom blocks
- Old browsers: Use modern browser (Chrome/Firefox/Safari)

Browser Support

 Fully Supported
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

Partially Supported
- Chrome 80-89 (no some modern CSS)
- Firefox 80-87
- Safari 13

Not Supported
- Internet Explorer (any version)
- Very old mobile browsers

Dependencies

External Libraries
- Papa Parse 5.4.1: CSV parsing
  - License: MIT
  - Source: https://www.papaparse.com/

External APIs
- OSRM Router: Route calculation
  - Free tier
  - No API key required
  - Source: https://project-osrm.org/

No Other Dependencies
- Pure vanilla JavaScript
- No framework required
- No build step needed
- Works in browser directly

Credits

Development: Skyler Colwell

Version 3 Enhancements:
- Custom Block Builder concept and implementation
- Help system design and content
- Backend architecture design
- Documentation and deployment guides

Special Thanks:
- NSU MD students for feedback
- OSRM project for free routing API
- Papa Parse team for excellent CSV library

 License
[To be determined by Skyler Colwell]

Contact
For questions, bug reports, or requests:
- Email: skyler_colwell@yahoo.com

Last Updated: January 2026
