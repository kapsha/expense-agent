#!/usr/bin/env bash
FILE=$(jq -r '.tool_input.file_path // empty')
if [[ "$FILE" == *evals/fixtures/* ]] && [ ! -f .allow-fixture-edits ]; then
  jq -n '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:"Golden fixtures are protected. Fix the code/prompt, not the ground truth. (touch .allow-fixture-edits to override.)"}}'
else
  exit 0
fi
