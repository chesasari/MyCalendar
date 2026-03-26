// Calendar Data
const holidays = ['2026-04-29']; // Showa Day

async function init() {
    const res = await fetch('/data.json');
    const schedule = await res.json();
    
    renderCalendar(schedule);
    renderToday(schedule);
    setupICSExport(schedule);
    setupNotifications();
}

function renderCalendar(schedule) {
    const grid = document.getElementById('calendar-body');
    grid.innerHTML = '';

    // April 2026 starts on Wednesday (3rd in 0-indexed Sun=0)
    // 2026-04-01 is Wednesday.
    const startDay = new Date(2026, 3, 1).getDay(); // 3 (Wed)
    
    // Fill empty cells
    for (let i = 0; i < startDay; i++) {
        const empty = document.createElement('div');
        empty.className = 'calendar-day empty';
        grid.appendChild(empty);
    }

    schedule.forEach(item => {
        const date = new Date(item.date);
        const dayNum = date.getDate();
        const dayOfWeek = date.getDay();
        const fullDate = item.date;

        const dayElem = document.createElement('div');
        dayElem.className = 'calendar-day';
        
        // Weekend / Holiday coloring
        if (dayOfWeek === 0) dayElem.classList.add('sun');
        if (dayOfWeek === 6) dayElem.classList.add('sat');
        if (holidays.includes(fullDate)) dayElem.classList.add('holiday');

        const locClass = getLocClass(item.location);
        const locDisplay = item.location ? `<span class="location-tag ${locClass}">${item.location}</span>` : '';
        
        dayElem.innerHTML = `
            <span class="day-number">${dayNum}</span>
            ${locDisplay}
        `;
        grid.appendChild(dayElem);
    });
}

function getLocClass(loc) {
    if (loc.includes('本社')) return 'location-office';
    if (loc.includes('在宅')) return 'location-remote';
    if (loc.includes('SK')) return 'location-sk';
    if (loc.includes('ラーニング')) return 'location-lc';
    return 'location-unknown';
}

function renderToday(schedule) {
    const today = new Date();
    // For testing/mocking in 2026
    const todayStr = today.toISOString().split('T')[0];
    const todayInfo = schedule.find(i => i.date === todayStr);
    
    const display = document.getElementById('today-info');
    if (todayInfo) {
        display.innerHTML = `<span class="${getLocClass(todayInfo.location)}">${todayInfo.location}</span>`;
    } else if (today.getMonth() === 3) {
        display.innerText = "データなし";
    } else {
        display.innerText = "4月の予定のみ表示中";
    }
}

function setupICSExport(schedule) {
    document.getElementById('add-to-calendar').onclick = () => {
        let ics = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//Antigravity//QA-Calendar//JP",
            "X-WR-CALNAME:出社場所(4月)",
            "CALSCALE:GREGORIAN"
        ];

        schedule.forEach(item => {
            if (item.location === "不明") return;
            const date = item.date.replace(/-/g, '');
            ics.push("BEGIN:VEVENT");
            ics.push(`DTSTART;VALUE=DATE:${date}`);
            ics.push(`DTEND;VALUE=DATE:${date}`); // All-day event
            ics.push(`SUMMARY:出社先: ${item.location}`);
            ics.push(`DESCRIPTION:会社から配布されたスケジュールに基づく出社場所です。`);
            ics.push("END:VEVENT");
        });

        ics.push("END:VCALENDAR");

        const blob = new Blob([ics.join("\r\n")], { type: 'text/calendar;charset=utf-8' });
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.setAttribute('download', 'work-schedule.ics');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
}

function setupNotifications() {
    const modal = document.getElementById('notification-modal');
    const toggle = document.getElementById('notification-toggle');
    const close = document.getElementById('close-modal');
    const save = document.getElementById('save-notification');
    const timeInput = document.getElementById('notification-time');

    // Load saved time
    const savedTime = localStorage.getItem('notificationTime') || "08:00";
    timeInput.value = savedTime;

    toggle.onclick = () => modal.classList.remove('hidden');
    close.onclick = () => modal.classList.add('hidden');

    save.onclick = async () => {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            localStorage.setItem('notificationTime', timeInput.value);
            modal.classList.add('hidden');
            alert('通知を保存しました。サイトをブラウザで開いている間、指定時間にお知らせします。');
            startNotificationTimer();
        } else {
            alert('通知の許可が必要です。');
        }
    };

    if (Notification.permission === 'granted') {
        startNotificationTimer();
    }
}

let timerId = null;
function startNotificationTimer() {
    if (timerId) clearInterval(timerId);
    timerId = setInterval(() => {
        const now = new Date();
        const time = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
        const savedTime = localStorage.getItem('notificationTime');
        
        if (time === savedTime && now.getSeconds() < 10) { // Check once a minute
            showNotification();
        }
    }, 10000);
}

async function showNotification() {
    const res = await fetch('/data.json');
    const schedule = await res.json();
    
    // Get tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    const item = schedule.find(i => i.date === tomorrowStr);

    if (item && item.location) {
        new Notification("明日の出社場所", {
            body: `明日(${tomorrowStr})の場所は「${item.location}」です。`,
            icon: "/favicon.svg"
        });
    }
}

init();
