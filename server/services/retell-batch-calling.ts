import { ExternalServiceError } from '../utils/errors';

const RETELL_API_BASE_URL = "https://api.retellai.com/v2";

export type RetellBatchStatus = 'draft' | 'planned' | 'ongoing' | 'sent' | 'cancelled' | 'failed';

export type MappedBatchStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

export interface RetellTask {
  to_number: string;
  retell_llm_dynamic_variables?: Record<string, string>;
  override_agent_id?: string;
  metadata?: Record<string, string>;
}

export interface CreateRetellBatchRequest {
  from_number: string;
  tasks: RetellTask[];
  name?: string;
  trigger_timestamp?: number;
  call_time_window?: {
    start_hour: number;
    end_hour: number;
    timezone: string;
  };
}

export interface RetellBatchCallResponse {
  batch_call_id: string;
  name?: string;
  status: RetellBatchStatus;
  total_task_count: number;
  sent: number;
  picked_up: number;
  successful: number;
  created_at?: number;
  from_number?: string;
}

export interface RetellListBatchesResponse {
  batch_calls: RetellBatchCallResponse[];
  pagination_key?: string | null;
}

export interface RetellBatchStats {
  total_task_count: number;
  sent: number;
  picked_up: number;
  successful: number;
}

function mapRetellStatus(status: RetellBatchStatus): MappedBatchStatus {
  switch (status) {
    case 'draft':
    case 'planned':
      return 'pending';
    case 'ongoing':
      return 'in_progress';
    case 'sent':
      return 'completed';
    case 'cancelled':
      return 'cancelled';
    case 'failed':
      return 'failed';
    default:
      return 'pending';
  }
}

export class RetellBatchCallingService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${RETELL_API_BASE_URL}${endpoint}`;

    console.log(`[RetellBatchCalling] API Request: ${options.method || 'GET'} ${endpoint}`);

    const response = await fetch(url, {
      ...options,
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorDetail = errorText;

      try {
        const errorJson = JSON.parse(errorText);
        errorDetail = errorJson.detail?.message || errorJson.detail || errorJson.message || errorJson.error || errorText;
      } catch {
        // Keep original error text
      }

      console.error(`[RetellBatchCalling] API Error: ${response.status} - ${errorDetail}`);
      throw new ExternalServiceError(
        'RetellAI',
        `Retell AI Batch API error: ${response.status} - ${errorDetail}`,
        undefined,
        {
          operation: endpoint,
          statusCode: response.status,
          responseBody: errorText
        }
      );
    }

    return response.json();
  }

  async createBatch(request: CreateRetellBatchRequest): Promise<RetellBatchCallResponse> {
    console.log(`[RetellBatchCalling] Creating batch job: ${request.name || 'unnamed'} with ${request.tasks.length} tasks`);
    console.log(`   From Number: ${request.from_number}`);

    if (!request.from_number) {
      throw new ExternalServiceError(
        'RetellAI',
        'from_number is required for Retell batch calling',
        undefined,
        { operation: 'createBatch', field: 'from_number' }
      );
    }

    if (!request.tasks || request.tasks.length === 0) {
      throw new ExternalServiceError(
        'RetellAI',
        'At least one task is required for Retell batch calling',
        undefined,
        { operation: 'createBatch', field: 'tasks' }
      );
    }

    const body: Record<string, any> = {
      from_number: request.from_number,
      tasks: request.tasks,
    };

    if (request.name) {
      body.name = request.name;
    }

    if (request.trigger_timestamp) {
      body.trigger_timestamp = request.trigger_timestamp;
    }

    if (request.call_time_window) {
      body.call_time_window = request.call_time_window;
    }

    const response = await this.request<any>('/create-batch-call', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    const batchId = response.batch_call_id;
    if (!batchId) {
      console.error(`[RetellBatchCalling] API returned no batch ID:`, response);
      throw new ExternalServiceError(
        'RetellAI',
        'Retell AI API returned empty batch_call_id - batch creation may have failed',
        undefined,
        { operation: '/create-batch-call', response }
      );
    }

    const batch: RetellBatchCallResponse = {
      batch_call_id: batchId,
      name: response.name || request.name,
      status: response.status || 'draft',
      total_task_count: response.total_task_count || request.tasks.length,
      sent: response.sent || 0,
      picked_up: response.picked_up || 0,
      successful: response.successful || 0,
      created_at: response.created_at,
      from_number: response.from_number || request.from_number,
    };

    console.log(`[RetellBatchCalling] Created batch job: ${batch.batch_call_id} (status: ${batch.status})`);
    return batch;
  }

  async getBatch(batchCallId: string): Promise<RetellBatchCallResponse> {
    console.log(`[RetellBatchCalling] Getting batch details: ${batchCallId}`);

    const response = await this.request<any>(`/get-batch-call/${batchCallId}`);

    const batch: RetellBatchCallResponse = {
      batch_call_id: response.batch_call_id || batchCallId,
      name: response.name,
      status: response.status || 'draft',
      total_task_count: response.total_task_count || 0,
      sent: response.sent || 0,
      picked_up: response.picked_up || 0,
      successful: response.successful || 0,
      created_at: response.created_at,
      from_number: response.from_number,
    };

    return batch;
  }

  async listBatches(limit: number = 100, paginationKey?: string, sortOrder: string = 'descending', filterStatus?: RetellBatchStatus): Promise<RetellListBatchesResponse> {
    let endpoint = `/list-batch-calls?limit=${limit}`;

    if (paginationKey) {
      endpoint += `&pagination_key=${encodeURIComponent(paginationKey)}`;
    }

    if (sortOrder) {
      endpoint += `&sort_order=${sortOrder}`;
    }

    if (filterStatus) {
      endpoint += `&filter_status=${filterStatus}`;
    }

    const response = await this.request<any>(endpoint);

    const batchCalls: RetellBatchCallResponse[] = (response.batch_calls || response || []).map((b: any) => ({
      batch_call_id: b.batch_call_id,
      name: b.name,
      status: b.status || 'draft',
      total_task_count: b.total_task_count || 0,
      sent: b.sent || 0,
      picked_up: b.picked_up || 0,
      successful: b.successful || 0,
      created_at: b.created_at,
      from_number: b.from_number,
    }));

    return {
      batch_calls: batchCalls,
      pagination_key: response.pagination_key || null,
    };
  }

  async cancelBatch(batchCallId: string): Promise<void> {
    console.log(`[RetellBatchCalling] Cancelling batch job: ${batchCallId}`);

    await this.request<any>(`/cancel-batch-call/${batchCallId}`, {
      method: 'POST',
    });

    console.log(`[RetellBatchCalling] Cancelled batch job: ${batchCallId}`);
  }

  static mapStatus(retellStatus: RetellBatchStatus): MappedBatchStatus {
    return mapRetellStatus(retellStatus);
  }

  static contactsToRetellTasks(contacts: Array<{
    firstName: string;
    lastName?: string | null;
    phone: string;
    email?: string | null;
    customFields?: Record<string, any> | null;
  }>, overrideAgentId?: string): RetellTask[] {
    return contacts.map(contact => {
      const task: RetellTask = {
        to_number: contact.phone,
      };

      const dynamicVars: Record<string, string> = {};

      dynamicVars['contact_name'] = contact.lastName
        ? `${contact.firstName} ${contact.lastName}`
        : contact.firstName;
      dynamicVars['first_name'] = contact.firstName;

      if (contact.lastName) {
        dynamicVars['last_name'] = contact.lastName;
      }

      if (contact.email) {
        dynamicVars['email'] = contact.email;
      }

      if (contact.customFields && typeof contact.customFields === 'object') {
        for (const [key, value] of Object.entries(contact.customFields)) {
          if (value !== null && value !== undefined) {
            dynamicVars[key] = String(value);
          }
        }
      }

      if (Object.keys(dynamicVars).length > 0) {
        task.retell_llm_dynamic_variables = dynamicVars;
      }

      if (overrideAgentId) {
        task.override_agent_id = overrideAgentId;
      }

      return task;
    });
  }

  static getRetellBatchStats(batch: RetellBatchCallResponse): RetellBatchStats {
    return {
      total_task_count: batch.total_task_count,
      sent: batch.sent,
      picked_up: batch.picked_up,
      successful: batch.successful,
    };
  }
}
