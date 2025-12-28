/**
 * Tooltip utility for positioning tooltips that avoid screen edges
 * Works with both regular DOM and Shadow DOM
 *
 * Usage:
 * 1. Add data-tooltip="Your tooltip text" to any element
 * 2. Optionally add data-tooltip-hotkey="⌘+N" for keyboard shortcut display
 * 3. Optionally add data-tooltip-subtext="Additional description" for subtext
 * 4. Import and call initTooltips():
 *    - For regular DOM: initTooltips()
 *    - For Shadow DOM: initTooltips(shadowRoot, hostElement)
 *
 * For Shadow DOM components, also adopt the tooltip stylesheet:
 *   import { initTooltips, tooltipStyles } from './utils/tooltip.js';
 *   this.shadowRoot.adoptedStyleSheets = [tooltipStyles];
 *   initTooltips(this.shadowRoot, this);
 *
 * Examples:
 *   Simple tooltip:
 *     <button data-tooltip="Click me">Button</button>
 *
 *   With hotkey:
 *     <button data-tooltip="Add message" data-tooltip-hotkey="⌘+N">Add</button>
 *
 *   With hotkey and subtext:
 *     <button
 *       data-tooltip="Insert image"
 *       data-tooltip-hotkey="⌘+I"
 *       data-tooltip-subtext="Upload an image file">
 *       Insert
 *     </button>
 *
 *   <script>
 *     import { initTooltips } from './utils/tooltip.js';
 *     initTooltips(); // Initialize for all elements in document
 *   </script>
 */

// Create a constructable stylesheet for tooltip styles (can be shared across Shadow DOM)
const tooltipStylesheet = new CSSStyleSheet();
tooltipStylesheet.replaceSync(/* css */ `
	[data-tooltip] {
		position: relative;
		--tooltip-offset-x: 0px;
		--tooltip-arrow-offset-x: 0px;
	}

	[data-tooltip] .tooltip-content {
		position: absolute;
		bottom: calc(100% + 8rem / 14);
		left: 50%;
		transform: translateX(calc(-50% + var(--tooltip-offset-x)));
		background: var(--color-ink);
		color: var(--color-page);
		padding: calc(6rem / 14) calc(10rem / 14);
		border-radius: calc(4rem / 14);
		font-size: calc(12rem / 14);
		line-height: calc(16rem / 14);
		white-space: nowrap;
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.15s ease-in-out 0.5s;
		z-index: 1000;
		display: flex;
		flex-direction: column;
		gap: calc(4rem / 14);
		min-width: max-content;
	}

	[data-tooltip] .tooltip-content.has-subtext {
		white-space: normal;
		max-width: 200px;
	}

	[data-tooltip] .tooltip-main {
		display: flex;
		align-items: center;
		gap: calc(8rem / 14);
	}

	[data-tooltip] .tooltip-text {
		flex: 1;
	}

	[data-tooltip] .tooltip-hotkey {
		background: oklch(from var(--color-page) l c h / 0.25);
		padding: calc(2rem / 14) calc(6rem / 14);
		border-radius: calc(3rem / 14);
		font-size: calc(11rem / 14);
		font-weight: 500;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', monospace;
	}

	[data-tooltip] .tooltip-subtext {
		font-size: calc(11rem / 14);
		opacity: 0.8;
		line-height: calc(14rem / 14);
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
		transition: opacity 0.15s ease-in-out 0.5s;
		z-index: 1000;
	}

	[data-tooltip]:hover .tooltip-content,
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
		// Create tooltip content element if it doesn't exist
		if (!element.querySelector('.tooltip-content')) {
			createTooltipContent(element);
		}
		element.addEventListener('mouseenter', (e) => {
			positionTooltip(e.currentTarget, root, hostElement);
		});
	});
}

/**
 * Create the tooltip content structure based on data attributes
 * @param {HTMLElement} element - Element with data-tooltip attribute
 */
function createTooltipContent(element) {
	const tooltipText = element.getAttribute('data-tooltip');
	const hotkey = element.getAttribute('data-tooltip-hotkey');
	const subtext = element.getAttribute('data-tooltip-subtext');

	if (!tooltipText) return;

	const tooltipContent = document.createElement('div');
	tooltipContent.className = 'tooltip-content';
	if (subtext) {
		tooltipContent.classList.add('has-subtext');
	}

	const mainRow = document.createElement('div');
	mainRow.className = 'tooltip-main';

	const textSpan = document.createElement('span');
	textSpan.className = 'tooltip-text';
	textSpan.textContent = tooltipText;
	mainRow.appendChild(textSpan);

	if (hotkey) {
		const hotkeySpan = document.createElement('span');
		hotkeySpan.className = 'tooltip-hotkey';
		hotkeySpan.textContent = hotkey;
		mainRow.appendChild(hotkeySpan);
	}

	tooltipContent.appendChild(mainRow);

	if (subtext) {
		const subtextSpan = document.createElement('span');
		subtextSpan.className = 'tooltip-subtext';
		subtextSpan.textContent = subtext;
		tooltipContent.appendChild(subtextSpan);
	}

	element.appendChild(tooltipContent);
}

/**
 * Position a tooltip to avoid screen edges
 * @param {HTMLElement} element - Element with data-tooltip attribute
 * @param {HTMLElement|ShadowRoot} root - Root element or shadow root (for creating temp elements)
 * @param {HTMLElement} hostElement - Host element for getting computed styles
 */
function positionTooltip(element, root, hostElement) {
	const tooltipContent = element.querySelector('.tooltip-content');
	if (!tooltipContent) return;

	// Get computed styles from host element or document
	const stylesSource = hostElement || document.documentElement;
	const hostStyles = window.getComputedStyle(stylesSource);

	// Measure the actual tooltip content element
	// Temporarily make it visible for accurate measurement
	const originalOpacity = tooltipContent.style.opacity || '';
	const originalVisibility = tooltipContent.style.visibility || '';
	const originalDisplay = tooltipContent.style.display || '';
	tooltipContent.style.opacity = '0';
	tooltipContent.style.visibility = 'hidden';
	tooltipContent.style.display = 'flex';

	// Force a reflow to ensure accurate measurement
	void tooltipContent.offsetWidth;

	const tooltipWidth = tooltipContent.offsetWidth;
	const tooltipHeight = tooltipContent.offsetHeight;

	// Restore original styles
	tooltipContent.style.opacity = originalOpacity;
	tooltipContent.style.visibility = originalVisibility;
	tooltipContent.style.display = originalDisplay;

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
