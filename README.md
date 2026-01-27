# miningos-wrk-minerpool-f2pool

F2Pool Mining Pool Worker - MiningOS worker implementation for integrating with F2Pool's API v2.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Starting the Worker](#starting-the-worker)
6. [Architecture](#architecture)
7. [API Endpoints Used](#api-endpoints-used)
8. [Development](#development)
9. [Monitoring](#monitoring)
10. [Troubleshooting](#troubleshooting)
11. [Contributing](#contributing)

## Overview

This worker connects to the F2Pool API v2 to collect and monitor mining statistics, including:
- Real-time hashrate monitoring (current, 1h, 24h intervals)
- Worker status and performance tracking
- Balance and revenue information
- Transaction history
- Stale hashrate monitoring

## Prerequisites

- Node.js >= 20.0
- Access to F2Pool API v2 (API secret required)
- Valid F2Pool account username for production use

## Installation

1. Clone the repository:
```bash
git clone https://github.com/tetherto/miningos-wrk-minerpool-f2pool.git
cd miningos-wrk-minerpool-f2pool
```

2. Install dependencies:
```bash
npm install
```

3. Setup configuration files:
```bash
bash setup-config.sh
```

## Configuration

### Base Configuration (config/f2pool.json)

Configure the F2Pool API endpoint and collection intervals:

Development/Staging:
```json
{
  "baseUrl": "http://127.0.0.1:8000",
  "apiSecret": "secret-key",
  "accounts":[]
}
```

Production:
```json
{
  "apiUrl": "https://api.f2pool.com/v2",
  "apiSecret": "secret-key",  
  "accounts":[]
}
```

**Configuration Options:**
- `baseUrl`: F2Pool API endpoint
- `apiSecret`: Your F2Pool API secret key

## Starting the Worker

### Production Mode
```bash
DEBUG="*" node worker.js --wtype wrk-minerpool-rack-f2pool --env production --rack rack-1
```

### Development Mode
```bash
DEBUG="*" node worker.js --wtype wrk-minerpool-rack-f2pool --env development --rack rack-1
```

### Mock Server (Development)
```bash
npm run dev
# Or specify custom usernames:
node mock/server.js --usernames username1,username2 --port 8000
```

## Architecture

### Core Classes

#### `F2PoolMinerPool` (`workers/lib/f2pool.minerpool.js`)
API client wrapper class that handles:
- API communication with F2Pool API v2
- API authentication via `F2P-API-SECRET` header
- Rate limiting (1 second between requests)
- Request formatting and response parsing
- Balance, hashrate, worker, and transaction data fetching

#### `WrkMinerPoolRackF2Pool` (`workers/f2pool.rack.minerpool.wrk.js`)
Main worker class extending `TetherWrkBase` that:
- Initializes HTTP facilities for F2Pool API communication
- Schedules periodic data collection:
  - Every 1 minute: Fetch stats (hashrate, balance, yearly balances)
  - Every 5 minutes: Fetch workers and save stats to database
  - Daily: Fetch transactions
- Implements data aggregation and storage logic
- Manages multiple mining accounts via configuration
- Provides RPC interface for querying collected data

### Statistics Collection

The worker collects and stores various statistics every 5 minutes:

1. **Account Snapshots**:
   - Total balance and unsettled amounts
   - 24h revenue
   - Estimated daily income
   - Active/total worker counts
   - Yearly balance history (last 12 months)

2. **Worker Statistics**:
   - Worker online/offline status
   - Individual worker hashrates
   - Stale hashrate metrics
   - Last share timestamps

3. **Daily Transactions**:
   - Revenue transactions for the current day
   - Transaction amounts and timestamps

### Data Flow

1. Worker initializes with configuration
2. Every 5 minutes:
   - Fetches worker statistics
   - Collects daily transactions
   - Updates account snapshots
3. Data stored in time-series logs with keys:
   - `stat-workers-t-minerpool`: Worker performance data
   - `stat-transactions-t-minerpool`: Transaction records
4. Available for querying via RPC interface

## API Endpoints Used

The worker interacts with the following F2Pool API v2 endpoints:
- `/v2/assets/balance` - Account balance and revenue
- `/v2/hash_rate/info` - Hashrate statistics
- `/v2/hash_rate/worker/list` - Worker information
- `/v2/assets/transactions/list` - Transaction history

All API requests require authentication via the `F2P-API-SECRET` header.

## Development

### Running Tests
```bash
npm run lint        # Check code style
npm run lint:fix    # Fix code style issues
npm test           # Run tests (currently runs linting)
```

### Mock Server
The mock server provides a development environment that simulates F2Pool API v2 responses:
- Default port: 8000
- Configurable usernames
- Simulates all API endpoints

## Monitoring

Monitor worker activity through debug logs:
- API requests and responses
- Statistics collection cycles
- Worker status updates
- Error messages and stack traces

## Troubleshooting

### Common Issues

1. **Registration fails**
   - Ensure username is valid for production
   - Check network connectivity to API endpoint
   - Verify configuration file syntax
   - Confirm API secret is correct

2. **No statistics collected**
   - Confirm worker is running (`DEBUG="*"` shows activity)
   - Check API endpoint configuration
   - Ensure API secret is valid

3. **Authentication errors**
   - Verify `apiSecret` in config/base.thing.json
   - Ensure API secret matches your F2Pool account
   - Check API secret has proper permissions

4. **Missing configuration**
   - Run `bash setup-config.sh` to create config files
   - Check all required fields are populated
   - Verify facilities configs exist: `config/facs/*.json`

## Contributing

Contributions are welcome and appreciated!
Whether you’re fixing a bug, adding a feature, improving documentation, or suggesting an idea, here’s how you can help:

### How to Contribute

1. **Fork** the repository.
2. **Create a new branch** for your feature or fix:

   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes** and commit them with a clear message.
4. **Push** to your fork:

   ```bash
   git push origin feature/your-feature-name
   ```
5. **Open a Pull Request** describing what you changed and why.

### Guidelines

* Follow the existing code style and structure.
* Keep PRs focused—one feature or fix per pull request.
* Provide screenshots or examples if your change affects the UI/UX.
* Update documentation/tests as needed.
