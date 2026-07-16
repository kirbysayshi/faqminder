// Rough structural model used ONLY for rendering + reflow. Not a real document AST.
export type BlockKind =
  | "art" // verbatim monospace: banners, boxed tables, TOCs, unknown — never reflowed
  | "prose" // hard-wrapped prose — reflowable
  | "indented-list" // prose with a hanging indent — reflow preserving the indent
  | "floated-box"; // prose column beside a right-side art gutter — reflow the column

export interface Block {
  id: number; // stable index within the doc (anchor / reflow / search key)
  kind: BlockKind;
  lines: string[]; // original lines, verbatim
  startLine: number; // index of the first line in the source text
  gapBefore: number; // count of blank lines immediately preceding this block
  indent: number; // common left indent (spaces); drives hanging indent on reflow
}

export interface ParsedDoc {
  blocks: Block[];
  lineCount: number;
}
