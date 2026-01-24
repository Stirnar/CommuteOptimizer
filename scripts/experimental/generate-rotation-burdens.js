#!/usr/bin/env node

/**
 * Generate rotation-burdens.json
 * 
 * Calculates the average commute burden for each UNIQUE rotation configuration.
 * This is used by the track optimization algorithm to minimize system-wide burden.
 * 
 * Strategy:
 * 1. Extract unique rotations from Tracks.csv
 * 2. For each unique rotation, test against a grid of potential home locations
 * 3. Calculate average burden (hours per week weighted by block length)
 * 4. Save to rotation-burdens.json
 * 
 * Run once, or whenever hospital locations change.
 */

const fs = require('fs');
const https = require('https');

// Configuration
const API_DELAY_MS = 200; // Rate limiting for OSRM API
const GRID_SIZE = 20; // 20x20 = 400 test points for Phase 1 (Haversine scan)
const MIN_LAT = 25.5, MAX_LAT = 26.8;
const MIN_LNG = -80.5, MAX_LNG = -80.0;

// Data storage
let locations = {};
let variance = {};
let uniqueRotations = new Set();

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
    
    // Load Tracks and extract unique rotations
    const tracksText = fs.readFileSync('../../data/Tracks.csv', 'utf8');
    const tracks = parseCSV(tracksText).filter(row => row['Current Track'] && row['Current Track'].trim() !== '');
    
    tracks.forEach(track => {
        const months = Object.keys(track).filter(k => k !== 'Current Track');
        months.forEach(month => {
            const rotation = track[month];
            if (rotation && rotation.trim() !== '') {
                uniqueRotations.add(rotation.trim());
            }
        });
    });
    
    // Load Variance
    const varianceText = fs.readFileSync('../../data/Variance.csv', 'utf8');
    const varianceData = parseCSV(varianceText);
    varianceData.forEach(row => {
        if (row.Block) {
            variance[row.Block] = row;
        }
    });
    
    console.log(`Loaded ${Object.keys(locations).length} locations`);
    console.log(`Found ${uniqueRotations.size} unique rotations`);
    console.log(`Loaded ${Object.keys(variance).length} variance entries`);
}

// Calculate Haversine distance
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
    let weeks = 0;
    
    // Calculate average burden across all possible locations
    for (const blockName of possibleBlocks) {
        const result = await calculateBlockCommute(blockName, homeCoords, useApi);
        if (result) {
            totalHours += result.totalHours;
            weeks = result.weeks; // Should be same for all
        }
    }
    
    // Return average
    return {
        totalHours: totalHours / possibleBlocks.length,
        weeks: weeks,
        isTBD: true,
        possibleCount: possibleBlocks.length
    };
}

// Calculate commute burden for a single rotation at a single home location
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
            weeks: parseInt(varData['Block Length (wks)']) || 4 
        };
    }
    
    const weeks = parseInt(varData['Block Length (wks)']) || 4;
    const hasWednesdayException = varData['Wednesday Exception']?.toLowerCase() === 'y';
    
    let totalHours = 0;
    
    // Special handling for Pediatrics
    if (isPediatrics) {
        const sites = [
            { name: 'Kendall', trips: 2 },
            { name: 'Boynton', trips: 2 },
            { name: 'University', trips: 1 }
        ];
        
        for (const site of sites) {
            const siteCoords = locations[site.name];
            if (siteCoords) {
                const route = await getRoute(homeCoords, siteCoords, useApi);
                totalHours += route.durationHours * site.trips * 2;
            }
        }
        return { totalHours, weeks, isPediatrics: true };
    }
    
    // Regular blocks
    for (const locName of blockLocations) {
        const siteCoords = locations[locName];
        if (!siteCoords) continue;
        
        const dailyRoute = await getRoute(homeCoords, siteCoords, useApi);
        const weeksAtLocation = weeks / blockLocations.length;
        const tripsPerDay = hasWednesdayException ? 2 : 3;
        
        totalHours += dailyRoute.durationHours * tripsPerDay * 5 * weeksAtLocation;
    }
    
    return { totalHours, weeks };
}

// Calculate average burden for a rotation across all test points
// Uses two-phase approach: quick Haversine scan + API refinement on top 5
async function calculateRotationBurden(rotationName) {
    const latStep = (MAX_LAT - MIN_LAT) / GRID_SIZE;
    const lngStep = (MAX_LNG - MIN_LNG) / GRID_SIZE;
    
    let candidates = [];
    let blockWeeks = 0;
    
    // Phase 1: Quick scan with Haversine (no API calls)
    console.log(`    Phase 1: Quick scan of ${(GRID_SIZE + 1) * (GRID_SIZE + 1)} locations (Haversine)...`);
    
    for (let i = 0; i <= GRID_SIZE; i++) {
        for (let j = 0; j <= GRID_SIZE; j++) {
            const testCoords = {
                lat: MIN_LAT + (i * latStep),
                lng: MIN_LNG + (j * lngStep)
            };
            
            try {
                const result = await calculateBlockCommute(rotationName, testCoords, false);
                if (result) {
                    candidates.push({ coords: testCoords, hours: result.totalHours });
                    blockWeeks = result.weeks;
                }
            } catch (error) {
                console.error(`    Error at (${testCoords.lat.toFixed(2)}, ${testCoords.lng.toFixed(2)}):`, error.message);
            }
        }
    }
    
    if (candidates.length === 0) {
        throw new Error('No valid candidates found');
    }
    
    // Sort by burden (ascending)
    candidates.sort((a, b) => a.hours - b.hours);
    
    // Phase 2: Select geographically diverse candidates with API refinement
    console.log(`    Phase 2: Selecting geographically diverse candidates for API refinement...`);
    
    // Divide South Florida into zones (quadrants + center)
    const midLat = (MIN_LAT + MAX_LAT) / 2;
    const midLng = (MIN_LNG + MAX_LNG) / 2;
    
    // Define zones: NW, NE, SW, SE, Center
    const zones = {
        'NW': { latMin: midLat, latMax: MAX_LAT, lngMin: MIN_LNG, lngMax: midLng, candidates: [] },
        'NE': { latMin: midLat, latMax: MAX_LAT, lngMin: midLng, lngMax: MAX_LNG, candidates: [] },
        'SW': { latMin: MIN_LAT, latMax: midLat, lngMin: MIN_LNG, lngMax: midLng, candidates: [] },
        'SE': { latMin: MIN_LAT, latMax: midLat, lngMin: midLng, lngMax: MAX_LNG, candidates: [] },
        'Center': { latMin: MIN_LAT + 0.3, latMax: MAX_LAT - 0.3, lngMin: MIN_LNG + 0.1, lngMax: MAX_LNG - 0.1, candidates: [] }
    };
    
    // Assign candidates to zones
    candidates.forEach(c => {
        for (const [zoneName, zone] of Object.entries(zones)) {
            if (c.coords.lat >= zone.latMin && c.coords.lat < zone.latMax &&
                c.coords.lng >= zone.lngMin && c.coords.lng < zone.lngMax) {
                zone.candidates.push(c);
                break; // First zone match wins
            }
        }
    });
    
    // Select best candidate from each zone (up to 5 total)
    const diverseCandidates = [];
    for (const [zoneName, zone] of Object.entries(zones)) {
        if (zone.candidates.length > 0) {
            // Take the best (lowest burden) from this zone
            zone.candidates.sort((a, b) => a.hours - b.hours);
            diverseCandidates.push({ ...zone.candidates[0], zone: zoneName });
        }
    }
    
    // If we have fewer than 5 zones with candidates, fill with overall top candidates
    const remainingSlots = 5 - diverseCandidates.length;
    if (remainingSlots > 0) {
        const usedCoords = new Set(diverseCandidates.map(c => `${c.coords.lat},${c.coords.lng}`));
        for (const candidate of candidates) {
            const coordKey = `${candidate.coords.lat},${candidate.coords.lng}`;
            if (!usedCoords.has(coordKey)) {
                diverseCandidates.push({ ...candidate, zone: 'Overall' });
                usedCoords.add(coordKey);
                if (diverseCandidates.length >= 5) break;
            }
        }
    }
    
    console.log(`    Selected ${diverseCandidates.length} diverse candidates from zones: ${diverseCandidates.map(c => c.zone).join(', ')}`);
    
    // Refine with API
    let refinedResults = [];
    let optimalLocation = null;
    let minBurden = Infinity;
    
    for (const candidate of diverseCandidates) {
        try {
            const result = await calculateBlockCommute(rotationName, candidate.coords, true);
            if (result) {
                refinedResults.push({ coords: candidate.coords, hours: result.totalHours, zone: candidate.zone });
                if (result.totalHours < minBurden) {
                    minBurden = result.totalHours;
                    optimalLocation = candidate.coords;
                }
            }
        } catch (error) {
            console.error(`    API refinement failed for ${candidate.zone}:`, error.message);
        }
    }
    
    // Average across all refined results for the burden score
    const avgBurden = refinedResults.reduce((sum, r) => sum + r.hours, 0) / refinedResults.length;
    const avgHoursPerWeek = avgBurden / blockWeeks;
    const weightedScore = avgBurden;
    
    return {
        avgHoursPerWeek: avgHoursPerWeek,
        totalHours: avgBurden,
        minBurden: minBurden,
        weightedScore: weightedScore,
        blockLengthWeeks: blockWeeks,
        optimalLocation: optimalLocation,
        testPoints: candidates.length,
        refinedPoints: refinedResults.length,
        zoneResults: refinedResults.map(r => ({ zone: r.zone, hours: r.hours.toFixed(1) })),
        locations: variance[rotationName]?.Locations?.split(',').map(l => l.trim()) || ['Unknown']
    };
}

// Main function
async function main() {
    console.log('=================================');
    console.log('Rotation Burden Database Generator');
    console.log('=================================\n');
    
    // Check if data directory exists
    if (!fs.existsSync('../../data')) {
        console.error('ERROR: ./data directory not found!');
        console.error('Please run this script from the project root directory.');
        process.exit(1);
    }
    
    loadData();
    
    const results = {};
    const rotations = Array.from(uniqueRotations).sort();
    const startTime = Date.now();
    
    console.log(`\nProcessing ${rotations.length} unique rotations...\n`);
    console.log(`Two-phase approach: Haversine scan (400 points) + API refinement (5 points)`);
    console.log(`Estimated time: ~${((rotations.length * 5 * API_DELAY_MS) / 1000 / 60).toFixed(0)} minutes\n`);
    
    for (let i = 0; i < rotations.length; i++) {
        const rotation = rotations[i];
        
        console.log(`[${i + 1}/${rotations.length}] ${rotation}`);
        
        try {
            const burdenData = await calculateRotationBurden(rotation);
            
            results[rotation] = burdenData;
            
            console.log(`    ✓ Avg burden: ${burdenData.avgHoursPerWeek.toFixed(2)} hrs/week`);
            console.log(`    ✓ Total hours: ${burdenData.totalHours.toFixed(1)} hrs (${burdenData.blockLengthWeeks} weeks)`);
            console.log(`    ✓ Optimal location: ${burdenData.optimalLocation.lat.toFixed(4)}, ${burdenData.optimalLocation.lng.toFixed(4)}`);
            console.log(`    ✓ Min burden: ${burdenData.minBurden.toFixed(1)} hrs`);
            if (burdenData.zoneResults && burdenData.zoneResults.length > 1) {
                console.log(`    ✓ Zone variance: ${burdenData.zoneResults.map(z => `${z.zone}=${z.hours}`).join(', ')}`);
            }
            console.log('');
            
        } catch (error) {
            console.error(`    ✗ ERROR: ${error.message}\n`);
        }
    }
    
    // Save to file
    const outputPath = '../../data/rotation-burdens.json';
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    
    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    
    console.log('=================================');
    console.log('✓ Generation complete!');
    console.log(`  File: ${outputPath}`);
    console.log(`  Rotations processed: ${Object.keys(results).length}`);
    console.log(`  Time: ${elapsed} minutes`);
    console.log('=================================');
    
    // Print summary statistics
    console.log('\nBurden Summary (sorted by avg hours/week):');
    console.log('=================================');
    
    const sorted = Object.entries(results)
        .sort((a, b) => a[1].avgHoursPerWeek - b[1].avgHoursPerWeek);
    
    sorted.forEach(([name, data], idx) => {
        if (idx < 5 || idx >= sorted.length - 5) {
            console.log(`${name}: ${data.avgHoursPerWeek.toFixed(2)} hrs/week`);
        } else if (idx === 5) {
            console.log('...');
        }
    });
}

// Run the script
main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
