/**
 * Tooltip utility for positioning tooltips that avoid screen edges
 * Works with both regular DOM and Shadow DOM
 *
 * Usage:
 * 1. Add data-tooltip="Your tooltip text" to any element
 * 2. Import and call initTooltips():
 *    - For regular DOM: initTooltips()
 *    - For Shadow DOM: initTooltips(shadowRoot, hostElement)
 *
 * For Shadow DOM components, also adopt the tooltip stylesheet:
 *   import { initTooltips, tooltipStyles } from './utils/tooltip.js';
 *   this.shadowRoot.adoptedStyleSheets = [tooltipStyles];
 *   initTooltips(this.shadowRoot, this);
 *
 * Example:
 *   <button data-tooltip="Click me">Button</button>
 *   <script>
 *     import { initTooltips } from './utils/tooltip.js';
 *     initTooltips(); // Initialize for all elements in document
 *   </script>
 */

// Create a constructable stylesheet for tooltip styles (can be shared across Shadow DOM)
const tooltipStylesheet = new CSSStyleSheet();
tooltipStylesheet.replaceSync(`
	[data-tooltip] {
		position: relative;
		--tooltip-offset-x: 0px;
		--tooltip-arrow-offset-x: 0px;
	}

	[data-tooltip]::after {
		content: attr(data-tooltip);
		position: absolute;
		bottom: calc(100% + 8rem / 14);
		left: 50%;
		transform: translateX(calc(-50% + var(--tooltip-offset-x)));
		background: var(--color-ink);
		color: var(--color-page);
		padding: calc(6rem / 14) calc(10rem / 14);
		border-radius: calc(4rem / 14);
		font-size: calc(12rem / 14);
		white-space: nowrap;
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.15s ease-in-out;
		z-index: 1000;
	}

	[data-tooltip]::before {
		content: '';
		position: absolute;
		bottom: calc(100% + 2rem / 14);
		left: 50%;
		transform: translateX(calc(-50% + var(--tooltip-arrow-offset-x)));
		border: calc(4rem / 14) solid transparent;
		border-top-color: var(--color-ink);
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.15s ease-in-out;
		z-index: 1000;
	}

	[data-tooltip]:hover::after,
	[data-tooltip]:hover::before {
		opacity: 1;
	}
`);

export const tooltipStyles = tooltipStylesheet;

/**
 * Initialize tooltips for elements with data-tooltip attribute
 * @param {HTMLElement|ShadowRoot} root - Root element or shadow root to search within (default: document)
 * @param {HTMLElement} hostElement - Host element for getting computed styles (for shadow DOM, default: null)
 */
export function initTooltips(root = document, hostElement = null) {
	const tooltipElements = root.querySelectorAll('[data-tooltip]');
	tooltipElements.forEach((element) => {
		element.addEventListener('mouseenter', (e) => {
			positionTooltip(e.currentTarget, root, hostElement);
		});
	});
}

/**
 * Position a tooltip to avoid screen edges
 * @param {HTMLElement} element - Element with data-tooltip attribute
 * @param {HTMLElement|ShadowRoot} root - Root element or shadow root (for creating temp elements)
 * @param {HTMLElement} hostElement - Host element for getting computed styles
 */
function positionTooltip(element, root, hostElement) {
	const tooltipText = element.getAttribute('data-tooltip');
	if (!tooltipText) return;

	// Get computed styles from host element or document
	const stylesSource = hostElement || document.documentElement;
	const hostStyles = window.getComputedStyle(stylesSource);
	const fontSize = hostStyles.fontSize || '12px';

	// Create a temporary element to measure tooltip width with actual styles
	const temp = document.createElement('span');
	temp.style.position = 'absolute';
	temp.style.visibility = 'hidden';
	temp.style.whiteSpace = 'nowrap';
	temp.style.fontSize = fontSize;
	temp.style.fontFamily =
		hostStyles.fontFamily || '-apple-system, BlinkMacSystemFont, sans-serif';
	temp.style.padding = 'calc(6rem / 14) calc(10rem / 14)';
	temp.style.boxSizing = 'border-box';
	temp.textContent = tooltipText;
	root.appendChild(temp);

	// Force a reflow to ensure accurate measurement
	void temp.offsetWidth;

	const tooltipWidth = temp.offsetWidth;
	root.removeChild(temp);

	// Get element position relative to viewport
	const elementRect = element.getBoundingClientRect();
	const elementCenterX = elementRect.left + elementRect.width / 2;

	// Calculate ideal tooltip position (centered above element)
	const tooltipLeft = elementCenterX - tooltipWidth / 2;
	const tooltipRight = tooltipLeft + tooltipWidth;

	// Check viewport boundaries
	const viewportWidth = window.innerWidth;
	const padding = 8; // Minimum distance from viewport edge

	let offsetX = 0;

	// If tooltip goes off left edge, shift right
	if (tooltipLeft < padding) {
		offsetX = padding - tooltipLeft;
	}
	// If tooltip goes off right edge, shift left
	else if (tooltipRight > viewportWidth - padding) {
		offsetX = viewportWidth - padding - tooltipWidth - tooltipLeft;
	}

	// Set CSS custom properties
	// Arrow stays centered on element (offset 0), tooltip shifts to avoid edges
	element.style.setProperty('--tooltip-offset-x', `${offsetX}px`);
	element.style.setProperty('--tooltip-arrow-offset-x', '0px');
}
