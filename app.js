/* ===== EmpireX v5 — app.js (Firebase + Rooms) ===== */

(() => {
    'use strict';

    const TEAM_COLORS = [
        '#F49097', '#DFB2F4', '#F5E960', '#55D6C2', '#F49097',
        '#DFB2F4', '#F5E960', '#55D6C2', '#F49097', '#DFB2F4',
        '#F5E960', '#55D6C2', '#F49097', '#DFB2F4', '#F5E960',
        '#55D6C2', '#F49097', '#DFB2F4', '#F5E960', '#55D6C2'
    ];
    const BRACKET_COLORS = ['#F49097', '#DFB2F4', '#F5E960', '#55D6C2', '#f9f8f6'];
    const BRACKET_NAMES = ['Bracket A', 'Bracket B', 'Bracket C', 'Bracket D', 'Bracket E'];

    let teams = [];
    let db = null;
    let roomId = null;

    function buildTeams() {
        teams = [];
        for (let i = 1; i <= 20; i++) {
            teams.push({ id: i, name: `Team ${i}`, color: TEAM_COLORS[i - 1], group: -1, total: 0 });
        }
    }

    function $(s) { return document.querySelector(s); }
    function $$(s) { return document.querySelectorAll(s); }

    function showScreen(id) {
        $$('.screen').forEach(s => s.classList.remove('active'));
        $(`#${id}`).classList.add('active');
    }

    function roomRef() {
        return db.ref(`empirex/rooms/${roomId}`);
    }

    function generateRoomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
        return code;
    }

    function displayRoomCode() {
        const text = `ROOM: ${roomId}`;
        const el1 = $('#room-code-display');
        const el2 = $('#room-code-display-2');
        if (el1) el1.textContent = text;
        if (el2) el2.textContent = text;
    }

    /* ─── Firebase ─── */
    function initFirebase() {
        firebase.initializeApp(firebaseConfig);
        db = firebase.database();
    }

    function saveTeamsToFirebase() {
        if (!db || !roomId) return;
        const data = {};
        teams.forEach(t => {
            data[`team_${t.id}`] = { id: t.id, name: t.name, color: t.color, group: t.group, total: t.total };
        });
        roomRef().child('teams').set(data);
    }

    function listenForScoreUpdates() {
        if (!db || !roomId) return;
        roomRef().child('teams').on('value', (snapshot) => {
            const data = snapshot.val();
            if (!data) return;
            teams.forEach(t => {
                const saved = data[`team_${t.id}`];
                if (!saved) return;
                const oldTotal = t.total;
                t.total = saved.total || 0;
                if (t.total !== oldTotal) {
                    const el = document.getElementById(`score-${t.id}`);
                    if (el) {
                        el.textContent = t.total > 0 ? `$${t.total}` : '—';
                        el.classList.add('flash');
                        setTimeout(() => el.classList.remove('flash'), 500);
                    }
                }
            });
        });
    }

    /* ─── Room Logic ─── */
    function createRoom() {
        buildTeams();
        roomId = generateRoomCode();
        roomRef().set({ created: Date.now() }).then(() => {
            displayRoomCode();
            showScreen('screen-1');
            renderCards();
            $('#btn-shuffle').addEventListener('click', doShuffle);
        }).catch(err => {
            $('#room-status').textContent = 'FAILED TO CREATE ROOM';
        });
    }

    function joinRoom() {
        const code = $('#room-input').value.trim().toUpperCase();
        if (!code) {
            $('#room-status').textContent = 'ENTER A ROOM CODE';
            return;
        }
        db.ref(`empirex/rooms/${code}`).once('value', (snapshot) => {
            if (!snapshot.exists()) {
                $('#room-status').textContent = 'ROOM NOT FOUND';
                return;
            }
            roomId = code;
            const roomData = snapshot.val();

            // Restore teams
            buildTeams();
            if (roomData.teams) {
                let hasGroups = false;
                teams.forEach(t => {
                    const saved = roomData.teams[`team_${t.id}`];
                    if (saved) {
                        t.group = saved.group !== undefined ? saved.group : t.group;
                        t.total = saved.total || 0;
                        if (t.group >= 0) hasGroups = true;
                    }
                });

                if (hasGroups) {
                    displayRoomCode();
                    showScreen('screen-2');
                    renderBrackets();
                    setTimeout(() => {
                        $$('.bracket-team-row').forEach(el => el.style.visibility = 'visible');
                        teams.forEach(t => {
                            const el = document.getElementById(`score-${t.id}`);
                            if (el) el.textContent = t.total > 0 ? `$${t.total}` : '—';
                        });
                    }, 50);
                    listenForScoreUpdates();
                    return;
                }
            }

            // No groups yet — show cards
            displayRoomCode();
            showScreen('screen-1');
            renderCards();
            $('#btn-shuffle').addEventListener('click', doShuffle);
        });
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

        const slots = [];
        for (let g = 0; g < 5; g++) for (let s = 0; s < 4; s++) slots.push(g);
        for (let i = slots.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [slots[i], slots[j]] = [slots[j], slots[i]];
        }
        teams.forEach((t, idx) => { t.group = slots[idx]; });

        const cardEls = Array.from($$('.team-card'));
        const rects = cardEls.map(el => el.getBoundingClientRect());
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;

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
                el: clone, origX: rects[i].left, origY: rects[i].top,
                w: rects[i].width, h: rects[i].height,
                x: rects[i].left, y: rects[i].top, angle: 0, scale: 1
            };
        });

        cardEls.forEach(el => el.style.visibility = 'hidden');

        function applyTransform(c) {
            c.el.style.transform = `translate(${c.x}px, ${c.y}px) rotate(${c.angle}deg) scale(${c.scale})`;
            c.el.style.left = '0'; c.el.style.top = '0';
        }

        // Phase 1: Scatter to center
        await animate(1200, (p, clones) => {
            clones.forEach((c, i) => {
                const ease = p * p * (3 - 2 * p);
                c.x = c.origX + (cx - c.w / 2 + Math.sin(i * 1.7) * 60 - c.origX) * ease;
                c.y = c.origY + (cy - c.h / 2 + Math.cos(i * 1.3) * 40 - c.origY) * ease;
                c.angle = ease * 180 * (i % 2 === 0 ? 1 : -1);
                c.scale = 1 - ease * 0.15;
                applyTransform(c);
            });
        }, clones);

        // Phase 2: Jitter shuffle
        const ss = clones.map(c => ({ x: c.x, y: c.y }));
        await animate(1000, (p, clones) => {
            clones.forEach((c, i) => {
                const t = p * Math.PI * 4;
                c.x = ss[i].x + Math.sin(t + i * 0.8) * (1 - p) * 80;
                c.y = ss[i].y + Math.cos(t + i * 1.1) * (1 - p) * 50;
                c.angle = Math.sin(t + i) * (1 - p) * 30;
                c.scale = 0.85 + Math.sin(t * 2 + i) * 0.08;
                applyTransform(c);
            });
        }, clones);

        // Show brackets behind overlay
        showScreen('screen-2');
        displayRoomCode();
        renderBrackets();
        await sleep(80);

        const targetRects = {};
        teams.forEach(t => {
            const el = document.getElementById(`bkt-team-${t.id}`);
            if (el) targetRects[t.id] = el.getBoundingClientRect();
        });

        // Phase 3: Fly to brackets
        const fs = clones.map(c => ({ x: c.x, y: c.y, angle: c.angle, scale: c.scale }));
        await animate(800, (p, clones) => {
            const ease = 1 - Math.pow(1 - p, 3);
            clones.forEach((c, i) => {
                const tgt = targetRects[teams[i].id];
                if (!tgt) return;
                c.x = fs[i].x + (tgt.left - fs[i].x) * ease;
                c.y = fs[i].y + (tgt.top - fs[i].y) * ease;
                c.angle = fs[i].angle * (1 - ease);
                c.scale = fs[i].scale + (1 - fs[i].scale) * ease;
                c.el.style.width = (c.w + (tgt.width - c.w) * ease) + 'px';
                c.el.style.height = (c.h + (tgt.height - c.h) * ease) + 'px';
                applyTransform(c);
            });
        }, clones);

        overlay.remove();
        $$('.bracket-team-row').forEach(el => el.style.visibility = 'visible');
        saveTeamsToFirebase();
        listenForScoreUpdates();
    }

    function animate(ms, fn, clones) {
        return new Promise(resolve => {
            const s = performance.now();
            function frame(now) {
                const p = Math.min((now - s) / ms, 1);
                fn(p, clones);
                p < 1 ? requestAnimationFrame(frame) : resolve();
            }
            requestAnimationFrame(frame);
        });
    }

    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    /* ─── Brackets ─── */
    function renderBrackets() {
        const c = $('#brackets-row');
        c.innerHTML = '';
        for (let g = 0; g < 5; g++) {
            const gt = teams.filter(t => t.group === g);
            const panel = document.createElement('div');
            panel.className = 'bracket-panel';
            panel.innerHTML = `
        <div class="bracket-header" style="background:${BRACKET_COLORS[g]}">${BRACKET_NAMES[g]}</div>
        <div class="bracket-teams">
          ${gt.map(t => `
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
            c.appendChild(panel);
        }
    }

    /* ─── Init ─── */
    function init() {
        initFirebase();
        $('#btn-create-room').addEventListener('click', createRoom);
        $('#btn-join-room').addEventListener('click', joinRoom);
        $('#room-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') joinRoom(); });
    }

    document.addEventListener('DOMContentLoaded', init);
})();
