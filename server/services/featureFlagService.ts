import { serverConfig } from '../config';

export interface FeatureFlags {
  offshiftInbox: boolean;
  jobTypesV2: boolean;
  slackInbound: boolean;
  approvalGates: boolean;
  uiNavigator: boolean;
  researchGrounding: boolean;
}

export function getFeatureFlags(): FeatureFlags {
  return { ...serverConfig.featureFlags };
}

export function isFeatureEnabled(flag: keyof FeatureFlags): boolean {
  return getFeatureFlags()[flag];
}
