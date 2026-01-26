#!/usr/bin/env node

/**
 * Validate Burden Matrix
 * 
 * Compares matrix-based track evaluations against actual API calculations
 * to verify the matrix approach is accurate.
 * 
 * Tests a sample of tracks to ensure matrix lookups give similar results.
 */

const fs = require('fs');
const https = require('https');

console.log('=================================');
console.log('Burden Matrix Validator');
console.log('=================================\n');

// Configuration
const NSU_COORDS = { lat: 26.082, lng: -80.249 };
const API_DELAY_MS = 200;
const SAMPLE_SIZE = 5; // Test 5 random tracks

// Load data
console.log('Loading data files...');

const burdenMatrix = JSON.parse(fs.readFileSync('../data/burden-matrix.json', 'utf8'));
const optimalLocations = JSON.parse(fs.readFileSync('../data/optimal-locations.json', 'utf8'));

console.log(`Matrix has ${burdenMatrix.testPoints.length} test points\n`);

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

const tracksText = fs.readFileSync('../data/Tracks.csv', 'utf8');
const allTracks = parseCSV(tracksText).filter(row => row['Current Track'] && row['Current Track'].trim() !== '');

// Select random tracks to test
const trackIndices = [];
while (trackIndices.length < Math.min(SAMPLE_SIZE, allTracks.length)) {
    const idx = Math.floor(Math.random() * allTracks.length);
    if (!trackIndices.includes(idx)) {
        trackIndices.push(idx);
    }
}

const sampleTracks = trackIndices.map(idx => allTracks[idx]);

console.log(`Testing ${sampleTracks.length} random tracks:\n`);

// Matrix-based evaluation
function evaluateTrackWithMatrix(track) {
    const timeColumns = Object.keys(track).filter(k => k !== 'Current Track');
    const rotations = timeColumns.map(col => track[col]).filter(r => r && r.trim() !== '');
    
    const rotationIndices = rotations.map(rot => burdenMatrix.rotations.indexOf(rot)).filter(idx => idx !== -1);
    
    let minBurden = Infinity;
    let bestPoint = null;
    
    for (let pointIdx = 0; pointIdx < burdenMatrix.testPoints.length; pointIdx++) {
        let totalBurden = 0;
        
        for (const rotIdx of rotationIndices) {
            totalBurden += burdenMatrix.burdens[pointIdx][rotIdx];
        }
        
        if (totalBurden < minBurden) {
            minBurden = totalBurden;
            bestPoint = burdenMatrix.testPoints[pointIdx];
        }
    }
    
    return { burden: minBurden, optimalPoint: bestPoint };
}

// Compare results
async function validateTracks() {
    console.log('Comparing matrix vs. actual optimal locations:\n');
    
    const comparisons = [];
    
    for (const track of sampleTracks) {
        const trackName = track['Current Track'];
        
        // Matrix evaluation
        const matrixResult = evaluateTrackWithMatrix(track);
        
        // Actual optimal location (from generate-optimal-data.js)
        const actualOptimal = optimalLocations[trackName];
        
        if (!actualOptimal) {
            console.log(`⚠️  ${trackName}: Not in optimal-locations.json (skipping)\n`);
            continue;
        }
        
        const matrixBurden = matrixResult.burden;
        const actualBurden = actualOptimal.minCommuteBurden;
        const difference = Math.abs(matrixBurden - actualBurden);
        const percentDiff = (difference / actualBurden * 100);
        
        console.log(`${trackName}:`);
        console.log(`  Matrix burden:  ${matrixBurden.toFixed(2)} hrs`);
        console.log(`  Actual burden:  ${actualBurden.toFixed(2)} hrs`);
        console.log(`  Difference:     ${difference.toFixed(2)} hrs (${percentDiff.toFixed(2)}%)`);
        console.log(`  Matrix optimal: (${matrixResult.optimalPoint.lat.toFixed(4)}, ${matrixResult.optimalPoint.lng.toFixed(4)})`);
        console.log(`  Actual optimal: (${actualOptimal.optimalLocation.lat.toFixed(4)}, ${actualOptimal.optimalLocation.lng.toFixed(4)})`);
        
        if (percentDiff < 5) {
            console.log(`  ✓ Close match!\n`);
        } else if (percentDiff < 10) {
            console.log(`  ⚠️  Acceptable difference\n`);
        } else {
            console.log(`  ❌ Large difference\n`);
        }
        
        comparisons.push({
            track: trackName,
            matrixBurden,
            actualBurden,
            difference,
            percentDiff
        });
    }
    
    // Summary
    console.log('=================================');
    console.log('Validation Summary');
    console.log('=================================\n');
    
    const avgDiff = comparisons.reduce((sum, c) => sum + c.percentDiff, 0) / comparisons.length;
    const maxDiff = Math.max(...comparisons.map(c => c.percentDiff));
    
    console.log(`Tracks tested: ${comparisons.length}`);
    console.log(`Average difference: ${avgDiff.toFixed(2)}%`);
    console.log(`Max difference: ${maxDiff.toFixed(2)}%\n`);
    
    if (avgDiff < 5) {
        console.log('✅ VALIDATION PASSED');
        console.log('   Matrix-based evaluation is accurate!\n');
    } else if (avgDiff < 10) {
        console.log('⚠️  ACCEPTABLE');
        console.log('   Matrix is close enough for optimization.\n');
    } else {
        console.log('❌ VALIDATION FAILED');
        console.log('   Matrix may not be accurate enough.\n');
    }
    
    console.log('Note: Small differences are expected because:');
    console.log('- Matrix uses 20x20 grid (400 points)');
    console.log('- Actual optimization uses finer refinement');
    console.log('- Both are approximations of true optimal home\n');
}

validateTracks().catch(error => {
    console.error('Validation error:', error);
    process.exit(1);
});
