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
const optimalLocations = JSON.parse(fs.readFileSync('./data/optimal-locations.json', 'utf8'));
const rotationBurdens = JSON.parse(fs.readFileSync('./data/rotation-burdens.json', 'utf8'));

console.log('=================================');
console.log('Validation: Track vs Block Optimization');
console.log('=================================\n');

const results = [];

// For each track, compare:
// 1. Actual optimal location for the full track (from optimal-locations.json)
// 2. Average optimal location across individual blocks (from rotation-burdens.json)
for (const [trackName, trackData] of Object.entries(optimalLocations)) {
    const trackOptimal = trackData.optimalLocation;
    const trackBurden = trackData.minCommuteBurden;
    
    // Calculate average optimal location from individual blocks
    let blockLats = [];
    let blockLngs = [];
    let blockBurdens = [];
    let missingBlocks = [];
    
    trackData.blockDetails.forEach(block => {
        const blockName = block.block;
        const blockBurdenData = rotationBurdens[blockName];
        
        if (blockBurdenData && blockBurdenData.optimalLocation) {
            blockLats.push(blockBurdenData.optimalLocation.lat);
            blockLngs.push(blockBurdenData.optimalLocation.lng);
            blockBurdens.push(blockBurdenData.minBurden);
        } else {
            missingBlocks.push(blockName);
        }
    });
    
    if (blockLats.length === 0) {
        console.log(`⚠️  ${trackName}: No block optimal locations found`);
        continue;
    }
    
    const avgBlockOptimal = {
        lat: blockLats.reduce((a, b) => a + b, 0) / blockLats.length,
        lng: blockLngs.reduce((a, b) => a + b, 0) / blockLngs.length
    };
    
    const sumBlockBurdens = blockBurdens.reduce((a, b) => a + b, 0);
    
    // Calculate distance between track optimal and average block optimal
    const latDiff = Math.abs(trackOptimal.lat - avgBlockOptimal.lat);
    const lngDiff = Math.abs(trackOptimal.lng - avgBlockOptimal.lng);
    const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
    
    // Calculate burden difference
    const burdenDiff = Math.abs(trackBurden - sumBlockBurdens);
    const burdenPctDiff = (burdenDiff / trackBurden * 100);
    
    results.push({
        trackName,
        trackOptimal,
        avgBlockOptimal,
        distance,
        trackBurden,
        sumBlockBurdens,
        burdenDiff,
        burdenPctDiff,
        missingBlocks
    });
}

// Sort by distance (to find outliers)
results.sort((a, b) => b.distance - a.distance);

console.log('Top 10 Tracks with Largest Location Discrepancy:');
console.log('=================================\n');

results.slice(0, 10).forEach((r, idx) => {
    console.log(`${idx + 1}. ${r.trackName}`);
    console.log(`   Track optimal: (${r.trackOptimal.lat.toFixed(4)}, ${r.trackOptimal.lng.toFixed(4)})`);
    console.log(`   Avg block optimal: (${r.avgBlockOptimal.lat.toFixed(4)}, ${r.avgBlockOptimal.lng.toFixed(4)})`);
    console.log(`   Distance: ${r.distance.toFixed(4)} degrees (~${(r.distance * 69).toFixed(1)} miles)`);
    console.log(`   Track burden: ${r.trackBurden.toFixed(1)} hrs`);
    console.log(`   Sum block burdens: ${r.sumBlockBurdens.toFixed(1)} hrs`);
    console.log(`   Burden difference: ${r.burdenDiff.toFixed(1)} hrs (${r.burdenPctDiff.toFixed(1)}%)`);
    if (r.missingBlocks.length > 0) {
        console.log(`   ⚠️  Missing blocks: ${r.missingBlocks.length}`);
    }
    console.log('');
});

// Sort by burden difference
results.sort((a, b) => b.burdenPctDiff - a.burdenPctDiff);

console.log('\nTop 10 Tracks with Largest Burden Discrepancy:');
console.log('=================================\n');

results.slice(0, 10).forEach((r, idx) => {
    console.log(`${idx + 1}. ${r.trackName}`);
    console.log(`   Track burden: ${r.trackBurden.toFixed(1)} hrs`);
    console.log(`   Sum block burdens: ${r.sumBlockBurdens.toFixed(1)} hrs`);
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
