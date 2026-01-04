import test from 'node:test';
import assert from 'node:assert/strict';

import {
	getCurrentThreadId,
	setCurrentThreadId,
	replaceCurrentThreadId,
	onThreadIdChange,
} from '../utils/url-state.js';

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

	// Helper to simulate back/forward navigation
	const simulatePopState = (targetIndex) => {
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
	};

	return {
		locationState,
		historyState,
		eventListeners,
		simulatePopState,
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

const browserMocks = createBrowserMocks();

// ===== Basic URL State Tests =====

test('getCurrentThreadId() returns null when no thread param', () => {
	browserMocks.reset();
	const threadId = getCurrentThreadId();
	assert.equal(threadId, null);
});

test('getCurrentThreadId() returns thread ID from URL param', () => {
	browserMocks.reset();
	window.history.replaceState({}, '', '/?thread=abc123');
	const threadId = getCurrentThreadId();
	assert.equal(threadId, 'abc123');
});

test('setCurrentThreadId() adds thread param to URL', () => {
	browserMocks.reset();
	setCurrentThreadId('test-thread-1');

	assert.ok(window.location.search.includes('thread=test-thread-1'));
	assert.equal(getCurrentThreadId(), 'test-thread-1');
});

test('setCurrentThreadId() with null removes thread param', () => {
	browserMocks.reset();
	setCurrentThreadId('test-thread-1');
	assert.equal(getCurrentThreadId(), 'test-thread-1');

	setCurrentThreadId(null);
	assert.equal(getCurrentThreadId(), null);
	assert.equal(window.location.search, '');
});

test('replaceCurrentThreadId() updates URL without adding history entry', () => {
	browserMocks.reset();
	const initialLength = browserMocks.historyState.entries.length;

	replaceCurrentThreadId('replaced-thread');

	assert.equal(getCurrentThreadId(), 'replaced-thread');
	assert.equal(
		browserMocks.historyState.entries.length,
		initialLength,
		'should not add new history entry',
	);
});

test('setCurrentThreadId() adds to history stack', () => {
	browserMocks.reset();
	const initialLength = browserMocks.historyState.entries.length;

	setCurrentThreadId('thread-1');
	setCurrentThreadId('thread-2');

	assert.equal(
		browserMocks.historyState.entries.length,
		initialLength + 2,
		'should add 2 history entries',
	);
});

// ===== PopState / Navigation Tests =====

test('onThreadIdChange() fires callback on popstate', (t, done) => {
	browserMocks.reset();

	setCurrentThreadId('thread-1');
	setCurrentThreadId('thread-2');

	// Fail fast if callback doesn't fire within 100ms
	const timeout = setTimeout(() => {
		done(new Error('Callback was never called'));
	}, 100);

	const cleanup = onThreadIdChange((threadId) => {
		clearTimeout(timeout);
		assert.equal(threadId, 'thread-1');
		cleanup();
		done();
	});

	// Simulate back navigation
	browserMocks.simulatePopState(1);
});

test('onThreadIdChange() provides null when navigating to URL without thread', (t, done) => {
	browserMocks.reset();

	setCurrentThreadId('thread-1');

	// Fail fast if callback doesn't fire within 100ms
	const timeout = setTimeout(() => {
		done(new Error('Callback was never called'));
	}, 100);

	const cleanup = onThreadIdChange((threadId) => {
		clearTimeout(timeout);
		assert.equal(threadId, null);
		cleanup();
		done();
	});

	// Simulate back navigation to initial state
	browserMocks.simulatePopState(0);
});

test('onThreadIdChange() cleanup function removes listener', () => {
	browserMocks.reset();

	let callCount = 0;
	const cleanup = onThreadIdChange(() => {
		callCount++;
	});

	// Call cleanup
	cleanup();

	// Simulate navigation - should not trigger callback
	setCurrentThreadId('thread-1');
	browserMocks.simulatePopState(0);

	assert.equal(callCount, 0, 'callback should not be called after cleanup');
});

// ===== Edge Cases and Invalid Thread IDs =====

test('getCurrentThreadId() handles invalid URL formats gracefully', () => {
	browserMocks.reset();

	// Multiple thread params - URLSearchParams returns first one
	window.history.replaceState({}, '', '/?thread=first&thread=second');
	assert.equal(getCurrentThreadId(), 'first');

	// Empty thread param
	window.history.replaceState({}, '', '/?thread=');
	assert.equal(getCurrentThreadId(), '');

	// Thread param with special characters
	window.history.replaceState({}, '', '/?thread=abc%20123');
	assert.equal(getCurrentThreadId(), 'abc 123');
});

test('setCurrentThreadId() preserves other URL params', () => {
	browserMocks.reset();
	window.history.replaceState({}, '', '/?foo=bar&baz=qux');

	setCurrentThreadId('my-thread');

	const url = new URL(window.location.href);
	assert.equal(url.searchParams.get('thread'), 'my-thread');
	assert.equal(url.searchParams.get('foo'), 'bar');
	assert.equal(url.searchParams.get('baz'), 'qux');
});

test('setCurrentThreadId() handles special characters in thread ID', () => {
	browserMocks.reset();

	const specialId = 'thread-with-special-chars-!@#$%';
	setCurrentThreadId(specialId);

	const retrieved = getCurrentThreadId();
	assert.equal(retrieved, specialId);
});

test('replaceCurrentThreadId() preserves other URL params', () => {
	browserMocks.reset();
	window.history.replaceState({}, '', '/?existing=param');

	replaceCurrentThreadId('new-thread');

	const url = new URL(window.location.href);
	assert.equal(url.searchParams.get('thread'), 'new-thread');
	assert.equal(url.searchParams.get('existing'), 'param');
});

// ===== Integration-style Tests for Invalid Thread Scenarios =====

test('Back navigation to invalid thread ID is detected', (t, done) => {
	browserMocks.reset();

	// Set up history: valid -> invalid -> valid
	window.history.replaceState({}, '', '/?thread=valid-1');
	setCurrentThreadId('invalid-thread-999');
	setCurrentThreadId('valid-2');

	// Fail fast if callback doesn't fire within 100ms
	const timeout = setTimeout(() => {
		done(new Error('Callback was never called'));
	}, 100);

	const cleanup = onThreadIdChange((threadId) => {
		clearTimeout(timeout);
		assert.equal(threadId, 'invalid-thread-999');
		assert.ok(threadId, 'callback receives the invalid thread ID from history');
		cleanup();
		done();
	});

	// Navigate back to the invalid thread entry
	browserMocks.simulatePopState(1);
});

test('Forward navigation after going back works correctly', (t, done) => {
	browserMocks.reset();

	setCurrentThreadId('thread-1');
	setCurrentThreadId('thread-2');
	setCurrentThreadId('thread-3');

	// History: [initial(0), thread-1(1), thread-2(2), thread-3(3)]
	// Current position is 3 (thread-3)

	// Fail fast if callback doesn't fire within 100ms
	let timeout = setTimeout(() => {
		done(new Error('First callback was never called'));
	}, 100);

	let callCount = 0;
	const cleanup = onThreadIdChange((threadId) => {
		callCount++;
		if (callCount === 1) {
			clearTimeout(timeout);
			// First navigation: back to thread-2
			assert.equal(threadId, 'thread-2');
			// Reset timeout for second callback
			timeout = setTimeout(() => {
				done(new Error('Second callback was never called'));
			}, 100);
			// Now go forward
			browserMocks.simulatePopState(3);
		} else if (callCount === 2) {
			clearTimeout(timeout);
			// Second navigation: forward to thread-3
			assert.equal(threadId, 'thread-3');
			cleanup();
			done();
		}
	});

	// Go back to thread-2 (index 2)
	browserMocks.simulatePopState(2);
});

test('Multiple rapid URL changes maintain correct state', () => {
	browserMocks.reset();

	const threadIds = ['t1', 't2', 't3', 't4', 't5'];

	threadIds.forEach((id) => setCurrentThreadId(id));

	// Current should be the last one
	assert.equal(getCurrentThreadId(), 't5');

	// History should contain all entries
	assert.equal(browserMocks.historyState.entries.length, threadIds.length + 1); // +1 for initial
});

test('onThreadIdChange() handles rapid popstate events', async () => {
	browserMocks.reset();

	setCurrentThreadId('thread-1');
	setCurrentThreadId('thread-2');
	setCurrentThreadId('thread-3');

	const receivedIds = [];
	const cleanup = onThreadIdChange((threadId) => {
		receivedIds.push(threadId);
	});

	// Simulate rapid navigation
	// History is: [initial(0), thread-1(1), thread-2(2), thread-3(3)]
	browserMocks.simulatePopState(2); // Go to thread-2
	browserMocks.simulatePopState(1); // Go to thread-1
	browserMocks.simulatePopState(0); // Go to initial (no thread)

	// Small delay to ensure all events are processed
	await new Promise((resolve) => setTimeout(resolve, 10));

	assert.equal(receivedIds.length, 3);
	assert.equal(receivedIds[0], 'thread-2');
	assert.equal(receivedIds[1], 'thread-1');
	assert.equal(receivedIds[2], null); // Back to initial state

	cleanup();
});

test('URL state persists across multiple operations', () => {
	browserMocks.reset();

	// Initial set
	setCurrentThreadId('thread-A');
	assert.equal(getCurrentThreadId(), 'thread-A');

	// Replace
	replaceCurrentThreadId('thread-B');
	assert.equal(getCurrentThreadId(), 'thread-B');

	// Set again (adds to history)
	setCurrentThreadId('thread-C');
	assert.equal(getCurrentThreadId(), 'thread-C');

	// Clear
	setCurrentThreadId(null);
	assert.equal(getCurrentThreadId(), null);
});
