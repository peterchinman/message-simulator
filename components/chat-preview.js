import { store } from './store.js';
import './sender-switch.js';
import { html } from '../utils/template.js';

/**
 * @typedef {Object} ChatImage
 * @property {string} src
 * @property {string} [alt]
 */

/**
 * @typedef {Object} ChatMessage
 * @property {string} id
 * @property {'self'|'other'} sender
 * @property {string} [message]
 * @property {ChatImage[]} [images]
 * @property {string} [timestamp]
 */

/**
 * @typedef {Object} StoreChangeDetail
 * @property {'add'|'update'|'delete'|string} [reason]
 * @property {ChatMessage} [message]
 * @property {ChatMessage[]} [messages]
 */

const isIOS =
	/iPad|iPhone|iPod/.test(navigator.userAgent) ||
	(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

class ChatPreview extends HTMLElement {
	static FLASH_DURATION_MS = 1500;

	constructor() {
		super();
		this.attachShadow({ mode: 'open' });
		this._onStoreChange = this._onStoreChange.bind(this);
		this._onKeyDown = this._onKeyDown.bind(this);
		this._onInput = this._onInput.bind(this);
		this._sendNow = this._sendNow.bind(this);
		this._scheduleShrinkWrap = this._scheduleShrinkWrap.bind(this);
		this._onEditorFocusMessage = this._onEditorFocusMessage.bind(this);
		this._shrinkWrapFrame = null;
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
					font-family: -apple-system, BlinkMacSystemFont, sans-serif;
				}

				.window {
					position: relative;
					display: flex;
					flex-direction: column;
					justify-content: space-between;
					min-height: 100%;
					max-height: 100%;

					line-height: var(--line-height);
				}

				.message-list {
					display: flex;
					flex-direction: column;
					padding-inline: var(--padding-inline);
					overflow-y: scroll;
					padding-top: var(--message-spacing);
				}

				.message {
					position: relative;
					display: flex;
					align-items: center;
					padding-inline: var(--message-padding-inline);
					padding-block: var(--message-padding-block);
					border-radius: var(--border-radius);

					max-width: 66%;

					&.self {
						background-color: var(--color-native-sender);
						color: white;
						fill: var(--color-native-sender);
						align-self: end;
						justify-content: flex-end;

						.message-tail {
							right: var(--message-tail-offset);
						}
					}

					&.other {
						background-color: var(--color-recipient);
						color: black;
						fill: var(--color-recipient);
						align-self: start;

						svg {
							transform: scale(-1, 1);
							left: var(--message-tail-offset);
						}
					}

					&:not(:first-child) {
						margin-top: var(--message-spacing);
					}

					&.self:has(+ .self),
					&.other:has(+ .other) {
						svg {
							display: none;
						}
					}

					&.self + .self,
					&.other + .other {
						margin-top: var(--consecutive-message-spacing);
					}

					svg {
						position: absolute;
						bottom: 0;
						width: calc(10.5rem / 14);
						height: calc(14rem / 14);
					}

					&.flash {
						animation: flash ${ChatPreview.FLASH_DURATION_MS / 1000}s
							ease-in-out;
					}
				}

				@keyframes flash {
					0% {
						transform: translateX(0) rotate(0deg) scale(1);
					}
					10% {
						transform: translateX(-2px) rotate(-1deg) scale(1.01);
					}
					20% {
						transform: translateX(2px) rotate(1deg) scale(1.01);
					}
					30% {
						transform: translateX(-2px) rotate(-1deg) scale(1.01);
					}
					40% {
						transform: translateX(2px) rotate(1deg) scale(1.01);
					}
					50% {
						transform: translateX(-1px) rotate(-0.5deg) scale(1.005);
					}
					60% {
						transform: translateX(1px) rotate(0.5deg) scale(1.005);
					}
					100% {
						transform: translateX(0) rotate(0deg) scale(1);
					}
				}

				.bottom-area {
					--tight-padding: calc(4rem / 14);
					position: absolute;
					bottom: 0;
					display: flex;
					width: 100%;
					padding-inline: var(--padding-inline);
					padding-block: 1rem;
					justify-content: space-between;
					align-items: flex-end;
					gap: 0.5rem;
					background: hsl(0 0 100 / 0.7);
					backdrop-filter: blur(20px);
				}

				.input-container {
					justify-content: stretch;
					border: 1px solid var(--color-border);
					padding-left: var(--message-padding-inline);
					padding-right: var(--tight-padding);
					border-radius: 1.3rem;
					flex-grow: 1;

					display: flex;
					align-items: center;

					background: var(--color-page);

					.input {
						all: unset;
						max-width: 100%;
						min-height: 1lh;
						width: 100%;
						overflow: hidden;
						box-sizing: border-box;
						overflow-wrap: break-word;
						margin-block: var(--message-padding-block);
					}

					.send-button {
						all: unset;
						align-self: flex-end;
						cursor: pointer;
						color: white;
						background-color: var(--color-native-sender);
						min-height: calc(
							1lh + 2 * var(--message-padding-block) - 2 * var(--tight-padding)
						);
						min-width: calc(
							1lh + 2 * var(--message-padding-block) - 2 * var(--tight-padding)
						);
						border-radius: 50%;
						margin-block: var(--tight-padding);
						display: flex;
						align-items: center;
						justify-content: center;

						svg {
							height: calc(14rem / 14);
							width: calc(14rem / 14);
						}
						/* padding: 0.3rem; */
					}

					.input:placeholder-shown + .send-button {
						display: none;
					}

					/* Hide send button on non-touch devices */
					body:not(.touch-screen) & .send-button {
						display: none;
					}
				}

				.options-container {
					position: relative;
					min-width: var(--single-line-message-height);
					min-height: var(--single-line-message-height);
					display: flex;
					align-items: center;
					justify-content: center;
					background-color: color-mix(
						in srgb,
						var(--color-recipient) 80%,
						transparent
					);
					border: 1px solid transparent;
					border-radius: 100%;

					color: var(--color-ink-subdued);

					input {
						position: absolute;
						opacity: 0;
						height: 0;
						width: 0;
					}

					.options-menu {
						display: none;
						position: absolute;
						bottom: var(--single-line-message-height);
						left: 0;
						min-width: max-content;
						color: black;

						padding-inline: 0.3rem;
						padding-block: 0.3rem;

						background-color: var(--dropdown-background);
						border: 1px solid var(--dropdown-border);
						border-radius: 0.4rem;

						filter: drop-shadow(0 0 0.7rem rgba(0, 0, 0, 0.3));

						.options-item {
							padding-inline: 0.6rem;
							padding-block: 0.3rem;
							border-radius: 0.3rem;
						}

						.options-item:hover {
							color: white;
							background-color: color-mix(
								in oklab,
								var(--dropdown-background) 20%,
								var(--color-native-sender) 80%
							);
						}
					}

					input:checked + .options-menu {
						display: block;
					}
				}
			</style>
			<svg style="display:none">
				<defs>
					<symbol id="message-tail" viewBox="0 0 21 28">
						<path
							d="M21.006,27.636C21.02,27.651 11.155,30.269 1.302,21.384C0.051,20.256 0.065,15.626 0.006,14.004C-0.253,6.917 8.514,-0.156 11.953,0.003L11.953,13.18C11.953,17.992 12.717,23.841 21.006,27.636Z"
						/>
					</symbol>
				</defs>
			</svg>
			<div class="window">
				<div class="message-list"></div>
				<div class="bottom-area">
					<label class="options-container">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 100 100"
							width="14"
							height="14"
						>
							<path
								d="M 50 20 L 50 80 M 20 50 L 80 50"
								stroke="currentColor"
								stroke-width="10"
								stroke-linecap="round"
								fill="none"
							/>
						</svg>
						<input type="checkbox" id="options-button" />
						<ul class="options-menu">
							<li class="options-item" id="clearChat">Clear chat</li>
							<li class="options-item" id="exportChat">Export chat</li>
							<li class="options-item" id="importChat">Import chat</li>
						</ul>
					</label>
					<div class="input-container input-sizer stacked">
						<textarea class="input" rows="1" placeholder="iMessage"></textarea>
						<button class="send-button" type="button">
							<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
								<line
									x1="128"
									y1="216"
									x2="128"
									y2="40"
									fill="none"
									stroke="currentColor"
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="40"
								/>
								<polyline
									points="56 112 128 40 200 112"
									fill="none"
									stroke="currentColor"
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="40"
								/>
							</svg>
						</button>
					</div>
					<sender-switch id="senderSwitch" checked></sender-switch>
				</div>
			</div>
			<input
				id="import-file"
				type="file"
				accept=".json"
				style="display:none"
			/>
		`;

		this.$ = {
			container: this.shadowRoot.querySelector('.message-list'),
			bottom: this.shadowRoot.querySelector('.bottom-area'),
			input: this.shadowRoot.querySelector('.input'),
			send: this.shadowRoot.querySelector('.send-button'),
			optionsButton: this.shadowRoot.querySelector('#options-button'),
			optionsContainer: this.shadowRoot.querySelector('.options-container'),
			senderSwitch: this.shadowRoot.querySelector('#senderSwitch'),
			importFile: this.shadowRoot.querySelector('#import-file'),
		};

		// Mark host for touch capability to control send-button visibility
		const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
		if (isTouch) this.classList.add('touch-screen');
		else this.classList.remove('touch-screen');

		// Events
		this.$.input.addEventListener('keydown', this._onKeyDown);
		this.$.input.addEventListener('input', this._onInput);
		this.$.send.addEventListener('pointerdown', (e) => {
			e.preventDefault();
			this._sendNow(e);
		});
		this.shadowRoot
			.querySelector('#clearChat')
			.addEventListener('click', () => this._clearChat());
		this.shadowRoot
			.querySelector('#exportChat')
			.addEventListener('click', () => this._exportChat());
		this.shadowRoot
			.querySelector('#importChat')
			.addEventListener('click', () => this.$.importFile.click());
		this.$.importFile.addEventListener('change', (e) => this._importChat(e));
		this.shadowRoot.addEventListener('click', (event) => {
			const optionsButton = this.$.optionsButton;
			const optionsContainer = this.$.optionsContainer;
			if (!optionsButton || !optionsContainer) return;
			if (!optionsButton.checked) return;
			if (!optionsContainer.contains(event.target)) {
				optionsButton.checked = false;
			}
		});

		// Resize Observer for padding
		const inputObserver = new ResizeObserver((entries) => {
			for (let entry of entries) {
				const height = entry.target.getBoundingClientRect().height;
				const isNearBottom = this._isNearBottom();
				this.$.container.style.paddingBottom = `${height}px`;
				if (isNearBottom) {
					this.$.container.scrollTop = this.$.container.scrollHeight;
				}
			}
		});
		inputObserver.observe(this.$.bottom);

		// iOS viewport workarounds
		if (isIOS && window.visualViewport) {
			let previousViewportHeight = visualViewport.height;
			visualViewport.addEventListener('resize', () => {
				const newViewportHeight = window.visualViewport.height;
				if (newViewportHeight < previousViewportHeight) {
					const vh = newViewportHeight * 0.01;
					document.documentElement.style.setProperty('--vh', `${vh}px`);
					setTimeout(() => {
						window.scrollTo(0, 0);
						this.$.container.scrollTo(0, this.$.container.scrollHeight);
					});
				} else {
					document.documentElement.style.setProperty('--vh', '1dvh');
				}
				previousViewportHeight = newViewportHeight;
			});
			this.$.input.addEventListener('blur', () => {
				document.documentElement.style.setProperty('--vh', '1dvh');
			});
		}

		// Store events
		store.addEventListener('messages:changed', this._onStoreChange);

		// Listen for editor focus events to scroll to messages
		document.addEventListener(
			'editor:focus-message',
			this._onEditorFocusMessage,
		);

		// Initial render
		this.#renderAll(store.getMessages());
		this._shrinkWrapInit();
		this._scrollToBottom();
	}

	disconnectedCallback() {
		store.removeEventListener('messages:changed', this._onStoreChange);
		document.removeEventListener(
			'editor:focus-message',
			this._onEditorFocusMessage,
		);
	}

	/**
	 * Handle store changes and render appropriate UI updates.
	 * @param {CustomEvent<StoreChangeDetail>} e
	 */
	_onStoreChange(e) {
		const { reason, message, messages } = e.detail || {};
		switch (reason) {
			case 'add':
				this.#renderAdd(message, messages);
				this._scrollToBottom();
				break;
			case 'update':
				this.#renderUpdate(message, messages);
				break;
			case 'delete':
				this.#renderDelete(message);
				break;
			default:
				this.#renderReset(messages);
				this._scrollToBottom();
				break;
		}
	}

	/**
	 * Handle keyboard events on the textarea.
	 * Sends the message on Enter (without Shift) on non‑iOS devices.
	 * @param {KeyboardEvent} event
	 */
	_onKeyDown(event) {
		if (event.key === 'Enter' && !event.shiftKey && !isIOS) {
			event.preventDefault();
			this._sendNow(event);
		}
	}

	/**
	 * Auto-resize the textarea height to fit content.
	 * @param {InputEvent|Event} event
	 */
	_onInput(event) {
		event.target.style.height = 'auto';
		event.target.style.height = `${event.target.scrollHeight}px`;
	}

	/**
	 * Create a new message and send it immediately.
	 * Clears the input and schedules shrink-wrap.
	 * @param {Event} event
	 * @returns {void}
	 */
	_sendNow(event) {
		event.preventDefault();
		const text = this.$.input.value;
		const isSender = this.$.senderSwitch.checked;
		if (!text || !text.trim()) return;
		const created = store.addMessage(); // create then update
		store.updateMessage(created.id, {
			message: text,
			sender: isSender ? 'self' : 'other',
			timestamp: new Date().toISOString(),
		});
		this.$.input.value = '';
		this.$.input.style.height = 'auto';
	}

	_clearChat() {
		if (confirm('Are you sure you want to clear all messages?')) {
			store.clear();
		}
	}

	/** Export chat as a downloadable JSON file. */
	_exportChat() {
		const dataStr = store.exportJson(true);
		const dataBlob = new Blob([dataStr], { type: 'application/json' });
		const url = URL.createObjectURL(dataBlob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `chat-export-${Date.now()}.json`;
		link.click();
		URL.revokeObjectURL(url);
	}

	/**
	 * Import chat from a selected JSON file.
	 * @param {Event & { target: HTMLInputElement }} e
	 */
	_importChat(e) {
		const file = e.target.files && e.target.files[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = (ev) => {
			try {
				store.importJson(String(ev.target.result));
			} catch (_err) {
				alert('Error importing chat: Invalid JSON file');
			} finally {
				this.$.importFile.value = '';
			}
		};
		reader.readAsText(file);
	}

	/**
	 * Determine whether the scroll is near the bottom of the container.
	 * @returns {boolean}
	 */
	_isNearBottom() {
		const container = this.$.container;
		return (
			container.scrollHeight - container.scrollTop - container.clientHeight < 10
		);
	}

	/**
	 * Scroll the message container to the bottom.
	 * @param {'auto'|'smooth'} [behavior='auto']
	 */
	_scrollToBottom(behavior = 'auto') {
		const container = this.$.container;
		container.scrollTo({ top: container.scrollHeight, behavior });
	}

	/**
	 * Handle editor focus message event and scroll to the corresponding message.
	 * @param {CustomEvent<{id: string}>} e
	 */
	_onEditorFocusMessage(e) {
		const { id } = e.detail || {};
		if (!id) return;

		const messageNode = this.#findFirstNodeByMessageId(id);
		if (messageNode && this.$.container) {
			// Use requestAnimationFrame to ensure the DOM is ready
			requestAnimationFrame(() => {
				const container = this.$.container;
				// Get bounding rects relative to viewport
				const nodeRect = messageNode.getBoundingClientRect();
				const containerRect = container.getBoundingClientRect();

				// Calculate the current scroll position plus the relative position
				// to center the message in the container
				const relativeTop =
					nodeRect.top - containerRect.top + container.scrollTop;
				const messageHeight = nodeRect.height;
				const containerHeight = containerRect.height;
				const scrollTop = relativeTop - containerHeight / 2 + messageHeight / 2;

				container.scrollTo({
					top: Math.max(
						0,
						Math.min(scrollTop, container.scrollHeight - containerHeight),
					),
					behavior: 'smooth',
				});

				// Add flash effect to the message
				messageNode.classList.add('flash');
				// Remove the flash class after animation completes
				setTimeout(() => {
					messageNode.classList.remove('flash');
				}, ChatPreview.FLASH_DURATION_MS);
			});
		}
	}

	/**
	 * Create a text bubble element.
	 * @param {string} message
	 * @param {'self'|'other'} sender
	 * @param {string|number} [id]
	 * @returns {HTMLDivElement}
	 * @private
	 */
	#createBubble(message, sender, id) {
		const messageDiv = document.createElement('div');
		messageDiv.className = `message ${sender}`;
		if (id) messageDiv.dataset.id = String(id);

		const span = document.createElement('span');
		span.textContent = message;

		const svgNS = 'http://www.w3.org/2000/svg';
		const xlinkNS = 'http://www.w3.org/1999/xlink';

		const svg = document.createElementNS(svgNS, 'svg');
		svg.classList.add('message-tail');
		svg.style.fill = 'inherit';

		const use = document.createElementNS(svgNS, 'use');
		use.setAttributeNS(xlinkNS, 'href', '#message-tail');

		svg.appendChild(use);
		messageDiv.appendChild(span);
		messageDiv.appendChild(svg);
		return messageDiv;
	}

	/**
	 * Create an image message element.
	 * @param {ChatImage} img
	 * @param {'self'|'other'} sender
	 * @param {string|number} [id]
	 * @returns {HTMLDivElement}
	 * @private
	 */
	#createImage(img, sender, id) {
		const imgDiv = document.createElement('div');
		imgDiv.className = `message ${sender}`;
		if (id) imgDiv.dataset.id = String(id);
		const image = document.createElement('img');
		image.src = img.src;
		image.alt = img.alt || '';
		image.style.maxWidth = '240px';
		image.style.height = 'auto';
		const svgNS = 'http://www.w3.org/2000/svg';
		const xlinkNS = 'http://www.w3.org/1999/xlink';
		const svg = document.createElementNS(svgNS, 'svg');
		svg.classList.add('message-tail');
		svg.style.fill = 'inherit';
		const use = document.createElementNS(svgNS, 'use');
		use.setAttributeNS(xlinkNS, 'href', '#message-tail');
		svg.appendChild(use);
		imgDiv.appendChild(image);
		imgDiv.appendChild(svg);
		return imgDiv;
	}

	/**
	 * Render DOM nodes for a given message (text and/or images).
	 * @param {ChatMessage} [m]
	 * @returns {HTMLElement[]}
	 * @private
	 */
	#renderMessageNodes(m) {
		const nodes = [];
		const sender =
			m && (m.sender === 'self' || m.sender === 'other') ? m.sender : 'self';
		const id = m && m.id ? m.id : '';
		if (m && Array.isArray(m.images) && m.images.length > 0) {
			for (const img of m.images) {
				nodes.push(this.#createImage(img, sender, id));
			}
		}
		if (m && typeof m.message === 'string' && m.message.length > 0) {
			nodes.push(this.#createBubble(m.message, sender, id));
		}
		return nodes;
	}

	/**
	 * Find the first DOM node associated with a message id.
	 * @param {string} id
	 * @returns {HTMLElement|null}
	 * @private
	 */
	#findFirstNodeByMessageId(id) {
		const container = this.$.container;
		if (!container) return null;
		for (let i = 0; i < container.children.length; i++) {
			const child = container.children[i];
			if (child && child.dataset && child.dataset.id === id) {
				return child;
			}
		}
		return null;
	}

	/**
	 * Remove all DOM nodes associated with a message id.
	 * @param {string} id
	 * @private
	 */
	#removeMessageNodes(id) {
		const container = this.$.container;
		if (!container) return;
		const toRemove = [];
		for (let i = 0; i < container.children.length; i++) {
			const child = container.children[i];
			if (child && child.dataset && child.dataset.id === id) {
				toRemove.push(child);
			}
		}
		for (const el of toRemove) el.remove();
	}

	/**
	 * Insert DOM nodes for a given message at its correct index.
	 * @param {ChatMessage} message
	 * @param {ChatMessage[]} [messages]
	 * @returns {HTMLElement[]}
	 * @private
	 */
	#insertMessageNodesAtIndex(message, messages) {
		const container = this.$.container;
		if (!container || !message) return [];
		const nodes = this.#renderMessageNodes(message);
		if (nodes.length === 0) return [];
		const idx = Array.isArray(messages)
			? messages.findIndex((m) => m && m.id === message.id)
			: -1;
		let referenceNode = null;
		if (idx !== -1) {
			const next = messages[idx + 1];
			if (next && next.id) {
				referenceNode = this.#findFirstNodeByMessageId(next.id);
			}
		}
		for (const n of nodes) {
			if (referenceNode) container.insertBefore(n, referenceNode);
			else container.appendChild(n);
		}
		return nodes;
	}

	/**
	 * Render newly added message.
	 * @param {ChatMessage} message
	 * @param {ChatMessage[]} [messages]
	 * @private
	 */
	#renderAdd(message, messages) {
		const nodes = this.#insertMessageNodesAtIndex(message, messages);
		this._shrinkWrapFor(nodes);
	}

	/**
	 * Render an updated message.
	 * @param {ChatMessage} message
	 * @param {ChatMessage[]} [messages]
	 * @private
	 */
	#renderUpdate(message, messages) {
		if (!message) return;
		this.#removeMessageNodes(message.id);
		const nodes = this.#insertMessageNodesAtIndex(message, messages);
		this._shrinkWrapFor(nodes);
	}

	/**
	 * Render deletion of a message.
	 * @param {ChatMessage} message
	 * @private
	 */
	#renderDelete(message) {
		if (!message) return;
		this.#removeMessageNodes(message.id);
	}

	/**
	 * Reset the rendering with a full message list.
	 * @param {ChatMessage[]} [messages]
	 * @private
	 */
	#renderReset(messages) {
		this.#renderAll(messages || []);
		this._scheduleShrinkWrap();
	}

	/**
	 * Render all messages.
	 * @param {ChatMessage[]} messages
	 * @private
	 */
	#renderAll(messages) {
		const container = this.$.container;
		container.innerHTML = '';
		for (const m of messages) {
			const nodes = this.#renderMessageNodes(m);
			for (const n of nodes) container.appendChild(n);
		}
	}

	_shrinkWrapInit() {
		const run = () => {
			this._shrinkWrapUnwrapAll();
			requestAnimationFrame(() => this._shrinkWrapAll());
		};
		if (document.readyState === 'complete') run();
		else window.addEventListener('load', run, { once: true });
		if (document.fonts && document.fonts.ready) document.fonts.ready.then(run);
		window.addEventListener(
			'resize',
			this._debounce(() => this._shrinkWrapResize(), 150),
		);
	}
	/**
	 * Apply shrink-wrap to a specific set of nodes.
	 * @param {HTMLElement[]} nodes
	 */
	_shrinkWrapFor(nodes) {
		if (!nodes || nodes.length === 0) return;
		for (const el of nodes) {
			if (el && el.classList && el.classList.contains('message')) {
				el.style.width = '';
				el.style.boxSizing = '';
			}
		}
		requestAnimationFrame(() => {
			for (const el of nodes) {
				if (!el || !el.classList || !el.classList.contains('message')) continue;
				const span = el.querySelector('span');
				if (!span) continue;
				const range = document.createRange();
				range.selectNodeContents(span);
				const { width } = range.getBoundingClientRect();
				el.style.width = `${width}px`;
				el.style.boxSizing = 'content-box';
			}
		});
	}
	/** Apply shrink-wrap to all message bubbles. */
	_shrinkWrapAll() {
		this.shadowRoot.querySelectorAll('.message').forEach((el) => {
			const span = el.querySelector('span');
			if (!span) return;
			const range = document.createRange();
			range.selectNodeContents(span);
			const { width } = range.getBoundingClientRect();
			el.style.width = `${width}px`;
			el.style.boxSizing = 'content-box';
		});
	}
	/** Remove shrink-wrap styles from all message bubbles. */
	_shrinkWrapUnwrapAll() {
		this.shadowRoot.querySelectorAll('.message').forEach((el) => {
			el.style.width = '';
			el.style.boxSizing = '';
		});
	}
	/** Schedule a shrink-wrap recalculation on the next animation frame. */
	_scheduleShrinkWrap() {
		if (this._shrinkWrapFrame) cancelAnimationFrame(this._shrinkWrapFrame);
		this._shrinkWrapFrame = requestAnimationFrame(() => {
			this._shrinkWrapFrame = null;
			this._shrinkWrapResize();
		});
	}
	/** Recalculate shrink-wrap widths for all bubbles. */
	_shrinkWrapResize() {
		this._shrinkWrapUnwrapAll();
		requestAnimationFrame(() => this._shrinkWrapAll());
	}
	/**
	 * Return a debounced version of a function.
	 * @template {any[]} TArgs
	 * @param {(...args: TArgs) => void} func
	 * @param {number} wait
	 * @returns {(...args: TArgs) => void}
	 */
	_debounce(func, wait) {
		let timeout;
		return (...args) => {
			clearTimeout(timeout);
			timeout = setTimeout(() => func.apply(this, args), wait);
		};
	}
}

customElements.define('chat-preview', ChatPreview);
