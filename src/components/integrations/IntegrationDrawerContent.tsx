import React, {useEffect, useState} from 'react';
import {ArrowUpRight, Check, Settings, Shield, Trash2} from 'lucide-react';
import {useIntegrationConfig} from '../../hooks/useIntegrationConfig';
import {Button} from '../ui/Button';
import type {Integration} from '../../types';

interface IntegrationDrawerContentProps {
  integration: Integration;
  onClose: () => void;
  onSaved: () => void;
}

export function IntegrationDrawerContent({
  integration,
  onClose,
  onSaved,
}: IntegrationDrawerContentProps): React.ReactNode {
  const setupSteps = integration.setupSteps ?? [];
  const capabilities = integration.capabilities ?? [];
  const {config, isLoading, isSaving, error, saveConfig, clearConfig} = useIntegrationConfig(integration.id, true);
  const [formValues, setFormValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!config) {
      return;
    }

    setFormValues(
      config.fields.reduce<Record<string, string>>((acc, field) => {
        acc[field.key] = field.value ?? '';
        return acc;
      }, {}),
    );
  }, [config]);

  const isConnected = integration.status === 'connected';

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
      <div className="flex items-center gap-4 p-4 bg-secondary rounded-xl border border-border">
        <div
          className={`w-12 h-12 rounded-xl border flex items-center justify-center ${integration.bgColor} ${integration.color}`}
        >
          <integration.icon size={24} />
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

      {isConnected ? (
        <div className="space-y-6">
          <div className="p-4 border border-green-500/20 bg-green-500/5 rounded-lg">
            <h4 className="text-sm font-medium text-green-600 dark:text-green-400 mb-1">Ready for live tool calls</h4>
            <p className="text-xs text-muted-foreground">
              Crewmate can use this integration in-session with the current saved workspace configuration.
            </p>
          </div>

          {config ? (
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
                        setFormValues((current) => ({...current, [field.key]: event.target.value}))
                      }
                      className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:border-ring"
                    />
                    {field.helpText ? <div className="text-xs text-muted-foreground">{field.helpText}</div> : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

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

          {integration.notes ? (
            <div className="p-4 border border-border rounded-lg bg-secondary/50 text-sm text-muted-foreground">
              {integration.notes}
            </div>
          ) : null}

          <div className="pt-4 border-t border-border space-y-3">
            <Button variant="primary" className="w-full" onClick={() => void handleSave()} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Configuration'}
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
            {config?.configuredVia === 'vault' ? (
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
        <div className="space-y-6">
          <div className="p-4 border border-blue-500/20 bg-blue-500/5 rounded-lg">
            <h4 className="text-sm font-medium text-blue-500 dark:text-blue-400 mb-1">Connection Required</h4>
            <p className="text-xs text-muted-foreground">
              You can connect {integration.name} directly from this workspace. Env vars still work, but they are no longer required.
            </p>
          </div>

          <div className="space-y-3">
            {setupSteps.map((step) => (
              <div key={step} className="p-3 border border-border rounded-lg bg-card text-sm text-foreground">
                {step}
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-foreground">Workspace Connection</h4>
              <div className="space-y-3">
                {config?.fields.map((field) => (
                  <div key={field.key} className="space-y-2">
                    <label className="text-sm font-medium text-foreground">{field.label}</label>
                    <input
                      type={field.secret ? 'password' : 'text'}
                      placeholder={field.placeholder}
                      value={formValues[field.key] ?? ''}
                      onChange={(event) =>
                        setFormValues((current) => ({...current, [field.key]: event.target.value}))
                      }
                      className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:border-ring"
                    />
                    {field.helpText ? <div className="text-xs text-muted-foreground">{field.helpText}</div> : null}
                  </div>
                ))}
              </div>
            </div>

            {(integration.missingKeys ?? []).length > 0 ? (
              <div className="p-4 border border-amber-500/20 bg-amber-500/5 rounded-lg text-sm text-muted-foreground">
                Missing required values: {(integration.missingKeys ?? []).join(', ')}
              </div>
            ) : null}
          </div>

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
            <Button variant="secondary" className="w-full" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
