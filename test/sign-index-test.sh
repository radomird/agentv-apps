#!/bin/bash

# How the index gets signed (bin/sign-index), with a throwaway key standing
# in for AgenTV's: it signs only with the key agentv-keyring trusts, the key
# is out of the environment before anything else runs, and bin/publish-index
# takes no key at all. Also reads the Index workflow, to see that only its
# signing job is given the key. It needs gpg and nothing from the network.
#
# Usage: test/sign-index-test.sh

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

for tool in gpg gpgv; do
  type -P "$tool" >/dev/null || fail "$tool is installed" "the signing test needs gpg and gpgv"
done

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

# Two throwaway keys: one stands in for AgenTV's, one for anyone else's.
new_key() {
  local home="$work/$1-home"
  mkdir -m 700 "$home"
  gpg --homedir "$home" --batch --quiet --passphrase '' --quick-gen-key "$1 <$1@agentv.invalid>" ed25519 sign never 2>/dev/null
  gpg --homedir "$home" --batch --armor --export-secret-keys 2>/dev/null >"$work/$1.secret"
  gpg --homedir "$home" --batch --export 2>/dev/null >"$work/$1.gpg"
  gpg --homedir "$home" --batch --with-colons --list-keys 2>/dev/null | awk -F: '$1 == "fpr" { print $10; exit }' >"$work/$1.fpr"
}
new_key agentv
new_key other

new_index() {
  rm -rf "$work/index"
  mkdir "$work/index"
  printf '{"schema": 1, "apps": []}\n' >"$work/index/index.json"
  printf '%s:4:\n' "$(cat "$work/agentv.fpr")" >"$work/index/agentv-trusted"
}

# gpgv, but it writes down whether the key was still in its environment.
mkdir "$work/bin"
real_gpgv=$(type -P gpgv)
cat >"$work/bin/gpgv" <<STANDIN
#!/bin/bash
echo "\${AGENTV_SIGNING_KEY:+leaked}" >>"$work/gpgv-env"
exec "$real_gpgv" "\$@"
STANDIN
chmod +x "$work/bin/gpgv"

new_index
out=$(PATH="$work/bin:$PATH" AGENTV_SIGNING_KEY="$(cat "$work/agentv.secret")" "$ROOT/bin/sign-index" "$work/index" 2>&1) ||
  fail "bin/sign-index signs the index with the key agentv-keyring trusts" "$out"
gpgv --quiet --keyring "$work/agentv.gpg" "$work/index/index.json.sig" "$work/index/index.json" 2>/dev/null ||
  fail "the index has a good signature from that key"
pass "bin/sign-index signs the index with the key agentv-keyring trusts"
[[ -s $work/gpgv-env ]] || fail "the signature is checked after signing"
! grep -q leaked "$work/gpgv-env" || fail "the key is out of the environment before anything else runs"
pass "the key is out of the environment before anything else runs"

new_index
out=$(AGENTV_SIGNING_KEY="$(cat "$work/other.secret")" "$ROOT/bin/sign-index" "$work/index" 2>&1) &&
  fail "another key signs nothing" "$out"
[[ ! -e $work/index/index.json.sig ]] || fail "another key signs nothing" "it left a signature"
pass "another key signs nothing"

out=$(env -u AGENTV_SIGNING_KEY "$ROOT/bin/sign-index" "$work/index" 2>&1) && fail "without the key nothing is signed" "$out"
[[ ! -e $work/index/index.json.sig ]] || fail "without the key nothing is signed" "it left a signature"
pass "without the key nothing is signed"

out=$(AGENTV_SIGNING_KEY="$(cat "$work/agentv.secret" "$work/other.secret")" "$ROOT/bin/sign-index" "$work/index" 2>&1) &&
  fail "two keys in the secret stop it" "$out"
pass "two keys in the secret stop it"

# bin/publish-index never signs, and says so before it does anything.
out=$(AGENTV_SIGNING_KEY=anything GITHUB_REPOSITORY=someone/agentv-apps GITHUB_SHA=0 "$ROOT/bin/publish-index" "$work/index" 2>&1) &&
  fail "bin/publish-index refuses the key" "$out"
[[ $out == *"doesn't sign"* ]] || fail "bin/publish-index refuses the key" "$out"
out=$(env -u AGENTV_SIGNING_KEY GITHUB_REPOSITORY=someone/agentv-apps GITHUB_SHA=0 "$ROOT/bin/publish-index" "$work/index" 2>&1) &&
  fail "bin/publish-index publishes nothing without a signature" "$out"
[[ $out == *"only ever published signed"* ]] || fail "bin/publish-index publishes nothing without a signature" "$out"
pass "bin/publish-index takes no key, and publishes nothing without a signature"

# The workflow: which jobs read the key, and which name the environment.
workflow="$ROOT/.github/workflows/index.yml"
jobs_with() {
  awk -v want="$1" '
    /^jobs:/ { jobs = 1; next }
    jobs && /^  [a-z][a-z0-9-]*:$/ { job = $1; sub(":", "", job) }
    jobs && index($0, want) && $0 !~ /^ *#/ { print job }
  ' "$workflow" | sort -u | paste -sd' '
}
[[ $(jobs_with 'secrets.AGENTV_SIGNING_KEY') == "sign" ]] || fail "only the signing job is given the key" "$(jobs_with 'secrets.AGENTV_SIGNING_KEY')"
[[ $(jobs_with 'environment: release') == "sign" ]] || fail "it takes the key from the release environment" "$(jobs_with 'environment: release')"
[[ $(jobs_with 'contents: write') == "publish" ]] || fail "only the publishing job may write to the repo" "$(jobs_with 'contents: write')"
sign_job=$(awk '/^  sign:$/ { on = 1; next } on && /^  [a-z][a-z0-9-]*:$/ { on = 0 } on' "$workflow")
[[ -n $sign_job ]] || fail "the workflow has a signing job"
busy=$(grep -nE 'curl |git (fetch|clone)|gh |fetch-agentv-os|npm |node ' <<<"$sign_job" || true)
[[ -z $busy ]] || fail "the signing job fetches and runs nothing else" "$busy"
pass "only the signing job is given the key, from the release environment, and it only signs"
