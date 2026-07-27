import { useCallback, useRef, useEffect, useState } from 'react';
import 'katex/dist/katex.min.css';
import { useBlockSync } from '../../engine/controller';
import { BlockRenderer } from '../../engine/renderer';
import { useEditorStore } from '../../stores/editor';
import { useUiStore } from '../../stores/ui';

// Preserve scroll position across mode switches (component unmount/remount)
let savedScrollTop = 0;

export function WYSIWYGMode() {
  const content = useEditorStore((s) => s.content);
  const { blocks, activeBlockId } = useBlockSync();
  const fontSize = useUiStore((s) => s.fontSize);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [version, setVersion] = useState(0);

  // Force remount when exiting edit mode (activeBlockId goes from non-null to null)
  const prevActive = useRef<string | null>(null);
  useEffect(() => {
    if (prevActive.current && !activeBlockId) {
      setVersion(v => v + 1);
    }
    prevActive.current = activeBlockId;
  }, [activeBlockId]);

  // Restore scroll position on mount
  useEffect(() => {
    if (scrollRef.current && savedScrollTop > 0) {
      scrollRef.current.scrollTop = savedScrollTop;
    }
    return () => {
      if (scrollRef.current) {
        savedScrollTop = scrollRef.current.scrollTop;
      }
    };
  }, []);

  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // Don't blur if clicking inside a contentEditable element
    if (target.closest('[contenteditable="true"], [contenteditable=""]')) return;
    const el = document.activeElement;
    if (el instanceof HTMLElement) el.blur();
  }, []);

  if (!content.trim()) {
    return (
      <div className="flex h-full items-center justify-center text-zinc-400">
        Click to start editing...
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="h-full overflow-auto">
      <div
        className="mx-auto max-w-3xl px-8 py-6"
        style={{ fontSize: `${fontSize}px` }}
        onClick={handleContainerClick}
      >
        <BlockRenderer key={version} blocks={blocks} />
      </div>
    </div>
  );
}
