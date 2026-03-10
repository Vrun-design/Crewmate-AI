# Judge Assets Checklist

## Required

- Public repo URL
- README with spin-up instructions
- Cloud Run deployment proof
- Architecture diagram
- Sub-4-minute demo video
- Text description of product and findings

## Demo Path

1. Start a live session.
2. Share a broken UI screen.
3. Ask Crewmate to diagnose it and file a GitHub issue.
4. Ask Crewmate to notify Slack.

## Proof Points

- **Primary Category: UI Navigator ☸️**
  - **Interaction:** Visual understanding of a shared browser/screen leading to intent-based tool actions. Crewmate "sees" the UI bugs and navigates the API requests to fix them without the user typing.
- **Secondary Category: Live Agents 🗣️**
  - **Interaction:** Realtime voice + vision session using Gemini Live. The live agent handles interruptions gracefully while reviewing the screen.
- **Google Cloud Usage:** 
  - Deployed backend to Cloud Run. (Include raw recording of GCP console as proof).
  - Uses `@google/genai` inside Node backend.
  - Replicates the GCP **Always-On Memory Agent** Architecture (Backend workers natively implement the Ingest, Consolidate, and Query loop).
  - Specifically designed the data abstraction layer to be **Vertex AI Ready** so an enterprise could swap the local SQLite prototype for Vertex Vector Search and Vertex AI Endpoints.
