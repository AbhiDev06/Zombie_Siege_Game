const $ = id => document.getElementById(id);
const cv = $("game");
const ctx = cv.getContext("2d");

const GUNS = {
    pistol: { name: "Pistol", mag: 12, rate: .30, reload: 1.0, pellets: 1, spread: .02, color: "#fde68a" },
    rifle: { name: "Rifle", mag: 30, rate: .10, reload: 1.8, pellets: 1, spread: .07, color: "#fdba74" },
    shotgun: { name: "Shotgun", mag: 6, rate: .75, reload: 2.2, pellets: 5, spread: .38, color: "#fca5a5" }
};
const TYPES = [
    { hp: 2, speed: 55, r: 15, dmg: 8, score: 10, color: "#4d7c0f" },
    { hp: 1, speed: 120, r: 11, dmg: 5, score: 15, color: "#b45309" },
    { hp: 8, speed: 36, r: 24, dmg: 20, score: 40, color: "#7f1d1d" }
];

let W = 0, H = 0, u = 1, G = null, running = false, last = 0;
let best = 0;
try { best = Number(localStorage.getItem("siege-best")) || 0; } catch (e) { }
const aim = { x: 0, y: 0, down: false };
const keys = {};

/* ---------- Screen fitting ---------- */
function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = cv.clientWidth;
    H = cv.clientHeight;
    u = Math.min(W, H) / 600;               // everything scales with the smaller screen side
    cv.width = W * dpr;
    cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!aim.x) { aim.x = W / 2; aim.y = H / 4; }
    if (G && !running) draw();
}
window.addEventListener("resize", resize);

/* ---------- Game state ---------- */
function reset() {
    G = {
        score: 0, hp: 100, wave: 0, banner: 0, gun: "pistol",
        ammo: { pistol: 12, rifle: 30, shotgun: 6 },
        cool: 0, reloading: 0, shake: 0, flash: 0,
        z: [], b: [], pt: [], tx: [], toSpawn: 0, spawnT: 0
    };
    nextWave();
    setGunButtons();
}

function nextWave() {
    G.wave++;
    G.banner = 2;
    G.toSpawn = 6 + G.wave * 4;
    G.spawnT = 1.2;
}

function spawn() {
    const side = Math.floor(Math.random() * 4), m = 40 * u;
    let x, y;
    if (side === 0) { x = Math.random() * W; y = -m; }
    else if (side === 1) { x = W + m; y = Math.random() * H; }
    else if (side === 2) { x = Math.random() * W; y = H + m; }
    else { x = -m; y = Math.random() * H; }
    const r = Math.random();
    let t = 0;
    if (G.wave >= 2 && r > .65) t = 1;
    if (G.wave >= 3 && r > .88) t = 2;
    const T = TYPES[t];
    G.z.push({ x, y, t, hp: T.hp, max: T.hp, flash: 0, speed: T.speed * (1 + G.wave * .04) });
}

/* ---------- Shooting ---------- */
function angleToAim() { return Math.atan2(aim.y - H / 2, aim.x - W / 2); }

function fire() {
    if (!G || G.cool > 0 || G.reloading > 0) return;
    const gun = GUNS[G.gun];
    if (G.ammo[G.gun] <= 0) { startReload(); return; }
    G.ammo[G.gun]--;
    G.cool = gun.rate;
    const a = angleToAim();
    for (let i = 0; i < gun.pellets; i++) {
        const ang = a + (Math.random() - .5) * gun.spread;
        G.b.push({ x: W / 2 + Math.cos(a) * 40 * u, y: H / 2 + Math.sin(a) * 40 * u, vx: Math.cos(ang) * 950 * u, vy: Math.sin(ang) * 950 * u, life: 1.2 });
    }
    G.flash = .05;
    G.shake = gun.pellets > 1 ? 6 : 2;
    if (G.ammo[G.gun] === 0) startReload();
}

function startReload() {
    if (G.reloading > 0 || G.ammo[G.gun] === GUNS[G.gun].mag) return;
    G.reloading = GUNS[G.gun].reload;
}

function setGun(name) {
    if (!G || !GUNS[name]) return;
    G.gun = name;
    G.reloading = 0;
    setGunButtons();
}

function setGunButtons() {
    document.querySelectorAll("[data-gun]").forEach(b => b.classList.toggle("active", b.dataset.gun === G.gun));
}

/* ---------- Effects ---------- */
function blood(x, y, color, n) {
    for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.28, s = (40 + Math.random() * 140) * u;
        G.pt.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: .4 + Math.random() * .4, color });
    }
}
function text(x, y, str, color) { G.tx.push({ x, y, str, color, life: .9 }); }

/* ---------- Update ---------- */
function update(dt) {
    G.cool -= dt;
    G.flash -= dt;
    G.shake = Math.max(0, G.shake - dt * 30);
    if (G.reloading > 0) {
        G.reloading -= dt;
        if (G.reloading <= 0) { G.reloading = 0; G.ammo[G.gun] = GUNS[G.gun].mag; }
    }
    if (aim.down || keys[" "]) fire();

    if (G.banner > 0) G.banner -= dt;
    else if (G.toSpawn > 0) {
        G.spawnT -= dt;
        if (G.spawnT <= 0) { spawn(); G.toSpawn--; G.spawnT = Math.max(.25, .9 - G.wave * .05); }
    } else if (G.z.length === 0) nextWave();

    const cx = W / 2, cy = H / 2, baseR = 28 * u;

    G.z.forEach(z => {
        const a = Math.atan2(cy - z.y, cx - z.x);
        z.x += Math.cos(a) * z.speed * u * dt;
        z.y += Math.sin(a) * z.speed * u * dt;
        z.flash -= dt;
        const T = TYPES[z.t];
        if (Math.hypot(cx - z.x, cy - z.y) < baseR + T.r * u * .6) {
            z.hp = 0;
            G.hp -= T.dmg;
            G.shake = 10;
            blood(z.x, z.y, "#ef4444", 10);
            if (G.hp <= 0) { G.hp = 0; gameOver(); }
        }
    });

    G.b.forEach(b => {
        b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
        G.z.forEach(z => {
            if (b.dead || z.hp <= 0) return;
            if (Math.hypot(b.x - z.x, b.y - z.y) < TYPES[z.t].r * u) {
                b.dead = true;
                z.hp--; z.flash = .08;
                blood(b.x, b.y, "#84cc16", 4);
                if (z.hp <= 0) {
                    G.score += TYPES[z.t].score;
                    blood(z.x, z.y, TYPES[z.t].color, 14);
                    text(z.x, z.y, "+" + TYPES[z.t].score, "#facc15");
                    if (Math.random() < .08 && G.hp < 100) { G.hp = Math.min(100, G.hp + 10); text(z.x, z.y - 18 * u, "+10 HP", "#4ade80"); }
                }
            }
        });
    });

    G.pt.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; });
    G.tx.forEach(t => { t.y -= 30 * u * dt; t.life -= dt; });

    G.b = G.b.filter(b => !b.dead && b.life > 0 && b.x > -50 && b.x < W + 50 && b.y > -50 && b.y < H + 50);
    G.z = G.z.filter(z => z.hp > 0);
    G.pt = G.pt.filter(p => p.life > 0);
    G.tx = G.tx.filter(t => t.life > 0);
}

/* ---------- Drawing ---------- */
function draw() {
    ctx.save();
    if (G.shake > 0) ctx.translate((Math.random() - .5) * G.shake, (Math.random() - .5) * G.shake);

    ctx.fillStyle = "#0b1410";
    ctx.fillRect(-20, -20, W + 40, H + 40);
    ctx.strokeStyle = "rgba(74, 222, 128, .07)";
    ctx.lineWidth = 1;
    const step = 60 * u;
    for (let x = (W / 2) % step; x < W; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = (H / 2) % step; y < H; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    const cx = W / 2, cy = H / 2;

    // base and gun
    ctx.fillStyle = "#14532d";
    ctx.beginPath(); ctx.arc(cx, cy, 30 * u, 0, 7); ctx.fill();
    ctx.strokeStyle = "#4ade80"; ctx.lineWidth = 3 * u; ctx.stroke();
    const a = angleToAim();
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(a);
    ctx.fillStyle = "#d1d5db";
    ctx.fillRect(8 * u, -5 * u, 34 * u, 10 * u);
    ctx.fillStyle = "#374151";
    ctx.fillRect(0, -9 * u, 18 * u, 18 * u);
    if (G.flash > 0) { ctx.fillStyle = "#fde047"; ctx.beginPath(); ctx.arc(46 * u, 0, 9 * u, 0, 7); ctx.fill(); }
    ctx.restore();

    // bullets
    ctx.strokeStyle = GUNS[G.gun].color; ctx.lineWidth = 3 * u; ctx.lineCap = "round";
    G.b.forEach(b => {
        ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * .018, b.y - b.vy * .018); ctx.stroke();
    });

    // zombies
    G.z.forEach(z => {
        const T = TYPES[z.t], r = T.r * u;
        ctx.fillStyle = z.flash > 0 ? "#ffffff" : T.color;
        ctx.beginPath(); ctx.arc(z.x, z.y, r, 0, 7); ctx.fill();
        const face = Math.atan2(cy - z.y, cx - z.x);
        ctx.fillStyle = "#fecaca";
        [-.5, .5].forEach(s => {
            ctx.beginPath();
            ctx.arc(z.x + Math.cos(face + s) * r * .55, z.y + Math.sin(face + s) * r * .55, r * .17, 0, 7);
            ctx.fill();
        });
        if (z.max > 2) {
            ctx.fillStyle = "#1f2937"; ctx.fillRect(z.x - r, z.y - r - 8 * u, r * 2, 4 * u);
            ctx.fillStyle = "#f87171"; ctx.fillRect(z.x - r, z.y - r - 8 * u, r * 2 * (z.hp / z.max), 4 * u);
        }
    });

    // effects
    G.pt.forEach(p => { ctx.globalAlpha = Math.max(0, p.life * 2); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 3 * u, 3 * u); });
    ctx.globalAlpha = 1;
    ctx.font = "bold " + 14 * u + "px Segoe UI, sans-serif"; ctx.textAlign = "center";
    G.tx.forEach(t => { ctx.globalAlpha = Math.max(0, t.life); ctx.fillStyle = t.color; ctx.fillText(t.str, t.x, t.y); });
    ctx.globalAlpha = 1;

    // crosshair
    ctx.strokeStyle = "rgba(250, 250, 250, .8)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(aim.x, aim.y, 10 * u, 0, 7); ctx.moveTo(aim.x - 16 * u, aim.y); ctx.lineTo(aim.x + 16 * u, aim.y);
    ctx.moveTo(aim.x, aim.y - 16 * u); ctx.lineTo(aim.x, aim.y + 16 * u); ctx.stroke();

    if (G.banner > 0) {
        ctx.fillStyle = "#e8f5e9"; ctx.font = "bold " + 38 * u + "px Segoe UI, sans-serif";
        ctx.fillText("WAVE " + G.wave, cx, H * .28);
    }
    ctx.restore();
}

function hud() {
    const gun = GUNS[G.gun];
    $("score").textContent = G.score;
    $("wave").textContent = G.wave;
    $("gunName").textContent = gun.name;
    $("ammo").textContent = G.reloading > 0 ? "..." : G.ammo[G.gun] + "/" + gun.mag;
    const bar = $("hpBar");
    bar.style.width = G.hp + "%";
    bar.classList.toggle("low", G.hp <= 30);
    $("reloadBtn").classList.toggle("busy", G.reloading > 0);
}

/* ---------- Loop and screens ---------- */
function loop(t) {
    if (!running) return;
    const dt = Math.min((t - last) / 1000, .05);
    last = t;
    update(dt);
    draw();
    hud();
    requestAnimationFrame(loop);
}

function start() {
    reset();
    running = true;
    $("overlay").classList.add("hidden");
    last = performance.now();
    requestAnimationFrame(loop);
}

function gameOver() {
    running = false;
    const isBest = G.score > best;
    if (isBest) { best = G.score; try { localStorage.setItem("siege-best", best); } catch (e) { } }
    draw(); hud();
    $("ovTitle").textContent = "Base overrun";
    $("ovText").textContent = "Score " + G.score + ", reached wave " + G.wave + ". Best: " + best + (isBest ? " (new record!)" : "");
    $("startBtn").textContent = "Play again";
    $("overlay").classList.remove("hidden");
}

/* ---------- Input ---------- */
function setAim(e) {
    const r = cv.getBoundingClientRect();
    aim.x = e.clientX - r.left;
    aim.y = e.clientY - r.top;
}
cv.addEventListener("pointerdown", e => { cv.setPointerCapture(e.pointerId); setAim(e); aim.down = true; });
cv.addEventListener("pointermove", e => { setAim(e); });
cv.addEventListener("pointerup", () => { aim.down = false; });
cv.addEventListener("pointercancel", () => { aim.down = false; });

document.addEventListener("keydown", e => {
    keys[e.key] = true;
    if (!G) return;
    if (e.key === "1") setGun("pistol");
    if (e.key === "2") setGun("rifle");
    if (e.key === "3") setGun("shotgun");
    if (e.key.toLowerCase() === "r") startReload();
    if (e.key === " ") e.preventDefault();
});
document.addEventListener("keyup", e => { keys[e.key] = false; });

$("bar").addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b || !G) return;
    if (b.dataset.gun) setGun(b.dataset.gun);
    if (b.id === "reloadBtn") startReload();
});
$("startBtn").addEventListener("click", start);

/* First screen */
resize();
reset();
G.banner = 0;
draw();
hud();