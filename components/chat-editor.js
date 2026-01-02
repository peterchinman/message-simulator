import { store } from './store.js';
import './message-card.js';
import './icon-arrow.js';
import { html } from '../utils/template.js';

class ChatEditor extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({ mode: 'open' });
		this._onStoreChange = this._onStoreChange.bind(this);
		this._onDelegated = this._onDelegated.bind(this);
		this._onFocusIn = this._onFocusIn.bind(this);
		this._onToggleTheme = this._onToggleTheme.bind(this);
		this._lastFocusedCard = null;
		this._themeObserver = null;
		this._headerObserver = null;
	}

	connectedCallback() {
		this.shadowRoot.innerHTML = html`
			<style>
				*,
				*::before,
				*::after {
					box-sizing: border-box;
				}
				:host {
					box-sizing: border-box;
					display: block;
					height: 100%;

					@media (min-width: 900px) {
						border-right: 1px solid var(--color-edge);
					}
				}
				.wrapper {
					display: flex;
					flex-direction: column;
					height: 100%;
					position: relative;
				}
				.editor-header {
					position: absolute;
					width: 100%;
					top: 0;
					left: 0;
					display: flex;
					align-items: center;
					padding-inline: var(--padding-inline);
					justify-content: space-between;
					background: var(--color-header);
					border-bottom: 1px solid var(--color-edge);
					-webkit-backdrop-filter: var(--backdrop-filter);
					backdrop-filter: var(--backdrop-filter);
					padding-block: 1rem;
					flex-wrap: nowrap;
					overflow-x: auto;
					user-select: none;
					z-index: 4;
				}

				@media (min-width: 900px) {
					.editor-header icon-arrow[activates-mode='preview'] {
						display: none;
					}
				}

				.cards-list {
					flex: 1;
					display: flex;
					flex-direction: column;
					gap: calc(12rem / 14);
					min-height: 0;
					overflow: auto;
					padding: 12px;
					padding-top: calc(12px + var(--editor-header-height, 0px));
				}
				.info-editor {
					border: 1px solid var(--color-edge);
					border-radius: var(--border-radius);
					padding: calc(12rem / 14);
					background: var(--color-page);
					display: flex;
					flex-direction: column;
					gap: calc(10rem / 14);
				}
				.info-editor .title {
					font: 12px system-ui;
					color: var(--color-ink-subdued);
					letter-spacing: 0.02em;
					text-transform: uppercase;
				}
				.info-editor label {
					display: flex;
					flex-direction: column;
					gap: calc(6rem / 14);
					font: 12px system-ui;
					color: var(--color-ink-subdued);
				}
				.info-editor input {
					all: unset;
					font: 14px system-ui;
					color: var(--color-ink);
					padding: 8px 10px;
					border: 1px solid var(--color-edge);
					border-radius: 8px;
					background: var(--color-header);
				}
				.info-editor input::placeholder {
					color: var(--color-ink-subdued);
				}
				button {
					font: 12px system-ui;
					padding: 6px 10px;
					border: 1px solid var(--color-edge);
					background: var(--color-menu);
					color: var(--color-ink);
					border-radius: 6px;
					cursor: pointer;
				}
			</style>
			<div class="wrapper">
				<div class="editor-header">
					<button id="export-json" title="Export chat as JSON">Export</button>
					<button id="import-json" title="Import chat from JSON">Import</button>
					<button id="clear-chat" title="Clear all messages">Clear</button>
					<button
						id="toggle-theme"
						title="Toggle theme"
						aria-label="Toggle theme"
					>
						Theme
					</button>
					<icon-arrow
						text="Preview"
						activates-mode="preview"
						reversed
					></icon-arrow>
				</div>
				<div class="cards-list">
					<div class="info-editor">
						<div class="title">Info</div>
						<label>
							Name
							<input
								id="recipient-name"
								type="text"
								autocomplete="off"
								placeholder="Recipient"
							/>
						</label>
						<label>
							Location
							<input
								id="recipient-location"
								type="text"
								autocomplete="off"
								placeholder="New York, NY"
							/>
						</label>
					</div>
					<!-- cards go here -->
				</div>
				<input
					id="file-input"
					type="file"
					accept="image/*"
					style="display:none"
				/>
				<input
					id="import-file"
					type="file"
					accept=".json,application/json"
					style="display:none"
				/>
			</div>
		`;

		const headerEl = this.shadowRoot.querySelector('.editor-header');
		const cardsListEl = this.shadowRoot.querySelector('.cards-list');
		const recipientNameInput = this.shadowRoot.querySelector('#recipient-name');
		const recipientLocationInput = this.shadowRoot.querySelector(
			'#recipient-location',
		);

		this.$ = {
			headerEl,
			cardsListEl,
			recipientNameInput,
			recipientLocationInput,
		};

		if (headerEl && cardsListEl && typeof ResizeObserver === 'function') {
			this._headerObserver = new ResizeObserver((entries) => {
				for (let entry of entries) {
					const height = entry.target.getBoundingClientRect().height;
					cardsListEl.style.setProperty(
						'--editor-header-height',
						`${height}px`,
					);
				}
			});
			this._headerObserver.observe(headerEl);
		}

		const onRecipientInput = () => {
			store.updateRecipient({
				name: this.$?.recipientNameInput?.value ?? '',
				location: this.$?.recipientLocationInput?.value ?? '',
			});
		};
		this._onRecipientInput = onRecipientInput;
		if (recipientNameInput)
			recipientNameInput.addEventListener('input', onRecipientInput);
		if (recipientLocationInput)
			recipientLocationInput.addEventListener('input', onRecipientInput);

		this.shadowRoot.addEventListener('editor:update', this._onDelegated);
		this.shadowRoot.addEventListener('editor:delete', this._onDelegated);
		this.shadowRoot.addEventListener('editor:add-below', this._onDelegated);
		this.shadowRoot.addEventListener('editor:insert-image', this._onDelegated);
		this.shadowRoot.addEventListener('focusin', this._onFocusIn, true);
		this.shadowRoot
			.getElementById('export-json')
			.addEventListener('click', () => {
				const dataStr = store.exportJson(true);
				const blob = new Blob([dataStr], { type: 'application/json' });
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = `chat-export-${Date.now()}.json`;
				a.click();
				URL.revokeObjectURL(url);
			});
		this.shadowRoot
			.getElementById('import-json')
			.addEventListener('click', () => {
				this.shadowRoot.getElementById('import-file').click();
			});
		this.shadowRoot
			.getElementById('clear-chat')
			.addEventListener('click', () => {
				if (confirm('Are you sure you want to clear all messages?')) {
					store.clear();
				}
			});

		this.shadowRoot
			.getElementById('toggle-theme')
			.addEventListener('click', this._onToggleTheme);

		this.#syncThemeToggleLabel();
		this._themeObserver = new MutationObserver(() => {
			this.#syncThemeToggleLabel();
		});
		this._themeObserver.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['data-theme'],
		});

		this.shadowRoot
			.getElementById('import-file')
			.addEventListener('change', (e) => {
				const file = e.target.files && e.target.files[0];
				if (!file) return;
				const reader = new FileReader();
				reader.onload = (ev) => {
					try {
						store.importJson(String(ev.target.result));
					} catch (_err) {
						alert('Error importing chat: Invalid JSON file');
					} finally {
						this.shadowRoot.getElementById('import-file').value = '';
					}
				};
				reader.readAsText(file);
			});
		store.addEventListener('messages:changed', this._onStoreChange);
		store.load();
		this.#syncRecipientInputs(store.getRecipient());
		this.#render(store.getMessages());
	}

	disconnectedCallback() {
		this.shadowRoot.removeEventListener('editor:update', this._onDelegated);
		this.shadowRoot.removeEventListener('editor:delete', this._onDelegated);
		this.shadowRoot.removeEventListener('editor:add-below', this._onDelegated);
		this.shadowRoot.removeEventListener(
			'editor:insert-image',
			this._onDelegated,
		);
		this.shadowRoot.removeEventListener('focusin', this._onFocusIn, true);
		store.removeEventListener('messages:changed', this._onStoreChange);
		if (this.$?.recipientNameInput && this._onRecipientInput) {
			this.$.recipientNameInput.removeEventListener(
				'input',
				this._onRecipientInput,
			);
		}
		if (this.$?.recipientLocationInput && this._onRecipientInput) {
			this.$.recipientLocationInput.removeEventListener(
				'input',
				this._onRecipientInput,
			);
		}
		if (this._headerObserver) {
			this._headerObserver.disconnect();
			this._headerObserver = null;
		}
		if (this._themeObserver) {
			this._themeObserver.disconnect();
			this._themeObserver = null;
		}
	}

	_onToggleTheme() {
		const STORAGE_KEY = 'message-simulator:theme';
		const root = document.documentElement;
		const current =
			root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
		const next = current === 'dark' ? 'light' : 'dark';
		root.setAttribute('data-theme', next);
		try {
			localStorage.setItem(STORAGE_KEY, next);
		} catch (_e) {
			// swallow
		}
		this.#syncThemeToggleLabel();
	}

	#syncThemeToggleLabel() {
		const btn =
			this.shadowRoot && this.shadowRoot.getElementById('toggle-theme');
		if (!btn) return;
		const current =
			document.documentElement.getAttribute('data-theme') === 'dark'
				? 'dark'
				: 'light';
		const next = current === 'dark' ? 'light' : 'dark';
		btn.textContent = next === 'dark' ? 'Dark' : 'Light';
		btn.title = `Switch to ${next} theme`;
		btn.setAttribute('aria-label', `Switch to ${next} theme`);
	}

	_onStoreChange(e) {
		const { reason, message, messages, recipient } = e.detail || {};
		if (recipient) this.#syncRecipientInputs(recipient);
		switch (reason) {
			case 'add':
				this.#onAdd(message, messages);
				break;
			case 'update':
				this.#onUpdate(message);
				break;
			case 'delete':
				this.#onDelete(message);
				break;
			case 'recipient':
				// No-op: we already synced inputs above; avoid rerendering cards while typing.
				break;
			default:
				this.#render(messages);
				break;
		}
	}

	#syncRecipientInputs(recipient) {
		const nameInput = this.$?.recipientNameInput;
		const locationInput = this.$?.recipientLocationInput;
		if (!nameInput || !locationInput) return;
		const active = this.shadowRoot && this.shadowRoot.activeElement;
		const name =
			recipient && typeof recipient.name === 'string' ? recipient.name : '';
		const location =
			recipient && typeof recipient.location === 'string'
				? recipient.location
				: '';
		if (active !== nameInput && nameInput.value !== name)
			nameInput.value = name;
		if (active !== locationInput && locationInput.value !== location)
			locationInput.value = location;
	}

	_onFocusIn(e) {
		// Find the message-card element that contains the focused element
		// Use composedPath to traverse shadow boundaries
		const path = e.composedPath();
		const card = path.find(
			(el) => el instanceof HTMLElement && el.tagName === 'MESSAGE-CARD',
		);
		if (!card) return;

		// Remove focused from the previously focused card
		if (this._lastFocusedCard && this._lastFocusedCard !== card) {
			this._lastFocusedCard.classList.remove('focused');
		}

		// Add focused to the newly focused card
		card.classList.add('focused');
		this._lastFocusedCard = card;

		// Dispatch event to scroll to this message in chat-preview
		const messageId = card.getAttribute('message-id');
		if (messageId) {
			this.dispatchEvent(
				new CustomEvent('editor:focus-message', {
					detail: { id: messageId },
					bubbles: true,
					composed: true,
				}),
			);
		}
	}

	_onDelegated(e) {
		const { id, patch } = e.detail || {};
		if (e.type === 'editor:update' && id && patch) {
			store.updateMessage(id, patch);
		} else if (e.type === 'editor:delete' && id) {
			store.deleteMessage(id);
		} else if (e.type === 'editor:add-below' && id) {
			store.addMessage(id);
		} else if (e.type === 'editor:insert-image' && id) {
			const fileInput = this.shadowRoot.getElementById('file-input');
			fileInput.onchange = async () => {
				const file = fileInput.files && fileInput.files[0];
				if (!file) return;
				const dataUrl = await this.#fileToDataUrl(file);
				store.updateMessage(
					id,
					((m) => {
						const images = Array.isArray(m.images) ? m.images.slice() : [];
						images.push({ id: this.#generateId(), src: dataUrl });
						return { images };
					})(store.getMessages().find((m) => m.id === id) || { images: [] }),
				);
				fileInput.value = '';
			};
			fileInput.click();
		}
	}

	async #fileToDataUrl(file) {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onerror = () => reject(reader.error);
			reader.onload = () => resolve(String(reader.result));
			reader.readAsDataURL(file);
		});
	}

	#generateId() {
		try {
			if (
				window &&
				window.crypto &&
				typeof window.crypto.randomUUID === 'function'
			) {
				return window.crypto.randomUUID();
			}
		} catch (_e) {}
		return (
			'img_' +
			Date.now().toString(36) +
			'_' +
			Math.random().toString(36).slice(2, 10)
		);
	}

	#queryCardById(id) {
		return this.shadowRoot.querySelector(`.editor-card[message-id="${id}"]`);
	}

	#ensureCardForMessage(m) {
		let card = this.#queryCardById(m.id);
		if (!card) {
			card = document.createElement('message-card');
			card.classList.add('editor-card');
			card.setAttribute('message-id', m.id);
		}
		return card;
	}

	#updateCardAttrs(card, m) {
		const ensureAttr = (el, name, value) => {
			if (value == null || value === '') {
				if (el.hasAttribute(name)) el.removeAttribute(name);
				return;
			}
			if (el.getAttribute(name) !== value) {
				el.setAttribute(name, value);
			}
		};
		const textValue = typeof m.message === 'string' ? m.message : '';
		ensureAttr(card, 'sender', m.sender || 'self');
		ensureAttr(card, 'timestamp', m.timestamp || '');
		ensureAttr(card, 'text', textValue);
	}

	#insertCardAtIndex(card, index) {
		const cardsList =
			this.shadowRoot && this.shadowRoot.querySelector('.cards-list');
		if (!cardsList) return;
		const cards = cardsList.querySelectorAll('.editor-card');
		const referenceNode = cards[index] || null;
		if (card !== referenceNode) {
			cardsList.insertBefore(card, referenceNode);
		}
	}

	#onAdd(message, messages) {
		if (!message || !Array.isArray(messages)) {
			this.#render(messages || []);
			return;
		}
		const index = messages.findIndex((m) => m && m.id === message.id);
		if (index === -1) {
			this.#render(messages);
			return;
		}
		const card = this.#ensureCardForMessage(message);
		this.#updateCardAttrs(card, message);
		this.#insertCardAtIndex(card, index);
		// Focus the newly created card's textarea
		requestAnimationFrame(() => {
			if (card && typeof card.focus === 'function') {
				card.focus();
			}
		});
	}

	#onUpdate(message) {
		if (!message || !message.id) return;
		const card = this.#queryCardById(message.id);
		if (!card) return;
		this.#updateCardAttrs(card, message);
	}

	#onDelete(message) {
		if (!message || !message.id) return;
		const card = this.#queryCardById(message.id);
		if (card && card.remove) card.remove();
	}

	#render(messages) {
		const cardsList =
			this.shadowRoot && this.shadowRoot.querySelector('.cards-list');
		if (!cardsList) return;
		const existing = new Map(
			Array.from(this.shadowRoot.querySelectorAll('.editor-card'))
				.filter((node) => node instanceof HTMLElement)
				.map((node) => [node.getAttribute('message-id'), node]),
		);

		const ensureAttr = (el, name, value) => {
			if (value == null || value === '') {
				if (el.hasAttribute(name)) el.removeAttribute(name);
				return;
			}
			if (el.getAttribute(name) !== value) {
				el.setAttribute(name, value);
			}
		};

		messages.forEach((m, index) => {
			let card = existing.get(m.id);
			if (!card) {
				card = document.createElement('message-card');
				card.classList.add('editor-card');
				card.setAttribute('message-id', m.id);
			}
			const referenceNode =
				this.shadowRoot.querySelectorAll('.editor-card')[index] || null;
			if (card !== referenceNode) {
				cardsList.insertBefore(card, referenceNode);
			}
			const textValue = typeof m.message === 'string' ? m.message : '';
			ensureAttr(card, 'sender', m.sender || 'self');
			ensureAttr(card, 'timestamp', m.timestamp || '');
			ensureAttr(card, 'text', textValue);
			existing.delete(m.id);
		});

		for (const leftover of existing.values()) {
			leftover.remove();
		}
	}
}

customElements.define('chat-editor', ChatEditor);
