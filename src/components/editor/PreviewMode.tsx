import { useState, useEffect, useCallback, useRef, forwardRef } from "react";
import { useEditorStore } from "../../stores/editor";
import { useUiStore } from "../../stores/ui";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { open } from "@tauri-apps/plugin-shell";
import { registerNavigator, unregisterNavigator } from "../../services/heading-nav";

type HastPosition = { start: { line: number }; end: { line: number } } | undefined;

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^\w一-鿿\s-]/g, "").replace(/\s+/g, "-");
}

function getBlockText(content: string, startLine: number, endLine: number): string {
  const lines = content.split("\n");
  return lines.slice(startLine - 1, endLine).join("\n");
}

function replaceBlockText(
  content: string, startLine: number, endLine: number, newText: string,
): string {
  const lines = content.split("\n");
  const before = lines.slice(0, startLine - 1);
  const after = lines.slice(endLine);
  return [...before, ...newText.split("\n"), ...after].join("\n");
}

function editingHere(
  editing: { startLine: number; endLine: number } | null,
  position: HastPosition,
): position is NonNullable<HastPosition> {
  if (!editing || !position) return false;
  return position.start.line === editing.startLine && position.end.line === editing.endLine;
}

/** Inline editor — textarea shown in place of the clicked block */
const InlineEditor = forwardRef<HTMLTextAreaElement, {
  text: string; commit: (v: string) => void; cancel: () => void; className?: string; variant?: "normal" | "code";
}>(({ text, commit, cancel, className, variant }, ref) => (
  <textarea
    ref={ref}
    defaultValue={text}
    className={`w-full resize-none border-none p-1 font-inherit outline-none ${
      variant === "code"
        ? "bg-transparent"
        : "bg-amber-50/50 dark:bg-amber-950/20"
    } ${className ?? ""}`}
    style={{ fontSize: "inherit", fontFamily: "inherit", lineHeight: "inherit", color: "inherit" }}
    onBlur={(e) => commit(e.target.value)}
    onKeyDown={(e) => {
      if (e.key === "Escape") { e.preventDefault(); cancel(); }
      else if (e.key === "Enter" && e.ctrlKey) { e.preventDefault(); commit(e.currentTarget.value); }
    }}
  />
));
InlineEditor.displayName = "InlineEditor";

export function PreviewMode() {
  const content = useEditorStore((s) => s.content);
  const setContent = useEditorStore((s) => s.setContent);
  const fontSize = useUiStore((s) => s.fontSize);
  const setFontSize = useUiStore((s) => s.setFontSize);
  const [editing, setEditing] = useState<{ startLine: number; endLine: number; text: string } | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const commitEdit = useCallback((newText: string) => {
    if (!editing) return;
    setContent(replaceBlockText(content, editing.startLine, editing.endLine, newText));
    setEditing(null);
  }, [content, editing, setContent]);

  useEffect(() => {
    if (editing && taRef.current) {
      const ta = taRef.current;
      ta.style.height = "auto";
      ta.style.height = ta.scrollHeight + "px";
      ta.focus();
    }
  }, [editing]);

  useEffect(() => {
    registerNavigator("preview", (id) => {
      const el = document.getElementById(id);
      const c = document.querySelector("[data-toc-scroll]") as HTMLElement | null;
      if (!el || !c) return;
      c.scrollTop += el.getBoundingClientRect().top - c.getBoundingClientRect().top - 40;
    });
    return () => unregisterNavigator("preview");
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      setFontSize(fontSize + (e.deltaY < 0 ? 1 : -1));
    }
  }, [fontSize, setFontSize]);

  function mkClick(pos: HastPosition) {
    if (!pos) return undefined;
    return () => {
      const text = getBlockText(content, pos.start.line, pos.end.line);
      setEditing({ startLine: pos.start.line, endLine: pos.end.line, text });
    };
  }

  return (
    <div data-toc-scroll className="h-full overflow-auto bg-zinc-100 dark:bg-zinc-900 paper:bg-[#d9cebc]" style={{ scrollBehavior: "smooth" }} onWheel={handleWheel}>
      <article
        className="mx-auto my-8 max-w-4xl rounded-xl bg-white px-12 py-10 pb-[80vh] text-zinc-800 shadow-md dark:bg-zinc-900 dark:text-zinc-200 dark:shadow-md paper:bg-[#faf7f2] paper:text-[#3d3d3d] paper:shadow-md"
        style={{ fontSize: `${fontSize}px` }}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          components={{
            h1: ({ children, node, ...p }) => {
              const pos = (node as any)?.position as HastPosition;
              if (editingHere(editing, pos)) return <InlineEditor ref={taRef} text={editing!.text} commit={commitEdit} cancel={() => setEditing(null)} className="mb-4 mt-8 text-3xl font-bold" />;
              return <h1 id={slugify(String(children))} className="mb-4 mt-8 scroll-mt-12 text-3xl font-bold cursor-text" onClick={mkClick(pos)} {...p}>{children}</h1>;
            },
            h2: ({ children, node, ...p }) => {
              const pos = (node as any)?.position as HastPosition;
              if (editingHere(editing, pos)) return <InlineEditor ref={taRef} text={editing!.text} commit={commitEdit} cancel={() => setEditing(null)} className="mb-3 mt-6 text-2xl font-semibold" />;
              return <h2 id={slugify(String(children))} className="mb-3 mt-6 scroll-mt-12 text-2xl font-semibold cursor-text" onClick={mkClick(pos)} {...p}>{children}</h2>;
            },
            h3: ({ children, node, ...p }) => {
              const pos = (node as any)?.position as HastPosition;
              if (editingHere(editing, pos)) return <InlineEditor ref={taRef} text={editing!.text} commit={commitEdit} cancel={() => setEditing(null)} className="mb-2 mt-5 text-xl font-semibold" />;
              return <h3 id={slugify(String(children))} className="mb-2 mt-5 scroll-mt-12 text-xl font-semibold cursor-text" onClick={mkClick(pos)} {...p}>{children}</h3>;
            },
            h4: ({ children, node, ...p }) => {
              const pos = (node as any)?.position as HastPosition;
              if (editingHere(editing, pos)) return <InlineEditor ref={taRef} text={editing!.text} commit={commitEdit} cancel={() => setEditing(null)} className="mb-2 mt-4 text-lg font-semibold" />;
              return <h4 id={slugify(String(children))} className="mb-2 mt-4 scroll-mt-12 text-lg font-semibold cursor-text" onClick={mkClick(pos)} {...p}>{children}</h4>;
            },
            h5: ({ children, node, ...p }) => {
              const pos = (node as any)?.position as HastPosition;
              if (editingHere(editing, pos)) return <InlineEditor ref={taRef} text={editing!.text} commit={commitEdit} cancel={() => setEditing(null)} className="mb-1 mt-3 font-semibold" />;
              return <h5 id={slugify(String(children))} className="mb-1 mt-3 scroll-mt-12 font-semibold cursor-text" onClick={mkClick(pos)} {...p}>{children}</h5>;
            },
            h6: ({ children, node, ...p }) => {
              const pos = (node as any)?.position as HastPosition;
              if (editingHere(editing, pos)) return <InlineEditor ref={taRef} text={editing!.text} commit={commitEdit} cancel={() => setEditing(null)} className="mb-1 mt-3 font-semibold text-zinc-500" />;
              return <h6 id={slugify(String(children))} className="mb-1 mt-3 scroll-mt-12 font-semibold text-zinc-500 cursor-text" onClick={mkClick(pos)} {...p}>{children}</h6>;
            },
            p: ({ children, node, ...p }) => {
              const pos = (node as any)?.position as HastPosition;
              if (editingHere(editing, pos)) return <InlineEditor ref={taRef} text={editing!.text} commit={commitEdit} cancel={() => setEditing(null)} className="my-3 leading-relaxed" />;
              return <p className="my-3 leading-relaxed cursor-text" onClick={mkClick(pos)} {...p}>{children}</p>;
            },
            blockquote: ({ children, node, ...p }) => {
              const pos = (node as any)?.position as HastPosition;
              if (editingHere(editing, pos)) return <InlineEditor ref={taRef} text={editing!.text} commit={commitEdit} cancel={() => setEditing(null)} className="my-4 border-l-4 border-zinc-300 pl-4 italic dark:border-zinc-600" />;
              return <blockquote className="my-4 border-l-4 border-zinc-300 pl-4 italic dark:border-zinc-600 cursor-text" onClick={mkClick(pos)} {...p}>{children}</blockquote>;
            },
            pre: ({ children, node, ...p }) => {
              const pos = (node as any)?.position as HastPosition;
              if (editingHere(editing, pos)) return <InlineEditor ref={taRef} text={editing!.text} commit={commitEdit} cancel={() => setEditing(null)} variant="code" className="my-4 rounded-lg border border-zinc-700 bg-[#0d1117] p-4 font-mono text-sm text-[#e6edf3]" />;
              return <pre className="my-4 overflow-auto rounded-lg border border-zinc-700 bg-[#0d1117] p-4 text-sm leading-relaxed cursor-text" onClick={mkClick(pos)} {...p}>{children}</pre>;
            },
            table: ({ children, node, ...p }) => {
              const pos = (node as any)?.position as HastPosition;
              if (editingHere(editing, pos)) return <InlineEditor ref={taRef} text={editing!.text} commit={commitEdit} cancel={() => setEditing(null)} className="my-4 w-full font-mono text-sm leading-relaxed" />;
              return (
                <div className="my-4 overflow-auto cursor-text" onClick={mkClick(pos)}>
                  <table className="min-w-full border-collapse border border-zinc-300 dark:border-zinc-600" {...p}>{children}</table>
                </div>
              );
            },
            th: ({ children, ...p }) => <th className="border border-zinc-300 bg-zinc-100 px-3 py-2 text-left font-semibold dark:border-zinc-600 dark:bg-zinc-800" {...p}>{children}</th>,
            td: ({ children, ...p }) => <td className="border border-zinc-300 px-3 py-2 dark:border-zinc-600" {...p}>{children}</td>,
            ul: ({ children, ...p }) => <ul className="my-3 list-disc pl-6" {...p}>{children}</ul>,
            ol: ({ children, ...p }) => <ol className="my-3 list-decimal pl-6" {...p}>{children}</ol>,
            li: ({ children, node, ...p }) => {
              const pos = (node as any)?.position as HastPosition;
              if (editingHere(editing, pos)) return <InlineEditor ref={taRef} text={editing!.text} commit={commitEdit} cancel={() => setEditing(null)} className="leading-relaxed" />;
              return <li className="cursor-text" onClick={mkClick(pos)} {...p}>{children}</li>;
            },
            code: ({ className, children, ...p }) => {
              const isInline = !className?.includes("language-") && !className?.includes("hljs");
              if (isInline) return <code className="rounded bg-zinc-200 px-1 py-0.5 text-sm font-mono text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200" {...p}>{children}</code>;
              return <code {...p}>{children}</code>;
            },
            a: ({ children, href, ...p }) => {
              const hc = (e: React.MouseEvent) => {
                if (!href) return;
                if (href.startsWith("http://") || href.startsWith("https://")) { e.preventDefault(); open(href); }
              };
              return <a className="text-blue-600 underline dark:text-blue-400" href={href} onClick={hc} {...p}>{children}</a>;
            },
            img: ({ src, alt, ...p }) => <img src={src} alt={alt} className="my-4 max-w-full rounded" {...p} />,
            del: ({ children, ...p }) => <del className="text-zinc-500 line-through dark:text-zinc-400" {...p}>{children}</del>,
            input: ({ type, checked, disabled, ...p }) => {
              if (type === "checkbox") return <input type="checkbox" checked={checked} disabled={disabled} className="mr-2 h-4 w-4 accent-blue-600" {...p} />;
              return <input type={type} checked={checked} disabled={disabled} {...p} />;
            },
            hr: (p) => <hr className="my-6 border-zinc-300 dark:border-zinc-600" {...p} />,
            details: ({ children, node, ...p }: any) => {
              const pos = node?.position as HastPosition;
              if (editingHere(editing, pos)) return <InlineEditor ref={taRef} text={editing!.text} commit={commitEdit} cancel={() => setEditing(null)} className="my-2 text-sm" />;
              return <details className="my-2 cursor-text" onClick={mkClick(pos)} {...p}>{children}</details>;
            },
            summary: ({ children, node, ...p }: any) => {
              const pos = node?.position as HastPosition;
              if (editingHere(editing, pos)) return <InlineEditor ref={taRef} text={editing!.text} commit={commitEdit} cancel={() => setEditing(null)} className="font-semibold" />;
              return <summary className="cursor-pointer font-semibold cursor-text" onClick={mkClick(pos)} {...p}>{children}</summary>;
            },
            kbd: ({ children, ...p }: any) => <kbd className="rounded border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 text-xs font-mono dark:border-zinc-600 dark:bg-zinc-800" {...p}>{children}</kbd>,
            mark: ({ children, ...p }: any) => <mark className="bg-yellow-200 px-0.5 dark:bg-yellow-800" {...p}>{children}</mark>,
            sub: ({ children, ...p }: any) => <sub {...p}>{children}</sub>,
            sup: ({ children, ...p }: any) => <sup {...p}>{children}</sup>,
            div: ({ children, node, ...p }: any) => {
              const pos = node?.position as HastPosition;
              if (editingHere(editing, pos)) return <InlineEditor ref={taRef} text={editing!.text} commit={commitEdit} cancel={() => setEditing(null)} className="my-1" />;
              return <div className="cursor-text" onClick={mkClick(pos)} {...p}>{children}</div>;
            },
            span: ({ children, ...p }: any) => <span {...p}>{children}</span>,
          }}
        >
          {content}
        </ReactMarkdown>
      </article>
    </div>
  );
}
