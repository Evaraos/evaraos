const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

const ROUTES = [
  { key: "home", title: "Home", route: "/index.html", aliases: ["home", "landing", "main"] },
  { key: "dashboard", title: "Dashboard", route: "/dashboard.html", aliases: ["dashboard", "dash", "overview", "command center"] },
  { key: "companies", title: "Companies", route: "/companies.html", aliases: ["companies", "company", "portfolio", "subsidiaries"] },
  { key: "leads", title: "Leads", route: "/leads.html", aliases: ["leads", "lead", "pipeline", "opportunities"] },
  { key: "jobs", title: "Jobs", route: "/jobs.html", aliases: ["jobs", "job", "work orders", "work"] },
  { key: "dispatch", title: "Dispatch", route: "/dispatch.html", aliases: ["dispatch", "assignments", "route jobs", "routing"] },
  { key: "settings", title: "Settings", route: "/settings.html", aliases: ["settings", "preferences", "profile"] },
  { key: "notifications", title: "Notifications", route: "/notifications.html", aliases: ["notifications", "alerts", "inbox"] },
  { key: "qa", title: "QA", route: "/qa.html", aliases: ["qa", "audit", "testing", "debug"] }
];

function normalize(value = "") {
  return String(value || "").trim().toLowerCase();
}

function clampText(value = "", max = 1200) {
  return String(value || "").slice(0, max);
}

function findRoute(prompt = "") {
  const q = normalize(prompt);
  if (!q) return null;

  let best = null;
  let score = 0;

  for (const route of ROUTES) {
    const terms = [route.key, route.title, route.route, ...route.aliases].map(normalize);
    for (const term of terms) {
      let nextScore = 0;
      if (q === term) nextScore = 100;
      else if (q.includes(`open ${term}`) || q.includes(`go to ${term}`) || q.includes(`show ${term}`)) nextScore = 85;
      else if (q.includes(term)) nextScore = 60;

      if (nextScore > score) {
        score = nextScore;
        best = route;
      }
    }
  }

  return score >= 50 ? best : null;
}

function localCommand(prompt = "") {
  const route = findRoute(prompt);
  if (route) {
    return {
      mode: "local_action",
      message: `Opening ${route.title}.`,
      action: {
        type: "navigate",
        route: route.route,
        title: route.title
      }
    };
  }

  return null;
}

function publicFallback(prompt = "") {
  return {
    mode: "local_pending_ai",
    message: "I can route app commands now. Full AI answers will activate once OPENAI_API_KEY is added to Firebase Functions secrets.",
    action: null,
    suggestions: [
      "open dashboard",
      "show leads",
      "open jobs",
      "go to companies",
      "open settings"
    ],
    prompt: clampText(prompt, 160)
  };
}

async function callOpenAI(prompt, context = {}) {
  const apiKey = OPENAI_API_KEY.value();
  if (!apiKey) return null;

  const OpenAI = require("openai");
  const client = new OpenAI({ apiKey });

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    max_tokens: 420,
    messages: [
      {
        role: "system",
        content: "You are Evaraos AI, a concise SaaS operations assistant. Help users navigate the app, understand dashboards, leads, jobs, companies, dispatch, settings, and operations. If the request is an app action, return practical guidance. Never reveal secrets."
      },
      {
        role: "user",
        content: JSON.stringify({ prompt: clampText(prompt), context })
      }
    ]
  });

  const text = response.choices?.[0]?.message?.content || "I could not generate a response.";
  return {
    mode: "ai_response",
    message: text,
    action: null
  };
}

exports.aiCommand = onCall(
  {
    region: "us-central1",
    enforceAppCheck: true,
    cors: true,
    secrets: [OPENAI_API_KEY],
    timeoutSeconds: 30,
    memory: "256MiB"
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in to use Evaraos AI.");
    }

    const prompt = clampText(request.data?.prompt || "").trim();
    const context = request.data?.context || {};

    if (!prompt || prompt.length < 2) {
      throw new HttpsError("invalid-argument", "Enter a command or question.");
    }

    const local = localCommand(prompt);
    if (local) return local;

    try {
      const ai = await callOpenAI(prompt, context);
      if (ai) return ai;
    } catch (error) {
      console.error("aiCommand OpenAI failed:", error);
      return {
        mode: "ai_error_fallback",
        message: "The AI backend is reachable, but the AI provider failed. Local app commands still work.",
        action: null
      };
    }

    return publicFallback(prompt);
  }
);
