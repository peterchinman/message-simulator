import test from 'node:test';
import assert from 'node:assert/strict';

import {
	MessageStore,
	CHAT_STORAGE_KEY,
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
	return new Promise((r) => setTimeout(r, 0));
}

installBrowserPolyfills();

test('load() with empty storage initializes defaults and persists', async () => {
	globalThis.localStorage.clear();
	const s = new MessageStore();

	let lastEvent = null;
	s.addEventListener('messages:changed', (e) => {
		lastEvent = e;
	});

	s.load();
	await flushTimers();

	const messages = s.getMessages();
	assert.ok(Array.isArray(messages));
	assert.ok(messages.length > 0);
	assert.ok(messages.every((m) => typeof m.id === 'string' && m.id.length > 0));
	assert.ok(
		messages.every(
			(m) => typeof m.timestamp === 'string' && m.timestamp.length,
		),
	);

	const recipient = s.getRecipient();
	assert.equal(typeof recipient.name, 'string');
	assert.equal(typeof recipient.location, 'string');

	assert.ok(lastEvent, 'should emit messages:changed event');
	assert.equal(lastEvent.detail.reason, 'init-defaults');

	const raw = globalThis.localStorage.getItem(CHAT_STORAGE_KEY);
	assert.ok(raw, 'should persist to localStorage');
	const parsed = JSON.parse(raw);
	assert.equal(parsed.version, CURRENT_SCHEMA_VERSION);
	assert.ok(Array.isArray(parsed.messages));
	assert.ok(parsed.recipient && typeof parsed.recipient === 'object');
});

test('add/update/delete message modifies state and emits events', async () => {
	globalThis.localStorage.clear();
	const s = new MessageStore();
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

test('insertImage() appends to images[] and persists via debounced save', async () => {
	globalThis.localStorage.clear();
	const s = new MessageStore();
	s.load();

	const created = s.addMessage();
	s.insertImage(created.id, 'data:image/png;base64,abc');
	await flushTimers();

	const msg = s.getMessages().find((m) => m.id === created.id);
	assert.ok(Array.isArray(msg.images));
	assert.equal(msg.images.length, 1);
	assert.equal(msg.images[0].src, 'data:image/png;base64,abc');

	const raw = globalThis.localStorage.getItem(CHAT_STORAGE_KEY);
	assert.ok(raw);
});

test('updateRecipient() trims, ignores no-op updates, and emits on change', async () => {
	globalThis.localStorage.clear();
	const s = new MessageStore();
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

test('exportJson() includes version/messages/recipient', () => {
	globalThis.localStorage.clear();
	const s = new MessageStore();
	s.load();

	const json = s.exportJson(true);
	const parsed = JSON.parse(json);

	assert.equal(parsed.version, CURRENT_SCHEMA_VERSION);
	assert.ok(Array.isArray(parsed.messages));
	assert.ok(parsed.recipient && typeof parsed.recipient === 'object');
});

test('importJson() accepts {messages, recipient}, fixes numeric timestamps, ensures ids, filters invalid', async () => {
	globalThis.localStorage.clear();
	const s = new MessageStore();
	s.load();

	const payload = {
		version: CURRENT_SCHEMA_VERSION,
		recipient: { name: '  Bob  ', location: '  SF  ' },
		messages: [
			{ sender: 'self', message: 'ok', timestamp: Date.now() }, // numeric ts -> ISO
			{ sender: 'other', message: 'yo' }, // missing id/timestamp ok
			{ sender: 'nope', message: 'bad' }, // invalid sender -> filtered out
		],
	};

	s.importJson(JSON.stringify(payload));
	await flushTimers();

	const messages = s.getMessages();
	assert.equal(messages.length, 2);
	assert.ok(messages.every((m) => typeof m.id === 'string' && m.id.length > 0));
	assert.ok(
		messages.every(
			(m) => typeof m.timestamp === 'string' && m.timestamp.length > 0,
		),
	);

	const r = s.getRecipient();
	assert.equal(r.name, 'Bob');
	assert.equal(r.location, 'SF');
});

test('load() migrates schema v1 -> v2 by adding recipient and converting timestamps', async () => {
	globalThis.localStorage.clear();
	const now = Date.now();
	const v1 = {
		version: 1,
		messages: [
			{ id: '', sender: 'self', message: 'a', timestamp: now }, // id/timestamp need fixing
			{ sender: 'other', message: 'b', timestamp: now + 1 },
		],
	};
	globalThis.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(v1));

	const s = new MessageStore();
	s.load();
	await flushTimers();

	const recipient = s.getRecipient();
	assert.equal(typeof recipient.name, 'string');
	assert.equal(typeof recipient.location, 'string');

	const messages = s.getMessages();
	assert.ok(messages.every((m) => typeof m.id === 'string' && m.id.length > 0));
	assert.ok(
		messages.every(
			(m) => typeof m.timestamp === 'string' && m.timestamp.length > 0,
		),
	);

	const raw = globalThis.localStorage.getItem(CHAT_STORAGE_KEY);
	const parsed = JSON.parse(raw);
	assert.equal(parsed.version, CURRENT_SCHEMA_VERSION);
	assert.ok(parsed.recipient, 'recipient should be added during migration');
});

test('clear() resets messages back to defaults and resets recipient', async () => {
	globalThis.localStorage.clear();
	const s = new MessageStore();
	s.load();

	const defaultRecipient = s.getRecipient();
	const defaultMsgShape = s
		.getMessages()
		.map((m) => ({ sender: m.sender, message: m.message }));

	// mutate state away from defaults
	s.updateRecipient({ name: 'Someone Else', location: 'Somewhere' });
	const extra = s.addMessage();
	s.updateMessage(extra.id, { message: 'changed', sender: 'other' });

	s.clear();
	await flushTimers();

	assert.deepEqual(s.getRecipient(), defaultRecipient);
	assert.deepEqual(
		s.getMessages().map((m) => ({ sender: m.sender, message: m.message })),
		defaultMsgShape,
	);
});
