import { extractText } from 'unpdf';

export async function extractPdfText(pdfBuffer: ArrayBuffer): Promise<string> {
  try {
    const { text } = await extractText(pdfBuffer);

    // text is an array of strings (one per page), join them
    const fullText = Array.isArray(text) ? text.join('\n') : String(text);

    // Clean up the text - remove excessive whitespace
    return fullText
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim();
  } catch (error) {
    console.error('Error extracting PDF text:', error);
    return '';
  }
}
