#!/usr/bin/env node

/**
 * Quick test generator - generates data for just 3 tracks
 * Use this to test the system before running the full generation
 */

const fs = require('fs');
const https = require('https');

// Configuration
const NSU_COORDS = { lat: 26.082, lng: -80.249 };
const API_DELAY_MS = 200;
const GRID_SIZE = 10; // Smaller grid for faster testing (10x10 = 100 points)
const MIN_LAT = 25.5, MAX_LAT = 26.8;
const MIN_LNG = -80.5, MAX_LNG = -80.0;
const TRACKS_TO_TEST = 3; // Only process first 3 tracks

let locations = {};
let tracks = [];
let variance = {};

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
    
    const locationsText = fs.readFileSync('./data/Locations.csv', 'utf8');
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
    
    const tracksText = fs.readFileSync('./data/Tracks.csv', 'utf8');
    tracks = parseCSV(tracksText).filter(row => row['Current Track'] && row['Current Track'].trim() !== '');
    
    const varianceText = fs.readFileSync('./data/Variance.csv', 'utf8');
    const varianceData = parseCSV(varianceText);
    varianceData.forEach(row => {
        if (row.Block) {
            variance[row.Block] = row;
        }
    });
    
    console.log(`Loaded ${Object.keys(locations).length} locations`);
    console.log(`Loaded ${tracks.length} tracks (will process first ${TRACKS_TO_TEST})`);
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

async function calculateBlockCommute(blockName, homeCoords, useApi = true) {
    const varData = variance[blockName];
    if (!varData) {
        return null;
    }
    
    const blockLocations = varData.Locations.split(',').map(l => l.trim()).filter(Boolean);
    const isPediatrics = blockName.includes('Pediatrics Clerkship @ Nemours');
    
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

async function findOptimalLocation(trackData) {
    console.log(`  Finding optimal location...`);
    
    const latStep = (MAX_LAT - MIN_LAT) / GRID_SIZE;
    const lngStep = (MAX_LNG - MIN_LNG) / GRID_SIZE;
    
    let candidates = [];
    
    console.log(`    Scanning ${(GRID_SIZE + 1) * (GRID_SIZE + 1)} grid points...`);
    for (let i = 0; i <= GRID_SIZE; i++) {
        for (let j = 0; j <= GRID_SIZE; j++) {
            const testCoords = {
                lat: MIN_LAT + (i * latStep),
                lng: MIN_LNG + (j * lngStep)
            };
            
            const result = await calculateTrackCommute(trackData, testCoords, false);
            candidates.push({ coords: testCoords, hours: result.totalHours });
        }
    }
    
    candidates.sort((a, b) => a.hours - b.hours);
    
    console.log(`    Refining top 3 candidates...`);
    let bestLocation = null;
    let minTotalHours = Infinity;
    
    const topCandidates = candidates.slice(0, 3);
    
    for (const candidate of topCandidates) {
        const result = await calculateTrackCommute(trackData, candidate.coords, true);
        if (result.totalHours < minTotalHours) {
            minTotalHours = result.totalHours;
            bestLocation = candidate.coords;
        }
    }
    
    return bestLocation || topCandidates[0].coords;
}

async function main() {
    console.log('=================================');
    console.log('Quick Test Generator (3 tracks)');
    console.log('=================================\n');
    
    if (!fs.existsSync('./data')) {
        console.error('ERROR: ./data directory not found!');
        process.exit(1);
    }
    
    loadData();
    
    const results = {};
    const startTime = Date.now();
    
    const tracksToProcess = tracks.slice(0, TRACKS_TO_TEST);
    console.log(`\nProcessing first ${tracksToProcess.length} tracks...\n`);
    
    for (let i = 0; i < tracksToProcess.length; i++) {
        const track = tracksToProcess[i];
        const trackName = track['Current Track'];
        
        console.log(`[${i + 1}/${tracksToProcess.length}] ${trackName}`);
        
        const optimalCoords = await findOptimalLocation(track);
        
        console.log(`    Calculating full commute burden...`);
        const commuteResults = await calculateTrackCommute(track, optimalCoords, true);
        
        results[trackName] = {
            optimalLocation: optimalCoords,
            minCommuteBurden: commuteResults.totalHours,
            totalMiles: commuteResults.totalMiles,
            totalWeeks: commuteResults.totalWeeks,
            blockDetails: commuteResults.blockDetails
        };
        
        console.log(`    ✓ Optimal: ${optimalCoords.lat.toFixed(4)}, ${optimalCoords.lng.toFixed(4)}`);
        console.log(`    ✓ Burden: ${commuteResults.totalHours.toFixed(1)} hrs/year\n`);
    }
    
    const outputPath = './data/optimal-locations-test.json';
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log('=================================');
    console.log('✓ Test generation complete!');
    console.log(`  File: ${outputPath}`);
    console.log(`  Tracks processed: ${Object.keys(results).length}`);
    console.log(`  Time: ${elapsed} seconds`);
    console.log('=================================');
    console.log('\nTo test in your HTML:');
    console.log('  1. Rename optimal-locations-test.json to optimal-locations.json');
    console.log('  2. Load your HTML and test with one of these tracks');
    console.log('  3. Should get instant results!\n');
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
