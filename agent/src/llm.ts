import OpenAI from "openai";

/**
 * Provider-agnostic LLM client for the verifiers. Works with OpenAI or any
 * OpenAI-compatible endpoint (e.g. Groq) via env, so the agent can reason with
 * GPT-4o or Llama 4 with no code change. Falls back to `null` (heuristic mode)
 * when no key is set.
 *
 * Env (any of):
 *   GROQ_API_KEY            -> uses Groq (https://api.groq.com/openai/v1)
 *   OPENAI_API_KEY          -> uses OpenAI
 *   LLM_API_KEY + LLM_BASE_URL  -> explicit override for any provider
 *   LLM_MODEL / LLM_VISION_MODEL -> override the text / vision model ids
 */
const groqKey = process.env.GROQ_API_KEY;
const openaiKey = process.env.OPENAI_API_KEY;

const apiKey = process.env.LLM_API_KEY || groqKey || openaiKey;
const inferredBaseUrl = groqKey && !openaiKey ? "https://api.groq.com/openai/v1" : undefined;
const baseURL = process.env.LLM_BASE_URL || inferredBaseUrl;

const isGroq = (baseURL ?? "").includes("groq");

export const llm = apiKey && apiKey !== "mock" ? new OpenAI({ apiKey, baseURL }) : null;

/** Text/judgment model (MANUAL without image). */
export const TEXT_MODEL =
  process.env.LLM_MODEL || (isGroq ? "llama-3.3-70b-versatile" : "gpt-4o");

/** Multimodal model (RECEIPT, DELIVERY, MANUAL with image). */
export const VISION_MODEL =
  process.env.LLM_VISION_MODEL ||
  (isGroq ? "meta-llama/llama-4-scout-17b-16e-instruct" : "gpt-4o");

export const LLM_PROVIDER: "groq" | "openai" | "none" = !llm
  ? "none"
  : isGroq
    ? "groq"
    : "openai";
