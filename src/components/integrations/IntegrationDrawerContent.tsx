import React, { useEffect, useState } from 'react';
import { ArrowUpRight, Check, ExternalLink, Settings, Shield, Trash2 } from 'lucide-react';
import { useIntegrationConfig } from '../../hooks/useIntegrationConfig';
import { integrationsService } from '../../services/integrationsService';
import { Button } from '../ui/Button';
import type { Integration } from '../../types';
import { IntegrationLogo } from './IntegrationLogo';

interface IntegrationDrawerContentProps {
  integration: Integration;
  onClose: () => void;
  onSaved: () => void;
}

const GOOGLE_LOGO_URL = '/Google.svg';

function getOAuthButtonLabel(integrationName: string, isConnected: boolean): string {
  return isConnected ? `Reconnect ${integrationName}` : `Connect ${integrationName}`;
}

export function IntegrationDrawerContent({
  integration,
  onClose,
  onSaved,
}: IntegrationDrawerContentProps): React.ReactNode {
  const setupSteps = integration.setupSteps ?? [];
  const capabilities = integration.capabilities ?? [];
  const { config, isLoading, isSaving, error, saveConfig, clearConfig } = useIntegrationConfig(integration.id, true);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [connectError, setConnectError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

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
  const oauthConnection = config?.connection;
  const isGoogleWorkspace = integration.id === 'google-workspace';

  async function handleSave(): Promise<void> {
    await saveConfig(formValues);
    onSaved();
  }

  async function handleDisconnect(): Promise<void> {
    await clearConfig();
    onSaved();
  }

  async function handleOAuthConnect(): Promise<void> {
    setConnectError(null);
    setIsConnecting(true);

    try {
      const { redirectUrl } = await integrationsService.startOAuthConnection(integration.id, '/integrations');
      window.location.assign(redirectUrl);
    } catch (connectLoadError) {
      setConnectError(connectLoadError instanceof Error ? connectLoadError.message : `Unable to start ${integration.name} connection`);
    } finally {
      setIsConnecting(false);
    }
  }

  return (
    <div className="space-y-6 pb-4">
      {/* Header */}
      <div className="flex items-center gap-4 rounded-xl border border-border bg-secondary p-4">
        <IntegrationLogo
          integration={integration}
          containerClassName="h-14 w-14 rounded-2xl"
          iconSize={24}
          imagePaddingClassName="p-2"
          showShadow
        />
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

      {connectError ? (
        <div className="p-4 border border-amber-500/20 bg-amber-500/5 rounded-lg text-sm text-muted-foreground">
          {connectError}
        </div>
      ) : null}

      {/* ── CONNECTED STATE ──────────────────────────────────────────── */}
      {isConnected ? (
        <div className="space-y-6">
          <div className="p-4 border border-green-500/20 bg-green-500/5 rounded-lg">
            <h4 className="text-sm font-medium text-green-600 dark:text-green-400 mb-1">Ready for live tool calls</h4>
            <p className="text-xs text-muted-foreground">
              Crewmate can use this integration in live sessions and background tasks with the current saved settings.
            </p>
          </div>

          {/* OAuth connected — show reconnect button instead of key form */}
          {isOAuth ? (
              <div className="space-y-4">
                <div className="p-4 border border-border rounded-lg bg-secondary/50 space-y-2">
                  <p className="text-xs text-muted-foreground">Authenticated via secure OAuth. Tokens are stored securely on the server.</p>
                  {oauthConnection?.accountEmail || oauthConnection?.accountLabel ? (
                    <p className="text-sm text-foreground">
                      Connected as <span className="font-medium">{oauthConnection?.accountLabel ?? oauthConnection?.accountEmail}</span>
                    </p>
                  ) : null}
                </div>
                {oauthConnection ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg border border-border bg-card p-4">
                      <h5 className="text-sm font-medium text-foreground mb-2">Granted Access</h5>
                      <div className="space-y-2">
                        {(oauthConnection.grantedModules ?? []).map((moduleName) => (
                          <div key={moduleName} className="flex items-center gap-2 text-sm text-foreground">
                            <Check size={14} className="text-green-500" />
                            {moduleName}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
                      <h5 className="text-sm font-medium text-foreground mb-2">Needs Attention</h5>
                      <div className="space-y-2">
                        {(oauthConnection.missingModules ?? []).length > 0 ? (
                          (oauthConnection.missingModules ?? []).map((moduleName) => (
                            <div key={moduleName} className="text-sm text-muted-foreground">{moduleName}</div>
                          ))
                        ) : (
                          <div className="text-sm text-muted-foreground">All planned modules are available.</div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
                {config ? (
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                      <Settings size={16} className="text-muted-foreground" />
                      Default Destinations
                    </h4>
                    <div className="space-y-3">
                      {config.fields.map((field) => (
                        <div key={field.key} className="space-y-2">
                          <label className="text-sm font-medium text-foreground">{field.label}</label>
                          <input
                            type="text"
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
                  </div>
                ) : null}
              <button
                type="button"
                onClick={() => void handleOAuthConnect()}
                disabled={isConnecting}
                className="flex items-center justify-center gap-3 w-full rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground transition-all hover:bg-accent hover:border-foreground/30 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isGoogleWorkspace ? (
                  <img src={GOOGLE_LOGO_URL} alt="Google" className="w-5 h-5" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : null}
                {isConnecting ? 'Opening Google...' : getOAuthButtonLabel(integration.name, true)}
                <ExternalLink size={14} className="text-muted-foreground ml-auto" />
              </button>
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
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground flex items-center gap-2 px-1">
              <Settings size={16} className="text-muted-foreground" />
              Available Capabilities
            </h4>
            <div className="rounded-xl border border-border/50 bg-secondary/20 p-2">
              {capabilities.map((capability) => (
                <div key={capability} className="flex items-center gap-3 px-3 py-2.5 border-b border-border/40 last:border-0 text-sm text-foreground hover:bg-muted/5 transition-colors group">
                  <div className="bg-green-500/10 p-1 rounded-md text-green-500 group-hover:bg-green-500/20 transition-colors">
                    <Check size={12} strokeWidth={3} />
                  </div>
                  {capability}
                </div>
              ))}
            </div>
          </div>

          {/* Permissions */}
          {!isOAuth && (integration.requiredKeys ?? []).length > 0 ? (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-foreground flex items-center gap-2 px-1">
                <Shield size={16} className="text-muted-foreground" />
                Permissions
              </h4>
              <div className="rounded-xl border border-border/50 bg-secondary/20 p-2">
                {(integration.requiredKeys ?? []).map((requiredKey) => (
                  <div key={requiredKey} className="flex items-center gap-3 px-3 py-2.5 border-b border-border/40 last:border-0 text-sm text-foreground hover:bg-muted/5 transition-colors group">
                    <div className="bg-green-500/10 p-1 rounded-md text-green-500 group-hover:bg-green-500/20 transition-colors">
                      <Check size={12} strokeWidth={3} />
                    </div>
                    {requiredKey}
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
            ) : (
              <Button variant="primary" className="w-full" onClick={() => void handleSave()} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Defaults'}
              </Button>
            )}
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
              <button
                type="button"
                onClick={() => void handleOAuthConnect()}
                disabled={isConnecting}
                className="flex items-center justify-center gap-3 w-full rounded-xl border border-border bg-card px-4 py-3.5 text-sm font-semibold text-foreground transition-all hover:bg-accent hover:border-foreground/30 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isGoogleWorkspace ? (
                  <img
                    src={GOOGLE_LOGO_URL}
                    alt="Google"
                    className="w-5 h-5"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : null}
                {isConnecting ? 'Opening Google...' : getOAuthButtonLabel(integration.name, false)}
                <ExternalLink size={14} className="text-muted-foreground ml-auto" />
              </button>
              {isGoogleWorkspace ? (
                <div className="rounded-lg border border-border bg-secondary/50 p-4 text-sm text-muted-foreground">
                  One connection unlocks Gmail, Drive, Docs, Sheets, Slides, and Calendar. Gmail send and calendar invites still require confirmation before side effects.
                </div>
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
