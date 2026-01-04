// URL State Management for thread navigation
// Manages the ?thread= URL parameter and syncs with history API

/**
 * Gets the current thread ID from the URL parameter
 * @returns {string|null} The thread ID or null if not present
 */
export function getCurrentThreadId() {
	if (typeof window === 'undefined') return null;
	const params = new URLSearchParams(window.location.search);
	return params.get('thread');
}

/**
 * Sets the current thread ID in the URL without reloading the page
 * @param {string|null} threadId - The thread ID to set, or null to clear
 */
export function setCurrentThreadId(threadId) {
	if (typeof window === 'undefined') return;
	
	const url = new URL(window.location.href);
	
	if (threadId) {
		url.searchParams.set('thread', threadId);
	} else {
		url.searchParams.delete('thread');
	}
	
	// Update URL without reload
	window.history.pushState({}, '', url.toString());
}

/**
 * Listens for thread ID changes (back/forward navigation)
 * @param {function(string|null): void} callback - Called when thread ID changes
 * @returns {function(): void} Cleanup function to remove listener
 */
export function onThreadIdChange(callback) {
	if (typeof window === 'undefined') return () => {};
	
	const handler = () => {
		const threadId = getCurrentThreadId();
		callback(threadId);
	};
	
	window.addEventListener('popstate', handler);
	
	// Return cleanup function
	return () => {
		window.removeEventListener('popstate', handler);
	};
}

/**
 * Replaces the current URL state without adding to history
 * Useful for initial page load to avoid extra history entries
 * @param {string|null} threadId - The thread ID to set
 */
export function replaceCurrentThreadId(threadId) {
	if (typeof window === 'undefined') return;
	
	const url = new URL(window.location.href);
	
	if (threadId) {
		url.searchParams.set('thread', threadId);
	} else {
		url.searchParams.delete('thread');
	}
	
	// Replace current URL without adding to history
	window.history.replaceState({}, '', url.toString());
}

