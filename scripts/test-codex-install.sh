#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
INSTALL_SCRIPT="$ROOT_DIR/web/default/public/codex/install.sh"
TEST_TMP_ROOT=$(mktemp -d "${TMPDIR:-/tmp}/codex-install-tests.XXXXXX")
trap 'rm -rf "$TEST_TMP_ROOT"' EXIT INT HUP TERM

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

assert_contains() {
  file=$1
  expected=$2
  if ! grep -Fq -- "$expected" "$file"; then
    printf 'Expected to find:\n%s\n\nin %s, got:\n' "$expected" "$file" >&2
    sed -n '1,220p' "$file" >&2 || true
    exit 1
  fi
}

assert_not_contains() {
  file=$1
  unexpected=$2
  if grep -Fq -- "$unexpected" "$file"; then
    printf 'Did not expect to find:\n%s\n\nin %s, got:\n' "$unexpected" "$file" >&2
    sed -n '1,220p' "$file" >&2 || true
    exit 1
  fi
}

make_fake_bin() {
  dir=$1
  status=$2
  mkdir -p "$dir"

  cat > "$dir/curl" <<'FAKE_CURL'
#!/bin/sh
printf '%s\n' "$*" >> "$FAKE_CURL_LOG"
while [ "$#" -gt 0 ]; do
  case "$1" in
    -o)
      shift
      output=$1
      ;;
    -w)
      shift
      ;;
  esac
  shift || break
done
if [ -n "${output:-}" ]; then
  printf '{"object":"list","data":[]}\n' > "$output"
fi
printf '%s' "$FAKE_CURL_STATUS"
exit 0
FAKE_CURL

  cat > "$dir/npm" <<'FAKE_NPM'
#!/bin/sh
printf '%s\n' "$*" >> "$FAKE_NPM_LOG"
exit 0
FAKE_NPM

  chmod +x "$dir/curl" "$dir/npm"
  FAKE_CURL_STATUS=$status
  export FAKE_CURL_STATUS
}

make_fake_codex() {
  dir=$1
  cat > "$dir/codex" <<'FAKE_CODEX'
#!/bin/sh
exit 0
FAKE_CODEX
  chmod +x "$dir/codex"
}

test_valid_key_installs_codex_and_writes_config() {
  tmp="$TEST_TMP_ROOT/install"
  mkdir -p "$tmp/home" "$tmp/bin"

  FAKE_CURL_LOG="$tmp/curl.log"
  FAKE_NPM_LOG="$tmp/npm.log"
  export FAKE_CURL_LOG FAKE_NPM_LOG
  make_fake_bin "$tmp/bin" 200

  HOME="$tmp/home" \
  PATH="$tmp/bin:/bin:/usr/bin" \
  KEEJIAI_API_KEY='sk-test-token' \
    sh "$INSTALL_SCRIPT" > "$tmp/out.log" 2> "$tmp/err.log"

  assert_contains "$FAKE_NPM_LOG" "i -g @openai/codex"
  assert_contains "$FAKE_CURL_LOG" "Authorization: Bearer sk-test-token"
  assert_contains "$FAKE_CURL_LOG" "https://api.keejiai.com/v1/models"

  config="$tmp/home/.codex/config.toml"
  auth="$tmp/home/.codex/auth.json"
  [ -f "$config" ] || fail "config.toml was not created"
  [ -f "$auth" ] || fail "auth.json was not created"

  assert_contains "$config" 'model = "gpt-5.5"'
  assert_contains "$config" 'model_provider = "custom"'
  assert_contains "$config" 'model_reasoning_effort = "xhigh"'
  assert_contains "$config" '[model_providers.custom]'
  assert_contains "$config" 'base_url = "https://api.keejiai.com/v1"'
  assert_contains "$config" 'name = "KeejiAI"'
  assert_contains "$config" 'wire_api = "responses"'
  assert_not_contains "$config" 'name = "OpenAI"'
  assert_contains "$auth" '"OPENAI_API_KEY": "sk-test-token"'
}

test_valid_key_updates_existing_config_without_installing() {
  tmp="$TEST_TMP_ROOT/existing"
  mkdir -p "$tmp/home/.codex" "$tmp/bin"

  cat > "$tmp/home/.codex/config.toml" <<'CONFIG'
model = "old-model"
model_provider = "old"

[features]
goals = true

[model_providers.custom]
base_url = "https://old.example/v1"
name = "Old"
wire_api = "chat"

[model_providers.other]
base_url = "https://other.example/v1"
name = "Other"
wire_api = "responses"
CONFIG

  FAKE_CURL_LOG="$tmp/curl.log"
  FAKE_NPM_LOG="$tmp/npm.log"
  export FAKE_CURL_LOG FAKE_NPM_LOG
  make_fake_bin "$tmp/bin" 200
  make_fake_codex "$tmp/bin"

  HOME="$tmp/home" \
  PATH="$tmp/bin:/bin:/usr/bin" \
  KEEJIAI_API_KEY='sk-existing-token' \
    sh "$INSTALL_SCRIPT" > "$tmp/out.log" 2> "$tmp/err.log"

  [ ! -s "$FAKE_NPM_LOG" ] || fail "npm should not be called when codex exists"
  config="$tmp/home/.codex/config.toml"
  assert_contains "$config" 'model = "gpt-5.5"'
  assert_contains "$config" 'model_provider = "custom"'
  assert_contains "$config" '[features]'
  assert_contains "$config" 'goals = true'
  assert_contains "$config" '[model_providers.other]'
  assert_contains "$config" 'base_url = "https://other.example/v1"'
  assert_contains "$config" '[model_providers.custom]'
  assert_contains "$config" 'name = "KeejiAI"'
  assert_not_contains "$config" 'https://old.example/v1'
  assert_not_contains "$config" 'name = "Old"'
}

test_invalid_key_does_not_install_or_write_config() {
  tmp="$TEST_TMP_ROOT/invalid"
  mkdir -p "$tmp/home" "$tmp/bin"

  FAKE_CURL_LOG="$tmp/curl.log"
  FAKE_NPM_LOG="$tmp/npm.log"
  export FAKE_CURL_LOG FAKE_NPM_LOG
  make_fake_bin "$tmp/bin" 401

  if HOME="$tmp/home" \
    PATH="$tmp/bin:/bin:/usr/bin" \
    KEEJIAI_API_KEY='bad-token' \
      sh "$INSTALL_SCRIPT" > "$tmp/out.log" 2> "$tmp/err.log"; then
    fail "installer should fail for invalid keys"
  fi

  [ ! -s "$FAKE_NPM_LOG" ] || fail "npm should not be called for invalid keys"
  [ ! -e "$tmp/home/.codex/config.toml" ] || fail "config.toml should not be written for invalid keys"
  [ ! -e "$tmp/home/.codex/auth.json" ] || fail "auth.json should not be written for invalid keys"
  assert_contains "$tmp/err.log" "令牌密钥校验失败"
}

test_valid_key_installs_codex_and_writes_config
test_valid_key_updates_existing_config_without_installing
test_invalid_key_does_not_install_or_write_config

printf 'codex install script tests passed\n'
