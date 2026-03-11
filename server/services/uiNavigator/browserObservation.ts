import type { Page } from 'playwright';
import type { UiElementBounds, UiElementCandidate } from './uiNavigatorTypes';

export const MAX_UI_ELEMENT_CANDIDATES = 50;

export function buildFallbackSelector(tagName: string, index: number): string {
  return `${tagName.toLowerCase()}:nth-of-type(${index + 1})`;
}

export async function extractVisibleElements(page: Page): Promise<UiElementCandidate[]> {
  return page.evaluate((maxCandidates) => {
    function buildBounds(rect: DOMRect): UiElementBounds {
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      };
    }

    const nodes = Array.from(document.querySelectorAll<HTMLElement>('a, button, input, textarea, select, [role="button"], [role="link"]'));

    return nodes.slice(0, maxCandidates).map((node, index) => {
      const rect = node.getBoundingClientRect();
      const isVisible = rect.width > 0 && rect.height > 0;
      const tagName = node.tagName.toLowerCase();
      const selector = node.id
        ? `#${node.id}`
        : node.getAttribute('data-testid')
          ? `[data-testid="${node.getAttribute('data-testid')}"]`
          : `${tagName}:nth-of-type(${index + 1})`;

      return {
        selector,
        tagName,
        role: node.getAttribute('role') ?? '',
        text: node.innerText?.trim() ?? '',
        ariaLabel: node.getAttribute('aria-label') ?? '',
        placeholder: 'placeholder' in node ? node.getAttribute('placeholder') ?? '' : '',
        bounds: buildBounds(rect),
        isVisible,
        isClickable: tagName === 'a' || tagName === 'button' || node.getAttribute('role') === 'button' || node.getAttribute('role') === 'link',
        isEditable: ['input', 'textarea', 'select'].includes(tagName),
      };
    }).filter((candidate) => candidate.isVisible);
  }, MAX_UI_ELEMENT_CANDIDATES);
}
