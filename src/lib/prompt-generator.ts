// Prompt Generator
// Analyzes crawled website content to generate a preview system prompt for UI transparency

import { CrawledPage } from './firecrawl';

interface BusinessSignals {
    businessType: string;
    companyName: string;
    services: string[];
    tone: 'professional' | 'casual' | 'emergency' | 'technical' | 'friendly';
    topics: string[];
}

// Business type keywords for detection
const BUSINESS_KEYWORDS: Record<string, string[]> = {
    'e-commerce': ['shop', 'store', 'buy', 'cart', 'checkout', 'product', 'price', 'order', 'shipping'],
    'healthcare': ['health', 'medical', 'doctor', 'patient', 'treatment', 'clinic', 'hospital', 'care'],
    'legal': ['law', 'attorney', 'lawyer', 'legal', 'court', 'case', 'rights', 'litigation'],
    'real-estate': ['property', 'home', 'house', 'rent', 'buy', 'mortgage', 'real estate', 'listing'],
    'restaurant': ['menu', 'food', 'dining', 'restaurant', 'order', 'delivery', 'reservation'],
    'education': ['learn', 'course', 'student', 'education', 'school', 'training', 'class'],
    'technology': ['software', 'app', 'platform', 'tech', 'cloud', 'data', 'api', 'integration'],
    'finance': ['bank', 'loan', 'investment', 'finance', 'credit', 'insurance', 'account'],
    'automotive': ['car', 'vehicle', 'auto', 'repair', 'service', 'dealer', 'parts'],
    'plumbing': ['plumber', 'plumbing', 'pipe', 'drain', 'leak', 'water', 'repair', 'emergency'],
    'hvac': ['hvac', 'heating', 'cooling', 'air conditioning', 'furnace', 'ac', 'ventilation'],
    'general-service': ['service', 'contact', 'about', 'help', 'support']
};

// Tone indicators
const TONE_KEYWORDS: Record<string, string[]> = {
    'emergency': ['emergency', '24/7', 'urgent', 'immediate', 'fast response', 'same day'],
    'professional': ['professional', 'certified', 'licensed', 'expert', 'experienced', 'trusted'],
    'casual': ['friendly', 'easy', 'simple', 'quick', 'hassle-free', 'affordable'],
    'technical': ['technical', 'specification', 'documentation', 'api', 'integration', 'developer']
};

/**
 * Analyze crawled pages to detect business signals
 */
function analyzeContent(pages: CrawledPage[]): BusinessSignals {
    const allContent = pages.map(p => `${p.title} ${p.content}`).join(' ').toLowerCase();
    const allTitles = pages.map(p => p.title).join(' ');

    // Detect business type
    let businessType = 'general-service';
    let maxScore = 0;

    for (const [type, keywords] of Object.entries(BUSINESS_KEYWORDS)) {
        const score = keywords.filter(kw => allContent.includes(kw.toLowerCase())).length;
        if (score > maxScore) {
            maxScore = score;
            businessType = type;
        }
    }

    // Extract company name from first page title or domain-like patterns
    let companyName = 'this company';
    if (pages.length > 0 && pages[0].title) {
        // Take first part of title before common separators
        const titleParts = pages[0].title.split(/[|\-–—]/);
        if (titleParts.length > 0) {
            companyName = titleParts[titleParts.length - 1].trim() || titleParts[0].trim();
            if (companyName.length > 50) {
                companyName = companyName.substring(0, 50);
            }
        }
    }

    // Detect services from page titles
    const services: string[] = [];
    const serviceWords = ['service', 'solution', 'help', 'support', 'offer', 'provide'];
    for (const page of pages) {
        if (serviceWords.some(sw => page.title.toLowerCase().includes(sw))) {
            const cleanTitle = page.title.split(/[|\-–—]/)[0].trim();
            if (cleanTitle && cleanTitle.length < 60 && !services.includes(cleanTitle)) {
                services.push(cleanTitle);
            }
        }
    }

    // Limit services
    const topServices = services.slice(0, 5);
    if (topServices.length === 0) {
        topServices.push('answering questions about products and services');
    }

    // Detect tone
    let tone: BusinessSignals['tone'] = 'professional';
    for (const [t, keywords] of Object.entries(TONE_KEYWORDS)) {
        if (keywords.some(kw => allContent.includes(kw.toLowerCase()))) {
            tone = t as BusinessSignals['tone'];
            break;
        }
    }

    // Extract topics from page titles
    const topics = pages
        .map(p => p.title.split(/[|\-–—]/)[0].trim())
        .filter(t => t && t.length > 3 && t.length < 50)
        .slice(0, 8);

    return {
        businessType,
        companyName,
        services: topServices,
        tone,
        topics: topics.length > 0 ? topics : ['general information']
    };
}

/**
 * Generate a preview system prompt based on crawled content signals
 */
export function generatePreviewPrompt(pages: CrawledPage[]): string {
    if (!pages || pages.length === 0) {
        return getDefaultPreviewPrompt();
    }

    const signals = analyzeContent(pages);

    // Format business type for display
    const businessTypeDisplay = signals.businessType
        .split('-')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

    // Build the preview prompt
    const prompt = `[Identity]
You are a helpful AI assistant for ${signals.companyName}. You specialize in ${businessTypeDisplay.toLowerCase()} and help visitors with their questions and needs.

[Style]
${getToneDescription(signals.tone)}
Keep responses conversational yet informative.
Adapt your communication style to match the visitor's needs.

[Task & Goals]
${signals.services.map(s => `- ${s}`).join('\n')}
- Answer questions about the company and its offerings
- Guide visitors to the right information

[Topics You Can Help With]
${signals.topics.map(t => `- ${t}`).join('\n')}

[Error Handling]
If you're unsure about specific details, acknowledge this and suggest the visitor contact the company directly for the most accurate information.
For urgent matters, recommend contacting the business through their official channels.`;

    return prompt;
}

/**
 * Get tone description based on detected tone
 */
function getToneDescription(tone: BusinessSignals['tone']): string {
    switch (tone) {
        case 'emergency':
            return `Respond with urgency and reassurance. Prioritize getting help quickly.
Acknowledge the stress of emergency situations.`;
        case 'professional':
            return `Maintain a professional yet approachable demeanor.
Be thorough and accurate in your responses.`;
        case 'casual':
            return `Be friendly and approachable. Use conversational language.
Make interactions feel easy and stress-free.`;
        case 'technical':
            return `Provide detailed, accurate technical information.
Use appropriate terminology while remaining clear.`;
        case 'friendly':
        default:
            return `Be warm and welcoming. Make visitors feel comfortable.
Balance helpfulness with a personal touch.`;
    }
}

/**
 * Default preview prompt when no pages are available
 */
function getDefaultPreviewPrompt(): string {
    return `[Identity]
You are a helpful AI assistant for this website. You help visitors find information and answer their questions.

[Style]
Be professional yet friendly and approachable.
Keep responses clear and helpful.

[Task & Goals]
- Answer visitor questions
- Provide helpful information
- Guide users to the right resources

[Error Handling]
If unsure about specific details, suggest contacting the company directly.`;
}
