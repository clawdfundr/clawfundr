import { FastifyInstance } from 'fastify';

const dashboardHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Clawfundr API Dashboard</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-1: #071423;
      --bg-2: #0f2b45;
      --panel: rgba(8, 18, 31, 0.75);
      --line: rgba(140, 202, 255, 0.22);
      --text: #ecf6ff;
      --muted: #a1bed8;
      --accent: #4bd1ff;
      --accent-2: #38f2b4;
      --danger: #ff6b7d;
      --ok: #77ffb8;
    }

    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Space Grotesk", sans-serif;
      color: var(--text);
      background:
        radial-gradient(1200px 600px at 15% -10%, #1e567f 0%, transparent 70%),
        radial-gradient(1100px 700px at 100% 0%, #0c6f7f 0%, transparent 65%),
        linear-gradient(170deg, var(--bg-1), var(--bg-2));
      min-height: 100vh;
      padding: 24px;
    }

    .wrap {
      max-width: 980px;
      margin: 0 auto;
      display: grid;
      gap: 16px;
    }

    .card {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 16px;
      backdrop-filter: blur(8px);
      padding: 18px;
      box-shadow: 0 18px 40px rgba(0, 0, 0, 0.22);
    }

    h1 {
      margin: 0 0 8px;
      font-size: clamp(24px, 4vw, 34px);
      letter-spacing: 0.02em;
    }

    .muted { color: var(--muted); }
    .status { margin-top: 8px; min-height: 20px; font-size: 14px; color: var(--muted); }
    .ok { color: var(--ok); }
    .err { color: var(--danger); }

    .grid {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    }

    label {
      display: block;
      font-size: 13px;
      margin: 0 0 6px;
      color: var(--muted);
    }

    input {
      width: 100%;
      border: 1px solid var(--line);
      background: rgba(7, 20, 35, 0.6);
      color: var(--text);
      border-radius: 10px;
      font-size: 14px;
      padding: 10px 12px;
      outline: none;
    }

    input:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(75, 209, 255, 0.18);
    }

    .btns { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
    button {
      border: 1px solid var(--line);
      background: linear-gradient(180deg, rgba(59, 184, 255, 0.25), rgba(59, 184, 255, 0.08));
      color: var(--text);
      border-radius: 10px;
      padding: 10px 12px;
      font: inherit;
      font-size: 14px;
      cursor: pointer;
    }

    button.alt {
      background: linear-gradient(180deg, rgba(56, 242, 180, 0.25), rgba(56, 242, 180, 0.08));
    }

    button.warn {
      background: linear-gradient(180deg, rgba(255, 107, 125, 0.25), rgba(255, 107, 125, 0.08));
    }

    pre {
      margin: 0;
      white-space: pre-wrap;
      background: rgba(3, 10, 18, 0.7);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 12px;
      color: #d7ecff;
      font-size: 13px;
      max-height: 360px;
      overflow: auto;
    }
  </style>
</head>
<body>
  <main class="wrap">
    <section class="card">
      <h1>Clawfundr API Dashboard</h1>
      <div class="muted">Register user, store API key, create/list/revoke keys from one place.</div>
      <div id="status" class="status"></div>
    </section>

    <section class="card">
      <div class="grid">
        <div>
          <label for="name">Name (register)</label>
          <input id="name" placeholder="Alice" />
        </div>
        <div>
          <label for="email">Email (optional)</label>
          <input id="email" placeholder="alice@example.com" />
        </div>
      </div>
      <div class="btns">
        <button id="registerBtn" class="alt">Register + Get API Key</button>
      </div>
    </section>

    <section class="card">
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
      <div class="btns">
        <button id="deleteSelectedBtn" class="warn">Delete Selected Key</button>
      </div>
      <pre id="output">Ready.</pre>
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
    fastify.get('/dashboard', async (_request, reply) => {
        reply.type('text/html').send(dashboardHtml);
    });
}
