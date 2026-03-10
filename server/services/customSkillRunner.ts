/**
 * Custom Skill Runner — Phase 13
 *
 * Executes user-defined custom skills in two modes:
 *
 * Mode A — Webhook: POST to user's URL with args, treat response as result.
 *   Security: timeout 10s, no credentials leaked, response size capped.
 *
 * Mode B — LLM Recipe: run a mini-Gemini call with the user's instruction
 *   as system prompt, giving the LLM access to a safe subset of tools.
 */
import type { SkillRunContext } from '../skills/types';
import { createGeminiClient } from './geminiClient';
import { serverConfig } from '../config';

const WEBHOOK_TIMEOUT_MS = 10_000;
const WEBHOOK_MAX_RESPONSE_BYTES = 256 * 1024; // 256KB

// ── Webhook execution ─────────────────────────────────────────────────────────

export async function executeWebhookSkill(
    webhookUrl: string,
    args: Record<string, unknown>,
    authHeader?: string,
): Promise<{ success: boolean; output: unknown; message: string; durationMs: number }> {
    const t0 = Date.now();

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authHeader) headers['Authorization'] = authHeader;

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({ args }),
            signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
        });

        const contentLength = Number(response.headers.get('content-length') ?? 0);
        if (contentLength > WEBHOOK_MAX_RESPONSE_BYTES) {
            return {
                success: false,
                output: null,
                message: `Webhook response too large (${contentLength} bytes, max ${WEBHOOK_MAX_RESPONSE_BYTES})`,
                durationMs: Date.now() - t0,
            };
        }

        const text = await response.text();
        let output: unknown = text;
        try { output = JSON.parse(text); } catch { /* keep as text */ }

        return {
            success: response.ok,
            output,
            message: response.ok
                ? `Webhook responded ${response.status} in ${Date.now() - t0}ms`
                : `Webhook error ${response.status}: ${text.slice(0, 200)}`,
            durationMs: Date.now() - t0,
        };
    } catch (err) {
        const isTimeout = err instanceof Error && err.name === 'TimeoutError';
        return {
            success: false,
            output: null,
            message: isTimeout ? `Webhook timed out after ${WEBHOOK_TIMEOUT_MS}ms` : String(err),
            durationMs: Date.now() - t0,
        };
    }
}

// ── LLM Recipe execution ──────────────────────────────────────────────────────

/**
 * Execute a natural-language skill recipe.
 * The recipe is the system prompt for a mini Gemini call.
 * Args are passed as structured user input.
 */
export async function executeLLMRecipeSkill(
    recipe: string,
    args: Record<string, unknown>,
    _ctx: SkillRunContext,
): Promise<{ success: boolean; output: string; message: string; durationMs: number }> {
    const t0 = Date.now();

    try {
        const ai = createGeminiClient();
        const argsText = Object.entries(args)
            .map(([k, v]) => `${k}: ${String(v)}`)
            .join('\n');

        const response = await ai.models.generateContent({
            model: serverConfig.geminiLiteModel ?? serverConfig.geminiTextModel,
            contents: `${recipe}\n\n---\nInputs:\n${argsText || '(no inputs provided)'}`,
        });

        const output = response.text ?? '';
        return {
            success: true,
            output,
            message: `✅ Recipe executed in ${Date.now() - t0}ms`,
            durationMs: Date.now() - t0,
        };
    } catch (err) {
        return {
            success: false,
            output: '',
            message: `Failed: ${String(err)}`,
            durationMs: Date.now() - t0,
        };
    }
}
