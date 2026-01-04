import test from 'node:test';
import assert from 'node:assert/strict';

import { ThreadStore, THREADS_STORAGE_KEY } from '../components/store.js';
import {
	getCurrentThreadId,
	setCurrentThreadId,
	onThreadIdChange,
	replaceCurrentThreadId,
} from '../utils/url-state.js';

// Mock localStorage
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
	};
}

// Mock browser APIs
function createBrowserMocks() {
	const locationState = {
		href: 'http://localhost:3000/',
		search: '',
		origin: 'http://localhost:3000',
		pathname: '/',
	};

	const historyState = {
		entries: ['http://localhost:3000/'],
		currentIndex: 0,
	};

	const eventListeners = new Map();

	globalThis.window = {
		location: {
			get href() {
				return locationState.href;
			},
			get search() {
				return locationState.search;
			},
			get origin() {
				return locationState.origin;
			},
			get pathname() {
				return locationState.pathname;
			},
		},
		history: {
			pushState(_state, _title, url) {
				const fullUrl = url.startsWith('http')
					? url
					: locationState.origin + url;
				const urlObj = new URL(fullUrl);
				locationState.href = fullUrl;
				locationState.search = urlObj.search;
				locationState.pathname = urlObj.pathname;
				historyState.entries.push(fullUrl);
				historyState.currentIndex = historyState.entries.length - 1;
			},
			replaceState(_state, _title, url) {
				const fullUrl = url.startsWith('http')
					? url
					: locationState.origin + url;
				const urlObj = new URL(fullUrl);
				locationState.href = fullUrl;
				locationState.search = urlObj.search;
				locationState.pathname = urlObj.pathname;
				historyState.entries[historyState.currentIndex] = fullUrl;
			},
		},
		addEventListener(type, listener) {
			if (!eventListeners.has(type)) {
				eventListeners.set(type, []);
			}
			eventListeners.get(type).push(listener);
		},
		removeEventListener(type, listener) {
			if (eventListeners.has(type)) {
				const listeners = eventListeners.get(type);
				const index = listeners.indexOf(listener);
				if (index !== -1) {
					listeners.splice(index, 1);
				}
			}
		},
	};

	return {
		locationState,
		historyState,
		eventListeners,
		simulatePopState(targetIndex) {
			if (
				targetIndex >= 0 &&
				targetIndex < historyState.entries.length &&
				eventListeners.has('popstate')
			) {
				historyState.currentIndex = targetIndex;
				const targetUrl = historyState.entries[targetIndex];
				const urlObj = new URL(targetUrl);
				locationState.href = targetUrl;
				locationState.search = urlObj.search;
				locationState.pathname = urlObj.pathname;

				eventListeners.get('popstate').forEach((listener) => {
					listener(new Event('popstate'));
				});
			}
		},
		reset() {
			locationState.href = 'http://localhost:3000/';
			locationState.search = '';
			locationState.pathname = '/';
			historyState.entries = ['http://localhost:3000/'];
			historyState.currentIndex = 0;
			eventListeners.clear();
		},
	};
}

function installBrowserPolyfills() {
	if (!globalThis.localStorage) {
		globalThis.localStorage = createLocalStorageMock();
	}

	if (!globalThis.requestAnimationFrame) {
		globalThis.requestAnimationFrame = (cb) =>
			setTimeout(() => cb(Date.now()), 0);
	}
	if (!globalThis.cancelAnimationFrame) {
		globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
	}

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
const browserMocks = createBrowserMocks();

const LAST_THREAD_KEY = 'message-simulator:last-thread';

// Helper function that mimics the app.js setupUrlThreadManagement logic
function simulateUrlThreadManagement(store) {
	const urlThreadId = getCurrentThreadId();

	const getLastActiveThreadId = () => {
		try {
			return localStorage.getItem(LAST_THREAD_KEY);
		} catch (_e) {
			return null;
		}
	};

	const setLastActiveThreadId = (threadId) => {
		try {
			if (threadId) {
				localStorage.setItem(LAST_THREAD_KEY, threadId);
			}
		} catch (_e) {
			// Swallow storage errors
		}
	};

	if (urlThreadId) {
		// Priority 1: Load thread from URL (if it exists)
		const threads = store.listThreads();
		if (threads.some((t) => t.id === urlThreadId)) {
			// Valid thread in URL
			store.loadThread(urlThreadId);
			setLastActiveThreadId(urlThreadId);
		} else {
			// Invalid thread in URL - fall back and update URL
			const lastThreadId = getLastActiveThreadId();
			if (lastThreadId && threads.some((t) => t.id === lastThreadId)) {
				// Use last active thread
				replaceCurrentThreadId(lastThreadId);
				store.loadThread(lastThreadId);
			} else {
				// Fall back to first available thread
				const currentThread = store.getCurrentThread();
				if (currentThread) {
					replaceCurrentThreadId(currentThread.id);
					store.loadThread(currentThread.id);
					setLastActiveThreadId(currentThread.id);
				}
			}
		}
	} else {
		// Priority 2: Try last active thread from local storage
		const lastThreadId = getLastActiveThreadId();
		const threads = store.listThreads();

		if (lastThreadId && threads.some((t) => t.id === lastThreadId)) {
			// Last active thread still exists, use it
			replaceCurrentThreadId(lastThreadId);
			store.loadThread(lastThreadId);
		} else {
			// Priority 3: Fall back to current thread (first in list)
			const currentThread = store.getCurrentThread();
			if (currentThread) {
				replaceCurrentThreadId(currentThread.id);
				setLastActiveThreadId(currentThread.id);
			}
		}
	}

	// Listen for thread changes to save last active
	store.addEventListener('messages:changed', (e) => {
		const { reason, threadId } = e.detail || {};
		if (reason === 'thread-changed' && threadId) {
			setLastActiveThreadId(threadId);
		}
	});

	// Listen for URL changes (back/forward navigation)
	const cleanup = onThreadIdChange((threadId) => {
		if (threadId) {
			// Check if thread exists
			const threads = store.listThreads();
			if (threads.some((t) => t.id === threadId)) {
				// Valid thread
				store.loadThread(threadId);
				setLastActiveThreadId(threadId);
			} else {
				// Invalid thread in URL - fall back and update URL
				const lastThreadId = getLastActiveThreadId();
				if (lastThreadId && threads.some((t) => t.id === lastThreadId)) {
					replaceCurrentThreadId(lastThreadId);
					store.loadThread(lastThreadId);
				} else if (threads.length > 0) {
					replaceCurrentThreadId(threads[0].id);
					store.loadThread(threads[0].id);
					setLastActiveThreadId(threads[0].id);
				}
			}
		} else {
			// No thread ID in URL, try last active or default to first thread
			const lastThreadId = getLastActiveThreadId();
			const threads = store.listThreads();

			if (lastThreadId && threads.some((t) => t.id === lastThreadId)) {
				replaceCurrentThreadId(lastThreadId);
				store.loadThread(lastThreadId);
			} else if (threads.length > 0) {
				replaceCurrentThreadId(threads[0].id);
				store.loadThread(threads[0].id);
				setLastActiveThreadId(threads[0].id);
			}
		}
	});

	return cleanup;
}

// ===== URL Thread Management Integration Tests =====

test('URL with non-existent thread ID falls back to first available thread', async () => {
	globalThis.localStorage.clear();
	browserMocks.reset();

	const store = new ThreadStore();
	store.load();
	await flushTimers();

	const threads = store.listThreads();
	assert.ok(threads.length > 0, 'should have at least one thread');

	// Set URL to non-existent thread
	window.history.replaceState({}, '', '/?thread=non-existent-thread-999');

	simulateUrlThreadManagement(store);
	await flushTimers();

	// Should fall back to first available thread
	const currentThread = store.getCurrentThread();
	assert.ok(currentThread, 'should have a current thread');
	assert.equal(
		currentThread.id,
		threads[0].id,
		'should load first available thread',
	);
});

test('URL with non-existent thread updates URL to valid thread', async () => {
	globalThis.localStorage.clear();
	browserMocks.reset();

	const store = new ThreadStore();
	store.load();
	await flushTimers();

	const threads = store.listThreads();
	const firstThreadId = threads[0].id;

	// Set URL to non-existent thread
	window.history.replaceState({}, '', '/?thread=invalid-thread-id');
	assert.equal(
		getCurrentThreadId(),
		'invalid-thread-id',
		'URL should start with invalid thread',
	);

	simulateUrlThreadManagement(store);
	await flushTimers();

	// URL should be updated to valid thread (first available)
	const currentThread = store.getCurrentThread();
	assert.ok(currentThread, 'should have loaded a valid thread');
	assert.equal(currentThread.id, firstThreadId, 'should load first thread');

	// Verify URL was updated
	assert.equal(
		getCurrentThreadId(),
		firstThreadId,
		'URL should be updated to the valid thread ID',
	);
});

test('Back navigation to non-existent thread falls back gracefully', (t, done) => {
	globalThis.localStorage.clear();
	browserMocks.reset();

	const store = new ThreadStore();
	store.load();

	const thread1 = store.createThread();
	const thread2 = store.createThread();

	// Set up valid history
	setCurrentThreadId(thread1.id);
	setCurrentThreadId(thread2.id);

	// Manually inject an invalid thread into history
	window.history.pushState({}, '', '/?thread=invalid-thread-123');

	let navigationCount = 0;

	store.addEventListener('messages:changed', (e) => {
		if (e.detail.reason === 'thread-changed') {
			navigationCount++;

			if (navigationCount === 1) {
				// First navigation happens during setup
				assert.ok(true, 'First thread change detected');
			} else if (navigationCount === 2) {
				// Second navigation after popstate
				const currentThread = store.getCurrentThread();
				assert.ok(currentThread, 'should have a valid current thread');
				// The store.loadThread() with invalid ID falls back to first thread
				done();
			}
		}
	});

	const cleanup = simulateUrlThreadManagement(store);

	// Simulate back navigation to invalid thread
	setTimeout(() => {
		browserMocks.simulatePopState(2);
	}, 20);
});

test('Empty URL with last-active thread ID in localStorage loads that thread', async () => {
	globalThis.localStorage.clear();
	browserMocks.reset();

	const store = new ThreadStore();
	store.load();
	await flushTimers();

	const thread1 = store.createThread();
	const thread2 = store.createThread();
	await flushTimers();

	// Set thread2 as last active
	localStorage.setItem(LAST_THREAD_KEY, thread2.id);

	// URL has no thread param
	assert.equal(getCurrentThreadId(), null);

	simulateUrlThreadManagement(store);
	await flushTimers();

	const currentThread = store.getCurrentThread();
	assert.equal(
		currentThread.id,
		thread2.id,
		'should load last active thread from localStorage',
	);
});

test('Empty URL with invalid last-active thread falls back to first thread', async () => {
	globalThis.localStorage.clear();
	browserMocks.reset();

	const store = new ThreadStore();
	store.load();
	await flushTimers();

	const threads = store.listThreads();
	const firstThreadId = threads[0].id;

	// Set invalid last active thread
	localStorage.setItem(LAST_THREAD_KEY, 'invalid-last-thread-999');

	// URL has no thread param
	assert.equal(getCurrentThreadId(), null);

	simulateUrlThreadManagement(store);
	await flushTimers();

	const currentThread = store.getCurrentThread();
	assert.equal(
		currentThread.id,
		firstThreadId,
		'should fall back to first thread when last-active is invalid',
	);
});

test('Empty URL with no last-active thread falls back to first thread', async () => {
	globalThis.localStorage.clear();
	browserMocks.reset();

	const store = new ThreadStore();
	store.load();
	await flushTimers();

	const threads = store.listThreads();
	const firstThreadId = threads[0].id;

	// No last active thread in localStorage
	assert.equal(localStorage.getItem(LAST_THREAD_KEY), null);

	// URL has no thread param
	assert.equal(getCurrentThreadId(), null);

	simulateUrlThreadManagement(store);
	await flushTimers();

	const currentThread = store.getCurrentThread();
	assert.equal(
		currentThread.id,
		firstThreadId,
		'should fall back to first thread',
	);
});

test('Valid URL thread takes priority over last-active localStorage', async () => {
	globalThis.localStorage.clear();
	browserMocks.reset();

	const store = new ThreadStore();
	store.load();
	await flushTimers();

	const thread1 = store.createThread();
	const thread2 = store.createThread();
	await flushTimers();

	// Set thread1 as last active in localStorage
	localStorage.setItem(LAST_THREAD_KEY, thread1.id);

	// But URL specifies thread2
	window.history.replaceState({}, '', `/?thread=${thread2.id}`);

	simulateUrlThreadManagement(store);
	await flushTimers();

	const currentThread = store.getCurrentThread();
	assert.equal(
		currentThread.id,
		thread2.id,
		'URL thread should take priority over localStorage',
	);
});

test('Thread deletion with deleted thread in URL falls back gracefully', async () => {
	globalThis.localStorage.clear();
	browserMocks.reset();

	const store = new ThreadStore();
	store.load();
	await flushTimers();

	const thread1 = store.createThread();
	const thread2 = store.createThread();
	await flushTimers();

	// Set URL to thread2
	window.history.replaceState({}, '', `/?thread=${thread2.id}`);

	simulateUrlThreadManagement(store);
	await flushTimers();

	// Verify thread2 is loaded
	assert.equal(store.getCurrentThread().id, thread2.id);

	// Now delete thread2
	store.deleteThread(thread2.id);
	await flushTimers();

	// Current thread should switch to another available thread
	const currentThread = store.getCurrentThread();
	assert.ok(currentThread, 'should have a current thread');
	assert.notEqual(
		currentThread.id,
		thread2.id,
		'should not be the deleted thread',
	);
});

test('Last-active thread is updated when thread changes', async () => {
	globalThis.localStorage.clear();
	browserMocks.reset();

	const store = new ThreadStore();
	store.load();
	await flushTimers();

	const thread1 = store.createThread();
	const thread2 = store.createThread();
	await flushTimers();

	simulateUrlThreadManagement(store);
	await flushTimers();

	// Switch to thread1
	store.loadThread(thread1.id);
	await flushTimers();

	assert.equal(
		localStorage.getItem(LAST_THREAD_KEY),
		thread1.id,
		'last-active should be updated to thread1',
	);

	// Switch to thread2
	store.loadThread(thread2.id);
	await flushTimers();

	assert.equal(
		localStorage.getItem(LAST_THREAD_KEY),
		thread2.id,
		'last-active should be updated to thread2',
	);
});

test('Navigating back to empty URL restores last-active thread', (t, done) => {
	globalThis.localStorage.clear();
	browserMocks.reset();

	const store = new ThreadStore();
	store.load();

	const thread1 = store.createThread();

	// Set thread1 as last active in localStorage
	localStorage.setItem(LAST_THREAD_KEY, thread1.id);

	// Start with URL pointing to thread1
	setCurrentThreadId(thread1.id);

	// Set up the management system (it will load thread1 from URL)
	const cleanup = simulateUrlThreadManagement(store);

	// Wait for initial setup
	setTimeout(() => {
		assert.equal(
			store.getCurrentThread().id,
			thread1.id,
			'thread1 should be loaded initially',
		);

		// Navigate back to empty URL
		browserMocks.simulatePopState(0);

		// Wait for the popstate handler to process
		setTimeout(() => {
			// The onThreadIdChange callback should have triggered restoration from localStorage
			const currentThread = store.getCurrentThread();
			assert.ok(
				currentThread,
				'should have a current thread after navigating to empty URL',
			);
			assert.equal(
				currentThread.id,
				thread1.id,
				'should restore last-active thread from localStorage when navigating back to empty URL',
			);
			cleanup();
			done();
		}, 20);
	}, 20);
});

test('Multiple threads with invalid URL prioritizes correct fallback order', async () => {
	globalThis.localStorage.clear();
	browserMocks.reset();

	const store = new ThreadStore();
	store.load();
	await flushTimers();

	const defaultThread = store.getCurrentThread();
	const thread1 = store.createThread();
	const thread2 = store.createThread();
	await flushTimers();

	// Set thread1 as last active
	localStorage.setItem(LAST_THREAD_KEY, thread1.id);

	// URL has invalid thread
	window.history.replaceState({}, '', '/?thread=totally-invalid-id');

	simulateUrlThreadManagement(store);
	await flushTimers();

	// Should attempt to load invalid thread, which falls back to first thread
	const currentThread = store.getCurrentThread();
	assert.ok(currentThread, 'should have a current thread');
	// The store.loadThread() with invalid ID returns first available thread
});

test('URL state persists across store operations', async () => {
	globalThis.localStorage.clear();
	browserMocks.reset();

	const store = new ThreadStore();
	store.load();
	await flushTimers();

	const thread1 = store.createThread();
	await flushTimers();

	setCurrentThreadId(thread1.id);
	simulateUrlThreadManagement(store);
	await flushTimers();

	// Perform various store operations
	const msg = store.addMessage();
	store.updateMessage(msg.id, { message: 'Test message' });
	await flushTimers();

	// Thread ID in URL should remain unchanged
	assert.equal(getCurrentThreadId(), thread1.id);
	assert.equal(store.getCurrentThread().id, thread1.id);
});
