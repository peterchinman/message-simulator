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
					display: flex;
					align-items: center;
					justify-content: center;
				}

				button {
					all: unset;
					color: var(--color-native-sender);
					display: flex;
					align-items: center;
					justify-self: start;
					cursor: pointer;
				}

				.icon {
					display: inline-block;
					height: calc(16rem / 14);
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
					background-color: var(--color-native-sender);
					font-size: var(--font-size-small);
					font-weight: 300;
					color: white;
					padding-inline: calc(5rem / 14);
					padding-block: calc(2rem / 14);
					border-radius: 10rem;
					margin-inline: calc(5rem / 14);
				}

				.text:not(.reversed) {
				}

				.text.reversed {
					order: -1;
				}
			</style>
			<button>
				<div class="icon ${isReversed ? 'reversed' : ''}">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="currentColor"
						viewBox="0 0 17 32"
						height="100%"
						width="100%"
					>
						<path
							d="M16.5849 29.5157c.1316.1351.236.2955.3072.4721a1.49 1.49 0 0 1 0 1.1138 1.46 1.46 0 0 1-.3072.4722 1.42 1.42 0 0 1-.4598.3154 1.385 1.385 0 0 1-1.0848 0 1.42 1.42 0 0 1-.4598-.3154L.4155 17.029a1.46 1.46 0 0 1-.3075-.472A1.49 1.49 0 0 1 0 16c0-.1911.0367-.3804.108-.557a1.46 1.46 0 0 1 .3074-.472L14.5805.4262C14.8463.1533 15.2068 0 15.5827 0s.7364.1533 1.0022.4262S17 1.0693 17 1.4552c0 .386-.1493.7562-.4151 1.0291L3.4202 16z"
						/>
					</svg>
				</div>
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
