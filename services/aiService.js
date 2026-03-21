const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY, {
  apiVersion: "v1",
});

/**
 * Pauses execution for a given number of milliseconds.
 * Used between retry attempts when rate limited.
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Calls the Gemini API with automatic retry on rate limit (429) errors.
 * Will attempt up to 3 times with increasing wait times between attempts.
 *
 * @param {Object} model      - The Gemini model instance
 * @param {String} prompt     - The prompt to send
 * @param {Number} attempt    - Current attempt number (starts at 1)
 * @returns {Object}          - The Gemini result object
 */
const callWithRetry = async (model, prompt, attempt = 1) => {
  const MAX_ATTEMPTS = 3;

  try {
    return await model.generateContent(prompt);
  } catch (error) {
    const isRateLimit =
      error.message?.includes("429") ||
      error.message?.includes("Too Many Requests") ||
      error.message?.includes("quota");

    if (isRateLimit && attempt < MAX_ATTEMPTS) {
      // Wait longer on each retry: 5s, then 15s
      const waitTime = attempt === 1 ? 5000 : 15000;
      console.log(
        `[Gemini] Rate limited. Attempt ${attempt}/${MAX_ATTEMPTS}. Retrying in ${waitTime / 1000}s...`
      );
      await sleep(waitTime);
      return callWithRetry(model, prompt, attempt + 1);
    }

    // If still failing after max attempts, throw a clean user-facing error
    if (isRateLimit) {
      throw new Error(
        "The AI service is currently busy. Please wait 1 minute and try again."
      );
    }

    throw error;
  }
};

/**
 * Generates a personalised STEAM learning pathway using Gemini AI.
 * Builds a structured prompt from the user's assessment and returns
 * a parsed JSON pathway object.
 *
 * @param {Object} assessmentData - The saved assessment document
 * @returns {Object}              - Parsed pathway JSON from Gemini
 */
const generateLearningPathway = async (assessmentData) => {
  const { skillLevel, domain, subfield, goals, constraints } = assessmentData;

  // Format labels for the prompt e.g. "data_science" → "Data Science"
  const subfieldLabel = subfield
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  const domainLabel = domain.charAt(0).toUpperCase() + domain.slice(1);

  const prompt = `
You are an expert STEAM education advisor specialising in ${subfieldLabel} within ${domainLabel}.
You are helping an African woman build a personalised, practical learning pathway.

LEARNER PROFILE:
- Domain: ${domainLabel}
- Specific Field: ${subfieldLabel}
- Current Skill Level: ${skillLevel}
- Learning Goals: ${goals}
- Time Available Per Week: ${constraints?.timeAvailability || "2_to_5hrs"}
- Internet Access Quality: ${constraints?.internetAccess || "moderate"}
- Learning Pace: ${constraints?.learningPace || "moderate"}
- Preferred Language: ${constraints?.preferredLanguage || "English"}

YOUR TASK:
Generate a focused, practical learning pathway specifically for ${subfieldLabel}.
- Create 4 to 6 modules that are directly relevant to ${subfieldLabel} (NOT generic STEAM topics).
- Each module must build on the previous one (progressive difficulty).
- Calibrate depth and pace to someone with ${skillLevel} level in ${subfieldLabel}.
- Keep estimated hours realistic for someone with ${constraints?.timeAvailability || "2_to_5hrs"} per week.
- For each module, include 2 to 3 real, free or low-cost resources from platforms like:
  freeCodeCamp, Coursera (free audit), edX (free audit), Khan Academy, YouTube, MIT OpenCourseWare,
  fast.ai, Google Colab, W3Schools, Codecademy (free tier), or similar.
- Prefer resources that are accessible with ${constraints?.internetAccess || "moderate"} internet.
- Write an overall explanation of why this pathway structure suits this specific learner.

RESPOND WITH VALID JSON ONLY. No markdown, no extra text, no code fences. Exact structure:
{
  "title": "Descriptive pathway title mentioning ${subfieldLabel}",
  "summary": "2-3 sentence summary of what the learner will achieve",
  "aiExplanation": "Why this pathway is structured this way for this specific learner",
  "modules": [
    {
      "title": "Specific module title",
      "description": "What the learner will learn and be able to do after this module",
      "difficulty": "beginner",
      "estimatedHours": 3,
      "domain": "${subfield}",
      "reason": "Why this module is included at this point for this learner",
      "resources": [
        {
          "title": "Resource name",
          "url": "https://actual-working-url.com",
          "format": "video",
          "source": "Platform name",
          "isFree": true
        }
      ]
    }
  ]
}
`;

  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 3000,
    },
  });

  const result = await callWithRetry(model, prompt);
  const rawText = result.response.text().trim();

  // Strip any accidental markdown fences Gemini might add
  const cleaned = rawText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  const parsed = JSON.parse(cleaned);
  return parsed;
};

module.exports = { generateLearningPathway };