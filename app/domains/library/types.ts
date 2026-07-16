export interface FaqMeta {
  id: string;
  title: string;
  source: string; // original filename
  addedAt: number; // epoch ms
  byteSize: number;
  lineCount: number;
  encoding: string;
  repaired: boolean;
}

export interface FaqContent {
  id: string;
  text: string;
}

export interface NewFaqInput {
  title: string;
  source: string;
  text: string;
  byteSize: number;
  encoding: string;
  repaired: boolean;
}
