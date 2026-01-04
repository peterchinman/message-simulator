// Main application integration: mode switching, URL handling, navigation
import { store } from './components/store.js';
import {
	getCurrentThreadId,
	setCurrentThreadId,
	onThreadIdChange,
	replaceCurrentThreadId,
} from './utils/url-state.js';

const LAST_THREAD_KEY = 'message-simulator:last-thread';

/**
 * Get the last active thread ID from local storage
 * @returns {string|null}
 */
function getLastActiveThreadId() {
	try {
		return localStorage.getItem(LAST_THREAD_KEY);
	} catch (_e) {
		return null;
	}
}

/**
 * Save the last active thread ID to local storage
 * @param {string} threadId
 */
function setLastActiveThreadId(threadId) {
	try {
		if (threadId) {
			localStorage.setItem(LAST_THREAD_KEY, threadId);
		}
	} catch (_e) {
		// Swallow storage errors
	}
}

// Initialize the app
function init() {
	const appContainer = document.getElementById('app');
	if (!appContainer) return;

	// Load store
	store.load();

	// Set up URL-based thread loading
	setupUrlThreadManagement();

	// Set up mode switching for mobile/tablet/desktop
	setupModeSwitching(appContainer);
}

/**
 * Handle URL-based thread navigation
 */
function setupUrlThreadManagement() {
	// On initial load, check URL for thread ID
	const urlThreadId = getCurrentThreadId();

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
	onThreadIdChange((threadId) => {
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
}

/**
 * Set up responsive navigation handling
 * - Mobile (<900px): uses data-mode to show one pane at a time (list, edit, or preview)
 * - Tablet (900-1200px): uses data-mode to control left pane (list or edit), right pane always shows preview
 * - Desktop (>=1200px): shows all panes simultaneously, no data-mode needed
 */
function setupModeSwitching(appContainer) {
	const ACTION_MAP = {
		'show-threads': 'list',
		'show-editor': 'edit',
		'show-preview': 'preview',
	};

	// Handle navigation events from icon-arrow components
	document.addEventListener('navigate', (e) => {
		const { action } = e.detail;
		const mode = ACTION_MAP[action];

		if (!mode) return;

		const width = window.innerWidth;

		// Mobile and tablet (<1200px): use data-mode
		if (width < 1200) {
			appContainer.setAttribute('data-mode', mode);
		}
		// Desktop (>=1200px): no mode needed, all panes visible
	});

	// Set initial mode based on viewport
	const updateInitialMode = () => {
		const width = window.innerWidth;
		if (width < 900) {
			// Mobile: default to preview mode
			if (!appContainer.getAttribute('data-mode')) {
				appContainer.setAttribute('data-mode', 'preview');
			}
		} else {
			// Tablet/Desktop: clear mode attribute
			appContainer.removeAttribute('data-mode');
		}
	};

	updateInitialMode();
	window.addEventListener('resize', updateInitialMode);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', init);
} else {
	init();
}
