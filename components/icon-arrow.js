import { html } from '../utils/template.js';

class IconArrow extends HTMLElement {
	static get observedAttributes() {
		return ['text', 'activates-mode', 'reversed'];
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
					display: inline-block;
				}

				button {
					all: unset;
					color: var(--color-native-sender);
					display: flex;
					align-items: center;
					justify-self: start;
					margin-left: calc(-4rem / 14);
					cursor: pointer;
				}

				.icon {
					display: inline-block;
					width: calc(24rem / 14);
					height: calc(24rem / 14);
					stroke-width: 12px;
					color: currentColor;
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
					background-color: var(--color-native-sender);
					font-size: var(--font-size-small);
					font-weight: 300;
					color: white;
					padding-inline: calc(5rem / 14);
					padding-block: calc(2rem / 14);
					border-radius: 10rem;
					margin-top: calc(1rem / 14);
				}

				.text:not(.reversed) {
					margin-left: calc(-3rem / 14);
				}

				.text.reversed {
					margin-right: calc(-3rem / 14);
					order: -1;
				}
			</style>
			<button>
				<span class="icon ${isReversed ? 'reversed' : ''}">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 256 256"
						aria-hidden="true"
					>
						<path
							d="M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z"
						/>
					</svg>
				</span>
				${text
					? html`<span class="text ${isReversed ? 'reversed' : ''}"
								>${text}</span
							>`
					: ''}
			</button>
		`;
	}

	_onClick() {
		const mode = this.getAttribute('activates-mode') || 'edit';
		const appContainer = document.querySelector('.app-container');
		if (appContainer) {
			appContainer.setAttribute('data-mode', mode);
		}
	}
}

customElements.define('icon-arrow', IconArrow);
