/* ===== EmpireX v2 — app.js ===== */

(() => {
    'use strict';

    /* ─── Constants ─── */
    const PROPERTY_COLORS = [
        '#8B4513', '#5bc0eb', '#e84393', '#f77f00',
        '#d62828', '#f4d35e', '#06d6a0', '#1d3a8a',
        '#00ced1', '#b5179e'
    ];
    const GROUP_COLORS = ['#8B4513', '#5bc0eb', '#e84393', '#f77f00', '#d62828'];
    const GROUP_NAMES = ['Group A', 'Group B', 'Group C', 'Group D', 'Group E'];
    const STORAGE_KEY = 'empirex_data';

    /* ─── State ─── */
    let teams = [];
    let currentRound = 1;
    let timerInterval = null;

    for (let i = 1; i <= 20; i++) {
        teams.push({
            id: i,
            name: `Team ${i}`,
            color: PROPERTY_COLORS[(i - 1) % PROPERTY_COLORS.length],
            group: -1,
            scores: [],
            total: 0
        });
    }

    /* ─── Helpers ─── */
    function $(sel) { return document.querySelector(sel); }
    function $$(sel) { return document.querySelectorAll(sel); }

    function showScreen(id) {
        $$('.screen').forEach(s => s.classList.remove('active'));
        const screen = $(`#${id}`);
        screen.classList.add('active');
        // Force reflow for opacity transition
        void screen.offsetWidth;
    }

    function saveToStorage() {
        const data = {
            teams: teams.map(t => ({ id: t.id, name: t.name, color: t.color, group: t.group, scores: [...t.scores], total: t.total })),
            currentRound: currentRound,
            groupNames: GROUP_NAMES,
            groupColors: GROUP_COLORS
        };
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
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
        } catch (e) { /* ignore */ }
        return false;
    }

    function formatTime(secs) {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    /* ─── Screen 1 : Team Cards ─── */
    function renderScreen1() {
        const grid = $('#cards-grid');
        grid.innerHTML = '';
        teams.forEach(t => {
            const card = document.createElement('div');
            card.className = 'team-card';
            card.dataset.id = t.id;
            card.innerHTML = `
        <div class="card-bar" style="background:${t.color}"></div>
        <div class="card-body">${t.name}</div>
      `;
            grid.appendChild(card);
        });
    }

    /* ─── Shuffle Animation (3-phase rAF) ─── */
    async function doShuffle() {
        const btn = $('#btn-shuffle');
        btn.style.display = 'none';

        // Assign groups randomly
        const slots = [];
        for (let g = 0; g < 5; g++) for (let s = 0; s < 4; s++) slots.push(g);
        for (let i = slots.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [slots[i], slots[j]] = [slots[j], slots[i]];
        }
        teams.forEach((t, idx) => { t.group = slots[idx]; });

        // Snapshot positions of cards
        const cardEls = Array.from($$('.team-card'));
        const rects = cardEls.map(el => el.getBoundingClientRect());

        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'shuffle-overlay';
        document.body.appendChild(overlay);

        // Create clones on overlay at original positions
        const clones = cardEls.map((el, i) => {
            const clone = document.createElement('div');
            clone.className = 'shuffle-card';
            clone.innerHTML = el.innerHTML;
            clone.style.left = rects[i].left + 'px';
            clone.style.top = rects[i].top + 'px';
            clone.style.width = rects[i].width + 'px';
            clone.style.height = rects[i].height + 'px';
            overlay.appendChild(clone);
            return {
                el: clone,
                startX: rects[i].left + rects[i].width / 2,
                startY: rects[i].top + rects[i].height / 2,
                w: rects[i].width,
                h: rects[i].height,
                angle: 0,
                x: rects[i].left,
                y: rects[i].top,
                scale: 1
            };
        });

        // Hide originals
        cardEls.forEach(el => el.style.visibility = 'hidden');

        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;

        // ─ Phase 1: Spiral outward (~1.5s) ─
        await animatePhase(clones, 1500, (clone, progress, idx) => {
            const baseAngle = (idx / clones.length) * Math.PI * 2;
            const spiralAngle = baseAngle + progress * Math.PI * 4;
            const radius = 80 + progress * Math.min(cx, cy) * 0.7;
            clone.x = cx + Math.cos(spiralAngle) * radius - clone.w / 2;
            clone.y = cy + Math.sin(spiralAngle) * radius - clone.h / 2;
            clone.angle = progress * 720 * (idx % 2 === 0 ? 1 : -1);
            clone.scale = 0.7 + Math.sin(progress * Math.PI * 3) * 0.4;
        });

        // ─ Phase 2: Converge to vortex (~1s) ─
        const phase2Starts = clones.map(c => ({ x: c.x, y: c.y, angle: c.angle }));
        await animatePhase(clones, 1000, (clone, progress, idx) => {
            const start = phase2Starts[idx];
            const ease = progress * progress; // ease-in
            const vortexAngle = (idx / clones.length) * Math.PI * 2 + progress * Math.PI * 6;
            const vortexR = (1 - ease) * 200 + 20;
            clone.x = cx + Math.cos(vortexAngle) * vortexR * (1 - ease) + start.x * (1 - ease) * 0.3 - clone.w / 2;
            clone.y = cy + Math.sin(vortexAngle) * vortexR * (1 - ease) + start.y * (1 - ease) * 0.1 - clone.h / 2;
            clone.angle = start.angle + progress * 360;
            clone.scale = 1 - ease * 0.4;
        });

        // ─ Transition to Screen 2 (behind overlay) ─
        showScreen('screen-2');
        renderGroups();
        await sleep(100);

        // Get target positions
        const targetRects = {};
        teams.forEach(t => {
            const el = document.getElementById(`grp-card-${t.id}`);
            if (el) targetRects[t.id] = el.getBoundingClientRect();
        });

        // ─ Phase 3: Elastic fly to targets (~1.2s) ─
        const phase3Starts = clones.map(c => ({ x: c.x, y: c.y, angle: c.angle, scale: c.scale }));
        await animatePhase(clones, 1200, (clone, progress, idx) => {
            const team = teams[idx];
            const tgt = targetRects[team.id];
            if (!tgt) return;
            const start = phase3Starts[idx];

            // Stagger: each card starts a little later
            const stagger = idx * 0.02;
            const localP = Math.max(0, Math.min(1, (progress - stagger) / (1 - stagger)));

            // Elastic ease-out
            const elastic = localP === 0 ? 0 : localP === 1 ? 1 :
                Math.pow(2, -10 * localP) * Math.sin((localP * 10 - 0.75) * (2 * Math.PI / 3)) + 1;

            clone.x = start.x + (tgt.left - start.x) * elastic;
            clone.y = start.y + (tgt.top - start.y) * elastic;
            clone.angle = start.angle * (1 - elastic);
            clone.scale = start.scale + (1 - start.scale) * elastic;
            clone.el.style.width = (clone.w + (tgt.width - clone.w) * elastic) + 'px';
            clone.el.style.height = (clone.h + (tgt.height - clone.h) * elastic) + 'px';
        });

        // Cleanup
        overlay.remove();
        $$('.mini-card').forEach(el => el.style.visibility = 'visible');
        $('#btn-begin-round').style.display = 'inline-block';

        saveToStorage();
    }

    function animatePhase(clones, durationMs, updateFn) {
        return new Promise(resolve => {
            const start = performance.now();
            function frame(now) {
                const elapsed = now - start;
                const progress = Math.min(elapsed / durationMs, 1);
                clones.forEach((c, i) => {
                    updateFn(c, progress, i);
                    c.el.style.transform = `translate(${c.x}px, ${c.y}px) rotate(${c.angle}deg) scale(${c.scale})`;
                    // Reset left/top since we use transform for positioning
                    c.el.style.left = '0';
                    c.el.style.top = '0';
                });
                if (progress < 1) {
                    requestAnimationFrame(frame);
                } else {
                    resolve();
                }
            }
            requestAnimationFrame(frame);
        });
    }

    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    /* ─── Screen 2 : Groups ─── */
    function renderGroups() {
        const container = $('#groups-row');
        container.innerHTML = '';
        for (let g = 0; g < 5; g++) {
            const groupTeams = teams.filter(t => t.group === g);
            const panel = document.createElement('div');
            panel.className = 'group-panel';
            panel.innerHTML = `
        <div class="group-label" style="background:${GROUP_COLORS[g]}">${GROUP_NAMES[g]}</div>
        <div class="group-cards">
          ${groupTeams.map(t => `
            <div class="mini-card" id="grp-card-${t.id}" style="visibility:hidden;">
              <div class="card-bar" style="background:${t.color}"></div>
              <div class="card-body">${t.name}</div>
            </div>
          `).join('')}
        </div>
      `;
            container.appendChild(panel);
        }
    }

    /* ─── Screen 3 : Live Round Display ─── */
    function renderLiveRound() {
        $('#timer-round').textContent = `ROUND ${currentRound}`;
        renderLiveGroups();
        renderLeaderboardStrip();
        renderHistory();
        syncTimerDisplay();
    }

    function renderLiveGroups() {
        const container = $('#live-groups');
        container.innerHTML = '';
        for (let g = 0; g < 5; g++) {
            const groupTeams = teams.filter(t => t.group === g);
            const panel = document.createElement('div');
            panel.className = 'live-group';
            panel.innerHTML = `
        <div class="live-group-header" style="background:${GROUP_COLORS[g]}">${GROUP_NAMES[g]}</div>
        ${groupTeams.map(t => {
                const roundScore = t.scores[currentRound - 1] ?? '—';
                return `
            <div class="live-team-row">
              <span class="live-team-name">
                <span class="team-color-dot" style="background:${t.color}"></span>
                ${t.name}
              </span>
              <span class="live-team-score" id="live-score-${t.id}">${roundScore}</span>
            </div>
          `;
            }).join('')}
      `;
            container.appendChild(panel);
        }
    }

    function renderLeaderboardStrip() {
        const body = $('#lb-strip-body');
        const sorted = [...teams].sort((a, b) => b.total - a.total);
        body.innerHTML = sorted.map((t, i) => `
      <div class="lb-entry">
        <span class="lb-pos">#${i + 1}</span>
        <span class="lb-name">${t.name}</span>
        <span class="lb-total">$${t.total}</span>
      </div>
    `).join('');
    }

    function renderHistory() {
        const body = $('#history-body');
        if (currentRound <= 1 && teams.every(t => t.scores.length === 0)) {
            body.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:1rem;">No history yet.</p>';
            return;
        }

        const maxRound = Math.max(...teams.map(t => t.scores.length), currentRound);
        let html = '<table class="history-table"><tr><th>TEAM</th>';
        for (let r = 1; r <= maxRound; r++) html += `<th>R${r}</th>`;
        html += '<th>TOTAL</th></tr>';

        const sorted = [...teams].sort((a, b) => b.total - a.total);
        sorted.forEach(t => {
            html += `<tr><td><strong>${t.name}</strong></td>`;
            for (let r = 1; r <= maxRound; r++) {
                html += `<td>${t.scores[r - 1] !== undefined ? '$' + t.scores[r - 1] : '—'}</td>`;
            }
            html += `<td><strong>$${t.total}</strong></td></tr>`;
        });
        html += '</table>';
        body.innerHTML = html;
    }

    /* ─── Timer ─── */
    function syncTimerDisplay() {
        try {
            const raw = localStorage.getItem('empirex_timer');
            if (raw) {
                const timer = JSON.parse(raw);
                const clockEl = $('#timer-clock');
                clockEl.textContent = formatTime(timer.seconds ?? 300);
                if (timer.running) {
                    clockEl.classList.remove('paused');
                } else {
                    clockEl.classList.add('paused');
                }
            }
        } catch (e) { /* ignore */ }
    }

    /* ─── localStorage Polling ─── */
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
                if (JSON.stringify(local.scores) !== JSON.stringify(saved.scores)) {
                    local.scores = saved.scores || [];
                    local.total = saved.total || 0;
                    changed = true;
                }
            });

            if (data.currentRound && data.currentRound !== currentRound) {
                currentRound = data.currentRound;
                changed = true;
            }

            if (changed) {
                // Flash updated scores
                teams.forEach(t => {
                    const el = document.getElementById(`live-score-${t.id}`);
                    if (el) {
                        const roundScore = t.scores[currentRound - 1] ?? '—';
                        if (el.textContent !== String(roundScore)) {
                            el.textContent = roundScore;
                            el.classList.add('flash');
                            setTimeout(() => el.classList.remove('flash'), 600);
                        }
                    }
                });
                $('#timer-round').textContent = `ROUND ${currentRound}`;
                renderLeaderboardStrip();
                renderHistory();
            }

            syncTimerDisplay();
        } catch (e) { /* ignore */ }
    }

    /* ─── Timer countdown (driven by proctor writing to localStorage) ─── */
    function startTimerPolling() {
        setInterval(() => {
            syncTimerDisplay();
        }, 500);
    }

    /* ─── History Toggle ─── */
    function setupHistoryToggle() {
        const toggle = $('#history-toggle');
        const body = $('#history-body');
        toggle.addEventListener('click', () => {
            body.classList.toggle('open');
            toggle.textContent = body.classList.contains('open') ? '▲ ROUND HISTORY ▲' : '▼ ROUND HISTORY ▼';
        });
    }

    /* ─── Confetti ─── */
    function fireConfetti() {
        const colors = ['#e63946', '#1d3557', '#d4a843', '#06d6a0', '#ffffff', '#e84393', '#f4d35e'];
        for (let i = 0; i < 200; i++) {
            const piece = document.createElement('div');
            piece.className = 'confetti-piece';
            piece.style.left = Math.random() * 100 + 'vw';
            piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            piece.style.width = (4 + Math.random() * 8) + 'px';
            piece.style.height = (8 + Math.random() * 16) + 'px';
            piece.style.animationDuration = (2 + Math.random() * 3) + 's';
            piece.style.animationDelay = (Math.random() * 1.5) + 's';
            document.body.appendChild(piece);
            // Self-cleanup
            piece.addEventListener('animationend', () => piece.remove());
        }
    }

    /* ─── Init ─── */
    function init() {
        renderScreen1();
        setupHistoryToggle();

        // Shuffle button
        $('#btn-shuffle').addEventListener('click', doShuffle);

        // Begin round button
        $('#btn-begin-round').addEventListener('click', () => {
            showScreen('screen-3');
            renderLiveRound();
            fireConfetti();

            // Start polling for proctor updates
            setInterval(pollStorage, 1000);
            startTimerPolling();
        });

        // Check if there's existing state from a proctor (page reload scenario)
        const hasState = loadFromStorage();
        if (hasState && teams[0].group >= 0) {
            // Restore directly to live round screen
            showScreen('screen-3');
            renderLiveRound();
            setInterval(pollStorage, 1000);
            startTimerPolling();
        }
    }

    document.addEventListener('DOMContentLoaded', init);
})();
