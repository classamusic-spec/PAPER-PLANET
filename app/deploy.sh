#!/usr/bin/env bash
# Deploy the app to Vercel. Requires VERCEL_TOKEN in the environment.
#
# The source is copied out of the repo first: the Vercel CLI tries to link a
# detected git remote and fails on a private repo. The .vercel/project.json
# pins the deploy to an existing, unprotected project — without it the CLI
# creates a new project named after the directory, and new projects default to
# SSO protection, which puts an auth wall in front of the app.
set -euo pipefail

ORG_ID="team_HGTiGeaiIufugwo3HYEWy7md"
PROJECT_ID="prj_mdbse7I99o4a8GRUKMshGBsGxUR0"
ALIAS="paper-planet-app.vercel.app"

: "${VERCEL_TOKEN:?set VERCEL_TOKEN}"
here="$(cd "$(dirname "$0")" && pwd)"
staging="$(mktemp -d)"
trap 'rm -rf "$staging"' EXIT

cd "$here"
npm run build
tar --exclude=./node_modules --exclude=./dist --exclude=./.vercel -cf - . | (cd "$staging" && tar xf -)
(cd "$staging" && rm -f .*.mjs .*.ts tsconfig.check.json gallery.html info.md deploy.sh 2>/dev/null || true)
mkdir -p "$staging/.vercel"
printf '{ "orgId": "%s", "projectId": "%s" }\n' "$ORG_ID" "$PROJECT_ID" > "$staging/.vercel/project.json"

cd "$staging"
url="$(vercel deploy --prod --yes --archive=tgz --token="$VERCEL_TOKEN" \
  | grep -oE 'https://[a-z0-9-]+-class-a1\.vercel\.app' | head -1)"
echo "deployed: $url"
vercel alias set "${url#https://}" "$ALIAS" --token="$VERCEL_TOKEN" >/dev/null
echo "live: https://$ALIAS"
curl -sS -o /dev/null -w "check: HTTP %{http_code}\n" --max-time 30 "https://$ALIAS/"
