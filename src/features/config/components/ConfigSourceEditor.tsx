import { useMemo, type Ref } from 'react';
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { yaml } from '@codemirror/lang-yaml';
import { search, searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { EditorView, keymap } from '@codemirror/view';
import { tags } from '@lezer/highlight';

type ConfigSourceEditorProps = {
  value: string;
  onChange: (value: string) => void;
  editorRef?: Ref<ReactCodeMirrorRef>;
  theme: 'light' | 'dark';
  editable: boolean;
  placeholder: string;
};

const MONO_STACK =
  "'IBM Plex Mono', ui-monospace, 'Cascadia Mono', 'JetBrains Mono', Menlo, Consolas, monospace";

/** Muted syntax colour: a scale hue mixed toward body ink so YAML stays calm. */
const muted = (token: string, amount = 72) =>
  `color-mix(in srgb, var(${token}) ${amount}%, var(--ink))`;

/**
 * Syntax colours come only from the accent and capacity scale, muted toward ink.
 * Keys carry the accent; values stay close to ink; comments recede to ink-faint.
 */
const tokenHighlightStyle = HighlightStyle.define([
  { tag: tags.definition(tags.propertyName), color: muted('--accent', 80) },
  { tag: tags.propertyName, color: muted('--accent', 80) },
  { tag: [tags.string, tags.special(tags.string)], color: muted('--cap-plenty', 60) },
  { tag: tags.content, color: 'var(--ink)' },
  { tag: [tags.number, tags.bool, tags.null, tags.atom], color: muted('--cap-watch', 64) },
  { tag: [tags.labelName, tags.typeName], color: muted('--cap-depleted', 60) },
  { tag: [tags.keyword, tags.meta, tags.attributeValue], color: muted('--accent', 56) },
  { tag: [tags.comment, tags.lineComment], color: 'var(--ink-faint)' },
  { tag: [tags.separator, tags.punctuation, tags.bracket], color: 'var(--ink-muted)' },
  { tag: tags.invalid, color: 'var(--cap-depleted)' },
]);

/** Editor chrome bound to the design tokens; `dark` only steers CodeMirror's base styles. */
const buildTokenTheme = (dark: boolean) =>
  EditorView.theme(
    {
      '&': {
        height: '100%',
        color: 'var(--ink)',
        backgroundColor: 'var(--panel-sunken)',
        fontSize: '13px',
      },
      '&.cm-focused': { outline: 'none' },
      '.cm-scroller': { fontFamily: MONO_STACK, lineHeight: '20px' },
      '.cm-content': { caretColor: 'var(--accent)', padding: '8px 0' },
      '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
      '.cm-gutters': {
        backgroundColor: 'var(--panel)',
        color: 'var(--ink-faint)',
        borderRight: '1px solid var(--hairline)',
      },
      '.cm-activeLineGutter': { backgroundColor: 'var(--panel-hover)', color: 'var(--ink-muted)' },
      '.cm-activeLine': {
        backgroundColor: 'color-mix(in srgb, var(--panel-hover) 50%, transparent)',
      },
      '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
        { backgroundColor: 'var(--accent-10)' },
      '.cm-selectionMatch': { backgroundColor: 'var(--accent-10)' },
      '.cm-searchMatch': {
        backgroundColor: 'color-mix(in srgb, var(--cap-watch) 22%, transparent)',
        outline: '1px solid color-mix(in srgb, var(--cap-watch) 48%, transparent)',
      },
      '.cm-searchMatch.cm-searchMatch-selected': {
        backgroundColor: 'color-mix(in srgb, var(--accent) 32%, transparent)',
      },
      '&.cm-focused .cm-matchingBracket': {
        backgroundColor: 'var(--accent-10)',
        outline: '1px solid color-mix(in srgb, var(--accent) 40%, transparent)',
      },
      '.cm-foldPlaceholder': {
        backgroundColor: 'var(--panel-raised)',
        border: '1px solid var(--hairline)',
        color: 'var(--ink-muted)',
      },
      '.cm-placeholder': { color: 'var(--ink-faint)' },
      '.cm-panels': {
        backgroundColor: 'var(--panel-raised)',
        color: 'var(--ink)',
      },
      '.cm-panels.cm-panels-top': { borderBottom: '1px solid var(--hairline)' },
      '.cm-panels.cm-panels-bottom': { borderTop: '1px solid var(--hairline)' },
      '.cm-tooltip': {
        backgroundColor: 'var(--panel-raised)',
        border: '1px solid var(--hairline)',
        color: 'var(--ink)',
      },
    },
    { dark }
  );

export default function ConfigSourceEditor({
  value,
  onChange,
  editorRef,
  theme,
  editable,
  placeholder,
}: ConfigSourceEditorProps) {
  const extensions = useMemo(
    () => [yaml(), search(), highlightSelectionMatches(), keymap.of(searchKeymap)],
    []
  );
  const tokenTheme = useMemo(
    () => [buildTokenTheme(theme === 'dark'), syntaxHighlighting(tokenHighlightStyle)],
    [theme]
  );

  return (
    <CodeMirror
      ref={editorRef}
      value={value}
      onChange={onChange}
      extensions={extensions}
      theme={tokenTheme}
      editable={editable}
      placeholder={placeholder}
      height="100%"
      style={{ height: '100%' }}
      basicSetup={{
        lineNumbers: true,
        highlightActiveLineGutter: true,
        highlightActiveLine: true,
        foldGutter: true,
        dropCursor: true,
        allowMultipleSelections: true,
        indentOnInput: true,
        bracketMatching: true,
        closeBrackets: true,
        autocompletion: false,
        rectangularSelection: true,
        crosshairCursor: false,
        highlightSelectionMatches: true,
        closeBracketsKeymap: true,
        searchKeymap: true,
        foldKeymap: true,
        completionKeymap: false,
        lintKeymap: true,
      }}
    />
  );
}
