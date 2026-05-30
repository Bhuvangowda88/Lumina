# Lumina Summarizer 📖✨

Lumina Summarizer is a friendly, AI-powered learning buddy designed to turn documents into exciting stories for children. By combining advanced document interrogation with a warm, "Human-Storyteller" narrative style, Lumina makes learning accessible, engaging, and immersive for young explorers (ages 10+).

## 🚀 Key Features

### 1. Interactive Storytelling & Summaries
*   **Narrative Mode:** Transforms dry text into fun, conversational stories using metaphors and simple language.
*   **Depth Control:** Choose between **Concise** (The Big Idea), **Standard** (The Main Adventure), or **Detailed** (The Full Story with Mental Mapping).
*   **Automatic Re-Synthesis:** Switching depths instantly updates the AI's script and the audio narration.

### 2. Immersive Soundscape Mode 🎧
*   **Contextual SFX:** Synthesized sound effects that trigger during narration (e.g., Zac's squeak, pitter-patter for ants, or the clink of a pan).
*   **Ambient Textures:** A soft "kitchen hum" or ambient background layer helps create a 3D mental space for the reader.
*   **Audio Anchors:** Sounds are placed to help visually impaired users build a mental map of the scene.

### 3. Progressive Accessibility
*   **Mental Mapping:** AI uses spatial language (left, right, top) and sensory descriptions to help visually impaired children "see" the document.
*   **High-Contrast Storytelling:** Vivid metaphors describe colors, textures, and shapes (e.g., "a bright green leaf like a tiny emerald").
*   **Screen-Reader Optimized:** Proper ARIA labels and keyboard-first navigation focus.
*   **Keyboard Shortcuts:**
    *   **Space Bar:** Play/Pause narration.
    *   **'R' Key:** Restart the story from the beginning.

### 4. The "Human-Storyteller" Voice
*   **Deep/Warm adult profile:** A friendly, narrative-style voice synthesis.
*   **Natural Cadence:** Injected pauses after headings and sentence breaks mimic human storytelling "breaths."
*   **Vocabulary Guard:** Automatically converts complex jargon into simple, child-friendly synonyms.

## 🛠️ Technology Stack

*   **Frontend:** React 18+, Vite, TypeScript.
*   **Styling:** Tailwind CSS with a "Natural" academic aesthetic.
*   **Animations:** `motion` (framer-motion) for soft UI transitions.
*   **AI Engine:** Google Gemini (via `@google/genai`).
*   **Audio Engine:** Web Speech API (Narration) + Web Audio API (Synthetic Soundscapes).
*   **Backend:** Firebase Firestore and Authentication.

## � Firebase Auth Setup

1.  Open the Firebase Console for this project.
2.  Go to `Authentication` → `Settings`.
3.  Under `Authorized domains`, add:
    * `localhost`
    * `127.0.0.1`.
    * `192.168.0.108`
4.  Save the settings and reload the app.

If you access the app from a different local hostname, add that hostname as well.

## �📖 How to Use

1.  **Sign In:** Log in securely using your Google account.
2.  **Upload:** Drop a PDF or text file into the Synthesis Studio.
3.  **Explore:** Choose your **Depth** (Concise to Detailed).
4.  **Listen:** Toggle **SFX** for an immersive soundscape and hit Play!
5.  **Interrogate:** Use the chat box to ask the AI survivor questions like "What does Zac's pan look like?" or "Can you tell that part again?"

---
*Built with Lumina AI — Turning documents into adventures.*
