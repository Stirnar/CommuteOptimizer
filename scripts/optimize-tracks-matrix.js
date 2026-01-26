#!/usr/bin/env node

/**
 * Matrix-Based Track Optimizer
 * 
 * Uses pre-computed burden matrix for instant track evaluation.
 * Can run 100,000+ iterations in seconds instead of hours.
 * 
 * Optimizes for ACTUAL commute burden reduction, not geographic clustering.
 */

const fs = require('fs');

console.log('=================================');
console.log('Matrix-Based Track Optimizer');
console.log('Simulated Annealing with Real Burden');
console.log('=================================\n');

// Configuration
const ITERATIONS = 100000;  // Can do way more since evaluation is instant!
const INITIAL_TEMP = 100;
const COOLING_RATE = 0.99995;

// Load data
console.log('Loading data files...');

const burdenMatrix = JSON.parse(fs.readFileSync('../data/burden-matrix.json', 'utf8'));
const tracksText = fs.readFileSync('../data/Tracks.csv', 'utf8');

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

const originalTracks = parseCSV(tracksText).filter(row => row['Current Track'] && row['Current Track'].trim() !== '');
const timeColumns = Object.keys(originalTracks[0]).filter(k => k !== 'Current Track');

console.log(`Loaded burden matrix: ${burdenMatrix.testPoints.length} points × ${burdenMatrix.rotations.length} rotations`);
console.log(`Loaded ${originalTracks.length} tracks\n`);

// Helper functions
function getRotationType(rotationName) {
    if (rotationName.includes('Surgery Clerkship')) return 'Surgery';
    if (rotationName.includes('Internal Medicine Clerkship')) return 'IM';
    if (rotationName.includes('Pediatrics Clerkship')) return 'Pediatrics';
    if (rotationName.includes('Psychiatry Clerkship')) return 'Psychiatry';
    if (rotationName.includes('Obstetrics and Gynecology Clerkship')) return 'OB/GYN';
    if (rotationName.includes('Radiology Clerkship')) return 'Radiology';
    if (rotationName.includes('Primary Care Medicine Clerkship')) return 'Primary Care';
    if (rotationName.includes('Selective')) return 'Selective';
    return 'Unknown';
}

// Identify blocks
console.log('Identifying 8-week blocks...');

function identifyBlocks(track, timeColumns) {
    const blocks = [];
    let i = 0;
    
    while (i < timeColumns.length) {
        const column = timeColumns[i];
        const rotation = track[column];
        
        if (i + 1 < timeColumns.length) {
            const nextColumn = timeColumns[i + 1];
            const nextRotation = track[nextColumn];
            
            if (rotation === nextRotation && 
                (rotation.includes('Surgery Clerkship') || rotation.includes('Internal Medicine Clerkship'))) {
                blocks.push({
                    type: '8-week',
                    columns: [column, nextColumn],
                    rotation: rotation,
                    rotationType: getRotationType(rotation)
                });
                i += 2;
                continue;
            }
        }
        
        blocks.push({
            type: '4-week',
            columns: [column],
            rotation: rotation,
            rotationType: getRotationType(rotation)
        });
        i++;
    }
    
    return blocks;
}

const trackBlocks = originalTracks.map(track => ({
    trackName: track['Current Track'],
    blocks: identifyBlocks(track, timeColumns)
}));

const blockPositions = trackBlocks[0].blocks.length;
console.log(`✓ Identified ${blockPositions} block positions\n`);

// MATRIX-BASED EVALUATION FUNCTIONS

// Evaluate a track using the burden matrix
function evaluateTrackBurden(trackBlock) {
    // Extract rotations from track
    const rotations = trackBlock.blocks.map(b => b.rotation);
    
    // Get rotation indices in matrix
    const rotationIndices = [];
    const missingRotations = [];
    
    for (const rot of rotations) {
        const idx = burdenMatrix.rotations.indexOf(rot);
        if (idx !== -1) {
            rotationIndices.push(idx);
        } else if (rot.includes('To Be Determined')) {
            // TBD rotations should be in the matrix now (as averages)
            missingRotations.push(rot);
        } else {
            console.warn(`Warning: Rotation not in matrix: ${rot}`);
            missingRotations.push(rot);
        }
    }
    
    if (missingRotations.length > 0 && missingRotations.length === rotations.length) {
        // All rotations missing - something is wrong
        console.error(`Error: No valid rotations for track ${trackBlock.trackName}`);
        return { burden: 999999, optimalPointIdx: 0, optimalPoint: burdenMatrix.testPoints[0] };
    }
    
    // Find optimal home point (point with minimum total burden)
    let minBurden = Infinity;
    let bestPointIdx = -1;
    
    for (let pointIdx = 0; pointIdx < burdenMatrix.testPoints.length; pointIdx++) {
        let totalBurden = 0;
        
        for (const rotIdx of rotationIndices) {
            totalBurden += burdenMatrix.burdens[pointIdx][rotIdx];
        }
        
        if (totalBurden < minBurden) {
            minBurden = totalBurden;
            bestPointIdx = pointIdx;
        }
    }
    
    return {
        burden: minBurden,
        optimalPointIdx: bestPointIdx,
        optimalPoint: burdenMatrix.testPoints[bestPointIdx]
    };
}

// Calculate total system burden
function calculateTotalBurden(allTrackBlocks) {
    return allTrackBlocks.reduce((sum, tb) => sum + evaluateTrackBurden(tb).burden, 0);
}

// Pre-compute initial burdens
console.log('Calculating initial burdens...');
const initialBurdens = trackBlocks.map(tb => evaluateTrackBurden(tb).burden);
const initialTotal = initialBurdens.reduce((sum, b) => sum + b, 0);
console.log(`Initial total burden: ${initialTotal.toFixed(2)} hrs\n`);

// Simulated Annealing
console.log('Running matrix-based optimization...');
console.log(`Iterations: ${ITERATIONS.toLocaleString()}\n`);

let currentTracks = JSON.parse(JSON.stringify(trackBlocks));
let currentBurdens = [...initialBurdens];
let currentTotal = initialTotal;

let bestTracks = JSON.parse(JSON.stringify(currentTracks));
let bestBurdens = [...currentBurdens];
let bestTotal = currentTotal;

let temperature = INITIAL_TEMP;
let acceptedSwaps = 0;
let improvingSwaps = 0;
let validSwapsAttempted = 0;

const startTime = Date.now();

for (let iter = 0; iter < ITERATIONS; iter++) {
    // Pick two random tracks
    const track1Idx = Math.floor(Math.random() * currentTracks.length);
    let track2Idx = Math.floor(Math.random() * currentTracks.length);
    while (track2Idx === track1Idx) {
        track2Idx = Math.floor(Math.random() * currentTracks.length);
    }
    
    const blockPos = Math.floor(Math.random() * blockPositions);
    
    const block1 = currentTracks[track1Idx].blocks[blockPos];
    const block2 = currentTracks[track2Idx].blocks[blockPos];
    
    // Validation checks
    if (block1.rotationType !== block2.rotationType) continue;
    if (block1.columns.length !== block2.columns.length) continue;
    
    let columnsMatch = true;
    for (let i = 0; i < block1.columns.length; i++) {
        if (block1.columns[i] !== block2.columns[i]) {
            columnsMatch = false;
            break;
        }
    }
    if (!columnsMatch) continue;
    
    validSwapsAttempted++;
    
    // Swap rotations
    const tempRotation = block1.rotation;
    currentTracks[track1Idx].blocks[blockPos].rotation = block2.rotation;
    currentTracks[track2Idx].blocks[blockPos].rotation = tempRotation;
    
    // INSTANT evaluation using matrix!
    const newBurden1 = evaluateTrackBurden(currentTracks[track1Idx]).burden;
    const newBurden2 = evaluateTrackBurden(currentTracks[track2Idx]).burden;
    
    const oldBurden1 = currentBurdens[track1Idx];
    const oldBurden2 = currentBurdens[track2Idx];
    
    const newTotal = currentTotal - (oldBurden1 + oldBurden2) + (newBurden1 + newBurden2);
    const delta = newTotal - currentTotal;
    
    let accept = false;
    
    if (delta < 0) {
        accept = true;
        improvingSwaps++;
    } else {
        const probability = Math.exp(-delta / temperature);
        if (Math.random() < probability) {
            accept = true;
        }
    }
    
    if (accept) {
        currentBurdens[track1Idx] = newBurden1;
        currentBurdens[track2Idx] = newBurden2;
        currentTotal = newTotal;
        acceptedSwaps++;
        
        if (newTotal < bestTotal) {
            bestTotal = newTotal;
            bestTracks = JSON.parse(JSON.stringify(currentTracks));
            bestBurdens = [...currentBurdens];
        }
    } else {
        // Undo swap
        currentTracks[track1Idx].blocks[blockPos].rotation = block1.rotation;
        currentTracks[track2Idx].blocks[blockPos].rotation = block2.rotation;
    }
    
    temperature *= COOLING_RATE;
    
    if ((iter + 1) % 10000 === 0) {
        const progress = ((iter + 1) / ITERATIONS * 100).toFixed(1);
        const improvement = ((initialTotal - bestTotal) / initialTotal * 100).toFixed(2);
        console.log(`  ${progress}% - Best improvement: ${improvement}% (${(initialTotal - bestTotal).toFixed(1)} hrs saved)`);
    }
}

const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

console.log(`\n✓ Complete! Time: ${elapsed}s\n`);

// Results
console.log('=================================');
console.log('Results');
console.log('=================================\n');

const totalReduction = initialTotal - bestTotal;
const reductionPct = (totalReduction / initialTotal * 100);

console.log(`Initial total burden: ${initialTotal.toFixed(2)} hrs`);
console.log(`Optimized total burden: ${bestTotal.toFixed(2)} hrs`);
console.log(`Reduction: ${totalReduction.toFixed(2)} hrs (${reductionPct.toFixed(2)}%)\n`);

console.log(`Valid swaps attempted: ${validSwapsAttempted.toLocaleString()}`);
console.log(`Swaps accepted: ${acceptedSwaps.toLocaleString()} (${(acceptedSwaps/validSwapsAttempted*100).toFixed(1)}%)`);
console.log(`Improving swaps: ${improvingSwaps.toLocaleString()}\n`);

// Calculate equity metrics
const initialStdDev = Math.sqrt(initialBurdens.reduce((sum, b) => 
    sum + Math.pow(b - initialTotal/initialBurdens.length, 2), 0) / initialBurdens.length);
const bestStdDev = Math.sqrt(bestBurdens.reduce((sum, b) => 
    sum + Math.pow(b - bestTotal/bestBurdens.length, 2), 0) / bestBurdens.length);

console.log('Equity (Standard Deviation):');
console.log(`  Initial: ${initialStdDev.toFixed(2)} hrs`);
console.log(`  Optimized: ${bestStdDev.toFixed(2)} hrs`);
console.log(`  Change: ${(bestStdDev - initialStdDev).toFixed(2)} hrs (${((bestStdDev - initialStdDev)/initialStdDev*100).toFixed(1)}%)`);
console.log(`  ${bestStdDev < initialStdDev ? '✓ More equitable' : '⚠️  Less equitable'}\n`);

// Per-track analysis
const trackChanges = trackBlocks.map((tb, idx) => ({
    name: tb.trackName,
    original: initialBurdens[idx],
    optimized: bestBurdens[idx],
    change: bestBurdens[idx] - initialBurdens[idx]
})).sort((a, b) => a.change - b.change);

console.log('Top 5 Most Improved:');
trackChanges.slice(0, 5).forEach((t, idx) => {
    console.log(`${idx + 1}. ${t.name}: ${t.original.toFixed(1)} → ${t.optimized.toFixed(1)} hrs (${t.change.toFixed(1)} hrs)`);
});

console.log('\nTop 5 Increased Burden:');
trackChanges.slice(-5).reverse().forEach((t, idx) => {
    console.log(`${idx + 1}. ${t.name}: ${t.original.toFixed(1)} → ${t.optimized.toFixed(1)} hrs (+${t.change.toFixed(1)} hrs)`);
});

console.log('');

// Save optimized tracks
const optimizedTracks = bestTracks.map(trackBlock => {
    const track = { 'Current Track': trackBlock.trackName };
    trackBlock.blocks.forEach(block => {
        block.columns.forEach(column => {
            track[column] = block.rotation;
        });
    });
    return track;
});

function arrayToCSV(data, allColumns) {
    const headers = ['Current Track', ...allColumns];
    const rows = data.map(row => 
        headers.map(h => {
            const value = row[h] || '';
            return value.includes(',') ? `"${value}"` : value;
        }).join(',')
    );
    return [headers.join(','), ...rows].join('\n');
}

fs.writeFileSync('../data/Tracks-Optimized-Matrix.csv', arrayToCSV(optimizedTracks, timeColumns));
console.log('✓ Saved to ../data/Tracks-Optimized-Matrix.csv\n');

// Save detailed results
const report = {
    timestamp: new Date().toISOString(),
    algorithm: 'simulated_annealing_matrix',
    iterations: ITERATIONS,
    validSwapsAttempted,
    timeElapsed: elapsed,
    initialBurden: initialTotal,
    optimizedBurden: bestTotal,
    reduction: totalReduction,
    reductionPercent: reductionPct,
    initialStdDev,
    optimizedStdDev: bestStdDev,
    trackChanges: {
        improved: trackChanges.filter(t => t.change < -1).length,
        worsened: trackChanges.filter(t => t.change > 1).length,
        unchanged: trackChanges.filter(t => Math.abs(t.change) <= 1).length
    }
};

fs.writeFileSync('../data/optimization-matrix-report.json', JSON.stringify(report, null, 2));
console.log('✓ Saved report to ../data/optimization-matrix-report.json\n');

console.log('=================================');
console.log('Summary');
console.log('=================================\n');

if (reductionPct > 10) {
    console.log(`🎉 Excellent! ${reductionPct.toFixed(1)}% reduction in total burden!`);
} else if (reductionPct > 5) {
    console.log(`✓ Good! ${reductionPct.toFixed(1)}% reduction in total burden.`);
} else if (reductionPct > 0) {
    console.log(`⚠️  Modest: ${reductionPct.toFixed(1)}% reduction.`);
} else {
    console.log(`❌ No improvement: ${reductionPct.toFixed(1)}% change.`);
}

console.log(`Equity ${bestStdDev < initialStdDev ? 'improved' : 'worsened'} by ${Math.abs((bestStdDev - initialStdDev)/initialStdDev*100).toFixed(1)}%\n`);
