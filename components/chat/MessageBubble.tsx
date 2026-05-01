import { Message } from "@/store/chat";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bot, User } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

interface MessageBubbleProps {
  message: Message;
}

const markdownComponents: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
  h1: ({ children }) => (
    <h1 className="font-display font-bold text-base mt-3 mb-2 first:mt-0 text-foreground">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="font-display font-semibold text-sm mt-3 mb-2 first:mt-0 text-foreground">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="font-display font-semibold text-sm mt-2 mb-1 first:mt-0 text-foreground">
      {children}
    </h3>
  ),
  ul: ({ children }) => (
    <ul className="my-2 ml-4 list-disc space-y-1 marker:text-primary/60">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 ml-4 list-decimal space-y-1 marker:text-primary/60">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-ctp-blue underline decoration-ctp-blue/40 underline-offset-2 hover:decoration-ctp-blue"
    >
      {children}
    </a>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-primary/40 pl-3 text-muted-foreground italic">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-border" />,
  code: ({ className, children, ...props }) => {
    const isInline = !className?.includes("language-");
    if (isInline) {
      return (
        <code
          className="rounded bg-ctp-surface0 px-1.5 py-0.5 font-mono text-[0.85em] text-ctp-peach"
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code className={cn("font-mono text-xs", className)} {...props}>
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-md bg-ctp-crust ring-1 ring-border p-3 text-xs leading-relaxed">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto rounded-md ring-1 ring-border">
      <table className="w-full text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-ctp-surface0">{children}</thead>,
  th: ({ children }) => (
    <th className="px-3 py-1.5 text-left font-semibold text-foreground border-b border-border">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-1.5 border-b border-border/50 last:border-0">{children}</td>
  ),
};

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3 px-5 py-3", isUser ? "flex-row-reverse" : "flex-row")}>
      <Avatar size="sm" className="shrink-0">
        <AvatarFallback
          className={cn(
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-primary"
          )}
        >
          {isUser ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
        </AvatarFallback>
      </Avatar>

      <div
        className={cn(
          "max-w-[76%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-primary/15 text-foreground rounded-tr-sm ring-1 ring-primary/30 whitespace-pre-wrap"
            : "bg-card text-card-foreground rounded-tl-sm ring-1 ring-border"
        )}
      >
        {message.content ? (
          isUser ? (
            message.content
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {message.content}
            </ReactMarkdown>
          )
        ) : (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <span
              className="size-1.5 rounded-full bg-muted-foreground animate-bounce"
              style={{ animationDelay: "0ms" }}
            />
            <span
              className="size-1.5 rounded-full bg-muted-foreground animate-bounce"
              style={{ animationDelay: "150ms" }}
            />
            <span
              className="size-1.5 rounded-full bg-muted-foreground animate-bounce"
              style={{ animationDelay: "300ms" }}
            />
          </span>
        )}
      </div>
    </div>
  );
}
