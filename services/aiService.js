/**
 * aiService.js
 * Uses the Groq API to generate personalised STEAM learning pathways.
 * Model: llama-3.1-8b-instant (fast, capable, free tier)
 * Get your free API key at: https://console.groq.com
 */

const GROQ_URL   = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.1-8b-instant";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── callGroq — top level so all functions can use it ─────────────
const callGroq = async (prompt, attempt = 1) => {
  const MAX_ATTEMPTS = 3;
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error("GROQ_API_KEY is missing from your .env file.");
  }

  const response = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are an expert STEAM education advisor. Always respond with valid JSON only. No markdown, no code fences, no extra text.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 3000,
    }),
  });

  if (response.status === 429 && attempt < MAX_ATTEMPTS) {
    const wait = attempt === 1 ? 5000 : 15000;
    console.log(`[Groq] Rate limited. Attempt ${attempt}/${MAX_ATTEMPTS}. Retrying in ${wait / 1000}s...`);
    await sleep(wait);
    return callGroq(prompt, attempt + 1);
  }

  if (response.status === 429) {
    throw new Error("The AI service is currently busy. Please wait 1 minute and try again.");
  }

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("[Groq] API error:", response.status, errorBody);
    throw new Error(`AI service error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error("AI service returned an empty response.");
  }

  return text.trim();
};

// ── generateLearningPathway ───────────────────────────────────────
const generateLearningPathway = async (assessmentData) => {
  const { skillLevel, domain, subfield, goals, constraints } = assessmentData;

  const subfieldLabel = subfield
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  const domainLabel = domain.charAt(0).toUpperCase() + domain.slice(1);

  const prompt = `You are an expert STEAM education advisor specialising in ${subfieldLabel} within ${domainLabel}. You are helping an African woman build a personalised, practical learning pathway.

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
- Create 4 to 6 modules directly relevant to ${subfieldLabel}.
- Each module must build on the previous one in difficulty.
- Calibrate depth to someone with ${skillLevel} level knowledge.
- - For each module include 2 to 3 free resources. Use ONLY these exact base URLs:
  * https://www.freecodecamp.org/learn/ (for web dev, JS, Python, data science)
  * https://www.youtube.com/watch?v= (YouTube — always works)
  * https://www.khanacademy.org/computing/ or https://www.khanacademy.org/math/
  * https://developer.mozilla.org/en-US/docs/ (for web/JavaScript)
  * https://www.w3schools.com/ (for HTML, CSS, JS, SQL, Python)
  * https://docs.python.org/3/tutorial/ (for Python)
  * https://www.coursera.org/learn/ (specific course slugs)
  * https://ocw.mit.edu/courses/ (MIT OpenCourseWare)
  * https://www.codecademy.com/learn/ (free courses)
  * https://fast.ai (for ML/AI)
  * https://kaggle.com/learn (for data science/ML)
  * https://git-scm.com/book/en/v2 (for Git)
  * https://cs50.harvard.edu/ (for CS fundamentals)
- IMPORTANT: Use real, specific URLs — not homepage URLs
- IMPORTANT: YouTube links must be real video URLs with actual video IDs
- NEVER invent URLs — only use URLs you are certain exist
- Write a brief overall explanation of why this pathway suits this learner.

RESPOND WITH VALID JSON ONLY. No markdown, no code fences, no text before or after the JSON:
{
  "title": "Descriptive pathway title mentioning ${subfieldLabel}",
  "summary": "2-3 sentence summary of what the learner will achieve",
  "aiExplanation": "Why this pathway is structured this way for this specific learner",
  "modules": [
    {
      "title": "Module title",
      "description": "What the learner will learn and be able to do after this module",
      "difficulty": "beginner",
      "estimatedHours": 3,
      "domain": "${subfield}",
      "reason": "Why this module is included at this point for this learner",
      "resources": [
        {
          "title": "Resource name",
          "url": "https://working-url.com",
          "format": "video",
          "source": "Platform name",
          "isFree": true
        }
      ]
    }
  ]
}`;

  const rawText = await callGroq(prompt);

  const cleaned = rawText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  const parsed = JSON.parse(cleaned);

  // Sanitise resource formats
  const validFormats = ["video", "article", "exercise", "course"];
  const formatMap = {
    web: "article", website: "article", tutorial: "article",
    blog: "article", book: "article", podcast: "video",
    interactive: "exercise", project: "exercise", quiz: "exercise",
    mooc: "course", certification: "course",
  };

  if (parsed.modules) {
    parsed.modules = parsed.modules.map((mod) => ({
      ...mod,
      resources: (mod.resources || []).map((resource) => ({
        ...resource,
        format: validFormats.includes(resource.format)
          ? resource.format
          : formatMap[resource.format?.toLowerCase()] || "article",
      })),
    }));
  }

  return parsed;
};

// ── replacebrokenResources ────────────────────────────────────────
const replacebrokenResources = async (brokenResources, subfieldLabel, domainLabel) => {
  if (!brokenResources.length) return [];

  const prompt = `You are a STEAM education resource curator.

The following learning resources for ${subfieldLabel} (${domainLabel}) have broken or inaccessible URLs.
Please provide working replacement resources for each one.

BROKEN RESOURCES TO REPLACE:
${brokenResources.map((r, i) => `${i + 1}. "${r.title}" — broken URL: ${r.url}`).join("\n")}

REQUIREMENTS:
- Provide exactly ${brokenResources.length} replacement(s), one for each broken resource above
- Use only well-known platforms: freeCodeCamp, Coursera, edX, Khan Academy, YouTube, MDN, W3Schools, fast.ai, MIT OpenCourseWare, Codecademy
- Every URL must be a real, publicly accessible page that does not require login to view
- Keep the same topic/subject as the broken resource it is replacing
- Prefer URLs to specific pages e.g. https://www.freecodecamp.org/learn/responsive-web-design/ not https://www.freecodecamp.org

RESPOND WITH VALID JSON ONLY, no markdown, no extra text:
[
  {
    "title": "Resource title",
    "url": "https://working-url.com/specific-page",
    "format": "video",
    "source": "Platform name",
    "isFree": true
  }
]`;

  const rawText = await callGroq(prompt);
  const cleaned = rawText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  return JSON.parse(cleaned);
};

module.exports = { generateLearningPathway, replacebrokenResources };