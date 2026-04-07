import { getOpenAIClient } from '../openai-modelfarm';
import type { CallScenario, ConversationTurn } from './scenarios';
import { ALL_SCENARIOS, getScenariosByCategory } from './scenarios';
import { generateSimulatedRetellResult } from './retell-baseline';
import { evaluateWithLLMJudge, type LLMJudgeResult } from './llm-evaluator';
import { generateComparisonReport, type ComparisonReport, type ReportOptions } from './report-generator';

export interface ScenarioResult {
  scenarioId: string;
  scenarioName: string;
  category: string;
  difficulty: string;
  provider: 'diploy' | 'retell';
  latencyMs: number;
  turnsToCompletion: number;
  taskCompleted: boolean;
  toolCallsSucceeded: boolean;
  coherenceScore: number;
  responseQuality: number;
  naturalness: number;
  interruptionHandling: number;
  errorRecovery: boolean;
  wordErrorRate: number;
  responses: string[];
  toolCallsMade: string[];
  totalTokensUsed: number;
  errors: string[];
}

export interface BenchmarkConfig {
  categories?: ('customer_support' | 'appointment_booking' | 'lead_qualification')[];
  scenarioIds?: string[];
  model?: string;
  maxConcurrent?: number;
  includeRetellBaseline?: boolean;
  includeLLMJudge?: boolean;
}

interface ToolCallDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, { type: string; description: string }>;
      required: string[];
    };
  };
}

export class BenchmarkEngine {
  private results: ScenarioResult[] = [];
  private isRunning = false;

  async runBenchmark(config: BenchmarkConfig = {}): Promise<ComparisonReport> {
    if (this.isRunning) {
      throw new Error('Benchmark already running');
    }
    this.isRunning = true;
    this.results = [];
    const benchmarkStartTime = Date.now();

    try {
      const scenarios = this.selectScenarios(config);
      const model = config.model || 'gpt-4o';
      const includeRetell = config.includeRetellBaseline !== false;
      const includeLLMJudge = config.includeLLMJudge !== false;

      const diployResults: ScenarioResult[] = [];
      const retellResults: ScenarioResult[] = [];

      const batchSize = Math.max(1, Math.min(20, Math.floor(Number(config.maxConcurrent) || 5)));
      for (let i = 0; i < scenarios.length; i += batchSize) {
        const batch = scenarios.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(scenario => this.runScenario(scenario, model))
        );
        diployResults.push(...batchResults);
      }

      if (includeRetell) {
        for (const scenario of scenarios) {
          const simulated = generateSimulatedRetellResult(scenario.id, scenario.difficulty);
          retellResults.push({
            scenarioId: scenario.id,
            scenarioName: scenario.name,
            category: scenario.category,
            difficulty: scenario.difficulty,
            provider: 'retell',
            latencyMs: simulated.latencyMs,
            turnsToCompletion: simulated.turnsToCompletion,
            taskCompleted: simulated.taskCompleted,
            toolCallsSucceeded: simulated.toolCallsSucceeded,
            coherenceScore: simulated.coherenceScore,
            responseQuality: simulated.responseQuality,
            naturalness: simulated.naturalness,
            interruptionHandling: simulated.interruptionHandling,
            errorRecovery: simulated.errorRecovery,
            wordErrorRate: simulated.wordErrorRate,
            responses: [],
            toolCallsMade: [],
            totalTokensUsed: 0,
            errors: [],
          });
        }
      }

      this.results = [...diployResults, ...retellResults];

      let llmJudgeResults: LLMJudgeResult[] = [];
      if (includeLLMJudge) {
        llmJudgeResults = await this.runLLMJudgeEvaluation(diployResults, scenarios);
      }

      const reportOptions: ReportOptions = {
        model,
        benchmarkDurationMs: Date.now() - benchmarkStartTime,
      };
      return generateComparisonReport(diployResults, retellResults, llmJudgeResults, scenarios, reportOptions);
    } finally {
      this.isRunning = false;
    }
  }

  private selectScenarios(config: BenchmarkConfig): CallScenario[] {
    if (config.scenarioIds?.length) {
      return ALL_SCENARIOS.filter(s => config.scenarioIds!.includes(s.id));
    }
    if (config.categories?.length) {
      return config.categories.flatMap(cat => getScenariosByCategory(cat));
    }
    return ALL_SCENARIOS;
  }

  private async runScenario(scenario: CallScenario, model: string): Promise<ScenarioResult> {
    const startTime = Date.now();
    const responses: string[] = [];
    const toolCallsMade: string[] = [];
    const errors: string[] = [];
    let totalTokens = 0;
    let taskCompleted = false;
    let toolCallsSucceeded = true;
    const turnLatencies: number[] = [];

    let actualTurnsCompleted = 0;
    const messages: Array<any> = [
      { role: 'system', content: scenario.systemPrompt },
    ];

    const tools = this.buildToolDefinitions(scenario);

    try {
      const openai = await getOpenAIClient();

      for (const turn of scenario.conversationTurns) {
        messages.push({ role: 'user', content: turn.content });

        const turnStart = Date.now();

        const completionParams: Record<string, unknown> = {
          model,
          messages,
          temperature: 0.7,
          max_tokens: 500,
        };

        if (tools.length > 0) {
          completionParams.tools = tools;
          completionParams.tool_choice = 'auto';
        }

        const response = await openai.chat.completions.create(completionParams as any);

        const choice = response.choices[0];
        totalTokens += response.usage?.total_tokens || 0;

        if (choice.message.tool_calls?.length) {
          messages.push(choice.message);

          for (const toolCall of choice.message.tool_calls) {
            toolCallsMade.push(toolCall.function.name);
            const toolResult = this.simulateToolExecution(toolCall.function.name, toolCall.function.arguments);
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(toolResult),
            });
          }

          const followUpParams: Record<string, unknown> = {
            model,
            messages,
            temperature: 0.7,
            max_tokens: 500,
          };
          if (tools.length > 0) {
            followUpParams.tools = tools;
            followUpParams.tool_choice = 'auto';
          }

          const followUp = await openai.chat.completions.create(followUpParams as any);
          const followUpChoice = followUp.choices[0];

          if (followUpChoice.message.tool_calls?.length) {
            messages.push(followUpChoice.message);
            for (const toolCall of followUpChoice.message.tool_calls) {
              toolCallsMade.push(toolCall.function.name);
              const toolResult = this.simulateToolExecution(toolCall.function.name, toolCall.function.arguments);
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify(toolResult),
              });
            }
            const finalFollowUp = await openai.chat.completions.create({ model, messages, temperature: 0.7, max_tokens: 500 } as any);
            const finalContent = finalFollowUp.choices[0].message.content || '';
            responses.push(finalContent);
            messages.push({ role: 'assistant', content: finalContent });
            totalTokens += finalFollowUp.usage?.total_tokens || 0;
          } else {
            const followUpContent = followUpChoice.message.content || '';
            responses.push(followUpContent);
            messages.push({ role: 'assistant', content: followUpContent });
          }
          totalTokens += followUp.usage?.total_tokens || 0;
        } else {
          const content = choice.message.content || '';
          responses.push(content);
          messages.push({ role: 'assistant', content: content });
        }

        actualTurnsCompleted++;
        const turnLatency = Date.now() - turnStart;
        turnLatencies.push(turnLatency);
      }

      if (scenario.expectedTools?.length) {
        const expectedSet = new Set(scenario.expectedTools);
        const madeSet = new Set(toolCallsMade);
        toolCallsSucceeded = [...expectedSet].every(t => madeSet.has(t));
      }

      const hasAllResponses = responses.length >= scenario.conversationTurns.length && responses.every(r => r.length > 5);
      const expectedToolsMet = !scenario.expectedTools?.length || toolCallsSucceeded;
      const noErrors = errors.length === 0;
      taskCompleted = hasAllResponses && expectedToolsMet && noErrors;
    } catch (error: any) {
      errors.push(error.message || 'Unknown error');
    }

    const totalLatency = Date.now() - startTime;
    const avgTurnLatency = turnLatencies.length > 0
      ? Math.round(turnLatencies.reduce((a, b) => a + b, 0) / turnLatencies.length)
      : totalLatency;

    return {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      category: scenario.category,
      difficulty: scenario.difficulty,
      provider: 'diploy',
      latencyMs: avgTurnLatency,
      turnsToCompletion: actualTurnsCompleted,
      taskCompleted,
      toolCallsSucceeded,
      coherenceScore: 0,
      responseQuality: 0,
      naturalness: 0,
      interruptionHandling: 0,
      errorRecovery: errors.length === 0,
      wordErrorRate: 0,
      responses,
      toolCallsMade,
      totalTokensUsed: totalTokens,
      errors,
    };
  }

  private buildToolDefinitions(scenario: CallScenario): ToolCallDefinition[] {
    if (!scenario.expectedTools?.length) return [];

    return scenario.expectedTools.map(toolName => ({
      type: 'function' as const,
      function: {
        name: toolName,
        description: `Execute ${toolName.replace(/_/g, ' ')} operation`,
        parameters: {
          type: 'object' as const,
          properties: {
            query: { type: 'string', description: 'Search query or identifier' },
            data: { type: 'string', description: 'Additional data for the operation' },
          },
          required: ['query'],
        },
      },
    }));
  }

  private simulateToolExecution(toolName: string, argsJson: string): Record<string, unknown> {
    const simulatedResults: Record<string, Record<string, unknown>> = {
      lookup_order: { status: 'shipped', tracking: 'TRK-123456', eta: '2 business days', carrier: 'FedEx' },
      check_return_policy: { eligible: true, window: '30 days', conditions: 'Item must be in original packaging' },
      initiate_return: { returnId: 'RET-789', label: 'return-label-url.pdf', status: 'initiated' },
      lookup_billing: { charges: [{ amount: 49.99, date: '2024-01-15', description: 'Monthly subscription' }] },
      issue_credit: { creditId: 'CRD-456', amount: 49.99, status: 'processed', refundDays: '5-7 business days' },
      check_system_status: { status: 'operational', region: 'us-east-1', incidents: [] },
      create_ticket: { ticketId: 'TKT-1234', priority: 'high', assignee: 'Tier 2 Support', eta: '4 hours' },
      lookup_account: { plan: 'Premium', monthlyRate: 29.99, since: '2023-06-01', usage: '75%' },
      apply_discount: { applied: true, discount: '50%', duration: '3 months', newRate: 14.99 },
      update_shipping: { updated: true, newAddress: '456 Oak Ave, Miami FL 33101', newEta: '3 business days' },
      check_availability: { available: [{ date: 'Tuesday', time: '9:00 AM' }, { date: 'Thursday', time: '2:00 PM' }] },
      book_appointment: { confirmationId: 'APT-5678', date: 'Tuesday', time: '9:00 AM', provider: 'Dr. Smith' },
      lookup_appointment: { confirmationId: 'AP-7789', date: 'Tomorrow', time: '10:00 AM', status: 'confirmed' },
      cancel_appointment: { cancelled: true, fee: 0, refundProcessed: true },
      check_emergency_slots: { available: [{ time: '2:00 PM', provider: 'Dr. Johnson', type: 'emergency' }] },
      list_packages: { packages: [{ name: 'Deluxe Couple', services: ['massage', 'facial'], price: 299 }] },
      book_package: { bookingId: 'SPA-901', date: 'Saturday', time: '11:00 AM', total: 299 },
      check_recurring_availability: { available: true, slot: 'Wednesday 5:30 PM', provider: 'Dr. Johnson' },
      book_recurring: { recurringId: 'REC-234', schedule: 'Weekly Wednesday 5:30 PM', startDate: 'Next week' },
      list_services: { services: [{ name: 'Oil Change', price: 49.99 }, { name: 'Tire Rotation', price: 29.99 }] },
      book_service: { serviceId: 'SVC-567', date: 'Monday', time: '7:30 AM', total: 79.98 },
      update_crm: { updated: true, leadId: 'LEAD-890', stage: 'qualified' },
      schedule_demo: { demoId: 'DEMO-123', date: 'Tuesday', time: '2:00 PM', link: 'https://meet.example.com/demo' },
      update_lead: { leadId: 'LEAD-456', status: 'qualified', score: 85, nextAction: 'schedule_viewing' },
      schedule_viewing: { viewingId: 'VIEW-789', date: 'Saturday', time: '10:00 AM', address: '123 Maple St' },
      calculate_quote: { monthlyPremium: 128.50, coverage: 'Full', deductible: 500 },
      schedule_callback: { callbackId: 'CB-123', contact: 'mark@company.com', time: 'After 3 PM' },
      send_comparison: { sent: true, recipientEmail: 'prospect@company.com', docType: 'comparison_sheet' },
      lookup_referrer: { referrerId: 'REF-100', name: 'David Martinez', company: 'ABC Corp', status: 'active' },
      add_stakeholder: { added: true, stakeholderId: 'SH-456', role: 'Decision Maker' },
      schedule_meeting: { meetingId: 'MTG-789', attendees: 3, status: 'pending_confirmation' },
      generate_proposal: { proposalId: 'PROP-234', discount: '25%', term: 'Annual', status: 'generated' },
      share_documentation: { shared: true, docType: 'technical_architecture', format: 'PDF' },
      schedule_poc: { pocId: 'POC-567', duration: '2 weeks', startDate: 'Next Monday', status: 'approved' },
      verify_identity: { verified: true, method: 'DOB + email', confidence: 'high' },
      send_reset_link: { sent: true, destination: 'alternate email', expiresIn: '24 hours' },
      check_warranty_status: { covered: true, expiresDate: '2027-01-10', type: 'manufacturer_warranty' },
      submit_warranty_claim: { claimId: 'WC-890', status: 'approved', technicianVisit: 'Thursday 10 AM' },
      search_products: { results: [{ name: 'ProMax 500', price: 149, rating: 4.5 }] },
      compare_products: { comparison: { noiseCancel: 'ProMax 500 wins', battery: 'AudioElite X wins' } },
      check_service_status: { status: 'degraded', region: 'us-east', eta: '2 hours', affectedServices: ['dashboard'] },
      subscribe_to_updates: { subscribed: true, channel: 'email', frequency: 'every 30 min' },
      check_shipping_rates: { options: [{ method: 'Express', days: 5, cost: 45 }, { method: 'Standard', days: 14, cost: 15 }] },
      estimate_customs: { estimatedDuty: 12.50, handledByUs: true, documentation: 'included' },
      get_current_plan: { plan: 'Basic', storage: '10GB', usage: '9.2GB', monthlyRate: 9.99 },
      upgrade_subscription: { upgraded: true, newPlan: 'Pro', storage: '100GB', newRate: 24.99 },
      submit_data_request: { requestId: 'GDPR-123', type: 'data_export', eta: '30 days', format: 'JSON + CSV' },
      list_classes: { classes: [{ name: 'Saturday Yoga', time: '9:00 AM', capacity: 20, enrolled: 14 }] },
      check_capacity: { available: 6, groupDiscount: '15% for 4+' },
      register_group: { registrationId: 'GRP-456', members: 4, total: 68, discount: '15%' },
      check_cancellation_policy: { fee: 0, reason: 'cancelled >24h in advance', refundable: true },
      coordinate_appointments: { coordinated: true, sameDay: true, gap: '2 hours between appointments' },
      book_appointments: { bookings: [{ dept: 'Cardiology', time: '9 AM' }, { dept: 'Endocrinology', time: '11 AM' }] },
      check_accessibility: { wheelchairAccess: true, interpreterAvailable: 'Wednesday 2 PM' },
    };

    return simulatedResults[toolName] || { status: 'success', message: `${toolName} executed successfully` };
  }

  private async runLLMJudgeEvaluation(results: ScenarioResult[], scenarios: CallScenario[]): Promise<LLMJudgeResult[]> {
    const judgeResults: LLMJudgeResult[] = [];

    const batchSize = 3;
    for (let i = 0; i < results.length; i += batchSize) {
      const batch = results.slice(i, i + batchSize);
      const batchJudge = await Promise.all(
        batch.map(result => {
          const scenario = scenarios.find(s => s.id === result.scenarioId);
          if (!scenario) return Promise.resolve(null);
          return evaluateWithLLMJudge(result, scenario).catch(err => {
            console.error(`LLM Judge failed for ${result.scenarioId}:`, err.message);
            return null;
          });
        })
      );
      judgeResults.push(...batchJudge.filter((r): r is LLMJudgeResult => r !== null));
    }

    return judgeResults;
  }

  getStatus(): { isRunning: boolean; resultsCount: number } {
    return {
      isRunning: this.isRunning,
      resultsCount: this.results.length,
    };
  }
}

export const benchmarkEngine = new BenchmarkEngine();
