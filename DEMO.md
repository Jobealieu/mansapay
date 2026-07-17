# Demo runbook
## Warm up (before class)
docker compose -f infra/docker-compose.yml up -d
cd apps/api && npm run dev          # terminal 2, leave running

## Demo commands (terminal 3)
docker compose -f infra/docker-compose.yml ps
curl http://localhost:4000/health
docker compose -f infra/docker-compose.yml stop redis   # failure demo
curl -i http://localhost:4000/health                    # shows 503
docker compose -f infra/docker-compose.yml start redis
cd apps/api && npm test
npx tsc --noEmit

## Web
cd apps/web && npm run dev          # opens on :5173

## Shutdown after class
docker compose -f infra/docker-compose.yml down
