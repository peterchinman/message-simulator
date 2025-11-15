import { store } from './store.js';
import './message-card.js';

class ChatEditor extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({ mode: 'open' });
		this._onStoreChange = this._onStoreChange.bind(this);
		this._onDelegated = this._onDelegated.bind(this);
	}

	connectedCallback() {
		this.shadowRoot.innerHTML = /* html */ `
			<style>
				:host {
					display: block;
					height: 100%;
					box-sizing: border-box;
				}
				.wrapper {
					display: flex;
					flex-direction: column;
					height: 100%;
				}
				.header {
					padding: 8px 12px;
					border-bottom: 1px solid #ddd;
					font: 14px/1.4 system-ui;
					display: flex;
					gap: 8px;
					align-items: center;
				}
				.body {
					flex: 1;
					min-height: 0;
					overflow: auto;
					padding: 12px;
					background: #fafafa;
				}
				button {
					font: 12px system-ui;
					padding: 6px 10px;
					border: 1px solid #ccc;
					background: #f8f8f8;
					border-radius: 6px;
					cursor: pointer;
				}
			</style>
			<div class="wrapper" part="wrapper">
				<div class="header" part="header">
					Editor
					<button id="add-end" title="Add new message at end">
						Add message
					</button>
					<span style="flex:1"></span>
					<button id="export-json" title="Export chat as JSON">Export</button>
					<button id="import-json" title="Import chat from JSON">Import</button>
					<button id="clear-chat" title="Clear all messages">Clear</button>
				</div>
				<div class="body" part="body">
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
		this.shadowRoot.addEventListener('editor:update', this._onDelegated);
		this.shadowRoot.addEventListener('editor:delete', this._onDelegated);
		this.shadowRoot.addEventListener('editor:add-below', this._onDelegated);
		this.shadowRoot.addEventListener('editor:insert-image', this._onDelegated);
		this.shadowRoot.getElementById('add-end').addEventListener('click', () => {
			store.addMessage();
		});
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
		store.removeEventListener('messages:changed', this._onStoreChange);
	}

	_onStoreChange(e) {
		const { reason, message, messages } = e.detail || {};
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
			default:
				this.#render(messages);
				break;
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
		const body = this.shadowRoot && this.shadowRoot.querySelector('.body');
		if (!body) return;
		const cards = body.querySelectorAll('.editor-card');
		const referenceNode = cards[index] || null;
		if (card !== referenceNode) {
			body.insertBefore(card, referenceNode);
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
		const body = this.shadowRoot && this.shadowRoot.querySelector('.body');
		if (!body) return;
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
				body.insertBefore(card, referenceNode);
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
