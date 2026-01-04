// ThreadStore: manages multiple message threads with persistence
const THREADS_STORAGE_KEY = 'message-simulator:threads';
const CURRENT_SCHEMA_VERSION = 1;

const DEFAULT_RECIPIENT = {
	name: 'Peter Chinman',
	location: 'New York, NY',
};

const DEFAULT_MESSAGES = [
	{ message: 'Hi', sender: 'other' },
	{ message: 'Hello', sender: 'other' },
	{ message: 'What is this?', sender: 'self' },
	{
		message: 'I had a dream that I was building an iMessage simulator',
		sender: 'other',
	},
	{
		message: 'When I woke up I decided that I should build it',
		sender: 'other',
	},
	{ message: 'What do I do with it?', sender: 'self' },
	{
		message:
			'You can type in the input below, or use the edit pane for easy editing.',
		sender: 'other',
	},
	{
		message:
			'You can export or import the chats to share them. Clear the chat to start over. Toggle the theme between light and dark mode.',
		sender: 'other',
	},
	{ message: 'No like, what is it for?', sender: 'self' },
	{ message: 'Lol idk', sender: 'other' },
];

class ThreadStore extends EventTarget {
	#threads = [];
	#currentThreadId = null;
	#saveDebounceId = null;

	constructor() {
		super();
	}

	load() {
		try {
			const raw = localStorage.getItem(THREADS_STORAGE_KEY);
			if (!raw) {
				// No threads exist, create default thread
				const thread = this.#createDefaultThread();
				this.#threads = [thread];
				this.#currentThreadId = thread.id;
				this.save();
				this.#emitChange('init-defaults');
				return;
			}

			const parsed = JSON.parse(raw);
			if (
				parsed &&
				typeof parsed === 'object' &&
				parsed.version === CURRENT_SCHEMA_VERSION &&
				Array.isArray(parsed.threads)
			) {
				this.#threads = parsed.threads.filter(this.#isValidThread.bind(this));

				// If no valid threads, create default
				if (this.#threads.length === 0) {
					const thread = this.#createDefaultThread();
					this.#threads = [thread];
					this.#currentThreadId = thread.id;
					this.save();
					this.#emitChange('init-defaults');
					return;
				}

				this.#emitChange('load');
			} else {
				// Invalid format, create default thread
				const thread = this.#createDefaultThread();
				this.#threads = [thread];
				this.#currentThreadId = thread.id;
				this.save();
				this.#emitChange('init-defaults');
			}
		} catch (_err) {
			// Error loading, create default thread
			const thread = this.#createDefaultThread();
			this.#threads = [thread];
			this.#currentThreadId = thread.id;
			this.save();
			this.#emitChange('init-defaults');
		}
	}

	save() {
		try {
			const payload = {
				version: CURRENT_SCHEMA_VERSION,
				threads: this.#threads,
			};
			localStorage.setItem(THREADS_STORAGE_KEY, JSON.stringify(payload));
		} catch (err) {
			// Quota exceeded or other storage error
			console.error('Failed to save to localStorage:', err);
			// Emit error event for UI to handle
			this.dispatchEvent(
				new CustomEvent('storage:error', {
					detail: { error: err, operation: 'save' },
					bubbles: false,
					composed: false,
				}),
			);
		}
	}

	// ===== Thread Management Methods =====

	createThread() {
		const thread = {
			id: this.#generateId(),
			name: undefined, // No custom name initially
			messages: this.#withIdsAndTimestamps(DEFAULT_MESSAGES),
			recipient: { ...DEFAULT_RECIPIENT },
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};
		this.#threads.push(thread);
		this.#scheduleSave();
		this.#emitChange('thread-created', null, thread.id);
		return thread;
	}

	duplicateThread(threadId) {
		const original = this.#threads.find((t) => t.id === threadId);
		if (!original) return null;

		const copy = {
			id: this.#generateId(),
			name: `${this.getThreadDisplayName(original)} (Copy)`,
			messages: JSON.parse(JSON.stringify(original.messages)), // Deep clone
			recipient: { ...original.recipient },
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};
		this.#threads.push(copy);
		this.#scheduleSave();
		this.#emitChange('thread-created', null, copy.id);
		return copy;
	}

	deleteThread(threadId) {
		const idx = this.#threads.findIndex((t) => t.id === threadId);
		if (idx === -1) return false;

		this.#threads.splice(idx, 1);

		// If no threads remain, create a new default thread
		if (this.#threads.length === 0) {
			const newThread = this.#createDefaultThread();
			this.#threads.push(newThread);
			this.#currentThreadId = newThread.id;
		} else if (this.#currentThreadId === threadId) {
			// If we deleted the current thread, switch to another
			this.#currentThreadId = this.#threads[0].id;
		}

		this.#scheduleSave();
		this.#emitChange('thread-deleted', null, threadId);
		return true;
	}

	loadThread(threadId) {
		const thread = this.#threads.find((t) => t.id === threadId);
		if (!thread) {
			// Thread doesn't exist, try to load first available thread
			if (this.#threads.length > 0) {
				this.#currentThreadId = this.#threads[0].id;
				this.#emitChange('thread-changed', null, this.#currentThreadId);
				return this.#threads[0];
			}
			// No threads at all, create a default one
			const newThread = this.createThread();
			this.#currentThreadId = newThread.id;
			this.#emitChange('thread-changed', null, this.#currentThreadId);
			return newThread;
		}

		this.#currentThreadId = threadId;
		this.#emitChange('thread-changed', null, threadId);
		return thread;
	}

	listThreads() {
		// Return sorted by updatedAt descending (most recent first)
		return this.#threads
			.slice()
			.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
	}

	getCurrentThread() {
		if (!this.#currentThreadId) return null;
		return this.#threads.find((t) => t.id === this.#currentThreadId) || null;
	}

	updateThreadName(threadId, name) {
		const thread = this.#threads.find((t) => t.id === threadId);
		if (!thread) return;

		const trimmedName = String(name ?? '').trim();
		thread.name = trimmedName.length > 0 ? trimmedName : undefined;
		thread.updatedAt = new Date().toISOString();
		this.#scheduleSave();
		this.#emitChange('thread-updated', null, threadId);
	}

	getThreadDisplayName(thread) {
		if (!thread) return '';
		return thread.name || thread.recipient?.name || 'Unknown';
	}

	// ===== Message Methods (operate on current thread) =====

	getMessages() {
		const thread = this.getCurrentThread();
		if (!thread) return [];
		return thread.messages.slice();
	}

	addMessage(afterId) {
		const thread = this.getCurrentThread();
		if (!thread) return null;

		const msg = {
			id: this.#generateId(),
			sender: 'self',
			message: '',
			timestamp: new Date().toISOString(),
		};

		if (!afterId) {
			thread.messages.push(msg);
		} else {
			const idx = thread.messages.findIndex((m) => m.id === afterId);
			if (idx === -1) thread.messages.push(msg);
			else thread.messages.splice(idx + 1, 0, msg);
		}

		thread.updatedAt = new Date().toISOString();
		this.#scheduleSave();
		this.#emitChange('add', msg);
		return msg;
	}

	updateMessage(id, patch) {
		const thread = this.getCurrentThread();
		if (!thread) return;

		const idx = thread.messages.findIndex((m) => m.id === id);
		if (idx === -1) return;

		thread.messages[idx] = { ...thread.messages[idx], ...patch };
		thread.updatedAt = new Date().toISOString();
		this.#scheduleSave();
		this.#emitChange('update', thread.messages[idx]);
	}

	deleteMessage(id) {
		const thread = this.getCurrentThread();
		if (!thread) return;

		const idx = thread.messages.findIndex((m) => m.id === id);
		if (idx === -1) return;

		const removed = thread.messages.splice(idx, 1)[0];
		thread.updatedAt = new Date().toISOString();
		this.#scheduleSave();
		this.#emitChange('delete', removed);
	}

	insertImage(id, dataUrl) {
		if (!dataUrl) return;
		const thread = this.getCurrentThread();
		if (!thread) return;

		const idx = thread.messages.findIndex((m) => m.id === id);
		if (idx === -1) return;

		const msg = thread.messages[idx];
		const images = Array.isArray(msg.images) ? msg.images.slice() : [];
		images.push({ id: this.#generateId(), src: dataUrl });
		thread.messages[idx] = { ...msg, images };
		thread.updatedAt = new Date().toISOString();
		this.#scheduleSave();
		this.#emitChange('update', thread.messages[idx]);
	}

	// ===== Recipient Methods (operate on current thread) =====

	getRecipient() {
		const thread = this.getCurrentThread();
		if (!thread) return { ...DEFAULT_RECIPIENT };
		return { ...thread.recipient };
	}

	updateRecipient(patch) {
		if (!patch || typeof patch !== 'object') return;
		const thread = this.getCurrentThread();
		if (!thread) return;

		const next = { ...thread.recipient };
		if (Object.prototype.hasOwnProperty.call(patch, 'name')) {
			next.name = String(patch.name ?? '').trim();
		}
		if (Object.prototype.hasOwnProperty.call(patch, 'location')) {
			next.location = String(patch.location ?? '').trim();
		}

		if (
			next.name === thread.recipient.name &&
			next.location === thread.recipient.location
		)
			return;

		thread.recipient = next;
		thread.updatedAt = new Date().toISOString();
		this.#scheduleSave();
		this.#emitChange('recipient');
	}

	// ===== Clear (clears current thread messages) =====

	clear() {
		const thread = this.getCurrentThread();
		if (!thread) return;

		thread.messages = this.#withIdsAndTimestamps(DEFAULT_MESSAGES);
		thread.updatedAt = new Date().toISOString();
		this.#scheduleSave();
		this.#emitChange('clear');
	}

	// ===== Export/Import (current thread only) =====

	exportJson(pretty = true) {
		const thread = this.getCurrentThread();
		if (!thread) return '{}';

		const payload = {
			version: CURRENT_SCHEMA_VERSION,
			messages: thread.messages,
			recipient: thread.recipient,
		};
		return pretty ? JSON.stringify(payload, null, 2) : JSON.stringify(payload);
	}

	importJson(json) {
		let parsed;
		try {
			parsed = typeof json === 'string' ? JSON.parse(json) : json;
		} catch (_e) {
			return console.error('Invalid JSON');
		}

		const importedRecipient =
			parsed &&
			typeof parsed === 'object' &&
			parsed.recipient &&
			typeof parsed.recipient === 'object'
				? parsed.recipient
				: null;

		let imported = Array.isArray(parsed)
			? parsed
			: parsed && Array.isArray(parsed.messages)
				? parsed.messages
				: null;

		if (!imported) {
			return console.error('Invalid format');
		}

		imported = imported
			.map((m) => {
				if (m && typeof m.timestamp === 'number') {
					return { ...m, timestamp: new Date(m.timestamp).toISOString() };
				}
				return m;
			})
			.filter(this.#isValidMessage.bind(this));

		this.#ensureMessageIds(imported);
		this.#ensureMessageTimestamps(imported);

		// Create a new thread for the imported data
		const newThread = this.createThread();
		newThread.messages = imported;

		if (importedRecipient) {
			const next = { ...newThread.recipient };
			if (typeof importedRecipient.name === 'string')
				next.name = importedRecipient.name.trim();
			if (typeof importedRecipient.location === 'string')
				next.location = importedRecipient.location.trim();
			newThread.recipient = next;
		}

		newThread.updatedAt = new Date().toISOString();

		// Make the new thread active
		this.loadThread(newThread.id);

		this.#scheduleSave();
		this.#emitChange('import');

		return newThread;
	}

	// ===== Private Methods =====

	#createDefaultThread() {
		return {
			id: this.#generateId(),
			name: undefined,
			messages: this.#withIdsAndTimestamps(DEFAULT_MESSAGES),
			recipient: { ...DEFAULT_RECIPIENT },
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};
	}

	#scheduleSave() {
		if (this.#saveDebounceId) cancelAnimationFrame(this.#saveDebounceId);
		this.#saveDebounceId = requestAnimationFrame(() => {
			this.save();
			this.#saveDebounceId = null;
		});
	}

	#emitChange(reason, message = null, threadId = null) {
		const thread = this.getCurrentThread();
		this.dispatchEvent(
			new CustomEvent('messages:changed', {
				detail: {
					reason,
					message,
					messages: thread ? thread.messages.slice() : [],
					recipient: thread
						? { ...thread.recipient }
						: { ...DEFAULT_RECIPIENT },
					threadId: threadId || this.#currentThreadId,
				},
				bubbles: false,
				composed: false,
			}),
		);
	}

	#generateId() {
		try {
			if (
				typeof window !== 'undefined' &&
				window.crypto &&
				typeof window.crypto.randomUUID === 'function'
			) {
				return window.crypto.randomUUID();
			}
		} catch (_e) {}
		return (
			'id_' +
			Date.now().toString(36) +
			'_' +
			Math.random().toString(36).slice(2, 10)
		);
	}

	#withIdsAndTimestamps(arr) {
		const now = Date.now();
		return arr.map((m, i) => ({
			id: this.#generateId(),
			sender: m.sender === 'self' || m.sender === 'other' ? m.sender : 'self',
			message: typeof m.message === 'string' ? m.message : '',
			timestamp: new Date(now + i * 1000).toISOString(),
		}));
	}

	#isValidThread(thread) {
		if (!thread || typeof thread !== 'object') return false;
		if (typeof thread.id !== 'string' || thread.id.length === 0) return false;
		if (!Array.isArray(thread.messages)) return false;
		if (!thread.recipient || typeof thread.recipient !== 'object') return false;
		if (typeof thread.createdAt !== 'string') return false;
		if (typeof thread.updatedAt !== 'string') return false;
		return true;
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

	#ensureMessageTimestamps(messages) {
		let changed = false;
		const base = Date.now();
		for (let i = 0; i < messages.length; i++) {
			const m = messages[i];
			if (!m || typeof m !== 'object') continue;
			if (!Object.prototype.hasOwnProperty.call(m, 'timestamp')) {
				m.timestamp = new Date(base + i * 1000).toISOString();
				changed = true;
				continue;
			}
			if (
				m.timestamp === undefined ||
				m.timestamp === null ||
				m.timestamp === ''
			) {
				m.timestamp = new Date(base + i * 1000).toISOString();
				changed = true;
			}
		}
		return changed;
	}
}

const store = new ThreadStore();
export { store, ThreadStore, THREADS_STORAGE_KEY, CURRENT_SCHEMA_VERSION };
