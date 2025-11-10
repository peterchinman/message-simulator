// <chat-preview> full implementation (refactors ChatApp into a Web Component)
import { store } from './store.js';

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

class ChatPreview extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({ mode: 'open' });
		this._onStoreChange = this._onStoreChange.bind(this);
		this._onKeyDown = this._onKeyDown.bind(this);
		this._onInput = this._onInput.bind(this);
		this._sendNow = this._sendNow.bind(this);
	}

	connectedCallback() {
		this.shadowRoot.innerHTML = `
<link rel="stylesheet" href="../styles.css">
<style>
	:host{display:block;height:100%}
</style>
<svg style="display:none">
	<defs>
		<symbol id="message-tail" viewBox="0 0 21 28">
			<path d="M21.006,27.636C21.02,27.651 11.155,30.269 1.302,21.384C0.051,20.256 0.065,15.626 0.006,14.004C-0.253,6.917 8.514,-0.156 11.953,0.003L11.953,13.18C11.953,17.992 12.717,23.841 21.006,27.636Z" />
		</symbol>
	</defs>
</svg>
<div class="window">
	<div class="message-container"></div>
	<div class="bottom-area">
		<label class="options-container">
			<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="14" height="14">
				<path d="M 50 20 L 50 80 M 20 50 L 80 50" stroke="currentColor" stroke-width="10" stroke-linecap="round" fill="none" />
			</svg>
			<input type="checkbox" id="options-button">
			<ul class="options-menu">
				<li class="options-item" id="clearChat">Clear chat</li>
				<li class="options-item" id="exportChat">Export chat</li>
				<li class="options-item" id="importChat">Import chat</li>
			</ul>
		</label>
		<div class="input-container input-sizer stacked">
			<textarea class="input" rows="1" placeholder="iMessage"></textarea>
			<button class="send-button" type="button">
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><line x1="128" y1="216" x2="128" y2="40" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="40"/><polyline points="56 112 128 40 200 112" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="40"/></svg>
			</button>
		</div>
		<label class="sender-switch-container">
			<input type="checkbox" id="senderSwitch" checked>
			<div class="switch-thumb"></div>
		</label>
	</div>
</div>
<input id="import-file" type="file" accept=".json" style="display:none" />
		`;

		this.$ = {
			container: this.shadowRoot.querySelector('.message-container'),
			bottom: this.shadowRoot.querySelector('.bottom-area'),
			input: this.shadowRoot.querySelector('.input'),
			send: this.shadowRoot.querySelector('.send-button'),
			optionsButton: this.shadowRoot.querySelector('#options-button'),
			optionsContainer: this.shadowRoot.querySelector('.options-container'),
			senderSwitch: this.shadowRoot.querySelector('#senderSwitch'),
			importFile: this.shadowRoot.querySelector('#import-file')
		};

		// Events
		this.$.input.addEventListener('keydown', this._onKeyDown);
		this.$.input.addEventListener('input', this._onInput);
		this.$.send.addEventListener('pointerdown', (e) => { e.preventDefault(); this._sendNow(e); });
		this.shadowRoot.querySelector('#clearChat').addEventListener('click', () => this._clearChat());
		this.shadowRoot.querySelector('#exportChat').addEventListener('click', () => this._exportChat());
		this.shadowRoot.querySelector('#importChat').addEventListener('click', () => this.$.importFile.click());
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

		// Initial render
		this.#renderAll(store.getMessages());
		this._shrinkWrapInit();
		this._scrollToBottom();
	}

	disconnectedCallback() {
		store.removeEventListener('messages:changed', this._onStoreChange);
	}

	_onStoreChange(e) {
		this.#renderAll(e.detail.messages);
		this._shrinkWrapResize();
		this._scrollToBottom();
	}

	_onKeyDown(event) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			this._sendNow(event);
		}
	}

	_onInput(event) {
		event.target.style.height = 'auto';
		event.target.style.height = `${event.target.scrollHeight}px`;
	}

	async _sendNow(event) {
		event.preventDefault();
		const text = this.$.input.value;
		const isSender = this.$.senderSwitch.checked;
		if (!text || !text.trim()) return;
		const created = store.addMessage(); // create then update
		store.updateMessage(created.id, {
			message: text,
			sender: isSender ? 'self' : 'other',
			timestamp: new Date().toISOString()
		});
		this.$.input.value = '';
		this.$.input.style.height = 'auto';
		this._shrinkWrapResize();
	}

	_clearChat() {
		if (confirm('Are you sure you want to clear all messages?')) {
			store.clear();
		}
	}

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

	_isNearBottom() {
		const container = this.$.container;
		return container.scrollHeight - container.scrollTop - container.clientHeight < 10;
	}

	_scrollToBottom(behavior = 'auto') {
		const container = this.$.container;
		container.scrollTo({ top: container.scrollHeight, behavior });
	}

	#createBubble(message, sender) {
		const messageDiv = document.createElement('div');
		messageDiv.className = `message ${sender}`;

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

	#renderAll(messages) {
		const container = this.$.container;
		container.innerHTML = '';
		for (const m of messages) {
			const sender = m.sender || 'self';
			if (Array.isArray(m.images) && m.images.length > 0) {
				for (const img of m.images) {
					const imgDiv = document.createElement('div');
					imgDiv.className = `message ${sender}`;
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
					container.appendChild(imgDiv);
				}
			}
			if (typeof m.message === 'string' && m.message.length > 0) {
				const bubble = this#createBubble(m.message, sender);
				container.appendChild(bubble);
			}
		}
	}

	// MessageShrinkWrap (scoped)
	_shrinkWrapInit() {
		const run = () => {
			this._shrinkWrapUnwrapAll();
			requestAnimationFrame(() => this._shrinkWrapAll());
		};
		if (document.readyState === 'complete') run();
		else window.addEventListener('load', run, { once: true });
		if (document.fonts && document.fonts.ready) document.fonts.ready.then(run);
		window.addEventListener('resize', this._debounce(() => this._shrinkWrapResize(), 150));
	}
	_shrinkWrapAll() {
		this.shadowRoot.querySelectorAll('.message').forEach(el => {
			const span = el.querySelector('span');
			if (!span) return;
			const range = document.createRange();
			range.selectNodeContents(span);
			const { width } = range.getBoundingClientRect();
			el.style.width = `${width}px`;
			el.style.boxSizing = 'content-box';
		});
	}
	_shrinkWrapUnwrapAll() {
		this.shadowRoot.querySelectorAll('.message').forEach(el => {
			el.style.width = '';
			el.style.boxSizing = '';
		});
	}
	_shrinkWrapResize() {
		this._shrinkWrapUnwrapAll();
		requestAnimationFrame(() => this._shrinkWrapAll());
	}
	_debounce(func, wait) {
		let timeout;
		return (...args) => {
			clearTimeout(timeout);
			timeout = setTimeout(() => func.apply(this, args), wait);
		};
	}
}

customElements.define('chat-preview', ChatPreview);


