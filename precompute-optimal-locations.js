#!/usr/bin/env node

/**
 * Pre-compute Optimal Locations for All Tracks
 * 
 * This script calculates the optimal home location for each of the 60 tracks.
 * It takes a while to run but only needs to be run once (or when data changes).
 * 
 * Output: data/optimal-locations.json
 * 
 * Usage: node precompute-optimal-locations.js
 */

const fs = require('fs');
const https = require('https');

// Configuration
const SOUTH_FLORIDA_BOUNDS = {
    minLat: 25.5,
    maxLat: 26.8,
    minLng: -80.5,
    maxLng: -80.0
};

const NSU_COORDS = { lat: 26.082, lng: -80.249 };
const GRID_SIZE = 20; // 20x20 = 441 test points per track
const API_DELAY = 250; // 250ms between API calls (4 per second, respectful)

// Global data storage
let locations = {};
let tracks = [];
let variance = {};

/**
 * Parse CSV data
 */
function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
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
        headers.forEach((header, i) => {
            obj[header] = values[i] || '';
        });
        return obj;
    });
}

/**
 * Load CSV files
 */
function loadData() {
    console.log('📂 Loading data files...');
    
    // Load Locations
    const locationsCSV = fs.readFileSync('./data/Locations.csv', 'utf8');
    const locationsData = parseCSV(locationsCSV);
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
    const tracksCSV = fs.readFileSync('./data/Tracks.csv', 'utf8');
    tracks = parseCSV(tracksCSV).filter(row => row['Current Track'] && row['Current Track'].trim() !== '');
    
    // Load Variance
    const varianceCSV = fs.readFileSync('./data/Variance.csv', 'utf8');
    const varianceData = parseCSV(varianceCSV);
    varianceData.forEach(row => {
        if (row.Block) {
            variance[row.Block] = row;
        }
    });
    
    console.log(`Loaded ${Object.keys(locations).length} locations`);
    console.log(`Loaded ${tracks.length} tracks`);
    console.log(`Loaded ${Object.keys(variance).length} variance entries`);
}

/**
 * Calculate haversine distance between two points
 */
function haversineDistance(from, to) {
    const lat1 = from.lat * Math.PI / 180;
    const lat2 = to.lat * Math.PI / 180;
    const deltaLat = (to.lat - from.lat) * Math.PI / 180;
    const deltaLng = (to.lng - from.lng) * Math.PI / 180;
    
    const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLng/2) * Math.sin(deltaLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return 3959 * c; // miles
}

/**
 * Get route via OSRM API
 */
function getRoute(from, to) {
    return new Promise((resolve, reject) => {
        const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`;
        
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.routes && json.routes.length > 0) {
                        const distanceMiles = json.routes[0].distance * 0.000621371;
                        const durationHours = json.routes[0].duration / 3600;
                        resolve({ distanceMiles, durationHours });
                    } else {
                        // Fallback to haversine
                        const distanceMiles = haversineDistance(from, to);
                        resolve({ distanceMiles, durationHours: distanceMiles / 30 });
                    }
                } catch (err) {
                    // Fallback to haversine
                    const distanceMiles = haversineDistance(from, to);
                    resolve({ distanceMiles, durationHours: distanceMiles / 30 });
                }
            });
        }).on('error', () => {
            // Fallback to haversine
            const distanceMiles = haversineDistance(from, to);
            resolve({ distanceMiles, durationHours: distanceMiles / 30 });
        });
    });
}

/**
 * Calculate commute burden for a block
 */
async function calculateBlockCommute(blockName, homeCoords, useApi = true) {
    const varData = variance[blockName];
    if (!varData) return null;
    
    const blockLocations = varData.Locations.split(',').map(l => l.trim()).filter(Boolean);
    const isPediatrics = blockName.includes('Pediatrics Clerkship @ Nemours');
    
    // Nemours blocks = 0 commute (on-site housing)
    if (!isPediatrics && blockLocations.some(loc => loc.toLowerCase().includes('nemours'))) {
        return { totalHours: 0, totalMiles: 0, weeks: parseInt(varData['Block Length (wks)']) || 4 };
    }
    
    const weeks = parseInt(varData['Block Length (wks)']) || 4;
    const hasWednesdayException = varData['Wednesday Exception']?.toLowerCase() === 'y';
    
    let totalHours = 0;
    let totalMiles = 0;
    
    if (isPediatrics) {
        // Special handling for Pediatrics week 4
        const sites = [
            { name: 'Kendall', trips: 2 },
            { name: 'Boynton', trips: 2 },
            { name: 'University', trips: 1 }
        ];
        
        for (const site of sites) {
            const siteCoords = locations[site.name];
            if (siteCoords) {
                const route = useApi ? await getRoute(homeCoords, siteCoords) : 
                              { distanceMiles: haversineDistance(homeCoords, siteCoords), 
                                durationHours: haversineDistance(homeCoords, siteCoords) / 30 };
                totalHours += route.durationHours * site.trips * 2;
                totalMiles += route.distanceMiles * site.trips * 2;
                
                if (useApi) await new Promise(resolve => setTimeout(resolve, API_DELAY));
            }
        }
        return { totalHours, totalMiles, weeks };
    }
    
    // Regular blocks
    for (const locName of blockLocations) {
        const siteCoords = locations[locName];
        if (!siteCoords) continue;
        
        const route = useApi ? await getRoute(homeCoords, siteCoords) :
                      { distanceMiles: haversineDistance(homeCoords, siteCoords),
                        durationHours: haversineDistance(homeCoords, siteCoords) / 30 };
        
        const weeksAtLocation = weeks / blockLocations.length;
        const tripsPerDay = hasWednesdayException ? 2 : 3;
        
        totalHours += route.durationHours * tripsPerDay * 5 * weeksAtLocation;
        totalMiles += route.distanceMiles * tripsPerDay * 5 * weeksAtLocation;
        
        if (useApi) await new Promise(resolve => setTimeout(resolve, API_DELAY));
    }
    
    return { totalHours, totalMiles, weeks };
}

/**
 * Calculate track commute burden
 */
async function calculateTrackCommute(trackData, homeCoords, useApi = true) {
    let totalHours = 0;
    let totalMiles = 0;
    let totalWeeks = 0;
    
    const months = Object.keys(trackData).filter(k => k !== 'Current Track');
    
    for (const month of months) {
        const blockName = trackData[month];
        if (!blockName || blockName.trim() === '') continue;
        
        const blockCommute = await calculateBlockCommute(blockName, homeCoords, useApi);
        if (blockCommute) {
            totalHours += blockCommute.totalHours;
            totalMiles += blockCommute.totalMiles;
            totalWeeks += blockCommute.weeks;
        }
    }
    
    return { totalHours, totalMiles, totalWeeks };
}

/**
 * Find optimal location for a track
 */
async function findOptimalLocation(trackData) {
    console.log(`  Testing ${GRID_SIZE}x${GRID_SIZE} grid points with haversine...`);
    
    let candidates = [];
    const latStep = (SOUTH_FLORIDA_BOUNDS.maxLat - SOUTH_FLORIDA_BOUNDS.minLat) / GRID_SIZE;
    const lngStep = (SOUTH_FLORIDA_BOUNDS.maxLng - SOUTH_FLORIDA_BOUNDS.minLng) / GRID_SIZE;
    
    // Phase 1: Quick scan with haversine
    for (let i = 0; i <= GRID_SIZE; i++) {
        for (let j = 0; j <= GRID_SIZE; j++) {
            const testCoords = {
                lat: SOUTH_FLORIDA_BOUNDS.minLat + (i * latStep),
                lng: SOUTH_FLORIDA_BOUNDS.minLng + (j * lngStep)
            };
            
            const result = await calculateTrackCommute(trackData, testCoords, false);
            candidates.push({ coords: testCoords, hours: result.totalHours });
        }
    }
    
    candidates.sort((a, b) => a.hours - b.hours);
    console.log(`  Initial scan complete. Top candidate: ${candidates[0].hours.toFixed(1)} hours`);
    
    // Phase 2: Refine top 5 candidates with API
    console.log(`  Testing top 5 candidates with OSRM API...`);
    let bestLocation = null;
    let minTotalHours = Infinity;
    
    const topCandidates = candidates.slice(0, 5);
    
    for (let i = 0; i < topCandidates.length; i++) {
        const candidate = topCandidates[i];
        console.log(`    Testing candidate ${i + 1}/5...`);
        
        const result = await calculateTrackCommute(trackData, candidate.coords, true);
        if (result.totalHours < minTotalHours) {
            minTotalHours = result.totalHours;
            bestLocation = candidate.coords;
        }
    }
    
    return { location: bestLocation, burden: minTotalHours };
}

/**
 * Main execution
 */
async function main() {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║  NSU Commute Optimizer - Optimal Location Pre-Computer  ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');
    
    loadData();
    
    const results = {};
    const startTime = Date.now();
    
    console.log(`\n Starting pre-computation for ${tracks.length} tracks`);
    console.log(`  Estimated time: 10-15 hours\n`);
    
    for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        const trackName = track['Current Track'];
        
        console.log(`\n[${i + 1}/${tracks.length}] Processing: ${trackName}`);
        console.log(`─────────────────────────────────────────────────────────`);
        
        const optimal = await findOptimalLocation(track);
        
        results[trackName] = {
            optimalLocation: optimal.location,
            minCommuteBurden: optimal.burden,
            computedAt: new Date().toISOString()
        };
        
        console.log(`  Optimal location: ${optimal.location.lat.toFixed(4)}, ${optimal.location.lng.toFixed(4)}`);
        console.log(`  Min burden: ${optimal.burden.toFixed(1)} hours/year`);
        
        const elapsed = (Date.now() - startTime) / 1000 / 60;
        const avgPerTrack = elapsed / (i + 1);
        const remaining = avgPerTrack * (tracks.length - i - 1);
        console.log(`  Elapsed: ${elapsed.toFixed(1)} min | Remaining: ${remaining.toFixed(1)} min`);
        
        // Save progress after each track
        fs.writeFileSync('./data/optimal-locations.json', JSON.stringify(results, null, 2));
    }
    
    const totalTime = (Date.now() - startTime) / 1000 / 60;
    
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║                  COMPUTATION COMPLETE!                   ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');
    console.log(`Processed ${tracks.length} tracks in ${totalTime.toFixed(1)} minutes`);
    console.log(`Results saved to: ./data/optimal-locations.json`);
    console.log(`File size: ${(fs.statSync('./data/optimal-locations.json').size / 1024).toFixed(1)} KB\n`);
}

// Run it!
main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
