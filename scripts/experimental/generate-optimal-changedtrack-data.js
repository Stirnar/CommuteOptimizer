#!/usr/bin/env node

/**
 * Generate complete optimal-locations.json with pre-computed commute burdens
 * This script calculates the optimal home location for each track AND stores
 * the complete commute results so users get instant results.
 * 
 * Run once, or whenever Locations.csv, Tracks.csv, or Variance.csv change.
 */

const fs = require('fs');
const https = require('https');

// Configuration
const NSU_COORDS = { lat: 26.082, lng: -80.249 };
const API_DELAY_MS = 200; // Rate limiting for OSRM API
const GRID_SIZE = 20; // 20x20 = 400 test points for finding optimal location
const MIN_LAT = 25.5, MAX_LAT = 26.8;
const MIN_LNG = -80.5, MAX_LNG = -80.0;

// Data storage
let locations = {};
let tracks = [];
let variance = {};

// Utility: Sleep function
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Utility: Parse CSV
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

// Load data files
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
    const tracksText = fs.readFileSync('../../data/Tracks-Optimized-Clustering.csv', 'utf8');
    tracks = parseCSV(tracksText).filter(row => row['Current Track'] && row['Current Track'].trim() !== '');
    
    // Load Variance
    const varianceText = fs.readFileSync('../../data/Variance.csv', 'utf8');
    const varianceData = parseCSV(varianceText);
    varianceData.forEach(row => {
        if (row.Block) {
            variance[row.Block] = row;
        }
    });
    
    console.log(`Loaded ${Object.keys(locations).length} locations`);
    console.log(`Loaded ${tracks.length} tracks`);
    console.log(`Loaded ${Object.keys(variance).length} variance entries`);
}

// Calculate Haversine distance (fallback)
function haversineDistance(from, to) {
    const lat1 = from.lat * Math.PI / 180;
    const lat2 = to.lat * Math.PI / 180;
    const deltaLat = (to.lat - from.lat) * Math.PI / 180;
    const deltaLng = (to.lng - from.lng) * Math.PI / 180;
    
    const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLng/2) * Math.sin(deltaLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return 3959 * c; // Earth radius in miles
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
    let weeks = 0;
    const blockDetailsList = [];
    
    // Calculate average burden across all possible locations
    for (const blockName of possibleBlocks) {
        const result = await calculateBlockCommute(blockName, homeCoords, useApi);
        if (result) {
            totalHours += result.totalHours;
            totalMiles += result.totalMiles;
            weeks = result.weeks; // Should be same for all
            if (result.isPediatrics) {
                blockDetailsList.push(result.week4Details);
            }
        }
    }
    
    // Return average
    return {
        totalHours: totalHours / possibleBlocks.length,
        totalMiles: totalMiles / possibleBlocks.length,
        weeks: weeks,
        isTBD: true,
        possibleCount: possibleBlocks.length
    };
}

// Get route from OSRM API
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
                        const apiDist = json.routes[0].distance * 0.000621371; // meters to miles
                        const apiDur = json.routes[0].duration / 3600; // seconds to hours
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

// Calculate commute for a single block
async function calculateBlockCommute(blockName, homeCoords, useApi = true) {
    // Handle "To Be Determined" blocks by averaging across possible locations
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
            weeks: parseInt(varData['Block Length (wks)']) || 4 
        };
    }
    
    const weeks = parseInt(varData['Block Length (wks)']) || 4;
    const hasWednesdayException = varData['Wednesday Exception']?.toLowerCase() === 'y';
    
    let totalHours = 0;
    let totalMiles = 0;
    
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
                week4Details.push({ location: site.name, days: site.days, hours, miles });
            }
        }
        return { totalHours, totalMiles, weeks, isPediatrics: true, week4Details };
    }
    
    // Regular blocks
    for (const locName of blockLocations) {
        const siteCoords = locations[locName];
        if (!siteCoords) continue;
        
        const dailyRoute = await getRoute(homeCoords, siteCoords, useApi);
        const weeksAtLocation = weeks / blockLocations.length;
        const tripsPerDay = hasWednesdayException ? 2 : 3;
        
        totalHours += dailyRoute.durationHours * tripsPerDay * 5 * weeksAtLocation;
        totalMiles += dailyRoute.distanceMiles * tripsPerDay * 5 * weeksAtLocation;
    }
    
    return { totalHours, totalMiles, weeks };
}

// Calculate full track commute
async function calculateTrackCommute(trackData, homeCoords, useApi = true) {
    let totalHours = 0;
    let totalMiles = 0;
    let totalWeeks = 0;
    const blockDetails = [];
    
    const months = Object.keys(trackData).filter(k => k !== 'Current Track');
    
    for (const month of months) {
        const blockName = trackData[month];
        if (!blockName || blockName.trim() === '') continue;
        
        const blockCommute = await calculateBlockCommute(blockName, homeCoords, useApi);
        if (blockCommute) {
            totalHours += blockCommute.totalHours;
            totalMiles += blockCommute.totalMiles;
            totalWeeks += blockCommute.weeks;
            blockDetails.push({
                month,
                block: blockName,
                ...blockCommute
            });
        }
    }
    
    return { totalHours, totalMiles, totalWeeks, blockDetails };
}

// Find optimal location for a track
async function findOptimalLocation(trackData) {
    console.log(`  Finding optimal location for ${trackData['Current Track']}...`);
    
    const latStep = (MAX_LAT - MIN_LAT) / GRID_SIZE;
    const lngStep = (MAX_LNG - MIN_LNG) / GRID_SIZE;
    
    let candidates = [];
    
    // Phase 1: Quick scan without API (Haversine distance)
    console.log(`    Phase 1: Scanning ${(GRID_SIZE + 1) * (GRID_SIZE + 1)} grid points...`);
    for (let i = 0; i <= GRID_SIZE; i++) {
        for (let j = 0; j <= GRID_SIZE; j++) {
            const testCoords = {
                lat: MIN_LAT + (i * latStep),
                lng: MIN_LNG + (j * lngStep)
            };
            
            try {
                const result = await calculateTrackCommute(trackData, testCoords, false);
                candidates.push({ coords: testCoords, hours: result.totalHours });
            } catch (error) {
                console.error('    Error testing location:', error.message);
            }
        }
    }
    
    candidates.sort((a, b) => a.hours - b.hours);
    
    // Phase 2: Refine top 5 candidates with API
    console.log(`    Phase 2: Refining top 5 candidates with API...`);
    let bestLocation = null;
    let minTotalHours = Infinity;
    
    const topCandidates = candidates.slice(0, 5);
    
    for (const candidate of topCandidates) {
        try {
            const result = await calculateTrackCommute(trackData, candidate.coords, true);
            if (result.totalHours < minTotalHours) {
                minTotalHours = result.totalHours;
                bestLocation = candidate.coords;
            }
        } catch (e) {
            console.error("    Verification failed for candidate:", e.message);
        }
    }
    
    return bestLocation || topCandidates[0].coords;
}

// Main function
async function main() {
    console.log('=================================');
    console.log('NSU Commute Optimizer Data Generator');
    console.log('=================================\n');
    
    // Check if data directory exists
    if (!fs.existsSync('../../data')) {
        console.error('ERROR: ./data directory not found!');
        console.error('Please run this script from the project root directory.');
        process.exit(1);
    }
    
    loadData();
    
    const results = {};
    const startTime = Date.now();
    
    console.log(`\nProcessing ${tracks.length} tracks...\n`);
    
    for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        const trackName = track['Current Track'];
        
        console.log(`[${i + 1}/${tracks.length}] ${trackName}`);
        
        try {
            // Find optimal location
            const optimalCoords = await findOptimalLocation(track);
            
            // Calculate full commute at optimal location
            console.log(`    Calculating full commute burden...`);
            const commuteResults = await calculateTrackCommute(track, optimalCoords, true);
            
            // Store everything
            results[trackName] = {
                optimalLocation: optimalCoords,
                minCommuteBurden: commuteResults.totalHours,
                totalMiles: commuteResults.totalMiles,
                totalWeeks: commuteResults.totalWeeks,
                blockDetails: commuteResults.blockDetails
            };
            
            console.log(`    ✓ Optimal: ${optimalCoords.lat.toFixed(4)}, ${optimalCoords.lng.toFixed(4)}`);
            console.log(`    ✓ Burden: ${commuteResults.totalHours.toFixed(1)} hrs/year\n`);
            
        } catch (error) {
            console.error(`    ✗ ERROR: ${error.message}\n`);
        }
    }
    
    // Save to file
    const outputPath = '../../data/optimal-locations-for-resort.json';
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    
    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    
    console.log('=================================');
    console.log('✓ Generation complete!');
    console.log(`  File: ${outputPath}`);
    console.log(`  Tracks processed: ${Object.keys(results).length}`);
    console.log(`  Time: ${elapsed} minutes`);
    console.log('=================================');
}

// Run the script
main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
