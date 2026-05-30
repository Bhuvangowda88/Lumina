import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.GEMINI_API_KEY || "";
const ai = new GoogleGenAI({ apiKey: API_KEY });

export type SummaryDetail = 'concise' | 'standard' | 'detailed';

export async function processDocument(
  text: string, 
  mode: 'summarize' | 'audiobook', 
  detail: SummaryDetail = 'standard',
  image?: { mimeType: string, data: string }
): Promise<string> {
  if (!API_KEY) throw new Error("GEMINI_API_KEY is not configured.");

  const modelName = "gemini-3-flash-preview";
  let prompt = "";

  if (mode === 'summarize') {
    const detailInstruction = {
      concise: "Keep it very short—just the 'Big Idea' of the story in a few simple sentences.",
      standard: "Tell the main story with all the important parts, but keep it easy to follow and friendly.",
      detailed: "Tell the whole story with lots of fun details and explanations so we don't miss anything important."
    }[detail];

    const visionInstruction = image 
      ? "\nVISUAL STORYTELLING: Since this is an IMAGE, first look at it carefully. Describe the scene, the characters, and the colors using 'spatial language' (left, right, top) and sensory metaphors so a visually impaired child can build a mental map. Then tell a story based on what's happening."
      : "";

    prompt = `
      You are a warm, magical storyteller and a helpful learning buddy for a 5-year-old child. 
      Your mission is to turn THE CONTENT below into a simple, happy story that even a tiny explorer would understand and love!
      ${visionInstruction}
      
      RULES FOR A 5-YEAR-OLD:
      1. THE "MOMMY/DADDY" RULE: Speak exactly like a parent reading a favorite book. Use a warm, happy, and slow pace.
      2. SIMPLE WORDS ONLY: Use words like "Big," "Happy," "Little," "Go," and "See." Avoid any word longer than 3 syllables.
      3. STORYBOOK FLOW: Start with "Once upon a time..." or "Look at this!". 
      4. POINTING & DESCRIBING: Describe things as you see them. "See the blue sky? It looks so pretty!"
      5. EASY REPEATING: If something is cool, say it twice! "The red car... the fast red car!"
      6. NO LISTS OR NUMBERS: Tell it as one long, happy story. 
      7. CLEAN TEXT: Do not use any special symbols, stars, or dots. Just plain, beautiful words.
      8. ${detailInstruction}
      
      CONTENT TO TRANSFORM:
      ${text || "Find something happy in the picture and tell a little story about it."}
    `;
  } else {
    prompt = `
      The user wants to listen to this content as a warm, happy story for a 5-year-old child. 
      ${image ? "Tell a very simple story about the picture. Point to colors and happy faces." : "Transform this text into a tiny, simple story for a little child."}
      
      STORYTELLING RULES:
      1. Use ONLY tiny, easy words.
      2. No lists, no numbers, no big ideas. 
      3. Make it sound like a bedtime story.
      4. Use fun sounds like "Pop!" or "Whiz!"
      5. Keep it very short and very happy.

      CONTENT:
      ${text || "Tell a story about the pretty picture."}
    `;
  }

  try {
    const parts: any[] = [{ text: prompt }];
    if (image) {
      parts.push({
        inlineData: {
          mimeType: image.mimeType,
          data: image.data
        }
      });
    }

    const response = await ai.models.generateContent({
      model: modelName,
      contents: [{ role: 'user', parts }],
    });

    let textResult = response.text;

    // Fallback for audiobook mode if AI returns empty or fails
    if (mode === 'audiobook' && (!textResult || textResult.length < text.length * 0.1)) {
        console.warn("AI cleaned content significantly shorter than source in Audiobook mode. Falling back to source.");
        textResult = text; 
    }

    if (!textResult) throw new Error("Synthesis engine returned empty response.");
    return textResult;
  } catch (error) {
    if (mode === 'audiobook') {
        console.warn("Gemini failed in Audiobook mode, using raw text extraction.", error);
        return text; // Verbatim fallback
    }
    console.error("Gemini Error:", error);
    throw new Error("Neural engine failed to process the material.");
  }
}

export async function chatWithDocument(
  history: { role: 'user' | 'assistant', content: string }[],
  message: string,
  context?: string,
  image?: { mimeType: string, data: string }
): Promise<string> {
  if (!API_KEY) throw new Error("GEMINI_API_KEY is not configured.");

  const modelName = "gemini-3-flash-preview";
  
  const systemInstruction = `
    You are Lumina AI, a warm, magical storyteller and a helpful learning buddy for a 5-year-old child. 
    ${context || image ? `We are exploring a ${image ? 'pretty picture' : 'happy story'} together. Your goal is to answer the child's questions in a tiny, simple, and happy way!` : "Answer the user's questions clearly and simply, like you're talking to a little friend."}
    
    RULES FOR A 5-YEAR-OLD:
    1. THE "MOMMY/DADDY" RULE: Speak exactly like a parent reading a favorite book. Be warm, patient, and very happy.
    2. TINY WORDS: Use only words a 5-year-old knows. No big "grown-up" words.
    3. STORYBOOK STYLE: Even when answering questions, keep it sounding like a story. "Oh, that's a great question! Listen close..."
    4. HAPPY SECRETS: Treat facts like magical secrets we've found together.
    5. NO LISTS: Do not use numbers or bullet points. Use happy, flowing sentences.
    6. SOUNDS: Use sounds like "Pop!", "Whiz!", or "Squeak!" to make it fun.
    7. CLEAN TEXT: No stars, no dots, no special marks. Just plain, happy words.
    
    ${context ? `MAGIC STORY CONTEXT:\n---\n${context}\n---\n` : ""}
    ${image ? "LOOK AT THE PICTURE: There is a pretty picture attached. Look at its colors and shapes when answering questions." : ""}
  `;
  
  const contents = history.map(h => ({
    role: h.role === 'user' ? 'user' : 'model',
    parts: [{ text: h.content }]
  }));

  const newUserParts: any[] = [{ text: message }];
  if (image) {
    newUserParts.push({
      inlineData: {
        mimeType: image.mimeType,
        data: image.data
      }
    });
  }

  contents.push({
    role: 'user',
    parts: newUserParts
  });

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: contents,
      config: {
        systemInstruction: systemInstruction.trim()
      }
    });

    return response.text || "I'm sorry, I couldn't find the answer in our magic book.";
  } catch (error) {
    console.error("Gemini Chat Error:", error);
    throw new Error("Chat engine failed.");
  }
}
