# 🌐 Talk to Site - AI Voice Agent Platform

<div align="center">

![Talk to Site](https://img.shields.io/badge/AI-Voice%20Agent-purple?style=for-the-badge)
![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-Database-green?style=for-the-badge&logo=supabase)

**Deploy hyper-realistic AI agents that see, speak, and understand — trained on your business in minutes.**

[Get Started](#-quick-start) • [Features](#-features) • [Demo](#-demo) • [Documentation](#-project-structure)

</div>

---

## 📖 Overview

**Talk to Site** is an AI-powered voice agent platform that creates interactive digital twins for your website. These AI agents feature:

- 🎭 **Real-time lip-synced avatars** powered by Simli
- 🎙️ **Natural voice synthesis** using FishAudio TTS
- 🧠 **Intelligent conversations** via OpenAI GPT
- 📚 **Website-trained knowledge base** using RAG (Retrieval-Augmented Generation)
- ⚡ **Sub-500ms response times** for seamless interactions

---

## ✨ Features

### Core Capabilities

| Feature | Description |
|---------|-------------|
| **Real-Time Faces** | Photorealistic lip-sync with emotional expressions |
| **Voice Intelligence** | Natural conversations with instant understanding |
| **Website Trained** | Learns your business from your content automatically |
| **Lightning Fast** | Sub-500ms response for seamless interactions |

### Dashboard Features

- 📊 **Agent Management** - Create, edit, and deploy AI agents
- 🎨 **Avatar Customization** - Choose from multiple avatar styles
- 🔊 **Voice Selection** - Pick from various voice personalities
- 📈 **Usage Analytics** - Track agent interactions and performance
- 🔑 **API Keys** - Manage your API integrations
- 📚 **Knowledge Base** - Train agents on your business content
- 💬 **Session History** - View past conversations
- 💡 **Feedback System** - Collect user feedback

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **Next.js 16** | React framework with App Router |
| **TypeScript** | Type-safe development |
| **Tailwind CSS 4** | Modern utility-first styling |
| **Supabase** | PostgreSQL database & authentication |
| **Simli** | Real-time avatar lip-sync |
| **FishAudio** | Text-to-Speech synthesis |
| **OpenAI GPT** | AI conversation & Whisper STT |
| **NextAuth.js** | Authentication management |

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Git

### Step 1: Clone the Repository

```bash
git clone https://github.com/manitejakanuri1/quantum-kuiper.git
cd quantum-kuiper
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Configure Environment Variables

Create a `.env.local` file in the root directory:

```bash
cp env.template .env.local
```

Fill in your API keys:

```env
# Authentication (generate a 32-character random string)
AUTH_SECRET=your-32-character-secret-key

# Simli API (Real-time avatar) - Get from https://simli.com
NEXT_PUBLIC_SIMLI_API_KEY=your-simli-api-key
SIMILE_API_KEY=your-simli-api-key

# Supabase Database - Get from https://supabase.com
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# FishAudio API (TTS) - Get from https://fish.audio
FISH_AUDIO_API_KEY=your-fishaudio-api-key

# OpenAI API (GPT + Whisper) - Get from https://platform.openai.com
OPENAI_API_KEY=your-openai-api-key

# Backend Server Port
BACKEND_PORT=8080
```

### Step 4: Set Up Database

Run the following SQL scripts in your Supabase SQL editor:

1. **Main Schema** - `supabase-schema.sql`
2. **RAG Schema** - `supabase-rag-schema.sql`
3. **Website Data** - `supabase-website-data.sql`

### Step 5: Start the Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

---

## 📁 Project Structure

```
quantum-kuiper/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── api/               # API routes
│   │   │   ├── agents/        # Agent CRUD operations
│   │   │   ├── auth/          # Authentication endpoints
│   │   │   ├── chat/          # Chat/conversation API
│   │   │   ├── tts/           # Text-to-Speech API
│   │   │   └── ...
│   │   ├── auth/              # Login & Signup pages
│   │   │   ├── login/
│   │   │   └── signup/
│   │   ├── dashboard/         # Main dashboard
│   │   │   ├── agents/        # Agent management
│   │   │   ├── avatars/       # Avatar selection
│   │   │   ├── voices/        # Voice customization
│   │   │   ├── knowledge/     # Knowledge base
│   │   │   ├── sessions/      # Session history
│   │   │   ├── api-keys/      # API key management
│   │   │   ├── feedback/      # User feedback
│   │   │   ├── settings/      # Account settings
│   │   │   └── ...
│   │   ├── create/            # Create new agent
│   │   ├── edit/              # Edit existing agent
│   │   └── page.tsx           # Landing page
│   │
│   ├── components/            # React components
│   │   ├── AgentCard.tsx      # Agent display card
│   │   ├── AgentTemplates.tsx # Template gallery
│   │   ├── AuthShowcase.tsx   # Auth UI components
│   │   ├── AvatarInteraction.tsx # Avatar chat interface
│   │   ├── DashboardSidebar.tsx  # Navigation sidebar
│   │   ├── EmbedModal.tsx     # Embed code generator
│   │   ├── FaceGallery.tsx    # Avatar selection
│   │   ├── SimliAvatar.tsx    # Simli integration
│   │   ├── UsageChart.tsx     # Analytics chart
│   │   └── VoiceSelector.tsx  # Voice picker
│   │
│   └── lib/                   # Utilities & configurations
│       ├── auth.ts            # NextAuth configuration
│       ├── supabase.ts        # Supabase client
│       └── types.ts           # TypeScript types
│
├── backend/                   # Express backend server
│   ├── server.js              # WebSocket & API server
│   └── ...
│
├── public/                    # Static assets
├── streamlit_backend/         # Python Streamlit backend (optional)
├── env.template               # Environment template
├── supabase-*.sql             # Database schema files
└── package.json               # Dependencies
```

---

## 📱 User Walkthrough

### 1. Landing Page
Visit the homepage to see the stunning animated landing page with feature highlights and call-to-action buttons.

### 2. Sign Up / Login
Create an account or log in using the authentication system powered by NextAuth.js.

### 3. Dashboard
After logging in, you'll see your personalized dashboard with:
- **Agent Templates** - Quick-start templates for common use cases
- **Developer Quickstart** - Quick access to documentation
- **Usage Chart** - Monitor your agent usage

### 4. Create an Agent
1. Click "Create Agent" or choose a template
2. Enter your website URL to train the agent
3. Select an avatar from the gallery
4. Choose a voice personality
5. Customize the agent's persona and instructions
6. Deploy your agent

### 5. Avatar Interaction
- Start a voice conversation with your AI agent
- Real-time lip-sync responds to the agent's speech
- Natural conversation flow with context awareness

### 6. Embed on Your Website
Get the embed code from the modal and add it to your website to deploy the agent live.

---

## 📡 API Reference

### Agent Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/agents` | List all agents |
| POST | `/api/agents` | Create new agent |
| GET | `/api/agents/[id]` | Get agent details |
| PUT | `/api/agents/[id]` | Update agent |
| DELETE | `/api/agents/[id]` | Delete agent |

### Chat Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat` | Send message to agent |
| POST | `/api/tts` | Text-to-speech conversion |

---

## 🔒 External Services Setup

### 1. Simli (Avatar Lip-Sync)
1. Visit [simli.com](https://simli.com)
2. Create an account
3. Get your API key from the dashboard
4. Add to `NEXT_PUBLIC_SIMLI_API_KEY` and `SIMILE_API_KEY`

### 2. FishAudio (Text-to-Speech)
1. Visit [fish.audio](https://fish.audio)
2. Create an account
3. Get your API key
4. Add to `FISH_AUDIO_API_KEY`

### 3. OpenAI (GPT & Whisper)
1. Visit [platform.openai.com](https://platform.openai.com)
2. Create an account
3. Generate an API key
4. Add to `OPENAI_API_KEY`

### 4. Supabase (Database)
1. Visit [supabase.com](https://supabase.com)
2. Create a new project
3. Get your project URL and anon key
4. Add to `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Run the SQL schema files in the SQL editor

---

## 🏃 Running the Application

### Development Mode
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm run start
```

### Linting
```bash
npm run lint
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is private and proprietary.

---

## 📞 Support

For questions or support, please open an issue in the GitHub repository.

---

<div align="center">

**Built with ❤️ using Next.js, Simli, FishAudio, and OpenAI**

© 2026 Talk to Site. Powered by AI.

</div>
