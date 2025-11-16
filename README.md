# Weekaly

Calendar and scheduling application on the Internet Computer with Google Calendar integration.

## Quick Start

```bash
npm install
dfx start --clean --background
dfx deploy
npm run start
```

Open http://localhost:5173

## Features

- Drag-to-create, resize, and reschedule events
- Real-time Google Calendar sync (5-min polling)
- AI assistant for natural language event creation
- Touch-optimized mobile interactions
- OAuth via Internet Identity

## Development

```bash
# Local development
dfx deploy backend --mode upgrade    # Deploy backend changes
npm run start                        # Start dev server

# Testing
cargo test                           # Backend tests
npm test                             # E2E tests (Playwright)

# Code quality
npm run format                       # Format all code
npx tsc --noEmit                     # Type check

# Production deployment
make deploy-ic                       # Deploy to IC mainnet
```

## Tech Stack

**Backend**: Rust, IC CDK, WebSocket  
**Frontend**: React 19, TypeScript, Vite, Tailwind  
**State**: React Query  
**UI**: Radix UI, Motion, Sonner

## Documentation

- **[COMMON_MISTAKES.md](./COMMON_MISTAKES.md)** - Critical lessons learned
- **[GOOGLE_API_KEY_SETUP.md](./GOOGLE_API_KEY_SETUP.md)** - Google Calendar API setup
- **[stable-struct-guide.md](./stable-struct-guide.md)** - IC stable structures guide
- **[src/frontend/AIAgent/guide.md](./src/frontend/AIAgent/guide.md)** - AI agent architecture
- **`.kiro/steering/`** - Complete architecture and tech stack details
