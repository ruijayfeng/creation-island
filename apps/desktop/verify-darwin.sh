#!/bin/bash
# 验收 macOS Apple Silicon 便携包：冒烟就绪、退出清进程、单实例、原生模块。
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "需要在 macOS 上运行" >&2
  exit 1
fi
if [[ "$(uname -m)" != "arm64" ]]; then
  echo "本预览验收针对 Apple Silicon Mac（arm64）" >&2
  exit 1
fi

BUILD_DIRECTORY="${1:-}"
if [[ -z "$BUILD_DIRECTORY" ]]; then
  BUILD_DIRECTORY="$(cat "$(dirname "$0")/../../dist/desktop-darwin-latest.txt")"
fi
BUILD_DIRECTORY="$(cd "$BUILD_DIRECTORY" && pwd)"
APP_ROOT="$BUILD_DIRECTORY/app"
LAUNCHER="$APP_ROOT/Creation Island.app/Contents/MacOS/creation-island"
NODE="$APP_ROOT/runtime/node"

if [[ ! -x "$LAUNCHER" ]]; then
  echo "找不到启动器：$LAUNCHER" >&2
  exit 1
fi

DATA_HOME="$(mktemp -d /tmp/agent-isles-isolated-data.XXXXXX)"
export AGENT_ISLES_DATA_HOME="$DATA_HOME"
echo "Isolated data: $DATA_HOME"

"$LAUNCHER" --smoke-test &
PID=$!
DEADLINE=$((SECONDS + 110))
while [[ ! -f "$DATA_HOME/smoke-ok.txt" ]]; do
  if ! kill -0 "$PID" 2>/dev/null; then
    wait "$PID" || true
    echo "Launcher exited before smoke-ok; see $DATA_HOME/launcher.log" >&2
    exit 1
  fi
  if (( SECONDS > DEADLINE )); then
    kill "$PID" 2>/dev/null || true
    echo "Launcher timed out" >&2
    exit 1
  fi
  sleep 0.2
done
wait "$PID" || true
if [[ ! -f "$DATA_HOME/smoke-ok.txt" ]]; then
  echo "smoke-ok missing" >&2
  exit 1
fi

URL="$(tr -d '\r' < "$DATA_HOME/browser-url.txt")"
PORT="$(python3 - <<PY
from urllib.parse import urlparse
print(urlparse("""$URL""").port)
PY
)"
sleep 0.5
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Service survived launcher exit on port $PORT" >&2
  exit 1
fi

(
  cd "$APP_ROOT"
  "$NODE" -e "for (const name of ['fs-ext','koffi','node-pty']) { require(name); console.log(name + ' loaded') }"
)

HOLD_HOME="$(mktemp -d /tmp/agent-isles-instance-data.XXXXXX)"
export AGENT_ISLES_DATA_HOME="$HOLD_HOME"
"$LAUNCHER" --smoke-test --smoke-hold &
FIRST=$!
trap 'kill -TERM "$FIRST" 2>/dev/null || true' EXIT
DEADLINE=$((SECONDS + 95))
while [[ ! -f "$HOLD_HOME/smoke-ok.txt" ]]; do
  if ! kill -0 "$FIRST" 2>/dev/null; then
    echo "Held startup failed" >&2
    exit 1
  fi
  if (( SECONDS > DEADLINE )); then
    echo "Held startup timed out" >&2
    kill "$FIRST" 2>/dev/null || true
    exit 1
  fi
  sleep 0.2
done

"$LAUNCHER" --smoke-test
SECOND_STATUS=$?
if [[ "$SECOND_STATUS" -ne 0 ]]; then
  echo "Single instance handoff failed (exit $SECOND_STATUS)" >&2
  kill "$FIRST" 2>/dev/null || true
  exit 1
fi
if ! kill -0 "$FIRST" 2>/dev/null; then
  echo "First instance died during single-instance test" >&2
  exit 1
fi
HELD_URL="$(tr -d '\r' < "$HOLD_HOME/browser-url.txt")"
HELD_PORT="$(python3 - <<PY
from urllib.parse import urlparse
print(urlparse("""$HELD_URL""").port)
PY
)"
# Exercise the actual packaged service without developer libraries or model credentials.
"$NODE" --input-type=module - "$HOLD_HOME/browser-url.txt" <<'JS'
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const origin=new URL(readFileSync(process.argv[2],'utf8')).origin;
async function api(p){const r=await fetch(origin+'/creation/api',{method:'POST',headers:{origin,'content-type':'application/json','x-creation-island':'1'},body:JSON.stringify({requestId:randomUUID(),...p})});assert.equal(r.status,200);return r.json()}
for(const kind of ['quiz','card','story']){
 let w=await api({op:'create',kind,en:false});w=await api({op:'save',id:w.id,expectedRevision:w.revision});
 const v=w.versions[0];const pack=await api({op:'export',id:w.id,versionId:v.id,format:'json'});
 const imported=await api({op:'import',pack:JSON.parse(pack.body)});assert.notEqual(imported.id,w.id);assert.deepEqual(imported.draft,w.draft);
 const html=await api({op:'export',id:w.id,versionId:v.id,format:'html'});assert.match(html.body,/connect-src 'none'/);assert.doesNotMatch(html.body,/src="https?:/);
 const edited=structuredClone(w.draft);edited.title+=' check';w=await api({op:'edit',id:w.id,expectedRevision:w.revision,data:edited});w=await api({op:'restore',id:w.id,expectedRevision:w.revision,versionId:v.id});assert.equal(w.draft.title,v.data.title);
 console.log(kind+' packaged create/save/export/import/restore passed');
}
JS
# SIGTERM must reach the Swift launcher so it can reap the Node process group.
kill -TERM "$FIRST" 2>/dev/null || true
wait "$FIRST" 2>/dev/null || true
# Allow process-group cleanup to finish (mirrors Windows Job Object close latency).
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if ! lsof -nP -iTCP:"$HELD_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    break
  fi
  sleep 0.3
done
if lsof -nP -iTCP:"$HELD_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Service survived launcher termination on port $HELD_PORT" >&2
  # Best-effort mop for local diagnosis; still fail the gate.
  # Never terminate other application instances by a shared process name.
  exit 1
fi

echo "PASS: smoke ready, exit cleanup, single instance, native modules, three work flows"
