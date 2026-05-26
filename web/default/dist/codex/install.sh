#!/bin/sh
set -eu
umask 077

API_BASE_URL=${KEEJIAI_API_BASE_URL:-https://api.keejiai.com/v1}
PROVIDER_ID=${KEEJIAI_CODEX_PROVIDER_ID:-custom}
PROVIDER_NAME=${KEEJIAI_CODEX_PROVIDER_NAME:-KeejiAI}
CODEX_MODEL=${KEEJIAI_CODEX_MODEL:-gpt-5.5}
REASONING_EFFORT=${KEEJIAI_CODEX_REASONING_EFFORT:-xhigh}
WIRE_API=${KEEJIAI_CODEX_WIRE_API:-responses}

if [ -z "${CODEX_HOME:-}" ]; then
  if [ -z "${HOME:-}" ]; then
    printf '错误：未检测到 HOME，无法定位 Codex 配置目录。\n' >&2
    exit 1
  fi
  CODEX_HOME="$HOME/.codex"
fi

CONFIG_FILE="$CODEX_HOME/config.toml"
AUTH_FILE="$CODEX_HOME/auth.json"
API_KEY=""
CLEANUP_FILES=""

cleanup() {
  if [ -n "$CLEANUP_FILES" ]; then
    rm -f $CLEANUP_FILES
  fi
}
trap cleanup EXIT HUP INT TERM

info() {
  printf '%s\n' "$*" >&2
}

die() {
  printf '错误：%s\n' "$*" >&2
  exit 1
}

validate_provider_id() {
  case "$PROVIDER_ID" in
    ''|*[!A-Za-z0-9_-]*)
      die "Provider ID 只能包含字母、数字、下划线或中划线：$PROVIDER_ID"
      ;;
  esac
}

trim() {
  printf '%s' "$1" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
}

toml_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g;s/"/\\"/g'
}

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g;s/"/\\"/g'
}

prompt_for_key() {
  if [ -n "${KEEJIAI_API_KEY:-}" ]; then
    API_KEY=$KEEJIAI_API_KEY
  elif [ -r /dev/tty ]; then
    printf '请输入 KeejiAI 令牌密钥: ' > /dev/tty
    stty_state=$(stty -g < /dev/tty 2>/dev/null || printf '')
    if [ -n "$stty_state" ]; then
      stty -echo < /dev/tty 2>/dev/null || true
    fi
    IFS= read -r API_KEY < /dev/tty || API_KEY=""
    if [ -n "$stty_state" ]; then
      stty "$stty_state" < /dev/tty 2>/dev/null || true
    fi
    printf '\n' > /dev/tty
  else
    die "无法读取终端输入。请使用：KEEJIAI_API_KEY=你的令牌 sh install.sh"
  fi

  API_KEY=$(trim "$API_KEY")
  if [ -z "$API_KEY" ]; then
    die "令牌密钥不能为空"
  fi
}

validate_key() {
  if ! command -v curl >/dev/null 2>&1; then
    die "需要 curl 来校验令牌密钥"
  fi

  body_file=$(mktemp "${TMPDIR:-/tmp}/keejiai-codex-body.XXXXXX")
  err_file=$(mktemp "${TMPDIR:-/tmp}/keejiai-codex-curl.XXXXXX")
  CLEANUP_FILES="$CLEANUP_FILES $body_file $err_file"
  models_url="${API_BASE_URL%/}/models"

  if ! http_code=$(curl -sS -L \
    -o "$body_file" \
    -w '%{http_code}' \
    -H "Authorization: Bearer $API_KEY" \
    -H 'Accept: application/json' \
    "$models_url" 2> "$err_file"); then
    message=$(sed -n '1p' "$err_file")
    die "令牌密钥校验失败：无法连接 KeejiAI API。$message"
  fi

  case "$http_code" in
    2??)
      info "令牌密钥校验通过。"
      ;;
    401|403)
      die "令牌密钥校验失败：请确认令牌是否正确或仍有效。"
      ;;
    *)
      die "令牌密钥校验失败：KeejiAI API 返回 HTTP $http_code。"
      ;;
  esac
}

ensure_codex() {
  if command -v codex >/dev/null 2>&1; then
    info "已检测到 Codex。"
    return
  fi

  if ! command -v npm >/dev/null 2>&1; then
    die "未检测到 Codex，且系统没有 npm，无法自动安装 @openai/codex"
  fi

  info "未检测到 Codex，正在执行 npm i -g @openai/codex ..."
  npm i -g @openai/codex
}

backup_file() {
  file=$1
  if [ -f "$file" ]; then
    cp "$file" "$file.bak.$(date +%Y%m%d%H%M%S)"
  fi
}

write_auth_json() {
  mkdir -p "$CODEX_HOME"
  backup_file "$AUTH_FILE"

  if command -v node >/dev/null 2>&1; then
    AUTH_FILE="$AUTH_FILE" API_KEY="$API_KEY" node <<'NODE'
const fs = require('fs');
const authFile = process.env.AUTH_FILE;
const apiKey = process.env.API_KEY || '';

let auth = {};
try {
  if (fs.existsSync(authFile)) {
    auth = JSON.parse(fs.readFileSync(authFile, 'utf8'));
  }
} catch (_) {
  auth = {};
}

auth.OPENAI_API_KEY = apiKey;
fs.writeFileSync(authFile, `${JSON.stringify(auth, null, 2)}\n`, { mode: 0o600 });
NODE
  else
    auth_tmp=$(mktemp "${TMPDIR:-/tmp}/keejiai-codex-auth.XXXXXX")
    CLEANUP_FILES="$CLEANUP_FILES $auth_tmp"
    escaped_key=$(json_escape "$API_KEY")
    {
      printf '{\n'
      printf '  "OPENAI_API_KEY": "%s"\n' "$escaped_key"
      printf '}\n'
    } > "$auth_tmp"
    mv "$auth_tmp" "$AUTH_FILE"
  fi

  chmod 600 "$AUTH_FILE" 2>/dev/null || true
}

write_config_toml() {
  mkdir -p "$CODEX_HOME"
  backup_file "$CONFIG_FILE"

  config_tmp=$(mktemp "${TMPDIR:-/tmp}/keejiai-codex-config.XXXXXX")
  CLEANUP_FILES="$CLEANUP_FILES $config_tmp"

  escaped_model=$(toml_escape "$CODEX_MODEL")
  escaped_provider_name=$(toml_escape "$PROVIDER_NAME")
  escaped_base_url=$(toml_escape "$API_BASE_URL")
  escaped_reasoning_effort=$(toml_escape "$REASONING_EFFORT")
  escaped_wire_api=$(toml_escape "$WIRE_API")

  {
    printf 'model = "%s"\n' "$escaped_model"
    printf 'model_provider = "%s"\n' "$PROVIDER_ID"
    printf 'model_reasoning_effort = "%s"\n' "$escaped_reasoning_effort"
    printf '\n'

    if [ -f "$CONFIG_FILE" ]; then
      awk -v provider="$PROVIDER_ID" '
        function parse_section(line, section) {
          section = line
          sub(/^[[:space:]]*\[/, "", section)
          sub(/\][[:space:]]*$/, "", section)
          gsub(/^[[:space:]]+|[[:space:]]+$/, "", section)
          return section
        }

        function is_target_provider(section) {
          return section == "model_providers." provider || index(section, "model_providers." provider ".") == 1
        }

        /^[[:space:]]*\[[^]]+\][[:space:]]*$/ {
          current_section = parse_section($0)
          skip = is_target_provider(current_section)
        }

        skip {
          next
        }

        current_section == "" && /^[[:space:]]*(model|model_provider|model_reasoning_effort)[[:space:]]*=/ {
          next
        }

        {
          print
        }
      ' "$CONFIG_FILE"
    fi

    printf '\n[model_providers.%s]\n' "$PROVIDER_ID"
    printf 'base_url = "%s"\n' "$escaped_base_url"
    printf 'name = "%s"\n' "$escaped_provider_name"
    printf 'wire_api = "%s"\n' "$escaped_wire_api"
  } > "$config_tmp"

  mv "$config_tmp" "$CONFIG_FILE"
  chmod 600 "$CONFIG_FILE" 2>/dev/null || true
}

main() {
  validate_provider_id
  prompt_for_key
  validate_key
  ensure_codex
  write_auth_json
  write_config_toml

  info "Codex 已配置为 KeejiAI：$API_BASE_URL"
  info "配置文件：$CONFIG_FILE"
}

main "$@"
