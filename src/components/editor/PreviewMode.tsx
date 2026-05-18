import { useEffect, useCallback } from "react";
import { useEditorStore } from "../../stores/editor";
import { useUiStore } from "../../stores/ui";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { open } from "@tauri-apps/plugin-shell";
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

export function PreviewMode() {
  const content = useEditorStore((s) => s.content);
  const fontSize = useUiStore((s) => s.fontSize);
  const setFontSize = useUiStore((s) => s.setFontSize);
  const immersiveMode = useUiStore((s) => s.immersiveMode);
  const toggleImmersive = useUiStore((s) => s.toggleImmersive);

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

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      setFontSize(fontSize + (e.deltaY < 0 ? 1 : -1));
    }
  }, [fontSize, setFontSize]);

  return (
    <div data-toc-scroll className="h-full overflow-auto bg-zinc-100 dark:bg-zinc-900 paper:bg-[#d9cebc]" style={{ scrollBehavior: "smooth" }} onWheel={handleWheel}>
      <button
        className="fixed right-6 bottom-6 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-zinc-200 text-zinc-500 shadow-sm transition-all hover:bg-zinc-300 hover:shadow-md dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600 paper:bg-[#cfc3b0] paper:text-[#6b6052] paper:hover:bg-[#c4b6a4]"
        onClick={toggleImmersive}
        title={immersiveMode ? "退出沉浸式 (Esc)" : "沉浸式阅读"}
      >
        {immersiveMode ? "✕" : "⊙"}
      </button>
      <article
        className="mx-auto my-6 max-w-3xl rounded-xl bg-white px-10 py-10 pb-[80vh] text-zinc-800 shadow-md dark:bg-zinc-900 dark:text-zinc-200 dark:shadow-none dark:ring-1 dark:ring-zinc-800 paper:bg-[#faf7f2] paper:text-[#3d3d3d] paper:shadow-none paper:ring-1 paper:ring-[#c4b6a4]"
        style={{ fontSize: `${fontSize}px` }}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
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
            a: ({ children, href, ...props }) => {
              const handleClick = (e: React.MouseEvent) => {
                if (!href) return;
                if (href.startsWith("http://") || href.startsWith("https://")) {
                  e.preventDefault();
                  open(href);
                }
              };
              return (
                <a className="text-blue-600 underline dark:text-blue-400" href={href} onClick={handleClick} {...props}>
                  {children}
                </a>
              );
            },
            img: ({ src, alt, ...props }) => (
              <img src={src} alt={alt} className="my-4 max-w-full rounded" {...props} />
            ),
            del: ({ children, ...props }) => (
              <del className="text-zinc-500 line-through dark:text-zinc-400" {...props}>{children}</del>
            ),
            input: ({ type, checked, disabled, ...props }) => {
              if (type === "checkbox") {
                return (
                  <input type="checkbox" checked={checked} disabled={disabled} className="mr-2 h-4 w-4 accent-blue-600" {...props} />
                );
              }
              return <input type={type} checked={checked} disabled={disabled} {...props} />;
            },
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
