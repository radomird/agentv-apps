#!/bin/bash

# The index a box installs the apps from (ADR-036): bin/index builds it from
# this repo, a throwaway key stands in for AgenTV's and signs it, and
# agentv-os's own installer, at the commit in .github/agentv-os, installs
# each app from it: from its folder, at the commit it names, without its
# fixtures. A tampered index installs nothing.
#
# The apps come from this clone's commits, so a change that isn't committed
# isn't in what's installed.
#
# Usage: test/index-test.sh

set -euo pipefail

ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)

pass() {
  printf 'ok - %s\n' "$1"
}

fail() {
  printf 'not ok - %s\n' "$1" >&2
  [[ -n ${2:-} ]] && printf '%s\n' "$2" | sed 's/^/    /' >&2
  exit 1
}

for tool in node gpg gpgv git jq; do
  type -P "$tool" >/dev/null || fail "$tool is installed" "the index's test needs node, gpg, gpgv, git and jq"
done

"$ROOT/bin/fetch-agentv-os"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
export GNUPGHOME="$work/gnupg"
mkdir -m 700 "$GNUPGHOME"
gpg --batch --quiet --passphrase '' --quick-gen-key 'AgenTV test <test@agentv.invalid>' ed25519 sign never 2>/dev/null
gpg --batch --armor --export test@agentv.invalid >"$work/agentv.asc"

"$ROOT/bin/index" "$work/index" "file://$ROOT" >/dev/null
gpg --batch --quiet --detach-sign --output "$work/index/index.json.sig" "$work/index/index.json"

install() {
  AGENTV_PATH="$ROOT/.agentv-os" AGENTV_STATE="$work/state" AGENTV_KEYRING="$work/agentv.asc" \
    GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 "$ROOT/.agentv-os/bin/agentv-app-install" "$@"
}
mkdir "$work/state"

for manifest in "$ROOT"/apps/*/manifest.json; do
  path="apps/$(basename -- "$(dirname -- "$manifest")")"
  id=$(jq -r .id "$manifest")
  entry=$(jq -c --arg id "$id" '.apps[] | select(.id == $id)' "$work/index/index.json")
  [[ $(jq -r .path <<<"$entry") == "$path" && $(jq -r .tier <<<"$entry") == "official" ]] ||
    fail "the index lists $id as official, in $path" "$entry"
  out=$(install "$id" --index "$work/index" 2>&1) || fail "ADR-036 $id installs from the signed index" "$out"
  [[ $out == "Installed $(jq -r .name <<<"$entry") $(jq -r .version <<<"$entry") ($id)." ]] || fail "it says what it installed" "$out"
  installed="$work/state/apps/$id"
  [[ -f $installed/manifest.json && -f $installed/app.ts ]] || fail "$id lands in the box's apps folder" "$(ls -A "$installed" 2>&1)"
  [[ ! -e $installed/fixtures ]] || fail "$id's fixtures stay out"
  record=$(jq -c --arg id "$id" '.[$id]' "$work/state/apps/installed.json")
  [[ $(jq -r .commit <<<"$record") == $(jq -r .commit <<<"$entry") && $(jq -r .path <<<"$record") == "$path" ]] ||
    fail "the box records the commit and the folder the index named" "$record"
  pass "ADR-036 $id installs from a signed index, from $path at the commit it names, without its fixtures"
done

sed -i.bak 's/"version": *"[^"]*"/"version": "9.9.9"/' "$work/index/index.json"
status=0
out=$(install agentv.jellyfin --index "$work/index" 2>&1) || status=$?
(( status == 1 )) && [[ $out == *"isn't signed by AgenTV's key"* ]] || fail "a tampered index is refused" "exit $status: $out"
pass "a tampered index installs nothing"
