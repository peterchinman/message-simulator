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
 * Notes:
 * - Tooltips are rendered in a global "portal" attached to document.body so they
 *   always appear above adjacent content (and avoid Shadow DOM clipping/stacking issues).
 * - initTooltips() will inject the needed global tooltip CSS into <head> once.
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

const TOOLTIP_STYLE_TAG_ID = 'message-simulator-tooltip-styles';
const TOOLTIP_LAYER_ID = 'message-simulator-tooltip-layer';

const TOOLTIP_CSS_TEXT = /* css */ `
	.${TOOLTIP_LAYER_ID} {
		position: fixed;
		inset: 0;
		pointer-events: none;
		z-index: 2147483647;
	}

	.${TOOLTIP_LAYER_ID} .tooltip-bubble {
		position: fixed;
		left: 0;
		top: 0;
		background: var(--color-ink);
		color: var(--color-page);
		--tooltip-arrow-x: 50%;
		padding: calc(6rem / 14) calc(10rem / 14);
		border-radius: calc(4rem / 14);
		font-size: calc(12rem / 14);
		line-height: calc(16rem / 14);
		opacity: 0;
		display: flex;
		flex-direction: column;
		gap: calc(4rem / 14);
		min-width: max-content;
		max-width: min(200px, calc(100dvw - 16px));
		white-space: nowrap;
	}

	.${TOOLTIP_LAYER_ID}[data-visible='true'] .tooltip-bubble {
		opacity: 1;
	}

	.${TOOLTIP_LAYER_ID} .tooltip-bubble.has-subtext {
		white-space: normal;
	}

	.${TOOLTIP_LAYER_ID} .tooltip-main {
		display: flex;
		align-items: center;
		gap: calc(8rem / 14);
	}

	.${TOOLTIP_LAYER_ID} .tooltip-text {
		flex: 1;
	}

	.${TOOLTIP_LAYER_ID} .tooltip-hotkey {
		background: oklch(from var(--color-page) l c h / 0.25);
		padding: calc(2rem / 14) calc(6rem / 14);
		border-radius: calc(3rem / 14);
		font-size: calc(11rem / 14);
		font-weight: 500;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', monospace;
	}

	.${TOOLTIP_LAYER_ID} .tooltip-subtext {
		font-size: calc(11rem / 14);
		opacity: 0.8;
		line-height: calc(14rem / 14);
	}

	.${TOOLTIP_LAYER_ID} .tooltip-arrow {
		--tooltip-arrow-size: calc(4rem / 14);
		position: absolute;
		left: var(--tooltip-arrow-x);
		width: 0;
		height: 0;
		/* width is 0, so translateX(-50%) won't center; use margin-left instead */
		margin-left: calc(-1 * var(--tooltip-arrow-size));
		border: var(--tooltip-arrow-size) solid transparent;
	}

	.${TOOLTIP_LAYER_ID} .tooltip-bubble[data-placement='above'] .tooltip-arrow {
		top: 100%;
		border-top-color: var(--color-ink);
	}

	.${TOOLTIP_LAYER_ID} .tooltip-bubble[data-placement='below'] .tooltip-arrow {
		bottom: 100%;
		border-bottom-color: var(--color-ink);
	}
`;

function ensureGlobalTooltipStyles() {
	if (document.getElementById(TOOLTIP_STYLE_TAG_ID)) return;
	const style = document.createElement('style');
	style.id = TOOLTIP_STYLE_TAG_ID;
	style.textContent = TOOLTIP_CSS_TEXT;
	document.head.appendChild(style);
}

function getOrCreateTooltipLayer() {
	/** @type {HTMLElement|null} */
	let layer = document.getElementById(TOOLTIP_LAYER_ID);
	if (layer) return layer;

	layer = document.createElement('div');
	layer.id = TOOLTIP_LAYER_ID;
	layer.className = TOOLTIP_LAYER_ID;
	layer.setAttribute('aria-hidden', 'true');

	const bubble = document.createElement('div');
	bubble.className = 'tooltip-bubble';
	bubble.setAttribute('role', 'tooltip');
	bubble.setAttribute('data-placement', 'above');

	const mainRow = document.createElement('div');
	mainRow.className = 'tooltip-main';

	const textSpan = document.createElement('span');
	textSpan.className = 'tooltip-text';
	mainRow.appendChild(textSpan);

	const hotkeySpan = document.createElement('span');
	hotkeySpan.className = 'tooltip-hotkey';
	mainRow.appendChild(hotkeySpan);

	const subtextSpan = document.createElement('span');
	subtextSpan.className = 'tooltip-subtext';

	const arrow = document.createElement('div');
	arrow.className = 'tooltip-arrow';

	bubble.appendChild(mainRow);
	bubble.appendChild(subtextSpan);
	bubble.appendChild(arrow);

	layer.appendChild(bubble);
	document.body.appendChild(layer);
	return layer;
}

/**
 * Initialize tooltips for elements with data-tooltip attribute
 * @param {HTMLElement|ShadowRoot} root - Root element or shadow root to search within (default: document)
 * @param {HTMLElement} hostElement - Host element for getting computed styles (for shadow DOM, default: null)
 */
export function initTooltips(root = document, hostElement = null) {
	ensureGlobalTooltipStyles();
	const layer = getOrCreateTooltipLayer();
	const bubble = layer.querySelector('.tooltip-bubble');
	const textEl = layer.querySelector('.tooltip-text');
	const hotkeyEl = layer.querySelector('.tooltip-hotkey');
	const subtextEl = layer.querySelector('.tooltip-subtext');

	/** @type {HTMLElement|null} */
	let activeTarget = null;

	function hideTooltip() {
		activeTarget = null;
		layer.setAttribute('data-visible', 'false');
		// Hide immediately (no show-delay on fade-out)
		if (bubble) bubble.style.transitionDelay = '0s';
	}

	/**
	 * @param {HTMLElement} element
	 */
	function showTooltipForElement(element) {
		if (!element || typeof element.getAttribute !== 'function') return;
		const tooltipText = element.getAttribute('data-tooltip');
		if (!tooltipText) return;

		activeTarget = element;

		const hotkey = element.getAttribute('data-tooltip-hotkey');
		const subtext = element.getAttribute('data-tooltip-subtext');

		if (textEl) textEl.textContent = tooltipText;

		if (hotkeyEl) {
			if (hotkey) {
				hotkeyEl.textContent = hotkey;
				hotkeyEl.style.display = '';
			} else {
				hotkeyEl.textContent = '';
				hotkeyEl.style.display = 'none';
			}
		}

		if (subtextEl) {
			if (subtext) {
				subtextEl.textContent = subtext;
				subtextEl.style.display = '';
			} else {
				subtextEl.textContent = '';
				subtextEl.style.display = 'none';
			}
		}

		if (bubble) {
			bubble.classList.toggle('has-subtext', Boolean(subtext));
			bubble.style.transitionDelay = '0.5s';
		}

		positionTooltip(element);
		layer.setAttribute('data-visible', 'true');
	}

	function positionTooltip(element) {
		if (!bubble) return;
		if (!element || !element.isConnected) return hideTooltip();

		// Get element position relative to viewport
		const rect = element.getBoundingClientRect();
		const centerX = rect.left + rect.width / 2;

		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;
		const padding = 8; // px from viewport edges
		const gap = 8; // px between element and tooltip

		// Measure bubble
		const originalVisibility = bubble.style.visibility || '';
		bubble.style.visibility = 'hidden';
		bubble.style.left = '0px';
		bubble.style.top = '0px';

		// Force layout
		void bubble.offsetWidth;
		const width = bubble.offsetWidth;
		const height = bubble.offsetHeight;
		bubble.style.visibility = originalVisibility;

		// Decide placement (above vs below)
		const yAbove = rect.top - height - gap;
		const yBelow = rect.bottom + gap;

		const fitsAbove = yAbove >= padding;
		const fitsBelow = yBelow + height <= viewportHeight - padding;

		let placement = 'above';
		let y = yAbove;
		if (!fitsAbove && fitsBelow) {
			placement = 'below';
			y = yBelow;
		} else if (!fitsAbove && !fitsBelow) {
			// Pick the side with more available space
			const spaceAbove = rect.top - padding;
			const spaceBelow = viewportHeight - padding - rect.bottom;
			if (spaceBelow > spaceAbove) {
				placement = 'below';
				y = Math.min(yBelow, viewportHeight - padding - height);
			} else {
				placement = 'above';
				y = Math.max(yAbove, padding);
			}
		}

		// Clamp horizontally within viewport
		const xIdeal = centerX - width / 2;
		const x = Math.max(
			padding,
			Math.min(xIdeal, viewportWidth - padding - width),
		);

		// Arrow position within bubble
		const arrowEdgePadding = 10;
		const arrowX = Math.max(
			arrowEdgePadding,
			Math.min(centerX - x, width - arrowEdgePadding),
		);

		bubble.setAttribute('data-placement', placement);
		bubble.style.left = `${x}px`;
		bubble.style.top = `${y}px`;
		bubble.style.setProperty('--tooltip-arrow-x', `${arrowX}px`);
	}

	const tooltipElements = root.querySelectorAll('[data-tooltip]');
	tooltipElements.forEach((element) => {
		element.addEventListener('mouseenter', (e) => {
			showTooltipForElement(e.currentTarget);
		});
		element.addEventListener('mouseleave', () => hideTooltip());
		element.addEventListener('focus', (e) => {
			showTooltipForElement(e.currentTarget);
		});
		element.addEventListener('blur', () => hideTooltip());
	});
	// Keep positioned when viewport moves
	const onReposition = () => {
		if (!activeTarget) return;
		positionTooltip(activeTarget);
	};
	window.addEventListener('scroll', onReposition, true);
	window.addEventListener('resize', onReposition, { passive: true });
}
