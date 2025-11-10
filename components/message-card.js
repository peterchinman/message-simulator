// <message-card> scaffolding
// Emits editor:* events. Full behavior implemented in later steps.

class MessageCard extends HTMLElement {
	static get observedAttributes() {
		return ['message-id', 'sender', 'timestamp', 'text'];
	}

	constructor() {
		super();
		this.attachShadow({ mode: 'open' });
		this._onClick = this._onClick.bind(this);
		this._onInput = this._onInput.bind(this);
	}

	connectedCallback() {
		this.shadowRoot.innerHTML = `
<style>
	:host{display:block}
	.card{border:1px solid var(--card-border,#ddd);border-radius:8px;padding:10px;margin:8px 0;font:14px/1.4 system-ui;background:#fff}
	.row{display:flex;gap:8px;align-items:center;margin:6px 0}
	.row textarea{flex:1;resize:vertical;min-height:48px}
	.row input[type="datetime-local"]{font:inherit}
	.actions{display:flex;gap:8px;flex-wrap:wrap}
	button{font:12px system-ui;padding:6px 10px;border:1px solid #ccc;background:#f8f8f8;border-radius:6px;cursor:pointer}
	button:active{transform:translateY(1px)}
	.switch{display:inline-flex;align-items:center;gap:6px}
	.switch input{accent-color:#007aff}
</style>
<div class="card">
	<div class="row">
		<textarea part="message-input" placeholder="Message..."></textarea>
	</div>
	<div class="row">
		<label class="switch">Sender:
			<select part="sender-select">
				<option value="self">self</option>
				<option value="other">other</option>
			</select>
		</label>
		<input part="date-input" type="datetime-local" />
	</div>
	<div class="actions">
		<button part="insert-image">Insert Picture</button>
		<button part="add-below">New message below</button>
		<button part="delete" style="margin-left:auto">Delete</button>
	</div>
</div>
		`;
		this.shadowRoot.addEventListener('click', this._onClick);
		this.shadowRoot.addEventListener('input', this._onInput);
		this.#syncFromAttrs();
	}

	disconnectedCallback() {
		this.shadowRoot.removeEventListener('click', this._onClick);
		this.shadowRoot.removeEventListener('input', this._onInput);
	}

	attributeChangedCallback() {
		this.#syncFromAttrs();
	}

	get messageId() { return this.getAttribute('message-id') || ''; }
	get text() { return this.getAttribute('text') || ''; }
	get sender() { return this.getAttribute('sender') || 'self'; }
	get timestamp() { return this.getAttribute('timestamp') || ''; }

	#syncFromAttrs() {
		const textarea = this.shadowRoot.querySelector('textarea');
		const select = this.shadowRoot.querySelector('select');
		const date = this.shadowRoot.querySelector('input[type="datetime-local"]');
		if (textarea && textarea.value !== this.text) textarea.value = this.text;
		if (select && select.value !== this.sender) select.value = this.sender;
		if (date) {
			// Convert ISO to local datetime-local format safely
			const iso = this.timestamp;
			try {
				if (iso) {
					const d = new Date(iso);
					const pad = n => String(n).padStart(2, '0');
					const v = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
					date.value = v;
				} else {
					date.value = '';
				}
			} catch (_e) {
				date.value = '';
			}
		}
	}

	_onInput(e) {
		const target = e.target;
		if (!target) return;
		if (target.matches('textarea')) {
			this.#emit('editor:update', { id: this.messageId, patch: { message: target.value } });
		} else if (target.matches('select')) {
			this.#emit('editor:update', { id: this.messageId, patch: { sender: target.value } });
		} else if (target.matches('input[type="datetime-local"]')) {
			const value = target.value;
			const iso = value ? new Date(value).toISOString() : null;
			this.#emit('editor:update', { id: this.messageId, patch: { timestamp: iso } });
		}
	}

	_onClick(e) {
		const el = e.target;
		if (!(el instanceof HTMLElement)) return;
		if (el.part && el.part.contains('delete')) {
			this.#emit('editor:delete', { id: this.messageId });
			return;
		}
		if (el.part && el.part.contains('add-below')) {
			this.#emit('editor:add-below', { id: this.messageId });
			return;
		}
		if (el.part && el.part.contains('insert-image')) {
			this.#emit('editor:insert-image', { id: this.messageId });
			return;
		}
	}

	#emit(type, detail) {
		this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
	}
}

customElements.define('message-card', MessageCard);


