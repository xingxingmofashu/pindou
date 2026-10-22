/** Keyboard-input guards shared by the editor shortcuts. */
export class Keyboard {
  /**
   * Whether the event target is a text field where shortcuts must not fire.
   *
   * @param target - The event target.
   * @returns `true` for inputs, textareas, and contenteditable elements.
   */
  static isTypingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false
    const tag = target.tagName
    return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable
  }
}
