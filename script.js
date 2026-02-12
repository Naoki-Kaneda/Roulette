// --- 設定・定数 ---
const CONFIG = {
    WHEEL_COLORS: [
        '#f59e0b', '#f43f5e', '#d946ef', '#8b5cf6', '#6366f1', '#0ea5e9', '#10b981', '#f97316'
    ],
    SPIN_DURATION: 5000,
    MIN_SPINS: 5,
    POINTER_ANGLES: {
        1: [270],
        2: [270, 90],
        3: [270, 30, 150]
    },
    FONT_FAMILY_BODY: "'Zen Kaku Gothic New', sans-serif"
};

// --- アプリケーションの状態 ---
const appState = {
    allParticipants: [],
    currentParticipants: [],
    manualParticipants: [], // 手動入力用 (初期画面)
    presenters: new Set(),
    currentPresenter: null,
    currentRotation: 0,
    isSpinning: false,
    globalWinners: new Set(),
    excludedIDs: new Set(),
    winnerCount: 1
};

// --- DOM要素 ---
const UI = {
    csvInput: document.getElementById('csv-input'),
    dropArea: document.getElementById('drop-area'),
    presenterSection: document.getElementById('presenter-section'),
    presenterTabs: document.getElementById('presenter-tabs'),
    settingsSection: document.getElementById('settings-candidate-section'),
    globalExcludeToggle: document.getElementById('global-exclude-toggle'),
    includeAllToggle: document.getElementById('include-all-toggle'),
    candidateList: document.getElementById('candidate-list'),
    candidateCount: document.getElementById('candidate-count'),
    candidateSearch: document.getElementById('candidate-search'),
    toggleListBtn: document.getElementById('toggle-list-btn'),
    rouletteSection: document.getElementById('roulette-section'),
    canvas: document.getElementById('roulette-canvas'),
    spinBtn: document.getElementById('spin-btn'),
    resetBtn: document.getElementById('reset-btn'),
    resultModal: document.getElementById('result-modal'),
    resultName: document.getElementById('result-name'),
    resultQuestion: document.getElementById('result-question'),
    closeModalBtns: document.querySelectorAll('.close-modal, .close-modal-btn'),
    winnerCountSelector: document.getElementById('winner-count-selector'),
    pointersContainer: document.getElementById('pointers-container'),
    pointers: [
        document.getElementById('pointer-1'),
        document.getElementById('pointer-2'),
        document.getElementById('pointer-3')
    ],
    help: {
        btn: document.getElementById('help-btn'),
        modal: document.getElementById('help-modal'),
        closeBtn: document.getElementById('close-help'),
        okBtn: document.getElementById('help-ok-btn')
    },
    // 手動入力用要素 (初期画面)
    entryTabs: document.querySelectorAll('.mode-tab'),
    modeContents: document.querySelectorAll('.mode-content'),
    manualName: document.getElementById('manual-name'),
    manualTarget: document.getElementById('manual-target'),
    manualQuestion: document.getElementById('manual-question'),
    addManualBtn: document.getElementById('add-manual-btn'),
    clearManualBtn: document.getElementById('clear-manual-btn'),
    manualPreviewList: document.getElementById('manual-preview-list'),
    manualEntryCount: document.getElementById('manual-entry-count'),
    startManualBtn: document.getElementById('start-manual-btn'),
    // サイドパネル追加登録用
    sideEntryToggle: document.getElementById('side-entry-toggle'),
    sideEntryBody: document.getElementById('side-entry-body'),
    sideName: document.getElementById('side-name'),
    sideTarget: document.getElementById('side-target'),
    sideQuestion: document.getElementById('side-question'),
    addSideBtn: document.getElementById('add-side-btn')
};

const ctx = UI.canvas.getContext('2d');

// --- イベントリスナー ---
const initEventListeners = () => {
    // ドラッグ&ドロップ
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(name => {
        UI.dropArea.addEventListener(name, e => { e.preventDefault(); e.stopPropagation(); });
    });
    UI.dropArea.addEventListener('dragenter', () => UI.dropArea.classList.add('dragover'));
    UI.dropArea.addEventListener('dragover', () => UI.dropArea.classList.add('dragover'));
    UI.dropArea.addEventListener('dragleave', () => UI.dropArea.classList.remove('dragover'));
    UI.dropArea.addEventListener('drop', e => {
        UI.dropArea.classList.remove('dragover');
        handleFiles({ target: { files: e.dataTransfer.files } });
    });

    UI.csvInput?.addEventListener('change', handleFiles);
    UI.spinBtn?.addEventListener('click', spinRoulette);
    UI.resetBtn?.addEventListener('click', resetApp);
    UI.closeModalBtns.forEach(btn => btn.addEventListener('click', closeResult));

    // 入力モード切り替え
    UI.entryTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            UI.entryTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const mode = tab.dataset.mode;
            UI.modeContents.forEach(content => {
                content.classList.toggle('hidden', content.id !== `${mode}-mode-content`);
            });
        });
    });

    // 手動入力アクション (初期画面)
    UI.addManualBtn?.addEventListener('click', addManualEntry);
    UI.clearManualBtn?.addEventListener('click', clearManualEntries);
    UI.startManualBtn?.addEventListener('click', () => {
        if (appState.manualParticipants.length > 0) {
            processParticipants(appState.manualParticipants);
        }
    });

    // サイドパネル追加登録アクション
    UI.sideEntryToggle?.addEventListener('click', () => {
        UI.sideEntryBody.classList.toggle('collapsed');
        const isCollapsed = UI.sideEntryBody.classList.contains('collapsed');
        UI.sideEntryToggle.querySelector('.btn-text').style.transform = isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)';
    });
    UI.addSideBtn?.addEventListener('click', addSideEntry);

    // 使い方ガイド
    if (UI.help.btn) {
        const toggleHelp = (show) => UI.help.modal.classList.toggle('hidden', !show);
        UI.help.btn.addEventListener('click', () => toggleHelp(true));
        UI.help.closeBtn?.addEventListener('click', () => toggleHelp(false));
        UI.help.okBtn?.addEventListener('click', () => toggleHelp(false));
        UI.help.modal.addEventListener('click', (e) => {
            if (e.target === UI.help.modal) toggleHelp(false);
        });
    }

    // 各種トグル・スイッチ
    UI.globalExcludeToggle?.addEventListener('change', () => selectPresenter(appState.currentPresenter));
    UI.includeAllToggle?.addEventListener('change', () => selectPresenter(appState.currentPresenter));

    // モーダルを閉じるためのキーボードショートカット (Esc, Enter)
    window.addEventListener('keydown', (e) => {
        const activeModal = document.querySelector('.modal:not(.hidden)');
        if (!activeModal) return;

        if (e.key === 'Escape') {
            activeModal.classList.add('hidden');
        } else if (e.key === 'Enter') {
            // 入力フィールドフォーカス時はEnterでの誤操作防止（ただし結果表示モーダルは閉じる）
            const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
            if (activeModal.id === 'result-modal' || !isInput) {
                activeModal.classList.add('hidden');
            }
        }
    });

    // 当選人数
    if (UI.winnerCountSelector) {
        const btns = UI.winnerCountSelector.querySelectorAll('.count-btn');
        btns.forEach(btn => {
            btn.addEventListener('click', () => {
                btns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                appState.winnerCount = parseInt(btn.dataset.count);
                updatePointerVisibility();
            });
        });
    }

    // 候補者リストの開閉
    const toggleList = () => {
        UI.candidateList.classList.toggle('collapsed');
        const isCollapsed = UI.candidateList.classList.contains('collapsed');
        UI.toggleListBtn.style.transform = isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
    };
    UI.toggleListBtn?.addEventListener('click', toggleList);
    document.querySelector('.candidate-header')?.addEventListener('click', toggleList);

    // 検索
    UI.candidateSearch?.addEventListener('input', e => {
        const term = e.target.value.toLowerCase();
        UI.candidateList.querySelectorAll('.candidate-item').forEach(item => {
            item.style.display = item.textContent.toLowerCase().includes(term) ? 'flex' : 'none';
        });
    });
};

const updatePointerVisibility = () => {
    UI.pointers[1]?.classList.toggle('hidden', appState.winnerCount < 2);
    UI.pointers[2]?.classList.toggle('hidden', appState.winnerCount < 3);
    UI.pointersContainer?.classList.toggle('mode-2', appState.winnerCount === 2);
};

// --- 主要関数 ---
function handleFiles(e) {
    const file = e.target.files[0];
    if (file && (file.type === 'text/csv' || file.name.endsWith('.csv'))) {
        const reader = new FileReader();
        reader.onload = event => parseCSV(event.target.result);
        reader.readAsText(file);
    } else {
        alert('CSVファイルをアップロードしてください。');
    }
}

function parseCSV(text) {
    const participants = [];
    const rows = [];
    let currentRow = [], currentField = '', insideQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i], nextChar = text[i + 1];
        if (char === '"') {
            if (insideQuotes && nextChar === '"') { currentField += '"'; i++; }
            else { insideQuotes = !insideQuotes; }
        } else if (char === ',' && !insideQuotes) {
            currentRow.push(currentField); currentField = '';
        } else if ((char === '\r' || char === '\n') && !insideQuotes) {
            if (char === '\r' && nextChar === '\n') i++;
            currentRow.push(currentField);
            if (currentRow.length > 1 || (currentRow[0] && currentRow[0] !== '')) rows.push(currentRow);
            currentRow = []; currentField = '';
        } else {
            currentField += char;
        }
    }
    if (currentField || currentRow.length > 0) {
        currentRow.push(currentField);
        if (currentRow.length > 1 || (currentRow[0] && currentRow[0] !== '')) rows.push(currentRow);
    }

    rows.forEach((parts, index) => {
        const name = parts[0]?.trim() || '';
        const question = parts[1]?.trim() || '';
        const target = parts[2]?.trim() || 'All';
        const isExcluded = ['x', 'X', '*'].includes(parts[3]?.trim());
        const id = `p-${index}-${Date.now()}`;

        if (name && question) {
            participants.push({ id, name, question, target, isExcluded });
        }
    });

    if (participants.length === 0) {
        alert('有効なデータが見つかりませんでした。');
        return;
    }

    processParticipants(participants);
}

function addManualEntry() {
    const name = UI.manualName.value.trim();
    const question = UI.manualQuestion.value.trim();
    const target = UI.manualTarget.value.trim() || 'All';

    if (!name || !question) {
        alert('名前と質問内容を入力してください。');
        return;
    }

    const id = `m-${Date.now()}`;
    appState.manualParticipants.push({ id, name, question, target, isExcluded: false });

    // 入力欄をクリア
    UI.manualName.value = '';
    UI.manualQuestion.value = '';
    UI.manualTarget.value = '';

    renderManualList();
}

function removeManualEntry(id) {
    appState.manualParticipants = appState.manualParticipants.filter(p => p.id !== id);
    renderManualList();
}

function clearManualEntries() {
    if (appState.manualParticipants.length === 0) return;
    if (confirm('すべての登録を削除しますか？')) {
        appState.manualParticipants = [];
        renderManualList();
    }
}

function renderManualList() {
    UI.manualPreviewList.innerHTML = '';
    UI.manualEntryCount.textContent = appState.manualParticipants.length;
    UI.startManualBtn.disabled = appState.manualParticipants.length === 0;

    if (appState.manualParticipants.length === 0) {
        UI.manualPreviewList.innerHTML = '<div class="empty-msg">参加者を追加してください</div>';
        return;
    }

    appState.manualParticipants.forEach(p => {
        const item = document.createElement('div');
        item.className = 'manual-item';
        item.innerHTML = `
            <div class="manual-item-info">
                <div class="manual-item-name">${p.name}</div>
                <div class="manual-item-meta">宛先: ${p.target}</div>
            </div>
            <button class="remove-btn" onclick="removeManualEntry('${p.id}')">&times;</button>
        `;
        UI.manualPreviewList.appendChild(item);
    });
}

function addSideEntry() {
    const name = UI.sideName.value.trim();
    const question = UI.sideQuestion.value.trim();
    const target = UI.sideTarget.value.trim() || 'All';

    if (!name || !question) {
        alert('名前と質問内容を入力してください。');
        return;
    }

    const id = `s-${Date.now()}`;
    const newParticipant = { id, name, question, target, isExcluded: false };

    // 全体データに追加
    appState.allParticipants.push(newParticipant);

    // 発表者リスト（タブ）を更新する必要があるかチェック
    if (!appState.presenters.has(target)) {
        appState.presenters.add(target);
        initPresenterTabs(); // 新規タブを生成
    }

    // 現在の表示を更新
    selectPresenter(appState.currentPresenter);

    // 入力欄をクリアして閉じる
    UI.sideName.value = '';
    UI.sideQuestion.value = '';
    UI.sideTarget.value = '';
    UI.sideEntryBody.classList.add('collapsed');
    UI.sideEntryToggle.querySelector('.btn-text').style.transform = 'rotate(0deg)';
}

// CSVと手動入力の共通処理
function processParticipants(participants) {
    appState.allParticipants = [];
    appState.presenters = new Set();
    // appState.globalWinners = new Set(); // 履歴を消さないように変更
    appState.excludedIDs = new Set();

    participants.forEach(p => {
        appState.allParticipants.push(p);
        appState.presenters.add(p.target);
        if (p.isExcluded) appState.excludedIDs.add(p.id);
    });

    initPresenterTabs();

    const uploadSection = document.getElementById('upload-section');
    uploadSection?.classList.add('hidden');
    UI.presenterSection.classList.remove('hidden');
    document.getElementById('split-layout-container')?.classList.remove('hidden');

    if (appState.presenters.size > 0) {
        selectPresenter(Array.from(appState.presenters)[0]);
    }
}

function initPresenterTabs() {
    UI.presenterTabs.innerHTML = '';
    appState.presenters.forEach(presenter => {
        const btn = document.createElement('button');
        btn.className = 'presenter-tab';
        btn.textContent = presenter;
        btn.addEventListener('click', () => selectPresenter(presenter));
        UI.presenterTabs.appendChild(btn);
    });
}

function selectPresenter(presenter) {
    if (!presenter) return;
    appState.currentPresenter = presenter;

    UI.presenterTabs.querySelectorAll('.presenter-tab').forEach(btn => {
        btn.classList.toggle('active', btn.textContent === presenter);
    });

    const isGlobalExclude = UI.globalExcludeToggle?.checked ?? true;
    const isIncludeAll = UI.includeAllToggle?.checked ?? false;

    let potentialCandidates = (isIncludeAll || presenter === 'All')
        ? [...appState.allParticipants]
        : appState.allParticipants.filter(p => p.target === presenter);

    appState.currentParticipants = potentialCandidates.filter(p => {
        if (appState.excludedIDs.has(p.id)) return false;
        // グローバル除外（過去当選者）の判定に正規化ロジックを使用
        if (isGlobalExclude && isAlreadyWinner(p.name)) return false;
        return true;
    });

    if (UI.candidateCount) UI.candidateCount.textContent = `(${appState.currentParticipants.length})`;
    renderCandidateList(potentialCandidates);
    drawWheel();
}

function renderCandidateList(candidates) {
    if (!UI.candidateList) return;
    UI.candidateList.innerHTML = '';
    const searchTerm = UI.candidateSearch?.value.toLowerCase() || '';

    candidates.forEach(p => {
        const isGlobalWinner = isAlreadyWinner(p.name);
        const isExcluded = appState.excludedIDs.has(p.id);

        const item = document.createElement('div');
        item.className = `candidate-item ${isGlobalWinner ? 'winner' : ''}`;
        if (searchTerm && !p.name.toLowerCase().includes(searchTerm)) item.style.display = 'none';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = !isExcluded;
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) appState.excludedIDs.delete(p.id);
            else appState.excludedIDs.add(p.id);
            selectPresenter(appState.currentPresenter);
        });

        const label = document.createElement('span');
        label.textContent = p.name + (isGlobalWinner ? ' (当選済)' : '');

        item.appendChild(checkbox);
        item.appendChild(label);
        UI.candidateList.appendChild(item);
    });
}

function drawWheel() {
    if (appState.currentParticipants.length === 0) {
        ctx.clearRect(0, 0, UI.canvas.width, UI.canvas.height);
        return;
    }

    const arc = Math.PI * 2 / appState.currentParticipants.length;
    const radius = UI.canvas.width / 2;

    ctx.clearRect(0, 0, UI.canvas.width, UI.canvas.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.translate(radius, radius);

    appState.currentParticipants.forEach((participant, i) => {
        const angle = i * arc;
        ctx.beginPath();
        ctx.fillStyle = CONFIG.WHEEL_COLORS[i % CONFIG.WHEEL_COLORS.length];
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius, angle, angle + arc);
        ctx.lineTo(0, 0);
        ctx.fill();

        ctx.save();
        ctx.fillStyle = "white";
        const textRadius = radius - 20;
        const fontSize = Math.max(10, Math.min(20, (textRadius * arc) * 0.55));
        ctx.font = `bold ${fontSize}px ${CONFIG.FONT_FAMILY_BODY}`;
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.rotate(angle + arc / 2);
        ctx.fillText(participant.name, radius - 20, 0);
        ctx.restore();
    });
}

function spinRoulette() {
    if (appState.isSpinning || appState.currentParticipants.length === 0) return;
    appState.isSpinning = true;
    UI.spinBtn.disabled = true;

    const randomExtra = Math.random() * 360;
    const targetRotation = appState.currentRotation + (CONFIG.MIN_SPINS * 360) + randomExtra;

    UI.canvas.style.transition = `transform ${CONFIG.SPIN_DURATION / 1000}s cubic-bezier(0.15, 0, 0.15, 1)`;
    UI.canvas.style.transform = `rotate(${targetRotation}deg)`;
    appState.currentRotation = targetRotation;

    setTimeout(() => {
        const winners = [];
        const arcDegrees = 360 / appState.currentParticipants.length;
        const normalizedRotation = targetRotation % 360;
        const pointerAngles = CONFIG.POINTER_ANGLES[appState.winnerCount] || CONFIG.POINTER_ANGLES[1];

        pointerAngles.forEach(pAngle => {
            let wheelAngle = (pAngle - normalizedRotation) % 360;
            if (wheelAngle < 0) wheelAngle += 360;

            const winnerIndex = Math.floor(wheelAngle / arcDegrees);
            const winner = appState.currentParticipants[winnerIndex];

            if (winner && !winners.some(w => w.id === winner.id)) {
                winners.push(winner);
            } else if (winner) {
                const unused = appState.currentParticipants.filter(p => !winners.some(w => w.id === p.id));
                if (unused.length > 0) winners.push(unused[Math.floor(Math.random() * unused.length)]);
            }
        });
        finishSpin(winners);
    }, CONFIG.SPIN_DURATION);
}

function finishSpin(winners) {
    appState.isSpinning = false;
    UI.spinBtn.disabled = false;
    if (winners && winners.length > 0) {
        winners.forEach(w => appState.globalWinners.add(w.name));
        saveToLocalStorage(); // 保存
        selectPresenter(appState.currentPresenter);
        showResult(winners);
    }
}

function showResult(winners) {
    if (!winners || winners.length === 0) return;
    const isIncludeAll = UI.includeAllToggle?.checked ?? false;
    const modalContent = UI.resultModal.querySelector('.modal-content');
    const modalBody = UI.resultModal.querySelector('.modal-body');

    // 既存リザルトのクリア
    UI.resultModal.querySelectorAll('.result-item').forEach(item => item.remove());

    if (winners.length === 1) {
        modalContent.classList.remove('multi-winner');
        const winner = winners[0];
        UI.resultName.textContent = winner.name;
        UI.resultQuestion.textContent = isIncludeAll ? "発表を聞いての質問をお願いします" : winner.question;
        UI.resultName.style.display = 'block';
        UI.resultQuestion.style.display = 'block';
    } else {
        modalContent.classList.add('multi-winner');
        UI.resultName.style.display = 'none';
        UI.resultQuestion.style.display = 'none';
        winners.forEach(winner => {
            const item = document.createElement('div');
            item.className = 'result-item';
            item.innerHTML = `
                <div class="result-name">${winner.name}</div>
                <div class="result-question">${isIncludeAll ? "発表を聞いての質問をお願いします" : winner.question}</div>
            `;
            modalBody.appendChild(item);
        });
    }
    UI.resultModal.classList.remove('hidden');
}

function closeResult() { UI.resultModal.classList.add('hidden'); }

function resetApp() {
    UI.csvInput.value = '';
    document.getElementById('upload-section')?.classList.remove('hidden');
    UI.presenterSection.classList.add('hidden');
    document.getElementById('split-layout-container')?.classList.add('hidden');
    UI.resultModal.classList.add('hidden');
    UI.canvas.style.transition = 'none';
    UI.canvas.style.transform = 'rotate(0deg)';

    appState.currentRotation = 0;
    appState.allParticipants = [];
    appState.currentParticipants = [];
    appState.manualParticipants = [];
    appState.globalWinners = new Set();
    appState.excludedIDs = new Set();

    localStorage.removeItem(STORAGE_KEY); // 履歴消去

    renderManualList();
}

// --- 永続化機能 (LocalStorage & CSV) ---
const STORAGE_KEY = 'roulette_winners_history';

// 名前を正規化する（空白除去）
function normalizeName(name) {
    if (!name) return '';
    return name.replace(/[\s\u3000]+/g, '');
}

// 当選済みかどうか判定（正規化して比較）
function isAlreadyWinner(name) {
    const target = normalizeName(name);
    return Array.from(appState.globalWinners).some(w => normalizeName(w) === target);
}

function saveToLocalStorage() {
    const winners = Array.from(appState.globalWinners);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(winners));
}

function loadFromLocalStorage() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            const winners = JSON.parse(saved);
            if (Array.isArray(winners)) {
                winners.forEach(w => appState.globalWinners.add(w));
            }
        } catch (e) {
            console.error('Failed to load history', e);
        }
    }
}

function clearHistory() {
    if (!confirm('【注意】\nこれまでの当選履歴をすべて消去しますか？\n\n※この操作は取り消せません。')) return;

    localStorage.removeItem(STORAGE_KEY);
    appState.globalWinners.clear();

    // 画面更新
    selectPresenter(appState.currentPresenter);
    alert('当選履歴をリセットしました。');
}

function exportWinnersToCSV() {
    const winners = Array.from(appState.globalWinners);
    if (winners.length === 0) {
        alert('当選履歴がありません');
        return;
    }

    // 文字化け防止のためにBOMを付与
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const csvContent = "名前\n" + winners.join("\n");
    const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    const date = new Date();
    const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}_${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}`;

    link.setAttribute("href", url);
    link.setAttribute("download", `winners_${dateStr}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- 初期化 ---
const init = () => {
    initEventListeners();
    loadFromLocalStorage(); // 履歴の復元

    // CSVダウンロードボタンのイベント
    document.getElementById('download-csv-btn')?.addEventListener('click', exportWinnersToCSV);
    // 履歴クリアボタンのイベント
    document.getElementById('clear-history-btn')?.addEventListener('click', clearHistory);
};

// グローバルにアクセスが必要な関数
window.removeManualEntry = removeManualEntry;

init();
