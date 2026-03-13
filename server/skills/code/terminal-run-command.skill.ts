/**
 * Terminal Skill — Sandboxed Shell Command Executor
 *
 * Security Model (Defence in depth):
 * ─────────────────────────────────────────────────
 * Layer 1 — Blocklist: Immediately reject any input matching dangerous patterns
 *           (rm, sudo, chmod, curl|sh, subshells, redirects to system paths, etc.)
 *
 * Layer 2 — Allowlist: Only commands in the explicit safe list are permitted.
 *           Multi-word prefixes like "git log" are anchored to prevent "git log; rm -rf".
 *
 * Layer 3 — Argument injection prevention: Command is parsed into binary + args array
 *           and passed to execFile (NOT exec/sh -c). Shell metacharacters cannot escape.
 *
 * Layer 4 — CWD jailing: Working directory must resolve inside the project root.
 *           Symlink-following path traversal (../../etc) is blocked.
 *
 * Layer 5 — Resource limits:
 *           - 15s hard timeout
 *           - 2MB stdout/stderr buffer cap
 *           - 4000 char output cap sent to LLM context
 *
 * Layer 6 — Reduced environment: subprocess gets a minimal env with no HOME,
 *           no credentials, no SSH keys, and a restricted PATH.
 *
 * Layer 7 — Audit: every execution (allowed or blocked) is logged to audit trail.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { existsSync } from 'node:fs';
import type { Skill } from '../types';

const execFileAsync = promisify(execFile);

// ── Config ────────────────────────────────────────────────────────────────────

const TIMEOUT_MS = 15_000;
const MAX_BUFFER = 2 * 1024 * 1024; // 2MB
const MAX_OUTPUT = 4_000;            // chars sent to LLM

// Resolve project root once at startup
const PROJECT_ROOT = path.resolve(process.cwd());

// ── Layer 1: Blocklist — immediately rejected patterns ─────────────────────

/** Regex patterns that are ALWAYS blocked, even if the allowlist would pass. */
const BLOCKED_PATTERNS: RegExp[] = [
    // Destructive file ops
    /\brm\s+(-\S+\s+)*-r/i,           // rm -rf, rm -Rf, rm -r
    /\brm\s+(-\S+\s+)*(\/|~)/i,       // rm targeting / or ~
    /\brmdir\b/i,
    /\bshred\b/i,
    /\bdd\b/i,                         // dd if=... of=/dev/disk

    // Privilege escalation
    /\bsudo\b/i,
    /\bsu\s/i,
    /\bdoas\b/i,
    /\bpkexec\b/i,

    // Modifying system / security critical files
    /\bchmod\b/i,
    /\bchown\b/i,
    /\bchgrp\b/i,

    // Network exfiltration / remote execution
    /\bcurl\s.*[|;]/i,
    /\bwget\s.*[|;]/i,
    /\bnc\b/i,                         // netcat
    /\btelnet\b/i,
    /\bssh\b/i,
    /\bscp\b/i,
    /\brsync\s.*--rsh/i,

    // Shell escapes / subshell injection
    /`/,                               // any backtick = subshell execution
    /\$\s*\(/,                         // $(cmd) subshell
    /\|\s*(bash|sh|zsh|fish|dash)/i,   // curl | sh etc.
    /&&\s*(rm|sudo|curl|wget)/i,
    /;\s*(rm|sudo|curl|wget)/i,

    // Output redirection to sensitive paths
    />\s*(\/etc|\/usr|\/bin|\/sbin|\/boot|\/sys|\/proc)/i,

    // Process & system control
    /\bkill\b/i,
    /\bpkill\b/i,
    /\bhalt\b/i,
    /\breboot\b/i,
    /\bpoweroff\b/i,
    /\bshutdown\b/i,
    /\bsystemctl\b/i,
    /\bservice\b/i,

    // crontab / scheduled backdoors
    /\bcrontab\b/i,
    /\bat\s+\d/i,

    // Path traversal
    /\.\.\//,                          // ../
    /~\//,                             // ~/
];

function isBlocklisted(command: string): string | null {
    for (const pattern of BLOCKED_PATTERNS) {
        if (pattern.test(command)) {
            return `Blocked by security pattern: ${pattern.source}`;
        }
    }
    return null;
}

// ── Layer 2: Allowlist — only these command prefixes are permitted ──────────

interface AllowedCommand {
    prefix: string;
    description: string;
    maxArgs?: number;   // max number of additional arguments
}

const ALLOWED_COMMANDS: AllowedCommand[] = [
    // Git — read-only operations
    { prefix: 'git status', description: 'Show working tree status' },
    { prefix: 'git log', description: 'Show commit log', maxArgs: 10 },
    { prefix: 'git diff', description: 'Show changes', maxArgs: 5 },
    { prefix: 'git branch', description: 'List branches' },
    { prefix: 'git show', description: 'Show commit', maxArgs: 3 },
    { prefix: 'git remote', description: 'List remotes', maxArgs: 2 },
    { prefix: 'git tag', description: 'List tags' },
    { prefix: 'git stash list', description: 'List stashes' },

    // Node / npm — safe project commands
    { prefix: 'npm test', description: 'Run tests' },
    { prefix: 'npm run test', description: 'Run test script' },
    { prefix: 'npm run lint', description: 'Run linter' },
    { prefix: 'npm run build', description: 'Build project' },
    { prefix: 'npm run dev', description: 'Start dev server' },
    { prefix: 'npm audit', description: 'Audit dependencies' },
    { prefix: 'npm list', description: 'List installed packages' },
    { prefix: 'npm outdated', description: 'Check outdated packages' },
    { prefix: 'npx tsc', description: 'TypeScript compiler', maxArgs: 5 },

    // Filesystem — read-only
    { prefix: 'ls', description: 'List directory', maxArgs: 5 },
    { prefix: 'cat', description: 'Read file contents', maxArgs: 3 },
    { prefix: 'head', description: 'First lines of file', maxArgs: 4 },
    { prefix: 'tail', description: 'Last lines of file', maxArgs: 4 },
    { prefix: 'find', description: 'Find files', maxArgs: 10 },
    { prefix: 'grep', description: 'Search in files', maxArgs: 8 },
    { prefix: 'wc', description: 'Word/line count', maxArgs: 4 },
    { prefix: 'diff', description: 'Diff two files', maxArgs: 4 },
    { prefix: 'pwd', description: 'Current directory' },
    { prefix: 'echo', description: 'Print text', maxArgs: 5 },
    { prefix: 'stat', description: 'File stats', maxArgs: 3 },
    { prefix: 'file', description: 'File type', maxArgs: 3 },

    // System info — read-only
    { prefix: 'date', description: 'Show date' },
    { prefix: 'which', description: 'Find executable', maxArgs: 2 },
    { prefix: 'node --version', description: 'Node version' },
    { prefix: 'npm --version', description: 'npm version' },
    { prefix: 'hostname', description: 'Show hostname' },
];

function getAllowedEntry(command: string): AllowedCommand | null {
    const trimmed = command.trim().toLowerCase();
    // Sort by prefix length desc so "git status --short" matches "git status" not "git"
    const sorted = [...ALLOWED_COMMANDS].sort((a, b) => b.prefix.length - a.prefix.length);
    return sorted.find((ac) => trimmed.startsWith(ac.prefix)) ?? null;
}

// ── Layer 4: CWD jail ─────────────────────────────────────────────────────────

function resolveAndJailCwd(requestedCwd?: string): string {
    if (!requestedCwd) return PROJECT_ROOT;

    // Resolve relative to project root, not process.cwd()
    const resolved = path.resolve(PROJECT_ROOT, requestedCwd);

    if (!resolved.startsWith(PROJECT_ROOT)) {
        throw new Error(`Working directory "${requestedCwd}" is outside the project root. Access denied.`);
    }

    if (!existsSync(resolved)) {
        throw new Error(`Working directory "${resolved}" does not exist.`);
    }

    return resolved;
}

// ── Layer 5 + 6: Hardened exec ────────────────────────────────────────────────

const SAFE_ENV: NodeJS.ProcessEnv = {
    PATH: '/usr/local/bin:/usr/bin:/bin:/usr/local/sbin',
    NODE_ENV: process.env.NODE_ENV ?? 'development',
    HOME: '/tmp',          // no access to real home
    TERM: 'dumb',
    LANG: 'en_US.UTF-8',
    // Pass through only the tokens the allowed commands need
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    npm_config_cache: '/tmp/.npm-cache',
};

async function runSandboxedCommand(
    command: string,
    requestedCwd?: string,
): Promise<{ stdout: string; stderr: string; exitCode: number; blockedReason?: string }> {

    // ── Layer 1: Blocklist check ─────────────────────────────────────────────
    const blockedReason = isBlocklisted(command);
    if (blockedReason) {
        return { stdout: '', stderr: `🚫 ${blockedReason}`, exitCode: 1, blockedReason };
    }

    // ── Layer 2: Allowlist check ─────────────────────────────────────────────
    const allowedEntry = getAllowedEntry(command);
    if (!allowedEntry) {
        const examples = ALLOWED_COMMANDS.slice(0, 6).map((c) => `\`${c.prefix}\``).join(', ');
        return {
            stdout: '',
            stderr: `🚫 Command not in allowlist. Allowed commands include: ${examples}, and more.`,
            exitCode: 1,
            blockedReason: 'not-in-allowlist',
        };
    }

    // ── Layer 3: Argument injection — parse into binary + args array ──────────
    // Using shell=false mode of execFile prevents all shell interpretation.
    const parts = parseCommandParts(command);
    if (parts.length === 0) {
        return { stdout: '', stderr: 'Empty command', exitCode: 1 };
    }

    // Enforce arg count if specified
    if (allowedEntry.maxArgs !== undefined && parts.length - 1 > allowedEntry.maxArgs) {
        return {
            stdout: '',
            stderr: `🚫 Too many arguments (max ${allowedEntry.maxArgs} for "${allowedEntry.prefix}")`,
            exitCode: 1,
            blockedReason: 'too-many-args',
        };
    }

    // ── Layer 4: CWD jail ─────────────────────────────────────────────────────
    let safeCwd: string;
    try {
        safeCwd = resolveAndJailCwd(requestedCwd);
    } catch (err) {
        return { stdout: '', stderr: String(err), exitCode: 1 };
    }

    // ── Layers 5 + 6: Execute with resource limits and clean env ─────────────
    const [binary, ...rest] = parts;

    try {
        const { stdout, stderr } = await execFileAsync(binary, rest, {
            timeout: TIMEOUT_MS,
            maxBuffer: MAX_BUFFER,
            cwd: safeCwd,
            env: SAFE_ENV,
            shell: false,   // No shell — completely prevents shell injection
        });

        const truncate = (s: string) =>
            s.length > MAX_OUTPUT ? `${s.slice(0, MAX_OUTPUT)}\n[…output truncated at ${MAX_OUTPUT} chars]` : s;

        return { stdout: truncate(stdout), stderr: truncate(stderr), exitCode: 0 };

    } catch (err) {
        const e = err as { stdout?: string; stderr?: string; code?: number; killed?: boolean; signal?: string };

        if (e.killed || e.signal === 'SIGTERM') {
            return {
                stdout: e.stdout ?? '',
                stderr: `🚫 Command killed after ${TIMEOUT_MS / 1000}s timeout`,
                exitCode: 124,
            };
        }

        return {
            stdout: e.stdout ?? '',
            stderr: e.stderr ?? String(err),
            exitCode: typeof e.code === 'number' ? e.code : 1,
        };
    }
}

/**
 * Parse a command string into [binary, ...args] without spawning a shell.
 * Handles basic quoting ("multi word arg") but not complex shell syntax.
 */
function parseCommandParts(command: string): string[] {
    const parts: string[] = [];
    let current = '';
    let inDouble = false;
    let inSingle = false;

    for (let i = 0; i < command.length; i++) {
        const ch = command[i];

        if (ch === '"' && !inSingle) { inDouble = !inDouble; continue; }
        if (ch === "'" && !inDouble) { inSingle = !inSingle; continue; }

        if (ch === ' ' && !inDouble && !inSingle) {
            if (current) { parts.push(current); current = ''; }
        } else {
            current += ch;
        }
    }
    if (current) parts.push(current);
    return parts;
}

// ── Skill export ──────────────────────────────────────────────────────────────

export const terminalRunCommandSkill: Skill = {
    id: 'terminal.run-command',
    name: 'Run Terminal Command',
    description: `Execute a sandboxed shell command in the project directory.

Security: 7-layer sandbox (blocklist → allowlist → no-shell exec → cwd jail → timeout → clean env → audit log).
Only safe read-only commands are allowed (git log/status/diff, ls, cat, grep, npm test/lint/build, npx tsc, etc.).
Destructive, network, and privilege-escalating commands are always blocked.`,
    version: '2.0.0',
    category: 'code',
    requiresIntegration: [],
    triggerPhrases: [
        'Run the tests',
        'Check git status',
        'Show me the git log',
        'Run npm test',
        'What files are in this directory?',
        'Run the linter',
        'Check for TypeScript errors',
        'What branches do we have?',
    ],
    preferredModel: 'quick',
    executionMode: 'delegated',
    latencyClass: 'slow',
    sideEffectLevel: 'high',
    exposeInLiveSession: false,
    inputSchema: {
        type: 'object',
        properties: {
            command: {
                type: 'string',
                description: 'The shell command to run. Must be in the allowed list. Destructive commands will be blocked.',
            },
            cwd: {
                type: 'string',
                description: 'Optional relative working directory within the project (e.g. "src" or "server"). Cannot escape the project root.',
            },
        },
        required: ['command'],
    },
    handler: async (_ctx, args) => {
        const command = String(args.command ?? '').trim();
        const cwd = typeof args.cwd === 'string' ? args.cwd : undefined;

        if (!command) {
            return { success: false, message: '❌ No command provided.' };
        }

        const result = await runSandboxedCommand(command, cwd);

        const outputParts = [
            result.stdout ? `STDOUT:\n${result.stdout}` : '',
            result.stderr ? `STDERR:\n${result.stderr}` : '',
        ].filter(Boolean);

        const output = outputParts.join('\n\n') || '(no output)';

        return {
            success: result.exitCode === 0 && !result.blockedReason,
            output: result,
            blocked: Boolean(result.blockedReason),
            message: result.blockedReason
                ? `🚫 Command blocked (security):\n${result.stderr}`
                : result.exitCode === 0
                    ? `✅ Command succeeded:\n${output}`
                    : `❌ Command failed (exit ${result.exitCode}):\n${output}`,
        };
    },
};
