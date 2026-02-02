# Clawfundr Public API

Multi-tenant, non-custodial REST API for Base chain wallet management and AI-powered banking.

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18.0.0
- PostgreSQL 15+
- Claude API key

### Installation

```bash
cd packages/api
npm install
```

### Configuration

1. Copy environment template:
```bash
cp .env.example .env
```

2. Edit `.env` and configure:
```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/clawfundr
CLAUDE_API_KEY=sk-ant-your-api-key-here
BASE_RPC_URL=https://mainnet.base.org
PORT=3000
```

### Database Setup

1. Create PostgreSQL database:
```bash
createdb clawfundr
```

2. Run migrations:
```bash
npm run migrate
```

3. Create initial user and API key:
```bash
npm run bootstrap
```

This will output an API key like:
```
API Key: claw_abc123...xyz789
```

**⚠️ Save this key securely! It will not be shown again.**

### Start Server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm run build
npm start
```

Server will start on `http://localhost:3000`

## 📚 API Documentation

### Authentication

All endpoints (except `/health`) require API key authentication:

```bash
curl -H "Authorization: Bearer claw_your_api_key_here" \
     http://localhost:3000/v1/wallets
```

### Endpoints

#### Health Check
```bash
curl http://localhost:3000/health
```

#### Register Wallet
```bash
curl -X POST http://localhost:3000/v1/wallets \
  -H "Authorization: Bearer claw_..." \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "label": "My Main Wallet"
  }'
```

#### Get Portfolio
```bash
curl "http://localhost:3000/v1/portfolio?address=0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb" \
  -H "Authorization: Bearer claw_..."
```

#### Propose x402 Payment
```bash
curl -X POST http://localhost:3000/v1/x402/propose \
  -H "Authorization: Bearer claw_..." \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://api.example.com/premium-data"
  }'
```

Response:
```json
{
  "proposalId": "uuid-here",
  "merchant": "Example API",
  "amount": "0.001",
  "token": "ETH",
  "recipient": "0x...",
  "resource": "https://...",
  "expiresAt": "2026-02-02T20:45:00Z"
}
```

#### Execute x402 Payment (Get Unsigned TX)
```bash
curl -X POST http://localhost:3000/v1/x402/execute \
  -H "Authorization: Bearer claw_..." \
  -H "Content-Type: application/json" \
  -d '{
    "proposalId": "uuid-from-propose"
  }'
```

Response:
```json
{
  "unsignedTx": {
    "to": "0x...",
    "data": "0xa9059cbb...",
    "value": "0",
    "chainId": 8453,
    "gas": "50000",
    "maxFeePerGas": "1000000000",
    "maxPriorityFeePerGas": "100000000"
  },
  "instructions": "Sign this transaction with your wallet and POST to /v1/tx/broadcast"
}
```

#### Broadcast Signed Transaction
```bash
curl -X POST http://localhost:3000/v1/tx/broadcast \
  -H "Authorization: Bearer claw_..." \
  -H "Content-Type: application/json" \
  -d '{
    "signedTx": "0x02f8..."
  }'
```

## 🔐 Security

### Non-Custodial Design

**The server NEVER handles private keys.**

Transaction flow:
1. Client requests unsigned transaction from API
2. Client signs transaction locally (with MetaMask, Ledger, etc.)
3. Client broadcasts signed transaction via API or directly to Base chain

### API Key Security

- API keys are hashed with bcrypt before storage
- Keys are prefixed with `claw_` for easy identification
- Keys are 64 hex characters (256 bits of entropy)
- Revoked keys are rejected immediately

### Rate Limiting

- 100 requests per minute per API key
- 1000 requests per minute per IP
- Configurable via environment variables

### Input Validation

- All inputs validated with Zod schemas
- Ethereum addresses validated with regex
- JSON payloads size-limited

### Logging

- Authorization headers redacted from logs
- Request IDs for tracing
- Structured JSON logging

## 🧪 Testing

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Watch mode
npm test -- --watch
```

## 📊 Database Schema

### Tables

- `users` - User accounts
- `api_keys` - API keys (hashed)
- `wallets` - Registered wallet addresses
- `requests_log` - API request logs
- `tx_raw` - Raw blockchain transactions
- `tx_decoded` - Decoded/classified transactions
- `balances_snapshot` - Historical balance snapshots
- `x402_payments` - HTTP 402 payment records
- `policies` - User-specific policies
- `action_proposals` - Pending actions

See `src/db/migrations/001_initial.sql` for full schema.

## 🚀 Deployment

### Docker (Recommended)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

Build and run:
```bash
docker build -t clawfundr-api .
docker run -p 3000:3000 --env-file .env clawfundr-api
```

### Systemd Service

Create `/etc/systemd/system/clawfundr-api.service`:

```ini
[Unit]
Description=Clawfundr Public API
After=network.target postgresql.service

[Service]
Type=simple
User=clawfundr
WorkingDirectory=/opt/clawfundr-api
EnvironmentFile=/opt/clawfundr-api/.env
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable clawfundr-api
sudo systemctl start clawfundr-api
```

### Environment Variables

Production checklist:
- [ ] Set `NODE_ENV=production`
- [ ] Use strong `DATABASE_URL` with SSL
- [ ] Rotate `CLAUDE_API_KEY` regularly
- [ ] Configure proper `BASE_RPC_URL` (consider paid RPC)
- [ ] Set appropriate `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW`
- [ ] Use reverse proxy (nginx, Caddy) for HTTPS
- [ ] Enable database backups
- [ ] Set up monitoring (Prometheus, Grafana)

## 📖 OpenAPI Specification

Full API specification available at `docs/openapi.yaml`

View with Swagger UI:
```bash
npx swagger-ui-watcher docs/openapi.yaml
```

## 🛠️ Development

### Project Structure

```
packages/api/
├── src/
│   ├── server.ts              # Fastify server
│   ├── config/env.ts          # Environment validation
│   ├── db/                    # Database layer
│   ├── middleware/            # Auth, rate limiting, etc.
│   ├── routes/                # API endpoints
│   ├── tools/                 # Blockchain tools
│   ├── llm/                   # Claude integration
│   └── types/                 # TypeScript types
├── tests/                     # Unit & integration tests
├── scripts/                   # Migration & bootstrap scripts
└── docs/                      # OpenAPI spec
```

### Adding a New Endpoint

1. Create route file in `src/routes/`
2. Register route in `src/server.ts`
3. Add tests in `tests/unit/` or `tests/integration/`
4. Update OpenAPI spec in `docs/openapi.yaml`
5. Update this README

### Code Style

```bash
# Lint
npm run lint

# Format
npm run format
```

## 🐛 Troubleshooting

### Database Connection Failed

Check PostgreSQL is running:
```bash
pg_isready
```

Verify `DATABASE_URL` in `.env`

### API Key Invalid

Ensure API key format is correct: `claw_` + 64 hex characters

Re-run bootstrap if needed:
```bash
npm run bootstrap
```

### Rate Limit Exceeded

Wait for the rate limit window to reset (default: 60 seconds)

Or increase limits in `.env`:
```env
RATE_LIMIT_MAX=200
RATE_LIMIT_WINDOW=60000
```

## 📝 License

MIT

## 🙏 Acknowledgments

- Fastify - Fast web framework
- viem - Ethereum library
- PostgreSQL - Database
- Anthropic Claude - AI integration
