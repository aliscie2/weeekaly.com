# oDoc

## Quick Start

Install dependencies:
- [dfx](https://internetcomputer.org/docs/current/developer-docs/setup/install) (v0.29.2)
- [Node.js](https://nodejs.org/) & npm/yarn
- [Rust](https://rustup.rs/)

Setup and deploy:
```bash
cp example.env .env
make deploy-all
```

## Development

Run tests:
```bash
npm test
```

Format code:
```bash
make frontend-format  # Frontend
make backend-format   # Backend
```

## Deployment

Local redeploy:
```bash
make redeploy
```


Local upgrade backend:
```bash
make upgrade-backend
```


IC mainnet:
```bash
make deploy-ic
```
