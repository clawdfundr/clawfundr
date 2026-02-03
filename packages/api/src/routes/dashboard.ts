import { FastifyInstance } from 'fastify';

const dashboardHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Clawfundr API Dashboard</title>
  <style>
    :root {
      --bg0: #050608;
      --bg1: #070A0F;
      --panel: rgba(10, 14, 18, 0.72);
      --line: rgba(255, 214, 10, 0.22);
      --yellow: #FFD60A;
      --yellow2: #FFB700;
      --text: rgba(255, 244, 200, 0.92);
      --muted: rgba(255, 244, 200, 0.62);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; border-radius: 0; }
    html, body { width: 100%; min-height: 100%; background: linear-gradient(180deg, var(--bg0), var(--bg1)); color: var(--text); font-family: "JetBrains Mono", "Fira Code", Consolas, monospace; overflow-x: hidden; }
    body { position: relative; }

    body::before {
      content: "";
      position: fixed;
      inset: 0;
      pointer-events: none;
      opacity: 0.05;
      background-image:
        repeating-radial-gradient(circle at 20% 30%, rgba(255, 255, 255, 0.07) 0, rgba(255, 255, 255, 0.07) 1px, transparent 2px, transparent 4px),
        repeating-radial-gradient(circle at 80% 70%, rgba(255, 255, 255, 0.05) 0, rgba(255, 255, 255, 0.05) 1px, transparent 2px, transparent 5px);
      animation: noiseShift 18s linear infinite;
      z-index: 1;
    }

    body::after {
      content: "";
      position: fixed;
      inset: 0;
      pointer-events: none;
      opacity: 0.12;
      background: repeating-linear-gradient(to bottom, rgba(255, 214, 10, 0.04) 0, rgba(255, 214, 10, 0.04) 1px, transparent 2px, transparent 5px);
      animation: scanDrift 10s linear infinite;
      z-index: 2;
    }

    .bg-glow { position: fixed; width: 46vw; height: 46vw; border-radius: 50%; filter: blur(70px); pointer-events: none; z-index: 0; opacity: 0.16; background: radial-gradient(circle, rgba(255, 214, 10, 0.42), transparent 68%); }
    .bg-glow.left { top: -18vw; left: -16vw; }
    .bg-glow.right { right: -16vw; bottom: -20vw; }

    .shell { position: relative; z-index: 3; width: 100%; min-height: 100vh; padding: 24px; display: grid; gap: 16px; grid-template-columns: 1fr; }

    .panel {
      background: var(--panel);
      border: 1px solid var(--line);
      backdrop-filter: blur(9px);
      box-shadow: inset 0 0 20px rgba(255, 214, 10, 0.04), 0 14px 40px rgba(0, 0, 0, 0.55);
      padding: 18px;
      transition: transform 220ms ease, box-shadow 260ms ease, border-color 220ms ease;
    }

    .panel:hover { transform: translateY(-3px); border-color: rgba(255, 214, 10, 0.44); box-shadow: inset 0 0 30px rgba(255, 214, 10, 0.07), 0 18px 46px rgba(0, 0, 0, 0.62), 0 0 18px rgba(255, 214, 10, 0.12); }
    .headline { font-size: clamp(26px, 4.3vw, 42px); font-weight: 700; letter-spacing: 0.04em; color: var(--yellow); display: inline-block; position: relative; text-shadow: 0 0 16px rgba(255, 214, 10, 0.2); animation: glitchPulse 6.4s infinite; }
    .headline::before, .headline::after { content: attr(data-text); position: absolute; inset: 0; opacity: 0; pointer-events: none; }
    .headline::before { color: rgba(255, 214, 10, 0.9); text-shadow: -1px 0 rgba(255, 120, 0, 0.55); animation: glitchLayerA 6.4s infinite; }
    .headline::after { color: rgba(255, 250, 205, 0.9); text-shadow: 1px 0 rgba(255, 214, 10, 0.45); animation: glitchLayerB 6.4s infinite; }
    .panel:hover .headline, .panel:hover .headline::before, .panel:hover .headline::after { animation-duration: 2.2s; }
    .subtitle { margin-top: 8px; color: var(--muted); line-height: 1.5; font-size: 14px; max-width: 900px; }
    .divider { margin-top: 14px; height: 1px; width: 100%; background: linear-gradient(90deg, transparent, rgba(255, 214, 10, 0.65), transparent); animation: dividerSweep 4.5s ease-in-out infinite; }
    .status { margin-top: 10px; color: var(--muted); font-size: 13px; min-height: 18px; }
    .status.ok { color: #ffe784; }
    .status.err { color: #ffb84f; }

    .grid { display: grid; gap: 14px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .grid.three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .field label { display: block; margin-bottom: 6px; font-size: 12px; color: var(--muted); letter-spacing: 0.02em; text-transform: uppercase; }
    .field input {
      width: 100%; border: 1px solid var(--line); background: rgba(6, 9, 13, 0.76); color: var(--text);
      padding: 11px 12px; font-size: 14px; font-family: inherit; caret-color: var(--yellow);
      transition: box-shadow 220ms ease, border-color 220ms ease, background 220ms ease;
    }
    .field input::placeholder { color: rgba(255, 244, 200, 0.42); }
    .field input:focus { outline: none; border-color: rgba(255, 214, 10, 0.82); box-shadow: 0 0 0 1px rgba(255, 214, 10, 0.4), 0 0 18px rgba(255, 214, 10, 0.15); background: rgba(8, 12, 16, 0.92); }

    .btn-row { margin-top: 14px; display: flex; flex-wrap: wrap; gap: 10px; }
    .btn {
      position: relative; overflow: hidden; border: 1px solid rgba(255, 214, 10, 0.32); background: rgba(13, 16, 20, 0.9); color: var(--text);
      padding: 10px 14px; font-family: inherit; font-size: 13px; letter-spacing: 0.02em; cursor: pointer;
      transition: transform 160ms ease, box-shadow 220ms ease, border-color 220ms ease, background 220ms ease;
    }
    .btn::after { content: ""; position: absolute; top: 0; left: -120%; width: 70%; height: 100%; background: linear-gradient(110deg, transparent, rgba(255, 214, 10, 0.25), transparent); animation: sheen 4.8s ease-in-out infinite; pointer-events: none; }
    .btn:hover { transform: translateY(-2px); border-color: rgba(255, 214, 10, 0.72); box-shadow: 0 0 18px rgba(255, 214, 10, 0.18); }
    .btn:active { transform: translateY(0); box-shadow: 0 0 10px rgba(255, 214, 10, 0.1); }
    .btn.primary { border-color: rgba(255, 214, 10, 0.8); background: linear-gradient(180deg, rgba(255, 214, 10, 0.22), rgba(255, 183, 0, 0.08)); box-shadow: inset 0 0 14px rgba(255, 214, 10, 0.12); color: #fff7ce; animation: pulseGlow 2.8s ease-in-out infinite; }
    .btn.ghost { border-color: rgba(255, 214, 10, 0.24); background: rgba(12, 15, 20, 0.75); color: var(--muted); }
    .btn.warn { border-color: rgba(255, 183, 0, 0.38); background: rgba(20, 14, 8, 0.72); color: #ffd591; }

    .api-display { margin-top: 14px; border: 1px solid var(--line); background: rgba(5, 8, 11, 0.88); padding: 12px; display: flex; gap: 10px; align-items: center; justify-content: space-between; min-height: 46px; }
    .api-display code { color: #ffe89d; font-size: 13px; letter-spacing: 0.02em; word-break: break-all; }
    .api-display.empty code { color: var(--muted); }

    .stat-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-bottom: 12px; }
    .stat { border: 1px solid var(--line); background: rgba(6, 10, 14, 0.72); padding: 10px; }
    .stat .k { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.03em; }
    .stat .v { margin-top: 4px; font-size: 20px; color: #ffe492; }

    .list { border: 1px solid var(--line); background: rgba(4, 8, 11, 0.9); max-height: 280px; overflow: auto; }
    .row { display: grid; grid-template-columns: 1.2fr 1.2fr 0.8fr 1fr; gap: 8px; padding: 8px 10px; border-bottom: 1px solid rgba(255, 214, 10, 0.1); font-size: 12px; }
    .row.head { position: sticky; top: 0; background: rgba(10, 15, 20, 0.95); color: #ffe69a; text-transform: uppercase; letter-spacing: 0.03em; }

    .terminal { margin-top: 12px; border: 1px solid var(--line); background: rgba(3, 6, 9, 0.95); min-height: 210px; position: relative; overflow: hidden; }
    .terminal::before { content: ""; position: absolute; inset: 0; pointer-events: none; background: repeating-linear-gradient(to bottom, rgba(255, 214, 10, 0.03) 0, rgba(255, 214, 10, 0.03) 1px, transparent 2px, transparent 4px); opacity: 0.38; animation: scanDrift 9s linear infinite; }
    pre { position: relative; z-index: 1; white-space: pre-wrap; padding: 14px; font-size: 12px; line-height: 1.5; color: rgba(255, 245, 204, 0.9); max-height: 320px; overflow: auto; }
    .prompt-line { position: relative; z-index: 1; padding: 0 14px 14px; color: rgba(255, 234, 154, 0.9); font-size: 12px; }
    .prompt-line .caret { display: inline-block; width: 7px; height: 14px; margin-left: 5px; background: var(--yellow); animation: blink 0.95s steps(1) infinite; vertical-align: -2px; }

    .hidden { display: none; }

    @keyframes noiseShift { 0% { transform: translate(0, 0); } 25% { transform: translate(-1.2%, 1%); } 50% { transform: translate(1%, -0.8%); } 75% { transform: translate(-0.8%, -1.1%); } 100% { transform: translate(0, 0); } }
    @keyframes scanDrift { from { transform: translateY(-8px); } to { transform: translateY(8px); } }
    @keyframes dividerSweep { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
    @keyframes sheen { 0%, 60% { left: -130%; } 100% { left: 140%; } }
    @keyframes blink { 0%, 52% { opacity: 1; } 52.01%, 100% { opacity: 0; } }
    @keyframes pulseGlow { 0%, 100% { box-shadow: inset 0 0 12px rgba(255, 214, 10, 0.09), 0 0 0 rgba(255, 214, 10, 0); } 50% { box-shadow: inset 0 0 14px rgba(255, 214, 10, 0.16), 0 0 16px rgba(255, 214, 10, 0.18); } }
    @keyframes glitchPulse { 0%, 92%, 100% { transform: none; filter: none; } 93% { transform: translateX(1px); filter: brightness(1.1); } 94% { transform: translateX(-1px); } 95% { transform: none; } }
    @keyframes glitchLayerA { 0%, 92%, 100% { opacity: 0; transform: translate(0, 0); } 93% { opacity: 0.55; transform: translate(-1px, 0); } 94% { opacity: 0.35; transform: translate(1px, -1px); } 95% { opacity: 0; transform: translate(0, 0); } }
    @keyframes glitchLayerB { 0%, 92%, 100% { opacity: 0; transform: translate(0, 0); } 93% { opacity: 0.45; transform: translate(1px, 0); } 94% { opacity: 0.3; transform: translate(-1px, 1px); } 95% { opacity: 0; transform: translate(0, 0); } }

    @media (max-width: 960px) {
      .shell { padding: 14px; gap: 12px; }
      .panel { padding: 14px; }
      .grid, .grid.three, .stat-grid { grid-template-columns: 1fr; gap: 12px; }
      .btn { flex: 1 1 auto; }
      .row { grid-template-columns: 1fr; }
      .row.head { display: none; }
    }
  </style>
</head>
<body>
  <div class="bg-glow left"></div>
  <div class="bg-glow right"></div>

  <main class="shell">
    <section class="panel">
      <h1 class="headline" data-text="Clawfundr API Dashboard">Clawfundr API Dashboard</h1>
      <p class="subtitle">[control-plane] create API key instantly, verify ownership via public X post, then unlock your personal agent console.</p>
      <div class="divider"></div>
      <div id="status" class="status">[ready] listening for commands</div>
    </section>

    <section class="panel" id="register-panel">
      <div class="grid">
        <div class="field">
          <label for="name">Name (register)</label>
          <input id="name" placeholder="Alice" />
        </div>
        <div class="field">
          <label for="tweetUrl">Tweet URL (manual verify fallback)</label>
          <input id="tweetUrl" placeholder="https://x.com/yourhandle/status/123..." />
        </div>
      </div>
      <div class="btn-row">
        <button id="registerBtn" class="btn primary">Register + Get API Key</button>
        <button id="openTweetBtn" class="btn ghost">Open Verification Tweet</button>
        <button id="autoVerifyBtn" class="btn">Auto Verify</button>
        <button id="manualVerifyBtn" class="btn primary">Manual Verify Tweet URL</button>
      </div>

      <div class="api-display">
        <code id="verificationInfo">verification_code: pending</code>
        <button id="copyCodeBtn" class="btn ghost" type="button">Copy Code</button>
      </div>
    </section>

    <section class="panel">
      <div class="grid three">
        <div class="field">
          <label for="apiKey">Current API Key</label>
          <input id="apiKey" type="password" autocomplete="off" placeholder="claw_..." />
        </div>
        <div class="field">
          <label for="label">New Key Label</label>
          <input id="label" placeholder="CLI key" />
        </div>
        <div class="field">
          <label for="deleteKeyId">Delete Key ID (UUID)</label>
          <input id="deleteKeyId" placeholder="00000000-0000-0000-0000-000000000000" />
        </div>
      </div>
      <div id="apiDisplay" class="api-display empty">
        <code id="maskedKey">claw_****...****</code>
        <button id="copyKeyBtn" class="btn ghost" type="button">Copy Key</button>
      </div>
      <div class="btn-row">
        <button id="saveKeyBtn" class="btn">Save Key</button>
        <button id="listKeysBtn" class="btn">List Keys</button>
        <button id="createKeyBtn" class="btn primary">Create Key</button>
        <button id="deleteSelectedBtn" class="btn warn">Delete Key</button>
        <button id="clearKeyBtn" class="btn ghost">Clear Saved Key</button>
      </div>
    </section>

    <section class="panel">
      <div class="stat-grid">
        <div class="stat"><div class="k">Total Agents</div><div class="v" id="statTotal">0</div></div>
        <div class="stat"><div class="k">Verified</div><div class="v" id="statVerified">0</div></div>
        <div class="stat"><div class="k">Pending</div><div class="v" id="statPending">0</div></div>
      </div>
      <div class="btn-row" style="margin-top:0; margin-bottom:10px;">
        <button id="refreshStatsBtn" class="btn">Refresh Agent Directory</button>
      </div>
      <div class="list" id="agentsList"></div>
    </section>

    <section class="panel" id="agent-profile-panel">
      <h2 style="font-size:18px; margin-bottom:8px; color:#ffe79b;">Personal Agent Dashboard</h2>
      <div class="subtitle" style="margin:0 0 10px;">Unlocks automatically after verification.</div>
      <div id="profileBlock" class="list"></div>
    </section>

    <section class="panel">
      <div class="terminal">
        <pre id="output">[ready] listening for commands</pre>
        <div class="prompt-line">console&gt; waiting<span class="caret"></span></div>
      </div>
    </section>
  </main>

  <script>
    const apiKeyInput = document.getElementById('apiKey');
    const nameInput = document.getElementById('name');
    const tweetUrlInput = document.getElementById('tweetUrl');
    const labelInput = document.getElementById('label');
    const deleteKeyIdInput = document.getElementById('deleteKeyId');

    const statusEl = document.getElementById('status');
    const outputEl = document.getElementById('output');
    const maskedKeyEl = document.getElementById('maskedKey');
    const apiDisplayEl = document.getElementById('apiDisplay');
    const verificationInfoEl = document.getElementById('verificationInfo');

    const statTotalEl = document.getElementById('statTotal');
    const statVerifiedEl = document.getElementById('statVerified');
    const statPendingEl = document.getElementById('statPending');
    const agentsListEl = document.getElementById('agentsList');
    const profileBlockEl = document.getElementById('profileBlock');

    let rawApiKey = '';
    let verificationCode = '';
    let tweetIntentUrl = '';
    let userId = '';

    function maskKey(key) {
      if (!key || !key.startsWith('claw_')) return 'claw_****...****';
      if (key.length <= 18) return key.slice(0, 7) + '****';
      return 'claw_****...****' + key.slice(-4);
    }

    function setRawApiKey(key, syncInput) {
      rawApiKey = (key || '').trim();
      if (syncInput !== false) apiKeyInput.value = rawApiKey;
      maskedKeyEl.textContent = maskKey(rawApiKey);
      apiDisplayEl.className = rawApiKey ? 'api-display' : 'api-display empty';
    }

    function setVerification(code, intent, uid) {
      verificationCode = code || '';
      tweetIntentUrl = intent || '';
      userId = uid || '';
      verificationInfoEl.textContent = verificationCode
        ? 'verification_code: ' + verificationCode
        : 'verification_code: pending';
    }

    function setStatus(message, isError) {
      statusEl.textContent = message;
      statusEl.className = 'status ' + (isError ? 'err' : 'ok');
    }

    function setOutput(payload) {
      outputEl.textContent = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
    }

    function getKey() {
      return rawApiKey || apiKeyInput.value.trim();
    }

    async function request(path, options, needsAuth) {
      const opts = options || {};
      const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});

      if (needsAuth) {
        const key = getKey();
        if (!key) throw new Error('Missing API key. Paste or register first.');
        headers.Authorization = 'Bearer ' + key;
      }

      const res = await fetch(path, Object.assign({}, opts, { headers }));
      const text = await res.text();
      let body = null;
      try { body = text ? JSON.parse(text) : null; } catch (_e) {}

      if (!res.ok) {
        const msg = body && body.message ? body.message : ('HTTP ' + res.status);
        throw new Error(msg);
      }

      return body;
    }

    function renderAgents(agents) {
      if (!agents || !agents.length) {
        agentsListEl.innerHTML = '<div class="row">No agents registered yet.</div>';
        return;
      }

      const rows = [
        '<div class="row head"><div>User</div><div>Name</div><div>Status</div><div>Verified At</div></div>'
      ];

      agents.forEach(function (a) {
        rows.push('<div class="row">'
          + '<div>' + (a.userId || '-') + '</div>'
          + '<div>' + (a.displayName || '-') + '</div>'
          + '<div>' + (a.verificationStatus || '-') + '</div>'
          + '<div>' + (a.verifiedAt || '-') + '</div>'
          + '</div>');
      });

      agentsListEl.innerHTML = rows.join('');
    }

    function renderProfile(data) {
      if (!data || !data.profile) {
        profileBlockEl.innerHTML = '<div class="row">No authenticated profile loaded yet.</div>';
        return;
      }

      const profile = data.profile;
      const metrics = data.metrics || { requests_count: 0, tx_count: 0, trades_count: 0 };
      const skills = (data.skillUsage || []).map(function (s) { return s.route + ' (' + s.count + ')'; }).join(', ') || '-';
      const trades = (data.recentTrades || []).slice(0, 5).map(function (t) { return t.type + ' | ' + t.hash; }).join('
') || '-';

      profileBlockEl.innerHTML = [
        '<div class="row head"><div>User</div><div>Status</div><div>Requests</div><div>Trades</div></div>',
        '<div class="row"><div>' + profile.userId + '</div><div>' + profile.verificationStatus + '</div><div>' + metrics.requests_count + '</div><div>' + metrics.trades_count + '</div></div>',
        '<div class="row"><div>Verification Code</div><div style="grid-column: span 3;">' + profile.verificationCode + '</div></div>',
        '<div class="row"><div>Tweet URL</div><div style="grid-column: span 3;">' + (profile.tweetUrl || '-') + '</div></div>',
        '<div class="row"><div>Skill Usage</div><div style="grid-column: span 3;">' + skills + '</div></div>',
        '<div class="row"><div>Recent Trades</div><div style="grid-column: span 3; white-space: pre-wrap;">' + trades + '</div></div>'
      ].join('');
    }

    async function loadDirectory() {
      const [stats, agents] = await Promise.all([
        request('/v1/agents/stats', { method: 'GET' }, false),
        request('/v1/agents', { method: 'GET' }, false),
      ]);

      statTotalEl.textContent = String(stats.totalAgents || 0);
      statVerifiedEl.textContent = String(stats.verifiedAgents || 0);
      statPendingEl.textContent = String(stats.pendingAgents || 0);
      renderAgents(agents.agents || []);
    }

    async function loadMyProfile() {
      const data = await request('/v1/agents/me', { method: 'GET' }, true);
      renderProfile(data);
      if (data && data.profile && data.profile.verificationStatus === 'verified') {
        window.location.hash = 'agent-profile-panel';
        document.getElementById('agent-profile-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return data;
    }

    const saved = localStorage.getItem('clawfundr_api_key');
    if (saved) setRawApiKey(saved, true);
    else setRawApiKey('', true);

    apiKeyInput.addEventListener('input', function () {
      setRawApiKey(apiKeyInput.value, false);
    });

    document.getElementById('copyKeyBtn').onclick = async function () {
      try {
        const key = getKey();
        if (!key) throw new Error('No API key available to copy.');
        await navigator.clipboard.writeText(key);
        setStatus('[ok] API key copied.', false);
      } catch (err) {
        setStatus('[error] ' + err.message, true);
      }
    };

    document.getElementById('copyCodeBtn').onclick = async function () {
      try {
        if (!verificationCode) throw new Error('No verification code yet. Register first.');
        await navigator.clipboard.writeText(verificationCode);
        setStatus('[ok] verification code copied.', false);
      } catch (err) {
        setStatus('[error] ' + err.message, true);
      }
    };

    document.getElementById('openTweetBtn').onclick = function () {
      if (!tweetIntentUrl) return setStatus('[error] register first to get tweet template.', true);
      window.open(tweetIntentUrl, '_blank', 'noopener,noreferrer');
      setStatus('[run] opened tweet intent in new tab.', false);
    };

    document.getElementById('registerBtn').onclick = async function () {
      try {
        setStatus('[run] registering user...', false);
        const body = { name: nameInput.value.trim() || undefined };
        const data = await request('/v1/auth/register', {
          method: 'POST',
          body: JSON.stringify(body)
        }, false);

        if (data && data.apiKey) {
          setRawApiKey(data.apiKey, true);
          localStorage.setItem('clawfundr_api_key', data.apiKey);
        }

        setVerification(data.verificationCode, data.tweetIntentUrl, data.userId);
        setOutput(data || '[ok] register complete');
        setStatus('[ok] registered. publish the tweet then verify.', false);
        await loadDirectory();
      } catch (err) {
        setStatus('[error] ' + err.message, true);
      }
    };

    document.getElementById('autoVerifyBtn').onclick = async function () {
      try {
        setStatus('[run] auto verification...', false);
        const data = await request('/v1/agents/verify/auto', { method: 'POST' }, true);
        setOutput(data || '[ok] auto verify checked');
        if (data && data.verified) {
          setStatus('[ok] verified. redirecting to profile dashboard...', false);
          await loadMyProfile();
        } else {
          setStatus('[warn] auto verify pending: ' + (data.message || 'manual verify required'), false);
        }
        await loadDirectory();
      } catch (err) {
        setStatus('[error] ' + err.message, true);
      }
    };

    document.getElementById('manualVerifyBtn').onclick = async function () {
      try {
        const tweetUrl = tweetUrlInput.value.trim();
        if (!tweetUrl) throw new Error('Paste tweet URL first.');
        setStatus('[run] manual verification...', false);
        const data = await request('/v1/agents/verify', {
          method: 'POST',
          body: JSON.stringify({ tweetUrl: tweetUrl })
        }, true);
        setOutput(data || '[ok] verify complete');
        if (data && data.verified) {
          setStatus('[ok] verified. redirecting to profile dashboard...', false);
          await loadMyProfile();
        } else {
          setStatus('[warn] verification failed: ' + (data.message || 'try again'), false);
        }
        await loadDirectory();
      } catch (err) {
        setStatus('[error] ' + err.message, true);
      }
    };

    document.getElementById('saveKeyBtn').onclick = function () {
      const key = getKey();
      if (!key) return setStatus('[error] nothing to save.', true);
      localStorage.setItem('clawfundr_api_key', key);
      setRawApiKey(key, true);
      setStatus('[ok] API key saved locally.', false);
    };

    document.getElementById('clearKeyBtn').onclick = function () {
      localStorage.removeItem('clawfundr_api_key');
      setRawApiKey('', true);
      setStatus('[ok] saved key cleared.', false);
      setOutput('[ready] listening for commands');
      renderProfile(null);
    };

    document.getElementById('listKeysBtn').onclick = async function () {
      try {
        setStatus('[run] loading keys...', false);
        const data = await request('/v1/auth/keys', { method: 'GET' }, true);
        setOutput(data || '[]');
        setStatus('[ok] keys loaded.', false);
      } catch (err) {
        setStatus('[error] ' + err.message, true);
      }
    };

    document.getElementById('createKeyBtn').onclick = async function () {
      try {
        setStatus('[run] creating key...', false);
        const payload = { label: labelInput.value.trim() || 'Dashboard Key' };
        const data = await request('/v1/auth/keys', {
          method: 'POST',
          body: JSON.stringify(payload)
        }, true);
        setOutput(data || '[ok] key created');
        setStatus('[ok] key created. save it now; shown once.', false);
      } catch (err) {
        setStatus('[error] ' + err.message, true);
      }
    };

    document.getElementById('deleteSelectedBtn').onclick = async function () {
      try {
        const keyId = deleteKeyIdInput.value.trim();
        if (!keyId) throw new Error('Provide key id to delete.');
        setStatus('[run] deleting key...', false);
        const data = await request('/v1/auth/keys/' + keyId, { method: 'DELETE' }, true);
        setOutput(data || '[ok] key deleted');
        setStatus('[ok] key deleted.', false);
      } catch (err) {
        setStatus('[error] ' + err.message, true);
      }
    };

    document.getElementById('refreshStatsBtn').onclick = async function () {
      try {
        setStatus('[run] refreshing directory...', false);
        await loadDirectory();
        setStatus('[ok] directory updated.', false);
      } catch (err) {
        setStatus('[error] ' + err.message, true);
      }
    };

    loadDirectory().catch(function (err) {
      setStatus('[error] ' + err.message, true);
    });

    if (getKey()) {
      loadMyProfile().catch(function () {
        renderProfile(null);
      });
    } else {
      renderProfile(null);
    }
  </script>
</body>
</html>`;

export async function dashboardRoutes(fastify: FastifyInstance) {
    fastify.get('/dashboard', async (_request, reply) => {
        reply.type('text/html').send(dashboardHtml);
    });
}
