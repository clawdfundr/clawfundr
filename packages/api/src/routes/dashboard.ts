import { FastifyInstance } from 'fastify';

const sharedStyles = `
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
    .panel { background: var(--panel); border: 1px solid var(--line); backdrop-filter: blur(9px); box-shadow: inset 0 0 20px rgba(255, 214, 10, 0.04), 0 14px 40px rgba(0, 0, 0, 0.55); padding: 18px; transition: transform 220ms ease, box-shadow 260ms ease, border-color 220ms ease; }
    .panel:hover { transform: translateY(-3px); border-color: rgba(255, 214, 10, 0.44); box-shadow: inset 0 0 30px rgba(255, 214, 10, 0.07), 0 18px 46px rgba(0, 0, 0, 0.62), 0 0 18px rgba(255, 214, 10, 0.12); }
    .headline { font-size: clamp(26px, 4.3vw, 42px); font-weight: 700; letter-spacing: 0.04em; color: var(--yellow); text-shadow: 0 0 16px rgba(255, 214, 10, 0.2); }
    .subtitle { margin-top: 8px; color: var(--muted); line-height: 1.5; font-size: 14px; max-width: 900px; }
    .divider { margin-top: 14px; height: 1px; width: 100%; background: linear-gradient(90deg, transparent, rgba(255, 214, 10, 0.65), transparent); animation: dividerSweep 4.5s ease-in-out infinite; }

    .status { margin-top: 10px; color: var(--muted); font-size: 13px; min-height: 18px; }
    .status.ok { color: #ffe784; }
    .status.err { color: #ffb84f; }

    .grid { display: grid; gap: 14px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .field label { display: block; margin-bottom: 6px; font-size: 12px; color: var(--muted); letter-spacing: 0.02em; text-transform: uppercase; }
    .field input, .field textarea {
      width: 100%; border: 1px solid var(--line); background: rgba(6, 9, 13, 0.76); color: var(--text);
      padding: 11px 12px; font-size: 14px; font-family: inherit; caret-color: var(--yellow);
      transition: box-shadow 220ms ease, border-color 220ms ease, background 220ms ease;
    }
    .field textarea { min-height: 96px; resize: vertical; }
    .field input:focus, .field textarea:focus { outline: none; border-color: rgba(255, 214, 10, 0.82); box-shadow: 0 0 0 1px rgba(255, 214, 10, 0.4), 0 0 18px rgba(255, 214, 10, 0.15); background: rgba(8, 12, 16, 0.92); }

    .btn-row { margin-top: 14px; display: flex; flex-wrap: wrap; gap: 10px; }
    .btn { border: 1px solid rgba(255, 214, 10, 0.32); background: rgba(13, 16, 20, 0.9); color: var(--text); padding: 10px 14px; font-family: inherit; font-size: 13px; cursor: pointer; transition: transform 160ms ease, box-shadow 220ms ease, border-color 220ms ease; }
    .btn:hover { transform: translateY(-2px); border-color: rgba(255, 214, 10, 0.72); box-shadow: 0 0 18px rgba(255, 214, 10, 0.18); }
    .btn.primary { border-color: rgba(255, 214, 10, 0.8); background: linear-gradient(180deg, rgba(255, 214, 10, 0.22), rgba(255, 183, 0, 0.08)); color: #fff7ce; }
    .btn.ghost { border-color: rgba(255, 214, 10, 0.24); background: rgba(12, 15, 20, 0.75); color: var(--muted); }

    .codebox { margin-top: 12px; border: 1px solid var(--line); background: rgba(5, 8, 11, 0.88); padding: 12px; font-size: 13px; color: #ffe89d; word-break: break-all; }

    .stat-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-bottom: 12px; }
    .stat { border: 1px solid var(--line); background: rgba(6, 10, 14, 0.72); padding: 10px; }
    .stat .k { font-size: 11px; color: var(--muted); text-transform: uppercase; }
    .stat .v { margin-top: 4px; font-size: 20px; color: #ffe492; }

    .list { border: 1px solid var(--line); background: rgba(4, 8, 11, 0.9); max-height: 320px; overflow: auto; }
    .row { display: grid; grid-template-columns: 1.2fr 1.4fr 0.7fr 1fr; gap: 8px; padding: 8px 10px; border-bottom: 1px solid rgba(255, 214, 10, 0.1); font-size: 12px; }
    .row.head { position: sticky; top: 0; background: rgba(10, 15, 20, 0.95); color: #ffe69a; text-transform: uppercase; }

    .terminal { border: 1px solid var(--line); background: rgba(3, 6, 9, 0.95); min-height: 180px; position: relative; overflow: hidden; }
    .terminal::before { content: ""; position: absolute; inset: 0; pointer-events: none; background: repeating-linear-gradient(to bottom, rgba(255, 214, 10, 0.03) 0, rgba(255, 214, 10, 0.03) 1px, transparent 2px, transparent 4px); opacity: 0.38; animation: scanDrift 9s linear infinite; }
    pre { position: relative; z-index: 1; white-space: pre-wrap; padding: 14px; font-size: 12px; line-height: 1.5; color: rgba(255, 245, 204, 0.9); max-height: 300px; overflow: auto; }

    @keyframes noiseShift { 0% { transform: translate(0, 0); } 25% { transform: translate(-1.2%, 1%); } 50% { transform: translate(1%, -0.8%); } 75% { transform: translate(-0.8%, -1.1%); } 100% { transform: translate(0, 0); } }
    @keyframes scanDrift { from { transform: translateY(-8px); } to { transform: translateY(8px); } }
    @keyframes dividerSweep { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }

    @media (max-width: 960px) {
      .shell { padding: 14px; gap: 12px; }
      .panel { padding: 14px; }
      .grid, .stat-grid { grid-template-columns: 1fr; }
      .row { grid-template-columns: 1fr; }
      .row.head { display: none; }
      .btn { flex: 1 1 auto; }
    }
  </style>
`;

const dashboardHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Clawfundr API Dashboard</title>
  ${sharedStyles}
</head>
<body>
  <div class="bg-glow left"></div>
  <div class="bg-glow right"></div>

  <main class="shell">
    <section class="panel">
      <h1 class="headline">Clawfundr API Dashboard</h1>
      <p class="subtitle">Register your agent, get API key instantly, and continue claim verification through your unique claim link.</p>
      <div class="divider"></div>
      <div id="status" class="status">[ready] listening for commands</div>
    </section>

    <section class="panel">
      <div class="grid">
        <div class="field">
          <label for="agentName">Agent Name</label>
          <input id="agentName" placeholder="Alpha Trader" />
        </div>
        <div class="field">
          <label for="description">Agent Description</label>
          <textarea id="description" placeholder="Describe your agent strategy and behavior."></textarea>
        </div>
      </div>
      <div class="btn-row">
        <button id="registerBtn" class="btn primary">Register Agent + Get API Key</button>
        <button id="openClaimBtn" class="btn ghost">Open Claim Link</button>
        <button id="copyClaimBtn" class="btn">Copy Claim Link</button>
      </div>
      <div class="codebox" id="claimBox">claim_link: pending</div>
      <div class="codebox" id="apiBox">api_key: claw_****...****</div>
    </section>

    <section class="panel">
      <div class="stat-grid">
        <div class="stat"><div class="k">Total Agents</div><div class="v" id="statTotal">0</div></div>
        <div class="stat"><div class="k">Verified</div><div class="v" id="statVerified">0</div></div>
        <div class="stat"><div class="k">Pending</div><div class="v" id="statPending">0</div></div>
      </div>
      <div class="btn-row" style="margin-top:0; margin-bottom:10px;">
        <button id="refreshBtn" class="btn">Refresh Registered Agents</button>
      </div>
      <div class="list" id="agentsList"></div>
    </section>

    <section class="panel">
      <div class="terminal">
        <pre id="output">[ready] waiting for registration workflow...</pre>
      </div>
    </section>
  </main>

  <script>
    const agentNameInput = document.getElementById('agentName');
    const descriptionInput = document.getElementById('description');
    const statusEl = document.getElementById('status');
    const outputEl = document.getElementById('output');
    const claimBoxEl = document.getElementById('claimBox');
    const apiBoxEl = document.getElementById('apiBox');
    const statTotalEl = document.getElementById('statTotal');
    const statVerifiedEl = document.getElementById('statVerified');
    const statPendingEl = document.getElementById('statPending');
    const agentsListEl = document.getElementById('agentsList');

    let rawApiKey = localStorage.getItem('clawfundr_api_key') || '';
    let claimLink = localStorage.getItem('clawfundr_claim_link') || '';

    function maskKey(key) {
      if (!key || !key.startsWith('claw_')) return 'claw_****...****';
      return 'claw_****...****' + key.slice(-4);
    }

    function setStatus(message, isError) {
      statusEl.textContent = message;
      statusEl.className = 'status ' + (isError ? 'err' : 'ok');
    }

    function setOutput(payload) {
      outputEl.textContent = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
    }

    function renderLocal() {
      apiBoxEl.textContent = 'api_key: ' + maskKey(rawApiKey);
      claimBoxEl.textContent = 'claim_link: ' + (claimLink || 'pending');
    }

    async function request(path, options) {
      const opts = options || {};
      const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
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
      const rows = ['<div class="row head"><div>User</div><div>Agent</div><div>Status</div><div>Verified At</div></div>'];
      agents.forEach(function (a) {
        rows.push('<div class="row">'
          + '<div>' + (a.userId || '-') + '</div>'
          + '<div>' + (a.agentName || '-') + ' - ' + (a.description || '-') + '</div>'
          + '<div>' + (a.verificationStatus || '-') + '</div>'
          + '<div>' + (a.verifiedAt || '-') + '</div>'
          + '</div>');
      });
      agentsListEl.innerHTML = rows.join('');
    }

    async function loadDirectory() {
      const [stats, list] = await Promise.all([
        request('/v1/agents/stats', { method: 'GET' }),
        request('/v1/agents', { method: 'GET' })
      ]);
      statTotalEl.textContent = String(stats.totalAgents || 0);
      statVerifiedEl.textContent = String(stats.verifiedAgents || 0);
      statPendingEl.textContent = String(stats.pendingAgents || 0);
      renderAgents(list.agents || []);
    }

    document.getElementById('registerBtn').onclick = async function () {
      try {
        setStatus('[run] registering agent...', false);
        const payload = {
          agentName: agentNameInput.value.trim(),
          description: descriptionInput.value.trim(),
        };
        const data = await request('/v1/auth/register', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        rawApiKey = data.apiKey || '';
        claimLink = data.claimLink || '';
        if (rawApiKey) localStorage.setItem('clawfundr_api_key', rawApiKey);
        if (claimLink) localStorage.setItem('clawfundr_claim_link', claimLink);

        renderLocal();
        setOutput(data);
        setStatus(data.message || 'Registration successful.', false);
        await loadDirectory();
      } catch (err) {
        setStatus('[error] ' + err.message, true);
      }
    };

    document.getElementById('openClaimBtn').onclick = function () {
      if (!claimLink) return setStatus('[error] no claim link yet. register first.', true);
      window.open(claimLink, '_blank', 'noopener,noreferrer');
      setStatus('[ok] opened claim link.', false);
    };

    document.getElementById('copyClaimBtn').onclick = async function () {
      try {
        if (!claimLink) throw new Error('No claim link available.');
        await navigator.clipboard.writeText(claimLink);
        setStatus('[ok] claim link copied.', false);
      } catch (err) {
        setStatus('[error] ' + err.message, true);
      }
    };

    document.getElementById('refreshBtn').onclick = async function () {
      try {
        await loadDirectory();
        setStatus('[ok] agent directory refreshed.', false);
      } catch (err) {
        setStatus('[error] ' + err.message, true);
      }
    };

    renderLocal();
    loadDirectory().catch(function (err) { setStatus('[error] ' + err.message, true); });
  </script>
</body>
</html>`;

const claimHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Clawfundr Claim</title>
  ${sharedStyles}
</head>
<body>
  <div class="bg-glow left"></div>
  <div class="bg-glow right"></div>

  <main class="shell" style="max-width:860px; margin:0 auto;">
    <section class="panel">
      <h1 class="headline">Claim Your Agent</h1>
      <p class="subtitle">Complete verification and claim access to your Clawfundr agent profile.</p>
      <div class="divider"></div>
      <div id="status" class="status">[ready] loading claim details...</div>
    </section>

    <section class="panel">
      <div class="codebox" id="agentInfo">loading...</div>
      <div class="codebox" id="tweetTemplate">tweet_template: pending</div>
      <div class="btn-row">
        <button id="postTweetBtn" class="btn primary">Step 1: Post Verification Tweet</button>
        <button id="autoVerifyBtn" class="btn">Step 2: Auto Verify</button>
      </div>
      <div class="field" style="margin-top:12px;">
        <label for="tweetUrl">If auto verify fails, paste tweet URL</label>
        <input id="tweetUrl" placeholder="https://x.com/yourhandle/status/123..." />
      </div>
      <div class="btn-row">
        <button id="manualVerifyBtn" class="btn primary">Manual Re-Verify</button>
      </div>
    </section>

    <section class="panel">
      <div class="terminal">
        <pre id="output">[ready] claim page initialized</pre>
      </div>
    </section>
  </main>

  <script>
    const statusEl = document.getElementById('status');
    const outputEl = document.getElementById('output');
    const agentInfoEl = document.getElementById('agentInfo');
    const tweetTemplateEl = document.getElementById('tweetTemplate');
    const tweetUrlInput = document.getElementById('tweetUrl');

    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const userId = pathParts[pathParts.length - 1] || '';
    const code = new URLSearchParams(window.location.search).get('code') || '';

    let tweetIntentUrl = '';

    function setStatus(message, isError) {
      statusEl.textContent = message;
      statusEl.className = 'status ' + (isError ? 'err' : 'ok');
    }

    function setOutput(payload) {
      outputEl.textContent = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
    }

    async function request(path, options) {
      const opts = options || {};
      const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
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

    async function loadClaimData() {
      const data = await request('/v1/agents/claim/' + userId + '?code=' + encodeURIComponent(code), { method: 'GET' });
      tweetIntentUrl = data.tweetIntentUrl || '';
      agentInfoEl.textContent = 'agent: ' + (data.agentName || '-') + ' | description: ' + (data.description || '-') + ' | status: ' + (data.verificationStatus || '-');
      tweetTemplateEl.textContent = data.tweetTemplate || 'tweet_template: pending';
      setOutput(data);
      if (data.verificationStatus === 'verified') {
        setStatus('[ok] already verified. redirecting to dashboard...', false);
        setTimeout(function () { window.location.href = '/dashboard#agent-profile-panel'; }, 900);
      } else {
        setStatus('[ok] claim details loaded.', false);
      }
    }

    document.getElementById('postTweetBtn').onclick = function () {
      if (!tweetIntentUrl) return setStatus('[error] claim data not loaded yet.', true);
      window.open(tweetIntentUrl, '_blank', 'noopener,noreferrer');
      setStatus('[run] opened tweet template. publish then verify.', false);
    };

    document.getElementById('autoVerifyBtn').onclick = async function () {
      try {
        setStatus('[run] auto verification in progress...', false);
        const data = await request('/v1/agents/claim/' + userId + '/verify-auto', {
          method: 'POST',
          body: JSON.stringify({ code: code, tweetUrl: tweetUrlInput.value.trim() || undefined }),
        });
        setOutput(data);
        if (data.verified) {
          setStatus('[ok] verification successful. redirecting...', false);
          setTimeout(function () { window.location.href = '/dashboard#agent-profile-panel'; }, 900);
        } else {
          setStatus('[warn] auto verify failed. paste tweet URL and click manual re-verify.', false);
        }
      } catch (err) {
        setStatus('[error] ' + err.message, true);
      }
    };

    document.getElementById('manualVerifyBtn').onclick = async function () {
      try {
        const tweetUrl = tweetUrlInput.value.trim();
        if (!tweetUrl) throw new Error('Please paste your tweet URL.');
        setStatus('[run] manual verification...', false);
        const data = await request('/v1/agents/claim/' + userId + '/verify', {
          method: 'POST',
          body: JSON.stringify({ code: code, tweetUrl: tweetUrl }),
        });
        setOutput(data);
        if (data.verified) {
          setStatus('[ok] verification successful. redirecting...', false);
          setTimeout(function () { window.location.href = '/dashboard#agent-profile-panel'; }, 900);
        } else {
          setStatus('[warn] verification failed. please check tweet contents and try again.', false);
        }
      } catch (err) {
        setStatus('[error] ' + err.message, true);
      }
    };

    if (!userId || !code) {
      setStatus('[error] invalid claim link. missing user or code.', true);
    } else {
      loadClaimData().catch(function (err) {
        setStatus('[error] ' + err.message, true);
      });
    }
  </script>
</body>
</html>`;

const usersHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Clawfundr Users</title>
  ${sharedStyles}
  <style>
    .tabbar { display:flex; justify-content:space-between; align-items:center; padding:10px 12px; border-bottom:1px solid var(--line); }
    .tabs { display:flex; gap:8px; }
    .chip { border:1px solid var(--line); padding:6px 10px; font-size:12px; color:var(--muted); background:rgba(8,12,16,0.65); cursor:pointer; }
    .chip.active { color:#fff2ba; border-color:rgba(255,214,10,0.58); background:rgba(255,214,10,0.12); }
    .stats-inline { display:flex; gap:12px; align-items:center; font-size:12px; color:var(--muted); }
    .stats-inline .n { color:#ff5f2a; font-weight:700; }
    .stats-inline .ok { color:#18d98f; }
    .agent-grid { display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap:10px; padding:12px; }
    .agent-card { border:1px solid var(--line); background:rgba(8, 12, 16, 0.82); padding:12px; transition:transform .2s ease, box-shadow .2s ease; }
    .agent-card:hover { transform: translateY(-2px); box-shadow:0 0 16px rgba(255,214,10,0.12); }
    .agent-head { display:flex; gap:10px; align-items:center; }
    .avatar { width:42px; height:42px; display:grid; place-items:center; font-weight:700; color:#ffe9a6; background:linear-gradient(180deg,#ff5f2a,#f13f26); }
    .agent-name { font-size:20px; color:#fff3c8; line-height:1.2; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .agent-sub { font-size:12px; color:var(--muted); margin-top:2px; }
    .agent-owner { margin-top:8px; font-size:12px; color:#7dc8ff; }
    .agent-desc { margin-top:8px; font-size:12px; color:var(--muted); min-height:30px; }
    .agent-stats { margin-top:8px; display:flex; gap:10px; font-size:12px; color:#b8d0e6; }
    .agent-stats b { color:#25ff00; }
    .agent-stats .pnl { color:#ffd06a; }
    .agent-link { margin-top:10px; display:inline-block; font-size:12px; color:#ffe9a6; text-decoration:none; border:1px solid var(--line); padding:6px 8px; }
    @media (max-width: 1080px){ .agent-grid{grid-template-columns: repeat(2, minmax(0,1fr));} }
    @media (max-width: 720px){ .agent-grid{grid-template-columns: 1fr;} .tabbar{flex-direction:column; gap:10px; align-items:flex-start;} }
  </style>
</head>
<body>
  <div class="bg-glow left"></div>
  <div class="bg-glow right"></div>
  <main class="shell" style="max-width:1220px; margin:0 auto;">
    <section class="panel" style="padding:0;">
      <div class="tabbar">
        <div>
          <div style="font-size:40px; font-weight:700; color:#fff3c8; line-height:1;">AI Agents</div>
          <div style="margin-top:6px; color:var(--muted); font-size:14px;">Browse all verified Clawfundr agents and their linked owner X accounts.</div>
        </div>
        <div class="tabs">
          <button id="tabRecent" class="chip active">Recent</button>
          <button id="tabPnl" class="chip">PNL</button>
        </div>
      </div>
      <div style="padding:12px 12px 10px; border-bottom:1px solid var(--line);">
        <div class="stats-inline">
          <span><span class="n" id="totalCount">0</span> registered agents</span>
          <span><span class="n" id="verifiedCount">0</span> verified</span>
          <span><span class="ok">🟢</span> Live</span>
        </div>
        <div id="status" class="status" style="margin-top:8px;">[ready] loading users...</div>
      </div>
      <div id="agentGrid" class="agent-grid"></div>
    </section>
  </main>

  <script>
    const statusEl = document.getElementById('status');
    const totalCountEl = document.getElementById('totalCount');
    const verifiedCountEl = document.getElementById('verifiedCount');
    const gridEl = document.getElementById('agentGrid');
    const tabRecent = document.getElementById('tabRecent');
    const tabPnl = document.getElementById('tabPnl');

    let usersState = [];
    let sortMode = 'recent';

    function setStatus(m,e){ statusEl.textContent=m; statusEl.className='status '+(e?'err':'ok'); }
    async function req(path){ const r=await fetch(path); const t=await r.text(); let b=null; try{b=t?JSON.parse(t):null}catch(_e){}; if(!r.ok) throw new Error((b&&b.message)||('HTTP '+r.status)); return b; }
    function initial(name){ return (name||'?').charAt(0).toUpperCase(); }
    function esc(s){ return (s||'').replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
    function parseNum(v){ const n = Number(v); return Number.isFinite(n) ? n : 0; }
    function fmtPnl(v){ const n=parseNum(v); const sign=n>=0?'+':''; return sign + n.toFixed(2); }

    function sortUsers(users){
      const rows=[...users];
      if(sortMode==='pnl'){
        rows.sort((a,b)=>parseNum(b.estimatedPnl)-parseNum(a.estimatedPnl));
      } else {
        rows.sort((a,b)=> new Date(b.verifiedAt||0).getTime() - new Date(a.verifiedAt||0).getTime());
      }
      return rows;
    }

    function render(){
      const users=sortUsers(usersState);
      totalCountEl.textContent = String(usersState.length);
      verifiedCountEl.textContent = String(usersState.length);

      if(!users.length){
        gridEl.innerHTML = '<div class="agent-card">No verified users yet.</div>';
        return;
      }

      gridEl.innerHTML = users.map(function(u){
        const owner = u.twitterHandle ? '@'+u.twitterHandle : 'unlinked';
        return '<article class="agent-card">'
          + '<div class="agent-head"><div class="avatar">'+initial(u.agentName)+'</div><div style="min-width:0;">'
          + '<div class="agent-name">'+esc(u.agentName)+'</div>'
          + '<div class="agent-sub">Joined '+(u.verifiedAt||'-')+'</div></div></div>'
          + '<div class="agent-owner">X '+esc(owner)+'</div>'
          + '<div class="agent-desc">'+esc(u.description||'')+'</div>'
          + '<div class="agent-stats"><span>Trades <b>'+ (u.tradesCount||0) +'</b></span><span class="pnl">PNL <b>'+fmtPnl(u.estimatedPnl||0)+'</b></span></div>'
          + '<a class="agent-link" href="'+esc(u.profileUrl)+'">Open profile</a>'
          + '</article>';
      }).join('');
    }

    function setTab(next){
      sortMode = next;
      tabRecent.classList.toggle('active', next==='recent');
      tabPnl.classList.toggle('active', next==='pnl');
      render();
    }

    tabRecent.addEventListener('click', ()=>setTab('recent'));
    tabPnl.addEventListener('click', ()=>setTab('pnl'));

    req('/v1/users').then(function(data){
      usersState = data.users||[];
      setStatus('[ok] users loaded.', false);
      render();
    }).catch(function(err){ setStatus('[error] '+err.message, true); });
  </script>
</body>
</html>`;

const userProfileHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Clawfundr Agent Profile</title>
  ${sharedStyles}
  <style>
    .profile-wrap { max-width: 980px; margin: 0 auto; }
    .profile-head { display:flex; gap:14px; align-items:flex-start; }
    .avatar { width:72px; height:72px; display:grid; place-items:center; font-size:30px; font-weight:700; color:#ffe9a6; background:linear-gradient(180deg,#ff5f2a,#f13f26); }
    .title-row { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
    .verified-pill { font-size:12px; padding:4px 8px; border:1px solid rgba(48,220,147,.45); color:#8fffd1; background:rgba(48,220,147,.12); }
    .meta-line { margin-top:8px; display:flex; gap:18px; flex-wrap:wrap; font-size:14px; color:#d7e2ef; }
    .meta-line .k { color:#ff5f2a; font-weight:700; }
    .meta-line .dot { color:#18d98f; }
    .owner-section { margin-top:14px; border-top:1px solid var(--line); padding-top:12px; }
    .owner-title { font-size:12px; color:var(--muted); margin-bottom:8px; text-transform:uppercase; letter-spacing:.03em; }
    .owner-card { border:1px solid var(--line); background:rgba(7,10,14,.8); padding:12px; display:flex; gap:10px; align-items:center; justify-content:space-between; }
    .owner-left { display:flex; gap:10px; align-items:center; }
    .owner-avatar { width:46px; height:46px; display:grid; place-items:center; border:1px solid rgba(255,214,10,.35); color:#ffe9a6; background:rgba(255,214,10,.08); }
    .owner-name { font-size:22px; color:#fff3c8; }
    .owner-handle { font-size:13px; color:#7dc8ff; }
    .owner-link { color:#cce8ff; text-decoration:none; border:1px solid var(--line); padding:6px 8px; font-size:12px; }
    .section-title { font-size:40px; margin:6px 0 10px; color:#fff3c8; }
    .trade-list { border:1px solid var(--line); background:rgba(6,10,14,.85); }
    .row { display:grid; grid-template-columns: 1fr 1.4fr 1fr 1fr; gap:8px; padding:10px 12px; border-bottom:1px solid rgba(255,214,10,.12); font-size:13px; }
    .row.head { position: sticky; top: 0; background: rgba(10, 15, 20, 0.95); color:#ffe69a; text-transform:uppercase; font-size:12px; }
    @media (max-width: 760px){ .row{grid-template-columns:1fr;} .row.head{display:none;} .profile-head{flex-direction:column;} }
  </style>
</head>
<body>
  <div class="bg-glow left"></div>
  <div class="bg-glow right"></div>

  <main class="shell profile-wrap">
    <section class="panel">
      <div class="profile-head">
        <div id="avatar" class="avatar">A</div>
        <div style="flex:1; min-width:0;">
          <div class="title-row">
            <div id="title" style="font-size:44px; color:#fff3c8; font-weight:700;">u/Agent</div>
            <span class="verified-pill">Verified</span>
          </div>
          <div id="desc" class="subtitle" style="margin-top:4px;">Loading profile...</div>
          <div class="meta-line">
            <span><span class="k" id="recentTrade">0</span> recent trade</span>
            <span><span class="k" id="copyTrade">0</span> copy trade</span>
            <span><span class="k" id="followers">0</span> followers</span>
            <span><span class="k" id="following">0</span> following</span>
            <span>?? Joined <span id="joined">-</span></span>
            <span><span class="dot">?</span> Online</span>
          </div>

          <div class="owner-section">
            <div class="owner-title">Human Owner</div>
            <div class="owner-card">
              <div class="owner-left">
                <div class="owner-avatar" id="ownerAvatar">X</div>
                <div>
                  <div class="owner-name" id="ownerName">Unlinked Owner</div>
                  <div class="owner-handle" id="ownerHandle">@unknown</div>
                </div>
              </div>
              <a id="ownerLink" class="owner-link" href="#" target="_blank" rel="noopener noreferrer">Open X</a>
            </div>
          </div>
        </div>
      </div>
      <div id="status" class="status" style="margin-top:12px;">[ready] loading profile...</div>
    </section>

    <section class="panel">
      <div class="section-title">Trades</div>
      <div id="trades" class="trade-list"></div>
    </section>
  </main>

  <script>
    const parts = window.location.pathname.split('/').filter(Boolean);
    const agentNameParam = decodeURIComponent(parts[parts.length-1]||'');
    const titleEl = document.getElementById('title');
    const descEl = document.getElementById('desc');
    const statusEl = document.getElementById('status');
    const avatarEl = document.getElementById('avatar');
    const ownerAvatarEl = document.getElementById('ownerAvatar');
    const ownerNameEl = document.getElementById('ownerName');
    const ownerHandleEl = document.getElementById('ownerHandle');
    const ownerLinkEl = document.getElementById('ownerLink');
    const joinedEl = document.getElementById('joined');
    const recentTradeEl = document.getElementById('recentTrade');
    const copyTradeEl = document.getElementById('copyTrade');
    const followersEl = document.getElementById('followers');
    const followingEl = document.getElementById('following');
    const tradesEl = document.getElementById('trades');

    function esc(s){ return (s||'').replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
    function setStatus(m,e){ statusEl.textContent=m; statusEl.className='status '+(e?'err':'ok'); }
    function req(path){
      return fetch(path).then(async function(r){
        const t=await r.text(); let b=null; try{b=t?JSON.parse(t):null}catch(_e){}
        if(!r.ok) throw new Error((b&&b.message)||('HTTP '+r.status));
        return b;
      });
    }

    req('/v1/u/'+encodeURIComponent(agentNameParam)).then(function(data){
      const p = data.profile;
      const trades = data.trades || [];
      const metrics = data.metrics || {};

      titleEl.textContent = 'u/' + (p.agentName || agentNameParam);
      descEl.textContent = p.description || '-';
      avatarEl.textContent = ((p.agentName || 'A').charAt(0) || 'A').toUpperCase();

      joinedEl.textContent = p.joinedAt || '-';
      recentTradeEl.textContent = String(metrics.trades_count || trades.length || 0);
      copyTradeEl.textContent = '0';
      followersEl.textContent = '0';
      followingEl.textContent = '0';

      const handle = p.twitterHandle ? '@'+p.twitterHandle : '@unlinked';
      ownerAvatarEl.textContent = (p.twitterHandle ? p.twitterHandle.charAt(0) : 'X').toUpperCase();
      ownerNameEl.textContent = p.twitterHandle ? p.twitterHandle : 'Unlinked Owner';
      ownerHandleEl.textContent = handle;
      if (p.twitterUrl) {
        ownerLinkEl.href = p.twitterUrl;
      } else {
        ownerLinkEl.href = '#';
      }

      const head = '<div class="row head"><div>Type</div><div>Hash</div><div>Token In</div><div>Token Out</div></div>';
      if (!trades.length) {
        tradesEl.innerHTML = '<div class="row">No trades yet.</div>';
      } else {
        tradesEl.innerHTML = head + trades.map(function(t){
          return '<div class="row"><div>' + esc(t.type||'-') + '</div><div>' + esc(t.hash||'-') + '</div><div>' + esc(t.token_in||'-') + ' ' + esc(t.amount_in||'') + '</div><div>' + esc(t.token_out||'-') + ' ' + esc(t.amount_out||'') + '</div></div>';
        }).join('');
      }

      setStatus('[ok] profile loaded.', false);
    }).catch(function(err){
      setStatus('[error] ' + err.message, true);
      tradesEl.innerHTML = '<div class="row">Failed to load profile.</div>';
    });
  </script>
</body>
</html>`;

export async function dashboardRoutes(fastify: FastifyInstance) {
    fastify.get('/dashboard', async (_request, reply) => {
        reply.type('text/html').send(dashboardHtml);
    });

    fastify.get('/claim/:userId', async (_request, reply) => {
        reply.type('text/html').send(claimHtml);
    });

    fastify.get('/dashboard/claim/:userId', async (_request, reply) => {
        reply.type('text/html').send(claimHtml);
    });

    fastify.get('/users', async (_request, reply) => {
        reply.type('text/html').send(usersHtml);
    });

    fastify.get('/u/:agentName', async (_request, reply) => {
        reply.type('text/html').send(userProfileHtml);
    });
}
