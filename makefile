# Development
start:
	npm start

run_fe:
	yarn start

run_be:
	dfx start --background --host 127.0.0.1:4943
	dfx deploy backend

# Process Management
kill:
	kill -INT $(lsof -t -i :8080) 2>/dev/null || true
	kill -INT $(lsof -t -i :4943) 2>/dev/null || true
	lsof -ti:5173 | xargs kill -9 2>/dev/null || true

kill_dfx:
	killall dfx replica 2>/dev/null || true

get_all_localhost:
	lsof -i 4 -P -n | grep '127.0.0.1'

get_any_port:
	lsof -i :4943

# Local Deployment
deploy-all:
	dfx killall 2>/dev/null || true
	dfx stop 2>/dev/null || true
	dfx start --background --clean --host 127.0.0.1:4943
	sleep 1
	dfx deploy backend
	dfx generate backend
	npm install && npm start

redeploy:
	dfx killall 2>/dev/null || true
	dfx stop 2>/dev/null || true
	rm -rf .dfx/state 2>/dev/null || true
	dfx start --background --host 127.0.0.1:4943
	sleep 1
	dfx deploy backend
	dfx generate backend
	npm start

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

# Cycles Management
add_balance:
	dfx wallet --network ic redeem-faucet-coupon YOUR_COUPON_CODE
	dfx ledger --network ic balance
	dfx wallet --network ic balance
	dfx canister --network ic balance

topup_cycles:
	dfx identity use default
	dfx ledger account-id --network=ic
	@echo "Send ICP to the address above, then check balance:"
	dfx ledger balance --network=ic
	dfx identity --network=ic get-wallet
	@echo "Update wallet ID below and run topup_backend"

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
#  make sure to read COMMON_MISTAKES.md before u start
# 	remove unused function, and delete unused files
#  do not care about anything outse src/frontend
#  fix types and avoid using any as much as possable and use meaningfull types
#  re-run this after you fnish if there is no more warnings and error do no rerun again
# batching chnages together, do making changes one at a time
	npm run format & \
	npx tsc --noUnusedLocals --noUnusedParameters --noEmit --skipLibCheck & \
	npx ts-unused-exports tsconfig.json || true & \
	wait


pretty:
	prettier --write ./src/frontend
	prettier --write ./tests

backend-format:
	cargo fmt
	cargo clippy --fix --allow-dirty --allow-staged

code_review:
	git diff HEAD~1 HEAD -- src/frontend

# Testing
test-e2e:
	lsof -ti:5173 | xargs kill -9 || true
	dfx deploy backend --mode reinstall --yes
	yarn start &
	sleep 5
	yarn playwright test
	lsof -ti:5173 | xargs kill -9 || true

debug-loading-time:
	npm run start -- --debug hmr

# Utilities
generate_icons:
	npx pwa-asset-generator ./public/logo.jpg ./public/icons --background "#000000" --manifest ./public/manifest.json --index ./index.html

get_typescript_issues:
	npx tsc --noEmit --pretty

testing_thumbnails:
	@echo "Starting cloudflare tunnel..."
	@echo "Remember to add 'allowedHosts: [\".trycloudflare.com\"]' in vite.config.ts server config"
	cloudflared tunnel --url http://localhost:5173

getting_pulls:
	@echo "Usage: make getting_pulls PR=123"
	git fetch origin pull/$(PR)/head:pr-$(PR)


	
upgrade-backend:
	bash scripts/did.sh backend
	dfx generate backend
	dfx deploy backend
	gzip -fk target/wasm32-unknown-unknown/release/backend.wasm
	mv target/wasm32-unknown-unknown/release/backend.wasm.gz ./tests/backend/

reinstall:
	dfx canister install backend --mode reinstall --yes



testing_thumbnails:
	cloudflared tunnel --url http://localhost:5173
# 	addd this in in server: in  vite.config.ts allowedHosts: [ ".trycloudflare.com"],
