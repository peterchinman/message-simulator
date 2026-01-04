import { store } from './store.js';
import { getCurrentThreadId, setCurrentThreadId } from '../utils/url-state.js';
import { html } from '../utils/template.js';
import './icon-arrow.js';

class ChatThreadList extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({ mode: 'open' });
		this._onStoreChange = this._onStoreChange.bind(this);
		this._onThreadClick = this._onThreadClick.bind(this);
		this._onCreateThread = this._onCreateThread.bind(this);
	}

	connectedCallback() {
		this.shadowRoot.innerHTML = html`
			<style>
				*,
				*::before,
				*::after {
					box-sizing: border-box;
				}
				:host {
					box-sizing: border-box;
					display: block;
					height: 100%;
				}
				.wrapper {
					display: flex;
					flex-direction: column;
					height: 100%;
					background: var(--color-page);
				}
				.thread-list-header {
					display: grid;
					grid-template-columns: 1fr auto 1fr;
					align-items: center;
					padding-inline: var(--padding-inline);
					padding-block: 1rem;
					background: var(--color-header);
					border-bottom: 1px solid var(--color-edge);
					-webkit-backdrop-filter: var(--backdrop-filter);
					backdrop-filter: var(--backdrop-filter);
					user-select: none;
					z-index: 4;
				}

				@media (min-width: 900px) {
					.thread-list-header icon-arrow {
						display: none;
					}
				}
				.header-title {
					font: 600 18px system-ui;
					color: var(--color-ink);
					text-align: center;
					grid-column: 2;
				}
				.new-thread-btn {
					font: 28px system-ui;
					padding: 0;
					width: 32px;
					height: 32px;
					border: none;
					background: transparent;
					color: var(--color-bubble-self);
					cursor: pointer;
					display: flex;
					align-items: center;
					justify-content: center;
					border-radius: 50%;
					transition: background 0.15s;
					grid-column: 3;
					justify-self: end;
				}
				.new-thread-btn:hover {
					background: var(--color-menu);
				}
				.new-thread-btn:active {
					opacity: 0.6;
				}
				.threads-list {
					flex: 1;
					overflow-y: auto;
					overflow-x: hidden;
					min-height: 0;
				}
				.thread-row {
					--row-padding-block: 12px;
					--name-row-height: 18px;
					--preview-line-height: 1.3;
					--preview-font-size: 12px;
					--preview-lines: 2;
					--gap-between-rows: 4px;

					display: grid;
					grid-template-columns: 48px 1fr;
					gap: 12px;
					padding: var(--row-padding-block) var(--padding-inline);
					border-bottom: 1px solid var(--color-edge);
					cursor: pointer;
					user-select: none;
					transition: background 0.15s;
					outline: none;
					height: calc(
						var(--row-padding-block) * 2 + var(--name-row-height) +
							var(--gap-between-rows) + var(--preview-font-size) *
							var(--preview-line-height) * var(--preview-lines)
					);
				}

				.thread-row:focus-visible {
					outline: 2px solid var(--color-bubble-self);
					outline-offset: -2px;
				}
				.thread-row:hover {
					background: var(--color-menu);
				}
				.thread-row:active {
					background: var(--color-edge);
				}
				.thread-row.active {
					background: var(--color-bubble-other);
				}
				.avatar {
					width: 48px;
					height: 48px;
					border-radius: 50%;
					background: linear-gradient(
						135deg,
						var(--color-recipient-avatar-top) 0%,
						var(--color-recipient-avatar-bottom) 100%
					);
					display: flex;
					align-items: center;
					justify-content: center;
					font: 600 18px system-ui;
					color: white;
					flex-shrink: 0;
				}
				.thread-content {
					min-width: 0;
					display: flex;
					flex-direction: column;
					gap: var(--gap-between-rows);
					justify-content: center;
				}
				.thread-header {
					display: flex;
					justify-content: space-between;
					align-items: baseline;
					gap: 8px;
					height: var(--name-row-height);
				}
				.thread-name {
					font: 600 14px system-ui;
					color: var(--color-ink);
					white-space: nowrap;
					overflow: hidden;
					text-overflow: ellipsis;
				}
				.thread-time {
					font: 11px system-ui;
					color: var(--color-ink-subdued);
					white-space: nowrap;
					flex-shrink: 0;
				}
				.thread-preview {
					font-size: var(--preview-font-size);
					font-family: system-ui;
					color: var(--color-ink-subdued);
					display: -webkit-box;
					-webkit-line-clamp: var(--preview-lines);
					-webkit-box-orient: vertical;
					overflow: hidden;
					text-overflow: ellipsis;
					line-height: var(--preview-line-height);
				}
				.empty-state {
					display: flex;
					flex-direction: column;
					align-items: center;
					justify-content: center;
					height: 100%;
					padding: 2rem;
					text-align: center;
					color: var(--color-ink-subdued);
					gap: 1rem;
				}
				.empty-state-text {
					font: 14px system-ui;
				}
			</style>
			<div class="wrapper">
				<div class="thread-list-header">
					<div style="grid-column: 1;"></div>
					<div class="header-title">Messages</div>
					<button class="new-thread-btn" id="new-thread" title="New thread">
						+
					</button>
				</div>
				<div class="threads-list" id="threads-container">
					<!-- Thread rows will be rendered here -->
				</div>
			</div>
		`;

		this.$ = {
			threadsContainer: this.shadowRoot.getElementById('threads-container'),
			newThreadBtn: this.shadowRoot.getElementById('new-thread'),
		};

		this.$.newThreadBtn.addEventListener('click', this._onCreateThread);
		store.addEventListener('messages:changed', this._onStoreChange);

		this._render();
	}

	disconnectedCallback() {
		this.$.newThreadBtn?.removeEventListener('click', this._onCreateThread);
		store.removeEventListener('messages:changed', this._onStoreChange);
	}

	_onStoreChange(e) {
		const { reason } = e.detail || {};
		// Re-render on any thread-related change
		if (
			reason === 'thread-created' ||
			reason === 'thread-deleted' ||
			reason === 'thread-updated' ||
			reason === 'thread-changed' ||
			reason === 'load' ||
			reason === 'init-defaults' ||
			reason === 'add' ||
			reason === 'update' ||
			reason === 'delete' ||
			reason === 'recipient'
		) {
			this._render();
		}
	}

	_onCreateThread() {
		try {
			const newThread = store.createThread();
			if (newThread) {
				setCurrentThreadId(newThread.id);
				store.loadThread(newThread.id);
			}
		} catch (err) {
			console.error('Failed to create thread:', err);
			// Could show a toast notification here
		}
	}

	_onThreadClick(e) {
		const row = e.currentTarget;
		const threadId = row.dataset.threadId;
		if (threadId) {
			try {
				setCurrentThreadId(threadId);
				store.loadThread(threadId);

				const width = window.innerWidth;
				const appContainer = document.getElementById('app');

				if (appContainer) {
					if (width < 900) {
						// Mobile: show only preview
						appContainer.setAttribute('data-mode', 'preview');
					} else if (width < 1200) {
						// Tablet: show editor in left, preview in right
						appContainer.setAttribute('data-mode', 'edit');
					}
					// Desktop (>=1200px): no mode needed, all panes visible
				}
			} catch (err) {
				console.error('Failed to load thread:', err);
			}
		}
	}

	_render() {
		const threads = store.listThreads();
		const currentThreadId =
			getCurrentThreadId() || store.getCurrentThread()?.id;
		const container = this.$.threadsContainer;

		if (!container) return;

		if (threads.length === 0) {
			container.innerHTML = html`
				<div class="empty-state">
					<div class="empty-state-text">No threads yet</div>
					<div class="empty-state-text">Click + to create one</div>
				</div>
			`;
			return;
		}

		container.innerHTML = '';

		threads.forEach((thread) => {
			const row = document.createElement('div');
			row.className = 'thread-row';
			row.setAttribute('role', 'button');
			row.setAttribute('tabindex', '0');
			if (thread.id === currentThreadId) {
				row.classList.add('active');
				row.setAttribute('aria-current', 'true');
			}
			row.dataset.threadId = thread.id;

			const displayName = store.getThreadDisplayName(thread);
			const recipientName = thread.recipient?.name || '';
			const initials = this._getInitials(recipientName);
			const lastMessage = this._getLastMessage(thread);
			const timeDisplay = this._formatTime(thread.updatedAt);

			row.setAttribute(
				'aria-label',
				`Thread with ${displayName}, last message: ${lastMessage}`,
			);

			row.innerHTML = html`
				<div class="avatar" aria-hidden="true">
					${initials}
				</div>
				<div class="thread-content">
					<div class="thread-header">
						<div class="thread-name">${this._escapeHtml(displayName)}</div>
						<div class="thread-time">${timeDisplay}</div>
					</div>
					<div class="thread-preview">${this._escapeHtml(lastMessage)}</div>
				</div>
			`;

			row.addEventListener('click', this._onThreadClick);
			row.addEventListener('keydown', (e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					this._onThreadClick({ currentTarget: row });
				}
			});
			container.appendChild(row);
		});
	}

	_getInitials(name) {
		const str = String(name ?? '').trim();
		if (!str) return '?';

		const parts = str.split(/\s+/).filter(Boolean);
		if (parts.length === 0) return '?';

		// Use first letter of first + last word (or just first if single word).
		const first = Array.from(parts[0])[0] || '';
		const last =
			parts.length > 1 ? Array.from(parts[parts.length - 1])[0] || '' : '';
		return first + last || '?';
	}

	_getLastMessage(thread) {
		if (!thread.messages || thread.messages.length === 0) {
			return 'No messages yet';
		}
		const lastMsg = thread.messages[thread.messages.length - 1];
		return lastMsg.message || '(Image)';
	}

	_formatTime(timestamp) {
		if (!timestamp) return '';

		const date = new Date(timestamp);
		const now = new Date();
		const diffMs = now - date;
		const diffMins = Math.floor(diffMs / (1000 * 60));
		const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffMins < 1) return 'Just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays === 1) return 'Yesterday';
		if (diffDays < 7) return `${diffDays}d ago`;

		// Format as date
		const month = date.getMonth() + 1;
		const day = date.getDate();
		return `${month}/${day}`;
	}

	_escapeHtml(text) {
		if (!text) return '';
		const div = document.createElement('div');
		div.textContent = text;
		return div.innerHTML;
	}
}

customElements.define('thread-list', ChatThreadList);
