import {api} from '../lib/api';
import type {Integration, IntegrationConfigState} from '../types';
import {mapIntegration} from './dashboardMappers';

export const integrationsService = {
  async getIntegrations(): Promise<Integration[]> {
    const payload = await api.get<Integration[]>('/api/integrations');
    return payload.map(mapIntegration);
  },
  startOAuthConnection(integrationId: string, redirectPath = '/integrations'): Promise<{redirectUrl: string}> {
    return api.get(`/api/integrations/${integrationId}/connect?redirectPath=${encodeURIComponent(redirectPath)}&responseMode=json`);
  },
  getConfig(integrationId: string): Promise<IntegrationConfigState> {
    return api.get(`/api/integrations/${integrationId}/config`);
  },
  saveConfig(integrationId: string, values: Record<string, string>): Promise<IntegrationConfigState> {
    return api.put(`/api/integrations/${integrationId}/config`, {values});
  },
  deleteConfig(integrationId: string): Promise<void> {
    return api.delete(`/api/integrations/${integrationId}/config`);
  },
};
