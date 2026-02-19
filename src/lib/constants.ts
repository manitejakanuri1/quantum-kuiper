// Shared constants — Talk to Site

export const FACE_THUMBNAILS: Record<string, { src: string; label: string; name: string }> = {
  'cace3ef7-a4c4-425d-a8cf-a5358eb0c427': { src: '/faces/tina.png', label: 'Sales Agent', name: 'Tina' },
  '7e74d6e7-d559-4394-bd56-4923a3ab75ad': { src: '/faces/sabour.png', label: 'Customer Support', name: 'Sabour' },
  'f0ba4efe-7946-45de-9955-c04a04c367b9': { src: '/faces/doctor.png', label: 'Knowledge Expert', name: 'Doctor' },
  '804c347a-26c9-4dcf-bb49-13df4bed61e8': { src: '/faces/mark.png', label: 'Negotiator', name: 'Mark' },
};

export const DEFAULT_FACE_ID = 'cace3ef7-a4c4-425d-a8cf-a5358eb0c427';
export const DEFAULT_VOICE_ID = '1b160c4cf02e4855a09efd59475b9370';
export const DEFAULT_GREETING = 'Hi! How can I help you today?';
export const DEFAULT_SYSTEM_PROMPT =
  'You are a helpful customer support agent. Answer questions based only on the provided context. If you don\'t know the answer, say so.';

/**
 * Auto-generate a system prompt from agent name + website URL.
 * Called when creating a new agent so users see a useful prompt immediately.
 */
export function generateSystemPrompt(agentName: string, websiteUrl: string): string {
  let domain = '';
  try {
    domain = new URL(websiteUrl).hostname.replace('www.', '');
  } catch {
    domain = websiteUrl;
  }

  return `You are ${agentName}, the voice AI assistant for ${domain}. You know everything about ${domain} and you're genuinely excited to help visitors learn about it.

PERSONALITY:
- You're warm, enthusiastic, and love talking about ${domain}.
- Keep answers short and spoken — 1-2 sentences for simple questions, 2-3 max for complex ones.
- Start responses with natural reactions like "Great question!", "Oh absolutely!", "Sure thing!"
- Say "we" and "our" — you're part of the team.
- If you don't know something, be honest and warm: "I'm not sure about that, but you can reach out to us at ${domain}!"
- Never sound robotic or like you're reading from a document.`;
}
