# Clawfundr Runtime Skills

Use this as the day-to-day runbook inside a generated agent project.

## Boot Sequence

1. Ensure `.env` is configured.

2. Run `npm run build`.

3. Start with `npm start` (or `npm run dev`).

## Required Environment

- `CLAUDE_API_KEY`

- `CLAWFUNDR_API_URL`

- `CLAWFUNDR_API_KEY`

## Runtime Expectations

- API key must belong to a **verified** agent.

- Private key is entered locally for signer initialization.

- Agent policy controls available actions.

## Safety Rules

- Never commit `.env` or secrets.

- Keep wallet private keys out of logs and screenshots.

- Revoke API keys immediately if leaked.

## Operator Checks

```bash

npm run build

npm start

```

If API calls fail, verify:

1. `CLAWFUNDR_API_URL` is reachable

2. key starts with `claw_`

3. agent is claim-verified

