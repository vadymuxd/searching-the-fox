import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

class GeminiService {
  private genAI: GoogleGenerativeAI | null = null;
  private model: GenerativeModel | null = null;

  constructor() {
    this.initializeAPI();
  }

  private initializeAPI() {
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    
    if (!apiKey) {
      console.warn('Gemini API key not found. Please set NEXT_PUBLIC_GEMINI_API_KEY environment variable.');
      return;
    }

    try {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    } catch (error) {
      console.error('Failed to initialize Gemini API:', error);
    }
  }

  async getJobSeekerInsight(): Promise<string> {
    if (!this.model) {
      throw new Error('Gemini API not initialized. Please check your API key.');
    }

    const prompt = "Your role: You are a job seeker adviser who should entertain a job seeker while he is waiting for something. You know market data insights, hiring process, and many fun facts and stats. Your task: Tell a random surprising fact that will be interesting to know for a job seeker. Fact text format: The fact should be written in a one or two single sentences. The tone of voice should be randomly determine so each next fact written slightly differently. The text should not contain vanity words and sentences like \"this is a surprising fact\" or \"you will be surprised to know\" or  \"did you know\". The text should be adjective rich but concise and functional. Fact generation: When you start generating the fact do not use the most statistically likely fact, use less likely fact so this will greatly randomise the response after each time you receive this prompt.";

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Clean up the response text - remove quotes if they exist
      return text.replace(/^["']|["']$/g, '').trim();
    } catch (error) {
      console.error('Error fetching insight from Gemini:', error);
      // Return a fallback insight if API fails
      return "Networking is responsible for 70% of job opportunities, yet most are never publicly advertised.";
    }
  }

  isAvailable(): boolean {
    return this.model !== null;
  }
}

export const geminiService = new GeminiService();
