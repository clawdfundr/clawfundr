import { FastifyInstance } from "fastify";

const dashboardHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Clawfundr API Dashboard</title>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet">

  <style>
    :root{
      --bg0:#050608;
      --bg1:#070A0F;

      --panel:rgba(10,14,18,.72);
      --panel2:rgba(10,14,18,.55);

      --line:rgba(255,214,10,.22);
      --line2:rgba(255,214,10,.10);

      --yellow:#FFD60A;
      --yellow2:#FFB700;

      --text:rgba(255,244,200,.92);
      --muted:rgba(255,244,200,.62);

      --danger:#ff5c6c;
      --ok:#7CFFB8;

      --shadow: 0 22px 70px rgba(0,0,0,.60);
      --glow: 0 0 34px rgba(255,214,10,.14);
    }

    *{ box-sizing:border-box; }
    html,body{ height:100%; }
    body{
      margin:0;
      color:var(--text);
      font-family:"Space Grotesk", system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      background:
        radial-gradient(1200px 700px at 20% 10%, rgba(255,214,10,.10), transparent 55%),
        radial-gradient(900px 600px at 80% 0%, rgba(255,183,0,.08), transparent 60%),
        radial-gradient(1000px 900px at 70% 90%, rgba(255,214,10,.06), transparent 60%),
        linear-gradient(180deg, var(--bg1), var(--bg0));
      min-height:100vh;
      padding:24px;
      overflow-x:hidden;
    }

    /* overlays */
    .noise{
      position:fixed; inset:0;
      pointer-events:none;
      opacity:.08;
      mix-blend-mode:overlay;
      background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)' opacity='.55'/%3E%3C/svg%3E");
      animation: noiseShift 6s steps(8) infinite;
    }
    @keyframes noiseShift{
      0%{transform:translate3d(0,0,0)}
      25%{transform:translate3d(-2%,1%,0)}
      50%{transform:translate3d(1%,-2%,0)}
      75%{transform:translate3d(2%,2%,0)}
      100%{transform:translate3d(0,0,0)}
    }

    .scanlines{
      position:fixed; inset:0;
      pointer-events:none;
      opacity:.10;
      background:repeating-linear-gradient(
        to bottom,
        rgba(255,214,10,.05),
        rgba(255,214,10,.05) 1px,
        transparent 1px,
        transparent 4px
      );
      mix-blend-mode:soft-light;
      animation: scanMove 10s linear infinite;
    }
    @keyframes scanMove{
      from{transform:translateY(0)}
      to{transform:translateY(20px)}
    }

    .wrap{
      max-width: 1020px;
      margin:0 auto;
      display:grid;
      gap:16px;
    }

    .card{
      position:relative;
      background:var(--panel);
      border:1px solid var(--line);
      border-radius:18px;
      padding:18px;
      box-shadow: var(--shadow), var(--glow);
      backdrop-filter: blur(10px);
      overflow:hidden;
      transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
    }
    .card:hover{
      transform: translateY(-3px);
      border-color: rgba(255,214,10,.35);
      box-shadow: 0 24px 80px rgba(0,0,0,.65), 0 0 40px rgba(255,214,10,.16);
    }

    /* subtle top border highlight */
    .card::before{
      content:"";
      position:absolute;
      left:0; right:0; top:0;
      height:1px;
      background: linear-gradient(90deg, transparent, rgba(255,214,10,.55), transparent);
      opacity:.55;
    }

    /* terminal corner ticks */
    .ticks{
      position:absolute;
      inset:10px;
      pointer-events:none;
      border-radius:14px;
      box-shadow:
        0 0 0 1px rgba(255,214,10,.06) inset;
      background:
        linear-gradient(var(--line2), var(--line2)) 0 0/20px 1px no-repeat,
        linear-gradient(var(--line2), var(--line2)) 0 0/1px 20px no-repeat,
        linear-gradient(var(--line2), var(--line2)) 100% 0/20px 1px no-repeat,
        linear-gradient(var(--line2), var(--line2)) 100% 0/1px 20px no-repeat,
        linear-gradient(var(--line2), var(--line2)) 0 100%/20px 1px no-repeat,
        linear-gradient(var(--line2), var(--line2)) 0 100%/1px 20px no-repeat,
        linear-gradient(var(--line2), var(--line2)) 100% 100%/20px 1px no-repeat,
        linear-gradient(var(--line2), var(--line2)) 100% 100%/1px 20px no-repeat;
      opacity:.65;
    }

    .topbar{
      display:flex;
      align-items:flex-start;
      justify-content:space-between;
      gap:14px;
    }

    .kicker{
      font-family:"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      font-size:12px;
      letter-spacing:.18em;
      text-transform:uppercase;
      color:var(--muted);
    }

    h1{
      margin:8px 0 6px;
      font-size: clamp(26px, 4vw, 38px);
      letter-spacing:.01em;
      line-height:1.15;
    }

    .muted{ color: var(--muted); }
    .divider{
      margin-top:14px;
      height:1px;
      width:100%;
      background: var(--line2);
    }

    .status{
      margin-top:10px;
      min-height:20px;
      font-size:13px;
      color:var(--muted);
      font-family:"JetBrains Mono", ui-monospace, monospace;
    }
    .ok{ color:var(--ok); }
    .err{ color:var(--danger); }

    .grid{
      display:grid;
      gap:12px;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    }

    label{
      display:block;
      font-size:12px;
      margin:0 0 6px;
      color:var(--muted);
      font-family:"JetBrains Mono", ui-monospace, monospace;
    }

    input{
      width:100%;
      border:1px solid rgba(255,214,10,.18);
      background: rgba(0,0,0,.25);
      color:var(--text);
      border-radius:12px;
      font-size:14px;
      padding:11px 12px;
      outline:none;
      box-shadow: 0 0 0 1px rgba(255,214,10,.06) inset;
      transition: border-color .15s ease, box-shadow .15s ease, transform .15s ease;
      caret-color: var(--yellow);
    }
    input:focus{
      border-color: rgba(255,214,10,.55);
      box-shadow:
        0 0 0 1px rgba(255,214,10,.12) inset,
        0 0 24px rgba(255,214,10,.12);
      transform: translateY(-1px);
    }

    .btns{ display:flex; flex-wrap:wrap; gap:10px; margin-top:14px; }

    button{
      position:relative;
      border:1px solid rgba(255,214,10,.22);
      background: linear-gradient(180deg, rgba(255,214,10,.16), rgba(255,214,10,.06));
      color: var(--text);
      border-radius:12px;
      padding:10px 14px;
      font: inherit;
      font-size:14px;
      cursor:pointer;
      box-shadow:
        0 0 0 1px rgba(255,214,10,.08) inset,
        0 0 22px rgba(255,214,10,.10);
      transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease, filter .15s ease;
      overflow:hidden;
      font-family:"JetBrains Mono", ui-monospace, monospace;
    }

    /* animated sheen */
    button::after{
      content:"";
      position:absolute;
      inset:-40% -60%;
      background: linear-gradient(90deg, transparent, rgba(255,214,10,.18), transparent);
      transform: rotate(12deg);
      animation: sheen 3.6s ease-in-out infinite;
      opacity:.55;
      pointer-events:none;
    }
    @keyframes sheen{
      0%{transform:translateX(-30%) rotate(12deg); opacity:.0}
      35%{opacity:.55}
      60%{transform:translateX(30%) rotate(12deg); opacity:.0}
      100%{opacity:.0}
    }

    button:hover{
      transform: translateY(-1px);
      border-color: rgba(255,214,10,.50);
      box-shadow:
        0 0 0 1px rgba(255,214,10,.14) inset,
        0 0 30px rgba(255,214,10,.18);
      filter: brightness(1.05);
    }
    button:active{ transform: translateY(0px) scale(.99); }

    button.alt{
      border-color: rgba(255,183,0,.28);
      background: linear-gradient(180deg, rgba(255,183,0,.18), rgba(255,183,0,.07));
    }

    button.warn{
      border-color: rgba(255,92,108,.35);
      background: linear-gradient(180deg, rgba(255,92,108,.18), rgba(255,92,108,.06));
      box-shadow:
        0 0 0 1px rgba(255,92,108,.12) inset,
        0 0 26px rgba(255,92,108,.10);
    }
    button.warn:hover{
      border-color: rgba(255,92,108,.60);
      box-shadow:
        0 0 0 1px rgba(255,92,108,.16) inset,
        0 0 34px rgba(255,92,108,.14);
    }

    .hint{
      margin-top:10px;
      font-size:12px;
      color:var(--muted);
      font-family:"JetBrains Mono", ui-monospace, monospace;
    }

    pre{
      margin:0;
      white-space:pre-wrap;
      background: rgba(0,0,0,.30);
      border: 1px solid rgba(255,214,10,.14);
      border-radius:14px;
      padding:14px;
      color: rgba(255,244,200,.90);
      font-size:13px;
      max-height: 360px;
      overflow:auto;
      font-family:"JetBrains Mono", ui-monospace, monospace;
      position:relative;
    }

    /* terminal caret */
    .caret::after{
      content:"▌";
      margin-left:6px;
      color: var(--yellow);
      animation: blink 1s steps(1) infinite;
      opacity:.9;
    }
    @keyframes blink{ 50%{ opacity:0; } }

    /* glitch title */
    .glitch{
      position:relative;
      display:inline-block;
      text-shadow: 0 0 18px rgba(255,214,10,.20);
    }
    .glitch::before,
    .glitch::after{
      content: attr(data-text);
      position:absolute;
      left:0; top:0;
      width:100%;
      overflow:hidden;
      clip-path: inset(0 0 0 0);
      opacity:0;
      pointer-events:none;
      font-family: inherit;
    }
    .glitch::before{
      transform: translateX(-1px);
      color: rgba(255,214,10,.85);
    }
    .glitch::after{
      transform: translateX(1px);
      color: rgba(255,183,0,.75);
    }
    .glitch.idle::before{ animation: glitchLayer 5.5s infinite; }
    .glitch.idle::after{  animation: glitchLayer2 5.5s infinite; }

    @keyframes glitchLayer{
      0%, 90%, 100% {opacity:0; clip-path: inset(0 0 100% 0);}
      91%{opacity:.8; clip-path: inset(10% 0 70% 0);}
      92%{opacity:.0; clip-path: inset(0 0 100% 0);}
      93%{opacity:.7; clip-path: inset(45% 0 35% 0);}
      94%{opacity:.0;}
      95%{opacity:.6; clip-path: inset(65% 0 18% 0);}
      96%{opacity:0;}
    }
    @keyframes glitchLayer2{
      0%, 90%, 100% {opacity:0; clip-path: inset(0 0 100% 0);}
      91%{opacity:.6; clip-path: inset(20% 0 55% 0);}
      92%{opacity:.0;}
      93%{opacity:.55; clip-path: inset(52% 0 28% 0);}
      94%{opacity:.0;}
      95%{opacity:.5; clip-path: inset(72% 0 12% 0);}
      96%{opacity:0;}
    }

    /* micro badge */
    .badge{
      display:inline-flex;
      align-items:center;
      gap:8px;
      padding:8px 10px;
      border-radius:999px;
      border:1px solid rgba(255,214,10,.18);
      background: rgba(0,0,0,.18);
      font-family:"JetBrains Mono", ui-monospace, monospace;
      font-size:12px;
      color: var(--muted);
      white-space:nowrap;
    }
    .dot{
      width:8px; height:8px; border-radius:999px;
      background: rgba(255,214,10,.85);
      box-shadow: 0 0 18px rgba(255,214,10,.22);
      animation: pulse 2.8s ease-in-out infinite;
    }
    @keyframes pulse{
      0%,100%{ transform:scale(1); opacity:.8; }
      50%{ transform:scale(1.15); opacity:1; }
    }

    /* Responsive padding */
    @media (max-width: 640px){
      body{ padding:16px; }
      .card{ padding:16px; }
    }
  </style>
</head>

<body>
  <div class="noise"></div>
  <div class="scanlines"></div>

  <main class="wrap">
    <section class="card">
      <div class="ticks"></div>

      <div class="topbar">
        <div>
          <div class="kicker">CLAWFUNDR // API ACCESS CONSOLE</div>
          <h1 class="glitch idle" data-text="Clawfundr API Dashboard">Clawfundr API Dashboard</h1>
          <div class="muted">Register user, store API key, create/list/revoke keys from one place.</div>
          <div class="divider"></div>
          <div class="hint">Tip: avoid showing full keys in UI; show last 4 + Copy button.</div>
        </div>

        <div class="badge" title="Console status">
          <span class="dot"></span>
          <span>secure terminal</span>
        </div>
      </div>

      <div id="status" class="status"></div>
    </section>

    <section class="card">
      <div class="ticks"></div>

      <div class="grid">
        <div>
          <label for="name">Name (register)</label>
          <input id="name" placeholder="Alice" autocomplete="name" />
        </div>
        <div>
          <label for="email">Email (optional)</label>
          <input id="email" placeholder="alice@example.com" autocomplete="email" />
        </div>
      </div>
      <div class="btns">
        <button id="registerBtn" class="alt">Register + Get API Key</button>
      </div>
    </section>

    <section class="card">
      <div class="ticks"></div>

      <div class="grid">
        <div>
          <label for="apiKey">Current API Key</label>
          <input id="apiKey" placeholder="claw_..." />
        </div>
        <div>
          <label for="label">New key label</label>
          <input id="label" placeholder="CLI key" />
        </div>
      </div>
      <div class="btns">
        <button id="saveKeyBtn">Save Key</button>
        <button id="listKeysBtn">List Keys</button>
        <button id="createKeyBtn" class="alt">Create Key</button>
        <button id="clearKeyBtn" class="warn">Clear Saved Key</button>
      </div>
    </section>

    <section class="card">
      <div class="ticks"></div>

      <div class="btns">
        <button id="deleteSelectedBtn" class="warn">Delete Selected Key</button>
      </div>

      <pre id="output"><span class="caret">Ready.</span></pre>
    </section>
  </main>

  <script>
    const apiKeyInput = document.getElementById('apiKey');
    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    const labelInput = document.getElementById('label');
    const statusEl = document.getElementById('status');
    const outputEl = document.getElementById('output');
    let selectedKeyId = null;

    const saved = localStorage.getItem('clawfundr_api_key');
    if (saved) apiKeyInput.value = saved;

    function setStatus(message, isError) {
      statusEl.textContent = message;
      statusEl.className = 'status ' + (isError ? 'err' : 'ok');
    }

    function setOutput(payload) {
      outputEl.textContent = typeof payload === 'string'
        ? payload
        : JSON.stringify(payload, null, 2);
      // add caret feel after updates
      if (!outputEl.textContent.endsWith('▌')) {
        outputEl.textContent += '\\n';
      }
    }

    function getKey() {
      return apiKeyInput.value.trim();
    }

    async function request(path, options = {}, needsAuth = false) {
      const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
      if (needsAuth) {
        const key = getKey();
        if (!key) throw new Error('Missing API key. Paste or register first.');
        headers.Authorization = 'Bearer ' + key;
      }

      const res = await fetch(path, { ...options, headers });
      const text = await res.text();
      let body = null;
      try { body = text ? JSON.parse(text) : null; } catch (e) {}
      if (!res.ok) {
        const msg = body && body.message ? body.message : ('HTTP ' + res.status);
        throw new Error(msg);
      }
      return body;
    }

    document.getElementById('registerBtn').onclick = async () => {
      try {
        setStatus('Registering...', false);
        const body = {
          name: nameInput.value.trim() || undefined,
          email: emailInput.value.trim() || undefined,
        };
        const data = await request('/v1/auth/register', { method: 'POST', body: JSON.stringify(body) });
        if (data && data.apiKey) {
          apiKeyInput.value = data.apiKey;
          localStorage.setItem('clawfundr_api_key', data.apiKey);
        }
        setOutput(data);
        setStatus('Registered. API key saved locally in this browser.', false);
      } catch (err) {
        setStatus(err.message, true);
      }
    };

    document.getElementById('saveKeyBtn').onclick = () => {
      const key = getKey();
      if (!key) return setStatus('Nothing to save.', true);
      localStorage.setItem('clawfundr_api_key', key);
      setStatus('API key saved locally.', false);
    };

    document.getElementById('clearKeyBtn').onclick = () => {
      apiKeyInput.value = '';
      localStorage.removeItem('clawfundr_api_key');
      setStatus('Saved key cleared.', false);
    };

    document.getElementById('listKeysBtn').onclick = async () => {
      try {
        setStatus('Loading keys...', false);
        const data = await request('/v1/auth/keys', { method: 'GET' }, true);
        setOutput(data);
        setStatus('Keys loaded. Copy an id to delete.', false);
      } catch (err) {
        setStatus(err.message, true);
      }
    };

    document.getElementById('createKeyBtn').onclick = async () => {
      try {
        setStatus('Creating key...', false);
        const payload = { label: labelInput.value.trim() || 'Dashboard Key' };
        const data = await request('/v1/auth/keys', { method: 'POST', body: JSON.stringify(payload) }, true);
        setOutput(data);
        setStatus('New key created. Save it now; it is only shown once.', false);
      } catch (err) {
        setStatus(err.message, true);
      }
    };

    document.getElementById('deleteSelectedBtn').onclick = async () => {
      try {
        if (!selectedKeyId) {
          const manual = prompt('Paste key id (UUID) to delete:');
          if (!manual) return;
          selectedKeyId = manual.trim();
        }
        setStatus('Deleting key...', false);
        const data = await request('/v1/auth/keys/' + selectedKeyId, { method: 'DELETE' }, true);
        setOutput(data);
        setStatus('Key deleted.', false);
        selectedKeyId = null;
      } catch (err) {
        setStatus(err.message, true);
      }
    };

    outputEl.addEventListener('click', () => {
      const maybe = prompt('Set selected key id (UUID) for delete:');
      if (maybe) {
        selectedKeyId = maybe.trim();
        setStatus('Selected key id stored for delete action.', false);
      }
    });
  </script>
</body>
</html>`;

export async function dashboardRoutes(fastify: FastifyInstance) {
  fastify.get("/dashboard", async (_request, reply) => {
    reply.type("text/html").send(dashboardHtml);
  });
}
