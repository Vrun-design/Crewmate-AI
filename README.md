# Crewmate

Crewmate is a multimodal AI operator for screen-aware, voice-driven work. It watches the screen you share, listens to your spoken requests, and can take actions in connected tools like GitHub, Slack, Notion, and ClickUp.

## 🌟 Key Features

### 🧰 Real Operator Stack
- **Multimodal live sessions**: Gemini Live powers the screen + voice loop.
- **Tool execution**: GitHub, Slack, Notion, and ClickUp actions can be triggered from the live agent.
- **Persistent local workspace**: Sessions, tasks, activity, notifications, memory, integrations, and preferences are stored locally in SQLite.
- **Async delegation**: off-shift research briefs run through an orchestrator -> researcher -> editor pipeline and can deliver to Notion and Slack.
- **Creative Studio**: one prompt can generate narrative copy plus an accompanying image artifact.

### 🎙️ Live Multimodal Sessions ("On Shift")
- **Screen Sharing & Audio**: Initiate a live session with Crewmate using the **Gemini Multimodal Live API**.
- **See, Hear, and Act**: Share your screen while you work. If you spot a bug, just say, *"Hey Crewmate, raise a ticket for this bug in ClickUp,"* and it will understand the visual context and execute the task.
- **Real-time Feedback**: Talk through problems, brainstorm ideas, and get immediate, context-aware feedback based on what is currently on your screen.

### 🧠 Always-On Memory Agent ("Off Shift")
- **Continuous Learning**: Even when you aren't in a live session, Crewmate processes your documents, integrations, and past interactions to build a deep, persistent understanding of your projects.
- **Proactive Assistance**: It can work in the background to summarize meetings, monitor competitor updates, or run data analysis, notifying you when tasks are complete.

### 🔗 Integrations
- **Frontend-managed connections**: Users can save integration credentials from the app itself.
- **Env fallback**: You can still preload credentials through `.env` for local ops or deployment.
- **Action execution**: Connected tools are available to the live runtime for explicit user requests.

### 🔐 Seamless Authentication & Onboarding
- **Passwordless Login**: Secure email verification flow with OTP.
- **Agent Customization**: Personalize your AI co-worker by giving them a name and choosing a voice personality.

### 📊 Centralized Dashboard
- **Personalized Greeting**: Welcomes you by name.
- **Task Queue & Recent Activity**: Track everything your agent is doing, has completed, or is planning to do.

---

## 🏗️ Architecture & Directory Structure

The application is built using a modern frontend stack, emphasizing performance, smooth animations, and a premium user interface.

```text
src/
├── App.tsx                 # Main application component and routing setup
├── main.tsx                # Application entry point
├── index.css               # Global styles and Tailwind CSS configuration
├── components/             # Reusable UI components
│   ├── layout/             # Layout components
│   │   ├── AppLayout.tsx   # Main application wrapper with sidebar
│   │   ├── Sidebar.tsx     # Navigation sidebar
│   │   └── Topbar.tsx      # Top navigation bar
│   ├── shared/             # Shared composite components
│   │   └── StatCard.tsx    # Dashboard statistics cards
│   └── ui/                 # Base UI components
│       ├── Button.tsx      # Reusable button component
│       ├── Card.tsx        # Card containers
│       ├── Badge.tsx       # Status badges
│       ├── Drawer.tsx      # Slide-out drawer for transcripts/details
│       ├── PageHeader.tsx  # Consistent page headers
│       └── LiveSessionOverlay.tsx # The Gemini Multimodal Live session UI
├── pages/                  # Application pages (Routes)
│   ├── auth/               # Authentication & Onboarding flow
│   │   ├── Login.tsx       # Email entry
│   │   ├── Verify.tsx      # 6-digit OTP verification
│   │   └── Onboarding.tsx  # Agent creation, voice selection, and setup method
│   ├── Dashboard.tsx       # Main overview dashboard
│   ├── Tasks.tsx           # Task management and queue
│   ├── Integrations.tsx    # Third-party tool connections
│   ├── MemoryBase.tsx      # Document and context management
│   ├── Sessions.tsx        # Past and active session history
│   ├── ActivityLog.tsx     # Detailed activity and audit log
│   ├── Notifications.tsx   # User notifications
│   └── Account.tsx         # User settings and profile management
├── types/                  # TypeScript interface definitions
└── utils/                  # Utility functions and helpers
```

---

## 🛠️ Tech Stack

- **Framework**: [React 18](https://react.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Animations**: [Framer Motion](https://motion.dev/) (`motion/react`)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Routing**: [React Router DOM](https://reactrouter.com/)

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the frontend:**
   ```bash
   npm run dev
   ```

3. **Start the local API in a second terminal:**
   ```bash
   npm run dev:server
   ```

4. **Build for production:**
   ```bash
   npm run build
   ```

### Environment Variables
If you are connecting to real backend services or the Gemini API, create a `.env` file in the root directory:

```env
VITE_API_URL=your_api_url_here
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

For the new local full-stack dev path, start from:

```env
VITE_API_URL=
PORT=8787
CORS_ORIGIN=http://localhost:3000
CREWMATE_DB_PATH=data/crewmate.db
CREWMATE_ENCRYPTION_KEY=replace_with_a_long_random_secret
GOOGLE_API_KEY=your_google_ai_studio_key
GEMINI_LIVE_MODEL=gemini-2.5-flash-native-audio-preview-12-2025
GEMINI_TEXT_MODEL=gemini-2.5-flash
GEMINI_RESEARCH_MODEL=gemini-2.5-flash
GEMINI_CREATIVE_MODEL=gemini-3-pro-image-preview
GITHUB_TOKEN=your_github_token
GITHUB_REPO_OWNER=your_org_or_username
GITHUB_REPO_NAME=your_repo_name
SLACK_BOT_TOKEN=your_slack_bot_token
SLACK_DEFAULT_CHANNEL_ID=your_default_channel_id
NOTION_TOKEN=your_notion_internal_integration_token
NOTION_PARENT_PAGE_ID=your_shared_parent_page_id
CLICKUP_TOKEN=your_clickup_api_token
CLICKUP_LIST_ID=your_clickup_list_id
```

If `VITE_API_URL` is left empty, the frontend uses the local Vite proxy for `/api`.
`npm run dev:server` now runs in watch mode. If you pull new backend changes while it is already running, stop it once and start it again so new routes are definitely registered.

If you used an older build of this repo and still see stale local records in the dashboard or memory pages, reset the SQLite database once before starting the backend:

```bash
npm run db:reset
```

### Local Full-Stack Flow

The app now supports a local backend-backed dashboard flow:

- `GET /api/dashboard` returns tasks, activities, integrations, memory nodes, and the current live session
- `GET /api/integrations` returns real readiness state and setup metadata for supported tools
- `GET /api/integrations/:integrationId/config` returns the saved connection form state for a specific integration
- `PUT /api/integrations/:integrationId/config` saves an integration connection from the frontend
- `DELETE /api/integrations/:integrationId/config` removes a saved frontend-managed integration connection
- `GET /api/preferences` returns persisted user preferences
- `PUT /api/preferences` saves runtime/account preferences
- `GET /api/jobs` lists async delegated jobs
- `POST /api/jobs/research-brief` queues an A2A-style background brief
- `POST /api/creative/generate` generates a narrative + image artifact
- `POST /api/sessions/live` starts a real Gemini Live-backed session when `GOOGLE_API_KEY` is configured
- `POST /api/sessions/:sessionId/messages` sends a real user turn into the Gemini Live session
- `POST /api/sessions/:sessionId/frame` streams shared-screen frames into the live Gemini session
- `POST /api/sessions/:sessionId/audio` streams microphone chunks into the live Gemini session
- `POST /api/sessions/:sessionId/audio/end` cleanly closes the live microphone stream
- `POST /api/sessions/:sessionId/end` ends the active session and preserves its transcript
- `GET /api/memory/nodes` lists memory nodes
- `POST /api/memory/ingest` adds a new memory node

Real tool paths now exist for the hackathon-critical integrations:

- GitHub: create issues from live bug reports
- Slack: post live updates into a real channel
- Notion: create pages for PRDs, research summaries, and handoff notes
- ClickUp: create tasks from spoken or visual follow-up requests

Additional judge-facing flows now exist:

- Delegations: queue off-shift research briefs that complete in the background
- Creative Studio: generate mixed text + image artifacts from one prompt

The integrations page now reflects actual backend readiness instead of mock state. If an integration is not configured, the drawer shows the live connection form, the missing required values, the intended capability surface, and a link to the official docs.

## Integration Setup

### GitHub
- Required values: `token`, `repoOwner`, `repoName`
- Best for: visual bug triage -> real issue creation
- Local note: use a repository where the token can create issues; you can save these values from the Integrations page or preload them via `.env`

### Slack
- Required values: `botToken`, `defaultChannelId`
- Best for: announcing completed research, posting team updates, confirming delegated work
- Local note: install the app to the workspace and make sure the bot can post to the target channel

### Notion
- Required values: `token`, `parentPageId`
- Best for: PRDs, live summaries, async handoff artifacts
- Local note: share the destination parent page with the integration inside Notion before testing

### ClickUp
- Required values: `token`, `listId`
- Best for: action items and bug/task creation outside GitHub
- Local note: point Crewmate at one known list to keep task routing deterministic

## Live Agent Behavior

The local runtime is now materially more agentic:

- voice + screen context feed the same Gemini Live session
- live input transcription is captured into the transcript stream
- completed live turns are checkpointed into the local memory store
- explicit action requests can route into GitHub, Slack, Notion, and ClickUp when configured
- async delegated briefs can continue off-shift through a multi-agent-style pipeline
- creative generation can return both narrative and an image artifact

## Judge Path

Use these repo assets for submission:

- Architecture diagram: [docs/ARCHITECTURE.md](/Users/varun/Desktop/Dev_projects/crewmate-dashboard/docs/ARCHITECTURE.md)
- Judge checklist: [docs/JUDGE_ASSETS.md](/Users/varun/Desktop/Dev_projects/crewmate-dashboard/docs/JUDGE_ASSETS.md)
- Cloud Run packaging: [Dockerfile](/Users/varun/Desktop/Dev_projects/crewmate-dashboard/Dockerfile), [cloudbuild.yaml](/Users/varun/Desktop/Dev_projects/crewmate-dashboard/cloudbuild.yaml), [scripts/deploy-cloud-run.sh](/Users/varun/Desktop/Dev_projects/crewmate-dashboard/scripts/deploy-cloud-run.sh)

This means the judges can see real multimodal context, real tool execution, and real persistence before any Google Cloud deployment work.

---

## 🎨 Design Philosophy

Crewmate uses a premium, minimalist design language:
- **Glassmorphism**: Subtle use of backdrop blurs and semi-transparent backgrounds (`bg-card/50 backdrop-blur-xl`).
- **Micro-interactions**: Smooth transitions and hover states using Framer Motion.
- **Typography**: Clean, sans-serif typography with careful attention to tracking and leading.
- **Dark Mode Ready**: The UI is built with CSS variables that easily adapt to dark mode preferences.
