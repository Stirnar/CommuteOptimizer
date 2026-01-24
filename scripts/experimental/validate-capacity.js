#!/usr/bin/env node

/**
 * Validate Optimized Tracks
 * 
 * Ensures that the optimized track assignments preserve capacity constraints.
 * For each time column, verifies that the count of each rotation is identical
 * in both original and optimized files.
 */

const fs = require('fs');

console.log('=================================');
console.log('Track Optimization Validator');
console.log('=================================\n');

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

// Load files
console.log('Loading files...');
const originalText = fs.readFileSync('../../data/Tracks.csv', 'utf8');
const optimizedText = fs.readFileSync('../../data/Tracks-Optimized-Clustering.csv', 'utf8');

const originalTracks = parseCSV(originalText).filter(row => row['Current Track'] && row['Current Track'].trim() !== '');
const optimizedTracks = parseCSV(optimizedText).filter(row => row['Current Track'] && row['Current Track'].trim() !== '');

console.log(`Original: ${originalTracks.length} tracks`);
console.log(`Optimized: ${optimizedTracks.length} tracks\n`);

// Verify same number of tracks
if (originalTracks.length !== optimizedTracks.length) {
    console.log('❌ FAIL: Different number of tracks!');
    console.log(`   Original: ${originalTracks.length}`);
    console.log(`   Optimized: ${optimizedTracks.length}\n`);
    process.exit(1);
}

// Get time columns (exclude 'Current Track')
const originalColumns = Object.keys(originalTracks[0]).filter(k => k !== 'Current Track');
const optimizedColumns = Object.keys(optimizedTracks[0]).filter(k => k !== 'Current Track');

console.log('Validating column structure...');

// Verify same columns
if (originalColumns.length !== optimizedColumns.length) {
    console.log('❌ FAIL: Different number of time columns!');
    console.log(`   Original: ${originalColumns.length}`);
    console.log(`   Optimized: ${optimizedColumns.length}\n`);
    process.exit(1);
}

// Verify columns match
const missingColumns = originalColumns.filter(col => !optimizedColumns.includes(col));
const extraColumns = optimizedColumns.filter(col => !originalColumns.includes(col));

if (missingColumns.length > 0 || extraColumns.length > 0) {
    console.log('❌ FAIL: Column mismatch!');
    if (missingColumns.length > 0) {
        console.log(`   Missing in optimized: ${missingColumns.join(', ')}`);
    }
    if (extraColumns.length > 0) {
        console.log(`   Extra in optimized: ${extraColumns.join(', ')}`);
    }
    console.log('');
    process.exit(1);
}

console.log(`✓ Both files have ${originalColumns.length} time columns\n`);

// Main validation: compare rotation sets per column
console.log('Validating rotation sets per column...\n');

let allValid = true;
const issues = [];

for (const column of originalColumns) {
    // Get rotation sets (arrays of rotations in each column)
    const originalRotations = originalTracks.map(track => track[column] || '').filter(r => r.trim() !== '');
    const optimizedRotations = optimizedTracks.map(track => track[column] || '').filter(r => r.trim() !== '');
    
    // Sort both arrays to compare
    const originalSorted = [...originalRotations].sort();
    const optimizedSorted = [...optimizedRotations].sort();
    
    // Check if arrays are identical when sorted
    let columnValid = true;
    const columnIssues = [];
    
    // First check: same length
    if (originalSorted.length !== optimizedSorted.length) {
        columnValid = false;
        columnIssues.push({
            type: 'count',
            message: `Different number of rotations: Original=${originalSorted.length}, Optimized=${optimizedSorted.length}`
        });
    } else {
        // Second check: element-by-element comparison
        for (let i = 0; i < originalSorted.length; i++) {
            if (originalSorted[i] !== optimizedSorted[i]) {
                columnValid = false;
                columnIssues.push({
                    type: 'mismatch',
                    position: i,
                    original: originalSorted[i],
                    optimized: optimizedSorted[i]
                });
            }
        }
    }
    
    // Check for missing/extra rotations
    const originalSet = new Set(originalRotations);
    const optimizedSet = new Set(optimizedRotations);
    
    const missingRotations = [...originalSet].filter(r => !optimizedSet.has(r));
    const extraRotations = [...optimizedSet].filter(r => !originalSet.has(r));
    
    if (missingRotations.length > 0 || extraRotations.length > 0) {
        columnValid = false;
        if (missingRotations.length > 0) {
            missingRotations.forEach(r => {
                const origCount = originalRotations.filter(x => x === r).length;
                const optCount = optimizedRotations.filter(x => x === r).length;
                columnIssues.push({
                    type: 'missing',
                    rotation: r,
                    originalCount: origCount,
                    optimizedCount: optCount
                });
            });
        }
        if (extraRotations.length > 0) {
            extraRotations.forEach(r => {
                const origCount = originalRotations.filter(x => x === r).length;
                const optCount = optimizedRotations.filter(x => x === r).length;
                columnIssues.push({
                    type: 'extra',
                    rotation: r,
                    originalCount: origCount,
                    optimizedCount: optCount
                });
            });
        }
    }
    
    if (columnValid) {
        console.log(`✓ ${column}: Exact match (${originalRotations.length} rotations, ${originalSet.size} unique)`);
    } else {
        console.log(`❌ ${column}: SET MISMATCH`);
        allValid = false;
        issues.push({ column, issues: columnIssues });
    }
}

console.log('\n=================================');
console.log('Validation Summary');
console.log('=================================\n');

if (allValid) {
    console.log('✅ VALIDATION PASSED!');
    console.log('   All columns contain the exact same rotations (just reordered).');
    console.log('   Capacity constraints are perfectly preserved.\n');
    process.exit(0);
} else {
    console.log('❌ VALIDATION FAILED!');
    console.log(`   ${issues.length} column(s) have rotation set mismatches.`);
    console.log('   The optimization did not preserve the exact rotation sets.\n');
    
    console.log('Detailed Issues:');
    console.log('----------------');
    issues.forEach(({ column, issues: columnIssues }) => {
        console.log(`\n${column}:`);
        columnIssues.forEach(issue => {
            if (issue.type === 'count') {
                console.log(`  - ${issue.message}`);
            } else if (issue.type === 'mismatch') {
                console.log(`  - Position ${issue.position} (sorted): "${issue.original}" ≠ "${issue.optimized}"`);
            } else if (issue.type === 'missing') {
                console.log(`  - Missing: "${issue.rotation}" (Original: ${issue.originalCount}, Optimized: ${issue.optimizedCount})`);
            } else if (issue.type === 'extra') {
                console.log(`  - Extra: "${issue.rotation}" (Original: ${issue.originalCount}, Optimized: ${issue.optimizedCount})`);
            }
        });
    });
    
    console.log('\n');
    process.exit(1);
}
