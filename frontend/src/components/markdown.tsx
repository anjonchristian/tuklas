import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/**
 * Renders the tutor's markdown (bold terms, lists, inline code) instead of
 * showing raw `**asterisks**`. Styled with utilities so it inherits the bubble.
 */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div
      className={cn(
        "text-sm leading-relaxed",
        "[&_p]:m-0 [&_p+p]:mt-2",
        "[&_strong]:font-semibold [&_em]:italic",
        "[&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:ps-5",
        "[&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:ps-5",
        "[&_li]:mt-0.5",
        "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs",
        "[&_a]:underline [&_a]:underline-offset-2",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
