import { EmbedContentParameters, EmbedContentResponse, GoogleGenAI } from "@google/genai";

export class GeminiEmbed {
  private static instance: GeminiEmbed;
  private googleGenAI: GoogleGenAI;

  private constructor(apiKey: string) {
    this.googleGenAI = new GoogleGenAI({ apiKey });
  }

  static initialize(apiKey: string) {
    if (!GeminiEmbed.instance) {
      GeminiEmbed.instance = new GeminiEmbed(apiKey);
    }
  }

  static getInstance(): GeminiEmbed {
    if (!GeminiEmbed.instance) {
      throw new Error(
        'GeminiEmbed has not been initialized. Call initialize(apiKey) first.'
      );
    }
    return GeminiEmbed.instance;
  }

  async generateEmbedding(text: string, model: string): Promise<number[]> {
    const embedModelParams: EmbedContentParameters = {
        model: model,
        contents: [text],
    }
    const embedContentResponse: EmbedContentResponse = await this.googleGenAI.models.embedContent(embedModelParams);
    if (!embedContentResponse.embeddings) {
        throw new Error("No embeddings found");
    }
    return embedContentResponse.embeddings[0].values ?? [];
  }
}