/* ===== EmpireX v3 — app.js ===== */

(() => {
    'use strict';

    const TEAM_COLORS = [
        '#F49097', '#DFB2F4', '#F5E960', '#55D6C2', '#F49097',
        '#DFB2F4', '#F5E960', '#55D6C2', '#F49097', '#DFB2F4',
        '#F5E960', '#55D6C2', '#F49097', '#DFB2F4', '#F5E960',
        '#55D6C2', '#F49097', '#DFB2F4', '#F5E960', '#55D6C2'
    ];
    const BRACKET_COLORS = ['#F49097', '#DFB2F4', '#F5E960', '#55D6C2', '#F2F5FF'];
    const BRACKET_NAMES = ['Bracket A', 'Bracket B', 'Bracket C', 'Bracket D', 'Bracket E'];
    const STORAGE_KEY = 'empirex_data';

    let teams = [];
    let currentRound = 1;

    for (let i = 1; i <= 20; i++) {
        teams.push({
            id: i,
            name: `Team ${i}`,
            color: TEAM_COLORS[i - 1],
            group: -1,
            scores: [],
            total: 0
        });
    }

    function $(s) { return document.querySelector(s); }
    function $$(s) { return document.querySelectorAll(s); }

    function showScreen(id) {
        $$('.screen').forEach(s => s.classList.remove('active'));
        $(`#${id}`).classList.add('active');
    }

    function saveToStorage() {
        const data = {
            teams: teams.map(t => ({ id: t.id, name: t.name, color: t.color, group: t.group, scores: [...t.scores], total: t.total })),
            currentRound,
            bracketNames: BRACKET_NAMES,
            bracketColors: BRACKET_COLORS
        };
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { }
    }

    function loadFromStorage() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return false;
            const data = JSON.parse(raw);
            if (data && data.teams) {
                data.teams.forEach(saved => {
                    const local = teams.find(t => t.id === saved.id);
                    if (local) {
                        local.group = saved.group !== undefined ? saved.group : local.group;
                        local.scores = saved.scores || [];
                        local.total = saved.total || 0;
                    }
                });
                if (data.currentRound) currentRound = data.currentRound;
                return true;
            }
        } catch (e) { }
        return false;
    }

    function formatTime(secs) {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    /* ─── Screen 1 ─── */
    function renderCards() {
        const grid = $('#cards-grid');
        grid.innerHTML = '';
        teams.forEach(t => {
            const card = document.createElement('div');
            card.className = 'team-card';
            card.dataset.id = t.id;
            card.innerHTML = `<div class="card-bar" style="background:${t.color}"></div><div class="card-body">${t.name}</div>`;
            grid.appendChild(card);
        });
    }

    /* ─── Shuffle ─── */
    async function doShuffle() {
        $('#btn-shuffle').style.display = 'none';

        // Assign groups
        const slots = [];
        for (let g = 0; g < 5; g++) for (let s = 0; s < 4; s++) slots.push(g);
        for (let i = slots.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [slots[i], slots[j]] = [slots[j], slots[i]];
        }
        teams.forEach((t, idx) => { t.group = slots[idx]; });

        // Snapshot card positions
        const cardEls = Array.from($$('.team-card'));
        const rects = cardEls.map(el => el.getBoundingClientRect());
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;

        // Create overlay with clones
        const overlay = document.createElement('div');
        overlay.className = 'shuffle-overlay';
        document.body.appendChild(overlay);

        const clones = cardEls.map((el, i) => {
            const clone = document.createElement('div');
            clone.className = 'shuffle-card';
            clone.innerHTML = el.innerHTML;
            clone.style.width = rects[i].width + 'px';
            clone.style.height = rects[i].height + 'px';
            overlay.appendChild(clone);
            return {
                el: clone,
                origX: rects[i].left,
                origY: rects[i].top,
                w: rects[i].width,
                h: rects[i].height,
                x: rects[i].left,
                y: rects[i].top,
                angle: 0,
                scale: 1
            };
        });

        cardEls.forEach(el => el.style.visibility = 'hidden');

        function applyTransform(c) {
            c.el.style.transform = `translate(${c.x}px, ${c.y}px) rotate(${c.angle}deg) scale(${c.scale})`;
            c.el.style.left = '0';
            c.el.style.top = '0';
        }

        // Phase 1: Scatter to center area with gentle spin (~1.2s)
        await animate(1200, (p, clones) => {
            clones.forEach((c, i) => {
                const ease = p * p * (3 - 2 * p); // smoothstep
                const targetX = cx - c.w / 2 + (Math.sin(i * 1.7) * 60);
                const targetY = cy - c.h / 2 + (Math.cos(i * 1.3) * 40);
                c.x = c.origX + (targetX - c.origX) * ease;
                c.y = c.origY + (targetY - c.origY) * ease;
                c.angle = ease * 180 * (i % 2 === 0 ? 1 : -1);
                c.scale = 1 - ease * 0.15;
                applyTransform(c);
            });
        }, clones);

        // Phase 2: Quick shuffle in center (~1s)
        const shuffleStartPositions = clones.map(c => ({ x: c.x, y: c.y }));
        await animate(1000, (p, clones) => {
            clones.forEach((c, i) => {
                const t = p * Math.PI * 4;
                const jitter = Math.sin(t + i * 0.8) * (1 - p) * 80;
                c.x = shuffleStartPositions[i].x + jitter;
                c.y = shuffleStartPositions[i].y + Math.cos(t + i * 1.1) * (1 - p) * 50;
                c.angle = Math.sin(t + i) * (1 - p) * 30;
                c.scale = 0.85 + Math.sin(t * 2 + i) * 0.08;
                applyTransform(c);
            });
        }, clones);

        // Prepare brackets behind overlay
        showScreen('screen-2');
        renderBrackets();
        await sleep(80);

        // Get target positions
        const targetRects = {};
        teams.forEach(t => {
            const el = document.getElementById(`bkt-team-${t.id}`);
            if (el) targetRects[t.id] = el.getBoundingClientRect();
        });

        // Phase 3: Fly to bracket positions (~0.8s)
        const flyStarts = clones.map(c => ({ x: c.x, y: c.y, angle: c.angle, scale: c.scale }));
        await animate(800, (p, clones) => {
            const ease = 1 - Math.pow(1 - p, 3); // ease-out cubic
            clones.forEach((c, i) => {
                const team = teams[i];
                const tgt = targetRects[team.id];
                if (!tgt) return;
                const s = flyStarts[i];
                c.x = s.x + (tgt.left - s.x) * ease;
                c.y = s.y + (tgt.top - s.y) * ease;
                c.angle = s.angle * (1 - ease);
                c.scale = s.scale + (1 - s.scale) * ease;
                c.el.style.width = (c.w + (tgt.width - c.w) * ease) + 'px';
                c.el.style.height = (c.h + (tgt.height - c.h) * ease) + 'px';
                applyTransform(c);
            });
        }, clones);

        // Done — reveal bracket cards, remove overlay
        overlay.remove();
        $$('.bracket-team-row').forEach(el => el.style.visibility = 'visible');
        saveToStorage();

        // Start polling for proctor score updates
        setInterval(pollStorage, 1000);
    }

    function animate(durationMs, updateFn, clones) {
        return new Promise(resolve => {
            const start = performance.now();
            function frame(now) {
                const p = Math.min((now - start) / durationMs, 1);
                updateFn(p, clones);
                if (p < 1) requestAnimationFrame(frame);
                else resolve();
            }
            requestAnimationFrame(frame);
        });
    }

    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    /* ─── Screen 2 : Brackets ─── */
    function renderBrackets() {
        const container = $('#brackets-row');
        container.innerHTML = '';
        for (let g = 0; g < 5; g++) {
            const groupTeams = teams.filter(t => t.group === g);
            const panel = document.createElement('div');
            panel.className = 'bracket-panel';
            panel.innerHTML = `
        <div class="bracket-header" style="background:${BRACKET_COLORS[g]}">${BRACKET_NAMES[g]}</div>
        <div class="bracket-teams">
          ${groupTeams.map(t => `
            <div class="bracket-team-row" id="bkt-team-${t.id}" style="visibility:hidden;">
              <span class="bracket-team-name">
                <span class="team-dot" style="background:${t.color}"></span>
                ${t.name}
              </span>
              <span class="bracket-team-score" id="score-${t.id}">—</span>
            </div>
          `).join('')}
        </div>
      `;
            container.appendChild(panel);
        }
    }

    /* ─── Poll localStorage for proctor updates ─── */
    function pollStorage() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const data = JSON.parse(raw);
            if (!data || !data.teams) return;

            let changed = false;
            data.teams.forEach(saved => {
                const local = teams.find(t => t.id === saved.id);
                if (!local) return;
                if (JSON.stringify(local.scores) !== JSON.stringify(saved.scores) || local.total !== saved.total) {
                    local.scores = saved.scores || [];
                    local.total = saved.total || 0;
                    changed = true;
                }
            });

            if (data.currentRound && data.currentRound !== currentRound) {
                currentRound = data.currentRound;
                $('#round-label').textContent = `ROUND ${currentRound}`;
                changed = true;
            }

            if (changed) {
                teams.forEach(t => {
                    const el = document.getElementById(`score-${t.id}`);
                    if (!el) return;
                    const val = t.total > 0 ? `$${t.total}` : '—';
                    if (el.textContent !== val) {
                        el.textContent = val;
                        el.classList.add('flash');
                        setTimeout(() => el.classList.remove('flash'), 500);
                    }
                });
            }
        } catch (e) { }
    }

    function syncTimer() {
        try {
            const raw = localStorage.getItem(TIMER_KEY);
            if (!raw) return;
            const timer = JSON.parse(raw);
            const el = $('#timer-clock');
            el.textContent = formatTime(timer.seconds ?? 300);
            timer.running ? el.classList.remove('paused') : el.classList.add('paused');
        } catch (e) { }
    }

    /* ─── Init ─── */
    function init() {
        // Always start fresh — clear old state so shuffle always plays
        localStorage.removeItem(STORAGE_KEY);

        renderCards();
        $('#btn-shuffle').addEventListener('click', doShuffle);
    }

    document.addEventListener('DOMContentLoaded', init);
})();
