import React, { useEffect, useState } from 'react';
import { ArrowUpRight, Check, ExternalLink, Settings, Shield, Trash2 } from 'lucide-react';
import { useIntegrationConfig } from '../../hooks/useIntegrationConfig';
import { Button } from '../ui/Button';
import type { Integration } from '../../types';

interface IntegrationDrawerContentProps {
  integration: Integration;
  onClose: () => void;
  onSaved: () => void;
}

const GOOGLE_LOGO_URL = '/Google.svg';

export function IntegrationDrawerContent({
  integration,
  onClose,
  onSaved,
}: IntegrationDrawerContentProps): React.ReactNode {
  const setupSteps = integration.setupSteps ?? [];
  const capabilities = integration.capabilities ?? [];
  const { config, isLoading, isSaving, error, saveConfig, clearConfig } = useIntegrationConfig(integration.id, true);
  const [formValues, setFormValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!config) return;
    setFormValues(
      config.fields.reduce<Record<string, string>>((acc, field) => {
        acc[field.key] = field.value ?? '';
        return acc;
      }, {})
    );
  }, [config]);

  const isConnected = integration.status === 'connected';
  const isOAuth = Boolean(integration.connectUrl);

  async function handleSave(): Promise<void> {
    await saveConfig(formValues);
    onSaved();
  }

  async function handleDisconnect(): Promise<void> {
    await clearConfig();
    onSaved();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 bg-secondary rounded-xl border border-border">
        <div
          className={`w-12 h-12 rounded-xl border flex items-center justify-center ${integration.logoUrl ? 'bg-card border-border shadow-sm' : `${integration.bgColor} ${integration.color}`}`}
        >
          {integration.logoUrl ? (
            <img
              src={integration.logoUrl}
              alt={integration.name}
              className={`w-8 h-8 object-contain ${integration.name.toLowerCase() === 'github' ? 'dark:invert' : ''}`}
            />
          ) : (
            <integration.icon size={24} />
          )}
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">{integration.name}</h3>
          <p className="text-sm text-muted-foreground">{integration.desc}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="p-4 border border-border rounded-lg bg-secondary/40 text-sm text-muted-foreground">
          Loading integration configuration...
        </div>
      ) : null}

      {error ? (
        <div className="p-4 border border-amber-500/20 bg-amber-500/5 rounded-lg text-sm text-muted-foreground">
          {error}
        </div>
      ) : null}

      {/* ── CONNECTED STATE ──────────────────────────────────────────── */}
      {isConnected ? (
        <div className="space-y-6">
          <div className="p-4 border border-green-500/20 bg-green-500/5 rounded-lg">
            <h4 className="text-sm font-medium text-green-600 dark:text-green-400 mb-1">Ready for live tool calls</h4>
            <p className="text-xs text-muted-foreground">
              Crewmate can use this integration in-session with the current saved workspace configuration.
            </p>
          </div>

          {/* OAuth connected — show reconnect button instead of key form */}
          {isOAuth ? (
            <div className="space-y-4">
              <div className="p-4 border border-border rounded-lg bg-secondary/50 space-y-2">
                <p className="text-xs text-muted-foreground">Authenticated via Google OAuth. Token is stored securely.</p>
              </div>
              <a
                href={`${import.meta.env.VITE_API_URL ?? ''}${integration.connectUrl}`}
                className="flex items-center justify-center gap-3 w-full rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground transition-all hover:bg-accent hover:border-foreground/30"
              >
                <img src={GOOGLE_LOGO_URL} alt="Google" className="w-5 h-5" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                Reconnect with Google
                <ExternalLink size={14} className="text-muted-foreground ml-auto" />
              </a>
            </div>
          ) : config ? (
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                <Settings size={16} className="text-muted-foreground" />
                Connection Settings
              </h4>
              <div className="space-y-3">
                {config.fields.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <label className="text-sm font-medium text-foreground">{field.label}</label>
                    <input
                      type={field.secret ? 'password' : 'text'}
                      placeholder={field.configured && field.secret ? 'Stored securely' : field.placeholder}
                      value={formValues[field.key] ?? ''}
                      onChange={(event) =>
                        setFormValues((current) => ({ ...current, [field.key]: event.target.value }))
                      }
                      className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:border-ring"
                    />
                    {field.helpText ? <div className="text-xs text-muted-foreground">{field.helpText}</div> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Capabilities */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
              <Settings size={16} className="text-muted-foreground" />
              Available Capabilities
            </h4>
            <div className="space-y-2">
              {capabilities.map((capability) => (
                <div key={capability} className="flex items-center gap-2 p-3 border border-border rounded-lg bg-card text-sm text-foreground">
                  <Check size={14} className="text-green-500" />
                  {capability}
                </div>
              ))}
            </div>
          </div>

          {/* Permissions */}
          {!isOAuth && (integration.requiredKeys ?? []).length > 0 ? (
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                <Shield size={16} className="text-muted-foreground" />
                Permissions
              </h4>
              <div className="p-4 border border-border rounded-lg bg-secondary/50 space-y-2">
                {(integration.requiredKeys ?? []).map((requiredKey) => (
                  <div key={requiredKey} className="flex items-center gap-2 text-sm text-foreground">
                    <Check size={14} className="text-green-500" /> {requiredKey}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {integration.notes ? (
            <div className="p-4 border border-border rounded-lg bg-secondary/50 text-sm text-muted-foreground">
              {integration.notes}
            </div>
          ) : null}

          <div className="pt-4 border-t border-border space-y-3">
            {!isOAuth ? (
              <Button variant="primary" className="w-full" onClick={() => void handleSave()} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Configuration'}
              </Button>
            ) : null}
            {integration.docsUrl ? (
              <a
                href={integration.docsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                <ArrowUpRight size={16} />
                Open Official Docs
              </a>
            ) : null}
            {config?.configuredVia === 'vault' && !isOAuth ? (
              <Button variant="danger" className="w-full" onClick={() => void handleDisconnect()} disabled={isSaving}>
                <Trash2 size={16} className="mr-2" />
                Remove Saved Connection
              </Button>
            ) : null}
            <Button variant="secondary" className="w-full" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>

      ) : (
        /* ── DISCONNECTED STATE ────────────────────────────────────── */
        <div className="space-y-6">
          <div className="p-4 border border-blue-500/20 bg-blue-500/5 rounded-lg">
            <h4 className="text-sm font-medium text-blue-500 dark:text-blue-400 mb-1">Connection Required</h4>
            <p className="text-xs text-muted-foreground">
              Connect {integration.name} to let Crewmate take actions on your behalf.
            </p>
          </div>

          {/* Step-by-step setup instructions */}
          {setupSteps.length > 0 ? (
            <div className="space-y-2">
              {setupSteps.map((step, i) => (
                <div key={step} className="flex items-start gap-3 p-3 border border-border rounded-lg bg-card text-sm text-foreground">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-secondary border border-border text-[10px] flex items-center justify-center font-semibold mt-0.5">
                    {i + 1}
                  </span>
                  {step}
                </div>
              ))}
            </div>
          ) : null}

          {/* OAuth path — big Google button */}
          {isOAuth ? (
            <div className="pt-4 border-t border-border space-y-3">
              <a
                href={`${import.meta.env.VITE_API_URL ?? ''}${integration.connectUrl}`}
                className="flex items-center justify-center gap-3 w-full rounded-xl border border-border bg-card px-4 py-3.5 text-sm font-semibold text-foreground transition-all hover:bg-accent hover:border-foreground/30 hover:shadow-sm"
              >
                <img
                  src={GOOGLE_LOGO_URL}
                  alt="Google"
                  className="w-5 h-5"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                Connect with Google
                <ExternalLink size={14} className="text-muted-foreground ml-auto" />
              </a>
              {integration.docsUrl ? (
                <a
                  href={integration.docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                >
                  <ArrowUpRight size={16} />
                  Open Official Docs
                </a>
              ) : null}
              <Button variant="secondary" className="w-full" onClick={onClose}>Close</Button>
            </div>
          ) : (
            /* API key form path */
            <div className="space-y-4">
              <div className="space-y-3">
                {config?.fields.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <label className="text-sm font-medium text-foreground">{field.label}</label>
                    <input
                      type={field.secret ? 'password' : 'text'}
                      placeholder={field.placeholder}
                      value={formValues[field.key] ?? ''}
                      onChange={(event) =>
                        setFormValues((current) => ({ ...current, [field.key]: event.target.value }))
                      }
                      className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:border-ring"
                    />
                    {field.helpText ? <div className="text-xs text-muted-foreground">{field.helpText}</div> : null}
                  </div>
                ))}
              </div>

              {(integration.missingKeys ?? []).length > 0 ? (
                <div className="p-4 border border-amber-500/20 bg-amber-500/5 rounded-lg text-sm text-muted-foreground">
                  Missing required values: {(integration.missingKeys ?? []).join(', ')}
                </div>
              ) : null}

              <div className="pt-4 border-t border-border space-y-3">
                <Button variant="primary" className="w-full" onClick={() => void handleSave()} disabled={isSaving}>
                  {isSaving ? 'Saving...' : `Save ${integration.name} Connection`}
                </Button>
                {integration.docsUrl ? (
                  <a
                    href={integration.docsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                  >
                    <ArrowUpRight size={16} />
                    Open Official Docs
                  </a>
                ) : null}
                <Button variant="secondary" className="w-full" onClick={onClose}>Close</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
