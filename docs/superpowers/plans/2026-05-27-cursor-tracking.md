# Cursor Tracking & Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add visible blinking cursor indicator inside InlineEditable, with font-size-adaptive height and pixel-accurate HiddenTextarea positioning.

**Architecture:** InlineEditable inserts a `<span data-caret="true" />` at the cursor offset inside the active segment's raw text. WYSIWYGMode.reposition uses this DOM element's bounding rect as the primary positioning target, falling back to pointFromCaret. HiddenTextarea receives dynamic height to match the current line.

**Tech Stack:** React 18, TypeScript 5, Tailwind CSS 4, no new dependencies.

---

## File Map

| File | Role |
|------|------|
| `src/styles/index.css` | Add `@keyframes caret-blink` |
| `src/engine/inline.tsx` | `InlineEditable`: insert caret element into active segment |
| `src/components/editor/WYSIWYGMode.tsx` | `reposition`: prefer `[data-caret]` rect; pass height to textarea |
| `src/components/editor/HiddenTextarea.tsx` | Accept `height` prop, use in style |

---

### Task 1: Add caret blink CSS animation

**Files:**
- Modify: `src/styles/index.css` (append at end)

- [ ] **Step 1: Add keyframes and utility class**

Append to `src/styles/index.css`:

```css
/* ── 光标闪烁动画 ── */

@keyframes caret-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.caret-blink {
  animation: caret-blink 1s step-end infinite;
}
```

- [ ] **Step 2: Verify CSS builds**

Run: `pnpm dev` (or check that Vite starts without CSS parse errors)

- [ ] **Step 3: Commit**

```bash
git add src/styles/index.css
git commit -m "feat: add caret blink CSS animation"
```

---

### Task 2: Render caret element in InlineEditable

**Files:**
- Modify: `src/engine/inline.tsx:162-246` (InlineEditable function body)

- [ ] **Step 1: Modify InlineEditable to insert caret span in the primary active segment**

Replace the `segs.map` rendering block (lines 231-245) in `InlineEditable`:

```tsx
  let segStart = 0;
  const primaryIdx = activeIndices.length > 0 ? activeIndices[0] : -1;
  const totalSrcLen = segs.reduce((sum, s) => sum + segSrcLen(s), 0);
  return (
    <>
      {segs.map((seg, i) => {
        const srcLen = segSrcLen(seg);
        const start = segStart;
        segStart += srcLen;
        const type = seg.type;
        if (isActive && activeIndices.includes(i)) {
          const rawText = segToMarkdown(seg);
          if (i === primaryIdx) {
            const localOff = Math.max(0, Math.min(offset - start, rawText.length));
            const before = rawText.slice(0, localOff);
            const after = rawText.slice(localOff);
            return (
              <span key={i} data-seg-start={start} data-seg-end={start + srcLen} data-seg-type={type} data-seg-raw="1">
                {before}
                <span data-caret="true" className="caret-blink inline-block w-0 border-l-2 border-current h-[1em] align-text-bottom" />
                {after}
              </span>
            );
          }
          return <span key={i} data-seg-start={start} data-seg-end={start + srcLen} data-seg-type={type} data-seg-raw="1">{rawText}</span>;
        }
        return <span key={i} data-seg-start={start} data-seg-end={start + srcLen} data-seg-type={type}>{renderSeg(seg, i)}</span>;
      })}
      {isActive && (primaryIdx < 0 || offset > totalSrcLen) && (
        <span data-caret="true" className="caret-blink inline-block w-0 border-l-2 border-current h-[1em] align-text-bottom" />
      )}
    </>
  );
```

**What changed:**
- Extract `primaryIdx` from `activeIndices[0]`
- For the primary active segment: split `segToMarkdown(seg)` at `localOff = offset - start`, insert caret `<span>` between `before` and `after`
- For non-primary active segments: keep existing behavior (show raw markers, no caret)
- For non-active segments: unchanged
- Append caret at end when `primaryIdx < 0` or `offset > totalSrcLen` (cursor beyond all segments)

- [ ] **Step 2: Run lint**

```bash
pnpm lint
```
Expected: zero output (no TypeScript errors).

- [ ] **Step 3: Commit**

```bash
git add src/engine/inline.tsx
git commit -m "feat: render caret span inside active inline segment"
```

---

### Task 3: Reposition using caret DOM element

**Files:**
- Modify: `src/components/editor/WYSIWYGMode.tsx:98-119` (reposition callback)

- [ ] **Step 1: Modify reposition to prefer [data-caret] element**

Replace the `reposition` callback (lines 98-119):

```tsx
  const reposition = useCallback(() => {
    if (!caretBlockId) {
      setTaVisible(false);
      setActiveBlockId(null);
      return;
    }
    // Priority 1: use the caret DOM element's bounding rect
    const caretEl = document.querySelector('[data-caret="true"]');
    if (caretEl) {
      const r = caretEl.getBoundingClientRect();
      setTaPos({ x: r.left, y: r.top });
      setTaHeight(r.height);
      setTaVisible(true);
      return;
    }
    // Priority 2: fallback — pointFromCaret for code blocks etc.
    let pt = pointFromCaret(caretBlockId, caretOffset);
    if (!pt) {
      const el = document.querySelector(`[data-block-id="${caretBlockId}"]`);
      if (el) {
        const r = el.getBoundingClientRect();
        pt = { x: r.left, y: r.top };
      }
    }
    if (pt) {
      setTaPos(pt);
      setTaHeight(16);
      setTaVisible(true);
    } else {
      setTaVisible(false);
    }
  }, []);
```

- [ ] **Step 2: Add taHeight state and pass to HiddenTextarea**

Add state near other ta state declarations (after line 74):

```tsx
  const [taHeight, setTaHeight] = useState(16);
```

Update the HiddenTextarea JSX (line 385-391):

```tsx
      <HiddenTextarea
        x={taPos.x}
        y={taPos.y}
        height={taHeight}
        visible={taVisible}
        onChar={handleChar}
        onKeyDown={handleKeyDown}
      />
```

- [ ] **Step 3: Run lint**

```bash
pnpm lint
```
Expected: zero output.

- [ ] **Step 4: Commit**

```bash
git add src/components/editor/WYSIWYGMode.tsx
git commit -m "feat: reposition HiddenTextarea using caret DOM element bounding rect"
```

---

### Task 4: HiddenTextarea accepts dynamic height prop

**Files:**
- Modify: `src/components/editor/HiddenTextarea.tsx:1-79`

- [ ] **Step 1: Add height prop and use in style**

Replace the Props interface and style:

```tsx
interface Props {
  x: number;
  y: number;
  height: number;
  visible: boolean;
  onChar: (text: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}
```

In the style object (line 64-65), replace `height: '1em',` with:

```tsx
        height,
```

- [ ] **Step 2: Run lint**

```bash
pnpm lint
```
Expected: zero output.

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/HiddenTextarea.tsx
git commit -m "feat: HiddenTextarea accepts dynamic height prop for line-height matching"
```

---

### Task 5: Verification

- [ ] **Step 1: Run full lint**

```bash
pnpm lint
```
Expected: zero output (no TypeScript errors, no unused imports).

- [ ] **Step 2: Visual smoke test checklist**

Start the dev server and manually verify:

- [ ] Click on a paragraph — caret appears at click position, blinks
- [ ] Click on a heading (h1/h2) — caret height matches heading font size
- [ ] Click on a quote block — caret height matches quote text
- [ ] Click on a list item — caret height matches list text
- [ ] Type characters — caret moves forward with each character
- [ ] Arrow keys Left/Right — caret moves within text
- [ ] Arrow keys Up/Down — caret moves between blocks, preserves approximate column
- [ ] Click inside bold/italic text — raw markers appear, caret positioned correctly within markers
- [ ] Click at boundary between bold and regular text — caret positioned at correct edge
- [ ] Code block — typing works (uses fallback pointFromCaret positioning)
- [ ] Backspace/Delete — caret position updates after deletion
- [ ] Enter — new block created, caret at start of new block
- [ ] Switch between blocks — caret disappears from old block, appears in new block
- [ ] Dark mode — caret color inverts (via `border-current`)
- [ ] IME composition (Chinese input) — caret stays at correct position

- [ ] **Step 3: Commit if any fixes were needed, then done**
