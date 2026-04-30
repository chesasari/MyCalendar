import './style.css';


let allSchedule = [];
let paidLeaves = JSON.parse(localStorage.getItem('paidLeaves') || '{}');
let currentMonth = new Date().getMonth() + 1;
let currentYear = 2026;
let debugLogs = [];
let columnByMonth = JSON.parse(localStorage.getItem('columnByMonth') || '{}');
let pendingWorkbook = null;
let pendingSheets = null;

const holidays2026 = [
    '2026-02-11', '2026-02-23', '2026-03-20', '2026-04-29',
    '2026-05-03', '2026-05-04', '2026-05-05', '2026-05-06',
];

function addDebugLog(msg) {
    const timestamp = new Date().toLocaleTimeString();
    debugLogs.push(`[${timestamp}] ${msg}`);
    const debugContent = document.getElementById('debug-content');
    if (debugContent) {
        debugContent.innerText = debugLogs.join('\n');
        debugContent.parentElement.parentElement.style.display = 'block';
    }
    console.log(msg);
}

async function init() {
    // Theme setup
    const savedTheme = localStorage.getItem('appTheme') || 'default';
    document.body.setAttribute('data-theme', savedTheme);
    setupThemeToggle();
    
    // Setup debug toggle
    const debugToggle = document.getElementById('debug-toggle');
    if (debugToggle) {
        debugToggle.addEventListener('click', () => {
            const panel = document.getElementById('debug-panel');
            if (panel) {
                panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
            }
        });
    }

    // Data Load
    const cached = localStorage.getItem('allSchedule');
    if (cached) {
        allSchedule = JSON.parse(cached);
    } else {
        try {
            const res = await fetch('./data.json');
            if (res.ok) {
                allSchedule = await res.json();
            }
        } catch (e) {
            console.log('No default data found, starting empty.');
        }
    }

    setupExcelImport();
    setupColumnPicker();
    setupModal();
    updateColumnDisplay();

    // 前回見ていた月を復元、なければ今月
    const savedMonth = parseInt(localStorage.getItem('lastViewedMonth') || '0');
    if (savedMonth >= 1 && savedMonth <= 12) {
        currentMonth = savedMonth;
    } else {
        currentMonth = new Date().getMonth() + 1;
    }
    currentYear = 2026;

    document.querySelectorAll('.prev-month').forEach(btn => btn.addEventListener('click', () => changeMonth(-1)));
    document.querySelectorAll('.next-month').forEach(btn => btn.addEventListener('click', () => changeMonth(1)));

    const todayBtn = document.getElementById('today-btn');
    if (todayBtn) {
        todayBtn.addEventListener('click', goToToday);
    }

    updateCalendars();
}

function getTodayStr() {
    const d = new Date();
    if (d.getFullYear() === 2026) {
        return `2026-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    return '2026-03-26'; // Mock for testing
}

function getTomorrowStr() {
    let t = new Date(getTodayStr());
    t.setDate(t.getDate() + 1);
    return `2026-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

function changeMonth(delta) {
    currentMonth += delta;
    if (currentMonth > 12) {
        currentMonth = 1;
        currentYear++;
    } else if (currentMonth < 1) {
        currentMonth = 12;
        currentYear--;
    }
    localStorage.setItem('lastViewedMonth', currentMonth);
    updateCalendars();
}

function goToToday() {
    const today = new Date();
    currentMonth = today.getMonth() + 1;
    currentYear = today.getFullYear();
    localStorage.setItem('lastViewedMonth', currentMonth);
    updateCalendars();
}

function updateCalendars() {
    const mainDisplay = document.querySelector('.main-month-display');
    const miniDisplay = document.querySelector('.mini-month-display');
    const navDesktop = document.querySelector('.month-nav-desktop');

    const text = `${currentMonth}月 ${currentYear}`;
    if (mainDisplay) mainDisplay.innerText = text;
    if (miniDisplay) miniDisplay.innerText = text;
    // Updated correctly using setAttribute to work with attr() in CSS
    if (navDesktop) navDesktop.setAttribute('data-month-text', `${currentMonth}月`);

    const schedule = allSchedule.filter(x => {
        const parts = x.date.split('-');
        return parts.length > 1 && parseInt(parts[1]) === currentMonth;
    });

    renderMainCalendar(schedule);
    renderMiniCalendar(schedule);
    updateStatusCards();
}

function getDotClass(locationUrl) {
    if (!locationUrl) return '';
    if (locationUrl.includes('在宅')) return 'dot-remote';
    if (locationUrl.includes('本社')) return 'dot-office';
    return 'dot-other';
}

function fillGridBlanks(gridElem, startDay, className) {
    for (let i = 0; i < startDay; i++) {
        const empty = document.createElement('div');
        empty.className = className;
        gridElem.appendChild(empty);
    }
}

function renderMainCalendar(schedule) {
    const grid = document.getElementById('main-calendar-body');
    if (!grid) return;
    grid.innerHTML = '';

    const todayStr = getTodayStr();
    const firstDay = new Date(currentYear, currentMonth - 1, 1).getDay();
    const lastDate = new Date(currentYear, currentMonth, 0).getDate();

    fillGridBlanks(grid, firstDay, 'main-day empty');

    for (let dayNum = 1; dayNum <= lastDate; dayNum++) {
        const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        const item = schedule.find(x => x.date === dateStr) || { date: dateStr, location: '' };

        const dayOfWeek = new Date(currentYear, currentMonth - 1, dayNum).getDay();
        const isToday = dateStr === todayStr;
        const isPublicHoliday = holidays2026.includes(dateStr);

        const userEntry = paidLeaves[dateStr] || {};
        let displayLocation = item.location; // 常にExcelから読み込んだ出社場所を基準
        let isPaidLeave = !!userEntry.isPaidLeave;
        let hasMemo = !!userEntry.memo;
        
        // メモが出社場所キーワードを含む場合のみ、メモを出社場所として扱う
        if (hasMemo && (userEntry.memo.includes('在宅') || userEntry.memo.includes('本社') || userEntry.memo.includes('ラーニングセンター'))) {
            displayLocation = userEntry.memo;
        } else if (hasMemo && !displayLocation) {
            // メモだけがある場合で、Excelから出社場所がない場合は、メモは表示オブジェクトにしない
            displayLocation = '';
        }
        
        let dotClass = getDotClass(displayLocation);

        let dayClass = '';
        if (dayOfWeek === 0 || isPublicHoliday) dayClass = 'day-sunday';
        else if (dayOfWeek === 6) dayClass = 'day-saturday';

        const dayElem = document.createElement('div');
        dayElem.className = `main-day ${isToday ? 'today' : ''} ${dayClass}`;
        dayElem.style.cursor = 'pointer';

        let dotHTML = '';
        if (isPaidLeave) {
            dotHTML = `<div style="position:absolute; bottom: 2px; font-size:1.8rem; line-height:1; transform:translateY(5px);">🏖️</div>`;
        } else if (displayLocation) {
            dotHTML = `<div class="day-dot ${dotClass}"></div>`;
        }
        
        let memoIcon = '';
        if (hasMemo && !isPaidLeave && !displayLocation) {
            memoIcon = `<div style="position:absolute; top: 2px; right: 4px; font-size:0.9rem;">📝</div>`;
        }

        dayElem.innerHTML = `
            <span class="day-num">${dayNum}</span>
            ${dotHTML}
            ${memoIcon}
        `;

        dayElem.onclick = () => openEntryModal(dateStr, dayNum, displayLocation, isPaidLeave);
        grid.appendChild(dayElem);
    }
}

function renderMiniCalendar(schedule) {
    const grid = document.getElementById('mini-calendar-body');
    if (!grid) return;
    grid.innerHTML = '';

    const todayStr = getTodayStr();
    let firstDay = new Date(currentYear, currentMonth - 1, 1).getDay();
    const lastDate = new Date(currentYear, currentMonth, 0).getDate();

    fillGridBlanks(grid, firstDay, 'mini-day empty');

    for (let dayNum = 1; dayNum <= lastDate; dayNum++) {
        const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        const item = schedule.find(x => x.date === dateStr) || { date: dateStr, location: '' };

        const dayOfWeek = new Date(currentYear, currentMonth - 1, dayNum).getDay();
        const isToday = dateStr === todayStr;
        const isPublicHoliday = holidays2026.includes(dateStr);

        const userEntry = paidLeaves[dateStr] || {};
        let displayLocation = item.location;
        let isPaidLeave = !!userEntry.isPaidLeave;
        if (userEntry.memo) displayLocation = userEntry.memo;

        let dayClass = '';
        if (dayOfWeek === 0 || isPublicHoliday) dayClass = 'day-sunday';
        else if (dayOfWeek === 6) dayClass = 'day-saturday';

        const dayElem = document.createElement('div');
        dayElem.className = `mini-day ${(displayLocation || isPaidLeave) ? 'has-data' : ''} ${isToday ? 'today' : ''} ${dayClass}`;
        dayElem.innerText = dayNum;
        grid.appendChild(dayElem);
    }
}

function updateStatusCards() {
    const todayStr = getTodayStr();
    const tomorrowStr = getTomorrowStr();

    const todayInfo = allSchedule.find(i => i.date === todayStr);
    const tomorrowInfo = allSchedule.find(i => i.date === tomorrowStr);

    updateCard('today', todayInfo || { date: todayStr, location: '' }, '予定なし');
    updateCard('tomorrow', tomorrowInfo || { date: tomorrowStr, location: '' }, '予定なし');
}

function updateCard(id, info, emptyMsg) {
    const infoEl = document.getElementById(`${id}-info`);
    const linksEl = document.getElementById(`${id}-links`);
    const cardObj = document.getElementById(`card-${id}`);
    if (!infoEl || !linksEl || !cardObj) return;

    linksEl.innerHTML = '';

    const userEntry = paidLeaves[info.date] || {};
    let displayLocation = info.location;
    let isPaidLeave = !!userEntry.isPaidLeave;
    if (userEntry.memo) displayLocation = userEntry.memo;

    const noData = !displayLocation && !isPaidLeave;

    if (!noData) {
        let displayHTML = isPaidLeave ? `🏖️ 有休取得日<br><span style="font-size:0.8rem;color:var(--text-muted);">${displayLocation}</span>` : displayLocation;
        infoEl.innerHTML = displayHTML;
        cardObj.classList.add('active-glow');

        const isOffice = displayLocation.includes('本社') && !isPaidLeave;
        const isRemote = displayLocation.includes('在宅') && !isPaidLeave;

        cardObj.classList.remove('glow-office', 'glow-remote', 'glow-other');

        if (id === 'today') {
            if (isPaidLeave) cardObj.classList.add('glow-other');
            else if (isRemote) cardObj.classList.add('glow-remote');
            else if (isOffice) cardObj.classList.add('glow-office');
            else cardObj.classList.add('glow-other');
        }

        const links = [];
        if (id === 'today' && !isPaidLeave) {
            links.push({ name: 'e-navi', url: 'https://www.enavi-ts.net/ts-h-staff/Staff/login.aspx?ID=Ve4ctWhUz' });
            links.push({ name: '勤怠打刻', url: 'https://attend.rplearn.net/' });
        }

        links.forEach(l => {
            const a = document.createElement('a');
            a.href = l.url;
            a.target = '_blank';
            a.className = `status-link-btn`;
            a.innerText = l.name;
            linksEl.appendChild(a);
        });
    } else {
        infoEl.innerText = emptyMsg;
        cardObj.classList.remove('active-glow');
        cardObj.classList.remove('glow-office', 'glow-remote', 'glow-other');
    }
}

// ========================
// Modal UI Logic
// ========================
let currentEditingDate = null;

function setupModal() {
    document.getElementById('btn-modal-cancel').onclick = () => {
        document.getElementById('entry-modal').classList.remove('active');
    };
    document.getElementById('btn-modal-save').onclick = () => {
        const isPaidLeave = document.getElementById('modal-is-paid-leave').checked;
        const memo = document.getElementById('modal-memo').value.trim();

        if (isPaidLeave || memo) {
            paidLeaves[currentEditingDate] = { isPaidLeave, memo };
        } else {
            delete paidLeaves[currentEditingDate];
        }
        localStorage.setItem('paidLeaves', JSON.stringify(paidLeaves));

        document.getElementById('entry-modal').classList.remove('active');
        updateCalendars();
    };
}

function openEntryModal(dateStr, dayNum, currentLoc, isPaidLeave) {
    currentEditingDate = dateStr;
    const entry = paidLeaves[dateStr] || {};

    document.getElementById('modal-date-title').innerText = `${currentYear}年${currentMonth}月${dayNum}日 の設定`;
    document.getElementById('modal-is-paid-leave').checked = !!entry.isPaidLeave;
    document.getElementById('modal-memo').value = entry.memo || "";

    document.getElementById('entry-modal').classList.add('active');
}

// ========================
// Local Excel Parsing Logic
// ========================
function setupExcelImport() {
    const uploadInput = document.getElementById('excel-upload');
    if (!uploadInput) return;

    uploadInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        e.target.value = ''; // 同じファイルを再選択できるようにリセット

        debugLogs = [];
        addDebugLog('=== Excelファイル解析を開始 ===');
        addDebugLog(`ファイル名: ${file.name}`);

        const updateStatus = document.getElementById('update-status');
        if (updateStatus) {
            updateStatus.style.color = 'var(--neon-cyan)';
            updateStatus.innerText = '📁 列を検出中...';
        }

        const reader = new FileReader();
        reader.onload = function (evt) {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = window.XLSX.read(data, { type: 'array' });

                addDebugLog(`シート数: ${workbook.SheetNames.length}`);
                addDebugLog(`シート名: ${workbook.SheetNames.join(', ')}`);

                const sheetsInfo = detectSheetsAndColumns(workbook);
                addDebugLog(`検出シート/月: ${sheetsInfo.map(s => `${s.month}月`).join(', ')}`);

                if (sheetsInfo.length === 0) {
                    addDebugLog('✗ 月・列が検出できませんでした');
                    if (updateStatus) {
                        updateStatus.style.color = '#ef4444';
                        updateStatus.innerText = '❌ 月・列ヘッダーが見つかりません';
                    }
                    return;
                }

                pendingWorkbook = workbook;
                pendingSheets = sheetsInfo;
                showColumnPicker(sheetsInfo);

                if (updateStatus) {
                    updateStatus.style.color = 'var(--neon-cyan)';
                    updateStatus.innerText = '📊 参照する列を選んでください';
                }
            } catch (err) {
                addDebugLog(`✗ エラー: ${err.message}`);
                if (updateStatus) {
                    updateStatus.style.color = '#ef4444';
                    updateStatus.innerText = '❌ 解析失敗: ' + err.message;
                }
            }
        };
        reader.readAsArrayBuffer(file);
    });
}

function detectSheetsAndColumns(workbook) {
    const results = [];

    workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        const rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });

        // ヘッダー行と列候補を探す
        let columns = [];
        let headerRowIdx = -1;
        for (let r = 0; r < Math.min(15, rows.length); r++) {
            if (!rows[r]) continue;
            const candidates = [];
            for (let c = 0; c < rows[r].length; c++) {
                const val = String(rows[r][c]).trim();
                if (!val || val.length <= 1 || val.length > 30) continue;
                if (/^\d{1,2}[\/\-]\d{1,2}/.test(val) || /^\d{5,}/.test(val)) continue;
                if (val.includes('エントリー') || val.includes('hr-dash') || val.includes('経験者')) {
                    candidates.push(val);
                }
            }
            if (candidates.length >= 2) {
                columns = candidates;
                headerRowIdx = r;
                break;
            }
        }
        if (columns.length === 0) return;

        // 最初のデータ行から月を検出
        let month = null;
        for (let r = (headerRowIdx === -1 ? 0 : headerRowIdx) + 1; r < Math.min(rows.length, headerRowIdx + 15); r++) {
            if (!rows[r]) continue;
            for (let c = 0; c < Math.min(4, rows[r].length); c++) {
                const d = parseExcelDate(String(rows[r][c]).trim());
                if (d) { month = parseInt(d.split('-')[1]); break; }
            }
            if (month) break;
        }
        if (!month) return;

        // 同じ月が既に追加されていなければ追加
        if (!results.find(r => r.month === month)) {
            results.push({ sheetName, month, columns });
        }
    });

    return results.sort((a, b) => a.month - b.month);
}

function showColumnPicker(sheetsInfo) {
    const container = document.getElementById('column-picker-rows');
    container.innerHTML = '';

    sheetsInfo.forEach(({ month, columns }) => {
        const savedCol = columnByMonth[month] || columns[0];

        const row = document.createElement('div');
        row.style.cssText = 'display:flex; align-items:center; gap:0.8rem;';

        const label = document.createElement('span');
        label.style.cssText = 'min-width:3rem; font-weight:600; color:var(--text-main);';
        label.textContent = `${month}月`;

        const select = document.createElement('select');
        select.dataset.month = month;
        select.style.cssText = 'flex:1; padding:0.6rem; border-radius:6px; border:1px solid var(--border-subtle); background:var(--bg-main); color:var(--text-main); font-size:0.9rem; outline:none; cursor:pointer;';

        columns.forEach(col => {
            const opt = document.createElement('option');
            opt.value = col;
            opt.text = col;
            if (col === savedCol) opt.selected = true;
            select.appendChild(opt);
        });

        row.appendChild(label);
        row.appendChild(select);
        container.appendChild(row);
    });

    document.getElementById('column-picker-modal').classList.add('active');
}

function setupColumnPicker() {
    document.getElementById('btn-column-cancel').onclick = () => {
        document.getElementById('column-picker-modal').classList.remove('active');
        pendingWorkbook = null;
        pendingSheets = null;
        const updateStatus = document.getElementById('update-status');
        if (updateStatus) updateStatus.innerText = '';
    };

    document.getElementById('btn-column-confirm').onclick = () => {
        document.querySelectorAll('#column-picker-rows select').forEach(sel => {
            columnByMonth[parseInt(sel.dataset.month)] = sel.value;
        });
        localStorage.setItem('columnByMonth', JSON.stringify(columnByMonth));
        updateColumnDisplay();
        document.getElementById('column-picker-modal').classList.remove('active');
        if (pendingWorkbook && pendingSheets) {
            doImport(pendingWorkbook, pendingSheets);
            pendingWorkbook = null;
            pendingSheets = null;
        }
    };
}

function updateColumnDisplay() {
    const el = document.getElementById('current-column-display');
    if (!el) return;
    const entries = Object.entries(columnByMonth).sort(([a], [b]) => parseInt(a) - parseInt(b));
    el.innerText = entries.length > 0
        ? entries.map(([m, col]) => `${m}月: ${col}`).join(' / ')
        : '';
}

function doImport(workbook, sheetsInfo) {
    const updateStatus = document.getElementById('update-status');
    if (updateStatus) {
        updateStatus.style.color = 'var(--neon-cyan)';
        updateStatus.innerText = '📁 取り込み中...';
    }

    const newEntries = [];

    sheetsInfo.forEach(({ sheetName, month }) => {
        const targetCol = columnByMonth[month];
        if (!targetCol) {
            addDebugLog(`✗ ${month}月: 列設定なし → スキップ`);
            return;
        }

        addDebugLog(`\n--- ${month}月 (${sheetName}): "${targetCol}" ---`);
        const sheet = workbook.Sheets[sheetName];
        const rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });

        let targetColIdx = -1;
        let dateColIdx = -1;
        let headerRowIdx = -1;

        // 列名と完全一致する列を探す
        outer: for (let r = 0; r < Math.min(15, rows.length); r++) {
            if (!rows[r]) continue;
            for (let c = 0; c < rows[r].length; c++) {
                if (String(rows[r][c]).trim() === targetCol) {
                    targetColIdx = c;
                    headerRowIdx = r;
                    addDebugLog(`✓ 列${c}、ヘッダー行${r + 1}`);
                    break outer;
                }
            }
        }

        if (targetColIdx === -1) {
            addDebugLog(`✗ "${targetCol}" 列なし → スキップ`);
            return;
        }

        // 日付列を検出
        for (let r = headerRowIdx + 1; r < Math.min(headerRowIdx + 8, rows.length); r++) {
            if (!rows[r]) continue;
            for (let c = 0; c < Math.min(6, rows[r].length); c++) {
                const val = String(rows[r][c]).trim();
                if (/^\d{4,5}(\.\d+)?$/.test(val) || /^\d{1,2}[\/\-]\d{1,2}/.test(val)) {
                    dateColIdx = c;
                    addDebugLog(`✓ 日付列: 列${c}`);
                    break;
                }
            }
            if (dateColIdx !== -1) break;
        }

        if (dateColIdx === -1) {
            addDebugLog(`✗ 日付列なし → スキップ`);
            return;
        }

        let sheetRecords = 0;
        for (let i = headerRowIdx + 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row) continue;
            const rawDate = String(row[dateColIdx] ?? '').trim();
            if (!rawDate) continue;
            const dateStr = parseExcelDate(rawDate);
            if (!dateStr) continue;
            const loc = String(row[targetColIdx] ?? '').trim();
            if (loc) {
                newEntries.push({ date: dateStr, location: loc });
                sheetRecords++;
            }
        }
        addDebugLog(`✓ 抽出: ${sheetRecords} 件`);
    });

    addDebugLog(`\n=== 今回取り込み: ${newEntries.length} 件 ===`);

    if (newEntries.length > 0) {
        // 既存データとマージ（同じ日付は上書き）
        const existing = JSON.parse(localStorage.getItem('allSchedule') || '[]');
        const byDate = {};
        existing.forEach(item => { byDate[item.date] = item; });
        newEntries.forEach(item => { byDate[item.date] = item; });
        const merged = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));

        localStorage.setItem('allSchedule', JSON.stringify(merged));
        localStorage.setItem('lastViewedMonth', currentMonth);
        addDebugLog(`✓ 保存完了 (合計 ${merged.length} 件)`);
        if (updateStatus) {
            updateStatus.style.color = '#10b981';
            updateStatus.innerText = `✅ 取り込み成功！(${newEntries.length} 件追加/更新)`;
        }
        setTimeout(() => window.location.reload(), 1500);
    } else {
        addDebugLog('✗ データなし');
        if (updateStatus) {
            updateStatus.style.color = '#ef4444';
            updateStatus.innerText = '❌ データが見つかりません (デバッグ情報を確認)';
        }
    }
}

function parseExcelDate(raw) {
    // Excelシリアル値 (40000〜60000 の整数)
    if (/^\d{4,5}(\.\d+)?$/.test(raw)) {
        const serial = parseFloat(raw);
        if (serial > 40000 && serial < 60000) {
            const dt = new Date((serial - 25567) * 86400000);
            return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
        }
    }
    // YYYY/MM/DD または YYYY-MM-DD
    let m = raw.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (m) return `${m[1]}-${String(parseInt(m[2])).padStart(2, '0')}-${String(parseInt(m[3])).padStart(2, '0')}`;
    // MM/DD/YYYY (XLSXが出力するUS形式)
    m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return `${m[3]}-${String(parseInt(m[1])).padStart(2, '0')}-${String(parseInt(m[2])).padStart(2, '0')}`;
    // MM/DD または MM-DD (曜日付きも対応)
    m = raw.match(/^(\d{1,2})[\/\-](\d{1,2})/);
    if (m) {
        const month = parseInt(m[1]);
        const year = month >= 10 ? 2025 : 2026;
        return `${year}-${String(month).padStart(2, '0')}-${String(parseInt(m[2])).padStart(2, '0')}`;
    }
    return null;
}

// ========================
// Theme Toggle Logic
// ========================
function setupThemeToggle() {
    const selector = document.getElementById('theme-selector');
    if (!selector) return;

    let currentTheme = localStorage.getItem('appTheme') || 'default';
    if (currentTheme === 'light') currentTheme = 'default';

    document.body.setAttribute('data-theme', currentTheme);
    selector.value = currentTheme;

    selector.addEventListener('change', (e) => {
        let nextTheme = e.target.value;
        document.body.setAttribute('data-theme', nextTheme);
        localStorage.setItem('appTheme', nextTheme);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    init();
});
