import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1
            className="text-3xl font-bold text-[var(--color-text-primary)] mb-2"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2
            className="text-xl font-semibold text-[var(--color-text-primary)] mt-8 mb-3"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-base font-semibold text-[var(--color-text-primary)] mt-5 mb-2">
            {children}
          </h3>
        ),
        p: ({ children }) => (
          <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-4">
            {children}
          </p>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-[var(--color-text-primary)]">
            {children}
          </strong>
        ),
        ul: ({ children }) => (
          <ul className="list-disc list-inside space-y-1 mb-4 text-sm text-[var(--color-text-secondary)]">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside space-y-1 mb-4 text-sm text-[var(--color-text-secondary)]">
            {children}
          </ol>
        ),
        li: ({ children }) => (
          <li className="leading-relaxed">{children}</li>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-brand-gold)] underline underline-offset-2 hover:text-[var(--color-brand-gold-light)] transition-colors"
          >
            {children}
          </a>
        ),
        hr: () => (
          <hr className="border-[var(--color-border)] my-6" />
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm border-collapse">
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-[var(--color-bg-secondary)]">{children}</thead>
        ),
        th: ({ children }) => (
          <th className="text-left px-4 py-2 font-semibold text-[var(--color-text-primary)] border border-[var(--color-border)]">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="px-4 py-2 text-[var(--color-text-secondary)] border border-[var(--color-border)]">
            {children}
          </td>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-[var(--color-brand-gold)] pl-4 italic text-[var(--color-text-muted)] my-4">
            {children}
          </blockquote>
        ),
        code: ({ children }) => (
          <code className="bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] px-1.5 py-0.5 rounded text-xs font-mono">
            {children}
          </code>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
