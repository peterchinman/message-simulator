// MessageStore singleton: shared message state, migration, persistence
const CHAT_STORAGE_KEY = 'message-simulator:messages';
const CURRENT_SCHEMA_VERSION = 1;

const DEFAULT_MESSAGES = [
	{ message: 'Hi', sender: 'other' },
	{ message: 'Hello', sender: 'other' },
	{ message: 'What is this?', sender: 'self' },
	{ message: 'I had a dream that I was building an iMessage simulator', sender: 'other' },
	{ message: 'When I woke up I decided that I should build it', sender: 'other' },
	{ message: 'What do I do with it?', sender: 'self' },
	{ message: 'Flip the switch beside the input to change senders', sender: 'other' },
	{ message: 'Use the plus menu to clear, export, and import', sender: 'other' },
	{ message: 'No like, what is it for?', sender: 'self' },
	{ message: 'Lol idk', sender: 'other' }
];

class MessageStore extends EventTarget {
	#messages = [];
	#saveDebounceId = null;

	constructor() {
		super();
	}

	load() {
		try {
			const raw = localStorage.getItem(CHAT_STORAGE_KEY);
			if (!raw) {
				this.#messages = this.#withIdsAndTimestamps(DEFAULT_MESSAGES);
				this.save();
				this.#emitChange('init-defaults');
				return;
			}
			const parsed = JSON.parse(raw);
			const { messages, migrated } = this.#migrateStoredData(parsed);
			if (Array.isArray(messages)) {
				this.#messages = messages;
				if (migrated) this.save();
				this.#emitChange('load');
			} else {
				this.#messages = this.#withIdsAndTimestamps(DEFAULT_MESSAGES);
				this.save();
				this.#emitChange('init-defaults');
			}
		} catch (_err) {
			this.#messages = this.#withIdsAndTimestamps(DEFAULT_MESSAGES);
			this.save();
			this.#emitChange('init-defaults');
		}
	}

	save() {
		try {
			const payload = { version: CURRENT_SCHEMA_VERSION, messages: this.#messages };
			localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(payload));
		} catch (_err) {
			// swallow
		}
	}

	getMessages() {
		return this.#messages.slice();
	}

	addMessage(afterId) {
		const msg = {
			id: this.#generateId(),
			sender: 'self',
			message: '',
			timestamp: new Date().toISOString()
		};
		if (!afterId) {
			this.#messages.push(msg);
		} else {
			const idx = this.#messages.findIndex(m => m.id === afterId);
			if (idx === -1) this.#messages.push(msg);
			else this.#messages.splice(idx + 1, 0, msg);
		}
		this.#scheduleSave();
		this.#emitChange('add', msg);
		return msg;
	}

	updateMessage(id, patch) {
		const idx = this.#messages.findIndex(m => m.id === id);
		if (idx === -1) return;
		this.#messages[idx] = { ...this.#messages[idx], ...patch };
		this.#scheduleSave();
		this.#emitChange('update', this.#messages[idx]);
	}

	deleteMessage(id) {
		const idx = this.#messages.findIndex(m => m.id === id);
		if (idx === -1) return;
		const removed = this.#messages.splice(idx, 1)[0];
		this.#scheduleSave();
		this.#emitChange('delete', removed);
	}

	insertImage(id, dataUrl) {
		if (!dataUrl) return;
		const idx = this.#messages.findIndex(m => m.id === id);
		if (idx === -1) return;
		const msg = this.#messages[idx];
		const images = Array.isArray(msg.images) ? msg.images.slice() : [];
		images.push({ id: this.#generateId(), src: dataUrl });
		this.#messages[idx] = { ...msg, images };
		this.#scheduleSave();
		this.#emitChange('update', this.#messages[idx]);
	}

	clear() {
		this.#messages = [];
		this.#scheduleSave();
		this.#emitChange('clear');
	}

	exportJson(pretty = true) {
		const payload = { version: CURRENT_SCHEMA_VERSION, messages: this.#messages };
		return pretty ? JSON.stringify(payload, null, 2) : JSON.stringify(payload);
	}

	importJson(json) {
		let parsed;
		try {
			parsed = typeof json === 'string' ? JSON.parse(json) : json;
		} catch (_e) {
			throw new Error('Invalid JSON');
		}
		let imported = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.messages) ? parsed.messages : null);
		if (!imported) throw new Error('Invalid format');
		imported = imported.map(m => {
			if (m && typeof m.timestamp === 'number') {
				return { ...m, timestamp: new Date(m.timestamp).toISOString() };
			}
			return m;
		}).filter(this.#isValidMessage.bind(this));
		this.#ensureMessageIds(imported);
		this.#messages = imported;
		this.#scheduleSave();
		this.#emitChange('import');
	}

	#scheduleSave() {
		if (this.#saveDebounceId) cancelAnimationFrame(this.#saveDebounceId);
		this.#saveDebounceId = requestAnimationFrame(() => {
			this.save();
			this.#saveDebounceId = null;
		});
	}

	#emitChange(reason, message = null) {
		this.dispatchEvent(new CustomEvent('messages:changed', { detail: { reason, message, messages: this.getMessages() }, bubbles: false, composed: false }));
	}

	#generateId() {
		try {
			if (window && window.crypto && typeof window.crypto.randomUUID === 'function') {
				return window.crypto.randomUUID();
			}
		} catch (_e) {}
		return 'msg_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
	}

	#withIdsAndTimestamps(arr) {
		const now = Date.now();
		return arr.map((m, i) => ({
			id: this.#generateId(),
			sender: m.sender === 'self' || m.sender === 'other' ? m.sender : 'self',
			message: typeof m.message === 'string' ? m.message : '',
			timestamp: new Date(now + i * 1000).toISOString()
		}));
	}

	#migrateStoredData(parsed) {
		let migrated = false;
		if (parsed && typeof parsed === 'object' && parsed.version === CURRENT_SCHEMA_VERSION) {
			let messages = Array.isArray(parsed.messages) ? parsed.messages : [];
			let changed = false;
			messages = messages.map(m => {
				if (m && typeof m.timestamp === 'number') {
					changed = true;
					return { ...m, timestamp: new Date(m.timestamp).toISOString() };
				}
				return m;
			}).filter(this.#isValidMessage.bind(this));
			if (this.#ensureMessageIds(messages)) changed = true;
			migrated = migrated || changed;
			return { messages, migrated };
		}
		return { messages: null, migrated };
	}

	#isValidMessage(item) {
		if (!item || typeof item !== 'object') return false;
		const { message, sender } = item;
		if (typeof message !== 'string') return false;
		if (sender !== 'self' && sender !== 'other') return false;
		if (Object.prototype.hasOwnProperty.call(item, 'timestamp')) {
			const t = item.timestamp;
			if (!(typeof t === 'string' || typeof t === 'number')) return false;
		}
		if (Object.prototype.hasOwnProperty.call(item, 'id')) {
			if (typeof item.id !== 'string' || item.id.length === 0) return false;
		}
		if (Object.prototype.hasOwnProperty.call(item, 'images')) {
			if (!Array.isArray(item.images)) return false;
		}
		return true;
	}

	#ensureMessageIds(messages) {
		let changed = false;
		for (let i = 0; i < messages.length; i++) {
			const m = messages[i];
			if (m && (m.id === undefined || m.id === null || m.id === '')) {
				m.id = this.#generateId();
				changed = true;
			}
		}
		return changed;
	}
}

const store = new MessageStore();
export { store, CHAT_STORAGE_KEY, CURRENT_SCHEMA_VERSION };


