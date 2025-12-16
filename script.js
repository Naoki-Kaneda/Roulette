// DOM Elements
const csvInput = document.getElementById('csv-input');
const dropArea = document.getElementById('drop-area');
const presenterSection = document.getElementById('presenter-section');
const presenterTabs = document.getElementById('presenter-tabs');
const settingsSection = document.getElementById('settings-candidate-section');
const globalExcludeToggle = document.getElementById('global-exclude-toggle');
const candidateList = document.getElementById('candidate-list');
const candidateCount = document.getElementById('candidate-count');
const candidateSearch = document.getElementById('candidate-search'); // New
const toggleListBtn = document.getElementById('toggle-list-btn');
const rouletteSection = document.getElementById('roulette-section');
const canvas = document.getElementById('roulette-canvas');
const ctx = canvas.getContext('2d');
const spinBtn = document.getElementById('spin-btn');
const resetBtn = document.getElementById('reset-btn');
const resultModal = document.getElementById('result-modal');
const resultName = document.getElementById('result-name');
const resultQuestion = document.getElementById('result-question');
const closeModalBtns = document.querySelectorAll('.close-modal, .close-modal-btn');

// State
let allParticipants = [];
let currentParticipants = [];
let presenters = new Set();
let currentPresenter = null;
let currentRotation = 0;
let isSpinning = false;
let globalWinners = new Set();
let excludedNames = new Set();
let wheelColors = [
    '#f59e0b', // Amber (Brand)
    '#f43f5e', // Rose
    '#d946ef', // Fuchsia
    '#8b5cf6', // Violet
    '#6366f1', // Indigo
    '#0ea5e9', // Sky
    '#10b981', // Emerald
    '#f97316'  // Orange
];

// Event Listeners
// dropArea.addEventListener('click', () => csvInput.click()); // Removed to prevent double-open

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }
['dragenter', 'dragover'].forEach(eventName => { dropArea.addEventListener(eventName, highlight, false); });
['dragleave', 'drop'].forEach(eventName => { dropArea.addEventListener(eventName, unhighlight, false); });

function highlight(e) { dropArea.classList.add('dragover'); }
function unhighlight(e) { dropArea.classList.remove('dragover'); }

dropArea.addEventListener('drop', handleDrop, false);
csvInput.addEventListener('change', handleFiles, false);
spinBtn.addEventListener('click', spinRoulette);
resetBtn.addEventListener('click', resetApp);
closeModalBtns.forEach(btn => btn.addEventListener('click', closeResult));

// Toggle Event Listeners
if (globalExcludeToggle) {
    globalExcludeToggle.addEventListener('change', () => {
        selectPresenter(currentPresenter);
    });
}

if (toggleListBtn) {
    toggleListBtn.addEventListener('click', () => {
        candidateList.classList.toggle('collapsed');
        toggleListBtn.style.transform = candidateList.classList.contains('collapsed') ? 'rotate(-90deg)' : 'rotate(0deg)';
    });
}

if (document.querySelector('.candidate-header')) {
    document.querySelector('.candidate-header').addEventListener('click', () => {
        candidateList.classList.toggle('collapsed');
        const isCollapsed = candidateList.classList.contains('collapsed');
        toggleListBtn.style.transform = isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
    });
}


// Core Functions
function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles({ target: { files: files } });
}

function handleFiles(e) {
    const file = e.target.files[0];
    if (file && (file.type === 'text/csv' || file.name.endsWith('.csv'))) {
        const reader = new FileReader();
        reader.onload = function (event) {
            parseCSV(event.target.result);
        };
        reader.readAsText(file);
    } else {
        alert('Please upload a valid CSV file.');
    }
}

function parseCSV(text) {
    allParticipants = [];
    presenters = new Set();
    globalWinners = new Set();
    excludedNames = new Set();

    // Custom CSV parser to handle quoted fields with newlines
    const rows = [];
    let currentRow = [];
    let currentField = '';
    let insideQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"') {
            if (insideQuotes && nextChar === '"') {
                currentField += '"';
                i++; // Skip the escaped quote
            } else {
                insideQuotes = !insideQuotes;
            }
        } else if (char === ',' && !insideQuotes) {
            currentRow.push(currentField);
            currentField = '';
        } else if ((char === '\r' || char === '\n') && !insideQuotes) {
            if (char === '\r' && nextChar === '\n') i++; // Handle CRLF
            // Only push if row is not empty or field is not empty (handles empty lines gently)
            currentRow.push(currentField);
            if (currentRow.length > 0 && (currentRow.length > 1 || currentRow[0] !== '')) {
                rows.push(currentRow);
            }
            currentRow = [];
            currentField = '';
        } else {
            currentField += char;
        }
    }
    // Handle the last field/row
    if (currentField || currentRow.length > 0) {
        currentRow.push(currentField);
        if (currentRow.length > 0 && (currentRow.length > 1 || currentRow[0] !== '')) {
            rows.push(currentRow);
        }
    }

    rows.forEach(parts => {
        const name = parts[0] ? parts[0].trim() : '';
        const question = parts[1] ? parts[1].trim() : ''; // Preserves newlines in questions
        const rawTarget = parts[2] ? parts[2].trim() : '';
        const target = rawTarget || 'All';

        if (name && question) {
            allParticipants.push({ name, question, target });
            presenters.add(target);
        }
    });

    if (allParticipants.length === 0) {
        alert('No valid data found in CSV.');
        return;
    }

    initPresenterTabs();

    // Hide upload, show main UI
    document.getElementById('upload-section').classList.add('hidden');
    presenterSection.classList.remove('hidden');

    // Show split layout container
    const splitLayout = document.getElementById('split-layout-container');
    if (splitLayout) {
        splitLayout.classList.remove('hidden');
    }

    // settings and roulette are now inside split layout, so we don't need to toggle them individually if they are not hidden by default inside the wrapper.
    // However, in HTML structure I removed 'hidden' class from them? 
    // Let's check HTML. I removed 'hidden' class in the replacement content. Good.

    // Default to first presenter in the set
    if (presenters.size > 0) {
        const firstPresenter = Array.from(presenters)[0];
        selectPresenter(firstPresenter);
    }
}

function initPresenterTabs() {
    presenterTabs.innerHTML = '';
    presenters.forEach(presenter => {
        const btn = document.createElement('button');
        btn.className = 'presenter-tab';
        btn.textContent = presenter;
        btn.addEventListener('click', () => selectPresenter(presenter));
        presenterTabs.appendChild(btn);
    });
}

function selectPresenter(presenter) {
    if (!presenter) return;
    currentPresenter = presenter;

    document.querySelectorAll('.presenter-tab').forEach(btn => {
        if (btn.textContent === presenter) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    let potentialCandidates = [];
    if (presenter === 'All') {
        potentialCandidates = [...allParticipants];
    } else {
        potentialCandidates = allParticipants.filter(p => p.target === presenter);
    }

    const isGlobalExclude = globalExcludeToggle ? globalExcludeToggle.checked : true;

    currentParticipants = potentialCandidates.filter(p => {
        if (excludedNames.has(p.name)) return false;
        if (isGlobalExclude && globalWinners.has(p.name)) return false;
        return true;
    });

    if (candidateCount) candidateCount.textContent = `(${currentParticipants.length})`;
    renderCandidateList(potentialCandidates);
    drawWheel();
}


if (candidateSearch) {
    candidateSearch.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const items = candidateList.querySelectorAll('.candidate-item');
        items.forEach(item => {
            const text = item.textContent.toLowerCase();
            if (text.includes(term)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    });
}

function renderCandidateList(candidates) {
    if (!candidateList) return;
    candidateList.innerHTML = '';

    // Check if there is an active search term to apply immediately (e.g. after re-render)
    const searchTerm = candidateSearch ? candidateSearch.value.toLowerCase() : '';

    candidates.forEach(p => {
        const isGlobalWinner = globalWinners.has(p.name);
        const isExcluded = excludedNames.has(p.name);

        const item = document.createElement('div');
        item.className = 'candidate-item';
        if (isGlobalWinner) item.classList.add('winner');

        // Apply filter immediately
        if (searchTerm && !p.name.toLowerCase().includes(searchTerm)) {
            item.style.display = 'none';
        }

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = !isExcluded;

        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                excludedNames.delete(p.name);
            } else {
                excludedNames.add(p.name);
            }
            selectPresenter(currentPresenter);
        });

        const label = document.createElement('span');
        label.textContent = p.name + (isGlobalWinner ? ' (当選済)' : '');

        item.appendChild(checkbox);
        item.appendChild(label);
        candidateList.appendChild(item);
    });
}

function drawWheel() {
    if (currentParticipants.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }

    const arc = Math.PI * 2 / currentParticipants.length;
    const radius = canvas.width / 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.translate(radius, radius);
    // ctx.rotate(currentRotation); // Removed: Rotation is handled by CSS, and this was using degrees instead of radians

    currentParticipants.forEach((participant, i) => {
        const angle = i * arc;
        ctx.beginPath();
        ctx.fillStyle = wheelColors[i % wheelColors.length];
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius, angle, angle + arc);
        ctx.lineTo(0, 0);
        ctx.fill();

        ctx.save();
        ctx.fillStyle = "white";
        ctx.font = "bold 20px 'Zen Kaku Gothic New'";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.rotate(angle + arc / 2);
        ctx.fillText(participant.name, radius - 20, 0);
        ctx.restore();
    });
}

function spinRoulette() {
    if (isSpinning || currentParticipants.length === 0) return;
    isSpinning = true;
    spinBtn.disabled = true;

    // 1. Decide the winner first
    const winnerIndex = Math.floor(Math.random() * currentParticipants.length);
    const winner = currentParticipants[winnerIndex];

    // 2. Calculate the angle to stop at the center of the winner's segment
    // Canvas draws starting at 0 rad (3 o'clock) going clockwise.
    // The pointer is at 270 deg (12 o'clock).
    // Segment start angle = index * arcDegrees
    // Segment center angle = index * arcDegrees + arcDegrees / 2

    const arcDegrees = 360 / currentParticipants.length;
    const winnerCenterAngle = winnerIndex * arcDegrees + arcDegrees / 2;

    // We want the winnerCenterAngle to end up at 270 degrees (pointer position)
    // after rotation.
    // Final Rotation Position = (270 - winnerCenterAngle)

    // Add multiple full spins (at least 5)
    // To ensure smooth forward rotation, we need to add huge multiples of 360
    // and adjust currentRotation.

    let targetRotation = 270 - winnerCenterAngle;

    // Ensure we rotate forward (positive direction) significantly
    // Find the next multiple of 360 that is greater than currentRotation + minSpins
    const minSpins = 5;
    const minRotation = currentRotation + (minSpins * 360);

    // Adjust targetRotation to be the smallest value >= minRotation that matches the alignment
    // We want (targetRotation % 360) to be equivalent to (270 - winnerCenterAngle) % 360

    // Normalize target base
    while (targetRotation < minRotation) {
        targetRotation += 360;
    }

    // Add extra randomness within the segment? 
    // No, to be safe for 100+ people, let's stop exactly at the center. 
    // If users want wobble, we can add small random offset later, but let's fix the bug first.

    canvas.style.transition = 'transform 5s cubic-bezier(0.15, 0, 0.15, 1)';
    canvas.style.transform = `rotate(${targetRotation}deg)`;
    currentRotation = targetRotation;

    setTimeout(() => { finishSpin(winner); }, 5000);
}

function finishSpin(winner) {
    isSpinning = false;
    spinBtn.disabled = false;

    if (winner) {
        globalWinners.add(winner.name);
        selectPresenter(currentPresenter);
        showResult(winner);
    }
}

function showResult(winner) {
    if (!winner) return;
    resultName.textContent = winner.name;
    resultQuestion.textContent = winner.question;
    resultModal.classList.remove('hidden');
}

function closeResult() { resultModal.classList.add('hidden'); }

function resetApp() {
    csvInput.value = '';
    document.getElementById('upload-section').classList.remove('hidden');
    presenterSection.classList.add('hidden');

    // Hide split layout
    const splitLayout = document.getElementById('split-layout-container');
    if (splitLayout) splitLayout.classList.add('hidden');

    // Keep old logic for safety if ID missing, but mostly just wrapper
    if (settingsSection) settingsSection.classList.add('hidden');
    rouletteSection.classList.add('hidden');

    resultModal.classList.add('hidden');
    canvas.style.transition = 'none';
    canvas.style.transform = 'rotate(0deg)';
    currentRotation = 0;
    allParticipants = [];
    currentParticipants = [];
}
