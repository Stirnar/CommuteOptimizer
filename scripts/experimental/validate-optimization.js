#!/usr/bin/env node

/**
 * Validation Script: Compare Track-Level vs Block-Level Optimization
 * 
 * This script validates whether calculating burden per rotation (block-level)
 * gives us accurate information for optimizing full tracks (track-level).
 * 
 * Comparison:
 * - Track-level: Find ONE optimal location for entire track (what students actually do)
 * - Block-level: Average the optimal locations for each individual block
 * 
 * If these match closely, our rotation-level optimization is valid!
 */

const fs = require('fs');

// Load the data
const optimalLocations = JSON.parse(fs.readFileSync('../../data/optimal-locations.json', 'utf8'));
const rotationBurdens = JSON.parse(fs.readFileSync('../../data/rotation-burdens.json', 'utf8'));

console.log('=================================');
console.log('Validation: Track vs Block Optimization');
console.log('=================================\n');

const results = [];

// For each track, compare:
// 1. Track-level optimal location and burden (from optimal-locations.json)
// 2. Best block-level strategy: Pick one block's optimal and see total track burden
for (const [trackName, trackData] of Object.entries(optimalLocations)) {
    const trackOptimal = trackData.optimalLocation;
    const trackBurden = trackData.minCommuteBurden;
    
    // Strategy: Test each block's optimal location and see which gives lowest total track burden
    // This simulates: "Student picks location optimal for their hardest/favorite rotation"
    
    const blockOptimalStrategies = [];
    
    trackData.blockDetails.forEach(blockDetail => {
        const blockName = blockDetail.block;
        const blockBurdenData = rotationBurdens[blockName];
        
        if (blockBurdenData && blockBurdenData.optimalLocation) {
            // Calculate total track burden if you lived at this block's optimal location
            // We'll sum up: this block's minBurden + other blocks' totalHours (average burden)
            let totalTrackBurden = 0;
            
            trackData.blockDetails.forEach(otherBlock => {
                const otherBlockName = otherBlock.block;
                const otherBlockData = rotationBurdens[otherBlockName];
                
                if (otherBlockData) {
                    if (otherBlockName === blockName) {
                        // For this block, we're at its optimal, so use minBurden
                        totalTrackBurden += otherBlockData.minBurden;
                    } else {
                        // For other blocks, we're not at their optimal, so use average (totalHours)
                        totalTrackBurden += otherBlockData.totalHours;
                    }
                }
            });
            
            blockOptimalStrategies.push({
                blockName: blockName,
                location: blockBurdenData.optimalLocation,
                totalTrackBurden: totalTrackBurden
            });
        }
    });
    
    if (blockOptimalStrategies.length === 0) {
        console.log(`⚠️  ${trackName}: No block data available`);
        continue;
    }
    
    // Find which block's optimal location gives the lowest total track burden
    blockOptimalStrategies.sort((a, b) => a.totalTrackBurden - b.totalTrackBurden);
    const bestBlockStrategy = blockOptimalStrategies[0];
    
    // Compare this to the actual track optimal
    const latDiff = Math.abs(trackOptimal.lat - bestBlockStrategy.location.lat);
    const lngDiff = Math.abs(trackOptimal.lng - bestBlockStrategy.location.lng);
    const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
    
    const burdenDiff = Math.abs(trackBurden - bestBlockStrategy.totalTrackBurden);
    const burdenPctDiff = (burdenDiff / trackBurden * 100);
    
    results.push({
        trackName,
        trackOptimal,
        bestBlockOptimal: bestBlockStrategy.location,
        bestBlockName: bestBlockStrategy.blockName,
        distance,
        trackBurden,
        blockBasedBurden: bestBlockStrategy.totalTrackBurden,
        burdenDiff,
        burdenPctDiff,
        numBlockStrategies: blockOptimalStrategies.length
    });
}

// Sort by distance (to find outliers)
results.sort((a, b) => b.distance - a.distance);

console.log('Top 10 Tracks with Largest Location Discrepancy:');
console.log('=================================\n');

results.slice(0, 10).forEach((r, idx) => {
    console.log(`${idx + 1}. ${r.trackName}`);
    console.log(`   Track optimal: (${r.trackOptimal.lat.toFixed(4)}, ${r.trackOptimal.lng.toFixed(4)})`);
    console.log(`   Best block strategy: ${r.bestBlockName}`);
    console.log(`   Block optimal: (${r.bestBlockOptimal.lat.toFixed(4)}, ${r.bestBlockOptimal.lng.toFixed(4)})`);
    console.log(`   Distance: ${r.distance.toFixed(4)} degrees (~${(r.distance * 69).toFixed(1)} miles)`);
    console.log(`   Track burden: ${r.trackBurden.toFixed(1)} hrs`);
    console.log(`   Block-based burden: ${r.blockBasedBurden.toFixed(1)} hrs`);
    console.log(`   Burden difference: ${r.burdenDiff.toFixed(1)} hrs (${r.burdenPctDiff.toFixed(1)}%)`);
    console.log('');
});

// Sort by burden difference
results.sort((a, b) => b.burdenPctDiff - a.burdenPctDiff);

console.log('\nTop 10 Tracks with Largest Burden Discrepancy:');
console.log('=================================\n');

results.slice(0, 10).forEach((r, idx) => {
    console.log(`${idx + 1}. ${r.trackName}`);
    console.log(`   Track burden: ${r.trackBurden.toFixed(1)} hrs`);
    console.log(`   Block-based burden: ${r.blockBasedBurden.toFixed(1)} hrs`);
    console.log(`   Difference: ${r.burdenDiff.toFixed(1)} hrs (${r.burdenPctDiff.toFixed(1)}%)`);
    console.log('');
});

// Overall statistics
const avgDistance = results.reduce((sum, r) => sum + r.distance, 0) / results.length;
const avgBurdenDiff = results.reduce((sum, r) => sum + r.burdenPctDiff, 0) / results.length;

console.log('\nOverall Statistics:');
console.log('=================================');
console.log(`Tracks analyzed: ${results.length}`);
console.log(`Average location distance: ${avgDistance.toFixed(4)} degrees (~${(avgDistance * 69).toFixed(1)} miles)`);
console.log(`Average burden difference: ${avgBurdenDiff.toFixed(1)}%`);

// Calculate how many tracks have <10% burden difference
const goodMatches = results.filter(r => r.burdenPctDiff < 10).length;
const goodPct = (goodMatches / results.length * 100).toFixed(1);

console.log(`\nTracks within 10% burden match: ${goodMatches}/${results.length} (${goodPct}%)`);

if (avgBurdenDiff < 15) {
    console.log('\n✅ VALIDATION PASSED: Block-level optimization approach is accurate!');
} else {
    console.log('\n⚠️  VALIDATION WARNING: Significant discrepancy detected. Review approach.');
}

console.log('\n=================================');
console.log('Interpretation:');
console.log('- Small location distance = blocks cluster geographically');
console.log('- Small burden difference = block-level burdens are additive');
console.log('- Large discrepancies suggest complex interactions between blocks');
console.log('=================================');