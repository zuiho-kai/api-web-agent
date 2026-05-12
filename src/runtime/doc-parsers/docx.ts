import mammoth from 'mammoth';

export interface DocxParseResult {
  text: string;
  warnings: string[];
}

export async function parseDocx(file: File | Blob): Promise<DocxParseResult> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return {
    text: result.value,
    warnings: result.messages.map((m) => m.message),
  };
}
