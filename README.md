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

### Main Guides
- **[OPTIMIZATION_GUIDE.md](./OPTIMIZATION_GUIDE.md)** - Security fixes, performance improvements, and implementation guide

### Quick Reference
- **Build:** `dfx build backend && dfx deploy`
- **Test:** `cargo test` (backend) or `npm test` (frontend)
- **Format:** `npm run format`

---

## 🔒 Security Status

### ✅ Phase 1 Complete (Nov 6, 2025)
- Client secret removed from frontend
- Secure token exchange via backend
- 96% reduction in API calls
- Improved code quality

### ⚠️ Phase 2 Required (Before Production)
- JWT signature verification
- Threshold ECDSA delegation signing
- Token encryption at rest

**See [OPTIMIZATION_GUIDE.md](./OPTIMIZATION_GUIDE.md) for details.**

---

## 📊 Performance

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| API Calls/Hour | 120 | 12 | 96% ↓ |
| Polling Interval | 30s | 5min | 10x slower |
| Background Polling | Yes | No | Battery savings |

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

### TypeScript Errors
```bash
# Rebuild backend to regenerate types
dfx build backend
```

### OAuth Issues
1. Check `GOOGLE_CLIENT_SECRET` in `src/backend/src/lib.rs`
2. Verify redirect URI in Google Cloud Console
3. Check logs: `dfx canister logs backend`

### Calendar Not Loading
1. Check browser console for errors
2. Verify access token in localStorage
3. Check Network tab for failed API calls

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

1. Read [OPTIMIZATION_GUIDE.md](./OPTIMIZATION_GUIDE.md)
2. Create a feature branch
3. Make your changes
4. Run tests and format code
5. Submit a pull request

---

**Status:** Phase 1 Complete ✅ | Phase 2 Required ⚠️  
**Last Updated:** November 6, 2025
