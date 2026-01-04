import { html } from '../utils/template.js';
import { arrowSvg } from './icons/arrow-svg.js';

class IconArrow extends HTMLElement {
	static get observedAttributes() {
		return ['text', 'action', 'reversed'];
	}

	constructor() {
		super();
		this.attachShadow({ mode: 'open' });
		this._onClick = this._onClick.bind(this);
	}

	connectedCallback() {
		this.render();
		this.shadowRoot
			.querySelector('button')
			.addEventListener('click', this._onClick);
	}

	disconnectedCallback() {
		this.shadowRoot
			.querySelector('button')
			?.removeEventListener('click', this._onClick);
	}

	attributeChangedCallback() {
		if (this.isConnected) {
			this.render();
		}
	}

	render() {
		const text = this.getAttribute('text') || '';
		const isReversed = this.hasAttribute('reversed');

		this.shadowRoot.innerHTML = html`
      <style>
				:host {
					display: flex;
					align-items: center;
					justify-content: center;
				}

				button {
					all: unset;
					color: var(--color-bubble-self);
					display: flex;
					align-items: center;
					justify-self: start;
					cursor: pointer;
				}

				.icon {
					display: inline-block;
					height: calc(16rem / 14);
					width: calc(8.5rem / 14);
					stroke-width: 1.5px;
				}

				.icon.reversed svg {
					transform: scaleX(-1);
				}

				svg {
					width: 100%;
					height: 100%;
					display: block;
					fill: currentColor;
					stroke: currentColor;
				}

				.text {
					background-color: var(--color-bubble-self);
					font-size: var(--font-size-small);
					font-weight: 300;
					color: white;
					padding-inline: calc(5rem / 14);
					padding-block: calc(2rem / 14);
					border-radius: 10rem;
					margin-inline: calc(5rem / 14);
				}

				.text.reversed {
					order: -1;
				}
			</style>
			<button>
				<div class="icon ${isReversed ? 'reversed' : ''}">${arrowSvg()}</div>
				${text
					? html`<span class="text ${isReversed ? 'reversed' : ''}"
								>${text}</span
							>`
					: ''}
			</button>
    `;
	}

	_onClick() {
		const action = this.getAttribute('action');

		// Emit navigation event for app to handle based on viewport
		this.dispatchEvent(
			new CustomEvent('navigate', {
				detail: { action },
				bubbles: true,
				composed: true, // allows event to cross shadow DOM boundary
			}),
		);
	}
}

customElements.define('icon-arrow', IconArrow);
