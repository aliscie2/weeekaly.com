# Weekaly

Calendar and scheduling application on the Internet Computer with Google Calendar integration.

## Quick Start

```bash
npm install
dfx start --clean --background
dfx build backend && dfx deploy
npm run start
```

Open http://localhost:5173

## Features

- Drag-to-create, resize, and reschedule events
- Real-time Google Calendar sync (5-min polling)
- AI assistant for natural language event creation
- Touch-optimized mobile interactions
- OAuth via Internet Identity

## Key Documentation

- **[COMMON_MISTAKES.md](./COMMON_MISTAKES.md)** - Critical lessons learned (14 patterns)
- **[CODE_QUALITY_IMPROVEMENTS.md](./CODE_QUALITY_IMPROVEMENTS.md)** - Performance optimizations
- **[src/frontend/AIAgent/guide.md](./src/frontend/AIAgent/guide.md)** - AI agent architecture

## Development

```bash
# Testing
cargo test              # Backend
npm test               # E2E tests

# Code quality
npm run format         # Format all code
make frontend-format   # Check types & unused exports

# Deployment
make deploy-all
```

## Tech Stack

**Backend**: Rust, IC CDK, WebSocket  
**Frontend**: React 19, TypeScript, Vite, Tailwind  
**State**: React Query, React hooks  
**UI**: Radix UI, Motion, Sonner

See `.kiro/steering/` for complete architecture details.
