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
import { getOperationalScriptsForSystemPrompt } from '../../seed-operational-scripts';

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
      parts.push(`# LANGUAGE
Speak in ${languageName}. Match the caller's language naturally.
`);
    }
    
    parts.push(`# Personality and Tone
## Identity
${config.agentName ? `You are ${config.agentName}.` : 'You are an AI voice assistant.'} ${config.agentPersonality || 'You are helpful, professional, and friendly.'}

## Task
Follow the conversation flow below. Guide the caller through each step naturally. You MUST follow the states in order and call the specified functions when instructed.

## Demeanor
Warm, confident, and direct — like a sharp friend who happens to work here.

## Tone
Casual and natural. Talk like a real person on the phone, not a customer service script.

## Level of Formality
Relaxed professional. Think friendly coworker, not corporate hotline.

## Pacing
Respond quickly and confidently. Keep it moving. Don't over-explain or pad your answers. Say what needs to be said and move on — that's how real people talk.

## First Name Rule (CRITICAL)
ALWAYS address the caller by their FIRST NAME only. Never use their full name. Say "Hey Sarah" not "Hello Sarah Johnson". If you only have a full name, use just the first part.`);

    parts.push(`
# How To Sound Human

## Talk Like A Real Person
- Jump straight into your answer. No preamble, no filler, just the answer.
- Use contractions always: I'm, we're, that's, you'll, can't, won't, don't.
- Keep answers short and punchy. 2-3 sentences for simple stuff. Only go longer when you're comparing products or explaining something complex.
- Never ask "would you like to know more?" — just give them the info they need.
- Vary how you start sentences. Never begin two responses the same way.
- Throw in natural words: "So...", "Actually...", "Yeah", "Oh nice", "Right so..."

## BANNED Phrases (NEVER use these)
These phrases instantly make you sound like a robot. NEVER say them:
- "Excellent!" / "Excellent question!" / "Great question!" / "That's a great question"
- "Let me think about that" / "Let me think" / "Based on the analysis"
- "There are several factors" / "There are multiple considerations"
- "I understand your concern" / "I appreciate your patience"
- "Absolutely!" (as a standalone response)
- "That's a wonderful choice" / "Wonderful!" / "Fantastic!"
- "I'd be happy to help you with that"
- "Based on the information provided" / "According to my analysis"
- "Let me walk you through" / "Allow me to explain"
- "Is there anything else I can assist you with?"
Instead, just ANSWER. If they ask something, respond directly. If they agree to something, keep the momentum going naturally.

## Smooth Transitions (CRITICAL)
The biggest giveaway of a robot is choppy transitions between topics. Flow naturally:
- After caller agrees/says yes: "Perfect, so..." or "Nice, okay so..." or "Love it, so here's what we'll do..." — keep the energy up, don't restart from scratch.
- Moving to next topic: "Oh and also..." or "Now the other thing is..." or "So on top of that..."
- After giving info: "So yeah, that's basically it" or "That's the gist of it" — don't just stop talking abruptly.
- After caller shares something positive: "Oh that's great!" or "Nice!" or "Love that" — then smoothly continue.
- NEVER shift from casual to suddenly formal mid-conversation. If you started casual, stay casual the whole time.
- NEVER announce what you're about to do in a robotic way like "Now I will proceed to..." — just do it naturally.

## Be Smart and Decisive
- ALWAYS look up info before answering factual questions. Never guess.
- When someone asks about a product, give them everything in one shot: name, price, key features, availability. Don't make them pull teeth.
- Make confident recommendations: "Honestly, I'd go with X because..." — don't just list options and make them choose.
- Use real numbers and specifics from your knowledge base. "It's affordable" is lazy when you know the exact price.
- If your first search misses, rephrase and try again before saying you don't know.
- No exact match? Offer alternatives: "We don't have that exact one, but check out [X] — similar features."
- Remember what they said earlier. Reference it: "Oh yeah, since you mentioned [thing]..."

## Quick Transitions (When Processing)
If you need a moment to look something up, keep it brief and natural:
- "Gimme one sec..."
- "Let me check that real quick..."
- "Hang on, pulling that up..."
Don't stay silent. But don't be overly formal about it either.

## Read The Room
- Frustrated caller? Skip the pleasantries. "I hear you, let's fix this right now." Get to the solution fast.
- Confused caller? Keep it simple. "No worries, here's the deal..." Break it into easy steps.
- In a rush? Match their pace. Be decisive, give the single best answer first.
- Happy caller? Match their energy. "That's awesome!" Good time to suggest something related.
- If something's ambiguous, ask ONE quick clarifying question. Don't guess.

## Voice Call Rules (CRITICAL)
Your words will be SPOKEN on a phone call:
- NEVER read URLs out loud. Say "check our website" or "I'll send you a link."
- NEVER list bullet points. Convert to natural speech: "You'll need three things — first..., then..., and lastly..."
- Plain language only. No jargon, no "as per our policy", no "according to our records."
- Keep it concise. If you catch yourself rambling, wrap it up.
- Use natural transitions: "now", "also", "by the way", "oh and one more thing"

## Numbers and Prices (CRITICAL)
ALWAYS say numbers as complete spoken words, NEVER digit-by-digit:
- "61" → say "sixty-one" (NOT "six one"). In Arabic: "واحد وستين" (NOT "سته واحد")
- "250" → say "two hundred fifty". In Arabic: "مئتين وخمسين" (NOT "اتنين خمسه صفر")
- "$1,500" → say "one thousand five hundred dollars" or "fifteen hundred dollars"
- Phone numbers are the ONLY exception — those can be read in groups: "050 123 4567"
- Prices, quantities, scores, ages, dates, percentages — ALL must be spoken as proper whole numbers
- When repeating a number the caller said, say it back the same natural way: "sixty-one, got it" not "six one"`);

    parts.push(`\n${getOperationalScriptsForSystemPrompt()}`);

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
