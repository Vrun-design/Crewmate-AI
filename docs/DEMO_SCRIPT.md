# Crewmate Demo Script

## Goal

This demo should make one point unmistakable:

**Crewmate is not another chat UI. It is a real-time AI remote employee that can listen, see, remember, delegate, and act across your actual workflow.**

If the judges remember one sentence, make it this:

> "Most AI demos show answers. Crewmate shows work."

---

## Winning Story

Do not frame this as "we built many features."

Frame it as:

**Knowledge workers are drowning in context switching.**
They talk in Slack, think in docs, track work in ClickUp, research on the web, and lose time moving context between tools.

**Crewmate fixes that by behaving like a capable teammate.**
You speak naturally. It sees what you are doing. It routes work to the right agent. It uses real tools. It remembers context. It keeps moving while you keep working.

That gives you a clean 3-part narrative:

1. **Understand me**
   Crewmate hears voice and sees the screen.
2. **Work for me**
   Crewmate delegates to agents and tools, not just text generation.
3. **Grow with me**
   Crewmate remembers context and becomes more useful over time.

---

## Demo Positioning

Use this exact category framing:

- `Live`: real-time voice conversation through Gemini Live.
- `Multimodal`: screen-aware, not voice-only.
- `Agentic`: routes work to specialist agents and pipelines.
- `Useful`: acts in real systems like Notion, Slack, ClickUp, and Google Workspace.
- `Persistent`: memory survives beyond one session.

This matters because judges see many "assistant" demos. You need to show that Crewmate is:

**live + multimodal + agentic + integrated + memory-aware**

not just one of those.

---

## Ideal Demo Length

Target `4.5 to 6 minutes`.

Suggested split:

- `0:00-0:30` Hook
- `0:30-1:15` Problem and product framing
- `1:15-3:50` Live demo
- `3:50-4:40` Memory and architecture payoff
- `4:40-5:30` Closing punch

Do not go long unless asked.

---

## Demo Setup Checklist

Before presenting:

- Seed demo data if needed with `npm run seed`.
- Ensure microphone permissions are granted.
- Ensure screen-sharing works.
- Make sure at least one or two integrations look connected in the UI.
- Have the Dashboard, Tasks, Memory, and Integrations pages ready.
- Prepare one strong prompt you can say naturally without reading.
- Keep a backup browser tab with the Tasks page and Memory page ready.
- Disable noisy notifications.
- Use a stable internet connection.

If something is risky live, fake nothing. Instead say:

> "This is connected in the real product, but for the demo I’ll show the execution trace and resulting artifact."

That is much better than a broken live flow.

---

## Recommended Demo Scenario

Use one scenario end-to-end:

**A founder or product lead preparing for a high-stakes Monday morning.**

Why this works:

- It makes memory relevant.
- It makes voice input natural.
- It makes delegation valuable.
- It lets you show multiple integrations without feeling stitched together.
- It feels commercially real.

Example story:

You are about to start the day. You need a fast brief, competitive context, and execution across tools without manually opening ten tabs.

Crewmate should:

- listen to your request,
- observe your screen,
- delegate research,
- create or update a work artifact,
- stream progress,
- retain useful memory.

---

## Best Live Flow

### 1. Hook

Start with confidence and speed. Do not begin with architecture.

Say:

> "Everyone here has seen AI answer questions. We wanted to build something more ambitious: an AI teammate that can actually work beside you in real time."

Then:

> "Crewmate listens to you, sees your screen, routes tasks to specialist agents, uses real tools, and remembers what matters."

Immediately go into the product.

---

### 2. Show the live surface first

Open the Dashboard.

Say:

> "This is Crewmate. It’s built around a live multimodal session. I can just talk to it like I would talk to a teammate."

Point out briefly:

- live session controls,
- active work / recent activity,
- delegated task visibility.

Do not explain every card.

---

### 3. Start with one natural voice command

Use a prompt that shows multiple capabilities at once.

Recommended command:

> "Crewmate, give me a quick morning brief, look at what I’m working on, identify anything urgent, and create a short action plan I can share with my team."

Why this works:

- Voice
- Screen context
- Memory
- Delegation
- Artifact creation

If you want a stronger product angle, use:

> "Crewmate, review our current product planning context, research competitor pricing for this quarter, then draft a short strategy summary and save it to Notion."

That better shows pipeline execution.

---

### 4. Narrate what is happening

While Crewmate responds, explain the invisible value:

> "What matters here is that the live model is not blocked by long-running work. Crewmate can acknowledge me immediately, then spin up background execution through specialist agents and skills."

Then show the Tasks page or task cue.

Say:

> "Instead of freezing in a chat box, it becomes an active worker. I can watch what it’s doing step by step."

This is a key winning moment.

---

### 5. Show delegated execution

Open the Tasks page.

Point out:

- task created,
- streamed steps,
- completed actions,
- visible route from request to outcome.

Say:

> "This is the difference between an assistant and an operator. We expose the work, not just the answer."

If available, mention the route:

- research agent,
- product agent,
- browser or productivity skill,
- final artifact.

---

### 6. Show a real artifact

Open the resulting output if available, or show the memory / activity evidence.

Good artifacts:

- Notion page created
- ClickUp task created
- Slack draft / message preview
- screenshot attached to a task
- strategy summary stored as output

Say:

> "The output lands in the tools teams already use. That is what makes this deployable, not just impressive."

---

### 7. Show memory as the moat

Open Memory.

Say:

> "Crewmate doesn’t treat each interaction like a blank slate. It stores useful context from live sessions, agent runs, and artifacts, then injects that context into future work."

Then make the business point:

> "That means the product gets better the more you work with it. It becomes familiar with your priorities, workflows, and history."

This is where the demo becomes more than a one-shot agent trick.

---

### 8. Close with the product thesis

End on vision, not implementation detail.

Say:

> "We think the future is not AI you stop to use. It’s AI that joins your workflow, sees context, takes action, and keeps going. That’s Crewmate."

Then stop.

Do not dilute the ending with more features.

---

## Exact 5-Minute Script

Use this as your default speaking track.

### 0:00-0:30

> "Most AI demos show answers. We wanted to show work. This is Crewmate, a multimodal AI remote employee. It listens to your voice, sees your screen, delegates tasks to specialist agents, uses real tools like Notion, Slack, ClickUp, and Google Workspace, and remembers context across sessions."

### 0:30-1:00

> "The problem we’re solving is context switching. Knowledge work is fragmented across meetings, docs, tasks, inboxes, and research. The human ends up being the glue. Crewmate becomes that glue."

### 1:00-1:30

> "I’m on the dashboard here. This is the live operating surface. I’ll just talk to it naturally."

### 1:30-2:20

Speak:

> "Crewmate, give me a quick brief on what matters today, research competitor pricing relevant to our product planning, and create a concise summary I can share with the team."

Then narrate:

> "Now Crewmate is handling this as a live multimodal turn. It can hear my request, use my current context, and decide whether to answer inline or delegate work."

### 2:20-3:10

Open Tasks.

> "Here you can see the execution trace. This is important: the system doesn’t just generate text. It routes to the right agent, runs the work in the background, and streams progress in real time."

### 3:10-3:50

Show result artifact.

> "And now the output is not trapped in the model. It lands in an actual workflow artifact."

### 3:50-4:30

Open Memory.

> "Every live session, task, and artifact can become usable memory. That context is injected into future prompts and agent runs, so Crewmate improves as it works with you."

### 4:30-5:00

> "So the core idea is simple: don’t make the user manage the AI. Let the AI join the team. That’s what we built with Crewmate."

---

## What You Must Cover

If time is short, cover these five points no matter what:

1. `Voice`: It is live and conversational.
2. `Vision`: It sees screen context.
3. `Delegation`: It routes to agents / tools, not only direct answers.
4. `Execution`: It creates visible work in real systems.
5. `Memory`: It becomes more useful over time.

If one of these is missing, the demo becomes easier to confuse with a normal assistant.

---

## What To Avoid

- Do not start with architecture diagrams.
- Do not list all 62 skills.
- Do not say "we also have..." repeatedly.
- Do not click around aimlessly.
- Do not spend time on auth, setup, or config.
- Do not make the judges read small text.
- Do not run a fragile multi-app flow unless you have already tested it.
- Do not oversell autonomy if approvals are still required for important actions.

---

## Judge Psychology

Judges usually reward demos that are easy to retell afterward.

Make your demo retellable with this structure:

- `Input`: natural voice + screen
- `Reasoning`: routes to the right specialist
- `Action`: uses real tools
- `Proof`: visible task trace and artifact
- `Compounding value`: memory

If a judge can repeat that back in one breath, your demo is sticky.

---

## Winning Angles To Emphasize

Pick 2 or 3 and repeat them.

### Option A: "Shows work"

Best if the Tasks page looks strong.

Message:

> "We don’t hide agent execution. We expose the work so users trust the system."

### Option B: "Context-native AI"

Best if screen share and memory are stable.

Message:

> "Crewmate works from real context, not isolated prompts."

### Option C: "From conversation to operation"

Best if integrations are strong.

Message:

> "A spoken request turns into tracked, tool-connected execution."

### Option D: "AI that compounds"

Best if the Memory page is solid.

Message:

> "Every session makes the next one better."

---

## Fallback Demo Plan

If live voice is unstable:

- Start with the dashboard.
- Explain that Crewmate normally runs through Gemini Live voice.
- Move immediately to a prepared delegated task result on the Tasks page.
- Show the artifact and Memory page.
- Tell the story as if the command had just been spoken.

If an integration is unstable:

- Show the execution trace.
- Show the resulting memory or activity record.
- Explain the intended destination tool in one sentence.

If screen share fails:

- Keep the demo focused on delegation, artifact creation, and memory.
- Still mention that Crewmate is designed to use live screen context each turn.

The fallback should still preserve the product thesis:

**understand -> delegate -> act -> remember**

---

## Strong One-Liners

Use these sparingly.

- "Most copilots wait for commands. Crewmate joins the shift."
- "This is not prompt engineering. This is workflow execution."
- "The answer is useful. The artifact is valuable."
- "A chat response disappears. Memory compounds."
- "We wanted AI that behaves less like a tab and more like a teammate."

---

## Suggested Final Closing

Use this if you want a crisp ending:

> "Crewmate turns natural conversation into real work across the tools teams already use. It sees context, delegates execution, keeps the human in control, and gets better with memory. That’s the future we’re building."

---

## If You Get Q&A

### "What makes this different from a chatbot with tools?"

Answer:

> "Three things together: live voice, live screen context, and visible delegated execution with memory. Most systems have one or two of those. We built the full loop."

### "Why does memory matter here?"

Answer:

> "Because useful work depends on continuity. Teams repeat context constantly. Memory lets Crewmate retain preferences, past work, and artifacts so the next task starts informed."

### "Is this autonomous?"

Answer:

> "It is agentic, but not reckless. It can act and delegate, while still respecting approval boundaries for sensitive actions."

### "Why will users trust it?"

Answer:

> "Because the system shows the work: task traces, artifacts, activity logs, and clear routing instead of magic black-box output."

---

## Final Advice

Your job in the demo is not to explain everything you built.

Your job is to make the judges feel that:

1. this is real,
2. this is differentiated,
3. this is useful now,
4. this could become a real product after the hackathon.

If you stay disciplined on that, this demo will land much harder than a feature tour.
