import './style.css';


let allSchedule = [];
let paidLeaves = JSON.parse(localStorage.getItem('paidLeaves') || '{}');
let currentMonth = new Date().getMonth() + 1;
let currentYear = 2026;
let debugLogs = [];

const holidays2026 = [
    '2026-02-11', '2026-02-23', '2026-03-20', '2026-04-29'
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
    setupModal();

    const today = new Date();
    if (today.getFullYear() === 2026) {
        currentMonth = Math.max(2, Math.min(4, today.getMonth() + 1));
        currentYear = 2026;
    } else {
        currentMonth = 3;
        currentYear = 2026;
    }

    const prevBtns = document.querySelectorAll('.prev-month');
    const nextBtns = document.querySelectorAll('.next-month');
    prevBtns.forEach(btn => btn.addEventListener('click', () => changeMonth(-1)));
    nextBtns.forEach(btn => btn.addEventListener('click', () => changeMonth(1)));
    
    // Today button
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
    updateCalendars();
}

function goToToday() {
    const today = new Date();
    if (today.getFullYear() === 2026) {
        currentMonth = today.getMonth() + 1;
        currentYear = 2026;
    } else {
        currentMonth = 3;
        currentYear = 2026;
    }
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

        debugLogs = [];
        addDebugLog('=== Excelファイル解析を開始 ===');
        addDebugLog(`ファイル名: ${file.name}`);
        addDebugLog(`ファイルサイズ: ${(file.size / 1024).toFixed(2)} KB`);

        const updateStatus = document.getElementById('update-status');
        if (updateStatus) {
            updateStatus.style.color = 'var(--neon-cyan)';
            updateStatus.innerText = '📁 解析中... しばらくお待ちください';
        }

        const reader = new FileReader();
        reader.onload = function (evt) {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = window.XLSX.read(data, { type: 'array' });
                let newSchedule = [];

                addDebugLog(`シート数: ${workbook.SheetNames.length}`);
                addDebugLog(`シート名: ${workbook.SheetNames.join(', ')}`);

                workbook.SheetNames.forEach((sheetName, sheetIdx) => {
                    addDebugLog(`\n--- シート ${sheetIdx + 1}: "${sheetName}" を処理中 ---`);
                    
                    const sheet = workbook.Sheets[sheetName];
                    const rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
                    
                    addDebugLog(`行数: ${rows.length}`);

                    let qaColIdx = -1;
                    let dateColIdx = -1;
                    let headerRowIdx = -1;

                    // ヘッダー行を探す（最初の30行を検索）
                    for (let r = 0; r < Math.min(30, rows.length); r++) {
                        if (!rows[r]) continue;
                        for (let c = 0; c < rows[r].length; c++) {
                            const val = String(rows[r][c]).trim().toLowerCase();
                            
                            // QA列を探す
                            if (qaColIdx === -1 && (val.includes('qa') || val.includes('エントリー'))) {
                                qaColIdx = c;
                                addDebugLog(`✓ QA列を検出: 列${c} (${String(rows[r][c]).trim()})`);
                            }
                            
                            // 日付列のヘッダー候補を一時保存（後で検証）
                            if (dateColIdx === -1 && (val.includes('日付') || val.includes('date'))) {
                                dateColIdx = c;
                                addDebugLog(`✓ 日付列を検出: 列${c} (${String(rows[r][c]).trim()})`);
                            }
                        }
                        // ヘッダー行を特定
                        if ((qaColIdx !== -1 || dateColIdx !== -1) && headerRowIdx === -1) {
                            headerRowIdx = r;
                            addDebugLog(`✓ ヘッダー行を検出: 行${r + 1}`);
                        }
                    }
                    
                    // 日付列が「日付」「date」で見つからない場合、実際のデータから推測
                    if (dateColIdx === -1 && headerRowIdx !== -1) {
                        addDebugLog(`日付列をデータから推測中...`);
                        let maxDateCount = -1;
                        let detectedDateColIdx = -1;
                        
                        // 最初の20列をチェック
                        for (let c = 0; c < Math.min(20, rows[0].length); c++) {
                            let dateCount = 0;
                            // ヘッダー行の次の15行をチェック
                            for (let r = headerRowIdx + 1; r < Math.min(headerRowIdx + 16, rows.length); r++) {
                                if (!rows[r] || !rows[r][c]) continue;
                                const cellVal = String(rows[r][c]).trim();
                                // 日付形式（MM/DD, MM-DD など）が含まれているか
                                if (/\d{1,2}[\\/\-]\d{1,2}/.test(cellVal)) {
                                    dateCount++;
                                }
                            }
                            if (dateCount > maxDateCount) {
                                maxDateCount = dateCount;
                                detectedDateColIdx = c;
                            }
                        }
                        
                        if (detectedDateColIdx !== -1) {
                            dateColIdx = detectedDateColIdx;
                            addDebugLog(`✓ 日付列を推測検出: 列${dateColIdx} (日付フォーマット数: ${maxDateCount})`);
                        }
                    }

                    // QA列が見つからない場合はスキップ
                    if (qaColIdx === -1) {
                        addDebugLog(`✗ このシートにQA列が見つかりません`);
                        return;
                    }
                    
                    if (dateColIdx === -1) {
                        // A列を試してみる
                        if (rows[headerRowIdx + 1] && rows[headerRowIdx + 1][0] && String(rows[headerRowIdx + 1][0]).match(/^\d{1,2}[\\/\-]\d{1,2}/)) {
                            dateColIdx = 0;
                            addDebugLog(`ⓘ 日付列が明示的に見つかりませんが、A列に日付らしきデータを発見しました`);
                        } else {
                            dateColIdx = 1; // デフォルトはB列
                            addDebugLog(`ⓘ 日付列が見つからないため、B列を使用します`);
                        }
                    }
                    if (headerRowIdx === -1) headerRowIdx = 0;

                    console.log(`Processing with QA column: ${qaColIdx}, Date column: ${dateColIdx}, Header row: ${headerRowIdx}`);

                    let sheetRecords = 0;
                    let processedRows = 0;
                    // ヘッダー行以降のデータを処理
                    for (let i = headerRowIdx + 1; i < rows.length; i++) {
                        const row = rows[i];
                        processedRows++;
                        if (!row || row[dateColIdx] === undefined || row[dateColIdx] === null || row[dateColIdx] === "") continue;

                        let dateStr = "";
                        const rawDate = row[dateColIdx];
                        const dateStr_raw = String(rawDate).trim();

                        if (!dateStr_raw) continue;

                        // 日付形式1: シリアル値
                        if (/^\d+$/.test(dateStr_raw)) {
                            try {
                                const serial = parseFloat(dateStr_raw);
                                if (serial > 0 && serial < 50000) {
                                    const dt = new Date((serial - 25567) * 86400000);
                                    dateStr = `2026-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
                                }
                            } catch (err) {}
                        }

                        // 日付形式2-a: YYYY-MM-DD or YYYY/MM/DD
                        if (!dateStr) {
                            const m = dateStr_raw.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
                            if (m) {
                                dateStr = `${m[1]}-${String(parseInt(m[2])).padStart(2, '0')}-${String(parseInt(m[3])).padStart(2, '0')}`;
                            }
                        }
                        
                        // 日付形式2-b: MM-DD or MM/DD（括弧や曜日が付いていても対応）
                        if (!dateStr) {
                            const m = dateStr_raw.match(/^(\d{1,2})[\/\-](\d{1,2})/);
                            if (m) {
                                const month = parseInt(m[1]);
                                // 10月～12月は2025年、1月～9月は2026年と推定
                                const year = month >= 10 ? 2025 : 2026;
                                dateStr = `${year}-${String(month).padStart(2, '0')}-${String(parseInt(m[2])).padStart(2, '0')}`;
                            }
                        }

                        if (dateStr) {
                            const loc = (row[qaColIdx] || "").toString().trim();
                            if (loc) {
                                newSchedule.push({ date: dateStr, location: loc });
                                sheetRecords++;
                            }
                        }
                    }
                    
                    addDebugLog(`✓ 処理行数: ${processedRows}, 抽出レコード: ${sheetRecords}`);
                });

                addDebugLog(`\n=== 合計: ${newSchedule.length} 件のレコードを抽出 ===`);

                if (newSchedule.length > 0) {
                    localStorage.setItem('allSchedule', JSON.stringify(newSchedule));
                    addDebugLog(`✓ ローカルストレージに保存しました`);
                    if (updateStatus) {
                        updateStatus.style.color = '#10b981';
                        updateStatus.innerText = `✅ 取り込み成功！( ${newSchedule.length} 件 )`;
                    }
                    setTimeout(() => window.location.reload(), 1500);
                } else {
                    addDebugLog(`✗ データが抽出できませんでした`);
                    addDebugLog(`\n【確認項目】`);
                    addDebugLog(`1. ファイルにQA列が含まれていますか？`);
                    addDebugLog(`2. ヘッダー行以降にデータが存在しますか？`);
                    addDebugLog(`3. 日付列に日付が入力されていますか？`);
                    addDebugLog(`4. 出社場所列に出社場所が入力されていますか？`);
                    if (updateStatus) {
                        updateStatus.style.color = '#ef4444';
                        updateStatus.innerText = '❌ エラー: データが見つかりません (デバッグ情報を確認)';
                    }
                }
            } catch (e) {
                addDebugLog(`✗ エラーが発生しました: ${e.message}`);
                addDebugLog(`スタック: ${e.stack}`);
                if (updateStatus) {
                    updateStatus.style.color = '#ef4444';
                    updateStatus.innerText = '❌ 解析に失敗しました: ' + e.message;
                }
            }
        };
        reader.readAsArrayBuffer(file);
    });
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
