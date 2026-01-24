#!/usr/bin/env node

/**
 * Geographic Clustering Optimizer - Simulated Annealing
 * 
 * Optimizes track assignments by minimizing geographic scatter.
 * Strategy: Assign rotations so each student's rotations cluster geographically,
 * reducing overall commute burden.
 */

const fs = require('fs');

console.log('=================================');
console.log('Geographic Clustering Optimizer');
console.log('Simulated Annealing Algorithm');
console.log('=================================\n');

// Configuration
const ITERATIONS = 10000;
const INITIAL_TEMP = 100;
const COOLING_RATE = 0.9995;

console.log('Loading data files...');

const rotationBurdens = JSON.parse(fs.readFileSync('../../data/rotation-burdens.json', 'utf8'));
const tracksText = fs.readFileSync('../../data/Tracks.csv', 'utf8');

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

console.log(`Loaded ${originalTracks.length} tracks`);
console.log(`Loaded ${Object.keys(rotationBurdens).length} rotation burdens\n`);

// Helper function
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

// Geographic clustering functions
console.log('Calculating geographic clustering metric...');

function getRotationLocation(rotationName) {
    const data = rotationBurdens[rotationName];
    if (!data || !data.optimalLocation) {
        return { lat: 26.0, lng: -80.3 };
    }
    return data.optimalLocation;
}

function calculateDistance(loc1, loc2) {
    const latDiff = loc1.lat - loc2.lat;
    const lngDiff = loc1.lng - loc2.lng;
    return Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
}

function calculateTrackClusteringScore(trackBlock) {
    const locations = trackBlock.blocks.map(block => getRotationLocation(block.rotation));
    
    let sumLat = 0, sumLng = 0, totalWeeks = 0;
    
    trackBlock.blocks.forEach((block, idx) => {
        const weeks = block.type === '8-week' ? 8 : 4;
        sumLat += locations[idx].lat * weeks;
        sumLng += locations[idx].lng * weeks;
        totalWeeks += weeks;
    });
    
    const center = {
        lat: sumLat / totalWeeks,
        lng: sumLng / totalWeeks
    };
    
    let totalDistance = 0;
    trackBlock.blocks.forEach((block, idx) => {
        const weeks = block.type === '8-week' ? 8 : 4;
        const distance = calculateDistance(locations[idx], center);
        totalDistance += distance * weeks;
    });
    
    return totalDistance;
}

function calculateTotalClusteringScore(allTrackBlocks) {
    return allTrackBlocks.reduce((sum, tb) => sum + calculateTrackClusteringScore(tb), 0);
}

const initialScore = calculateTotalClusteringScore(trackBlocks);
console.log(`Initial clustering score: ${initialScore.toFixed(4)}\n`);

// Simulated Annealing
console.log('Running simulated annealing...\n');

let currentTracks = JSON.parse(JSON.stringify(trackBlocks));
let currentScore = initialScore;
let bestTracks = JSON.parse(JSON.stringify(currentTracks));
let bestScore = currentScore;

let temperature = INITIAL_TEMP;
let acceptedSwaps = 0;
let improvingSwaps = 0;

const startTime = Date.now();

for (let iter = 0; iter < ITERATIONS; iter++) {
    const track1Idx = Math.floor(Math.random() * currentTracks.length);
    let track2Idx = Math.floor(Math.random() * currentTracks.length);
    while (track2Idx === track1Idx) {
        track2Idx = Math.floor(Math.random() * currentTracks.length);
    }
    
    const blockPos = Math.floor(Math.random() * blockPositions);
    
    const block1 = currentTracks[track1Idx].blocks[blockPos];
    const block2 = currentTracks[track2Idx].blocks[blockPos];
    
    // CRITICAL: Only swap if rotation types match AND columns match
    if (block1.rotationType !== block2.rotationType) {
        continue;
    }
    
    // Check if blocks occupy the same time columns
    if (block1.columns.length !== block2.columns.length) {
        continue; // Different block lengths (4-week vs 8-week)
    }
    
    // Check that columns are identical
    let columnsMatch = true;
    for (let i = 0; i < block1.columns.length; i++) {
        if (block1.columns[i] !== block2.columns[i]) {
            columnsMatch = false;
            break;
        }
    }
    
    if (!columnsMatch) {
        continue; // Different time periods, can't swap
    }
    
    // Swap ONLY the rotation names, preserving column mappings
    const tempRotation = block1.rotation;
    currentTracks[track1Idx].blocks[blockPos].rotation = block2.rotation;
    currentTracks[track2Idx].blocks[blockPos].rotation = tempRotation;
    
    // Calculate new total score
    const newScore = calculateTotalClusteringScore(currentTracks);
    const delta = newScore - currentScore;
    
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
        currentScore = newScore;
        acceptedSwaps++;
        
        if (newScore < bestScore) {
            bestScore = newScore;
            bestTracks = JSON.parse(JSON.stringify(currentTracks));
        }
    } else {
        // Reject - undo the rotation swap
        const tempRotation = currentTracks[track1Idx].blocks[blockPos].rotation;
        currentTracks[track1Idx].blocks[blockPos].rotation = currentTracks[track2Idx].blocks[blockPos].rotation;
        currentTracks[track2Idx].blocks[blockPos].rotation = tempRotation;
    }
    
    temperature *= COOLING_RATE;
    
    if ((iter + 1) % 1000 === 0) {
        const progress = ((iter + 1) / ITERATIONS * 100).toFixed(1);
        const improvement = ((initialScore - bestScore) / initialScore * 100).toFixed(2);
        console.log(`  ${progress}% - Improvement: ${improvement}% - Temp: ${temperature.toFixed(2)}`);
    }
}

const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

console.log(`\n✓ Complete! Time: ${elapsed}s\n`);

// Results
console.log('=================================');
console.log('Results');
console.log('=================================\n');

const improvement = initialScore - bestScore;
const improvementPct = (improvement / initialScore * 100);

console.log(`Initial score: ${initialScore.toFixed(4)}`);
console.log(`Optimized score: ${bestScore.toFixed(4)}`);
console.log(`Improvement: ${improvementPct.toFixed(2)}%\n`);

console.log(`Swaps accepted: ${acceptedSwaps.toLocaleString()} (${(acceptedSwaps/ITERATIONS*100).toFixed(1)}%)`);
console.log(`Improving swaps: ${improvingSwaps.toLocaleString()}\n`);

// Save
const optimizedTracks = bestTracks.map((trackBlock, trackIdx) => {
    const track = { 'Current Track': trackBlock.trackName };
    
    // Verify we have the right number of blocks
    if (trackBlock.blocks.length !== blockPositions) {
        console.warn(`WARNING: Track ${trackIdx + 1} has ${trackBlock.blocks.length} blocks, expected ${blockPositions}`);
    }
    
    trackBlock.blocks.forEach((block, blockIdx) => {
        // Verify block has columns
        if (!block.columns || block.columns.length === 0) {
            console.warn(`WARNING: Track ${trackIdx + 1}, Block ${blockIdx + 1} has no columns!`);
            console.warn(`Block data:`, JSON.stringify(block));
        }
        
        // Verify block has rotation
        if (!block.rotation) {
            console.warn(`WARNING: Track ${trackIdx + 1}, Block ${blockIdx + 1} has no rotation!`);
        }
        
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

fs.writeFileSync('../../data/Tracks-Optimized-Clustering.csv', arrayToCSV(optimizedTracks, timeColumns));
console.log('✓ Saved to ./data/Tracks-Optimized-Clustering.csv\n');

if (improvementPct > 10) {
    console.log(`🎉 Excellent! ${improvementPct.toFixed(1)}% improvement!`);
} else if (improvementPct > 5) {
    console.log(`✓ Good! ${improvementPct.toFixed(1)}% improvement.`);
} else if (improvementPct > 0) {
    console.log(`⚠️ Modest: ${improvementPct.toFixed(1)}% improvement.`);
} else {
    console.log('❌ No improvement.');
}

console.log('\n=================================\n');
