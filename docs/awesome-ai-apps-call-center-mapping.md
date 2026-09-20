# awesome-ai-apps → Loop9 AI Call Center mapping

**Source cookbook:** [Arindam200/awesome-ai-apps](https://github.com/Arindam200/awesome-ai-apps) (~132 demos).  
**Approach:** borrow **patterns**, do **not** replace Twilio Media Streams / SIP with Pipecat or LiveKit transports.

| # | Cookbook project | Category | Loop9 integration surface | What we take |
|---|------------------|----------|---------------------------|--------------|
| 1 | [Healthcare Voice Contact Center](https://github.com/Arindam200/awesome-ai-apps/tree/main/voice_agents/healthcare_contact_center) | Voice | [`bedrock-agent-factory.ts`](../server/engines/twilio-bedrock-polly/services/bedrock-agent-factory.ts) appointment + transfer tools; Bedrock bridge fillers | Booking + FAQ + **supervisor escalation** behavior |
| 2 | [Customer Support Voice Agent (LiveKit)](https://github.com/Arindam200/awesome-ai-apps/tree/main/voice_agents/customer_support_agent) | Voice | [`supervisor.ts`](../server/services/agent-orchestration/supervisor.ts) + `transfer_to_agent` | Context-preserving **manager handoff**, inactivity handling ideas |
| 3 | [Documentation Q&A MCP Agent](https://github.com/Arindam200/awesome-ai-apps/tree/main/mcp_ai_agents/docs_qna_agent) | MCP | [`mcp-tool-adapter.ts`](../server/services/agent-orchestration/mcp-tool-adapter.ts) → `ToolRegistry` / `AgentTool` | Mid-call tools via MCP without rewriting bridges |
| 4 | [Documentation RAG MCP Server](https://github.com/Arindam200/awesome-ai-apps/tree/main/mcp_ai_agents/doc_mcp) | MCP | Same MCP adapter + KB tools | Docs as remote tool server |
| 5 | [Agentic RAG with Agno](https://github.com/Arindam200/awesome-ai-apps/tree/main/rag_apps/agentic_rag) | RAG | [`rag-knowledge.ts`](../server/services/rag-knowledge.ts) `enhancedSearch` / voice rerank flag | Hybrid retrieve + optional semantic rerank |
| 6 | [Agentic Typed RAG (LlamaIndex)](https://github.com/Arindam200/awesome-ai-apps/tree/main/rag_apps/agentic_typed_rag_llamaindex) | RAG | `lookup_knowledge_base` low-confidence nextAction | Citation / weak-evidence refusal patterns |
| 7 | [Customer Support Voice Agent (Memori)](https://github.com/Arindam200/awesome-ai-apps/tree/main/memory_agents/customer_support_voice_agent) | Memory | `conversation-memory` / resumption services | Cross-call facts (extend later) |
| 8 | [Persistent Memory Agent (Agno)](https://github.com/Arindam200/awesome-ai-apps/tree/main/memory_agents/agno_memory_agent) | Memory | Same | Session stickiness patterns |

## Feature flags (this worktree)

| Flag | Default | Effect |
|------|---------|--------|
| `LOOP9_MCP_SERVERS` | unset | JSON array of `{ id, url, headers?, allowTools? }` — registers MCP tools on Bedrock configs |
| `LOOP9_CALL_SUPERVISOR` | `false` | Enable live specialist routing on Bedrock Polly turns |
| `RAG_SEARCH_SEMANTIC_RERANK` | `false` | After hybrid search, run `semanticRerank` on `searchKnowledge` |
| `QA_FEEDBACK_LOOP_ENABLED` | `false` | After QA analysis, enqueue human-reviewed improvement proposals |

## Explicit non-goals

- Do not port Pipecat/LiveKit as the production media plane.
- Do not claim cookbook demos satisfy GCC telecom/AML obligations.
- Do not auto-apply prompt/KB changes without human review (`ReviewQueueSink`).
