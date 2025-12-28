import { html } from '../utils/template.js';
import { initTooltips, tooltipStyles } from '../utils/tooltip.js';
import './sender-switch.js';

class MessageCard extends HTMLElement {
	static get observedAttributes() {
		return ['message-id', 'sender', 'timestamp', 'text'];
	}

	constructor() {
		super();
		this.attachShadow({ mode: 'open' });
		this._onClick = this._onClick.bind(this);
		this._onInput = this._onInput.bind(this);
		this._onKeyDown = this._onKeyDown.bind(this);
		this._consecutiveEnters = 0;
		this._lastEnterTime = 0;
	}

	connectedCallback() {
		this.shadowRoot.adoptedStyleSheets = [tooltipStyles];

		// Detect if running on Mac
		const isMac =
			navigator.platform.toUpperCase().indexOf('MAC') >= 0 ||
			navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;
		const metaKey = isMac ? '⌘' : 'Ctrl';

		this.shadowRoot.innerHTML = html`
			<style>
				:host {
					display: block;
				}
				.card {
					border: 1px solid var(--color-edge);
					border-radius: var(--border-radius);
					padding: calc(12rem / 14);
					font-size: 14px;
					line-height: var(--line-height);
					background: var(--color-page);
				}
				.row {
					display: flex;
					justify-content: space-between;
					align-items: center;
				}
				.left {
					display: flex;
					gap: calc(10rem / 14);
				}
				.row textarea {
					all: unset;
					flex: 1;
					resize: none;
					min-height: 1lh;
					overflow: hidden;
					box-sizing: border-box;
					overflow-wrap: break-word;
					margin-top: calc(16rem / 14);
				}
				.date-display {
					all: unset;
					height: min-content;
					font: inherit;
					font-size: calc(12rem / 14);
					cursor: pointer;
					position: relative;
				}
				.date-display:not(:focus) {
					color: transparent;
				}
				.date-display:focus {
					color: var(--color-ink);
					outline: none;
				}
				.date-display:hover:not(:focus) {
					color: transparent;
				}
				.date-display::before {
					position: absolute;
					left: 0;
					top: 0;
					content: attr(data-formatted);
					pointer-events: none;
					color: var(--color-ink-subdued);
				}
				.date-display:hover::before {
					color: var(--color-ink);
				}
				.date-display:focus::before {
					display: none;
				}
				.date-display::-webkit-calendar-picker-indicator {
					opacity: 0;
					position: absolute;
					width: 100%;
					height: 100%;
					cursor: pointer;
					z-index: 1;
				}
				.actions {
					display: none;
					margin-top: calc(24rem / 14);

					button {
						all: unset;
						position: relative;
					}

					.left {
						gap: calc(24rem / 14);
					}

					svg {
						height: calc(28rem / 14);
						color: var(--color-ink-subdued);
					}
				}
				:host(.show-actions) .actions {
					display: flex;
				}
				.delete-button {
					all: unset;
					display: flex;
					justify-content: center;
					align-items: center;
					width: calc(32rem / 14);
					height: calc(32rem / 14);
					border-radius: 100%;
					background: var(--color-bubble-other);
					color: var(--color-ink-subdued);
				}
				.insert-image-button {
					display: none !important;
				}
				button:active {
					transform: translateY(1px);
				}
			</style>
			<div class="card">
				<div class="row">
					<div class="left">
						<sender-switch part="sender-switch"></sender-switch>
						<input
							part="date-input"
							type="datetime-local"
							class="date-display"
						/>
					</div>
					<button part="delete" class="delete-button">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="12"
							height="12"
							fill="none"
						>
							<path
								fill="currentColor"
								d="M11.8242 10.9752a.602.602 0 0 1 .1758.4245.6.6 0 0 1-.1758.4245.602.602 0 0 1-.4245.1758.6.6 0 0 1-.4245-.1758L6 6.8482l-4.9752 4.976a.6002.6002 0 1 1-.849-.849L5.1518 6 .1758 1.0248a.6003.6003 0 0 1 .849-.849L6 5.1518l4.9752-4.976a.6004.6004 0 0 1 .849.849L6.8482 6z"
							/>
						</svg>
					</button>
				</div>
				<div class="row input-container">
					<textarea
						part="message-input"
						placeholder="Message..."
						rows="1"
					></textarea>
				</div>
				<div class="row actions">
					<div class="left">
						<button
							part="add-below"
							data-tooltip="Add message below"
							data-tooltip-hotkey="${metaKey}+↵"
							data-tooltip-subtext="You can also type three new lines to add a new message below."
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewbox="0 0 35 28"
								width="100%"
								height="100%"
								fill="none"
							>
								<path
									fill="currentColor"
									d="M0 1.3333C0 .9797.1418.6406.3943.3905S.989 0 1.3462 0h29.6153c.3571 0 .6995.1405.9519.3905.2525.25.3943.5892.3943.9428s-.1418.6928-.3943.9428a1.353 1.353 0 0 1-.9519.3906H1.3462c-.357 0-.6995-.1405-.952-.3906A1.327 1.327 0 0 1 0 1.3333m1.3462 12h29.6153c.3571 0 .6995-.1404.9519-.3905.2525-.25.3943-.5892.3943-.9428s-.1418-.6928-.3943-.9428a1.352 1.352 0 0 0-.9519-.3905H1.3462c-.357 0-.6995.1404-.952.3905A1.327 1.327 0 0 0 0 12c0 .3536.1418.6928.3943.9428s.5948.3905.9519.3905m17.5 8h-17.5c-.357 0-.6995.1405-.952.3906A1.327 1.327 0 0 0 0 22.6667c0 .3536.1418.6927.3943.9428S.989 24 1.3462 24h17.5c.357 0 .6994-.1405.9518-.3905a1.327 1.327 0 0 0 .3943-.9428c0-.3537-.1418-.6928-.3943-.9428a1.352 1.352 0 0 0-.9518-.3906m14.8076 0h-2.6923v-2.6666c0-.3537-.1418-.6928-.3942-.9428a1.353 1.353 0 0 0-.9519-.3906c-.357 0-.6994.1405-.9519.3906a1.327 1.327 0 0 0-.3943.9428v2.6666h-2.6923c-.357 0-.6994.1405-.9519.3906a1.327 1.327 0 0 0-.3942.9428c0 .3536.1418.6927.3942.9428.2525.25.5949.3905.9519.3905h2.6923v2.6667c0 .3536.1419.6927.3943.9428.2525.25.5949.3905.9519.3905s.6994-.1405.9519-.3905a1.327 1.327 0 0 0 .3942-.9428V24h2.6923c.3571 0 .6995-.1405.9519-.3905A1.327 1.327 0 0 0 35 22.6667c0-.3537-.1418-.6928-.3943-.9428a1.352 1.352 0 0 0-.9519-.3906"
								/>
							</svg>
						</button>
						<button
							class="insert-image-button"
							part="insert-image"
							data-tooltip="Insert image"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewbox="0 0 33 28"
								width="100%"
								height="100%"
								fill="none"
							>
								<path
									fill="currentColor"
									d="M30.4615 0H2.5385a2.535 2.535 0 0 0-1.795.7455A2.55 2.55 0 0 0 0 2.5455v22.909c0 .6751.2674 1.3226.7435 1.8A2.535 2.535 0 0 0 2.5385 28h27.923a2.535 2.535 0 0 0 1.795-.7455 2.55 2.55 0 0 0 .7435-1.8V2.5455c0-.6751-.2674-1.3226-.7435-1.8A2.535 2.535 0 0 0 30.4615 0m0 2.5455V18.892l-4.1361-4.1459a2.54 2.54 0 0 0-.8236-.5519 2.53 2.53 0 0 0-1.9431 0 2.54 2.54 0 0 0-.8236.5519L19.562 17.928l-6.9807-7a2.535 2.535 0 0 0-1.7944-.745 2.535 2.535 0 0 0-1.7944.745l-6.454 6.4718V2.5455zM2.5385 21l8.25-8.2727 12.6923 12.7272H2.5385zm27.923 4.4545h-3.3904l-5.7115-5.7272 3.173-3.1818 5.9289 5.9468zm-11.423-15.909c0-.3776.1116-.7467.3208-1.0607a1.905 1.905 0 0 1 .8544-.7031 1.9 1.9 0 0 1 1.1-.1086 1.9 1.9 0 0 1 .9748.5224c.2663.267.4476.6072.5211.9775a1.914 1.914 0 0 1-.1084 1.103 1.91 1.91 0 0 1-.7012.8568 1.9 1.9 0 0 1-2.4039-.2374 1.911 1.911 0 0 1-.5576-1.35"
								/>
							</svg>
						</button>
					</div>
				</div>
			</div>
		`;
		this.shadowRoot.addEventListener('click', this._onClick);
		this.shadowRoot.addEventListener('input', this._onInput);
		this.shadowRoot.addEventListener('keydown', this._onKeyDown);

		// Listen for changes on the sender switch
		const senderSwitch = this.shadowRoot.querySelector('sender-switch');
		if (senderSwitch) {
			senderSwitch.addEventListener('change', (e) => {
				this.#emit('editor:update', {
					id: this.messageId,
					patch: { sender: e.detail.checked ? 'self' : 'other' },
				});
			});
		}

		this.#syncFromAttrs();
		// Ensure textarea is resized after initial render
		requestAnimationFrame(() => {
			const textarea = this.shadowRoot.querySelector('textarea');
			this.#resizeTextarea(textarea);
		});

		// Setup tooltip positioning for action buttons
		initTooltips(this.shadowRoot, this);
	}

	disconnectedCallback() {
		this.shadowRoot.removeEventListener('click', this._onClick);
		this.shadowRoot.removeEventListener('input', this._onInput);
		this.shadowRoot.removeEventListener('keydown', this._onKeyDown);
	}

	attributeChangedCallback() {
		this.#syncFromAttrs();
	}

	get messageId() {
		return this.getAttribute('message-id') || '';
	}
	get text() {
		return this.getAttribute('text') || '';
	}
	get sender() {
		return this.getAttribute('sender') || 'self';
	}
	get timestamp() {
		return this.getAttribute('timestamp') || '';
	}

	#formatDate(iso) {
		if (!iso) return '';
		try {
			const d = new Date(iso);
			const months = [
				'Jan',
				'Feb',
				'Mar',
				'Apr',
				'May',
				'Jun',
				'Jul',
				'Aug',
				'Sep',
				'Oct',
				'Nov',
				'Dec',
			];
			const month = months[d.getMonth()];
			const day = d.getDate();
			const year = d.getFullYear();
			let hours = d.getHours();
			const minutes = d.getMinutes();
			const ampm = hours >= 12 ? 'pm' : 'am';
			hours = hours % 12;
			hours = hours ? hours : 12; // the hour '0' should be '12'
			const minutesStr = minutes < 10 ? `0${minutes}` : minutes;
			return `${month} ${day}, ${year} ${hours}:${minutesStr}${ampm}`;
		} catch (_e) {
			return '';
		}
	}

	#resizeTextarea(textarea) {
		if (!textarea) return;
		textarea.style.height = 'auto';
		textarea.style.height = `${textarea.scrollHeight}px`;
	}

	focus() {
		const textarea = this.shadowRoot.querySelector('textarea');
		if (textarea) {
			// Scroll the card into view first
			this.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
			// Then focus the textarea
			textarea.focus();
		}
	}

	#syncFromAttrs() {
		const textarea = this.shadowRoot.querySelector('textarea');
		const senderSwitch = this.shadowRoot.querySelector('sender-switch');
		const dateInput = this.shadowRoot.querySelector(
			'input[type="datetime-local"]',
		);
		if (textarea && textarea.value !== this.text) {
			textarea.value = this.text;
			this.#resizeTextarea(textarea);
			// Reset Enter counter when text changes programmatically
			this._consecutiveEnters = 0;
			this._lastEnterTime = 0;
		}
		if (senderSwitch) {
			const isSelf = this.sender === 'self';
			if (senderSwitch.checked !== isSelf) {
				senderSwitch.checked = isSelf;
			}
		}
		if (dateInput) {
			// Convert ISO to local datetime-local format safely
			const iso = this.timestamp;
			try {
				if (iso) {
					const d = new Date(iso);
					const pad = (n) => String(n).padStart(2, '0');
					const v = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
					dateInput.value = v;
				} else {
					dateInput.value = '';
				}
			} catch (_e) {
				dateInput.value = '';
			}
			// Set the display value to formatted text
			this.#updateDateDisplay(dateInput);
		}
	}

	#updateDateDisplay(dateInput) {
		// Use a data attribute or title to store the formatted text
		// We'll use CSS to show the formatted text
		const iso = dateInput.value
			? new Date(dateInput.value).toISOString()
			: this.timestamp;
		const formatted = this.#formatDate(iso);
		dateInput.setAttribute('data-formatted', formatted);
		dateInput.setAttribute('title', formatted);
	}

	_onKeyDown(e) {
		const target = e.target;
		if (!target || !target.matches('textarea')) return;

		// Handle Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux) to add message below
		if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			this.#emit('editor:add-below', { id: this.messageId });
			return;
		}

		// Check if Enter key is pressed
		if (e.key === 'Enter' && !e.shiftKey) {
			const textarea = target;
			const cursorPos = textarea.selectionStart;
			const textLength = textarea.value.length;

			// Check if cursor is at the bottom (at the end of the text)
			const isAtBottom = cursorPos === textLength;

			if (isAtBottom) {
				const now = Date.now();
				// Reset counter if more than 1 second has passed since last Enter
				if (now - this._lastEnterTime > 1000) {
					this._consecutiveEnters = 0;
				}

				this._consecutiveEnters++;
				this._lastEnterTime = now;

				// If three Enters pressed consecutively at the bottom
				if (this._consecutiveEnters >= 3) {
					e.preventDefault();
					this._consecutiveEnters = 0;
					this._lastEnterTime = 0;
					// Remove the two newlines that were already inserted from the first two Enters
					const currentValue = textarea.value;
					const newValue = currentValue.slice(0, -2);
					textarea.value = newValue;
					this.#resizeTextarea(textarea);
					this.#emit('editor:update', {
						id: this.messageId,
						patch: { message: newValue },
					});
					// Emit add-below event
					this.#emit('editor:add-below', { id: this.messageId });
					return;
				}
			} else {
				// Reset counter if Enter is pressed but not at bottom
				this._consecutiveEnters = 0;
			}
		} else {
			// Reset counter on any other key
			this._consecutiveEnters = 0;
		}
	}

	_onInput(e) {
		const target = e.target;
		if (!target) return;
		if (target.matches('textarea')) {
			this.#resizeTextarea(target);
			this.#emit('editor:update', {
				id: this.messageId,
				patch: { message: target.value },
			});
		} else if (target.matches('input[type="datetime-local"]')) {
			const value = target.value;
			const iso = value ? new Date(value).toISOString() : null;
			this.#emit('editor:update', {
				id: this.messageId,
				patch: { timestamp: iso },
			});
			this.#updateDateDisplay(target);
		}
	}

	_onClick(e) {
		const button = e.target.closest('button');
		if (button && button.part) {
			// Handle button clicks
			if (button.part.contains('delete')) {
				this.#emit('editor:delete', { id: this.messageId });
				return;
			}
			if (button.part.contains('add-below')) {
				this.#emit('editor:add-below', { id: this.messageId });
				return;
			}
			if (button.part.contains('insert-image')) {
				this.#emit('editor:insert-image', { id: this.messageId });
				return;
			}
			return;
		}

		// If clicking on a focusable element (textarea, input) or sender-switch, don't interfere
		if (
			e.target.matches('textarea') ||
			e.target.matches('input') ||
			e.target.matches('sender-switch') ||
			e.target.closest('textarea') ||
			e.target.closest('input') ||
			e.target.closest('sender-switch')
		) {
			return;
		}

		// Clicking anywhere else in the card should focus the textarea
		const textarea = this.shadowRoot.querySelector('textarea');
		if (textarea) {
			setTimeout(() => {
				textarea.focus();
			}, 0);
		}
	}

	#emit(type, detail) {
		this.dispatchEvent(
			new CustomEvent(type, { detail, bubbles: true, composed: true }),
		);
	}
}

customElements.define('message-card', MessageCard);
