// DOM要素の取得
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

// 状態管理変数
let allParticipants = [];
let currentParticipants = [];
let presenters = new Set();
let currentPresenter = null;
let currentRotation = 0;
let isSpinning = false;
let globalWinners = new Set();
// let excludedNames = new Set(); // Deprecated in favor of ID-based exclusion
let excludedIDs = new Set(); // IDベースの除外管理に変更

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

// イベントリスナー設定

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

// 使い方ガイドの制御
const helpBtn = document.getElementById('help-btn');
const helpModal = document.getElementById('help-modal');
const closeHelpBtn = document.getElementById('close-help');
const helpOkBtn = document.getElementById('help-ok-btn');

if (helpBtn && helpModal) {
    helpBtn.addEventListener('click', () => {
        helpModal.classList.remove('hidden');
    });

    const closeHelp = () => helpModal.classList.add('hidden');

    if (closeHelpBtn) closeHelpBtn.addEventListener('click', closeHelp);
    if (helpOkBtn) helpOkBtn.addEventListener('click', closeHelp);

    // モーダルの外側をクリックしても閉じる
    helpModal.addEventListener('click', (e) => {
        if (e.target === helpModal) closeHelp();
    });
}

// 切り替えスイッチのイベントリスナー
if (globalExcludeToggle) {
    globalExcludeToggle.addEventListener('change', () => {
        selectPresenter(currentPresenter);
    });
}

// 「全データから抽選」のイベントリスナー
const includeAllToggle = document.getElementById('include-all-toggle');
if (includeAllToggle) {
    includeAllToggle.addEventListener('change', () => {
        selectPresenter(currentPresenter);
    });
}

function toggleCandidateList() {
    candidateList.classList.toggle('collapsed');
    const isCollapsed = candidateList.classList.contains('collapsed');
    if (toggleListBtn) {
        toggleListBtn.style.transform = isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
    }
}

if (toggleListBtn) {
    toggleListBtn.addEventListener('click', toggleCandidateList);
}

const candidateHeader = document.querySelector('.candidate-header');
if (candidateHeader) {
    candidateHeader.addEventListener('click', toggleCandidateList);
}

// 主要関数
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
    excludedIDs = new Set(); // Reset IDs

    // 改行を含む引用符付きフィールドを処理するカスタムCSVパーサー
    // ... (Parsing logic matches existing) ...
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
                i++; // エスケープされた引用符をスキップ
            } else {
                insideQuotes = !insideQuotes;
            }
        } else if (char === ',' && !insideQuotes) {
            currentRow.push(currentField);
            currentField = '';
        } else if ((char === '\r' || char === '\n') && !insideQuotes) {
            if (char === '\r' && nextChar === '\n') i++; // CRLFの処理
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
    // 最後のフィールド/行の処理
    if (currentField || currentRow.length > 0) {
        currentRow.push(currentField);
        if (currentRow.length > 0 && (currentRow.length > 1 || currentRow[0] !== '')) {
            rows.push(currentRow);
        }
    }

    rows.forEach((parts, index) => {
        const name = parts[0] ? parts[0].trim() : '';
        const question = parts[1] ? parts[1].trim() : ''; // 質問内の改行は保持される
        const rawTarget = parts[2] ? parts[2].trim() : '';
        const target = rawTarget || 'All';

        // 4列目: 除外フラグ (x, X, または *)
        const exclusionFlag = parts[3] ? parts[3].trim() : '';
        const isExcluded = (exclusionFlag === 'x' || exclusionFlag === 'X' || exclusionFlag === '*');

        // ユニークIDを生成
        const id = `p-${index}-${Date.now()}`;

        if (name && question) {
            allParticipants.push({ id, name, question, target });
            presenters.add(target);

            if (isExcluded) {
                excludedIDs.add(id);
            }
        }
    });

    if (allParticipants.length === 0) {
        alert('No valid data found in CSV.');
        return;
    }

    initPresenterTabs();

    // ... (UI transition) ...
    document.getElementById('upload-section').classList.add('hidden');
    presenterSection.classList.remove('hidden');

    const splitLayout = document.getElementById('split-layout-container');
    if (splitLayout) {
        splitLayout.classList.remove('hidden');
    }

    // 最初の発表者をデフォルトで選択
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

    const isGlobalExclude = globalExcludeToggle ? globalExcludeToggle.checked : true;
    const isIncludeAll = includeAllToggle ? includeAllToggle.checked : false;

    let potentialCandidates = [];

    if (isIncludeAll || presenter === 'All') {
        potentialCandidates = [...allParticipants];
    } else {
        potentialCandidates = allParticipants.filter(p => p.target === presenter);
    }

    currentParticipants = potentialCandidates.filter(p => {
        // IDベースで除外判定
        if (excludedIDs.has(p.id)) return false;
        // 当選済みチェックは名前で行う（同一人物は他でも当選済みにするため）
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

    // 検索語句がある場合は即座にフィルタリングを適用（再描画時など）
    const searchTerm = candidateSearch ? candidateSearch.value.toLowerCase() : '';

    candidates.forEach(p => {
        const isGlobalWinner = globalWinners.has(p.name);
        const isExcluded = excludedIDs.has(p.id); // Check by ID

        const item = document.createElement('div');
        item.className = 'candidate-item';
        if (isGlobalWinner) item.classList.add('winner');

        // フィルタリングを適用
        if (searchTerm && !p.name.toLowerCase().includes(searchTerm)) {
            item.style.display = 'none';
        }

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = !isExcluded;

        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                excludedIDs.delete(p.id); // Enable
            } else {
                excludedIDs.add(p.id); // Disable
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

        // フォントサイズの動的調整
        // 円弧の長さに基づいて計算（テキスト配置位置の半径を使用）
        const textRadius = radius - 20;
        const arcLength = textRadius * arc; // arcはラジアン

        // ヒューリスティック: フォントサイズは円弧の長さに比例させるが、最大20px、最小10pxとする
        let fontSize = Math.min(20, arcLength * 0.55); // 0.55はテキストを収めるための調整値
        fontSize = Math.max(10, fontSize);

        ctx.font = `bold ${fontSize}px 'Zen Kaku Gothic New'`;
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

    // 1. 最初に当選者を決定
    const winnerIndex = Math.floor(Math.random() * currentParticipants.length);
    const winner = currentParticipants[winnerIndex];

    // 2. 当選者のセグメントの中心で停止するように角度を計算
    // Canvasは0ラジアン（3時方向）から時計回りに描画される
    // ポインターは270度（12時方向）にある
    // セグメント開始角度 = index * arcDegrees
    // セグメント中心角度 = index * arcDegrees + arcDegrees / 2

    const arcDegrees = 360 / currentParticipants.length;
    const winnerCenterAngle = winnerIndex * arcDegrees + arcDegrees / 2;

    // 回転後のwinnerCenterAngleが270度（ポインター位置）に来るようにする
    // 最終回転位置 = (270 - winnerCenterAngle)

    // 複数回の回転を追加（最低5回転）
    // スムーズな正方向回転のために、360の倍数を加算し、currentRotationを調整する

    let targetRotation = 270 - winnerCenterAngle;

    // 正方向（時計回り）に確実に回転させる
    // currentRotation + minSpins よりも大きい、次の360の倍数を見つける
    const minSpins = 5;
    const minRotation = currentRotation + (minSpins * 360);

    // アライメントを維持しつつ、minRotation以上になる最小の値をtargetRotationに設定
    // (targetRotation % 360) が (270 - winnerCenterAngle) % 360 と等しくなるようにする

    // 目標値を正規化
    while (targetRotation < minRotation) {
        targetRotation += 360;
    }

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

    // Check if 'Include All' mode is active
    const isIncludeAll = includeAllToggle && includeAllToggle.checked;

    if (isIncludeAll) {
        resultQuestion.textContent = "発表を聞いての質問をお願いします";
    } else {
        resultQuestion.textContent = winner.question;
    }

    resultModal.classList.remove('hidden');
}

function closeResult() { resultModal.classList.add('hidden'); }

function resetApp() {
    csvInput.value = '';
    document.getElementById('upload-section').classList.remove('hidden');
    presenterSection.classList.add('hidden');

    // 分割レイアウトを非表示
    const splitLayout = document.getElementById('split-layout-container');
    if (splitLayout) splitLayout.classList.add('hidden');

    // IDが見つからない場合の安全策（主にラッパー）
    if (settingsSection) settingsSection.classList.add('hidden');
    rouletteSection.classList.add('hidden');

    resultModal.classList.add('hidden');
    canvas.style.transition = 'none';
    canvas.style.transform = 'rotate(0deg)';
    currentRotation = 0;
    allParticipants = [];
    currentParticipants = [];
}
