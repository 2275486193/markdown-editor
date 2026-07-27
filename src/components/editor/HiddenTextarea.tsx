import { useRef, useEffect, useCallback } from 'react';

interface Props {
  x: number;
  y: number;
  visible: boolean;
  onChar: (text: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

export function HiddenTextarea({ x, y, visible, onChar, onKeyDown }: Props) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const composingRef = useRef(false);

  useEffect(() => {
    if (visible && taRef.current) {
      taRef.current.focus();
    }
  }, [visible, x, y]);

  const handleInput = useCallback(() => {
    const ta = taRef.current;
    if (!ta || composingRef.current) return;
    const text = ta.value;
    if (text) {
      onChar(text);
      ta.value = '';
    }
  }, [onChar]);

  const handleCompositionStart = useCallback(() => {
    composingRef.current = true;
  }, []);

  const handleCompositionEnd = useCallback(() => {
    composingRef.current = false;
    const ta = taRef.current;
    if (!ta) return;
    const text = ta.value;
    if (text) {
      onChar(text);
      ta.value = '';
    }
  }, [onChar]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (composingRef.current) return;
      onKeyDown(e);
    },
    [onKeyDown],
  );

  if (!visible) return null;

  return (
    <textarea
      ref={taRef}
      autoFocus
      style={{
        position: 'fixed',
        left: x,
        top: y,
        width: 2,
        height: '1em',
        opacity: 0.6,
        border: '1px solid red',
        padding: 0,
        overflow: 'hidden',
        resize: 'none',
        zIndex: 9999,
        background: 'yellow',
        fontSize: 'inherit',
      }}
      onInput={handleInput}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      onKeyDown={handleKeyDown}
    />
  );
}
