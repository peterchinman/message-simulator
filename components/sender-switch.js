import { html } from '../utils/template.js';

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
				.sender-switch-container {
					display: block;
					position: relative;
					flex-shrink: 0;
					line-height: var(--line-height);
					width: calc(2lh + var(--message-padding-block) * 2);
					height: calc(1lh + var(--message-padding-block) * 2);
					background-color: var(--recipient-color);
					border-radius: var(--border-radius);
					cursor: pointer;
					transition: background-color 0.3s ease-in-out;

					&:has(input:checked) {
						background-color: var(--native-sender-color);
					}

					input {
						opacity: 0;
						height: 0;
						width: 0;
					}

					.switch-thumb {
						position: absolute;
						left: var(--message-padding-block);
						top: var(--message-padding-block);
						width: 1lh;
						height: 1lh;
						background-color: white;
						border-radius: 50%;
						transition: left 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
					}

					input:checked + .switch-thumb {
						left: calc(var(--message-padding-block) + 1lh);
					}
				}
			</style>
			<label class="sender-switch-container">
				<input type="checkbox" part="checkbox" />
				<div class="switch-thumb"></div>
			</label>
		`;

		const checkbox = this.shadowRoot.querySelector('input[type="checkbox"]');
		if (checkbox) {
			checkbox.addEventListener('change', this._onChange);
			this.#syncFromAttr();
		}
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
