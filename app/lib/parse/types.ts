// Rough structural model used ONLY for rendering + reflow. Not a real document AST.
export type BlockKind =
  | "art" // verbatim monospace: banners, boxed tables, TOCs, unknown — never reflowed
  | "prose"; // reflowable text (see ReflowSpec for how)

// How a prose block reflows.
// - "block":   a wrapped paragraph. Continuation lines share `padLeft`; the first
//              line may differ (`firstLineIndent`) for a paragraph or hanging indent.
// - "hanging": a label/definition item — a left label column and a wrapped body.
//              `padLeft` is the body (hang) column; the label sits in [firstLineIndent, padLeft).
//              Decorative label-column content (e.g. a "-----" underline) is dropped on reflow.
export interface ReflowSpec {
  layout: "block" | "hanging";
  padLeft: number; // ch: continuation / hang column
  firstLineIndent: number; // ch: indent of the first line
}

export interface Block {
  id: number; // stable index within the doc (anchor / reflow / search key)
  kind: BlockKind;
  lines: string[]; // original lines, verbatim
  startLine: number; // index of the first line in the source text
  gapBefore: number; // count of blank lines immediately preceding this block
  indent: number; // common left indent (spaces)
  reflow?: ReflowSpec; // present iff kind === "prose"
}

export interface ParsedDoc {
  blocks: Block[];
  lineCount: number;
}
