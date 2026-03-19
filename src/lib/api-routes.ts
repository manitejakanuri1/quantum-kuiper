/**
 * Centralized API route definitions.
 * Single source of truth for all frontend → backend API URLs.
 *
 * If a backend route changes, update it HERE and all callers stay correct.
 */

export const API_ROUTES = {
  // ── Auth ──
  simliToken: '/api/auth/simli-token',

  // ── Agents ──
  agents: '/api/agents',
  agent: (id: string) => `/api/agents/${id}`,
  agentConverse: (id: string) => `/api/agents/${id}/converse`,
  agentRegeneratePrompt: (id: string) => `/api/agents/${id}/regenerate-prompt`,
  agentCrawl: (id: string) => `/api/agents/${id}/crawl`,
  agentCrawlStatus: (id: string) => `/api/agents/${id}/crawl/status`,
  agentCrawlProcess: (id: string) => `/api/agents/${id}/crawl/process`,

  // ── Custom Face ──
  agentFace: (id: string) => `/api/agents/${id}/face`,
  agentFaceStatus: (id: string) => `/api/agents/${id}/face/status`,

  // ── Custom Voice ──
  agentVoice: (id: string) => `/api/agents/${id}/voice`,
  agentVoiceStatus: (id: string) => `/api/agents/${id}/voice/status`,

  // ── Voice ──
  tts: '/api/tts',
  voiceGallery: '/api/voices/gallery',

  // ── Widget ──
  widgetConfig: (agentId: string) => `/api/widget/${agentId}`,
} as const;
