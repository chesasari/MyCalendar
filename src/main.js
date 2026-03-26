let allSchedule = [];
let paidLeaves = JSON.parse(localStorage.getItem('paidLeaves') || '{}');
let currentMonth = new Date().getMonth() + 1;
let currentYear = 2026;

const holidays2026 = [
    '2026-02-11', '2026-02-23', '2026-03-20', '2026-04-29'
];

async function init() {
    // Theme setup
    const savedTheme = localStorage.getItem('appTheme') || 'default';
    document.body.setAttribute('data-theme', savedTheme);
    setupThemeToggle();

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
        let displayLocation = item.location;
        let isPaidLeave = !!userEntry.isPaidLeave;
        if (userEntry.memo) displayLocation = userEntry.memo;
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
        
        dayElem.innerHTML = `
            <span class="day-num">${dayNum}</span>
            ${dotHTML}
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
        
        const updateStatus = document.getElementById('update-status');
        if (updateStatus) {
            updateStatus.style.color = 'var(--neon-cyan)';
            updateStatus.innerText = '📁 解析中... しばらくお待ちください';
        }
        
        const reader = new FileReader();
        reader.onload = function(evt) {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = window.XLSX.read(data, {type: 'array'});
                let newSchedule = [];
                
                workbook.SheetNames.forEach(sheetName => {
                    const sheet = workbook.Sheets[sheetName];
                    const rows = window.XLSX.utils.sheet_to_json(sheet, {header: 1, defval: "", raw: false});
                    
                    let qaColIdx = -1;
                    for (let r = 0; r < 20; r++) {
                        if (!rows[r]) continue;
                        for (let c = 0; c < rows[r].length; c++) {
                            const val = String(rows[r][c]);
                            if (val.includes('エントリー') && val.includes('QA')) {
                                qaColIdx = c;
                                break;
                            }
                        }
                        if (qaColIdx !== -1) break;
                    }
                    
                    if (qaColIdx === -1) return;
                    
                    rows.forEach(row => {
                        const rawDate = row[1]; // B Column
                        if (!rawDate) return;
                        
                        let dateStr = "";
                        const m = String(rawDate).match(/(\d{1,4})[\/\-](\d{1,2})[\/\-\(]?(\d{1,2})?/);
                        if (m) {
                            if (m[3] && m[1].length === 4) {
                                const dt = new Date(m[1], parseInt(m[2])-1, parseInt(m[3]));
                                dateStr = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
                            } else {
                                dateStr = `2026-${String(m[1]).padStart(2,'0')}-${String(m[2]).padStart(2,'0')}`;
                            }
                        }
                        
                        if (dateStr) {
                            const loc = row[qaColIdx] || "";
                            newSchedule.push({ date: dateStr, location: String(loc).trim() });
                        }
                    });
                });
                
                if (newSchedule.length > 0) {
                    localStorage.setItem('allSchedule', JSON.stringify(newSchedule));
                    if (updateStatus) {
                        updateStatus.style.color = '#10b981';
                        updateStatus.innerText = '✅ 取り込み成功！';
                    }
                    setTimeout(() => window.location.reload(), 1500);
                } else {
                    if (updateStatus) {
                        updateStatus.style.color = '#ef4444';
                        updateStatus.innerText = '❌ エラー: QAリストが見つかりません';
                    }
                }
            } catch(e) {
                if (updateStatus) {
                    updateStatus.style.color = '#ef4444';
                    updateStatus.innerText = '❌ 解析に失敗しました';
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
    const btn = document.getElementById('btn-theme-toggle');
    if (!btn) return;
    
    const themes = ['default', 'sanrio', 'disney'];
    
    // Switch themes
    btn.addEventListener('click', () => {
        let currentTheme = document.body.getAttribute('data-theme') || 'default';
        if (currentTheme === 'light') currentTheme = 'default';
        let toggleIndex = (themes.indexOf(currentTheme) + 1) % themes.length;
        let nextTheme = themes[toggleIndex];
        
        document.body.setAttribute('data-theme', nextTheme);
        localStorage.setItem('appTheme', nextTheme);
        
        updateThemeButtonLabel(nextTheme, btn);
    });
    
    // Initialize label
    let initTheme = document.body.getAttribute('data-theme') || 'default';
    if (initTheme === 'light') {
        initTheme = 'default';
        document.body.setAttribute('data-theme', 'default');
    }
    updateThemeButtonLabel(initTheme, btn);
}

function updateThemeButtonLabel(theme, btn) {
    let name = 'ダークネオン';
    if (theme === 'sanrio') name = 'サンリオ風';
    if (theme === 'disney') name = 'ディズニー風';
    btn.innerHTML = `🎨 着せ替え (${name})`;
}

document.addEventListener('DOMContentLoaded', () => {
    const clearBtn = document.getElementById('btn-clear-data');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (confirm('登録した有休や取り込んだExcelデータをすべてリセットし、初期状態に戻しますか？')) {
                localStorage.clear();
                window.location.reload();
            }
        });
    }
    init();
});
