import { Router, Request, Response } from "express";
import { db } from "../db";
import { departments, departmentAgents, ivrConfigurations, departmentKnowledgeBases, agents, phoneNumbers, flows, incomingConnections, humanIncomingConnections, knowledgeBase } from "@shared/schema";
import type { FlowNode, FlowEdge } from "@shared/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import { insertDepartmentSchema, insertIvrConfigurationSchema } from "@shared/schema";
import { twilioService } from "../services/twilio";
import { getDomain } from "../utils/domain";
import { awsPollyService } from "../services/aws-polly";
import { nanoid } from "nanoid";
import { getOpenAIClient } from "../services/openai-modelfarm";
import { deprockIvrRouter } from "../engines/twilio-bedrock-polly/routes/ivr-webhooks";

interface AuthRequest extends Request {
  userId?: string;
}

function getDepartmentType(name: string): "sales" | "support" | "scheduling" | "custom" {
  const lowerName = name.toLowerCase();
  if (lowerName.includes("sales") || lowerName.includes("vente")) return "sales";
  if (lowerName.includes("support") || lowerName.includes("help") || lowerName.includes("assistance")) return "support";
  if (lowerName.includes("schedule") || lowerName.includes("appointment") || lowerName.includes("booking") || lowerName.includes("rendez-vous")) return "scheduling";
  return "custom";
}

function generateDefaultFlowNodes(departmentName: string, agentName: string = "your AI assistant", language: string = "en"): { nodes: FlowNode[], edges: FlowEdge[] } {
  const deptType = getDepartmentType(departmentName);
  
  const greetingsByLanguage: Record<string, Record<string, string>> = {
    en: {
      sales: `Hello! I'm ${agentName}. Thank you for calling our sales department. How can I help you today?`,
      support: `Hello! I'm ${agentName}. Thank you for reaching our support team. How may I assist you?`,
      scheduling: `Hello! I'm ${agentName}. Thank you for calling. I can help you schedule an appointment. What day works best for you?`,
      custom: `Hello! Thank you for calling ${departmentName}. I'm ${agentName}. How can I assist you today?`,
    },
    ar: {
      sales: `مرحباً! أنا ${agentName}. شكراً لاتصالك بقسم المبيعات. كيف يمكنني مساعدتك اليوم؟`,
      support: `مرحباً! أنا ${agentName}. شكراً لتواصلك مع فريق الدعم. كيف يمكنني مساعدتك؟`,
      scheduling: `مرحباً! أنا ${agentName}. شكراً لاتصالك. يمكنني مساعدتك في حجز موعد. ما هو اليوم المناسب لك؟`,
      custom: `مرحباً! شكراً لاتصالك بـ ${departmentName}. أنا ${agentName}. كيف يمكنني مساعدتك اليوم؟`,
    },
    es: {
      sales: `¡Hola! Soy ${agentName}. Gracias por llamar a nuestro departamento de ventas. ¿Cómo puedo ayudarle hoy?`,
      support: `¡Hola! Soy ${agentName}. Gracias por contactar con nuestro equipo de soporte. ¿En qué puedo ayudarle?`,
      scheduling: `¡Hola! Soy ${agentName}. Gracias por llamar. Puedo ayudarle a programar una cita. ¿Qué día le viene mejor?`,
      custom: `¡Hola! Gracias por llamar a ${departmentName}. Soy ${agentName}. ¿Cómo puedo ayudarle hoy?`,
    },
    fr: {
      sales: `Bonjour ! Je suis ${agentName}. Merci d'avoir appelé notre service commercial. Comment puis-je vous aider aujourd'hui ?`,
      support: `Bonjour ! Je suis ${agentName}. Merci d'avoir contacté notre équipe d'assistance. Comment puis-je vous aider ?`,
      scheduling: `Bonjour ! Je suis ${agentName}. Merci d'avoir appelé. Je peux vous aider à prendre rendez-vous. Quel jour vous convient ?`,
      custom: `Bonjour ! Merci d'avoir appelé ${departmentName}. Je suis ${agentName}. Comment puis-je vous aider aujourd'hui ?`,
    },
    de: {
      sales: `Hallo! Ich bin ${agentName}. Vielen Dank für Ihren Anruf bei unserer Verkaufsabteilung. Wie kann ich Ihnen heute helfen?`,
      support: `Hallo! Ich bin ${agentName}. Vielen Dank für Ihre Kontaktaufnahme mit unserem Support-Team. Wie kann ich Ihnen helfen?`,
      scheduling: `Hallo! Ich bin ${agentName}. Vielen Dank für Ihren Anruf. Ich kann Ihnen bei der Terminvereinbarung helfen. Welcher Tag passt Ihnen am besten?`,
      custom: `Hallo! Vielen Dank für Ihren Anruf bei ${departmentName}. Ich bin ${agentName}. Wie kann ich Ihnen heute helfen?`,
    },
    it: {
      sales: `Ciao! Sono ${agentName}. Grazie per aver chiamato il nostro reparto vendite. Come posso aiutarla oggi?`,
      support: `Ciao! Sono ${agentName}. Grazie per aver contattato il nostro team di supporto. Come posso aiutarla?`,
      scheduling: `Ciao! Sono ${agentName}. Grazie per aver chiamato. Posso aiutarla a fissare un appuntamento. Quale giorno le va bene?`,
      custom: `Ciao! Grazie per aver chiamato ${departmentName}. Sono ${agentName}. Come posso aiutarla oggi?`,
    },
    pt: {
      sales: `Olá! Eu sou ${agentName}. Obrigado por ligar para o nosso departamento de vendas. Como posso ajudá-lo hoje?`,
      support: `Olá! Eu sou ${agentName}. Obrigado por entrar em contato com nossa equipe de suporte. Como posso ajudá-lo?`,
      scheduling: `Olá! Eu sou ${agentName}. Obrigado por ligar. Posso ajudá-lo a agendar um compromisso. Qual dia é melhor para você?`,
      custom: `Olá! Obrigado por ligar para ${departmentName}. Eu sou ${agentName}. Como posso ajudá-lo hoje?`,
    },
    zh: {
      sales: `您好！我是${agentName}。感谢您致电我们的销售部门。今天我能为您做些什么？`,
      support: `您好！我是${agentName}。感谢您联系我们的支持团队。我能为您提供什么帮助？`,
      scheduling: `您好！我是${agentName}。感谢您来电。我可以帮您预约。请问哪天方便？`,
      custom: `您好！感谢您致电${departmentName}。我是${agentName}。今天我能为您做些什么？`,
    },
    hi: {
      sales: `नमस्ते! मैं ${agentName} हूँ। हमारे बिक्री विभाग में कॉल करने के लिए धन्यवाद। आज मैं आपकी कैसे मदद कर सकता हूँ?`,
      support: `नमस्ते! मैं ${agentName} हूँ। हमारी सहायता टीम से संपर्क करने के लिए धन्यवाद। मैं आपकी कैसे मदद कर सकता हूँ?`,
      scheduling: `नमस्ते! मैं ${agentName} हूँ। कॉल करने के लिए धन्यवाद। मैं आपको अपॉइंटमेंट शेड्यूल करने में मदद कर सकता हूँ। कौन सा दिन आपके लिए सुविधाजनक है?`,
      custom: `नमस्ते! ${departmentName} में कॉल करने के लिए धन्यवाद। मैं ${agentName} हूँ। आज मैं आपकी कैसे मदद कर सकता हूँ?`,
    },
    ja: {
      sales: `こんにちは！${agentName}です。営業部門にお電話いただきありがとうございます。本日はどのようなご用件でしょうか？`,
      support: `こんにちは！${agentName}です。サポートチームにお問い合わせいただきありがとうございます。どのようにお手伝いできますか？`,
      scheduling: `こんにちは！${agentName}です。お電話ありがとうございます。予約のお手伝いをいたします。ご都合の良い日はいつですか？`,
      custom: `こんにちは！${departmentName}にお電話いただきありがとうございます。${agentName}です。本日はどのようなご用件でしょうか？`,
    },
    ko: {
      sales: `안녕하세요! ${agentName}입니다. 영업부에 전화해 주셔서 감사합니다. 오늘 어떻게 도와드릴까요?`,
      support: `안녕하세요! ${agentName}입니다. 고객지원팀에 연락해 주셔서 감사합니다. 어떻게 도와드릴까요?`,
      scheduling: `안녕하세요! ${agentName}입니다. 전화해 주셔서 감사합니다. 예약을 도와드리겠습니다. 어떤 날이 편하신가요?`,
      custom: `안녕하세요! ${departmentName}에 전화해 주셔서 감사합니다. ${agentName}입니다. 오늘 어떻게 도와드릴까요?`,
    },
    nl: {
      sales: `Hallo! Ik ben ${agentName}. Bedankt voor het bellen naar onze verkoopafdeling. Hoe kan ik u vandaag helpen?`,
      support: `Hallo! Ik ben ${agentName}. Bedankt voor het contact met ons supportteam. Hoe kan ik u helpen?`,
      scheduling: `Hallo! Ik ben ${agentName}. Bedankt voor het bellen. Ik kan u helpen met het plannen van een afspraak. Welke dag past u het beste?`,
      custom: `Hallo! Bedankt voor het bellen naar ${departmentName}. Ik ben ${agentName}. Hoe kan ik u vandaag helpen?`,
    },
    pl: {
      sales: `Dzień dobry! Jestem ${agentName}. Dziękuję za telefon do naszego działu sprzedaży. W czym mogę pomóc?`,
      support: `Dzień dobry! Jestem ${agentName}. Dziękuję za kontakt z naszym zespołem wsparcia. W czym mogę pomóc?`,
      scheduling: `Dzień dobry! Jestem ${agentName}. Dziękuję za telefon. Mogę pomóc umówić wizytę. Który dzień jest dla Pana/Pani najwygodniejszy?`,
      custom: `Dzień dobry! Dziękuję za telefon do ${departmentName}. Jestem ${agentName}. W czym mogę dziś pomóc?`,
    },
    sv: {
      sales: `Hej! Jag är ${agentName}. Tack för att du ringer vår försäljningsavdelning. Hur kan jag hjälpa dig idag?`,
      support: `Hej! Jag är ${agentName}. Tack för att du kontaktar vårt supportteam. Hur kan jag hjälpa dig?`,
      scheduling: `Hej! Jag är ${agentName}. Tack för att du ringer. Jag kan hjälpa dig boka en tid. Vilken dag passar dig bäst?`,
      custom: `Hej! Tack för att du ringer ${departmentName}. Jag är ${agentName}. Hur kan jag hjälpa dig idag?`,
    },
    no: {
      sales: `Hei! Jeg er ${agentName}. Takk for at du ringer salgsavdelingen vår. Hvordan kan jeg hjelpe deg i dag?`,
      support: `Hei! Jeg er ${agentName}. Takk for at du kontakter supportteamet vårt. Hvordan kan jeg hjelpe deg?`,
      scheduling: `Hei! Jeg er ${agentName}. Takk for at du ringer. Jeg kan hjelpe deg med å bestille en avtale. Hvilken dag passer best for deg?`,
      custom: `Hei! Takk for at du ringer ${departmentName}. Jeg er ${agentName}. Hvordan kan jeg hjelpe deg i dag?`,
    },
    fi: {
      sales: `Hei! Olen ${agentName}. Kiitos soitostasi myyntiosastollemme. Miten voin auttaa sinua tänään?`,
      support: `Hei! Olen ${agentName}. Kiitos yhteydenotostasi tukitiimiimme. Miten voin auttaa sinua?`,
      scheduling: `Hei! Olen ${agentName}. Kiitos soitostasi. Voin auttaa sinua varaamaan ajan. Mikä päivä sopisi sinulle parhaiten?`,
      custom: `Hei! Kiitos soitostasi ${departmentName}. Olen ${agentName}. Miten voin auttaa sinua tänään?`,
    },
    tr: {
      sales: `Merhaba! Ben ${agentName}. Satış departmanımızı aradığınız için teşekkür ederiz. Bugün size nasıl yardımcı olabilirim?`,
      support: `Merhaba! Ben ${agentName}. Destek ekibimize ulaştığınız için teşekkür ederiz. Size nasıl yardımcı olabilirim?`,
      scheduling: `Merhaba! Ben ${agentName}. Aradığınız için teşekkür ederiz. Randevu almanıza yardımcı olabilirim. Hangi gün sizin için uygun?`,
      custom: `Merhaba! ${departmentName}'i aradığınız için teşekkür ederiz. Ben ${agentName}. Bugün size nasıl yardımcı olabilirim?`,
    },
  };

  const kbQuestions: Record<string, string> = {
    en: "Let me check that for you. What would you like to know?",
    ar: "دعني أتحقق من ذلك لك. ماذا تريد أن تعرف؟",
    es: "Déjeme verificar eso por usted. ¿Qué le gustaría saber?",
    fr: "Laissez-moi vérifier cela pour vous. Que souhaitez-vous savoir ?",
    de: "Lassen Sie mich das für Sie überprüfen. Was möchten Sie wissen?",
    it: "Mi permetta di verificare. Cosa vorrebbe sapere?",
    pt: "Deixe-me verificar isso para você. O que gostaria de saber?",
    zh: "让我为您查一下。您想了解什么？",
    hi: "मुझे आपके लिए यह जांचने दीजिए। आप क्या जानना चाहेंगे?",
    ja: "確認させてください。何をお知りになりたいですか？",
    ko: "확인해 보겠습니다. 무엇을 알고 싶으신가요?",
    nl: "Laat me dat voor u controleren. Wat wilt u weten?",
    pl: "Pozwól, że to sprawdzę. Co chciałby Pan/Pani wiedzieć?",
    sv: "Låt mig kolla det åt dig. Vad vill du veta?",
    no: "La meg sjekke det for deg. Hva vil du vite?",
    fi: "Anna minun tarkistaa se sinulle. Mitä haluaisit tietää?",
    tr: "Sizin için kontrol edeyim. Ne bilmek istersiniz?",
  };

  const followUpQuestions: Record<string, string> = {
    en: "Is there anything else I can help you with, or would you like to speak with a team member?",
    ar: "هل هناك أي شيء آخر يمكنني مساعدتك فيه، أم تود التحدث مع أحد أعضاء الفريق؟",
    es: "¿Hay algo más en lo que pueda ayudarle, o le gustaría hablar con un miembro del equipo?",
    fr: "Y a-t-il autre chose que je puisse faire pour vous, ou souhaitez-vous parler à un membre de l'équipe ?",
    de: "Kann ich Ihnen noch bei etwas anderem helfen, oder möchten Sie mit einem Teammitglied sprechen?",
    it: "C'è qualcos'altro in cui posso aiutarla, o vorrebbe parlare con un membro del team?",
    pt: "Há mais alguma coisa em que posso ajudá-lo, ou gostaria de falar com um membro da equipe?",
    zh: "还有什么我可以帮您的吗，或者您想和团队成员交谈？",
    hi: "क्या कुछ और है जिसमें मैं आपकी मदद कर सकता हूँ, या आप किसी टीम सदस्य से बात करना चाहेंगे?",
    ja: "他にお手伝いできることはありますか、またはチームメンバーとお話しされますか？",
    ko: "다른 도움이 필요하신 것이 있으신가요, 아니면 팀원과 통화하시겠습니까?",
    nl: "Is er nog iets anders waarmee ik u kan helpen, of wilt u met een teamlid spreken?",
    pl: "Czy mogę jeszcze w czymś pomóc, czy chciałby Pan/Pani porozmawiać z członkiem zespołu?",
    sv: "Finns det något annat jag kan hjälpa dig med, eller vill du prata med en teammedlem?",
    no: "Er det noe annet jeg kan hjelpe deg med, eller vil du snakke med et teammedlem?",
    fi: "Onko jotain muuta, jossa voin auttaa, vai haluaisitko puhua tiimin jäsenen kanssa?",
    tr: "Size başka bir konuda yardımcı olabilir miyim, yoksa bir ekip üyesiyle konuşmak ister misiniz?",
  };

  const endCallMessages: Record<string, string> = {
    en: "Thank you for calling. Have a great day!",
    ar: "شكراً لاتصالك. أتمنى لك يوماً سعيداً!",
    es: "Gracias por llamar. ¡Que tenga un buen día!",
    fr: "Merci d'avoir appelé. Bonne journée !",
    de: "Vielen Dank für Ihren Anruf. Einen schönen Tag noch!",
    it: "Grazie per aver chiamato. Buona giornata!",
    pt: "Obrigado por ligar. Tenha um ótimo dia!",
    zh: "感谢您的来电。祝您有美好的一天！",
    hi: "कॉल करने के लिए धन्यवाद। आपका दिन शुभ हो!",
    ja: "お電話ありがとうございました。良い一日をお過ごしください！",
    ko: "전화해 주셔서 감사합니다. 좋은 하루 보내세요!",
    nl: "Bedankt voor het bellen. Een fijne dag verder!",
    pl: "Dziękuję za telefon. Miłego dnia!",
    sv: "Tack för att du ringde. Ha en bra dag!",
    no: "Takk for at du ringte. Ha en fin dag!",
    fi: "Kiitos soitosta. Hyvää päivänjatkoa!",
    tr: "Aradığınız için teşekkür ederiz. İyi günler!",
  };

  const langGreetings = greetingsByLanguage[language] || greetingsByLanguage['en'];
  const greetingMessages = langGreetings;

  const nodes: FlowNode[] = [
    {
      id: "greeting",
      type: "message",
      position: { x: 250, y: 50 },
      data: {
        label: "Greeting",
        config: {
          type: "message",
          message: greetingMessages[deptType],
          waitForResponse: false,
        },
      },
    },
    {
      id: "knowledge_base",
      type: "question",
      position: { x: 250, y: 180 },
      data: {
        label: "Knowledge Base",
        config: {
          type: "question",
          question: kbQuestions[language] || kbQuestions['en'],
          variableName: "user_question",
          expectedResponseType: "text",
          waitForResponse: true,
        },
      },
    },
    {
      id: "follow_up",
      type: "question",
      position: { x: 250, y: 310 },
      data: {
        label: "Follow Up Question",
        config: {
          type: "question",
          question: followUpQuestions[language] || followUpQuestions['en'],
          variableName: "wants_more_help",
          expectedResponseType: "yes_no",
          waitForResponse: true,
        },
      },
    },
    {
      id: "condition",
      type: "condition",
      position: { x: 250, y: 440 },
      data: {
        label: "Check Response",
        config: {
          type: "condition",
          conditions: [
            {
              type: "keyword",
              value: "transfer,human,agent,person,team,speak,talk",
              targetNodeId: "transfer",
              label: "Wants Transfer",
            },
            {
              type: "yes_no",
              value: "no",
              targetNodeId: "end",
              label: "No More Help",
            },
          ],
          defaultTargetNodeId: "knowledge_base",
        },
      },
    },
    {
      id: "transfer",
      type: "transfer",
      position: { x: 100, y: 570 },
      data: {
        label: "Transfer Call",
        config: {
          type: "transfer",
          transferNumber: "",
          message: "I'll transfer you now. Please hold.",
        },
      },
    },
    {
      id: "end",
      type: "end",
      position: { x: 400, y: 570 },
      data: {
        label: "End Call",
        config: {
          type: "end",
          message: endCallMessages[language] || endCallMessages['en'],
        },
      },
    },
  ];

  const edges: FlowEdge[] = [
    { id: "e-greeting-kb", source: "greeting", target: "knowledge_base" },
    { id: "e-kb-followup", source: "knowledge_base", target: "follow_up" },
    { id: "e-followup-condition", source: "follow_up", target: "condition" },
    { id: "e-condition-transfer", source: "condition", target: "transfer", label: "Transfer", sourceHandle: "transfer" },
    { id: "e-condition-end", source: "condition", target: "end", label: "End", sourceHandle: "end" },
    { id: "e-condition-kb", source: "condition", target: "knowledge_base", label: "More Help", sourceHandle: "default" },
  ];

  return { nodes, edges };
}

export function createDeprockRoutes(authenticateToken: (req: Request, res: Response, next: Function) => void) {
  const router = Router();

  router.get("/", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const userDepartments = await db
        .select()
        .from(departments)
        .where(and(eq(departments.userId, req.userId!), eq(departments.engineType, 'bedrock-polly')))
        .orderBy(asc(departments.sortOrder));

      res.json(userDepartments);
    } catch (error: any) {
      console.error("[Deprock] Get all error:", error);
      res.status(500).json({ error: "Failed to fetch departments" });
    }
  });

  router.get("/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const department = await db
        .select()
        .from(departments)
        .where(and(eq(departments.id, id), eq(departments.userId, req.userId!), eq(departments.engineType, 'bedrock-polly')))
        .limit(1);

      if (department.length === 0) {
        return res.status(404).json({ error: "Department not found" });
      }

      const deptAgents = await db
        .select({
          departmentAgent: departmentAgents,
          agent: agents,
        })
        .from(departmentAgents)
        .innerJoin(agents, and(eq(departmentAgents.agentId, agents.id), eq(agents.userId, req.userId!)))
        .where(eq(departmentAgents.departmentId, id));

      res.json({
        ...department[0],
        agents: deptAgents.map(da => ({
          ...da.departmentAgent,
          agent: da.agent,
        })),
      });
    } catch (error: any) {
      console.error("[Deprock] Get one error:", error);
      res.status(500).json({ error: "Failed to fetch department" });
    }
  });

  router.post("/", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const validatedData = insertDepartmentSchema.parse({
        ...req.body,
        userId: req.userId,
      });

      const existingCount = await db
        .select()
        .from(departments)
        .where(and(eq(departments.userId, req.userId!), eq(departments.engineType, 'bedrock-polly')));

      const departmentLanguage = req.body.language || 'en';
      const flowId = nanoid();
      const { nodes, edges } = generateDefaultFlowNodes(validatedData.name, "your AI assistant", departmentLanguage);

      const result = await db.transaction(async (tx) => {
        const [newFlow] = await tx
          .insert(flows)
          .values({
            id: flowId,
            userId: req.userId!,
            name: `${validatedData.name} Flow`,
            description: `Auto-generated conversation flow for ${validatedData.name} department`,
            nodes,
            edges,
            isActive: true,
            isTemplate: false,
          } as typeof flows.$inferInsert)
          .returning();

        console.log(`[Deprock] Created flow "${newFlow.name}" (${flowId}) for department "${validatedData.name}"`);

        const [newDepartment] = await tx
          .insert(departments)
          .values({
            ...validatedData,
            sortOrder: existingCount.length,
            flowId: flowId,
            engineType: 'bedrock-polly',
          })
          .returning();

        return { department: newDepartment, flow: newFlow };
      });

      res.status(201).json({ ...result.department, flow: result.flow });
    } catch (error: any) {
      console.error("[Deprock] Create error:", error);
      res.status(500).json({ error: "Failed to create department" });
    }
  });

  router.patch("/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { name, description, icon, color, isActive, sortOrder } = req.body;

      const existingDept = await db
        .select()
        .from(departments)
        .where(and(eq(departments.id, id), eq(departments.userId, req.userId!), eq(departments.engineType, 'bedrock-polly')))
        .limit(1);

      if (existingDept.length === 0) {
        return res.status(404).json({ error: "Department not found" });
      }

      const updated = await db
        .update(departments)
        .set({
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(icon !== undefined && { icon }),
          ...(color !== undefined && { color }),
          ...(isActive !== undefined && { isActive }),
          ...(sortOrder !== undefined && { sortOrder }),
          updatedAt: new Date(),
        })
        .where(and(eq(departments.id, id), eq(departments.userId, req.userId!), eq(departments.engineType, 'bedrock-polly')))
        .returning();

      res.json(updated[0]);
    } catch (error: any) {
      console.error("[Deprock] Update error:", error);
      res.status(500).json({ error: "Failed to update department" });
    }
  });

  router.post("/:id/generate-flow", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const [existingDept] = await db
        .select()
        .from(departments)
        .where(and(eq(departments.id, id), eq(departments.userId, req.userId!), eq(departments.engineType, 'bedrock-polly')))
        .limit(1);

      if (!existingDept) {
        return res.status(404).json({ error: "Department not found" });
      }

      if (existingDept.flowId) {
        return res.json({ flowId: existingDept.flowId, message: "Flow already exists" });
      }

      const deptLang = req.body.language || 'en';
      const flowId = nanoid();
      const { nodes, edges } = generateDefaultFlowNodes(existingDept.name, "your AI assistant", deptLang);

      const result = await db.transaction(async (tx) => {
        const [newFlow] = await tx
          .insert(flows)
          .values({
            id: flowId,
            userId: req.userId!,
            name: `${existingDept.name} Flow`,
            description: `Auto-generated conversation flow for ${existingDept.name} department`,
            nodes,
            edges,
            isActive: true,
            isTemplate: false,
          } as typeof flows.$inferInsert)
          .returning();

        const [updatedDept] = await tx
          .update(departments)
          .set({ flowId: flowId, updatedAt: new Date() })
          .where(and(eq(departments.id, id), eq(departments.engineType, 'bedrock-polly')))
          .returning();

        return { department: updatedDept, flow: newFlow };
      });

      console.log(`[Deprock] Generated flow for existing department "${existingDept.name}" (${flowId})`);
      res.json(result);
    } catch (error: any) {
      console.error("[Deprock] Generate flow error:", error);
      res.status(500).json({ error: "Failed to generate flow" });
    }
  });

  router.delete("/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const existingDept = await db
        .select()
        .from(departments)
        .where(and(eq(departments.id, id), eq(departments.userId, req.userId!), eq(departments.engineType, 'bedrock-polly')))
        .limit(1);

      if (existingDept.length === 0) {
        return res.status(404).json({ error: "Department not found" });
      }

      await db
        .delete(departments)
        .where(and(eq(departments.id, id), eq(departments.userId, req.userId!), eq(departments.engineType, 'bedrock-polly')));

      res.json({ success: true });
    } catch (error: any) {
      console.error("[Deprock] Delete error:", error);
      res.status(500).json({ error: "Failed to delete department" });
    }
  });

  router.post("/:id/agents", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { agentId, agentName, language, isPrimary, systemPrompt, voiceTone, voiceId } = req.body;

      const trimmedAgentName = agentName?.trim();
      if (!agentId && !trimmedAgentName) {
        return res.status(400).json({ error: "agentId or agentName is required" });
      }

      const existingDept = await db
        .select()
        .from(departments)
        .where(and(eq(departments.id, id), eq(departments.userId, req.userId!), eq(departments.engineType, 'bedrock-polly')))
        .limit(1);

      if (existingDept.length === 0) {
        return res.status(404).json({ error: "Department not found" });
      }

      let resolvedAgentId = agentId;

      if (resolvedAgentId) {
        const existingAgent = await db
          .select()
          .from(agents)
          .where(and(eq(agents.id, resolvedAgentId), eq(agents.userId, req.userId!)))
          .limit(1);

        if (existingAgent.length === 0) {
          return res.status(404).json({ error: "Agent not found" });
        }
      }

      if (!resolvedAgentId && trimmedAgentName) {
        const userKBs = await db
          .select({ id: knowledgeBase.id })
          .from(knowledgeBase)
          .where(eq(knowledgeBase.userId, req.userId!));
        const kbIds = userKBs.map(kb => kb.id);

        const [newAgent] = await db
          .insert(agents)
          .values({
            userId: req.userId!,
            name: trimmedAgentName,
            type: 'inbound',
            language: language || 'en',
            telephonyProvider: 'twilio',
            systemPrompt: systemPrompt || null,
            openaiVoice: voiceId || null,
            voiceTone: voiceTone || null,
            knowledgeBaseOnly: kbIds.length > 0,
            knowledgeBaseIds: kbIds.length > 0 ? kbIds : null,
          })
          .returning();
        resolvedAgentId = newAgent.id;
        console.log(`[Deprock] Created new agent "${trimmedAgentName}" (${newAgent.id}) for language ${language}, linked ${kbIds.length} knowledge bases`);
      }

      const newDeptAgent = await db
        .insert(departmentAgents)
        .values({
          departmentId: id,
          agentId: resolvedAgentId,
          language: language || "en",
          isPrimary: isPrimary || false,
          systemPrompt: systemPrompt || null,
          voiceTone: voiceTone || null,
        })
        .returning();

      if (systemPrompt || voiceId || voiceTone) {
        const agentUpdate: Record<string, any> = {};
        if (systemPrompt) agentUpdate.systemPrompt = systemPrompt;
        if (voiceId) agentUpdate.openaiVoice = voiceId;
        if (voiceTone) agentUpdate.voiceTone = voiceTone;

        await db
          .update(agents)
          .set(agentUpdate)
          .where(and(eq(agents.id, resolvedAgentId), eq(agents.userId, req.userId!)));

        console.log(`[Deprock] Synced agent ${resolvedAgentId} with canvas config: prompt=${!!systemPrompt}, voice=${voiceId || 'unchanged'}, tone=${voiceTone || 'unchanged'}`);
      }

      const deptData = existingDept[0];
      if (deptData.flowId) {
        if (isPrimary) {
          await db
            .update(flows)
            .set({ agentId: resolvedAgentId, updatedAt: new Date() })
            .where(eq(flows.id, deptData.flowId));
          console.log(`[Deprock] Synced flow ${deptData.flowId} with primary agent ${resolvedAgentId}`);
        } else {
          const [currentFlow] = await db
            .select()
            .from(flows)
            .where(eq(flows.id, deptData.flowId))
            .limit(1);
          if (currentFlow && !currentFlow.agentId) {
            await db
              .update(flows)
              .set({ agentId: resolvedAgentId, updatedAt: new Date() })
              .where(eq(flows.id, deptData.flowId));
            console.log(`[Deprock] Synced flow ${deptData.flowId} with agent ${resolvedAgentId} (no previous agent)`);
          }
        }
      }

      res.status(201).json(newDeptAgent[0]);
    } catch (error: any) {
      console.error("[Deprock] Add agent error:", error);
      res.status(500).json({ error: "Failed to add agent to department" });
    }
  });

  router.delete("/:id/agents/:agentId", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { id, agentId } = req.params;

      const existingDept = await db
        .select()
        .from(departments)
        .where(and(eq(departments.id, id), eq(departments.userId, req.userId!), eq(departments.engineType, 'bedrock-polly')))
        .limit(1);

      if (existingDept.length === 0) {
        return res.status(404).json({ error: "Department not found" });
      }

      await db
        .delete(departmentAgents)
        .where(and(
          eq(departmentAgents.departmentId, id),
          eq(departmentAgents.agentId, agentId)
        ));

      const deptData = existingDept[0];
      if (deptData.flowId) {
        const [currentFlow] = await db
          .select()
          .from(flows)
          .where(eq(flows.id, deptData.flowId))
          .limit(1);

        if (currentFlow && currentFlow.agentId === agentId) {
          const remainingAgents = await db
            .select()
            .from(departmentAgents)
            .where(eq(departmentAgents.departmentId, id));

          const primaryAgent = remainingAgents.find(a => a.isPrimary);
          const replacementAgentId = primaryAgent?.agentId || remainingAgents[0]?.agentId || null;

          await db
            .update(flows)
            .set({ agentId: replacementAgentId, updatedAt: new Date() })
            .where(eq(flows.id, deptData.flowId));
          console.log(`[Deprock] Updated flow ${deptData.flowId} agentId to ${replacementAgentId} after removing agent ${agentId}`);
        }
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("[Deprock] Remove agent error:", error);
      res.status(500).json({ error: "Failed to remove agent from department" });
    }
  });

  router.get("/:id/agents", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const existingDept = await db
        .select()
        .from(departments)
        .where(and(eq(departments.id, id), eq(departments.userId, req.userId!), eq(departments.engineType, 'bedrock-polly')))
        .limit(1);

      if (existingDept.length === 0) {
        return res.status(404).json({ error: "Department not found" });
      }

      const deptAgents = await db
        .select({
          departmentAgent: departmentAgents,
          agent: agents,
        })
        .from(departmentAgents)
        .innerJoin(agents, and(eq(departmentAgents.agentId, agents.id), eq(agents.userId, req.userId!)))
        .where(eq(departmentAgents.departmentId, id));

      res.json(deptAgents.map(da => ({
        ...da.departmentAgent,
        agent: da.agent,
      })));
    } catch (error: any) {
      console.error("[Deprock] Get agents error:", error);
      res.status(500).json({ error: "Failed to fetch department agents" });
    }
  });

  router.get("/ivr/all", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const ivrConfigs = await db
        .select()
        .from(ivrConfigurations)
        .where(and(eq(ivrConfigurations.userId, req.userId!), eq(ivrConfigurations.engineType, 'bedrock-polly')));

      res.json(ivrConfigs);
    } catch (error: any) {
      console.error("[Deprock] Get IVR configs error:", error);
      res.status(500).json({ error: "Failed to fetch IVR configurations" });
    }
  });

  router.post("/ivr", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { id, phoneNumberId, name, isActive, greetingMessage, voiceId, voiceName, menuOptions, languageOptions, fallbackDepartmentId } = req.body;

      if (phoneNumberId) {
        const phoneCheck = await db
          .select()
          .from(phoneNumbers)
          .where(and(eq(phoneNumbers.id, phoneNumberId), eq(phoneNumbers.userId, req.userId!)))
          .limit(1);
        if (phoneCheck.length === 0) {
          return res.status(400).json({ error: "Invalid phone number" });
        }
      }

      if (fallbackDepartmentId) {
        const deptCheck = await db
          .select()
          .from(departments)
          .where(and(eq(departments.id, fallbackDepartmentId), eq(departments.userId, req.userId!), eq(departments.engineType, 'bedrock-polly')))
          .limit(1);
        if (deptCheck.length === 0) {
          return res.status(400).json({ error: "Invalid fallback department" });
        }
      }

      if (menuOptions && Array.isArray(menuOptions)) {
        for (const option of menuOptions) {
          if (option.departmentId) {
            const optDeptCheck = await db
              .select()
              .from(departments)
              .where(and(eq(departments.id, option.departmentId), eq(departments.userId, req.userId!), eq(departments.engineType, 'bedrock-polly')))
              .limit(1);
            if (optDeptCheck.length === 0) {
              return res.status(400).json({ error: `Invalid department in menu option: ${option.label}` });
            }
          }
        }
      }

      if (id) {
        const updated = await db
          .update(ivrConfigurations)
          .set({
            phoneNumberId,
            name,
            isActive,
            greetingMessage,
            voiceId,
            voiceName,
            menuOptions,
            languageOptions,
            fallbackDepartmentId,
            updatedAt: new Date(),
          })
          .where(and(eq(ivrConfigurations.id, id), eq(ivrConfigurations.userId, req.userId!), eq(ivrConfigurations.engineType, 'bedrock-polly')))
          .returning();

        res.json(updated[0]);
      } else {
        let finalMenuOptions = menuOptions;
        if (!menuOptions || menuOptions.length === 0) {
          const userDepartments = await db
            .select()
            .from(departments)
            .where(and(eq(departments.userId, req.userId!), eq(departments.engineType, 'bedrock-polly')))
            .orderBy(asc(departments.sortOrder));
          
          if (userDepartments.length > 0) {
            finalMenuOptions = userDepartments.map((dept, idx) => ({
              key: String(idx + 1),
              label: dept.name,
              departmentId: dept.id,
            }));
            console.log(`[Deprock] Auto-populated ${finalMenuOptions.length} departments into menu options`);
          }
        }

        const newIvr = await db
          .insert(ivrConfigurations)
          .values({
            userId: req.userId!,
            phoneNumberId,
            name: name || "Auto Distribution",
            isActive: isActive ?? true,
            greetingMessage,
            voiceId,
            voiceName,
            menuOptions: finalMenuOptions,
            languageOptions,
            fallbackDepartmentId,
            engineType: 'bedrock-polly',
          })
          .returning();

        if (phoneNumberId && (isActive ?? true)) {
          try {
            const phoneRecord = await db
              .select()
              .from(phoneNumbers)
              .where(eq(phoneNumbers.id, phoneNumberId))
              .limit(1);
            
            if (phoneRecord.length > 0 && phoneRecord[0].twilioSid) {
              const domain = getDomain();
              const webhookUrl = `${domain}/api/webhooks/twilio/incoming`;
              console.log(`[Deprock] Configuring Twilio webhook for phone ${phoneRecord[0].phoneNumber}: ${webhookUrl}`);
              await twilioService.updatePhoneNumber(phoneRecord[0].twilioSid, { voiceUrl: webhookUrl });
              console.log(`[Deprock] Twilio webhook configured successfully`);
            }
          } catch (twilioError: any) {
            console.error("[Deprock] Failed to configure Twilio webhook:", twilioError.message);
          }
        }

        res.status(201).json(newIvr[0]);
      }
    } catch (error: any) {
      console.error("[Deprock] Save IVR config error:", error);
      res.status(500).json({ error: "Failed to save IVR configuration" });
    }
  });

  router.patch("/ivr/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { name, isActive, greetingMessage, voiceId, languageOptions } = req.body;

      const updateData: Record<string, any> = { updatedAt: new Date() };
      if (name !== undefined) updateData.name = name;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (greetingMessage !== undefined) updateData.greetingMessage = greetingMessage;
      if (voiceId !== undefined) updateData.voiceId = voiceId;
      if (languageOptions !== undefined) updateData.languageOptions = languageOptions;

      const updated = await db
        .update(ivrConfigurations)
        .set(updateData)
        .where(and(eq(ivrConfigurations.id, id), eq(ivrConfigurations.userId, req.userId!), eq(ivrConfigurations.engineType, 'bedrock-polly')))
        .returning();

      if (updated.length === 0) {
        return res.status(404).json({ error: "IVR configuration not found" });
      }

      res.json(updated[0]);
    } catch (error: any) {
      console.error("[Deprock] Update IVR config error:", error);
      res.status(500).json({ error: "Failed to update IVR configuration" });
    }
  });

  router.delete("/ivr/:id", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      await db
        .delete(ivrConfigurations)
        .where(and(eq(ivrConfigurations.id, id), eq(ivrConfigurations.userId, req.userId!), eq(ivrConfigurations.engineType, 'bedrock-polly')));

      res.json({ success: true });
    } catch (error: any) {
      console.error("[Deprock] Delete IVR config error:", error);
      res.status(500).json({ error: "Failed to delete IVR configuration" });
    }
  });

  router.get("/stats/overview", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const userDepartments = await db
        .select()
        .from(departments)
        .where(and(eq(departments.userId, req.userId!), eq(departments.engineType, 'bedrock-polly')))
        .orderBy(asc(departments.sortOrder));

      const deptStats = await Promise.all(
        userDepartments.map(async (dept) => {
          const deptAgentData = await db
            .select({
              departmentAgent: departmentAgents,
              agent: agents,
            })
            .from(departmentAgents)
            .innerJoin(agents, eq(departmentAgents.agentId, agents.id))
            .where(eq(departmentAgents.departmentId, dept.id));

          return {
            ...dept,
            agentCount: deptAgentData.length,
            languages: [...new Set(deptAgentData.map(a => a.departmentAgent.language))],
            assignedAgents: deptAgentData.map(da => ({
              id: da.departmentAgent.id,
              agentId: da.departmentAgent.agentId,
              agentName: da.agent.name,
              language: da.departmentAgent.language,
            })),
          };
        })
      );

      const ivrConfigs = await db
        .select()
        .from(ivrConfigurations)
        .where(and(eq(ivrConfigurations.userId, req.userId!), eq(ivrConfigurations.engineType, 'bedrock-polly')));

      const activeIvrCount = ivrConfigs.filter(ivr => ivr.isActive).length;

      res.json({
        departments: deptStats,
        totalDepartments: userDepartments.length,
        activeIvrCount,
        ivrConfigurations: ivrConfigs,
      });
    } catch (error: any) {
      console.error("[Deprock] Get stats error:", error);
      res.status(500).json({ error: "Failed to fetch department stats" });
    }
  });

  router.delete("/all/clear", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      await db
        .delete(incomingConnections)
        .where(eq(incomingConnections.userId, req.userId!));

      await db
        .delete(humanIncomingConnections)
        .where(eq(humanIncomingConnections.userId, req.userId!));

      await db
        .delete(departments)
        .where(and(eq(departments.userId, req.userId!), eq(departments.engineType, 'bedrock-polly')));

      await db
        .delete(ivrConfigurations)
        .where(and(eq(ivrConfigurations.userId, req.userId!), eq(ivrConfigurations.engineType, 'bedrock-polly')));

      res.json({ success: true });
    } catch (error: any) {
      console.error("[Deprock] Delete all error:", error);
      res.status(500).json({ error: "Failed to delete all departments" });
    }
  });

  router.post("/voice-preview", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { voiceId, text } = req.body;
      if (!voiceId || !text) {
        return res.status(400).json({ error: "voiceId and text are required" });
      }
      
      const result = await awsPollyService.synthesizeSpeech({
        text,
        voiceId,
        engine: 'neural',
        outputFormat: 'mp3',
      });
      
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Content-Disposition", "inline; filename=preview.mp3");
      res.send(result.audioStream);
    } catch (error: any) {
      console.error("[Deprock] Voice preview error:", error);
      res.status(500).json({ error: error.message || "Failed to generate voice preview" });
    }
  });

  router.post("/generate-prompt", authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const { departmentType, departmentName, language, agentName, features } = req.body;
      const userId = req.userId!;

      if (!departmentType || !departmentName) {
        return res.status(400).json({ error: "departmentType and departmentName are required" });
      }

      const langLabel = language || "English";
      const featuresList: string[] = [];
      if (features?.enableLanguageDetection) featuresList.push("auto-detect caller language and respond in their language");
      if (features?.enableEndConversation) featuresList.push("intelligently end conversations when appropriate using farewell phrases");
      if (features?.enableAppointmentBooking) featuresList.push("book appointments during calls");
      if (features?.enableRecording) featuresList.push("inform callers that the call is being recorded for quality and training");
      if (features?.enableTransfer) featuresList.push("transfer calls to human operators when needed");

      const featuresContext = featuresList.length > 0
        ? `\nThe agent has these features enabled: ${featuresList.join(", ")}.`
        : "";

      const agentNameContext = agentName
        ? `\nThe agent's name is "${agentName}". Use this name when the agent introduces itself. The name should appear naturally in the language of the prompt.`
        : "";

      let companyContext = "";
      try {
        const kbEntries = await db
          .select({ title: knowledgeBase.title, content: knowledgeBase.content, type: knowledgeBase.type })
          .from(knowledgeBase)
          .where(eq(knowledgeBase.userId, userId));

        if (kbEntries.length > 0) {
          const summaryParts: string[] = [];
          for (const entry of kbEntries) {
            const snippet = entry.content ? entry.content.substring(0, 300) : "";
            if (snippet) {
              summaryParts.push(`- ${entry.title}: ${snippet}`);
            } else {
              summaryParts.push(`- ${entry.title} (${entry.type})`);
            }
            if (summaryParts.length >= 15) break;
          }
          companyContext = `\n\nCOMPANY KNOWLEDGE BASE (use this to personalize the prompt with real company details, products, services, and policies):\n${summaryParts.join("\n")}`;
        }
      } catch (kbErr) {
        console.warn("[Deprock] Could not fetch knowledge base for prompt generation:", kbErr);
      }

      const openai = await getOpenAIClient();
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        max_completion_tokens: 1500,
        messages: [
          {
            role: "system",
            content: `You are an expert at writing system prompts for AI phone call agents. Generate a professional, detailed system prompt for a department agent. The prompt should be specific to the department's purpose and include behavioral guidelines, tone instructions, and handling procedures. If company knowledge base information is provided, use it to personalize the prompt with real company details — reference actual products, services, policies, and brand identity instead of using generic placeholders. The entire prompt MUST be written in ${langLabel}. Output ONLY the system prompt text, no explanations or markdown.`
          },
          {
            role: "user",
            content: `Generate a system prompt for a "${departmentName}" department agent.
Department type: ${departmentType}
Primary language: ${langLabel}${agentNameContext}${featuresContext}${companyContext}

The prompt should:
- Define the agent's role clearly for a ${departmentType} department
- Use the department name "${departmentName}" as it is (already translated to ${langLabel})
- Set the appropriate tone and communication style
- Include specific handling procedures for ${departmentType} scenarios
- Provide guidelines for common ${departmentType} situations
- Be professional yet conversational
- If company knowledge base data is available, incorporate specific company details (products, services, policies, brand name) into the prompt instead of generic placeholders
- The ENTIRE prompt must be written in ${langLabel}`
          }
        ],
      });

      const generatedPrompt = response.choices[0]?.message?.content?.trim() || "";
      res.json({ prompt: generatedPrompt });
    } catch (error: any) {
      console.error("[Deprock] Generate prompt error:", error);
      res.status(500).json({ error: error.message || "Failed to generate prompt" });
    }
  });

  return router;
}

export function createDeprockIvrAudioRoutes() {
  const router = Router();

  router.get("/ivr-greeting-audio/:ivrId", async (req: Request, res: Response) => {
    try {
      const { ivrId } = req.params;
      const textParam = req.query.text as string | undefined;
      const voiceIdParam = req.query.voiceId as string | undefined;
      const langIdx = req.query.idx as string | undefined;

      const ivrConfig = await db
        .select()
        .from(ivrConfigurations)
        .where(and(eq(ivrConfigurations.id, ivrId), eq(ivrConfigurations.engineType, 'bedrock-polly')))
        .limit(1);

      if (!ivrConfig.length) {
        return res.status(404).json({ error: "IVR configuration not found" });
      }

      const config = ivrConfig[0];
      let voiceId = voiceIdParam || config.voiceId || "Joanna";
      let text = textParam || config.greetingMessage || "Thank you for calling.";

      if (langIdx !== undefined) {
        const langOptions = config.languageOptions as { voiceId?: string; greeting?: string }[] | null;
        const idx = parseInt(langIdx, 10);
        if (langOptions && langOptions[idx]) {
          if (!voiceIdParam && langOptions[idx].voiceId) {
            voiceId = langOptions[idx].voiceId!;
          }
          if (!textParam && langOptions[idx].greeting) {
            text = langOptions[idx].greeting!;
          }
        }
      }

      const cacheKey = `deprock-${ivrId}-${voiceId}-${hashText(text)}`;
      const cached = deprockTtsAudioCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < DEPROCK_TTS_CACHE_TTL) {
        res.setHeader("Content-Type", "audio/mpeg");
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        return res.send(cached.buffer);
      }

      const result = await awsPollyService.synthesizeSpeech({
        text,
        voiceId,
        engine: 'neural',
        outputFormat: 'mp3',
      });

      const audioBuffer = result.audioStream;

      deprockTtsAudioCache.set(cacheKey, { buffer: audioBuffer, timestamp: Date.now() });

      if (deprockTtsAudioCache.size > 100) {
        const now = Date.now();
        for (const [key, val] of deprockTtsAudioCache) {
          if (now - val.timestamp > DEPROCK_TTS_CACHE_TTL) {
            deprockTtsAudioCache.delete(key);
          }
        }
      }

      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.send(audioBuffer);
    } catch (error: any) {
      console.error("[Deprock IVR Audio] Error generating TTS audio:", error);
      res.status(500).json({ error: error.message || "Failed to generate audio" });
    }
  });

  return router;
}

const deprockTtsAudioCache = new Map<string, { buffer: Buffer; timestamp: number }>();
const DEPROCK_TTS_CACHE_TTL = 10 * 60 * 1000;

function hashText(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const chr = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return hash.toString(36);
}
