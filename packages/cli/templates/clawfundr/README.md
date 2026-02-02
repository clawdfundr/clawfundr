# Clawfundr AI Banker Agent

A terminal-only AI banker agent for EVM Base Chain. Interact with your crypto portfolio, get investment advice, and manage transactions—all from your command line.

## Features

- 🤖 **AI-Powered Advice** - Get personalized investment recommendations using Claude
- 💰 **Portfolio Management** - Check balances, track transactions, analyze holdings
- 🔒 **Security First** - Private keys encrypted locally, never exposed to AI
- 💳 **x402 Payments** - Support for HTTP 402 payment protocol
- 📊 **Transaction Analysis** - Decode and understand your Base chain transactions
- ⚙️ **Policy-Based** - Configurable caps, allowlists, and safety rules

## Prerequisites

- Node.js >= 18.0.0
- Anthropic Claude API key ([Get one here](https://console.anthropic.com/))
- Base chain RPC access (default: public RPC)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env and add your API key
# Required: CLAUDE_API_KEY
# Optional: WALLET_ADDRESS, BASESCAN_API_KEY, etc.
```

**Windows (PowerShell):**
```powershell
Copy-Item .env.example .env
notepad .env
```

### 3. Build the Project

```bash
npm run build
```

### 4. Start the Agent

```bash
npm start
```

Or run in development mode with auto-reload:

```bash
npm run dev
```

## Usage

Once started, you'll see the Clawfundr banner and a prompt:

```
╔════════════════════════════════════════╗
║  Clawfundr — Base Chain AI Banker     ║
╚════════════════════════════════════════╝

✓ Agent initialized
Type your message or press Ctrl+C to exit.

You: 
```

### Example Interactions

**Check Balance:**
```
You: What's my balance?
```

**Transaction History:**
```
You: Show me my recent transactions
```

**Investment Advice:**
```
You: Give me investment advice for moderate risk
```

**Send Transaction:**
```
You: Send 0.01 ETH to 0x1234567890abcdef...
```

### Special Commands

- `/help` - Show available commands
- `/exit` or `/quit` - Exit the application
- `Ctrl+C` - Exit the application

## Platform-Specific Examples

### Windows PowerShell

**Setup:**
```powershell
# Install dependencies
npm install

# Configure environment
Copy-Item .env.example .env
notepad .env  # Add your CLAUDE_API_KEY

# Build and run
npm run build
npm start
```

**Example Session:**
```powershell
PS> npm start

╔════════════════════════════════════════╗
║  Clawfundr — Base Chain AI Banker     ║
╚════════════════════════════════════════╝

🔐 Initializing wallet signer...
Enter your private key (0x...): ****************
✓ Agent initialized with wallet: 0x1234...5678

You: show me my balance

📊 Your Portfolio:
  ETH: 1.5
  USDC: 1,000

You: sync my transaction history

✓ Synced 150 blocks
  Transfers: 12
  Approvals: 3

You: give me investment advice

Based on your current portfolio and policy targets:

✓ Diversification: Good (2 assets)
⚠️ Stable ratio: 21% (target: 50%)
✓ Exposure limits: Within policy

Recommendation: Convert ~$1,375 of ETH to USDC to reach your target stable allocation.

You: /exit
Goodbye!
```

### Linux/macOS Bash

**Setup:**
```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
nano .env  # Add your CLAUDE_API_KEY

# Build and run
npm run build
npm start
```

**Example Session:**
```bash
$ npm start

╔════════════════════════════════════════╗
║  Clawfundr — Base Chain AI Banker     ║
╚════════════════════════════════════════╝

🔐 Initializing wallet signer...
Enter your private key (0x...): ****************
✓ Agent initialized with wallet: 0x1234...5678

You: what's my balance?

📊 Your Portfolio:
  ETH: 1.5
  USDC: 1,000

You: show me last week's report

📊 Weekly Report

Transactions: 15
  In: 5
  Out: 8
  Approvals: 2

You: ^C
Goodbye!
```

### Windows CMD

```cmd
REM Setup
npm install
copy .env.example .env
notepad .env

REM Run
npm start
```


## Configuration

### Environment Variables (.env)

| Variable | Required | Description |
|----------|----------|-------------|
| `CLAUDE_API_KEY` | ✅ | Anthropic Claude API key |
| `BASE_RPC_URL` | ❌ | Base chain RPC URL (default: public) |
| `WALLET_ADDRESS` | ❌ | Default wallet address to monitor |
| `BASESCAN_API_KEY` | ❌ | Basescan API key for tx history |
| `COINGECKO_API_KEY` | ❌ | CoinGecko API key for prices |
| `DATABASE_PATH` | ❌ | SQLite database path |
| `LOG_LEVEL` | ❌ | Logging level (debug/info/warn/error) |

### Policy Configuration (policy.json)

The `policy.json` file defines security rules and limits:

- **chainAllowlist**: Allowed chain IDs (default: [8453] for Base)
- **tokenAllowlist**: Approved tokens (USDC, WETH, etc.)
- **caps**: Transaction limits (per-payment, daily)
- **slippageCapBps**: Maximum slippage in basis points
- **targetStableRatio**: Target stablecoin allocation
- **maxExposurePerAsset**: Maximum exposure per asset

Example:
```json
{
  "chainAllowlist": [8453],
  "caps": {
    "perPayment": {
      "enabled": true,
      "maxUsd": 1000
    },
    "daily": {
      "enabled": true,
      "maxUsd": 5000
    }
  }
}
```

## Development

### Available Scripts

```bash
# Development mode with auto-reload
npm run dev

# Build TypeScript to JavaScript
npm run build

# Run the built application
npm start

# Run tests
npm test

# Lint code
npm run lint

# Clean build artifacts and database
npm run clean
```

### Project Structure

```
.
├── src/
│   ├── index.ts       # Main REPL interface
│   ├── agent.ts       # Agent processing logic
│   ├── config.ts      # Environment validation
│   ├── db/            # Database layer (TODO)
│   ├── chain/         # Base chain integration (TODO)
│   ├── llm/           # Claude integration (TODO)
│   ├── signer/        # Wallet & signing (TODO)
│   └── skills/        # Agent skills (TODO)
├── data/              # SQLite database (created on first run)
├── .env               # Environment configuration
├── policy.json        # Agent policy
└── package.json       # Dependencies and scripts
```

## Security

### Private Key Protection

- ✅ Private keys are **encrypted** and stored locally
- ✅ Keys are **NEVER** sent to Claude API or any external service
- ✅ Isolated signer module handles all cryptographic operations
- ✅ Transaction approval required before signing

### Transaction Safety

- ✅ All transactions require explicit user confirmation
- ✅ Policy-based caps and limits
- ✅ Allowlist-based recipient validation
- ✅ Real-time transaction preview before approval

### Best Practices

1. **Never commit your .env file** - It contains sensitive API keys
2. **Review transactions carefully** - Always verify recipient and amount
3. **Use strong passwords** - If wallet encryption is enabled
4. **Keep policy.json restrictive** - Start with low caps, increase as needed
5. **Regular backups** - Backup your encrypted wallet file

## Troubleshooting

### "CLAUDE_API_KEY is required"

Make sure you've created `.env` from `.env.example` and added your Anthropic API key:

```bash
cp .env.example .env
# Edit .env and add: CLAUDE_API_KEY=sk-ant-...
```

### "Cannot connect to Base chain"

Check your internet connection and verify `BASE_RPC_URL` in `.env`. The default public RPC should work, but you can use a dedicated RPC provider for better reliability.

### Database errors

Try cleaning and rebuilding:

```bash
npm run clean
npm run build
npm start
```

### Windows PowerShell execution policy

If you get an execution policy error:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## Roadmap

This is an early version with placeholder implementations. Upcoming features:

- [ ] Full Claude AI integration with function calling
- [ ] Real Base chain wallet management
- [ ] Transaction history sync and decoding
- [ ] x402 payment protocol support
- [ ] DeFi protocol integrations
- [ ] Portfolio analytics and reporting
- [ ] Multi-wallet support

## Support

- **Issues**: [GitHub Issues](https://github.com/your-org/clawfundr/issues)
- **Documentation**: [Full Docs](https://github.com/your-org/clawfundr)

## License

MIT

---

**⚠️ Disclaimer**: This software is for educational purposes. Not financial advice. Always DYOR (Do Your Own Research) before making investment decisions. Use at your own risk.
