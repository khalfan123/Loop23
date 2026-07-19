import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Lightweight Cursor-style markdown for Copilot replies (no extra deps). */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // bold **...**, then `code`, then plain
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      nodes.push(text.slice(last, m.index));
    }
    const token = m[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      nodes.push(
        <strong key={`${keyPrefix}-b-${i++}`} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push(
        <code
          key={`${keyPrefix}-c-${i++}`}
          className="rounded-md bg-muted/80 px-1.5 py-0.5 text-[12px] font-medium text-foreground"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("*") && token.endsWith("*")) {
      nodes.push(
        <em key={`${keyPrefix}-i-${i++}`} className="italic text-foreground/85">
          {token.slice(1, -1)}
        </em>,
      );
    }
    last = m.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function CopilotMarkdown({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let blockKey = 0;

  while (i < lines.length) {
    const line = lines[i];

    // fenced code
    if (line.trimStart().startsWith("```")) {
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        code.push(lines[i]);
        i += 1;
      }
      i += 1; // closing fence
      blocks.push(
        <pre
          key={`code-${blockKey++}`}
          className="my-2 overflow-x-auto rounded-lg border border-border/50 bg-muted/50 px-3 py-2 text-[12px] leading-relaxed"
        >
          <code>{code.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    // blank
    if (!line.trim()) {
      i += 1;
      continue;
    }

    // heading ## / ###
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2];
      const cls =
        level === 1
          ? "text-[15px] font-bold mt-3 mb-1.5"
          : level === 2
            ? "text-[14px] font-bold mt-2.5 mb-1"
            : "text-[13px] font-semibold mt-2 mb-1";
      blocks.push(
        <p key={`h-${blockKey++}`} className={cn(cls, "text-foreground tracking-tight")}>
          {renderInline(text, `h${blockKey}`)}
        </p>,
      );
      i += 1;
      continue;
    }

    // unordered list block
    if (/^\s*[-*•]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*•]\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ul key={`ul-${blockKey++}`} className="my-1.5 space-y-1.5 pl-0 list-none">
          {items.map((item, idx) => (
            <li key={idx} className="flex gap-2 text-[13px] leading-relaxed">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/50" />
              <span className="min-w-0">{renderInline(item, `ul-${blockKey}-${idx}`)}</span>
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    // numbered list
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.)]\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ol key={`ol-${blockKey++}`} className="my-1.5 space-y-2 pl-0 list-none counter-reset">
          {items.map((item, idx) => (
            <li key={idx} className="flex gap-2.5 text-[13px] leading-relaxed">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-[11px] font-bold text-foreground">
                {idx + 1}
              </span>
              <span className="min-w-0 pt-0.5">{renderInline(item, `ol-${blockKey}-${idx}`)}</span>
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    // quote / callout
    if (/^\s*>\s?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^\s*>\s?/, ""));
        i += 1;
      }
      blocks.push(
        <div
          key={`q-${blockKey++}`}
          className="my-2 rounded-lg border-l-[3px] border-primary/50 bg-primary/5 px-3 py-2 text-[13px] leading-relaxed"
        >
          {quote.map((q, qi) => (
            <p key={qi} className={qi > 0 ? "mt-1" : undefined}>
              {renderInline(q, `q-${blockKey}-${qi}`)}
            </p>
          ))}
        </div>,
      );
      continue;
    }

    // paragraph (merge consecutive plain lines)
    const para: string[] = [line];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,3})\s+/.test(lines[i]) &&
      !/^\s*[-*•]\s+/.test(lines[i]) &&
      !/^\s*\d+[.)]\s+/.test(lines[i]) &&
      !/^\s*>\s?/.test(lines[i]) &&
      !lines[i].trimStart().startsWith("```")
    ) {
      para.push(lines[i]);
      i += 1;
    }
    blocks.push(
      <p key={`p-${blockKey++}`} className="text-[13px] leading-[1.55] text-foreground/90">
        {renderInline(para.join(" "), `p-${blockKey}`)}
      </p>,
    );
  }

  return <div className="space-y-1">{blocks}</div>;
}

export function CopilotChatMessage({
  role,
  content,
  muted = false,
  pendingConfirmation = false,
  onConfirm,
  onCancel,
  confirming = false,
}: {
  role: "user" | "assistant";
  content: string;
  /** Muted/secondary styling for welcome and similar intro bubbles. */
  muted?: boolean;
  pendingConfirmation?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirming?: boolean;
}) {
  if (role === "user") {
    return (
      <div
        className="ml-8 rounded-2xl bg-primary px-3.5 py-2.5 text-[13px] font-medium leading-relaxed text-primary-foreground whitespace-pre-wrap"
        data-testid="copilot-msg-user"
      >
        {content}
      </div>
    );
  }

  return (
    <div className="mr-1 space-y-1" data-testid="copilot-msg-assistant">
      <div className="flex items-center gap-1.5 px-0.5">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-foreground text-[10px] font-bold text-background">
          C
        </span>
        <span className="text-[11px] font-semibold tracking-wide text-muted-foreground">
          Copilot
        </span>
      </div>
      <div
        className={cn(
          "rounded-2xl border border-border/40 bg-white dark:bg-zinc-900/80 px-3.5 py-3 shadow-sm",
          muted && "text-muted-foreground [&_p]:text-muted-foreground [&_strong]:text-muted-foreground [&_em]:text-muted-foreground",
        )}
      >
        {muted ? (
          <p className="text-[13px] leading-[1.55] text-muted-foreground whitespace-pre-wrap">
            {content}
          </p>
        ) : (
          <CopilotMarkdown content={content} />
        )}
        {pendingConfirmation && (onConfirm || onCancel) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {onConfirm && (
              <button
                type="button"
                disabled={confirming}
                onClick={onConfirm}
                className="rounded-lg bg-foreground px-3 py-1.5 text-[12px] font-semibold text-background disabled:opacity-60"
                data-testid="button-copilot-confirm"
              >
                {confirming ? "Confirming…" : "Yes, confirm"}
              </button>
            )}
            {onCancel && (
              <button
                type="button"
                disabled={confirming}
                onClick={onCancel}
                className="rounded-lg border border-border px-3 py-1.5 text-[12px] font-medium text-foreground disabled:opacity-60"
                data-testid="button-copilot-cancel-confirm"
              >
                Cancel
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
