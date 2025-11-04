# Development
run_fe:
	npm start

run_be:
	dfx start --background --host 127.0.0.1:4943
	dfx deploy backend

start:
	chmod +x ./scripts/start.sh
	./scripts/start.sh

# Process Management
kill:
	kill -INT $(lsof -t -i :8080)
	kill -INT $(lsof -t -i :4943)

kill_dfx:
	killall dfx replica

# Candid & Declarations
generate_candid_file:
	bash scripts/did.sh
	@echo "Generating declarations..."
	dfx generate backend

# Local Deployment
deploy-all:
	dfx killall 2>/dev/null || true
	dfx stop 2>/dev/null || true
	dfx start --background --clean --host 127.0.0.1:4943 
	dfx deploy internet_identity || error "Internet Identity deployment failed"
	sh scripts/first_time_run.sh
	bash scripts/did.sh backend
	dfx generate backend
	sh scripts/set_env.sh
	npm start

redeploy:
	dfx killall 2>/dev/null || true
	dfx stop 2>/dev/null || true
	rm -rf .dfx/state 2>/dev/null || true
	dfx start --background --host 127.0.0.1:4943 
	sleep 3
	dfx deploy internet_identity
	sh scripts/first_time_run.sh
	bash scripts/did.sh backend
	dfx generate backend
	sh scripts/set_env.sh
	npm start

upgrade-backend:
	bash scripts/did.sh backend
	dfx generate backend
	dfx deploy backend

# IC Mainnet Deployment
deploy-ic:
	@echo "Compressing frontend assets..."
	@find build -type f \( -name "*.js" -o -name "*.css" -o -name "*.html" -o -name "*.svg" -o -name "*.json" \) -exec gzip -9fk {} \;
	export DFX_WARNING=-mainnet_plaintext_identity && \
	export DFX_ASSET_UPLOAD_TIMEOUT=600 && \
	export DFX_ASSET_BATCH_SIZE=5 && \
	dfx deploy backend --network ic && \
	dfx deploy frontend --network ic || \
	(echo "Retrying frontend deployment..." && sleep 10 && dfx deploy frontend --network ic)

get_logs:
	dfx canister logs backend --network ic

# Cycles Management (update canister IDs after first deploy)
topup_backend:
	@echo "Converting ICP to cycles and topping up backend..."
	dfx identity use default
	@echo "Current ICP balance:"
	dfx ledger balance --network=ic
	@echo "Topping up wallet with 1 ICP..."
	dfx ledger --network=ic top-up --amount=1.0 $(shell dfx identity get-wallet --network ic)
	@echo "Sending 5T cycles to backend..."
	dfx wallet send $(shell dfx canister id backend --network ic) 5000000000000 --network=ic
	@echo "Backend status:"
	dfx canister status backend --network=ic

# Code Quality
frontend-format:
	prettier --write ./src/frontend
	npx tsc --noUnusedLocals --noUnusedParameters --noEmit --skipLibCheck

pretty:
	prettier --write ./src/frontend
	prettier --write ./tests

backend-format:
	cargo fmt
	cargo clippy --fix

# Testing
test-e2e:
	lsof -ti:5173 | xargs kill -9 || true
	dfx deploy backend --mode reinstall --yes
	npm start &
	sleep 5
	npm run playwright
	lsof -ti:5173 | xargs kill -9 || true

# Utilities
generate_icons:
	npx pwa-asset-generator ./public/logo.jpg ./public/icons --background "#000000" --manifest ./public/manifest.json --index ./index.html

get_typescript_issues:
	npx tsc --noEmit --pretty