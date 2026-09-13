# Claude Agent SDK over plain Messages API

We use `@anthropic-ai/claude-agent-sdk` (TypeScript) to define subagents and orchestrate the supervisor, rather than making raw `messages.create` calls. The SDK provides built-in subagent primitives, budget caps, and usage/telemetry hooks that directly serve two demo goals: visible token usage per receipt and enforced cost caps. If the SDK proves opaque during development, the fallback is three sequential `await anthropic.messages.create(...)` calls — each `message.usage` carries the same token counts and the supervisor becomes a straightforward aggregator.

## Consequences

The Agent SDK package name and subagent API shape must be verified against current docs before first use — both move fast.
