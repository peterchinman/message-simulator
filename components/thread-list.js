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
		this._onTouchStart = this._onTouchStart.bind(this);
		this._onTouchMove = this._onTouchMove.bind(this);
		this._onTouchEnd = this._onTouchEnd.bind(this);
		this._onTouchCancel = this._onTouchCancel.bind(this);
		this._onCopyThread = this._onCopyThread.bind(this);
		this._onDeleteThread = this._onDeleteThread.bind(this);

		// Touch gesture constants
		this.SWIPE_ACTIVATION_DISTANCE = 75;
		this.DIRECTIONALITY_THRESHOLD = 5;
		this.AUTO_ACTIVATION_PERCENTAGE = 0.75;
		this.COLLAPSE_SPEED = 250;
		this.ANIMATE_SPEED = 100;
		this.SPRING_BACK_SPEED = 250;

		// Touch state
		this.touchState = {
			startX: 0,
			startY: 0,
			currentX: 0,
			currentY: 0,
			isDragging: false,
			isHorizontal: null,
			element: null,
			wrapper: null,
			threadId: null,
		};

		this.rafId = null;
		this.currentlyRevealedWrapper = null; // Track the currently revealed row
		this.isDuplicating = false; // Track if we're currently duplicating a thread
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

				/* Swipe gesture styles */
				.thread-row-wrapper {
					position: relative;
					display: grid;
					grid-template-rows: 1fr;
					transition: grid-template-rows 250ms ease;
					overflow: hidden;
				}
				.thread-row-wrapper.collapsing {
					grid-template-rows: 0fr;
				}
				.reveal-actions {
					position: absolute;
					top: 0;
					right: 0;
					height: 100%;
					display: flex;
					z-index: 1;
				}
				.action-button {
					width: 80px;
					display: flex;
					align-items: center;
					justify-content: center;
					cursor: pointer;
					transition: opacity 0.15s;
				}
				.action-button:active {
					opacity: 0.7;
				}
				.action-button.copy {
					background: #007aff;
				}
				.action-button.delete {
					background: #ff3b30;
				}
				.action-button svg {
					width: 24px;
					height: 24px;
					fill: white;
				}
				.swipe-content {
					position: relative;
					z-index: 2;
					background: var(--color-page);
					touch-action: pan-y;
					user-select: none;
					min-height: 0;
					overflow: hidden;
				}
				.thread-row-wrapper.removing .swipe-content {
					transition: transform 100ms ease-out;
				}
				.thread-row-wrapper.removing-left .swipe-content {
					transform: translateX(-100vw);
				}

				/* Confirmation Modal */
				.modal-overlay {
					position: fixed;
					top: 0;
					left: 0;
					width: 100%;
					height: 100%;
					background: rgba(0, 0, 0, 0.5);
					display: flex;
					align-items: center;
					justify-content: center;
					z-index: 1000;
					animation: fadeIn 0.2s ease;
				}
				@keyframes fadeIn {
					from {
						opacity: 0;
					}
					to {
						opacity: 1;
					}
				}
				.modal {
					background: var(--color-page);
					border-radius: 14px;
					padding: 20px;
					max-width: 320px;
					width: 90%;
					box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
					animation: slideUp 0.3s ease;
				}
				@keyframes slideUp {
					from {
						transform: translateY(20px);
						opacity: 0;
					}
					to {
						transform: translateY(0);
						opacity: 1;
					}
				}
				.modal-title {
					font: 600 17px system-ui;
					color: var(--color-ink);
					margin-bottom: 8px;
				}
				.modal-message {
					font: 13px system-ui;
					color: var(--color-ink-subdued);
					margin-bottom: 20px;
					line-height: 1.4;
				}
				.modal-buttons {
					display: flex;
					gap: 8px;
				}
				.modal-button {
					flex: 1;
					padding: 11px 16px;
					border: none;
					border-radius: 8px;
					font: 600 14px system-ui;
					cursor: pointer;
					transition: opacity 0.15s;
				}
				.modal-button:active {
					opacity: 0.7;
				}
				.modal-button.cancel {
					background: var(--color-edge);
					color: var(--color-ink);
				}
				.modal-button.confirm {
					background: #ff3b30;
					color: white;
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

		// Add touch event listeners for swipe gestures
		this.$.threadsContainer.addEventListener('touchstart', this._onTouchStart, {
			passive: true,
		});
		this.$.threadsContainer.addEventListener('touchmove', this._onTouchMove, {
			passive: false,
		});
		this.$.threadsContainer.addEventListener('touchend', this._onTouchEnd, {
			passive: true,
		});
		this.$.threadsContainer.addEventListener(
			'touchcancel',
			this._onTouchCancel,
			{ passive: true },
		);

		this._render();
	}

	disconnectedCallback() {
		this.$.newThreadBtn?.removeEventListener('click', this._onCreateThread);
		store.removeEventListener('messages:changed', this._onStoreChange);

		// Remove touch event listeners
		this.$.threadsContainer?.removeEventListener(
			'touchstart',
			this._onTouchStart,
		);
		this.$.threadsContainer?.removeEventListener(
			'touchmove',
			this._onTouchMove,
		);
		this.$.threadsContainer?.removeEventListener('touchend', this._onTouchEnd);
		this.$.threadsContainer?.removeEventListener(
			'touchcancel',
			this._onTouchCancel,
		);
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
				// Close any revealed swipe before switching threads
				if (this.currentlyRevealedWrapper) {
					this._closeSwipe(this.currentlyRevealedWrapper);
				}

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

		// Clear the currently revealed wrapper since we're re-rendering
		this.currentlyRevealedWrapper = null;

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
			const displayName = store.getThreadDisplayName(thread);
			const recipientName = thread.recipient?.name || '';
			const initials = this._getInitials(recipientName);
			const lastMessage = this._getLastMessage(thread);
			const timeDisplay = this._formatTime(thread.updatedAt);

			// Create wrapper for swipe functionality
			const wrapper = document.createElement('div');
			wrapper.className = 'thread-row-wrapper';
			wrapper.dataset.threadId = thread.id;

			// Create reveal actions (copy and delete)
			const revealActions = document.createElement('div');
			revealActions.className = 'reveal-actions';
			revealActions.innerHTML = html`
				<div
					class="action-button copy"
					data-action="copy"
					data-thread-id="${thread.id}"
				>
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
						<path
							d="M216,32H88a8,8,0,0,0-8,8V80H40a8,8,0,0,0-8,8V216a8,8,0,0,0,8,8H168a8,8,0,0,0,8-8V176h40a8,8,0,0,0,8-8V40A8,8,0,0,0,216,32ZM160,208H48V96H160Zm48-48H176V88a8,8,0,0,0-8-8H96V48H208Z"
						></path>
					</svg>
				</div>
				<div
					class="action-button delete"
					data-action="delete"
					data-thread-id="${thread.id}"
				>
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
						<path
							d="M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM96,40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96Zm96,168H64V64H192ZM112,104v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm48,0v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Z"
						></path>
					</svg>
				</div>
			`;

			// Create swipeable content
			const swipeContent = document.createElement('div');
			swipeContent.className = 'swipe-content';

			const row = document.createElement('div');
			row.className = 'thread-row';
			row.setAttribute('role', 'button');
			row.setAttribute('tabindex', '0');
			// Don't mark as active if we're in the middle of duplicating
			if (!this.isDuplicating && thread.id === currentThreadId) {
				row.classList.add('active');
				row.setAttribute('aria-current', 'true');
			}
			row.dataset.threadId = thread.id;

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

			// Assemble the structure
			swipeContent.appendChild(row);
			wrapper.appendChild(revealActions);
			wrapper.appendChild(swipeContent);

			// Add event listeners for action buttons
			const copyBtn = revealActions.querySelector('.action-button.copy');
			const deleteBtn = revealActions.querySelector('.action-button.delete');
			copyBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				this._onCopyThread(thread.id);
			});
			deleteBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				this._onDeleteThread(thread.id);
			});

			container.appendChild(wrapper);
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

	// Touch event handlers for swipe gestures
	_onTouchStart(e) {
		const swipeContent = e.target.closest('.swipe-content');
		if (!swipeContent) return;

		const wrapper = swipeContent.closest('.thread-row-wrapper');
		if (
			!wrapper ||
			wrapper.classList.contains('removing') ||
			wrapper.classList.contains('collapsing')
		)
			return;

		// If there's a different row currently revealed, close it
		if (
			this.currentlyRevealedWrapper &&
			this.currentlyRevealedWrapper !== wrapper
		) {
			this._closeSwipe(this.currentlyRevealedWrapper);
		}

		const touch = e.touches[0];

		// Clear any existing transition immediately on touch start
		swipeContent.style.transition = '';

		this.touchState = {
			startX: touch.clientX,
			startY: touch.clientY,
			currentX: touch.clientX,
			currentY: touch.clientY,
			isDragging: false,
			isHorizontal: null,
			element: swipeContent,
			wrapper: wrapper,
			threadId: wrapper.dataset.threadId,
		};
	}

	_onTouchMove(e) {
		if (!this.touchState.element) return;

		const touch = e.touches[0];
		const dx = touch.clientX - this.touchState.startX;
		const dy = touch.clientY - this.touchState.startY;

		// Determine direction on first significant movement
		if (
			this.touchState.isHorizontal === null &&
			(Math.abs(dx) > this.DIRECTIONALITY_THRESHOLD ||
				Math.abs(dy) > this.DIRECTIONALITY_THRESHOLD)
		) {
			this.touchState.isHorizontal = Math.abs(dx) > Math.abs(dy);
		}

		// If horizontal swipe, handle it
		if (this.touchState.isHorizontal) {
			e.preventDefault();
			this.touchState.isDragging = true;
			this.touchState.currentX = touch.clientX;

			const revealWidth = 160;
			const wasRevealed = this.touchState.wrapper.dataset.revealed === 'true';

			let constrainedDx;
			if (wasRevealed) {
				// Row is revealed, allow swiping right to close (but constrain to 0)
				// and left swiping is constrained since already at max reveal
				if (dx > 0) {
					// Swiping right to close
					constrainedDx = Math.min(dx, revealWidth) - revealWidth;
				} else {
					// Swiping left (already revealed, so constrain)
					constrainedDx = -revealWidth + dx * 0.1;
				}
			} else {
				// Row is not revealed, only allow left swipe (negative dx)
				constrainedDx = dx < 0 ? dx : dx * 0.1;
			}

			// Apply transform
			if (this.rafId) cancelAnimationFrame(this.rafId);
			this.rafId = requestAnimationFrame(() => {
				this.touchState.element.style.transform = `translateX(${constrainedDx}px)`;
				this.rafId = null;
			});

			// Auto-complete swipe if swiped far enough
			const containerWidth = this.touchState.element.clientWidth;
			if (
				!wasRevealed &&
				Math.abs(dx) > containerWidth * this.AUTO_ACTIVATION_PERCENTAGE
			) {
				this._handleSwipeLeft(this.touchState.wrapper);
			}
		}
	}

	_onTouchEnd(e) {
		if (!this.touchState.element || !this.touchState.isDragging) {
			this._resetTouchState();
			return;
		}

		const deltaX = this.touchState.currentX - this.touchState.startX;
		const revealWidth = 160; // Width of both action buttons
		const wasRevealed = this.touchState.wrapper.dataset.revealed === 'true';

		if (wasRevealed) {
			// Row was already revealed
			if (deltaX > this.SWIPE_ACTIVATION_DISTANCE) {
				// Swiped right enough to close
				this.touchState.element.style.transition = `transform ${this.SPRING_BACK_SPEED}ms ease-out`;
				this.touchState.element.style.transform = 'translateX(0)';
				delete this.touchState.wrapper.dataset.revealed;
				this.currentlyRevealedWrapper = null;

				setTimeout(() => {
					this.touchState.element.style.transition = '';
				}, this.SPRING_BACK_SPEED);
			} else {
				// Didn't swipe right enough, snap back to revealed position
				this.touchState.element.style.transition = `transform ${this.SPRING_BACK_SPEED}ms ease-out`;
				this.touchState.element.style.transform = `translateX(-${revealWidth}px)`;

				setTimeout(() => {
					this.touchState.element.style.transition = '';
				}, this.SPRING_BACK_SPEED);
			}
		} else {
			// Row was not revealed
			if (deltaX < -this.SWIPE_ACTIVATION_DISTANCE) {
				// Swiped left enough to reveal
				this.touchState.element.style.transition = `transform ${this.SPRING_BACK_SPEED}ms ease-out`;
				this.touchState.element.style.transform = `translateX(-${revealWidth}px)`;
				this.touchState.wrapper.dataset.revealed = 'true';
				this.currentlyRevealedWrapper = this.touchState.wrapper;

				// Add click listener to close when clicking elsewhere
				setTimeout(() => {
					const closeSwipe = (e) => {
						if (
							!e.target.closest('.thread-row-wrapper') ||
							e.target.closest('.thread-row-wrapper') !==
								this.touchState.wrapper
						) {
							this._closeSwipe(this.touchState.wrapper);
							this.shadowRoot.removeEventListener('click', closeSwipe);
						}
					};
					this.shadowRoot.addEventListener('click', closeSwipe);
				}, this.SPRING_BACK_SPEED);

				setTimeout(() => {
					this.touchState.element.style.transition = '';
				}, this.SPRING_BACK_SPEED);
			} else {
				// Didn't swipe left enough, snap back to closed position
				this._springBack();
			}
		}

		this._resetTouchState();
	}

	_onTouchCancel(e) {
		if (!this.touchState.element) return;
		this._springBack();
		this._resetTouchState();
	}

	_springBack() {
		if (!this.touchState.element) return;

		const element = this.touchState.element;
		element.style.transition = `transform ${this.SPRING_BACK_SPEED}ms ease-out`;
		element.style.transform = 'translateX(0)';

		// Clear transition after animation completes
		setTimeout(() => {
			element.style.transition = '';
		}, this.SPRING_BACK_SPEED);
	}

	_closeSwipe(wrapper) {
		const swipeContent = wrapper.querySelector('.swipe-content');
		if (swipeContent) {
			swipeContent.style.transition = `transform ${this.SPRING_BACK_SPEED}ms ease-out`;
			swipeContent.style.transform = 'translateX(0)';
			delete wrapper.dataset.revealed;

			// Clear the currently revealed wrapper if it's this one
			if (this.currentlyRevealedWrapper === wrapper) {
				this.currentlyRevealedWrapper = null;
			}

			setTimeout(() => {
				swipeContent.style.transition = '';
			}, this.SPRING_BACK_SPEED);
		}
	}

	_handleSwipeLeft(wrapper) {
		// This is called for auto-activation during drag
		// For now, we'll just snap to reveal position
		const swipeContent = wrapper.querySelector('.swipe-content');
		const revealWidth = 160;

		if (swipeContent) {
			swipeContent.style.transition = `transform ${this.ANIMATE_SPEED}ms ease-out`;
			swipeContent.style.transform = `translateX(-${revealWidth}px)`;
			wrapper.dataset.revealed = 'true';
			this.currentlyRevealedWrapper = wrapper;
		}

		this._resetTouchState();
	}

	_resetTouchState() {
		this.touchState = {
			startX: 0,
			startY: 0,
			currentX: 0,
			currentY: 0,
			isDragging: false,
			isHorizontal: null,
			element: null,
			wrapper: null,
			threadId: null,
		};
	}

	_onCopyThread(threadId) {
		try {
			// Set flag to prevent marking old thread as active during duplication
			this.isDuplicating = true;

			// Use the store's built-in duplicate method
			const newThread = store.duplicateThread(threadId);
			if (!newThread) {
				console.error('Failed to duplicate thread');
				this.isDuplicating = false;
				return;
			}

			// Switch to the new thread
			setCurrentThreadId(newThread.id);
			store.loadThread(newThread.id);

			// Clear the duplicating flag before the next render
			this.isDuplicating = false;

			// Close the swipe after switching threads
			const wrapper = this.shadowRoot.querySelector(
				`.thread-row-wrapper[data-thread-id="${threadId}"]`,
			);
			if (wrapper) {
				this._closeSwipe(wrapper);
			}

			console.log('Thread copied successfully');
		} catch (err) {
			console.error('Failed to copy thread:', err);
			this.isDuplicating = false;
		}
	}

	_onDeleteThread(threadId) {
		// Show confirmation modal
		this._showDeleteConfirmation(threadId);
	}

	_showDeleteConfirmation(threadId) {
		// Get thread info for display
		const thread = store.listThreads().find((t) => t.id === threadId);
		const displayName = thread ? store.getThreadDisplayName(thread) : 'this';

		// Create modal
		const modal = document.createElement('div');
		modal.className = 'modal-overlay';
		modal.innerHTML = html`
			<div class="modal">
				<div class="modal-title">Delete Thread</div>
				<div class="modal-message">
					Are you sure you want to delete ${this._escapeHtml(displayName)}? This
					action cannot be undone.
				</div>
				<div class="modal-buttons">
					<button class="modal-button cancel">Cancel</button>
					<button class="modal-button confirm">Delete</button>
				</div>
			</div>
		`;

		// Add event listeners
		const cancelBtn = modal.querySelector('.modal-button.cancel');
		const confirmBtn = modal.querySelector('.modal-button.confirm');

		const closeModal = () => {
			modal.remove();
		};

		cancelBtn.addEventListener('click', () => {
			closeModal();
			// Close the swipe
			const wrapper = this.shadowRoot.querySelector(
				`.thread-row-wrapper[data-thread-id="${threadId}"]`,
			);
			if (wrapper) {
				this._closeSwipe(wrapper);
			}
		});

		confirmBtn.addEventListener('click', () => {
			closeModal();
			this._deleteThread(threadId);
		});

		// Close on overlay click
		modal.addEventListener('click', (e) => {
			if (e.target === modal) {
				closeModal();
				const wrapper = this.shadowRoot.querySelector(
					`.thread-row-wrapper[data-thread-id="${threadId}"]`,
				);
				if (wrapper) {
					this._closeSwipe(wrapper);
				}
			}
		});

		this.shadowRoot.appendChild(modal);
	}

	_deleteThread(threadId) {
		try {
			const wrapper = this.shadowRoot.querySelector(
				`.thread-row-wrapper[data-thread-id="${threadId}"]`,
			);

			// Clear the currently revealed wrapper if this is it
			if (this.currentlyRevealedWrapper === wrapper) {
				this.currentlyRevealedWrapper = null;
			}

			if (wrapper) {
				const swipeContent = wrapper.querySelector('.swipe-content');

				// Animate removal
				if (swipeContent) {
					swipeContent.style.transition = `transform ${this.ANIMATE_SPEED}ms ease-out`;
					swipeContent.style.transform = 'translateX(-100vw)';
				}

				wrapper.classList.add('removing', 'removing-left');

				// After slide animation, collapse height
				setTimeout(() => {
					wrapper.classList.add('collapsing');

					// Delete from store after collapse animation
					setTimeout(() => {
						store.deleteThread(threadId);

						// If this was the current thread, switch to another one
						if (getCurrentThreadId() === threadId) {
							const threads = store.listThreads();
							if (threads.length > 0) {
								setCurrentThreadId(threads[0].id);
								store.loadThread(threads[0].id);
							} else {
								setCurrentThreadId(null);
							}
						}
					}, this.COLLAPSE_SPEED);
				}, this.ANIMATE_SPEED);
			} else {
				// If wrapper not found, just delete immediately
				store.deleteThread(threadId);
				if (getCurrentThreadId() === threadId) {
					const threads = store.listThreads();
					if (threads.length > 0) {
						setCurrentThreadId(threads[0].id);
						store.loadThread(threads[0].id);
					} else {
						setCurrentThreadId(null);
					}
				}
			}
		} catch (err) {
			console.error('Failed to delete thread:', err);
		}
	}
}

customElements.define('thread-list', ChatThreadList);
