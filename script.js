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
let winnerCount = 1; // 当選人数

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

// 当選人数セレクターの初期化
const winnerCountSelector = document.getElementById('winner-count-selector');
const pointersContainer = document.getElementById('pointers-container');
const p1 = document.getElementById('pointer-1');
const p2 = document.getElementById('pointer-2');
const p3 = document.getElementById('pointer-3');

if (winnerCountSelector) {
    const btns = winnerCountSelector.querySelectorAll('.count-btn');
    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            btns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            winnerCount = parseInt(btn.dataset.count);

            // 矢印の表示制御
            if (p2) p2.classList.toggle('hidden', winnerCount < 2);
            if (p3) p3.classList.toggle('hidden', winnerCount < 3);

            // 2人の時のレイアウト切り替え
            if (pointersContainer) {
                pointersContainer.classList.toggle('mode-2', winnerCount === 2);
            }
        });
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

if (winnerCountInput) {
    winnerCountInput.addEventListener('change', (e) => {
        winnerCount = parseInt(e.target.value, 10);
        // ポインターの表示/非表示を更新
        const pointer2 = document.getElementById('pointer-2');
        const pointer3 = document.getElementById('pointer-3');

        if (pointer2) {
            if (winnerCount >= 2) pointer2.classList.remove('hidden');
            else pointer2.classList.add('hidden');
        }
        if (pointer3) {
            if (winnerCount >= 3) pointer3.classList.remove('hidden');
            else pointer3.classList.add('hidden');
        }
    });
}

function spinRoulette() {
    if (isSpinning || currentParticipants.length === 0) return;
    isSpinning = true;
    spinBtn.disabled = true;

    // 1. ルーレット全体の最終回転角度をランダムに決定
    const minSpins = 5;
    const randomExtra = Math.random() * 360;
    const targetRotation = currentRotation + (minSpins * 360) + randomExtra;

    canvas.style.transition = 'transform 5s cubic-bezier(0.15, 0, 0.15, 1)';
    canvas.style.transform = `rotate(${targetRotation}deg)`;
    currentRotation = targetRotation;

    // 2. 5秒後に各矢印が指している人を特定
    setTimeout(() => {
        const winners = [];
        const arcDegrees = 360 / currentParticipants.length;

        // 正規化された最終角度 (0-360)
        // Canvasは右(3時)が0度で時計回り。
        // 回転角度を足すと、ビジュアル上の「0度の線」は時計回りに移動する。
        // つまり、固定されたポインターが指す「ホイール上の角度」は 逆方向に移動（＝マイナス）する。
        const normalizedRotation = targetRotation % 360;

        // 各ポインターの絶対角度（12時=270, 6時=90, 4時=30, 8時=150）
        let pointerAngles = [270]; // 1人目はずっと12時
        if (winnerCount === 2) {
            pointerAngles.push(90); // 2人目は6時
        } else if (winnerCount === 3) {
            pointerAngles.push(30);  // 2人目は4時
            pointerAngles.push(150); // 3人目は8時
        }

        pointerAngles.forEach(pAngle => {
            // ポインターが指しているホイール側の角度 = (ポインター角度 - ルーレット回転角度) を360度系に正規化
            let wheelAngle = (pAngle - normalizedRotation) % 360;
            if (wheelAngle < 0) wheelAngle += 360;

            // wheelAngle がどのセグメントに入っているか
            const winnerIndex = Math.floor(wheelAngle / arcDegrees);
            const winner = currentParticipants[winnerIndex];

            // 重複チェック（万が一同じセグメントを指した場合）
            if (winner && !winners.find(w => w.id === winner.id)) {
                winners.push(winner);
            } else if (winner) {
                // 同じ人を指した場合は、まだ当選していない人をランダムに一人追加（予備）
                const unused = currentParticipants.filter(p => !winners.find(w => w.id === p.id));
                if (unused.length > 0) {
                    winners.push(unused[Math.floor(Math.random() * unused.length)]);
                }
            }
        });

        finishSpin(winners);
    }, 5000);
}

function finishSpin(winners) {
    isSpinning = false;
    spinBtn.disabled = false;

    if (winners && winners.length > 0) {
        winners.forEach(w => globalWinners.add(w.name));
        selectPresenter(currentPresenter);
        showResult(winners);
    }
}

function showResult(winners) {
    if (!winners || winners.length === 0) return;

    const isIncludeAll = includeAllToggle && includeAllToggle.checked;
    const modalContent = document.querySelector('.modal-content');

    if (winners.length === 1) {
        // 1人の場合は従来の表示形式（互換性維持）
        modalContent.classList.remove('multi-winner');
        const winner = winners[0];
        resultName.textContent = winner.name;
        if (isIncludeAll) {
            resultQuestion.textContent = "発表を聞いての質問をお願いします";
        } else {
            resultQuestion.textContent = winner.question;
        }

        // 表示を元に戻す（複数名表示後のリセット用）
        resultName.style.display = 'block';
        resultQuestion.style.display = 'block';
        const existingItems = modalContent.querySelectorAll('.result-item');
        existingItems.forEach(item => item.remove());
    } else {
        // 複数名の場合はリスト形式
        modalContent.classList.add('multi-winner');
        resultName.style.display = 'none';
        resultQuestion.style.display = 'none';

        // 既存のリストアイテムを削除
        const existingItems = modalContent.querySelectorAll('.result-item');
        existingItems.forEach(item => item.remove());

        const modalBody = document.querySelector('.modal-body');
        winners.forEach(winner => {
            const item = document.createElement('div');
            item.className = 'result-item';

            const nameDiv = document.createElement('div');
            nameDiv.className = 'result-name';
            nameDiv.textContent = winner.name;

            const qDiv = document.createElement('div');
            qDiv.className = 'result-question';
            qDiv.textContent = isIncludeAll ? "発表を聞いての質問をお願いします" : winner.question;

            item.appendChild(nameDiv);
            item.appendChild(qDiv);
            modalBody.appendChild(item);
        });
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
