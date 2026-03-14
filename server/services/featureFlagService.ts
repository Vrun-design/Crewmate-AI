import { serverConfig } from '../config';

export interface FeatureFlags {
  slackInbound: boolean;
  approvalGates: boolean;
  uiNavigator: boolean;
  researchGrounding: boolean;
  skillsHub: boolean;
}

export function getFeatureFlags(): FeatureFlags {
  return { ...serverConfig.featureFlags };
}

export function isFeatureEnabled(flag: keyof FeatureFlags): boolean {
  return getFeatureFlags()[flag];
}
