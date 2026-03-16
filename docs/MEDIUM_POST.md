# AI Is Incredibly Capable. So Why Am I Still Copy-Pasting Everything?

*What I built when I got tired of being the middleman.*

---

We've all done it.

You open ChatGPT. You paste in your meeting notes. You paste in the draft you've been working on. You explain the context — again — because it doesn't remember last time. You get a response. You copy it out, go do the thing, come back, paste in what happened, ask the next question.

It works. Kind of. But at some point you realize: I'm spending more time feeding this thing context than I'm saving by using it.

AI in 2026 is genuinely incredible. The models are smart, fast, and capable of doing real work. But the interaction model is stuck. We're all still living inside the chat box — switching tabs, manually bridging the gap between the AI and the actual tools we use, acting as the middleman for every single step.

I kept thinking: there has to be a better way to work with this.

---

## What If It Could Just Be There?

I wanted to build something that didn't need to be summoned. Something that could sit alongside you during a real work session — listening, watching your screen if you share it, and when you ask it to do something, actually doing it. Not describing it. Not drafting a response for you to go execute. Actually doing it.

That's Crewmate. A live AI coworker.

> 📸 *[Screenshot: Crewmate dashboard — crew network map, task panel, session active]*

You start a voice session. You talk to it like a coworker. It hears you in real time using Gemini Live — Google's multimodal streaming API — so there's no typing, no pasting, no switching context. And when you ask it to handle something, it hands off to a background agent that goes and does the work while you keep talking.

---

## Here's What a Real Session Looks Like

I'm a product manager. I start my morning session.

*"Hey, do a competitive analysis on our top three competitors and save the findings to Notion."*

It kicks off in the background. I keep working.

I spot a bug on my screen. *"Take a screenshot of this and raise it as a task."* Done — screenshot captured, task created, context logged.

*"Share that in the #tech Slack channel."* Done.

*"Write me a PRD for an animation export feature — do the research first, then draft it."*

By the end of the session: competitive analysis saved to Notion, bug raised, team notified on Slack, PRD written, job description drafted in Google Docs. All from voice. No tab switching. No copy-pasting.

> 📸 *[Screenshot: Task panel showing completed tasks — Notion, Slack, Google Docs]*

---

## The Parts That Were Actually Hard

### The async problem

You can't pause a live audio conversation to wait for a 30-second web scrape. The session needs to keep going — you're still talking.

So the live layer and the task layer are completely separate. Gemini Live handles the conversation. When it detects something that needs doing — via a tool call — the runtime checks an execution policy on that skill: is this fast and side-effect-free? Run it inline. Is it slow or does it touch external APIs? Hand it off. Gemini says "on it" and keeps the conversation going. The task runs in the background, streaming progress back via SSE.

Every skill in the system declares upfront: `executionMode: inline | delegated | either`, `latencyClass: quick | slow`, `sideEffectLevel: none | low | high`. The runtime uses those to decide automatically. I don't have to think about it per-call.

### The pipeline problem

*"Research our top competitors, write a battle card, then draft an outreach email"* — that's not three separate requests. It's a chain where each step depends on the previous one.

I built a pipeline executor for this. One voice command triggers a sequence of agents. Each agent runs, and its output gets passed as context to the next. The battle card agent literally receives the research as input. The email agent receives the battle card. Context flows forward automatically — you don't have to orchestrate it by hand.

### The memory problem

The first version had no memory. Every session started cold. You'd have to re-explain what you were working on, what company you worked at, what decisions you'd made. It felt like hiring someone new every morning.

The fix: embed every session turn, agent result, and skill output using Gemini Embedding 2, store the vectors in SQLite, and at the start of every session — and before every agent run — cosine-search the store and inject the top results into the system prompt. The agent already knows you're building a B2B SaaS, that your target ICP is mid-market ops teams, and that last Tuesday you decided to deprioritize the mobile app.

That's when it stopped feeling like a demo.

> 📸 *[Screenshot: Memory Core panel — session summaries, knowledge base entries]*

### The browser problem

A lot of workflows hit a wall: the thing you need to do is on a website with no API. You could describe it to the AI and then go do it yourself. Or you could just let the AI do it.

The browser agent isn't scripted automation. It's a perception loop: screenshot + DOM + ARIA accessibility tree → Gemini multimodal picks the next action → Stagehand executes it in a real Chromium instance → repeat, up to 30 steps. It handles cookie banners, SPA navigation, login flows. It retries on bad selectors. If it gets stuck, it says so rather than silently failing.

It's not magic — it's slow, and it breaks on weird UIs. But for the class of tasks where there's no other option, it works.

---

## Watch It in Action

> 🎬 *[Embed demo video here]*

---

## What I Think Is Actually Happening

AI isn't the bottleneck anymore. The bottleneck is the interface — the chat box, the copy-paste loop, the context re-explaining. The models have been ready for a while. The question is what it looks like when the interface catches up.

I don't think the answer is a smarter chatbot. I think it's something more like a coworker — present, context-aware, able to act. Not a tool you open. Something that's already there.

---

*Built for the Google x Dev.to #GeminiLiveAgentChallenge.*

---

**A personal note.**

My first project was a search app. I built it with Tavily Search API for someone I love — they needed a better way to find things, and nothing that existed worked for them. So I built something that did.

Small, specific, built for one person.

The scale has changed since then but the reason hasn't. Someone has a problem. You go try to fix it.
