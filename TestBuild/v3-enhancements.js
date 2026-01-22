/**
 * NSU Commute Optimizer V3 Enhancements
 * Add these functions and modifications to enable:
 * 1. Custom Block Builder
 * 2. Custom Locations
 * 3. Help System
 * 
 * INTEGRATION INSTRUCTIONS:
 * 1. Add the V3 CSS styles to your <style> section
 * 2. Add the V3 modals to your HTML (before closing </body>)
 * 3. Add these JavaScript functions to your <script> section
 * 4. Update the existing functions as marked with "MODIFY"
 */

// ===== V3: CONFIGURATION =====
// Add these constants at the top of your script section

const DATA_SOURCE_MODE = 'embedded'; // 'embedded' or 'backend'
const BACKEND_URL = '/api'; // Change when hosting with backend

let customBlocks = [];
let customLocations = {};

// ===== V3: LOCALSTORAGE FUNCTIONS =====

function loadCustomData() {
    const savedCustomBlocks = localStorage.getItem('customBlocks');
    if (savedCustomBlocks) {
        try {
            customBlocks = JSON.parse(savedCustomBlocks);
        } catch (e) {
            console.error('Error loading custom blocks:', e);
            customBlocks = [];
        }
    }
    
    const savedCustomLocations = localStorage.getItem('customLocations');
    if (savedCustomLocations) {
        try {
            customLocations = JSON.parse(savedCustomLocations);
            // Merge with main locations object
            Object.assign(locations, customLocations);
        } catch (e) {
            console.error('Error loading custom locations:', e);
            customLocations = {};
        }
    }
}

function saveCustomData() {
    localStorage.setItem('customBlocks', JSON.stringify(customBlocks));
    localStorage.setItem('customLocations', JSON.stringify(customLocations));
}

// ===== V3: CUSTOM BLOCK BUILDER =====

function openCustomBlockBuilder() {
    document.getElementById('customBlockName').value = '';
    document.getElementById('weeksContainer').innerHTML = '';
    document.getElementById('wednesdayException').checked = true;
    renderCustomLocations();
    addWeek(); // Start with one week
    document.getElementById('customBlockModal').classList.add('show');
}

function closeCustomBlockBuilder() {
    document.getElementById('customBlockModal').classList.remove('show');
}

function addWeek() {
    const container = document.getElementById('weeksContainer');
    const weekNum = container.children.length + 1;
    
    const weekDiv = document.createElement('div');
    weekDiv.className = 'week-schedule';
    weekDiv.innerHTML = `
        <div class="week-header">
            <h4 style="margin: 0; color: #3b82f6;">Week ${weekNum}</h4>
            <button class="remove-btn" onclick="this.parentElement.parentElement.remove(); renumberWeeks()">Remove Week</button>
        </div>
        <div class="days-container">
            ${createDayRow('Monday')}
        </div>
        <button class="add-btn" onclick="addDay(this.previousElementSibling)">+ Add Day</button>
    `;
    
    container.appendChild(weekDiv);
    
    // Populate location selects
    weekDiv.querySelectorAll('.location-select').forEach(select => {
        populateLocationSelect(select);
    });
}

window.renumberWeeks = function() {
    const weeks = document.querySelectorAll('.week-schedule');
    weeks.forEach((week, idx) => {
        week.querySelector('h4').textContent = `Week ${idx + 1}`;
    });
}

function createDayRow(dayName) {
    return `
        <div class="day-row">
            <select class="day-select" style="padding: 8px; border: 2px solid #e2e8f0; border-radius: 6px;">
                <option value="Monday" ${dayName === 'Monday' ? 'selected' : ''}>Monday</option>
                <option value="Tuesday" ${dayName === 'Tuesday' ? 'selected' : ''}>Tuesday</option>
                <option value="Wednesday" ${dayName === 'Wednesday' ? 'selected' : ''}>Wednesday</option>
                <option value="Thursday" ${dayName === 'Thursday' ? 'selected' : ''}>Thursday</option>
                <option value="Friday" ${dayName === 'Friday' ? 'selected' : ''}>Friday</option>
            </select>
            <select class="location-select" style="padding: 8px; border: 2px solid #e2e8f0; border-radius: 6px;">
            </select>
            <button class="remove-btn" onclick="this.parentElement.remove()">Remove</button>
        </div>
    `;
}

window.addDay = function(daysContainer) {
    const dayRow = document.createElement('div');
    dayRow.innerHTML = createDayRow('Monday');
    daysContainer.appendChild(dayRow);
    
    const select = dayRow.querySelector('.location-select');
    populateLocationSelect(select);
}

function populateLocationSelect(select) {
    select.innerHTML = '<option value="">Select location...</option>';
    
    const sortedLocations = Object.keys(locations).filter(loc => loc !== 'NSU').sort();
    
    sortedLocations.forEach(locName => {
        const option = document.createElement('option');
        option.value = locName;
        option.textContent = locName;
        select.appendChild(option);
    });
}

function saveCustomBlock() {
    const name = document.getElementById('customBlockName').value.trim();
    if (!name) {
        alert('Please enter a block name');
        return;
    }
    
    const weeks = [];
    const weekElements = document.querySelectorAll('.week-schedule');
    
    for (const weekEl of weekElements) {
        const days = [];
        const dayRows = weekEl.querySelectorAll('.day-row');
        
        for (const dayRow of dayRows) {
            const dayName = dayRow.querySelector('.day-select').value;
            const location = dayRow.querySelector('.location-select').value;
            
            if (!location) {
                alert('Please select a location for all days');
                return;
            }
            
            days.push({ day: dayName, location });
        }
        
        if (days.length === 0) {
            alert('Each week must have at least one day');
            return;
        }
        
        weeks.push({ days });
    }
    
    if (weeks.length === 0) {
        alert('Please add at least one week');
        return;
    }
    
    const hasWednesdayException = document.getElementById('wednesdayException').checked;
    
    const customBlock = {
        name,
        weeks,
        hasWednesdayException,
        isCustom: true
    };
    
    customBlocks.push(customBlock);
    saveCustomData();
    populateTrackDropdown();
    closeCustomBlockBuilder();
    
    alert(`Custom block "${name}" created successfully!`);
}

async function calculateCustomBlockCommute(customBlock, homeCoords) {
    let totalHours = 0;
    let totalMiles = 0;
    const totalWeeks = customBlock.weeks.length;
    
    for (let weekIdx = 0; weekIdx < customBlock.weeks.length; weekIdx++) {
        const week = customBlock.weeks[weekIdx];
        
        for (const dayInfo of week.days) {
            const siteCoords = locations[dayInfo.location];
            if (!siteCoords) continue;
            
            const route = await getRoute(homeCoords, siteCoords, true);
            
            if (customBlock.hasWednesdayException && dayInfo.day === 'Wednesday') {
                // Wednesday: home -> site -> school -> home
                const schoolRoute = await getRoute(siteCoords, NSU_COORDS, true);
                const homeRoute = await getRoute(NSU_COORDS, homeCoords, true);
                
                totalHours += route.durationHours + schoolRoute.durationHours + homeRoute.durationHours;
                totalMiles += route.distanceMiles + schoolRoute.distanceMiles + homeRoute.distanceMiles;
            } else {
                totalHours += route.durationHours * 2;
                totalMiles += route.distanceMiles * 2;
            }
        }
    }
    
    const blockDetails = [{
        month: 'Custom Block',
        block: customBlock.name,
        totalHours,
        totalMiles,
        weeks: totalWeeks,
        isCustom: true
    }];
    
    return { totalHours, totalMiles, totalWeeks, blockDetails };
}

// ===== V3: CUSTOM LOCATIONS =====

function renderCustomLocations() {
    const container = document.getElementById('customLocationsList');
    if (Object.keys(customLocations).length === 0) {
        container.innerHTML = '<p style="font-size: 13px; color: #64748b; padding: 8px;">No custom locations added yet</p>';
        return;
    }
    
    container.innerHTML = Object.entries(customLocations).map(([name, coords]) => `
        <div class="location-chip">
            <div>
                <div style="font-weight: 600;">${name}</div>
                <div style="font-size: 11px; color: #64748b;">${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}</div>
            </div>
            <button class="remove-btn" onclick="removeCustomLocation('${name.replace(/'/g, "\\'")}')">✕</button>
        </div>
    `).join('');
}

function addCustomLocationHandler() {
    const nameInput = document.getElementById('customLocName');
    const coordsInput = document.getElementById('customLocCoords');
    
    const name = nameInput.value.trim();
    const coordsStr = coordsInput.value.trim();
    
    if (!name) {
        alert('Please enter a location name');
        return;
    }
    
    const coords = parseCoordinates(coordsStr);
    if (!coords) {
        alert('Please enter valid coordinates (format: latitude, longitude)');
        return;
    }
    
    customLocations[name] = coords;
    locations[name] = coords;
    saveCustomData();
    
    nameInput.value = '';
    coordsInput.value = '';
    
    renderCustomLocations();
    updateAllLocationSelects();
}

window.removeCustomLocation = function(name) {
    if (confirm(`Remove custom location "${name}"?`)) {
        delete customLocations[name];
        delete locations[name];
        saveCustomData();
        renderCustomLocations();
        updateAllLocationSelects();
    }
}

function updateAllLocationSelects() {
    const selects = document.querySelectorAll('.location-select');
    selects.forEach(select => {
        const currentValue = select.value;
        populateLocationSelect(select);
        select.value = currentValue;
    });
}

// ===== MODIFY: populateTrackDropdown() =====
// Replace your existing populateTrackDropdown function with this:

function populateTrackDropdown() {
    const select = document.getElementById('trackSelect');
    select.innerHTML = '<option value="">Choose a track...</option>';
    
    // Add standard tracks
    tracks.forEach(track => {
        const option = document.createElement('option');
        option.value = track['Current Track'];
        option.textContent = track['Current Track'];
        select.appendChild(option);
    });
    
    // Add custom blocks
    if (customBlocks.length > 0) {
        const separator = document.createElement('option');
        separator.disabled = true;
        separator.textContent = '─── Custom Blocks ───';
        select.appendChild(separator);
        
        customBlocks.forEach(block => {
            const option = document.createElement('option');
            option.value = `CUSTOM:${block.name}`;
            option.textContent = `🎯 ${block.name}`;
            select.appendChild(option);
        });
    }
}

// ===== MODIFY: handleCalculate() =====
// Add this check at the beginning of handleCalculate:

async function handleCalculate() {
    const trackSelect = document.getElementById('trackSelect');
    const homeInput = document.getElementById('homeInput');
    
    if (!trackSelect.value) {
        alert('Please select a track');
        return;
    }
    
    document.getElementById('calculateBtn').disabled = true;
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('results').classList.add('hidden');
    
    try {
        let trackData;
        
        // V3: Check if it's a custom block
        if (trackSelect.value.startsWith('CUSTOM:')) {
            const blockName = trackSelect.value.substring(7);
            trackData = customBlocks.find(b => b.name === blockName);
        } else {
            trackData = tracks.find(t => t['Current Track'] === trackSelect.value);
        }
        
        let coords;
        
        if (!homeInput.value.trim()) {
            coords = await findOptimalLocation(trackData);
            if (coords) {
                homeInput.value = `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
            }
        } else {
            coords = parseCoordinates(homeInput.value);
        }
        
        if (!coords) {
            alert('Could not parse coordinates. Use format: latitude, longitude');
            return;
        }
        
        currentHomeCoords = coords;
        
        let results;
        // V3: Use custom block calculation if custom
        if (trackData.isCustom) {
            results = await calculateCustomBlockCommute(trackData, coords);
        } else {
            results = await calculateTrackCommute(trackData, coords);
        }
        
        currentResults = results;
        displayResults(results, coords);
    } catch (error) {
        console.error('Calculation error:', error);
        alert('An error occurred: ' + error.message);
    } finally {
        document.getElementById('calculateBtn').disabled = false;
        document.getElementById('loading').classList.add('hidden');
    }
}

// ===== MODIFY: setupEventListeners() =====
// Add these event listeners to your existing setupEventListeners function:

function setupEventListeners() {
    // ... existing event listeners ...
    
    // V3: Custom Block Builder
    document.getElementById('customBlockBtn').addEventListener('click', openCustomBlockBuilder);
    document.getElementById('closeCustomBlockModal').addEventListener('click', closeCustomBlockBuilder);
    document.getElementById('saveCustomBlock').addEventListener('click', saveCustomBlock);
    document.getElementById('addWeek').addEventListener('click', addWeek);
    document.getElementById('addCustomLocation').addEventListener('click', addCustomLocationHandler);
    
    // V3: Help Modal
    document.getElementById('helpBtn').addEventListener('click', () => {
        document.getElementById('helpModal').classList.add('show');
    });
    document.getElementById('closeHelpModal').addEventListener('click', () => {
        document.getElementById('helpModal').classList.remove('show');
    });
}

// ===== MODIFY: DOMContentLoaded =====
// Add loadCustomData() call at the beginning:

document.addEventListener('DOMContentLoaded', () => {
    if (typeof Papa === 'undefined') {
        alert("Error: PapaParse library not loaded. Check your internet connection.");
        return;
    }
    loadCustomData();  // V3: Load custom blocks and locations from localStorage
    parseData();
    setupEventListeners();
    initCostInputs();
});

// ===== MODIFY: displayResults() =====
// Update the sites section to handle custom blocks:

// In displayResults(), replace the usedSites section with:
const usedSites = new Set();
results.blockDetails.forEach(block => {
    if (block.isCustom) {
        // For custom blocks, extract locations from the custom block definition
        const customBlock = customBlocks.find(b => b.name === block.block);
        if (customBlock) {
            customBlock.weeks.forEach(week => {
                week.days.forEach(day => {
                    if (day.location && locations[day.location]) {
                        usedSites.add(day.location);
                    }
                });
            });
        }
    } else {
        const varData = variance[block.block];
        if (varData && varData.Locations) {
            varData.Locations.split(',').map(l => l.trim()).forEach(loc => {
                if (loc && !loc.toLowerCase().includes('nemours') && locations[loc]) {
                    usedSites.add(loc);
                }
            });
        }
        if(block.isPediatrics && block.week4Details) {
            block.week4Details.forEach(d => usedSites.add(d.location));
        }
    }
});

// In displayResults(), update the blocks content section to show custom block indicator:
document.getElementById('blocksContent').innerHTML = results.blockDetails.map(block => `
    <div class="block-item">
        <div style="font-weight: 600; font-size: 12px; color: #3b82f6; margin-bottom: 4px;">${block.month}</div>
        <div style="font-size: 13px; color: #475569; margin-bottom: 8px;">${block.block}</div>
        ${block.isPediatrics ? `
            <div style="font-size: 12px; color: #64748b;">
                <div><strong>Total:</strong> ${block.totalHours.toFixed(1)} hrs over ${block.weeks} weeks</div>
                <div style="font-size: 11px; margin-top: 4px;">Weeks 1-3: Nemours (0 hrs)</div>
                <div style="font-size: 11px;">Week 4: ${block.week4Details.map(d => `${d.location} (${d.days}): ${d.hours.toFixed(1)} hrs`).join(', ')}</div>
            </div>
        ` : block.isCustom ? `
            <div style="font-size: 12px; color: #64748b;">
                🎯 ${block.totalHours.toFixed(1)} hrs over ${block.weeks} weeks (Custom Block)
            </div>
        ` : `
            <div style="font-size: 12px; color: #64748b;">
                ${block.totalHours.toFixed(1)} hrs over ${block.weeks} weeks
            </div>
        `}
    </div>
`).join('');
