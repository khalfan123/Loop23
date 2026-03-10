import PDFDocument from "pdfkit";
import { AWSPollyService } from "./aws-polly";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { bedrockKBService } from "./bedrock-knowledge-base.service";
import type {
  SynthesizedKnowledge,
  BusinessProfile,
  SynthesizedFAQ,
  DecisionTree,
  ObjectionHandler,
  EscalationTrigger,
} from "./knowledge-synthesis";

export interface GeneratedMedia {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  description: string;
  mediaType: "pdf" | "audio" | "image";
}

export interface MediaGenerationResult {
  files: GeneratedMedia[];
  errors: string[];
}

const pollyService = new AWSPollyService();

class KBMediaGeneratorService {
  private getBedrockRuntimeClient(): BedrockRuntimeClient {
    return new BedrockRuntimeClient({
      region: process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }

  async generateAllMedia(
    synthesized: SynthesizedKnowledge,
    userId: string,
    options: { pdf?: boolean; audio?: boolean; images?: boolean } = {}
  ): Promise<MediaGenerationResult> {
    const { pdf = true, audio = true, images = true } = options;
    const results: GeneratedMedia[] = [];
    const errors: string[] = [];

    const tasks: Promise<void>[] = [];

    if (pdf) {
      tasks.push(
        this.generatePDF(synthesized)
          .then((file) => { results.push(file); })
          .catch((err) => { errors.push(`PDF: ${err.message}`); })
      );
    }

    if (audio && pollyService.isConfigured()) {
      tasks.push(
        this.generateAudioSummary(synthesized)
          .then((file) => { results.push(file); })
          .catch((err) => { errors.push(`Audio: ${err.message}`); })
      );
    }

    if (images) {
      tasks.push(
        this.generateImages(synthesized)
          .then((files) => { results.push(...files); })
          .catch((err) => { errors.push(`Images: ${err.message}`); })
      );
    }

    await Promise.all(tasks);

    for (const file of results) {
      try {
        await bedrockKBService.uploadFile(
          userId,
          file.buffer,
          file.fileName,
          file.mimeType
        );
        console.log(`[KBMediaGen] Uploaded ${file.fileName} to Bedrock KB for user ${userId}`);
      } catch (err: any) {
        errors.push(`Upload ${file.fileName}: ${err.message}`);
      }
    }

    if (results.length > 0) {
      try {
        await bedrockKBService.syncKnowledgeBase(userId);
        console.log(`[KBMediaGen] Triggered Bedrock KB sync for user ${userId}`);
      } catch (err: any) {
        errors.push(`Sync: ${err.message}`);
      }
    }

    return { files: results, errors };
  }

  async generatePDF(synthesized: SynthesizedKnowledge): Promise<GeneratedMedia> {
    const { businessProfile, faqs, decisionTrees, objectionHandlers, competitiveIntelligence, escalationTriggers } = synthesized;
    const companyName = businessProfile?.companyName || "Knowledge Base";

    return new Promise<GeneratedMedia>((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: "A4", margin: 50 });
        const chunks: Buffer[] = [];

        doc.on("data", (chunk: Buffer) => chunks.push(chunk));
        doc.on("end", () => {
          const buffer = Buffer.concat(chunks);
          resolve({
            buffer,
            fileName: `${sanitizeFilename(companyName)}_knowledge_base.pdf`,
            mimeType: "application/pdf",
            description: `Complete knowledge base document for ${companyName}`,
            mediaType: "pdf",
          });
        });
        doc.on("error", reject);

        doc.fontSize(24).font("Helvetica-Bold").text(companyName, { align: "center" });
        doc.moveDown(0.5);
        doc.fontSize(12).font("Helvetica").fillColor("#666666")
          .text("AI Knowledge Base Document", { align: "center" });
        doc.moveDown(0.3);
        doc.fontSize(10).text(`Generated: ${new Date().toLocaleDateString()}`, { align: "center" });
        doc.moveDown(0.3);
        doc.fontSize(10).text(`Source: ${synthesized.sourceUrl || "N/A"}`, { align: "center" });
        doc.fillColor("#000000");
        doc.moveDown(1);

        addDivider(doc);

        if (businessProfile) {
          addSectionHeader(doc, "Business Profile");

          if (businessProfile.industry) {
            addField(doc, "Industry", businessProfile.industry);
          }
          if (businessProfile.description) {
            addField(doc, "Description", businessProfile.description);
          }
          if (businessProfile.targetMarket) {
            addField(doc, "Target Market", businessProfile.targetMarket);
          }
          if (businessProfile.valueProposition) {
            addField(doc, "Value Proposition", businessProfile.valueProposition);
          }
          if (businessProfile.differentiators?.length) {
            addField(doc, "Key Differentiators", businessProfile.differentiators.join("; "));
          }

          if (businessProfile.contactInfo) {
            const ci = businessProfile.contactInfo;
            const contactParts: string[] = [];
            if (ci.phones?.length) contactParts.push(`Phone: ${ci.phones.join(", ")}`);
            if (ci.emails?.length) contactParts.push(`Email: ${ci.emails.join(", ")}`);
            if (ci.businessHours) contactParts.push(`Hours: ${ci.businessHours}`);
            if (ci.website) contactParts.push(`Web: ${ci.website}`);
            if (contactParts.length) {
              addField(doc, "Contact", contactParts.join(" | "));
            }
          }

          if (businessProfile.products?.length) {
            doc.moveDown(0.5);
            doc.fontSize(13).font("Helvetica-Bold").text("Products & Services");
            doc.moveDown(0.3);
            for (const product of businessProfile.products) {
              doc.fontSize(11).font("Helvetica-Bold").text(`• ${product.name}`);
              if (product.description) {
                doc.fontSize(10).font("Helvetica").text(`  ${product.description}`);
              }
              if (product.pricing) {
                doc.fontSize(10).font("Helvetica").text(`  Pricing: ${product.pricing}`);
              }
              if (product.features?.length) {
                doc.fontSize(10).font("Helvetica").text(`  Features: ${product.features.join(", ")}`);
              }
              doc.moveDown(0.3);
            }
          }
          doc.moveDown(0.5);
          addDivider(doc);
        }

        if (faqs?.length) {
          addSectionHeader(doc, `Frequently Asked Questions (${faqs.length})`);
          const topFaqs = faqs.slice(0, 30);
          for (let i = 0; i < topFaqs.length; i++) {
            const faq = topFaqs[i];
            checkPageBreak(doc);
            doc.fontSize(10).font("Helvetica-Bold").text(`Q${i + 1}: ${faq.question}`);
            doc.fontSize(10).font("Helvetica").text(`A: ${faq.answer}`);
            if (faq.category) {
              doc.fontSize(9).fillColor("#888888").text(`Category: ${faq.category}`);
              doc.fillColor("#000000");
            }
            doc.moveDown(0.4);
          }
          if (faqs.length > 30) {
            doc.fontSize(9).fillColor("#888888")
              .text(`... and ${faqs.length - 30} more FAQs`);
            doc.fillColor("#000000");
          }
          doc.moveDown(0.5);
          addDivider(doc);
        }

        if (decisionTrees?.length) {
          addSectionHeader(doc, "Decision Trees & Workflows");
          for (const tree of decisionTrees) {
            checkPageBreak(doc);
            doc.fontSize(11).font("Helvetica-Bold").text(`Scenario: ${tree.scenario}`);
            for (const step of tree.steps) {
              doc.fontSize(10).font("Helvetica")
                .text(`  IF: ${step.condition} → ${step.action}${step.nextStep ? ` → Next: ${step.nextStep}` : ""}`);
            }
            doc.moveDown(0.4);
          }
          doc.moveDown(0.5);
          addDivider(doc);
        }

        if (objectionHandlers?.length) {
          addSectionHeader(doc, "Objection Handling");
          for (const oh of objectionHandlers) {
            checkPageBreak(doc);
            doc.fontSize(10).font("Helvetica-Bold").text(`Objection: "${oh.objection}"`);
            doc.fontSize(10).font("Helvetica").text(`Response: ${oh.response}`);
            doc.moveDown(0.3);
          }
          doc.moveDown(0.5);
          addDivider(doc);
        }

        if (competitiveIntelligence) {
          addSectionHeader(doc, "Competitive Intelligence");
          if (competitiveIntelligence.positioning) {
            addField(doc, "Market Positioning", competitiveIntelligence.positioning);
          }
          if (competitiveIntelligence.advantages?.length) {
            addField(doc, "Key Advantages", competitiveIntelligence.advantages.join("; "));
          }
          if (competitiveIntelligence.targetComparison) {
            addField(doc, "Competitive Comparison", competitiveIntelligence.targetComparison);
          }
          doc.moveDown(0.5);
          addDivider(doc);
        }

        if (escalationTriggers?.length) {
          addSectionHeader(doc, "Escalation Triggers");
          for (const et of escalationTriggers) {
            checkPageBreak(doc);
            doc.fontSize(10).font("Helvetica-Bold").text(`Trigger: ${et.trigger}`);
            doc.fontSize(10).font("Helvetica").text(`Reason: ${et.reason}`);
            doc.fontSize(10).font("Helvetica").text(`Action: ${et.suggestedAction}`);
            doc.moveDown(0.3);
          }
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  async generateAudioSummary(
    synthesized: SynthesizedKnowledge,
    language: string = "en"
  ): Promise<GeneratedMedia> {
    const { businessProfile, faqs } = synthesized;
    const companyName = businessProfile?.companyName || "this company";

    let script = buildAudioScript(companyName, businessProfile, faqs || [], language);

    if (script.length > 3000) {
      script = script.substring(0, 3000);
      const lastSentence = script.lastIndexOf(".");
      if (lastSentence > 2000) script = script.substring(0, lastSentence + 1);
    }

    const voiceId = getPollyVoice(language);

    const result = await pollyService.synthesizeSpeech({
      text: script,
      voiceId,
      engine: "neural",
      outputFormat: "mp3",
      textType: "text",
    });

    return {
      buffer: result.audioStream,
      fileName: `${sanitizeFilename(companyName)}_audio_summary.mp3`,
      mimeType: "audio/mpeg",
      description: `Audio summary of ${companyName} knowledge base (${Math.ceil(script.length / 150)} min approx)`,
      mediaType: "audio",
    };
  }

  async generateImages(synthesized: SynthesizedKnowledge): Promise<GeneratedMedia[]> {
    const { businessProfile } = synthesized;
    if (!businessProfile) return [];

    const prompts = buildImagePrompts(businessProfile);
    const results: GeneratedMedia[] = [];

    for (const prompt of prompts.slice(0, 3)) {
      try {
        const buffer = await this.generateImageViaBedrock(prompt.prompt);
        if (buffer) {
          results.push({
            buffer,
            fileName: `${sanitizeFilename(prompt.name)}.png`,
            mimeType: "image/png",
            description: prompt.description,
            mediaType: "image",
          });
        }
      } catch (err: any) {
        console.warn(`[KBMediaGen] Image generation failed for "${prompt.name}":`, err.message);
      }
    }

    return results;
  }

  private async generateImageViaBedrock(prompt: string): Promise<Buffer | null> {
    const client = this.getBedrockRuntimeClient();

    try {
      const command = new InvokeModelCommand({
        modelId: "amazon.titan-image-generator-v1",
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          taskType: "TEXT_IMAGE",
          textToImageParams: {
            text: prompt,
          },
          imageGenerationConfig: {
            numberOfImages: 1,
            height: 768,
            width: 1024,
            cfgScale: 8.0,
          },
        }),
      });

      const response = await client.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));

      if (responseBody.images && responseBody.images.length > 0) {
        return Buffer.from(responseBody.images[0], "base64");
      }
      return null;
    } catch (err: any) {
      if (err.name === "AccessDeniedException" || err.name === "ValidationException") {
        console.warn(`[KBMediaGen] Titan Image not available, trying Stability AI...`);
        return this.generateImageViaStability(prompt);
      }
      throw err;
    }
  }

  private async generateImageViaStability(prompt: string): Promise<Buffer | null> {
    const client = this.getBedrockRuntimeClient();

    try {
      const command = new InvokeModelCommand({
        modelId: "stability.stable-diffusion-xl-v1",
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          text_prompts: [
            { text: prompt, weight: 1.0 },
            { text: "blurry, low quality, watermark, text overlay", weight: -1.0 },
          ],
          cfg_scale: 7,
          height: 768,
          width: 1024,
          steps: 30,
          seed: Math.floor(Math.random() * 1000000),
        }),
      });

      const response = await client.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));

      if (responseBody.artifacts && responseBody.artifacts.length > 0) {
        return Buffer.from(responseBody.artifacts[0].base64, "base64");
      }
      return null;
    } catch (err: any) {
      console.warn(`[KBMediaGen] Stability AI also unavailable:`, err.message);
      return null;
    }
  }
}

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .substring(0, 50);
}

function addSectionHeader(doc: PDFKit.PDFDocument, title: string) {
  checkPageBreak(doc);
  doc.moveDown(0.3);
  doc.fontSize(16).font("Helvetica-Bold").text(title);
  doc.moveDown(0.5);
}

function addField(doc: PDFKit.PDFDocument, label: string, value: string) {
  doc.fontSize(10).font("Helvetica-Bold").text(`${label}: `, { continued: true });
  doc.font("Helvetica").text(value);
  doc.moveDown(0.2);
}

function addDivider(doc: PDFKit.PDFDocument) {
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke("#CCCCCC");
  doc.moveDown(0.5);
}

function checkPageBreak(doc: PDFKit.PDFDocument) {
  if (doc.y > 700) {
    doc.addPage();
  }
}

function buildAudioScript(
  companyName: string,
  profile: BusinessProfile | null | undefined,
  faqs: SynthesizedFAQ[],
  language: string
): string {
  const parts: string[] = [];

  parts.push(`Welcome to the ${companyName} knowledge base summary.`);

  if (profile) {
    if (profile.description) {
      parts.push(profile.description);
    }
    if (profile.valueProposition) {
      parts.push(`Our value proposition is: ${profile.valueProposition}`);
    }
    if (profile.products?.length) {
      const productNames = profile.products.map((p) => p.name).join(", ");
      parts.push(`We offer the following products and services: ${productNames}.`);
      for (const product of profile.products.slice(0, 3)) {
        if (product.description) {
          parts.push(`${product.name}: ${product.description}`);
        }
      }
    }
    if (profile.differentiators?.length) {
      parts.push(`What sets us apart: ${profile.differentiators.slice(0, 3).join(". ")}.`);
    }
  }

  if (faqs.length > 0) {
    parts.push("Here are the most frequently asked questions.");
    for (const faq of faqs.slice(0, 10)) {
      parts.push(`Question: ${faq.question}. Answer: ${faq.answer}`);
    }
  }

  parts.push(`That concludes the ${companyName} knowledge base summary. Thank you for listening.`);

  return parts.join(" ");
}

function getPollyVoice(language: string): string {
  const voiceMap: Record<string, string> = {
    en: "Joanna",
    ar: "Zeina",
    es: "Lucia",
    fr: "Lea",
    de: "Vicki",
    it: "Bianca",
    ja: "Mizuki",
    ko: "Seoyeon",
    pt: "Camila",
    zh: "Zhiyu",
    hi: "Kajal",
    nl: "Laura",
    pl: "Ola",
    ru: "Tatyana",
    tr: "Filiz",
  };
  const langCode = language.split("-")[0].toLowerCase();
  return voiceMap[langCode] || "Joanna";
}

function buildImagePrompts(
  profile: BusinessProfile
): Array<{ name: string; prompt: string; description: string }> {
  const prompts: Array<{ name: string; prompt: string; description: string }> = [];
  const company = profile.companyName || "Business";
  const industry = profile.industry || "business";

  prompts.push({
    name: `${company}_hero_banner`,
    prompt: `Professional modern hero banner for a ${industry} company called ${company}. Clean corporate design, subtle gradient background, abstract geometric shapes representing innovation and trust. No text or logos. High quality, photorealistic, professional lighting.`,
    description: `Hero banner image for ${company}`,
  });

  if (profile.products?.length) {
    const topProduct = profile.products[0];
    prompts.push({
      name: `${company}_product_${topProduct.name}`,
      prompt: `Professional product showcase image for "${topProduct.name}" - ${topProduct.description || industry + " product"}. Clean white background, modern minimalist style, professional product photography, soft lighting, high detail. No text.`,
      description: `Product image for ${topProduct.name}`,
    });
  }

  prompts.push({
    name: `${company}_service_overview`,
    prompt: `Modern infographic-style illustration representing ${industry} services. Abstract icons and visual elements showing ${profile.differentiators?.slice(0, 2).join(" and ") || "professional services"}. Clean, minimal, corporate color palette, flat design style. No text.`,
    description: `Service overview illustration for ${company}`,
  });

  return prompts;
}

export const kbMediaGenerator = new KBMediaGeneratorService();
