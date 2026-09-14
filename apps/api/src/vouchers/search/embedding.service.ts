import { Injectable, Logger } from '@nestjs/common';
import { CohereClient } from 'cohere-ai';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private cohere: CohereClient;

  constructor() {
    const apiKey = process.env.COHERE_API_KEY;
    if (!apiKey) {
      this.logger.warn('COHERE_API_KEY is not set in environment variables! Semantic Search will fail or degrade.');
    }
    this.cohere = new CohereClient({ token: apiKey || '' });
  }

  async onModuleInit() {
    if (process.env.COHERE_API_KEY) {
      this.logger.log('Cohere Embedding API initialized.');
    }
  }

  async generateEmbedding(text: string, isQuery: boolean = false): Promise<number[] | null> {
    const cleaned = (text ?? '').trim();
    if (!cleaned) return null;
    
    if (!process.env.COHERE_API_KEY) {
      this.logger.error('Cannot generate embedding: COHERE_API_KEY is missing');
      return null;
    }

    try {
      const response = await this.cohere.embed({
        texts: [cleaned],
        model: 'embed-multilingual-v3.0',
        inputType: isQuery ? 'search_query' : 'search_document',
      });
      return (response.embeddings as number[][])[0];
    } catch (err) {
      this.logger.error(`Cohere Embedding failed: ${err}`);
      return null;
    }
  }

  async generateEmbeddings(texts: string[], isQuery: boolean = false): Promise<number[][] | null> {
    const validTexts = texts.map(t => (t ?? '').trim()).filter(Boolean);
    if (!validTexts.length) return null;
    if (!process.env.COHERE_API_KEY) {
      this.logger.error('Cannot generate embeddings: COHERE_API_KEY is missing');
      return null;
    }
    try {
      const response = await this.cohere.embed({
        texts: validTexts,
        model: 'embed-multilingual-v3.0',
        inputType: isQuery ? 'search_query' : 'search_document',
      });
      return response.embeddings as number[][];
    } catch (err) {
      this.logger.error(`Cohere Batch Embedding failed: ${err}`);
      return null;
    }
  }
}
