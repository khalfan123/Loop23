'use strict';
/**
 * ============================================================
 * Conversation States Compiler
 * 
 * Converts flow builder nodes to OpenAI's Conversation States format
 * Following: https://platform.openai.com/docs/guides/voice-agents
 * ============================================================
 */

import type {
  FlowNode,
  FlowEdge,
  ConversationState,
  ConversationTransition,
  CompiledConversationStates,
  AgentCompilationConfig,
} from './types';

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  nl: 'Dutch',
  pl: 'Polish',
  ru: 'Russian',
  ja: 'Japanese',
  ko: 'Korean',
  zh: 'Chinese',
  ar: 'Arabic',
  hi: 'Hindi',
  tr: 'Turkish',
  vi: 'Vietnamese',
  th: 'Thai',
  id: 'Indonesian',
  ms: 'Malay',
  fil: 'Filipino',
  sv: 'Swedish',
  da: 'Danish',
  no: 'Norwegian',
  fi: 'Finnish',
  cs: 'Czech',
  sk: 'Slovak',
  hu: 'Hungarian',
  ro: 'Romanian',
  bg: 'Bulgarian',
  uk: 'Ukrainian',
  he: 'Hebrew',
  bn: 'Bengali',
  ta: 'Tamil',
  te: 'Telugu',
};

export class ConversationStatesCompiler {
  /**
   * Get the actual node type from node.data.type or node.data.config.type
   * Flow builder uses type: "custom" at top level, real type is in data
   */
  private static getNodeType(node: FlowNode): string {
    const data = node.data || {};
    // Check data.type first, then data.config.type, then fall back to node.type
    return (data.type as string) || (data.config as any)?.type || node.type || 'unknown';
  }

  /**
   * Get node content (message, question, etc.) from the correct location
   * Content can be in node.data.message, node.data.config.message, etc.
   */
  private static getNodeContent(node: FlowNode, field: string): string {
    const data = node.data || {};
    const config = (data.config as any) || {};
    // Check config first (more specific), then data directly
    return config[field] || (data as any)[field] || '';
  }

  /**
   * Get node label for description
   */
  private static getNodeLabel(node: FlowNode): string {
    const data = node.data || {};
    return (data.label as string) || (data.config as any)?.label || '';
  }

  /**
   * Compile flow nodes to OpenAI Conversation States format
   */
  static compile(
    nodes: FlowNode[],
    edges: FlowEdge[],
    config: AgentCompilationConfig
  ): CompiledConversationStates {
    const languageName = LANGUAGE_NAMES[config.language] || 'English';
    
    // Build adjacency map for transitions
    const adjacencyMap = this.buildAdjacencyMap(edges);
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    
    // Find start node - first node in the list or one with 'start' type
    const startNode = nodes.find(n => this.getNodeType(n) === 'start') || nodes[0];
    
    // Convert nodes to conversation states
    const states: ConversationState[] = [];
    const visited = new Set<string>();
    
    // Process nodes in order starting from start
    if (startNode) {
      this.processNodeChain(startNode.id, nodeMap, adjacencyMap, states, visited);
    }
    
    // Get first message from start node
    let firstMessage: string | undefined;
    if (startNode) {
      const message = this.getNodeContent(startNode, 'message');
      if (message) {
        firstMessage = this.substituteVariables(message);
      }
    }
    
    // Build system prompt header
    const systemPromptHeader = this.buildSystemPromptHeader(config, languageName);
    
    console.log(`[ConversationStatesCompiler] Compiled ${states.length} states from ${nodes.length} nodes`);
    
    return {
      states,
      systemPromptHeader,
      firstMessage,
    };
  }

  /**
   * Build full system prompt with Conversation States JSON
   */
  static buildSystemPrompt(compiled: CompiledConversationStates): string {
    const statesJson = JSON.stringify(compiled.states, null, 2);
    
    return `${compiled.systemPromptHeader}

# Conversation States
${statesJson}

# Instructions
- Follow the conversation states in order, respecting the transitions and conditions.
- When asking for information (name, phone, address, etc.), always repeat it back to verify.
- If the caller corrects any detail, acknowledge the correction and confirm the new value.
- Stay in character and maintain the conversation flow as defined in the states.
- When a state instructs you to call a function/tool, you MUST call it.

# CRITICAL TOOL USAGE REQUIREMENTS
- FORM SUBMISSIONS: After collecting all required information from the caller, you MUST call the submit_form tool with the collected data. Do NOT just say you have saved the information - you MUST actually call the submit_form function to save it.
- ENDING CALLS: When the conversation is complete and you say goodbye, you MUST call the end_call function to disconnect the call. Do NOT just say goodbye and wait - you MUST call end_call to hang up the phone.
- TRANSFERS: When transferring to a human agent, you MUST call the transfer_call function. Do NOT just say you are transferring - actually call the function.
- APPOINTMENTS: When booking appointments, you MUST call the book_appointment function with all collected details.
- KNOWLEDGE BASE: When you need information to answer a question, use the lookup_knowledge_base or query_knowledge_base function.

Remember: Saying you will do something is NOT the same as actually calling the tool. You MUST call the appropriate function to perform any action.`;
  }

  /**
   * Process nodes recursively to build conversation states
   */
  private static processNodeChain(
    nodeId: string,
    nodeMap: Map<string, FlowNode>,
    adjacencyMap: Map<string, Array<{ targetId: string; condition?: string; label?: string }>>,
    states: ConversationState[],
    visited: Set<string>
  ): void {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    
    const node = nodeMap.get(nodeId);
    if (!node) return;
    
    // Convert node to conversation state
    const state = this.nodeToState(node, adjacencyMap, nodeMap);
    if (state) {
      states.push(state);
    }
    
    // Process connected nodes
    const targets = adjacencyMap.get(nodeId) || [];
    for (const target of targets) {
      this.processNodeChain(target.targetId, nodeMap, adjacencyMap, states, visited);
    }
  }

  /**
   * Convert a single flow node to a conversation state
   */
  private static nodeToState(
    node: FlowNode,
    adjacencyMap: Map<string, Array<{ targetId: string; condition?: string; label?: string }>>,
    nodeMap: Map<string, FlowNode>
  ): ConversationState | null {
    const nodeType = this.getNodeType(node);
    const targets = adjacencyMap.get(node.id) || [];
    
    // Build transitions with descriptive conditions
    const transitions: ConversationTransition[] = targets.map(t => {
      const targetNode = nodeMap.get(t.targetId);
      const targetType = targetNode ? this.getNodeType(targetNode) : 'next step';
      const targetLabel = targetNode ? this.getNodeLabel(targetNode) : '';
      
      return {
        next_step: t.targetId,
        condition: t.condition || t.label || `Once this step is complete, proceed to ${targetLabel || targetType}.`,
      };
    });

    const message = this.getNodeContent(node, 'message');
    const question = this.getNodeContent(node, 'question');
    const variableName = this.getNodeContent(node, 'variableName');
    const label = this.getNodeLabel(node);
    const config = (node.data?.config as any) || {};

    switch (nodeType) {
      case 'start':
        return {
          id: node.id,
          description: label || 'Start the conversation and greet the caller.',
          instructions: [
            message ? `Say: "${this.substituteVariables(message)}"` : 'Greet the caller warmly.',
          ],
          examples: message ? [this.substituteVariables(message)] : ['Hello! How can I help you today?'],
          transitions,
        };

      case 'message':
        return {
          id: node.id,
          description: label || 'Deliver a message to the caller.',
          instructions: [
            `Say: "${this.substituteVariables(message)}"`,
          ],
          examples: [this.substituteVariables(message)],
          transitions,
        };

      case 'question':
        const questionText = question || message;
        return {
          id: node.id,
          description: label || `Ask the caller: "${questionText}"`,
          instructions: [
            `Ask: "${this.substituteVariables(questionText)}"`,
            'Wait for the caller to respond.',
            variableName 
              ? `Store their response as "${variableName}" for later use.`
              : 'Remember their answer for the conversation.',
            'Confirm what you heard by repeating it back to them.',
          ],
          examples: [
            this.substituteVariables(questionText),
            variableName ? `So you said [their answer], is that correct?` : undefined,
          ].filter(Boolean) as string[],
          transitions,
        };

      case 'condition':
        const conditions = (config.conditions as Array<{ field: string; operator: string; value: string }>) || [];
        return {
          id: node.id,
          description: label || 'Evaluate conditions and route the conversation.',
          instructions: [
            ...conditions.map((c, i) => 
              `If ${c.field} ${c.operator} "${c.value}", proceed accordingly.`
            ),
            'Route the conversation based on the evaluation.',
          ],
          transitions,
        };

      case 'transfer':
        const transferNumber = config.phoneNumber || config.transferNumber || '';
        const transferMessage = message || config.transferMessage || '';
        return {
          id: node.id,
          description: label || 'Transfer the caller to a human agent.',
          instructions: [
            transferMessage 
              ? `Say: "${this.substituteVariables(transferMessage)}"` 
              : 'Inform the caller you are transferring them.',
            `Call the "transfer_call" function to transfer to ${transferNumber || 'the designated number'}.`,
          ],
          examples: [
            transferMessage || "I'll connect you with a specialist who can help you further. Please hold.",
          ],
          transitions,
        };

      case 'webhook':
      case 'api_call':
        const toolName = `webhook_${node.id.replace(/-/g, '_')}`;
        const webhookUrl = config.url || config.webhookUrl || '';
        const webhookDescription = config.description || label || 'execute the webhook';
        return {
          id: node.id,
          description: label || `Execute webhook to ${webhookDescription}.`,
          instructions: [
            message ? `Say: "${this.substituteVariables(message)}"` : undefined,
            `Call the "${toolName}" function to ${webhookDescription}.`,
            'Wait for the result and use it to continue the conversation.',
            'Inform the caller of the outcome.',
          ].filter(Boolean) as string[],
          examples: [
            'Processing your request now, please hold for a moment.',
            'Your request has been submitted successfully.',
          ],
          transitions,
        };

      case 'end_call':
      case 'end':
        return {
          id: node.id,
          description: label || 'End the conversation politely.',
          instructions: [
            message 
              ? `Say: "${this.substituteVariables(message)}"` 
              : 'Thank the caller and say goodbye.',
            'Call the "end_call" function to end the call.',
          ],
          examples: [
            message || 'Thank you for calling. Have a great day!',
          ],
          transitions: [],
        };

      case 'delay':
        const duration = config.duration || node.data?.duration || 1;
        return {
          id: node.id,
          description: label || 'Pause briefly.',
          instructions: [
            `Wait for ${duration} seconds.`,
            message ? `Then say: "${this.substituteVariables(message)}"` : undefined,
          ].filter(Boolean) as string[],
          transitions,
        };

      case 'tool':
        const toolCallName = config.toolName || node.data?.toolName || 'tool';
        return {
          id: node.id,
          description: label || `Use the ${toolCallName} tool.`,
          instructions: [
            `Call the "${toolCallName}" function.`,
            'Use the result to help the caller.',
          ],
          transitions,
        };

      case 'play_audio':
        const audioFileName = config.audioFileName || 'audio file';
        const playAudioToolName = `play_audio_${node.id.replace(/-/g, '_').slice(-8)}`;
        return {
          id: node.id,
          description: label || `Play the audio file "${audioFileName}".`,
          instructions: [
            message ? `Say: "${this.substituteVariables(message)}"` : undefined,
            `Call the "${playAudioToolName}" function to play the audio.`,
            config.waitForComplete !== false 
              ? 'Wait for the audio to finish playing before continuing.' 
              : 'Continue the conversation while the audio plays.',
          ].filter(Boolean) as string[],
          examples: [
            'Let me play that for you now.',
            'Here is the audio you requested.',
          ],
          transitions,
        };

      default:
        // For unknown types, still create a state if there's content
        if (message) {
          console.log(`[ConversationStatesCompiler] Unknown node type "${nodeType}", creating generic state`);
          return {
            id: node.id,
            description: label || 'Continue the conversation.',
            instructions: [`Say: "${this.substituteVariables(message)}"`],
            examples: [this.substituteVariables(message)],
            transitions,
          };
        }
        console.log(`[ConversationStatesCompiler] Skipping node "${node.id}" with unknown type "${nodeType}"`);
        return null;
    }
  }

  /**
   * Build adjacency map from edges
   */
  private static buildAdjacencyMap(
    edges: FlowEdge[]
  ): Map<string, Array<{ targetId: string; condition?: string; label?: string }>> {
    const map = new Map<string, Array<{ targetId: string; condition?: string; label?: string }>>();
    
    for (const edge of edges) {
      const targets = map.get(edge.source) || [];
      targets.push({
        targetId: edge.target,
        condition: edge.condition,
        label: edge.label,
      });
      map.set(edge.source, targets);
    }
    
    return map;
  }

  /**
   * Build system prompt header with personality and language
   */
  private static buildSystemPromptHeader(
    config: AgentCompilationConfig,
    languageName: string
  ): string {
    const parts: string[] = [];
    
    if (config.language !== 'en') {
      parts.push(`# CRITICAL LANGUAGE REQUIREMENT
You MUST speak ONLY in ${languageName}. From the very first word you say, speak in ${languageName}. Do NOT speak English. This is mandatory.
`);
    }
    
    parts.push(`# Personality and Tone
## Identity
${config.agentName ? `You are ${config.agentName}.` : 'You are an AI voice assistant.'} ${config.agentPersonality || 'You are helpful, professional, and friendly.'}

## Task
Follow the conversation flow defined below. Guide the caller through each step while maintaining a natural conversational style. You MUST follow the states in order and call the specified functions when instructed.

## Demeanor
Professional yet warm and approachable.

## Tone
Conversational and clear.

## Level of Formality
Professional but not stiff.

## Pacing
Speak at a natural pace, pausing when appropriate to let the caller respond.`);

    parts.push(`
# Human-Like Conversation Behaviors

## Active Listening
When the caller shares information, acknowledge it naturally before responding:
- Use brief acknowledgments: "I understand", "Got it", "That makes sense", "I see"
- Reference what they just said: "So you're looking for..." or "Right, so the issue is..."
- Mirror key words back to show you're paying attention

## Thinking Indicators
Before looking up information or processing a request, use natural transitions:
- "Let me look into that for you..."
- "One moment while I check on that..."
- "Let me pull up that information..."
- "Good question — let me find the best answer for you..."
Never stay silent — always signal what you're doing.

## Empathy and Emotional Intelligence
Detect the caller's emotional state from their words and tone, then respond appropriately:
- Frustration: "I completely understand your frustration, and I want to help resolve this."
- Confusion: "No worries at all — let me explain that more clearly."
- Urgency: "I hear you — let's get this sorted out right away."
- Satisfaction: "I'm glad to hear that! Is there anything else I can help with?"
- Hesitation: "Take your time — there's no rush."

## Clarification Over Guessing
When the caller's request is ambiguous or unclear:
- Ask a specific clarifying question rather than guessing
- "Just to make sure I help you correctly — did you mean X or Y?"
- "Could you tell me a bit more about what you're looking for?"
- Never fabricate or assume details the caller hasn't provided

## Conversational Memory
Throughout the call, remember and reference earlier parts of the conversation:
- "As you mentioned earlier about..."
- "Going back to your question about..."
- "Since you're interested in [earlier topic], you might also want to know..."
This creates continuity and makes the conversation feel connected, not transactional.

## Personality Consistency
Maintain the same speaking style throughout the entire call:
- Keep a consistent level of formality
- Use the same vocabulary range (don't suddenly shift from casual to technical)
- Stay in character even when handling difficult questions or edge cases

## Natural Phrasing
Avoid robotic patterns. Instead of repeating the same structure:
- Vary your sentence openings
- Use contractions naturally (I'm, we're, that's, you'll)
- Include filler words sparingly and naturally (well, actually, so)
- Avoid listing more than 3 items without pausing or summarizing`);

    return parts.join('\n');
  }

  /**
   * Substitute variables in text (e.g., {{name}} -> caller's name)
   */
  private static substituteVariables(text: string): string {
    // Keep variable placeholders for runtime substitution
    return text;
  }
}
