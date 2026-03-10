import React, { ReactNode, useState } from 'react';

export interface TooltipProps {
    content: string | ReactNode;
    children: ReactNode;
    position?: 'top' | 'bottom' | 'left' | 'right';
    className?: string; // Appends classes to the wrapper div to handle layout (e.g., truncate)
    delayMs?: number;
}

function getTooltipPositionClasses(position: TooltipProps['position']): string {
    if (position === 'bottom') {
        return 'top-full left-0 mt-1.5';
    }

    if (position === 'left') {
        return 'right-full top-1/2 -translate-y-1/2 mr-1.5';
    }

    if (position === 'right') {
        return 'left-full top-1/2 -translate-y-1/2 ml-1.5';
    }

    return 'bottom-full left-0 mb-1.5';
}

export function Tooltip({ content, children, position = 'top', className = '', delayMs = 150 }: TooltipProps): React.JSX.Element {
    const [isVisible, setIsVisible] = useState(false);

    if (!content) return <>{children}</>;

    return (
        <div
            className={`relative ${className}`}
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
            onFocus={() => setIsVisible(true)}
            onBlur={() => setIsVisible(false)}
        >
            {children}
            {isVisible ? (
                <div
                    role="tooltip"
                    className={`pointer-events-none absolute z-50 w-max max-w-xs transition-opacity duration-200 ${getTooltipPositionClasses(position)}`}
                    style={{ transitionDelay: `${delayMs}ms` }}
                >
                    <div className="rounded-md border border-border bg-popover px-2.5 py-1.5 text-[11px] font-medium whitespace-normal break-words leading-relaxed text-popover-foreground shadow-[0_8px_24px_rgba(15,23,42,0.12)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.32)]">
                        {content}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
