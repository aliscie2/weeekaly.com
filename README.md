# weekaly.com

A calendar and scheduling application built on the Internet Computer with Google Calendar integration.

## 🚀 Quick Start

### Prerequisites
- [dfx](https://internetcomputer.org/docs/current/developer-docs/setup/install) (v0.29.2)
- [Node.js](https://nodejs.org/) & npm
- [Rust](https://rustup.rs/) with wasm32 target

### Setup
```bash
# Install dependencies
npm install

# Start local replica
dfx start --clean --background

# Build and deploy
dfx build backend
dfx deploy

# Start development server
npm run start
```

Open http://localhost:5173

---

## 📚 Documentation

### For Users
- **[QUICK_START_GUIDE.md](./QUICK_START_GUIDE.md)** - How to use the app
- **[VISUAL_GUIDE.md](./VISUAL_GUIDE.md)** - Visual design and UI patterns

### For Developers
- **[IMPLEMENTATION.md](./IMPLEMENTATION.md)** - Complete implementation guide
- **[CODE_QUALITY_IMPROVEMENTS.md](./CODE_QUALITY_IMPROVEMENTS.md)** - Performance & type safety improvements
- **[LESSONS_LEARNED.md](./LESSONS_LEARNED.md)** - Critical mistakes and how to avoid them
- **[TESTING.md](./TESTING.md)** - Testing checklist

### Quick Commands
```bash
# Build and deploy
dfx build backend && dfx deploy

# Run tests
cargo test  # Backend
npm test    # Frontend

# Format code
npm run format
```

---

## ✨ Features

### Calendar Management
- **Availability Page** - Drag-to-create events, resize handles, drag-to-reschedule
- **Events Page** - Full CRUD operations (Create, Read, Update, Delete)
- **Google Calendar Integration** - Real-time sync with 5-minute polling
- **Mobile Touch Support** - Long-press to create, touch drag, resize handles
- **Smart Cache Management** - Automatic account switching detection

### Key Capabilities
- ✅ Drag-to-create events with auto-generated names
- ✅ Resize events with top/bottom handles
- ✅ Drag-to-reschedule with live preview
- ✅ Overlap prevention and validation
- ✅ Past event protection
- ✅ Google Meet integration (auto-enabled)
- ✅ Mobile-optimized touch interactions
- ✅ Account switching with cache cleanup

**See [IMPLEMENTATION.md](./IMPLEMENTATION.md) for complete feature details.**

---

---

## 🛠️ Development

### Run Tests
```bash
# Backend tests
cargo test

# Frontend tests
npm test
```

### Format Code
```bash
# Format all code
npm run format
```

### Check Diagnostics
```bash
# Backend
cargo check

# Frontend
npm run build
```

---

## 🚀 Deployment

### Local Development
```bash
# Redeploy all canisters
dfx deploy

# Upgrade backend only
dfx deploy backend --mode upgrade
```

### IC Mainnet
```bash
# Deploy to mainnet
dfx deploy --network ic

# Check status
dfx canister --network ic status backend
```

---

## 🐛 Troubleshooting

### Common Issues
- **Events not loading?** Check browser console, verify login, ensure Google Calendar API is enabled
- **Wrong date/time?** Check console logs for date calculation, verify timezone
- **Form not submitting?** Check for validation errors, ensure title is filled
- **TypeScript errors?** Rebuild backend: `dfx build backend`
- **OAuth issues?** Check `GOOGLE_CLIENT_SECRET`, verify redirect URI, check logs: `dfx canister logs backend`

**See [QUICK_START_GUIDE.md](./QUICK_START_GUIDE.md) for detailed troubleshooting.**

---

## 📁 Project Structure

```
weekaly.com/
├── src/
│   ├── backend/          # Rust backend canister
│   │   ├── src/
│   │   │   └── lib.rs    # Main backend logic
│   │   └── Cargo.toml
│   ├── frontend/         # React frontend
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── utils/
│   │   └── App.tsx
│   └── declarations/     # Generated Candid types
├── dfx.json             # DFX configuration
├── package.json         # Frontend dependencies
└── OPTIMIZATION_GUIDE.md # Security & optimization guide
```

---

## 🔗 Resources

- [Internet Computer Docs](https://internetcomputer.org/docs)
- [Google Calendar API](https://developers.google.com/calendar/api)
- [OAuth 2.0 Security](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)
- [IC Threshold ECDSA](https://internetcomputer.org/docs/current/developer-docs/integrations/t-ecdsa/)

---

## 📝 License

[Your License Here]

---

## 🤝 Contributing

1. Read [IMPLEMENTATION.md](./IMPLEMENTATION.md) and [LESSONS_LEARNED.md](./LESSONS_LEARNED.md)
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test` and `cargo test`
5. Format code: `npm run format`
6. Check [TESTING.md](./TESTING.md) for testing guidelines
7. Submit a pull request

---

**Status:** Production Ready ✅  
**Last Updated:** November 9, 2025
