document.addEventListener('DOMContentLoaded', () => {

    // ─── LEVELS CONFIG ───────────────────────────────────────────────────
    const LEVELS = [
        { level: 1,  min: 0,    max: 150,  label: 'Beginner' },
        { level: 2,  min: 150,  max: 400,  label: 'Apprentice' },
        { level: 3,  min: 400,  max: 750,  label: 'Explorer' },
        { level: 4,  min: 750,  max: 1200, label: 'Achiever' },
        { level: 5,  min: 1200, max: 2000, label: 'Master' },
        { level: 6,  min: 2000, max: 3000, label: 'Champion' },
        { level: 7,  min: 3000, max: Infinity, label: 'Legend' },
    ];

    const BADGES = [
        { min: 0,    label: '🥉 Bronze',   threshold: 0 },
        { min: 150,  label: '🥈 Silver',   threshold: 150 },
        { min: 500,  label: '🥇 Gold',     threshold: 500 },
        { min: 1000, label: '💎 Diamond',  threshold: 1000 },
        { min: 2500, label: '👑 Legend',   threshold: 2500 },
    ];

    // ─── STATE ────────────────────────────────────────────────────────────
    const today = getTodayKey();

    let state = loadState();

    // Daily reset: if last active day ≠ today, reset task completion, record leaderboard
    if (state.lastActiveDate !== today) {
        handleDailyReset();
    }

    // ─── DOM REFS ─────────────────────────────────────────────────────────
    const pointsDisplay   = document.getElementById('points-display');
    const streakDisplay   = document.getElementById('streak-display');
    const badgeDisplay    = document.getElementById('badge-display');
    const levelLabel      = document.getElementById('level-label');
    const levelNext       = document.getElementById('level-next');
    const levelBarFill    = document.getElementById('level-bar-fill');

    const taskInput       = document.getElementById('task-input');
    const addTaskBtn      = document.getElementById('add-task-btn');
    const taskList        = document.getElementById('task-list');
    const tasksCount      = document.getElementById('tasks-count');
    const allCompleteMsg  = document.getElementById('all-complete-msg');

    const hobbyInput      = document.getElementById('hobby-input');
    const addHobbyBtn     = document.getElementById('add-hobby-btn');
    const hobbyList       = document.getElementById('hobby-list');

    const calendarGrid    = document.getElementById('calendar-grid');
    const monthYearDisplay= document.getElementById('month-year-display');
    const prevMonthBtn    = document.getElementById('prev-month');
    const nextMonthBtn    = document.getElementById('next-month');

    const leaderboardBody = document.getElementById('leaderboard-body');
    const toast           = document.getElementById('toast');

    let currentCalDate = new Date();

    // ─── INIT ─────────────────────────────────────────────────────────────
    updateUI();

    // ─── EVENT LISTENERS ──────────────────────────────────────────────────
    addTaskBtn.addEventListener('click', addTask);
    taskInput.addEventListener('keypress', e => { if (e.key === 'Enter') addTask(); });

    addHobbyBtn.addEventListener('click', addHobby);
    hobbyInput.addEventListener('keypress', e => { if (e.key === 'Enter') addHobby(); });

    prevMonthBtn.addEventListener('click', () => {
        currentCalDate.setMonth(currentCalDate.getMonth() - 1);
        renderCalendar();
    });
    nextMonthBtn.addEventListener('click', () => {
        currentCalDate.setMonth(currentCalDate.getMonth() + 1);
        renderCalendar();
    });

    // ─── STATE HELPERS ────────────────────────────────────────────────────
    function getTodayKey() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }

    function defaultState() {
        return {
            totalPoints: 0,
            streak: 0,
            lastActiveDate: null,
            completedDays: {},        // { "2024-01-01": pointsEarned }
            tasks: [],
            hobbies: [],
            leaderboard: [],          // [{ date, points }]
        };
    }

    function loadState() {
        try {
            return JSON.parse(localStorage.getItem('gamifiedTodo')) || defaultState();
        } catch {
            return defaultState();
        }
    }

    function saveState() {
        localStorage.setItem('gamifiedTodo', JSON.stringify(state));
    }

    // ─── DAILY RESET ──────────────────────────────────────────────────────
    function handleDailyReset() {
        const prev = state.lastActiveDate;

        // Record points earned yesterday on leaderboard
        if (prev) {
            const earnedYesterday = state.completedDays[prev] || 0;
            if (earnedYesterday > 0) {
                // Push to leaderboard
                state.leaderboard.push({ date: prev, points: earnedYesterday });
                // Keep top 10
                state.leaderboard.sort((a, b) => b.points - a.points);
                state.leaderboard = state.leaderboard.slice(0, 10);

                // Update streak: check if yesterday was actually the day before today
                const prevDate = new Date(prev);
                const todayDate = new Date(today);
                const diffDays = Math.round((todayDate - prevDate) / (1000 * 60 * 60 * 24));
                if (diffDays === 1) {
                    state.streak += 1;
                } else {
                    state.streak = 1; // broken streak
                }
            } else {
                state.streak = 0; // no tasks completed yesterday
            }
        }

        // Reset today's task completion
        state.tasks.forEach(t => t.completed = false);
        state.completedDays[today] = 0;
        state.lastActiveDate = today;

        saveState();
    }

    // ─── FULL UI UPDATE ───────────────────────────────────────────────────
    function updateUI() {
        updateStats();
        renderTasks();
        renderHobbies();
        renderCalendar();
        renderLeaderboard();
    }

    // ─── STATS (points, streak, badge, level) ────────────────────────────
    function updateStats() {
        pointsDisplay.textContent = state.totalPoints;
        streakDisplay.textContent = state.streak;
        updateBadge();
        updateLevel();
    }

    function updateBadge() {
        const badge = [...BADGES].reverse().find(b => state.totalPoints >= b.min) || BADGES[0];
        badgeDisplay.textContent = badge.label;
    }

    function updateLevel() {
        const lvl = [...LEVELS].reverse().find(l => state.totalPoints >= l.min) || LEVELS[0];
        levelLabel.textContent = `Level ${lvl.level} — ${lvl.label}`;
        if (lvl.max === Infinity) {
            levelNext.textContent = 'Max Level!';
            levelBarFill.style.width = '100%';
        } else {
            levelNext.textContent = `Next: ${lvl.max} pts`;
            const pct = ((state.totalPoints - lvl.min) / (lvl.max - lvl.min)) * 100;
            levelBarFill.style.width = Math.min(pct, 100) + '%';
        }
    }

    // ─── TASKS ────────────────────────────────────────────────────────────
    function addTask() {
        const text = taskInput.value.trim();
        if (!text) return;
        state.tasks.push({ id: Date.now(), text, completed: false });
        taskInput.value = '';
        saveState();
        renderTasks();
    }

    function completeTask(id) {
        const task = state.tasks.find(t => t.id === id);
        if (!task || task.completed) return;
        task.completed = true;
        state.totalPoints += 30;
        state.completedDays[today] = (state.completedDays[today] || 0) + 30;
        if (!state.lastActiveDate) state.lastActiveDate = today;
        saveState();
        renderTasks();
        updateStats();
        renderLeaderboard();
        showToast('🎉 +30 Points! Keep going!');

        // Check all complete
        if (state.tasks.every(t => t.completed)) {
            allCompleteMsg.style.display = 'block';
            showToast('🏆 All tasks done today! Incredible!');
        }
    }

    function deleteTask(id) {
        state.tasks = state.tasks.filter(t => t.id !== id);
        saveState();
        renderTasks();
    }

    function renderTasks() {
        taskList.innerHTML = '';
        const total = state.tasks.length;
        const done  = state.tasks.filter(t => t.completed).length;
        tasksCount.textContent = `${done}/${total}`;
        allCompleteMsg.style.display = (total > 0 && done === total) ? 'block' : 'none';

        state.tasks.forEach(task => {
            const li = document.createElement('li');
            if (task.completed) li.classList.add('completed');

            const span = document.createElement('span');
            span.className = 'item-text';
            span.textContent = task.text;

            li.appendChild(span);

            if (!task.completed) {
                const cBtn = document.createElement('button');
                cBtn.textContent = '✔ +30 pts';
                cBtn.className = 'btn-complete';
                cBtn.onclick = () => completeTask(task.id);
                li.appendChild(cBtn);
            }

            const dBtn = document.createElement('button');
            dBtn.textContent = '🗑';
            dBtn.className = 'btn-delete';
            dBtn.onclick = () => deleteTask(task.id);
            li.appendChild(dBtn);

            taskList.appendChild(li);
        });
    }

    // ─── HOBBIES ──────────────────────────────────────────────────────────
    function addHobby() {
        const text = hobbyInput.value.trim();
        if (!text) return;
        state.hobbies.push({ id: Date.now(), text });
        hobbyInput.value = '';
        saveState();
        renderHobbies();
    }

    function deleteHobby(id) {
        state.hobbies = state.hobbies.filter(h => h.id !== id);
        saveState();
        renderHobbies();
    }

    function renderHobbies() {
        hobbyList.innerHTML = '';
        state.hobbies.forEach(hobby => {
            const li = document.createElement('li');

            const span = document.createElement('span');
            span.className = 'item-text';
            span.textContent = hobby.text;

            const dBtn = document.createElement('button');
            dBtn.textContent = '🗑';
            dBtn.className = 'btn-delete';
            dBtn.onclick = () => deleteHobby(hobby.id);

            li.appendChild(span);
            li.appendChild(dBtn);
            hobbyList.appendChild(li);
        });
    }

    // ─── CALENDAR ─────────────────────────────────────────────────────────
    function renderCalendar() {
        calendarGrid.innerHTML = '';

        const year  = currentCalDate.getFullYear();
        const month = currentCalDate.getMonth();

        const monthNames = ['January','February','March','April','May','June',
                            'July','August','September','October','November','December'];
        monthYearDisplay.textContent = `${monthNames[month]} ${year}`;

        // Day headers
        ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d => {
            const cell = document.createElement('div');
            cell.className = 'cal-cell header-cell';
            cell.textContent = d;
            calendarGrid.appendChild(cell);
        });

        const firstDay    = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const realToday   = new Date();

        // Empty leading cells
        for (let i = 0; i < firstDay; i++) {
            const cell = document.createElement('div');
            cell.className = 'cal-cell empty';
            calendarGrid.appendChild(cell);
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const cell = document.createElement('div');
            cell.className = 'cal-cell';
            cell.textContent = d;

            const key = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

            if (year === realToday.getFullYear() && month === realToday.getMonth() && d === realToday.getDate()) {
                cell.classList.add('today');
            }

            if (state.completedDays[key] && state.completedDays[key] > 0) {
                cell.classList.add('completed-day');
                cell.title = `+${state.completedDays[key]} pts earned`;
            }

            calendarGrid.appendChild(cell);
        }
    }

    // ─── LEADERBOARD ──────────────────────────────────────────────────────
    function renderLeaderboard() {
        leaderboardBody.innerHTML = '';

        // Include today if it has points
        let entries = [...state.leaderboard];
        const todayPts = state.completedDays[today] || 0;
        if (todayPts > 0) {
            // Check if today is already in entries
            if (!entries.find(e => e.date === today)) {
                entries.push({ date: today, points: todayPts });
            }
        }
        entries.sort((a, b) => b.points - a.points);
        entries = entries.slice(0, 10);

        if (entries.length === 0) {
            leaderboardBody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#555;padding:1rem;">No records yet. Complete tasks!</td></tr>';
            return;
        }

        const medals = ['🥇', '🥈', '🥉'];

        entries.forEach((entry, idx) => {
            const tr = document.createElement('tr');
            if (idx < 3) tr.className = `rank-${idx+1}`;

            const rankTd = document.createElement('td');
            rankTd.textContent = (medals[idx] || `#${idx+1}`);

            const dateTd = document.createElement('td');
            dateTd.textContent = formatDate(entry.date) + (entry.date === today ? ' 🌟 (Today)' : '');

            const ptsTd = document.createElement('td');
            ptsTd.textContent = `${entry.points} pts`;
            ptsTd.style.fontWeight = 'bold';
            ptsTd.style.color = idx === 0 ? 'var(--gold)' : idx === 1 ? 'var(--silver)' : idx === 2 ? 'var(--bronze)' : 'var(--text)';

            tr.appendChild(rankTd);
            tr.appendChild(dateTd);
            tr.appendChild(ptsTd);
            leaderboardBody.appendChild(tr);
        });
    }

    function formatDate(key) {
        const [y, m, d] = key.split('-');
        const date = new Date(y, m - 1, d);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    // ─── TOAST ────────────────────────────────────────────────────────────
    let toastTimer;
    function showToast(msg) {
        toast.textContent = msg;
        toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
    }

    // ─── MIDNIGHT RESET CHECK ─────────────────────────────────────────────
    // Re-check every minute if the date changed (tab left open overnight)
    setInterval(() => {
        const nowKey = getTodayKey();
        if (nowKey !== state.lastActiveDate) {
            handleDailyReset();
            updateUI();
        }
    }, 60000);

});
