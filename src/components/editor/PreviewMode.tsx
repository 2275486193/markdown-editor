import { useEffect } from "react";
import { useEditorStore } from "../../stores/editor";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { registerNavigator, unregisterNavigator } from "../../services/heading-nav";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w一-鿿\s-]/g, "")
    .replace(/\s+/g, "-");
}

function headingId(children: React.ReactNode): string {
  const text =
    typeof children === "string"
      ? children
      : Array.isArray(children)
        ? children
            .filter((c): c is string => typeof c === "string")
            .join("")
        : String(children ?? "");
  return slugify(text);
}

function keepAliveStyle(active: boolean): React.CSSProperties {
  return {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    opacity: active ? 1 : 0,
    pointerEvents: active ? "auto" : "none",
    zIndex: active ? 1 : 0,
    overflow: "auto",
    scrollBehavior: "smooth",
  };
}

export function PreviewMode() {
  const content = useEditorStore((s) => s.content);
  const mode = useEditorStore((s) => s.mode);

  useEffect(() => {
    registerNavigator("preview", (id) => {
      const el = document.getElementById(id);
      const container = document.querySelector("[data-toc-scroll]") as HTMLElement | null;
      if (!el || !container) return;
      const offsetTop = el.getBoundingClientRect().top - container.getBoundingClientRect().top;
      container.scrollTop += offsetTop - 40;
    });
    return () => unregisterNavigator("preview");
  }, []);

  return (
    <div data-toc-scroll style={keepAliveStyle(mode === "preview")}>
      <article className="mx-auto max-w-3xl px-6 py-8 pb-[80vh] text-zinc-800 dark:text-zinc-200">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children, ...props }) => (
              <h1 id={headingId(children)} className="mb-4 mt-8 scroll-mt-12 text-3xl font-bold" {...props}>{children}</h1>
            ),
            h2: ({ children, ...props }) => (
              <h2 id={headingId(children)} className="mb-3 mt-6 scroll-mt-12 text-2xl font-semibold" {...props}>{children}</h2>
            ),
            h3: ({ children, ...props }) => (
              <h3 id={headingId(children)} className="mb-2 mt-5 scroll-mt-12 text-xl font-semibold" {...props}>{children}</h3>
            ),
            h4: ({ children, ...props }) => (
              <h4 id={headingId(children)} className="mb-2 mt-4 scroll-mt-12 text-lg font-semibold" {...props}>{children}</h4>
            ),
            h5: ({ children, ...props }) => (
              <h5 id={headingId(children)} className="mb-1 mt-3 scroll-mt-12 font-semibold" {...props}>{children}</h5>
            ),
            h6: ({ children, ...props }) => (
              <h6 id={headingId(children)} className="mb-1 mt-3 scroll-mt-12 font-semibold text-zinc-500" {...props}>{children}</h6>
            ),
            p: ({ children, ...props }) => (
              <p className="my-3 leading-relaxed" {...props}>{children}</p>
            ),
            code: ({ className, children, ...props }) => {
              const isInline = !className?.includes("language-") && !className?.includes("hljs");
              if (isInline) {
                return (
                  <code className="rounded bg-zinc-200 px-1 py-0.5 text-sm font-mono text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200" {...props}>
                    {children}
                  </code>
                );
              }
              return <code {...props}>{children}</code>;
            },
            pre: ({ children, ...props }) => (
              <pre className="my-4 overflow-auto rounded-lg border border-zinc-700 bg-[#0d1117] p-4 text-sm leading-relaxed" {...props}>
                {children}
              </pre>
            ),
            blockquote: ({ children, ...props }) => (
              <blockquote className="my-4 border-l-4 border-zinc-300 pl-4 italic dark:border-zinc-600" {...props}>
                {children}
              </blockquote>
            ),
            ul: ({ children, ...props }) => (
              <ul className="my-3 list-disc pl-6" {...props}>{children}</ul>
            ),
            ol: ({ children, ...props }) => (
              <ol className="my-3 list-decimal pl-6" {...props}>{children}</ol>
            ),
            table: ({ children, ...props }) => (
              <div className="my-4 overflow-auto">
                <table className="min-w-full border-collapse border border-zinc-300 dark:border-zinc-600" {...props}>
                  {children}
                </table>
              </div>
            ),
            th: ({ children, ...props }) => (
              <th className="border border-zinc-300 bg-zinc-100 px-3 py-2 text-left font-semibold dark:border-zinc-600 dark:bg-zinc-800" {...props}>
                {children}
              </th>
            ),
            td: ({ children, ...props }) => (
              <td className="border border-zinc-300 px-3 py-2 dark:border-zinc-600" {...props}>
                {children}
              </td>
            ),
            a: ({ children, href, ...props }) => (
              <a className="text-blue-600 underline dark:text-blue-400" href={href} target="_blank" rel="noreferrer" {...props}>
                {children}
              </a>
            ),
            hr: (props) => (
              <hr className="my-6 border-zinc-300 dark:border-zinc-600" {...props} />
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </article>
    </div>
  );
}
