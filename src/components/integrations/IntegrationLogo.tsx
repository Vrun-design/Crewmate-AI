import React from 'react';
import type { Integration } from '../../types';

interface IntegrationLogoProps {
  integration: Integration;
  containerClassName: string;
  iconSize: number;
  imagePaddingClassName: string;
  showShadow?: boolean;
}

function getLogoImageClassName(integration: Integration, imagePaddingClassName: string): string {
  const invertClassName = integration.name.toLowerCase() === 'github' ? ' dark:invert' : '';
  return `h-full w-full object-contain ${imagePaddingClassName}${invertClassName}`;
}

export function IntegrationLogo({
  integration,
  containerClassName,
  iconSize,
  imagePaddingClassName,
  showShadow = false,
}: IntegrationLogoProps): React.ReactNode {
  const baseClassName = `${containerClassName} shrink-0 flex items-center justify-center overflow-hidden border`;
  const logoClassName = integration.logoUrl
    ? `${baseClassName} bg-card border-border${showShadow ? ' shadow-sm' : ''}`
    : `${baseClassName} ${integration.bgColor} ${integration.color}`;

  return (
    <div className={logoClassName}>
      {integration.logoUrl ? (
        <div className="h-full w-full">
          <img
            src={integration.logoUrl}
            alt={integration.name}
            className={getLogoImageClassName(integration, imagePaddingClassName)}
          />
        </div>
      ) : (
        <integration.icon size={iconSize} />
      )}
    </div>
  );
}
