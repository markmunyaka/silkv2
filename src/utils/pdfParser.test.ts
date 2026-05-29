// Mock the default export of pdf-parse (the function)
jest.mock('pdf-parse', () => jest.fn());

describe('extractText', () => {
  it('should return text from a valid PDF buffer', async () => {
    const mockText = 'Hello World';
    const pdfParse = require('pdf-parse'); // This is the mocked function
    (pdfParse as jest.Mock).mockResolvedValue({ text: mockText });

    const { extractText } = require('./pdfParser');
    const buffer = Buffer.from('%PDF-1.4...'); // fake PDF header
    const result = await extractText(buffer);
    expect(result).toBe(mockText);
  });

  it('should throw an error when pdf-parse fails', async () => {
    const pdfParse = require('pdf-parse');
    (pdfParse as jest.Mock).mockRejectedValue(new Error('parse error'));

    const { extractText } = require('./pdfParser');
    const buffer = Buffer.from('invalid');
    await expect(extractText(buffer)).rejects.toThrow('PDF parsing failed');
  });
});
