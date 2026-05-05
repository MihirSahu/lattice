function saveSelectionState() {
  if (typeof document === "undefined") {
    return null;
  }

  const activeElement =
    typeof HTMLElement !== "undefined" && document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const textControl =
    (typeof HTMLInputElement !== "undefined" && activeElement instanceof HTMLInputElement) ||
    (typeof HTMLTextAreaElement !== "undefined" && activeElement instanceof HTMLTextAreaElement)
      ? activeElement
      : null;
  const selection = document.getSelection?.() ?? null;
  const ranges =
    selection && !textControl
      ? Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index).cloneRange())
      : [];

  return {
    activeElement,
    textControl,
    selectionStart: textControl?.selectionStart ?? null,
    selectionEnd: textControl?.selectionEnd ?? null,
    selectionDirection: textControl?.selectionDirection ?? undefined,
    ranges
  };
}

function restoreSelectionState(state: ReturnType<typeof saveSelectionState>) {
  if (!state || typeof document === "undefined") {
    return;
  }

  if (
    state.textControl &&
    state.selectionStart !== null &&
    state.selectionEnd !== null &&
    document.contains(state.textControl)
  ) {
    state.textControl.setSelectionRange(state.selectionStart, state.selectionEnd, state.selectionDirection);
  } else if (state.ranges.length > 0) {
    const selection = document.getSelection?.() ?? null;

    selection?.removeAllRanges();
    state.ranges.forEach((range) => selection?.addRange(range));
  }

  if (state.activeElement && document.contains(state.activeElement)) {
    state.activeElement.focus({ preventScroll: true });
  }
}

function copyTextWithTextareaFallback(text: string) {
  if (typeof document === "undefined" || !document.body || typeof document.execCommand !== "function") {
    return false;
  }

  const selectionState = saveSelectionState();
  const textarea = document.createElement("textarea");

  textarea.value = text;
  textarea.readOnly = true;
  textarea.setAttribute("aria-hidden", "true");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.width = "1px";
  textarea.style.height = "1px";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";

  document.body.appendChild(textarea);

  try {
    textarea.focus({ preventScroll: true });
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
    restoreSelectionState(selectionState);
  }
}

export async function copyTextToClipboard(text: string) {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall back to the selection-based copy path below.
  }

  return copyTextWithTextareaFallback(text);
}
