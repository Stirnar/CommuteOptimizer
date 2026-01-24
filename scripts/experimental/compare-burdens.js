#!/usr/bin/env node

/**
 * Compare Track Burden Statistics
 * 
 * Compares measures of central tendency and distribution between
 * original and optimized track assignments.
 * 
 * Measures:
 * - Mean (average burden)
 * - Median (middle value)
 * - Mode (most common burden range)
 * - Standard deviation (spread/equity)
 * - Min/Max (range)
 * - Quartiles (distribution)
 */

const fs = require('fs');

console.log('=================================');
console.log('Track Burden Comparison');
console.log('=================================\n');

// Load both optimal locations files
console.log('Loading data files...');

const originalData = JSON.parse(fs.readFileSync('../../data/optimal-locations.json', 'utf8'));
const optimizedData = JSON.parse(fs.readFileSync('../../data/optimal-locations-for-resort.json', 'utf8'));

console.log(`Original tracks: ${Object.keys(originalData).length}`);
console.log(`Optimized tracks: ${Object.keys(optimizedData).length}\n`);

// Extract burden values
const originalBurdens = Object.values(originalData).map(track => track.minCommuteBurden);
const optimizedBurdens = Object.values(optimizedData).map(track => track.minCommuteBurden);

// Calculate statistics
function calculateStats(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    
    // Mean
    const mean = values.reduce((sum, val) => sum + val, 0) / n;
    
    // Median
    const median = n % 2 === 0
        ? (sorted[n/2 - 1] + sorted[n/2]) / 2
        : sorted[Math.floor(n/2)];
    
    // Standard deviation
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);
    
    // Min/Max
    const min = sorted[0];
    const max = sorted[n - 1];
    
    // Quartiles
    const q1 = sorted[Math.floor(n * 0.25)];
    const q3 = sorted[Math.floor(n * 0.75)];
    const iqr = q3 - q1;
    
    // Mode (approximate - group into 10-hour bins)
    const bins = {};
    values.forEach(val => {
        const bin = Math.floor(val / 10) * 10;
        bins[bin] = (bins[bin] || 0) + 1;
    });
    const modeBin = Object.entries(bins).sort((a, b) => b[1] - a[1])[0];
    const mode = modeBin ? `${modeBin[0]}-${parseInt(modeBin[0]) + 10} hrs (${modeBin[1]} tracks)` : 'N/A';
    
    return {
        mean,
        median,
        mode,
        stdDev,
        min,
        max,
        q1,
        q3,
        iqr,
        range: max - min
    };
}

const originalStats = calculateStats(originalBurdens);
const optimizedStats = calculateStats(optimizedBurdens);

// Display comparison
console.log('=================================');
console.log('Measures of Central Tendency');
console.log('=================================\n');

console.log('Mean (Average Burden):');
console.log(`  Original:  ${originalStats.mean.toFixed(2)} hrs`);
console.log(`  Optimized: ${optimizedStats.mean.toFixed(2)} hrs`);
console.log(`  Change:    ${(optimizedStats.mean - originalStats.mean).toFixed(2)} hrs (${((optimizedStats.mean - originalStats.mean) / originalStats.mean * 100).toFixed(2)}%)`);
console.log('');

console.log('Median (Middle Value):');
console.log(`  Original:  ${originalStats.median.toFixed(2)} hrs`);
console.log(`  Optimized: ${optimizedStats.median.toFixed(2)} hrs`);
console.log(`  Change:    ${(optimizedStats.median - originalStats.median).toFixed(2)} hrs (${((optimizedStats.median - originalStats.median) / originalStats.median * 100).toFixed(2)}%)`);
console.log('');

console.log('Mode (Most Common Range):');
console.log(`  Original:  ${originalStats.mode}`);
console.log(`  Optimized: ${optimizedStats.mode}`);
console.log('');

console.log('=================================');
console.log('Measures of Spread (Equity)');
console.log('=================================\n');

console.log('Standard Deviation:');
console.log(`  Original:  ${originalStats.stdDev.toFixed(2)} hrs`);
console.log(`  Optimized: ${optimizedStats.stdDev.toFixed(2)} hrs`);
console.log(`  Change:    ${(optimizedStats.stdDev - originalStats.stdDev).toFixed(2)} hrs (${((optimizedStats.stdDev - originalStats.stdDev) / originalStats.stdDev * 100).toFixed(2)}%)`);
console.log(`  ${optimizedStats.stdDev < originalStats.stdDev ? '✓ More equitable' : '⚠️  Less equitable'}`);
console.log('');

console.log('Interquartile Range (IQR):');
console.log(`  Original:  ${originalStats.iqr.toFixed(2)} hrs`);
console.log(`  Optimized: ${optimizedStats.iqr.toFixed(2)} hrs`);
console.log(`  Change:    ${(optimizedStats.iqr - originalStats.iqr).toFixed(2)} hrs (${((optimizedStats.iqr - originalStats.iqr) / originalStats.iqr * 100).toFixed(2)}%)`);
console.log('');

console.log('=================================');
console.log('Range & Extremes');
console.log('=================================\n');

console.log('Minimum Burden:');
console.log(`  Original:  ${originalStats.min.toFixed(2)} hrs`);
console.log(`  Optimized: ${optimizedStats.min.toFixed(2)} hrs`);
console.log(`  Change:    ${(optimizedStats.min - originalStats.min).toFixed(2)} hrs`);
console.log('');

console.log('Maximum Burden:');
console.log(`  Original:  ${originalStats.max.toFixed(2)} hrs`);
console.log(`  Optimized: ${optimizedStats.max.toFixed(2)} hrs`);
console.log(`  Change:    ${(optimizedStats.max - originalStats.max).toFixed(2)} hrs`);
console.log('');

console.log('Range (Max - Min):');
console.log(`  Original:  ${originalStats.range.toFixed(2)} hrs`);
console.log(`  Optimized: ${optimizedStats.range.toFixed(2)} hrs`);
console.log(`  Change:    ${(optimizedStats.range - originalStats.range).toFixed(2)} hrs`);
console.log('');

console.log('=================================');
console.log('Quartile Distribution');
console.log('=================================\n');

console.log('Original Distribution:');
console.log(`  Q1 (25th percentile): ${originalStats.q1.toFixed(2)} hrs`);
console.log(`  Q2 (50th/Median):     ${originalStats.median.toFixed(2)} hrs`);
console.log(`  Q3 (75th percentile): ${originalStats.q3.toFixed(2)} hrs`);
console.log('');

console.log('Optimized Distribution:');
console.log(`  Q1 (25th percentile): ${optimizedStats.q1.toFixed(2)} hrs`);
console.log(`  Q2 (50th/Median):     ${optimizedStats.median.toFixed(2)} hrs`);
console.log(`  Q3 (75th percentile): ${optimizedStats.q3.toFixed(2)} hrs`);
console.log('');

// Calculate total system burden
const originalTotal = originalBurdens.reduce((sum, val) => sum + val, 0);
const optimizedTotal = optimizedBurdens.reduce((sum, val) => sum + val, 0);

console.log('=================================');
console.log('Total System Burden');
console.log('=================================\n');

console.log(`Original total:  ${originalTotal.toFixed(2)} hrs`);
console.log(`Optimized total: ${optimizedTotal.toFixed(2)} hrs`);
console.log(`Reduction:       ${(originalTotal - optimizedTotal).toFixed(2)} hrs (${((originalTotal - optimizedTotal) / originalTotal * 100).toFixed(2)}%)`);
console.log('');

// Per-track comparison
console.log('=================================');
console.log('Per-Track Changes');
console.log('=================================\n');

const trackChanges = [];
Object.keys(originalData).forEach(trackName => {
    if (optimizedData[trackName]) {
        const change = optimizedData[trackName].minCommuteBurden - originalData[trackName].minCommuteBurden;
        trackChanges.push({
            name: trackName,
            original: originalData[trackName].minCommuteBurden,
            optimized: optimizedData[trackName].minCommuteBurden,
            change: change,
            changePct: (change / originalData[trackName].minCommuteBurden * 100)
        });
    }
});

trackChanges.sort((a, b) => a.change - b.change);

console.log('Top 10 Most Improved Tracks:');
console.log('----------------------------');
trackChanges.slice(0, 10).forEach((t, idx) => {
    console.log(`${idx + 1}. ${t.name}`);
    console.log(`   ${t.original.toFixed(1)} → ${t.optimized.toFixed(1)} hrs (${t.change.toFixed(1)} hrs, ${t.changePct.toFixed(1)}%)`);
});

console.log('\nTop 10 Tracks with Increased Burden:');
console.log('-------------------------------------');
trackChanges.slice(-10).reverse().forEach((t, idx) => {
    console.log(`${idx + 1}. ${t.name}`);
    console.log(`   ${t.original.toFixed(1)} → ${t.optimized.toFixed(1)} hrs (${t.change > 0 ? '+' : ''}${t.change.toFixed(1)} hrs, ${t.changePct > 0 ? '+' : ''}${t.changePct.toFixed(1)}%)`);
});

console.log('');

// Summary
console.log('=================================');
console.log('Summary');
console.log('=================================\n');

const improved = trackChanges.filter(t => t.change < -1).length;
const worsened = trackChanges.filter(t => t.change > 1).length;
const unchanged = trackChanges.filter(t => Math.abs(t.change) <= 1).length;

console.log(`Tracks improved:  ${improved} (${(improved/trackChanges.length*100).toFixed(1)}%)`);
console.log(`Tracks worsened:  ${worsened} (${(worsened/trackChanges.length*100).toFixed(1)}%)`);
console.log(`Tracks unchanged: ${unchanged} (${(unchanged/trackChanges.length*100).toFixed(1)}%)`);
console.log('');

const meanImprovement = (originalStats.mean - optimizedStats.mean) / originalStats.mean * 100;
const equityImprovement = (originalStats.stdDev - optimizedStats.stdDev) / originalStats.stdDev * 100;

if (meanImprovement > 5 && equityImprovement > 0) {
    console.log('🎉 Excellent! Optimization reduced average burden AND improved equity!');
} else if (meanImprovement > 5) {
    console.log('✓ Good! Optimization reduced average burden significantly.');
} else if (equityImprovement > 0) {
    console.log('✓ Good! Optimization improved equity (reduced spread).');
} else if (meanImprovement > 0) {
    console.log('⚠️  Modest improvement in average burden.');
} else {
    console.log('❌ Optimization did not reduce average burden.');
}

console.log('');

// Save detailed comparison
const report = {
    timestamp: new Date().toISOString(),
    original: originalStats,
    optimized: optimizedStats,
    totalBurden: {
        original: originalTotal,
        optimized: optimizedTotal,
        reduction: originalTotal - optimizedTotal,
        reductionPercent: (originalTotal - optimizedTotal) / originalTotal * 100
    },
    trackChanges: {
        improved,
        worsened,
        unchanged,
        topImprovers: trackChanges.slice(0, 10),
        topDecliners: trackChanges.slice(-10).reverse()
    }
};

fs.writeFileSync('../../data/burden-comparison-report.json', JSON.stringify(report, null, 2));
console.log('✓ Saved detailed report to ./data/burden-comparison-report.json\n');
