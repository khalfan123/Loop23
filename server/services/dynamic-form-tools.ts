'use strict';
import { db } from '../db';
import { appointments, forms, formFields, formSubmissions } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { webhookDeliveryService } from './webhook-delivery';
import { getDomain } from '../utils/domain';
import { getFormWebhookSecret } from './form-elevenlabs-tool';
import { createCalendarEventForAppointment } from "./calendar-sync";

export interface DynamicFormToolContext {
  userId: string;
  agentId: string;
  callId?: string;
}

export interface DynamicFormTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handler: (params: Record<string, unknown>) => Promise<unknown>;
}

type AppointmentCandidate = {
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  appointmentDate: string;
  appointmentTime: string;
  duration: number;
  serviceName: string | null;
  notes: string | null;
  metadata: Record<string, any> | null;
};

function isIsoDateString(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function isHHMM(s: string): boolean {
  return /^\d{2}:\d{2}$/.test(s);
}

function parseAppointmentFromCollectedData(args: {
  contactName: string | null;
  contactPhone: string | null;
  params: Record<string, unknown>;
  collectedData?: Record<string, any>;
}): AppointmentCandidate | null {
  const { contactName, contactPhone, params, collectedData } = args;
  const data = (collectedData && typeof collectedData === 'object') ? collectedData : {};

  const pick = (...keys: string[]): any => {
    for (const k of keys) {
      if (data[k] !== undefined && data[k] !== null && data[k] !== '') return data[k];
      if ((params as any)[k] !== undefined && (params as any)[k] !== null && (params as any)[k] !== '') return (params as any)[k];
    }
    return undefined;
  };

  const scheduledFor = pick('scheduledFor', 'scheduled_for', 'appointment', 'appointment_datetime', 'appointmentDateTime');
  let appointmentDate = pick('appointmentDate', 'appointment_date', 'date', 'appointment_day');
  let appointmentTime = pick('appointmentTime', 'appointment_time', 'time', 'appointment_hour');

  if ((!appointmentDate || !appointmentTime) && typeof scheduledFor === 'string') {
    const d = new Date(scheduledFor);
    if (!isNaN(d.getTime())) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const mi = String(d.getMinutes()).padStart(2, '0');
      appointmentDate = appointmentDate || `${yyyy}-${mm}-${dd}`;
      appointmentTime = appointmentTime || `${hh}:${mi}`;
    }
  }

  if (typeof appointmentDate !== 'string' || typeof appointmentTime !== 'string') return null;
  appointmentDate = appointmentDate.trim();
  appointmentTime = appointmentTime.trim();
  if (!isIsoDateString(appointmentDate) || !isHHMM(appointmentTime)) return null;

  const durationRaw = pick('duration', 'appointmentDuration', 'appointment_duration');
  const duration = typeof durationRaw === 'number'
    ? durationRaw
    : (typeof durationRaw === 'string' && durationRaw.trim() ? Number(durationRaw) : 30);
  const safeDuration = Number.isFinite(duration) && duration > 0 ? Math.floor(duration) : 30;

  const contactEmailRaw = pick('contactEmail', 'contact_email', 'email');
  const contactEmail = typeof contactEmailRaw === 'string' && contactEmailRaw.trim() ? contactEmailRaw.trim() : null;

  const serviceNameRaw = pick('serviceName', 'service_name', 'reason', 'topic');
  const serviceName = typeof serviceNameRaw === 'string' && serviceNameRaw.trim() ? serviceNameRaw.trim() : null;

  const notesRaw = pick('notes', 'note', 'details', 'description');
  const notes = typeof notesRaw === 'string' && notesRaw.trim() ? notesRaw.trim() : null;

  const finalName = contactName || (typeof pick('name', 'contact_name') === 'string' ? String(pick('name', 'contact_name')) : null);
  const finalPhone = contactPhone || (typeof pick('phone', 'contact_phone') === 'string' ? String(pick('phone', 'contact_phone')) : null);
  if (!finalName || !finalPhone) return null;

  const metadata: Record<string, any> = {
    source: 'dynamic_form',
    scheduledFor: `${appointmentDate}T${appointmentTime}`,
  };

  return {
    contactName: String(finalName),
    contactPhone: String(finalPhone),
    contactEmail,
    appointmentDate,
    appointmentTime,
    duration: safeDuration,
    serviceName,
    notes,
    metadata,
  };
}

export const DYNAMIC_FORM_PROMPT = `

DYNAMIC DATA COLLECTION:
You have the ability to collect structured information from the caller at any point during the conversation using forms.
- If the caller volunteers important information (name, email, phone, address, preferences, feedback, complaints, order details, etc.) and no form has been pre-assigned, you should capture it.
- Use the "list_available_forms" tool to see what forms exist for this business. If one matches the situation, use "submit_dynamic_form" with that form's ID.
- If no existing form fits, use "submit_dynamic_form" WITHOUT a formId — it will automatically create an ad-hoc form to store the data.
- Always confirm with the caller before saving: "Let me save that information for you."
- Collect data naturally during conversation — do NOT interrogate the caller with a list of questions unless they expect a form-filling experience.
- At minimum, try to capture the caller's name and phone number whenever they provide personal details.
- Never mention "forms", "databases", or "systems" to the caller. Just say "I've noted that down" or "I've saved your information."`;

export function buildListFormsHandler(ctx: DynamicFormToolContext): (params: Record<string, unknown>) => Promise<any> {
  return async () => {
    try {
      console.log(`[Dynamic Form] Listing forms for user ${ctx.userId}`);

      const userForms = await db
        .select({
          id: forms.id,
          name: forms.name,
          description: forms.description,
        })
        .from(forms)
        .where(and(eq(forms.userId, ctx.userId), eq(forms.isActive, true)));

      if (userForms.length === 0) {
        return {
          forms: [],
          message: 'No forms available. You can still collect data using submit_dynamic_form without a formId — it will create an ad-hoc form automatically.',
        };
      }

      const formsWithFields = await Promise.all(
        userForms.map(async (form) => {
          const fields = await db
            .select({
              id: formFields.id,
              question: formFields.question,
              fieldType: formFields.fieldType,
              isRequired: formFields.isRequired,
            })
            .from(formFields)
            .where(eq(formFields.formId, form.id))
            .orderBy(formFields.order);

          return {
            id: form.id,
            name: form.name,
            description: form.description,
            fields: fields.map((f) => ({
              id: f.id,
              question: f.question,
              type: f.fieldType,
              required: f.isRequired,
            })),
          };
        })
      );

      console.log(`[Dynamic Form] Found ${formsWithFields.length} forms`);
      return { forms: formsWithFields };
    } catch (error: any) {
      console.error(`[Dynamic Form] Error listing forms:`, error.message);
      return { forms: [], message: 'Unable to retrieve forms at this time.' };
    }
  };
}

export function buildSubmitDynamicFormHandler(ctx: DynamicFormToolContext): (params: Record<string, unknown>) => Promise<any> {
  let cachedAdHocFormId: string | null = null;
  let cachedAdHocFormName: string | null = null;

  return async (params: Record<string, unknown>) => {
    try {
      const formId = params.formId as string | undefined;
      const contactName = (params.contactName as string) || null;
      const contactPhone = (params.contactPhone as string) || null;
      const collectedData = params.data as Record<string, any> | undefined;

      console.log(`[Dynamic Form] Submit called — formId: ${formId || 'ad-hoc'}, contact: ${contactName}`);

      let targetFormId: string;
      let targetFormName: string;

      if (formId) {
        const [existingForm] = await db
          .select()
          .from(forms)
          .where(and(eq(forms.id, formId), eq(forms.userId, ctx.userId)))
          .limit(1);

        if (!existingForm) {
          return { success: false, message: 'Form not found. Try without a formId to create an ad-hoc collection.' };
        }

        targetFormId = existingForm.id;
        targetFormName = existingForm.name || 'Form';
      } else if (cachedAdHocFormId) {
        targetFormId = cachedAdHocFormId;
        targetFormName = cachedAdHocFormName || 'Call Collection';
        console.log(`[Dynamic Form] Reusing cached ad-hoc form ${targetFormId}`);
      } else {
        const adHocId = nanoid();
        const [newForm] = await db
          .insert(forms)
          .values({
            id: adHocId,
            userId: ctx.userId,
            name: `Call Collection — ${new Date().toLocaleDateString()}`,
            description: 'Auto-created during a call to capture caller information',
            isActive: true,
          })
          .returning();

        targetFormId = newForm.id;
        targetFormName = newForm.name;
        cachedAdHocFormId = targetFormId;
        cachedAdHocFormName = targetFormName;

        if (collectedData && typeof collectedData === 'object') {
          const fieldEntries = Object.entries(collectedData);
          for (let i = 0; i < fieldEntries.length; i++) {
            const [key] = fieldEntries[i];
            await db.insert(formFields).values({
              id: nanoid(),
              formId: targetFormId,
              question: key,
              fieldType: 'text',
              isRequired: false,
              order: i,
            });
          }
        }

        console.log(`[Dynamic Form] Created ad-hoc form ${targetFormId}`);
      }

      const responses: Array<{ fieldId: string; question: string; answer: string }> = [];

      if (formId) {
        const existingFields = await db
          .select()
          .from(formFields)
          .where(eq(formFields.formId, formId))
          .orderBy(formFields.order);

        for (const field of existingFields) {
          const fieldKey = `field_${field.id.replace(/-/g, '_')}`;
          const directKey = field.question;
          const value = collectedData?.[fieldKey] ?? collectedData?.[directKey] ?? (params[fieldKey] as string | undefined);
          if (value !== undefined && value !== null) {
            responses.push({
              fieldId: field.id,
              question: field.question,
              answer: String(value),
            });
          }
        }
      }

      if (collectedData && typeof collectedData === 'object') {
        const existingQuestions = new Set(responses.map((r) => r.question.toLowerCase()));
        for (const [key, value] of Object.entries(collectedData)) {
          if (key.startsWith('field_')) continue;
          if (existingQuestions.has(key.toLowerCase())) continue;
          if (value !== undefined && value !== null) {
            responses.push({
              fieldId: nanoid(),
              question: key,
              answer: String(value),
            });
          }
        }
      }

      if (responses.length === 0 && !contactName && !contactPhone) {
        return { success: false, message: 'No data to save. Collect at least one piece of information.' };
      }

      const submissionId = nanoid();
      await db.insert(formSubmissions).values({
        id: submissionId,
        formId: targetFormId,
        callId: ctx.callId || null,
        contactName,
        contactPhone,
        responses,
      });

      console.log(`[Dynamic Form] Created submission ${submissionId} with ${responses.length} responses`);

      // If the collected data includes appointment details, also create an appointment record.
      // This enables downstream sync flows (e.g. n8n -> Google Calendar / Outlook) via appointment.booked webhook.
      try {
        const apt = parseAppointmentFromCollectedData({ contactName, contactPhone, params, collectedData });
        if (apt) {
          const appointmentId = nanoid();
          await db.insert(appointments).values({
            id: appointmentId,
            userId: ctx.userId,
            callId: ctx.callId || null,
            flowId: null,
            contactName: apt.contactName!,
            contactPhone: apt.contactPhone!,
            contactEmail: apt.contactEmail,
            appointmentDate: apt.appointmentDate,
            appointmentTime: apt.appointmentTime,
            duration: apt.duration,
            serviceName: apt.serviceName,
            notes: apt.notes,
            status: 'scheduled',
            metadata: apt.metadata,
          });

          console.log(`[Dynamic Form] Also created appointment ${appointmentId} from collected data`);

          // Best-effort: also create a calendar event if connected.
          try {
            await createCalendarEventForAppointment({
              userId: ctx.userId,
              appointment: {
                id: appointmentId,
                contactName: apt.contactName!,
                contactPhone: apt.contactPhone!,
                contactEmail: apt.contactEmail,
                appointmentDate: apt.appointmentDate,
                appointmentTime: apt.appointmentTime,
                duration: apt.duration,
                serviceName: apt.serviceName,
                notes: apt.notes,
              },
            });
          } catch (calendarError: any) {
            console.error(`[Dynamic Form] Calendar sync failed:`, calendarError.message);
          }

          try {
            await webhookDeliveryService.triggerEvent(ctx.userId, 'appointment.booked', {
              appointment: {
                id: appointmentId,
                contactName: apt.contactName,
                contactPhone: apt.contactPhone,
                contactEmail: apt.contactEmail,
                date: apt.appointmentDate,
                time: apt.appointmentTime,
                duration: apt.duration,
                serviceName: apt.serviceName,
                notes: apt.notes,
                status: 'scheduled',
                createdAt: new Date().toISOString(),
              },
              call: { id: ctx.callId || null },
              flow: { id: null },
              source: 'dynamic_form',
            });
          } catch (webhookError: any) {
            console.error(`[Dynamic Form] appointment.booked webhook trigger failed:`, webhookError.message);
          }
        }
      } catch (aptError: any) {
        console.error(`[Dynamic Form] Appointment extraction failed:`, aptError.message);
      }

      try {
        await webhookDeliveryService.triggerEvent(ctx.userId, 'form.submitted', {
          submission: {
            id: submissionId,
            formId: targetFormId,
            formName: targetFormName,
            contactName,
            contactPhone,
            responses,
            submittedAt: new Date().toISOString(),
            dynamic: !formId,
          },
          call: { id: ctx.callId || null },
        });
      } catch (webhookError: any) {
        console.error(`[Dynamic Form] Webhook trigger failed:`, webhookError.message);
      }

      return {
        success: true,
        submissionId,
        message: `Information saved successfully.`,
      };
    } catch (error: any) {
      console.error(`[Dynamic Form] Error submitting:`, error.message);
      return { success: false, message: 'Unable to save information at this time. Please try again.' };
    }
  };
}

export function buildDynamicFormTools(ctx: DynamicFormToolContext): DynamicFormTool[] {
  const listFormsTool: DynamicFormTool = {
    name: 'list_available_forms',
    description:
      'List all available data collection forms for this business. Use this to find the right form before collecting structured information from the caller. Returns form names, descriptions, and their fields.',
    parameters: {
      type: 'object',
      properties: {},
    } as Record<string, unknown>,
    handler: buildListFormsHandler(ctx),
  };

  const submitDynamicFormTool: DynamicFormTool = {
    name: 'submit_dynamic_form',
    description:
      'Save collected information from the caller. If you found a matching form via list_available_forms, pass its formId. If no form fits, omit formId and the system will automatically create one. Always include contactName and contactPhone when available. Put all other collected data in the "data" object as key-value pairs.',
    parameters: {
      type: 'object',
      properties: {
        formId: {
          type: 'string',
          description:
            'Optional. The ID of an existing form to submit to (from list_available_forms). Omit to auto-create an ad-hoc form.',
        },
        contactName: {
          type: 'string',
          description: 'Name of the caller.',
        },
        contactPhone: {
          type: 'string',
          description: 'Phone number of the caller. Accept any format.',
        },
        data: {
          type: 'object',
          description:
            'Key-value pairs of collected information. Keys should be descriptive labels (e.g. "email", "company", "preferred_date", "feedback"). Values are the caller responses.',
        },
      },
    } as Record<string, unknown>,
    handler: buildSubmitDynamicFormHandler(ctx),
  };

  return [listFormsTool, submitDynamicFormTool];
}

export interface ElevenLabsDynamicFormWebhookTool {
  type: 'webhook';
  name: string;
  description: string;
  api_schema: {
    url: string;
    method: 'GET' | 'POST';
    headers?: Record<string, string>;
    request_body_schema?: Record<string, unknown>;
  };
}

export function buildElevenLabsDynamicFormWebhookTools(
  userId: string,
  elevenLabsAgentId: string
): ElevenLabsDynamicFormWebhookTool[] {
  const domain = getDomain();
  const secret = getFormWebhookSecret();

  const listFormsTool: ElevenLabsDynamicFormWebhookTool = {
    type: 'webhook',
    name: 'list_available_forms',
    description:
      'List all available data collection forms for this business. Use this first to find the right form before collecting information. Returns form names, descriptions, and fields.',
    api_schema: {
      url: `${domain}/api/webhooks/elevenlabs/dynamic-form-list/${secret}/${userId}/${elevenLabsAgentId}`,
      method: 'GET',
    },
  };

  const submitTool: ElevenLabsDynamicFormWebhookTool = {
    type: 'webhook',
    name: 'submit_dynamic_form',
    description:
      'Save collected information from the caller. If you found a matching form via list_available_forms, pass its formId. If no form fits, omit formId and the system will automatically create one. Include contactName and contactPhone when available. Put all other collected data as individual fields with descriptive names.',
    api_schema: {
      url: `${domain}/api/webhooks/elevenlabs/dynamic-form/${secret}/${userId}/${elevenLabsAgentId}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      request_body_schema: {
        type: 'object',
        properties: {
          formId: {
            type: 'string',
            description: 'Optional. The ID of an existing form to submit to (from list_available_forms). Omit to auto-create an ad-hoc form.',
          },
          contactName: {
            type: 'string',
            description: 'Name of the caller if available.',
          },
          contactPhone: {
            type: 'string',
            description: 'Phone number of the caller if available.',
          },
        },
        additionalProperties: {
          type: 'string',
          description: 'Any additional key-value pairs of collected information. Use descriptive keys like email, company, address, feedback, preferred_date, etc.',
        },
      },
    },
  };

  return [listFormsTool, submitTool];
}

export async function createFallbackFormSubmission(params: {
  userId: string;
  callId: string;
  contactName?: string | null;
  contactPhone?: string | null;
  extractedData: Record<string, string>;
}): Promise<string | null> {
  const { userId, callId, contactName, contactPhone, extractedData } = params;

  try {
    const existingSubmissions = await db
      .select({ id: formSubmissions.id })
      .from(formSubmissions)
      .where(eq(formSubmissions.callId, callId))
      .limit(1);

    if (existingSubmissions.length > 0) {
      console.log(`[Dynamic Form Fallback] Call ${callId} already has form submission, skipping fallback`);
      return null;
    }

    const dataEntries = Object.entries(extractedData).filter(
      ([, v]) => v !== undefined && v !== null && v !== ''
    );

    if (dataEntries.length === 0 && !contactName && !contactPhone) {
      console.log(`[Dynamic Form Fallback] No data to save for call ${callId}`);
      return null;
    }

    const adHocFormId = nanoid();
    await db.insert(forms).values({
      id: adHocFormId,
      userId,
      name: `Call Collection — ${new Date().toLocaleDateString()}`,
      description: 'Auto-created from post-call extraction (no form tool was used during the call)',
      isActive: true,
    });

    const responses: { fieldId: string; question: string; answer: string }[] = [];

    for (let i = 0; i < dataEntries.length; i++) {
      const [key, value] = dataEntries[i];
      const fieldId = nanoid();
      await db.insert(formFields).values({
        id: fieldId,
        formId: adHocFormId,
        question: key,
        fieldType: 'text',
        isRequired: false,
        order: i,
      });
      responses.push({ fieldId, question: key, answer: String(value) });
    }

    const submissionId = nanoid();
    await db.insert(formSubmissions).values({
      id: submissionId,
      formId: adHocFormId,
      callId,
      contactName: contactName || null,
      contactPhone: contactPhone || null,
      responses,
    });

    console.log(`[Dynamic Form Fallback] Created fallback submission ${submissionId} for call ${callId} with ${responses.length} fields`);

    try {
      await webhookDeliveryService.triggerEvent(userId, 'form.submitted', {
        submission: {
          id: submissionId,
          formId: adHocFormId,
          formName: `Call Collection — ${new Date().toLocaleDateString()}`,
          contactName: contactName || null,
          contactPhone: contactPhone || null,
          responses,
          submittedAt: new Date().toISOString(),
          dynamic: true,
          fallback: true,
        },
        call: { id: callId },
      });
    } catch (webhookError: any) {
      console.error(`[Dynamic Form Fallback] Webhook trigger failed:`, webhookError.message);
    }

    return submissionId;
  } catch (error: any) {
    console.error(`[Dynamic Form Fallback] Error creating fallback submission:`, error.message);
    return null;
  }
}
