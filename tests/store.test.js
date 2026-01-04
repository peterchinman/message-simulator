import test from 'node:test';
import assert from 'node:assert/strict';

import {
	ThreadStore,
	THREADS_STORAGE_KEY,
	CURRENT_SCHEMA_VERSION,
} from '../components/store.js';

function createLocalStorageMock() {
	let map = new Map();
	return {
		clear() {
			map = new Map();
		},
		getItem(key) {
			return map.has(String(key)) ? map.get(String(key)) : null;
		},
		setItem(key, value) {
			map.set(String(key), String(value));
		},
		removeItem(key) {
			map.delete(String(key));
		},
		_dump() {
			return new Map(map);
		},
	};
}

function installBrowserPolyfills() {
	if (!globalThis.localStorage)
		globalThis.localStorage = createLocalStorageMock();

	// Store uses rAF for debounced saves.
	if (!globalThis.requestAnimationFrame) {
		globalThis.requestAnimationFrame = (cb) =>
			setTimeout(() => cb(Date.now()), 0);
	}
	if (!globalThis.cancelAnimationFrame) {
		globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
	}

	// Node supports CustomEvent in newer versions; define a minimal fallback if missing.
	if (!globalThis.CustomEvent) {
		globalThis.CustomEvent = class CustomEvent extends Event {
			constructor(type, params) {
				super(type, params);
				this.detail = params && 'detail' in params ? params.detail : undefined;
			}
		};
	}
}

function flushTimers() {
	return new Promise((r) => setTimeout(r, 10));
}

installBrowserPolyfills();

// ===== Thread Management Tests =====

test('load() with empty storage creates default thread and persists', async () => {
	globalThis.localStorage.clear();
	const s = new ThreadStore();

	let lastEvent = null;
	s.addEventListener('messages:changed', (e) => {
		lastEvent = e;
	});

	s.load();
	await flushTimers();

	const threads = s.listThreads();
	assert.equal(threads.length, 1, 'should have exactly one thread');

	const thread = threads[0];
	assert.ok(
		typeof thread.id === 'string' && thread.id.length > 0,
		'thread should have id',
	);
	assert.ok(
		Array.isArray(thread.messages),
		'thread should have messages array',
	);
	assert.ok(thread.messages.length > 0, 'thread should have default messages');
	assert.ok(
		thread.recipient && typeof thread.recipient === 'object',
		'thread should have recipient',
	);
	assert.equal(
		typeof thread.createdAt,
		'string',
		'thread should have createdAt',
	);
	assert.equal(
		typeof thread.updatedAt,
		'string',
		'thread should have updatedAt',
	);

	assert.ok(lastEvent, 'should emit messages:changed event');
	assert.equal(lastEvent.detail.reason, 'init-defaults');

	const raw = globalThis.localStorage.getItem(THREADS_STORAGE_KEY);
	assert.ok(raw, 'should persist to localStorage');
	const parsed = JSON.parse(raw);
	assert.equal(parsed.version, CURRENT_SCHEMA_VERSION);
	assert.ok(Array.isArray(parsed.threads));
	assert.equal(parsed.threads.length, 1);
});

test('createThread() generates unique ID and returns thread object', async () => {
	globalThis.localStorage.clear();
	const s = new ThreadStore();
	s.load();

	const thread1 = s.createThread();
	const thread2 = s.createThread();

	assert.ok(thread1.id !== thread2.id, 'threads should have unique IDs');
	assert.ok(Array.isArray(thread1.messages), 'thread should have messages');
	assert.ok(thread1.recipient, 'thread should have recipient');
	assert.equal(typeof thread1.createdAt, 'string', 'should have createdAt');
	assert.equal(typeof thread1.updatedAt, 'string', 'should have updatedAt');
	assert.equal(
		thread1.name,
		undefined,
		'new thread should have no custom name',
	);

	await flushTimers();

	const threads = s.listThreads();
	assert.equal(
		threads.length,
		3,
		'should have 3 threads (1 default + 2 created)',
	);
});

test('duplicateThread() creates copy with new ID', async () => {
	globalThis.localStorage.clear();
	const s = new ThreadStore();
	s.load();
	await flushTimers();

	const threads = s.listThreads();
	const original = threads[0];

	const copy = s.duplicateThread(original.id);
	await flushTimers();

	assert.ok(copy, 'should return duplicated thread');
	assert.ok(copy.id !== original.id, 'copy should have different ID');
	assert.equal(
		copy.messages.length,
		original.messages.length,
		'should copy all messages',
	);
	assert.deepEqual(copy.recipient, original.recipient, 'should copy recipient');

	const allThreads = s.listThreads();
	assert.equal(allThreads.length, 2, 'should have 2 threads');
});

test('duplicateThread() returns null for non-existent thread', () => {
	globalThis.localStorage.clear();
	const s = new ThreadStore();
	s.load();

	const result = s.duplicateThread('non-existent-id');
	assert.equal(result, null);
});

test('deleteThread() removes thread from storage', async () => {
	globalThis.localStorage.clear();
	const s = new ThreadStore();
	s.load();

	const thread1 = s.createThread();
	const thread2 = s.createThread();
	await flushTimers();

	assert.equal(s.listThreads().length, 3, 'should have 3 threads');

	const result = s.deleteThread(thread1.id);
	assert.equal(result, true, 'delete should return true');
	await flushTimers();

	const remaining = s.listThreads();
	assert.equal(remaining.length, 2, 'should have 2 threads remaining');
	assert.ok(
		!remaining.some((t) => t.id === thread1.id),
		'deleted thread should not exist',
	);
});

test('deleteThread() returns false for non-existent thread', () => {
	globalThis.localStorage.clear();
	const s = new ThreadStore();
	s.load();

	const result = s.deleteThread('non-existent-id');
	assert.equal(result, false);
});

test('deleteThread() on last thread creates new default thread', async () => {
	globalThis.localStorage.clear();
	const s = new ThreadStore();
	s.load();
	await flushTimers();

	const threads = s.listThreads();
	assert.equal(threads.length, 1, 'should start with 1 default thread');

	const onlyThreadId = threads[0].id;
	const result = s.deleteThread(onlyThreadId);
	assert.equal(result, true, 'delete should succeed');
	await flushTimers();

	const remainingThreads = s.listThreads();
	assert.equal(remainingThreads.length, 1, 'should have exactly 1 thread');
	assert.ok(
		remainingThreads[0].id !== onlyThreadId,
		'should be a new thread with different ID',
	);
	assert.ok(
		Array.isArray(remainingThreads[0].messages),
		'new thread should have messages',
	);
	assert.ok(
		remainingThreads[0].messages.length > 0,
		'new thread should have default messages',
	);

	const currentThread = s.getCurrentThread();
	assert.equal(
		currentThread.id,
		remainingThreads[0].id,
		'new thread should be active',
	);
});

test('loadThread() switches active thread and emits event', async () => {
	globalThis.localStorage.clear();
	const s = new ThreadStore();
	s.load();

	const thread1 = s.createThread();
	const thread2 = s.createThread();

	let events = [];
	s.addEventListener('messages:changed', (e) => {
		if (e.detail.reason === 'thread-changed') {
			events.push(e.detail);
		}
	});

	const loaded = s.loadThread(thread2.id);
	assert.equal(loaded.id, thread2.id, 'should return loaded thread');
	assert.equal(
		s.getCurrentThread().id,
		thread2.id,
		'current thread should be updated',
	);

	await flushTimers();
	assert.ok(events.length > 0, 'should emit thread-changed event');
	assert.equal(events[0].threadId, thread2.id);
});

test('loadThread() handles non-existent thread gracefully', () => {
	globalThis.localStorage.clear();
	const s = new ThreadStore();
	s.load();

	const result = s.loadThread('non-existent-id');
	assert.ok(result, 'should return a valid thread');
	assert.ok(s.getCurrentThread(), 'should have a current thread');
});

test('listThreads() returns sorted by updatedAt descending', async () => {
	globalThis.localStorage.clear();
	const s = new ThreadStore();
	s.load();

	const thread1 = s.createThread();
	await flushTimers();

	// Wait a bit to ensure different timestamps
	await new Promise((r) => setTimeout(r, 10));

	const thread2 = s.createThread();
	await flushTimers();

	const threads = s.listThreads();
	assert.equal(threads.length, 3);

	// Most recent should be first
	const timestamps = threads.map((t) => new Date(t.updatedAt).getTime());
	for (let i = 0; i < timestamps.length - 1; i++) {
		assert.ok(
			timestamps[i] >= timestamps[i + 1],
			'threads should be sorted by updatedAt descending',
		);
	}
});

test('getCurrentThread() returns active thread state', () => {
	globalThis.localStorage.clear();
	const s = new ThreadStore();
	s.load();

	const current = s.getCurrentThread();
	assert.ok(current, 'should return current thread');
	assert.ok(current.id, 'current thread should have id');
	assert.ok(Array.isArray(current.messages), 'should have messages');
});

test('updateThreadName() sets or clears custom thread name', async () => {
	globalThis.localStorage.clear();
	const s = new ThreadStore();
	s.load();

	const threads = s.listThreads();
	const thread = threads[0];

	s.updateThreadName(thread.id, '  My Custom Name  ');
	await flushTimers();

	const updated = s.listThreads().find((t) => t.id === thread.id);
	assert.equal(updated.name, 'My Custom Name', 'should trim and set name');

	s.updateThreadName(thread.id, '   ');
	await flushTimers();

	const cleared = s.listThreads().find((t) => t.id === thread.id);
	assert.equal(cleared.name, undefined, 'empty string should clear name');
});

test('getThreadDisplayName() returns name or falls back to recipient name', () => {
	globalThis.localStorage.clear();
	const s = new ThreadStore();
	s.load();

	const thread1 = s.createThread();
	assert.equal(
		s.getThreadDisplayName(thread1),
		thread1.recipient.name,
		'should fall back to recipient name',
	);

	s.updateThreadName(thread1.id, 'Custom Name');
	const updated = s.listThreads().find((t) => t.id === thread1.id);
	assert.equal(
		s.getThreadDisplayName(updated),
		'Custom Name',
		'should return custom name',
	);
});

// ===== Message Methods Tests =====

test('add/update/delete message modifies current thread and emits events', async () => {
	globalThis.localStorage.clear();
	const s = new ThreadStore();
	s.load();

	const events = [];
	s.addEventListener('messages:changed', (e) => events.push(e.detail.reason));

	const created = s.addMessage();
	assert.equal(created.sender, 'self');
	assert.equal(created.message, '');

	s.updateMessage(created.id, { message: 'hello', sender: 'other' });
	let afterUpdate = s.getMessages().find((m) => m.id === created.id);
	assert.equal(afterUpdate.message, 'hello');
	assert.equal(afterUpdate.sender, 'other');

	s.deleteMessage(created.id);
	assert.equal(
		s.getMessages().some((m) => m.id === created.id),
		false,
	);

	await flushTimers();
	assert.ok(events.includes('add'));
	assert.ok(events.includes('update'));
	assert.ok(events.includes('delete'));
});

test('insertImage() appends to images[] in current thread', async () => {
	globalThis.localStorage.clear();
	const s = new ThreadStore();
	s.load();

	const created = s.addMessage();
	s.insertImage(created.id, 'data:image/png;base64,abc');
	await flushTimers();

	const msg = s.getMessages().find((m) => m.id === created.id);
	assert.ok(Array.isArray(msg.images));
	assert.equal(msg.images.length, 1);
	assert.equal(msg.images[0].src, 'data:image/png;base64,abc');
});

test('updateRecipient() updates current thread recipient', async () => {
	globalThis.localStorage.clear();
	const s = new ThreadStore();
	s.load();

	let count = 0;
	s.addEventListener('messages:changed', (e) => {
		if (e.detail.reason === 'recipient') count++;
	});

	const before = s.getRecipient();
	s.updateRecipient({
		name: ` ${before.name} `,
		location: ` ${before.location} `,
	});
	assert.equal(count, 0, 'no-op after trimming should not emit');

	s.updateRecipient({ name: 'Alice' });
	assert.equal(s.getRecipient().name, 'Alice');
	assert.equal(count, 1);

	await flushTimers();
});

test('clear() resets current thread messages to defaults', async () => {
	globalThis.localStorage.clear();
	const s = new ThreadStore();
	s.load();

	const beforeCount = s.getMessages().length;
	const extra = s.addMessage();
	s.updateMessage(extra.id, { message: 'changed', sender: 'other' });

	assert.ok(s.getMessages().length > beforeCount, 'should have added message');

	s.clear();
	await flushTimers();

	assert.equal(
		s.getMessages().length,
		beforeCount,
		'should reset to default count',
	);
});

test('exportJson() exports current thread', () => {
	globalThis.localStorage.clear();
	const s = new ThreadStore();
	s.load();

	const json = s.exportJson(true);
	const parsed = JSON.parse(json);

	assert.equal(parsed.version, CURRENT_SCHEMA_VERSION);
	assert.ok(Array.isArray(parsed.messages));
	assert.ok(parsed.recipient && typeof parsed.recipient === 'object');
});

test('importJson() creates new thread and switches to it', async () => {
	globalThis.localStorage.clear();
	const s = new ThreadStore();
	s.load();
	await flushTimers();

	const originalThreads = s.listThreads();
	assert.equal(originalThreads.length, 1, 'should start with 1 default thread');
	const defaultThreadId = originalThreads[0].id;
	const defaultRecipientName = originalThreads[0].recipient.name;

	// Create additional threads to test switching behavior
	const thread1 = s.createThread();
	const thread2 = s.createThread();
	await flushTimers();

	// Make thread2 the active thread
	s.loadThread(thread2.id);
	assert.equal(
		s.getCurrentThread().id,
		thread2.id,
		'thread2 should be active before import',
	);

	// Import a new thread
	const payload = {
		version: CURRENT_SCHEMA_VERSION,
		recipient: { name: '  Imported User  ', location: '  Tokyo  ' },
		messages: [
			{ sender: 'self', message: 'imported message 1', timestamp: Date.now() },
			{ sender: 'other', message: 'imported message 2' },
			{ sender: 'nope', message: 'bad' }, // invalid sender -> filtered out
		],
	};

	const importedThread = s.importJson(JSON.stringify(payload));
	await flushTimers();

	// Verify import created new thread and switched to it
	assert.ok(importedThread, 'importJson should return the new thread');
	assert.equal(
		s.getCurrentThread().id,
		importedThread.id,
		'imported thread should now be the active thread',
	);
	assert.ok(
		s.getCurrentThread().id !== thread2.id,
		'active thread should have changed from thread2',
	);

	const allThreads = s.listThreads();
	assert.equal(allThreads.length, 4, 'should have 4 threads total');

	// Verify the imported data is in the active thread
	const messages = s.getMessages();
	assert.equal(messages.length, 2, 'should import 2 valid messages');
	assert.ok(messages.every((m) => typeof m.id === 'string' && m.id.length > 0));
	assert.ok(
		messages.every(
			(m) => typeof m.timestamp === 'string' && m.timestamp.length > 0,
		),
	);
	assert.ok(
		messages.some((m) => m.message === 'imported message 1'),
		'should have imported messages',
	);

	const recipient = s.getRecipient();
	assert.equal(recipient.name, 'Imported User', 'should trim recipient name');
	assert.equal(recipient.location, 'Tokyo', 'should trim recipient location');

	// Verify original threads still exist with original data unchanged
	s.loadThread(defaultThreadId);
	const defaultThread = s.getCurrentThread();
	assert.equal(
		defaultThread.recipient.name,
		defaultRecipientName,
		'default thread should be unchanged',
	);
});

test('messages are isolated between threads', async () => {
	globalThis.localStorage.clear();
	const s = new ThreadStore();
	s.load();

	const thread1 = s.getCurrentThread();
	const thread1Id = thread1.id;
	const msg1 = s.addMessage();
	s.updateMessage(msg1.id, { message: 'Thread 1 message' });

	const thread2 = s.createThread();
	s.loadThread(thread2.id);
	const msg2 = s.addMessage();
	s.updateMessage(msg2.id, { message: 'Thread 2 message' });

	await flushTimers();

	// Switch back to thread 1
	s.loadThread(thread1Id);
	const thread1Messages = s.getMessages();
	assert.ok(
		thread1Messages.some((m) => m.message === 'Thread 1 message'),
		'thread 1 should have its message',
	);
	assert.ok(
		!thread1Messages.some((m) => m.message === 'Thread 2 message'),
		'thread 1 should not have thread 2 message',
	);

	// Switch back to thread 2
	s.loadThread(thread2.id);
	const thread2Messages = s.getMessages();
	assert.ok(
		thread2Messages.some((m) => m.message === 'Thread 2 message'),
		'thread 2 should have its message',
	);
	assert.ok(
		!thread2Messages.some((m) => m.message === 'Thread 1 message'),
		'thread 2 should not have thread 1 message',
	);
});
