import { html } from '../utils/template.js';
import { initTooltips } from '../utils/tooltip.js';

class SenderSwitch extends HTMLElement {
	static get observedAttributes() {
		return ['checked'];
	}

	constructor() {
		super();
		this.attachShadow({ mode: 'open' });
		this._onChange = this._onChange.bind(this);
	}

	connectedCallback() {
		this.shadowRoot.innerHTML = html`
			<style>
				:host {
					--thumb-padding: calc(2rem / 14);
				}
				.sender-switch-container {
					font-size: var(--font-size);

					display: block;
					position: relative;
					flex-shrink: 0;
					line-height: var(--line-height);
					width: calc(var(--button-size) * 1.5);
					height: var(--button-size);
					background-color: var(--color-bubble-other);
					border-radius: calc(var(--button-size) / 2);
					cursor: pointer;
					transition: background-color 0.3s ease-in-out;

					&:has(input:checked) {
						background-color: var(--color-bubble-self);
					}

					input {
						opacity: 0;
						height: 0;
						width: 0;
					}

					.switch-thumb {
						position: absolute;
						left: var(--thumb-padding);
						top: var(--thumb-padding);
						width: calc(var(--button-size) - 2 * var(--thumb-padding));
						height: calc(var(--button-size) - 2 * var(--thumb-padding));
						background-color: var(--color-page);
						border-radius: 50%;
						transition: left 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);

						filter: drop-shadow(
							calc(var(--button-size) / 8) 0 4px var(--color-drop-shadow)
						);
					}

					input:checked + .switch-thumb {
						left: calc(0.5 * var(--button-size) + var(--thumb-padding));
						filter: drop-shadow(
							-calc(var(--button-size) / 8) 0 4px
								var(--color-drop-shadow-intense)
						);
					}
				}
			</style>
			<label
				class="sender-switch-container"
				data-tooltip="Switch between senders"
			>
				<input type="checkbox" part="checkbox" />
				<div class="switch-thumb"></div>
			</label>
		`;

		const checkbox = this.shadowRoot.querySelector('input[type="checkbox"]');
		if (checkbox) {
			checkbox.addEventListener('change', this._onChange);
			this.#syncFromAttr();
		}
		initTooltips(this.shadowRoot, this);
	}

	attributeChangedCallback(name) {
		if (name === 'checked') {
			this.#syncFromAttr();
		}
	}

	get checked() {
		return this.hasAttribute('checked');
	}

	set checked(value) {
		if (value) {
			this.setAttribute('checked', '');
		} else {
			this.removeAttribute('checked');
		}
	}

	#syncFromAttr() {
		const checkbox = this.shadowRoot.querySelector('input[type="checkbox"]');
		if (checkbox) {
			checkbox.checked = this.checked;
		}
	}

	_onChange(e) {
		this.checked = e.target.checked;
		this.dispatchEvent(
			new CustomEvent('change', {
				detail: { checked: e.target.checked },
				bubbles: true,
				composed: true,
			}),
		);
	}
}

customElements.define('sender-switch', SenderSwitch);
