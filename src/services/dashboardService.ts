import {api} from '../lib/api';
import type {DashboardData} from '../types/live';
import {mapIntegration} from './dashboardMappers';

export const dashboardService = {
  async getDashboard() {
    const payload = await api.get<DashboardData>('/api/dashboard');
    return {
      ...payload,
      integrations: payload.integrations.map(mapIntegration),
    };
  },
};
