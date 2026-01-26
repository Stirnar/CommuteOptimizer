#!/usr/bin/env node

/**
 * Analyze the incremental burden of Wednesday campus requirements
 * 
 * CORRECTED VERSION:
 * - Wednesday Exception = "y" means NO Wednesday campus requirement
 * - Wednesday Exception = "n" (or missing) means YES Wednesday campus requirement
 * - Handles "To Be Determined" blocks by averaging across possible locations
 */

const fs = require('fs');
const https = require('https');

// Configuration
const NSU_COORDS = { lat: 26.082, lng: -80.249 };
const API_DELAY_MS = 200;

// Data storage
let locations = {};
let tracks = [];
let variance = {};
let optimalLocations = {};

// Utility functions
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function parseCSV(text) {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    return lines.slice(1).map(line => {
        const values = [];
        let current = '';
        let inQuotes = false;
        
        for (let char of line) {
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current.trim());
        
        const obj = {};
        headers.forEach((h, i) => {
            obj[h] = values[i] || '';
        });
        return obj;
    });
}

function loadData() {
    console.log('Loading data files...');
    
    // Load Locations
    const locationsText = fs.readFileSync('../../data/Locations.csv', 'utf8');
    const locationsData = parseCSV(locationsText);
    locationsData.forEach(row => {
        if (row.Locations && row.Coordinates) {
            const [lat, lng] = row.Coordinates.replace(/"/g, '').split(',').map(s => parseFloat(s.trim()));
            if (!isNaN(lat) && !isNaN(lng)) {
                locations[row.Locations.trim()] = { lat, lng };
            }
        }
    });
    locations['NSU'] = NSU_COORDS;
    
    // Load Tracks
    const tracksText = fs.readFileSync('../../data/Tracks.csv', 'utf8');
    tracks = parseCSV(tracksText).filter(row => row['Current Track'] && row['Current Track'].trim() !== '');
    
    // Load Variance
    const varianceText = fs.readFileSync('../../data/Variance.csv', 'utf8');
    const varianceData = parseCSV(varianceText);
    varianceData.forEach(row => {
        if (row.Block) {
            variance[row.Block] = row;
        }
    });
    
    // Load optimal locations
    try {
        const optimalText = fs.readFileSync('../../data/optimal-locations.json', 'utf8');
        optimalLocations = JSON.parse(optimalText);
        console.log(`Loaded optimal locations for ${Object.keys(optimalLocations).length} tracks`);
    } catch (error) {
        console.error('ERROR: Could not load optimal-locations.json');
        console.error('Please run generate-optimal-data.js first');
        process.exit(1);
    }
    
    console.log(`Loaded ${Object.keys(locations).length} locations`);
    console.log(`Loaded ${tracks.length} tracks`);
    console.log(`Loaded ${Object.keys(variance).length} variance entries`);
}

function haversineDistance(from, to) {
    const lat1 = from.lat * Math.PI / 180;
    const lat2 = to.lat * Math.PI / 180;
    const deltaLat = (to.lat - from.lat) * Math.PI / 180;
    const deltaLng = (to.lng - from.lng) * Math.PI / 180;
    
    const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLng/2) * Math.sin(deltaLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return 3959 * c;
}

async function getRoute(from, to, useApi = true) {
    const distanceMiles = haversineDistance(from, to);
    
    if (!useApi) {
        return { distanceMiles, durationHours: distanceMiles / 30 };
    }
    
    await sleep(API_DELAY_MS);
    
    return new Promise((resolve) => {
        const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`;
        
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.routes && json.routes.length > 0) {
                        const apiDist = json.routes[0].distance * 0.000621371;
                        const apiDur = json.routes[0].duration / 3600;
                        resolve({ distanceMiles: apiDist, durationHours: apiDur });
                    } else {
                        resolve({ distanceMiles, durationHours: distanceMiles / 30 });
                    }
                } catch (e) {
                    resolve({ distanceMiles, durationHours: distanceMiles / 30 });
                }
            });
        }).on('error', () => {
            resolve({ distanceMiles, durationHours: distanceMiles / 30 });
        });
    });
}

// Calculate average commute burden for TBD blocks
async function calculateTBDBlock(blockType, homeCoords, useApi = true) {
    // Find all possible locations for this block type
    const possibleBlocks = Object.keys(variance).filter(key => 
        key.includes(blockType) && !key.includes('To Be Determined')
    );
    
    if (possibleBlocks.length === 0) {
        console.warn(`    Warning: No variance entries found for TBD block type: ${blockType}`);
        return null;
    }
    
    let totalHours = 0;
    let totalMiles = 0;
    let wednesdayHours = 0;
    let wednesdayMiles = 0;
    let weeks = 0;
    let hasWednesdayCount = 0;
    
    // Calculate average burden across all possible locations
    for (const blockName of possibleBlocks) {
        const result = await calculateBlockCommute(blockName, homeCoords, useApi);
        if (result) {
            totalHours += result.totalHours;
            totalMiles += result.totalMiles;
            wednesdayHours += result.wednesdayHours || 0;
            wednesdayMiles += result.wednesdayMiles || 0;
            weeks = result.weeks; // Should be same for all
            if (result.requiresWednesday) hasWednesdayCount++;
        }
    }
    
    // Return average
    const count = possibleBlocks.length;
    return {
        totalHours: totalHours / count,
        totalMiles: totalMiles / count,
        wednesdayHours: wednesdayHours / count,
        wednesdayMiles: wednesdayMiles / count,
        weeks: weeks,
        isTBD: true,
        requiresWednesday: hasWednesdayCount > 0, // True if any option requires Wednesday
        possibleCount: count
    };
}

// Calculate block burden with Wednesday campus requirement
async function calculateBlockCommute(blockName, homeCoords, useApi = true) {
    // Handle "To Be Determined" blocks
    if (blockName.includes('To Be Determined')) {
        const blockType = blockName.split('@')[0].trim();
        return await calculateTBDBlock(blockType, homeCoords, useApi);
    }
    
    const varData = variance[blockName];
    if (!varData) {
        console.warn(`No variance data for: ${blockName}`);
        return null;
    }
    
    const blockLocations = varData.Locations.split(',').map(l => l.trim()).filter(Boolean);
    const isPediatrics = blockName.includes('Pediatrics Clerkship @ Nemours');
    
    // Nemours blocks = 0 commute (except pediatrics week 4)
    if (!isPediatrics && blockLocations.some(loc => loc.toLowerCase().includes('nemours'))) {
        return { 
            totalHours: 0, 
            totalMiles: 0, 
            wednesdayHours: 0,
            wednesdayMiles: 0,
            weeks: parseInt(varData['Block Length (wks)']) || 4,
            requiresWednesday: false
        };
    }
    
    const weeks = parseInt(varData['Block Length (wks)']) || 4;
    
    // CORRECTED LOGIC: Wednesday Exception = "y" means NO Wednesday requirement
    const wednesdayException = varData['Wednesday Exception']?.toLowerCase() === 'y';
    const requiresWednesday = !wednesdayException; // Inverted!
    
    let totalHours = 0;
    let totalMiles = 0;
    let wednesdayHours = 0;
    let wednesdayMiles = 0;
    
    // Special handling for Pediatrics
    if (isPediatrics) {
        const week4Details = [];
        const sites = [
            { name: 'Kendall', days: 'Mon-Tue', trips: 2 },
            { name: 'Boynton', days: 'Wed-Thu', trips: 2 },
            { name: 'University', days: 'Fri', trips: 1 }
        ];
        
        for (const site of sites) {
            const siteCoords = locations[site.name];
            if (siteCoords) {
                const route = await getRoute(homeCoords, siteCoords, useApi);
                const hours = route.durationHours * site.trips * 2;
                const miles = route.distanceMiles * site.trips * 2;
                totalHours += hours;
                totalMiles += miles;
            }
        }
        // Pediatrics has Wednesday exception, so no Wednesday burden
        return { 
            totalHours, 
            totalMiles, 
            wednesdayHours: 0,
            wednesdayMiles: 0,
            weeks, 
            isPediatrics: true,
            requiresWednesday: false
        };
    }
    
    // Regular blocks
    for (const locName of blockLocations) {
        const siteCoords = locations[locName];
        if (!siteCoords) continue;
        
        const weeksAtLocation = weeks / blockLocations.length;
        
        if (requiresWednesday) {
            // Calculate Wednesday burden: Extra trip to campus and back
            // Normal: Home → Site → Home (2 legs)
            // Wednesday: Home → Site → Campus → Home (3 legs)
            
            // Get route distances
            const homeToSite = await getRoute(homeCoords, siteCoords, useApi);
            const siteToCampus = await getRoute(siteCoords, NSU_COORDS, useApi);
            const campusToHome = await getRoute(NSU_COORDS, homeCoords, useApi);
            
            // Mon-Tue, Thu-Fri: Normal commute (4 days)
            const normalDaysHours = homeToSite.durationHours * 2 * 4 * weeksAtLocation;
            const normalDaysMiles = homeToSite.distanceMiles * 2 * 4 * weeksAtLocation;
            
            // Wednesday: Site → Campus → Home (extra leg compared to Site → Home)
            const wednesdayTripHours = (homeToSite.durationHours + siteToCampus.durationHours + campusToHome.durationHours) * weeksAtLocation;
            const wednesdayTripMiles = (homeToSite.distanceMiles + siteToCampus.distanceMiles + campusToHome.distanceMiles) * weeksAtLocation;
            
            // Normal Wednesday would be: Home → Site → Home
            const normalWednesdayHours = homeToSite.durationHours * 2 * weeksAtLocation;
            const normalWednesdayMiles = homeToSite.distanceMiles * 2 * weeksAtLocation;
            
            // Wednesday burden = difference between Wednesday trip and normal trip
            const wedBurdenHours = wednesdayTripHours - normalWednesdayHours;
            const wedBurdenMiles = wednesdayTripMiles - normalWednesdayMiles;
            
            totalHours += normalDaysHours + wednesdayTripHours;
            totalMiles += normalDaysMiles + wednesdayTripMiles;
            wednesdayHours += wedBurdenHours;
            wednesdayMiles += wedBurdenMiles;
            
        } else {
            // No Wednesday requirement - normal commute all 5 days
            const dailyRoute = await getRoute(homeCoords, siteCoords, useApi);
            totalHours += dailyRoute.durationHours * 2 * 5 * weeksAtLocation;
            totalMiles += dailyRoute.distanceMiles * 2 * 5 * weeksAtLocation;
            // No Wednesday burden for exception blocks
        }
    }
    
    return { 
        totalHours, 
        totalMiles, 
        wednesdayHours,
        wednesdayMiles,
        weeks,
        requiresWednesday
    };
}

async function analyzeTrackWednesday(trackData, homeCoords) {
    const trackName = trackData['Current Track'];
    let totalHoursWithWed = 0;
    let totalMilesWithWed = 0;
    let wednesdayOnlyHours = 0;
    let wednesdayOnlyMiles = 0;
    let blocksWithWednesday = 0;
    let totalBlocks = 0;
    
    const months = Object.keys(trackData).filter(k => k !== 'Current Track');
    
    for (const month of months) {
        const blockName = trackData[month];
        if (!blockName || blockName.trim() === '') continue;
        
        totalBlocks++;
        const result = await calculateBlockCommute(blockName, homeCoords, true);
        
        if (result) {
            totalHoursWithWed += result.totalHours;
            totalMilesWithWed += result.totalMiles;
            wednesdayOnlyHours += result.wednesdayHours || 0;
            wednesdayOnlyMiles += result.wednesdayMiles || 0;
            if (result.requiresWednesday) blocksWithWednesday++;
        }
    }
    
    const totalHoursWithoutWed = totalHoursWithWed - wednesdayOnlyHours;
    const totalMilesWithoutWed = totalMilesWithWed - wednesdayOnlyMiles;
    
    return {
        trackName,
        totalHoursWithWed,
        totalHoursWithoutWed,
        wednesdayOnlyHours,
        wednesdayPercentage: totalHoursWithWed > 0 ? (wednesdayOnlyHours / totalHoursWithWed * 100) : 0,
        totalMilesWithWed,
        totalMilesWithoutWed,
        wednesdayOnlyMiles,
        blocksWithWednesday,
        totalBlocks
    };
}

async function main() {
    console.log('=================================');
    console.log('Wednesday Campus Requirement Analysis');
    console.log('=================================\n');
    
    loadData();
    
    const results = [];
    
    console.log(`\nAnalyzing ${tracks.length} tracks...\n`);
    
    for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        const trackName = track['Current Track'];
        
        console.log(`[${i + 1}/${tracks.length}] ${trackName}`);
        
        // Get optimal location for this track
        const optimalData = optimalLocations[trackName];
        if (!optimalData || !optimalData.optimalLocation) {
            console.log(`  ⚠ No optimal location data - skipping`);
            continue;
        }
        
        const homeCoords = optimalData.optimalLocation;
        
        try {
            const result = await analyzeTrackWednesday(track, homeCoords);
            results.push(result);
            
            console.log(`  ✓ Total burden: ${result.totalHoursWithWed.toFixed(1)} hrs/year`);
            console.log(`  ✓ Wednesday cost: ${result.wednesdayOnlyHours.toFixed(1)} hrs (${result.wednesdayPercentage.toFixed(1)}%)`);
            console.log(`  ✓ Blocks with Wednesday: ${result.blocksWithWednesday}/${result.totalBlocks}\n`);
            
        } catch (error) {
            console.error(`  ✗ ERROR: ${error.message}\n`);
        }
    }
    
    // Calculate system-wide statistics
    const totalStudents = results.length;
    const avgWednesdayHours = results.reduce((sum, r) => sum + r.wednesdayOnlyHours, 0) / totalStudents;
    const totalSystemWednesdayHours = results.reduce((sum, r) => sum + r.wednesdayOnlyHours, 0);
    const avgWednesdayMiles = results.reduce((sum, r) => sum + r.wednesdayOnlyMiles, 0) / totalStudents;
    const totalSystemMiles = results.reduce((sum, r) => sum + r.wednesdayOnlyMiles, 0);
    const avgPercentage = results.reduce((sum, r) => sum + r.wednesdayPercentage, 0) / totalStudents;
    const avgBlocksWithWednesday = results.reduce((sum, r) => sum + r.blocksWithWednesday, 0) / totalStudents;
    
    // Cost calculations (using reasonable defaults)
    const gasCostPerMile = 2.95 / 25; // $2.95/gal, 25 MPG
    const maintenanceCostPerMile = 0.0986;
    const totalCostPerMile = gasCostPerMile + maintenanceCostPerMile;
    const avgWednesdayCost = avgWednesdayMiles * totalCostPerMile;
    const totalSystemCost = totalSystemMiles * totalCostPerMile;
    
    // UWorld questions (1.5 min per question)
    const avgUWorldLost = (avgWednesdayHours * 60) / 1.5;
    const totalUWorldLost = (totalSystemWednesdayHours * 60) / 1.5;
    
    // Save results
    const outputPath = '../../data/wednesday-analysis.json';
    fs.writeFileSync(outputPath, JSON.stringify({
        summary: {
            totalStudents,
            avgWednesdayHours: parseFloat(avgWednesdayHours.toFixed(1)),
            totalSystemWednesdayHours: parseFloat(totalSystemWednesdayHours.toFixed(1)),
            avgWednesdayMiles: parseFloat(avgWednesdayMiles.toFixed(1)),
            totalSystemMiles: parseFloat(totalSystemMiles.toFixed(1)),
            avgWednesdayPercentage: parseFloat(avgPercentage.toFixed(1)),
            avgBlocksWithWednesday: parseFloat(avgBlocksWithWednesday.toFixed(1)),
            avgWednesdayCost: parseFloat(avgWednesdayCost.toFixed(2)),
            totalSystemCost: parseFloat(totalSystemCost.toFixed(2)),
            avgUWorldLost: Math.round(avgUWorldLost),
            totalUWorldLost: Math.round(totalUWorldLost)
        },
        trackResults: results
    }, null, 2));
    
    // Print summary
    console.log('\n=================================');
    console.log('SUMMARY RESULTS');
    console.log('=================================');
    console.log(`\nTotal tracks analyzed: ${totalStudents}`);
    console.log(`\nAverage Wednesday burden per student:`);
    console.log(`  • Hours/year: ${avgWednesdayHours.toFixed(1)}`);
    console.log(`  • Miles/year: ${avgWednesdayMiles.toFixed(1)}`);
    console.log(`  • Percentage of total burden: ${avgPercentage.toFixed(1)}%`);
    console.log(`  • Cost/year: $${avgWednesdayCost.toFixed(2)}`);
    console.log(`  • UWorld questions lost: ${Math.round(avgUWorldLost)}`);
    console.log(`  • Avg blocks requiring Wednesday: ${avgBlocksWithWednesday.toFixed(1)}/10`);
    console.log(`\nSystem-wide impact (all ${totalStudents} M3 students):`);
    console.log(`  • Total hours: ${totalSystemWednesdayHours.toFixed(1)}`);
    console.log(`  • Total miles: ${totalSystemMiles.toFixed(1)}`);
    console.log(`  • Total cost: $${totalSystemCost.toFixed(2)}`);
    console.log(`  • Total UWorld questions lost: ${Math.round(totalUWorldLost).toLocaleString()}`);
    console.log(`\nResults saved to: ${outputPath}`);
    console.log('=================================');
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
