#!/usr/bin/env node

/**
 * Burden Matrix Generator
 * 
 * Pre-computes a matrix of commute burdens:
 * - Rows: Test points across South Florida (400 points in 20x20 grid)
 * - Columns: Unique rotation configurations (~50-60 rotations)
 * - Values: Annual commute burden (hours) from that home to that rotation
 * 
 * This one-time calculation enables instant track evaluation without API calls.
 * 
 * Runtime: ~1-2 hours (50 rotations × 400 points × 200ms API delay)
 */

const fs = require('fs');
const https = require('https');

console.log('=================================');
console.log('Burden Matrix Generator');
console.log('=================================\n');

// Configuration
const NSU_COORDS = { lat: 26.082, lng: -80.249 };
const API_DELAY_MS = 200;
const GRID_SIZE = 20; // 20x20 = 400 test points
const MIN_LAT = 25.5, MAX_LAT = 26.8;
const MIN_LNG = -80.5, MAX_LNG = -80.0;

// Load data
console.log('Loading data files...');

let locations = {};
let tracks = [];
let variance = {};

// Parse CSV
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

// Load locations
const locationsText = fs.readFileSync('../data/Locations.csv', 'utf8');
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

// Load tracks
const tracksText = fs.readFileSync('../data/Tracks.csv', 'utf8');
tracks = parseCSV(tracksText).filter(row => row['Current Track'] && row['Current Track'].trim() !== '');

// Load variance
const varianceText = fs.readFileSync('../data/Variance.csv', 'utf8');
const varianceData = parseCSV(varianceText);
varianceData.forEach(row => {
    if (row.Block) {
        variance[row.Block] = row;
    }
});

console.log(`Loaded ${Object.keys(locations).length} locations`);
console.log(`Loaded ${tracks.length} tracks`);
console.log(`Loaded ${Object.keys(variance).length} variance entries\n`);

// Extract unique rotations
console.log('Extracting unique rotations...');
const uniqueRotations = new Set();
tracks.forEach(track => {
    const columns = Object.keys(track).filter(k => k !== 'Current Track');
    columns.forEach(col => {
        const rotation = track[col];
        if (rotation && rotation.trim() !== '') {
            uniqueRotations.add(rotation);
        }
    });
});

const rotationsList = Array.from(uniqueRotations).sort();
console.log(`Found ${rotationsList.length} unique rotations\n`);

// Generate test points grid
console.log('Generating test points grid...');
const testPoints = [];
const latStep = (MAX_LAT - MIN_LAT) / GRID_SIZE;
const lngStep = (MAX_LNG - MIN_LNG) / GRID_SIZE;

for (let i = 0; i <= GRID_SIZE; i++) {
    for (let j = 0; j <= GRID_SIZE; j++) {
        testPoints.push({
            lat: MIN_LAT + (i * latStep),
            lng: MIN_LNG + (j * lngStep)
        });
    }
}

console.log(`Generated ${testPoints.length} test points\n`);

// Utility functions
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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

// Calculate burden for a rotation from a home point
async function calculateRotationBurden(rotationName, homeCoords, useApi = true) {
    // Handle TBD blocks by averaging across all possible locations
    if (rotationName.includes('To Be Determined')) {
        const blockType = rotationName.split('@')[0].trim();
        
        // Find all possible locations for this block type
        const possibleBlocks = Object.keys(variance).filter(key => 
            key.includes(blockType) && !key.includes('To Be Determined')
        );
        
        if (possibleBlocks.length === 0) {
            console.warn(`  Warning: No variance entries for TBD block type: ${blockType}`);
            return 0;
        }
        
        // Calculate burden for each possible location
        let totalBurden = 0;
        for (const blockName of possibleBlocks) {
            const burden = await calculateRotationBurden(blockName, homeCoords, useApi);
            totalBurden += burden;
        }
        
        // Return average
        return totalBurden / possibleBlocks.length;
    }
    
    const varData = variance[rotationName];
    if (!varData) {
        console.warn(`  Warning: No variance data for ${rotationName}`);
        return 0;
    }
    
    const blockLocations = varData.Locations.split(',').map(l => l.trim()).filter(Boolean);
    const isPediatrics = rotationName.includes('Pediatrics Clerkship @ Nemours');
    
    // Nemours blocks = 0 commute (except pediatrics week 4)
    if (!isPediatrics && blockLocations.some(loc => loc.toLowerCase().includes('nemours'))) {
        return 0;
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
        return totalHours;
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
    
    return totalHours;
}

// Main matrix generation
async function generateBurdenMatrix() {
    console.log('=================================');
    console.log('Generating Burden Matrix');
    console.log('=================================\n');
    
    const totalCalculations = rotationsList.length * testPoints.length;
    const estimatedTime = (totalCalculations * API_DELAY_MS / 1000 / 60).toFixed(1);
    
    console.log(`Total calculations: ${totalCalculations.toLocaleString()}`);
    console.log(`Estimated time: ~${estimatedTime} minutes\n`);
    
    const burdenMatrix = {
        metadata: {
            generated: new Date().toISOString(),
            gridSize: GRID_SIZE,
            testPoints: testPoints.length,
            rotations: rotationsList.length,
            bounds: { minLat: MIN_LAT, maxLat: MAX_LAT, minLng: MIN_LNG, maxLng: MAX_LNG }
        },
        rotations: rotationsList,
        testPoints: testPoints,
        burdens: [] // Will be array of arrays: burdens[pointIndex][rotationIndex]
    };
    
    const startTime = Date.now();
    let completedCalculations = 0;
    
    // For each test point
    for (let pointIdx = 0; pointIdx < testPoints.length; pointIdx++) {
        const point = testPoints[pointIdx];
        const pointBurdens = [];
        
        // For each rotation
        for (let rotIdx = 0; rotIdx < rotationsList.length; rotIdx++) {
            const rotation = rotationsList[rotIdx];
            
            const burden = await calculateRotationBurden(rotation, point, true);
            pointBurdens.push(burden);
            
            completedCalculations++;
            
            // Progress update every 100 calculations
            if (completedCalculations % 100 === 0) {
                const pct = (completedCalculations / totalCalculations * 100).toFixed(1);
                const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
                const remaining = ((totalCalculations - completedCalculations) * API_DELAY_MS / 1000 / 60).toFixed(1);
                console.log(`  ${pct}% (${completedCalculations}/${totalCalculations}) - Elapsed: ${elapsed}m - Remaining: ~${remaining}m`);
            }
        }
        
        burdenMatrix.burdens.push(pointBurdens);
    }
    
    const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    
    console.log('\n✓ Matrix generation complete!\n');
    console.log(`Total time: ${totalTime} minutes`);
    console.log(`Matrix size: ${testPoints.length} points × ${rotationsList.length} rotations\n`);
    
    return burdenMatrix;
}

// Save matrix
async function main() {
    const matrix = await generateBurdenMatrix();
    
    console.log('Saving burden matrix...');
    const outputPath = '../data/burden-matrix.json';
    fs.writeFileSync(outputPath, JSON.stringify(matrix, null, 2));
    
    const fileSizeKB = (fs.statSync(outputPath).size / 1024).toFixed(1);
    
    console.log(`✓ Saved to ${outputPath}`);
    console.log(`  File size: ${fileSizeKB} KB\n`);
    
    console.log('=================================');
    console.log('Matrix Ready for Use!');
    console.log('=================================');
    console.log('You can now run instant track evaluations without API calls.');
    console.log('Next step: Run optimize-tracks-matrix.js\n');
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
