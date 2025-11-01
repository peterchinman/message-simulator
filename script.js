const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const setBodyTouchState = (() => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;

  let touch = false;

  if (typeof navigator.maxTouchPoints === 'number') {
    touch = navigator.maxTouchPoints > 0;
  } else if (typeof navigator.msMaxTouchPoints === 'number') {
    touch = navigator.msMaxTouchPoints > 0;
  } else if (typeof window.matchMedia === 'function') {
    const mq = window.matchMedia('(pointer: coarse)');
    touch = mq && mq.media === '(pointer: coarse)' && mq.matches;
  } else if ('ontouchstart' in window) {
    touch = true;
  }

  if (touch) document.body.classList.add('touch-screen');
})();

const CHAT_STORAGE_KEY = 'message-simulator:messages';
const CURRENT_SCHEMA_VERSION = 1; // v0: raw array; v1: wrapper with optional ISO timestamps

const MessageShrinkWrap = {
  config: {
    messageSelector: ".message",
    debounceDelay: 150
  },
  shrinkWrap(messageElement) {
    const span = messageElement.querySelector("span");
    if (!span) return;
    const range = document.createRange();
    range.selectNodeContents(span);
    const { width } = range.getBoundingClientRect();
    messageElement.style.width = `${width}px`;
    messageElement.style.boxSizing = "content-box";
  },
  unwrap(messageElement) {
    messageElement.style.width = "";
    messageElement.style.boxSizing = "";
  },
  shrinkWrapAll() {
    document
      .querySelectorAll(this.config.messageSelector)
      .forEach((el) => this.shrinkWrap(el));
  },
  unwrapAll() {
    document
      .querySelectorAll(this.config.messageSelector)
      .forEach((el) => this.unwrap(el));
  },
  handleResize() {
    this.unwrapAll();
    requestAnimationFrame(() => this.shrinkWrapAll());
  },
  debounce(func, wait) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  },
  init() {
    const run = () => {
      this.unwrapAll();
      requestAnimationFrame(() => this.shrinkWrapAll());
    };

    if (document.readyState === 'complete') {
      run();
    } else {
      window.addEventListener('load', run, { once: true });
    }

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(run);
    }

    window.addEventListener(
      "resize",
      this.debounce(() => this.handleResize(), this.config.debounceDelay)
    );
  }
};

class ChatApp {
  constructor() {
    this.messages = [
      {
        message: "Hi",
        sender: "other"
      },
      {
        message: "Hello",
        sender: "other"
      },
      {
        message: "What is this?",
        sender: "self"
      },
      {
        message: "I had a dream that I was building an iMessage simulator",
        sender: "other"
      },
      {
        message: "When I woke up I decided that I should build it",
        sender: "other"
      },
      {
        message: "What do I do with it?",
        sender: "self"
      },
      {
        message: "Flip the switch beside the input to change senders",
        sender: "other"
      },
      {
        message: "Use the plus menu to clear, export, and import",
        sender: "other"
      },
      {
        message: "No like, what is it for?",
        sender: "self"
      },
      {
        message: "Lol idk",
        sender: "other"
      },
    ];

    this._loadMessages();

    this.elements = {
      messageContainer: document.querySelector(".message-container"),
      bottomArea: document.querySelector(".bottom-area"),
      input: document.querySelector(".input-container .input"),
      senderSwitchContainer: document.querySelector(".sender-switch-container"),
      senderSwitch: document.querySelector("#senderSwitch"),
      optionsContainer: document.querySelector(".options-container"),
      optionsButton: document.querySelector("#options-button"),
      sendButton: document.querySelector(".send-button")
    };

    this.init();
  }

  init() {
    this._renderInitialMessages();
    this._bindEvents();

    MessageShrinkWrap.init();

    const initialBottomHeight = this.elements.bottomArea.getBoundingClientRect()
      .height;
    this.elements.messageContainer.style.paddingBottom = `${initialBottomHeight}px`;

    this._scrollToBottom();
  }

  _bindEvents() {
    this.elements.input.addEventListener("keydown", (event) =>
      this._handleSendMessage(event)
    );
    this.elements.input.addEventListener("input", (event) =>
      this._handleInputResize(event)
    );

    this.elements.senderSwitchContainer.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
      event.preventDefault();
    });

    this.elements.optionsContainer.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
      event.preventDefault();
    });

    // When the bottom area is resized, add padding to the message container, so that the bottom area never hides messages.
    const inputObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const target = entry.target;
        const height = target.getBoundingClientRect().height;

        // Check if near bottom before adding padding
        const container = this.elements.messageContainer;
        const isNearBottom = this._isNearBottom();

        container.style.paddingBottom = `${height}px`;

        if (isNearBottom) {
          container.scrollTop = container.scrollHeight;
        }
      }
    });
    inputObserver.observe(this.elements.bottomArea);

    // Disgusting work-around to deal with iOS virtual keyboard issue.
    if (isIOS) {
      let previousViewportHeight = visualViewport.height;
      visualViewport.addEventListener('resize', () => {
        if (!window.visualViewport) {
          return
        }

        const newViewportHeight = window.visualViewport.height;

        if (newViewportHeight < previousViewportHeight) {
          const vh = newViewportHeight * .01;
          document.documentElement.style.setProperty('--vh', `${vh}px`);

          // Scroll sometimes wouldn't fire on time, but only on actual phone, not on simulator, moving it to next frame to try to fix
          setTimeout(() => {
            window.scrollTo(0, 0);
            this.elements.messageContainer.scrollTo(0, this.elements.messageContainer.scrollHeight);
          })
          
        } else {
          document.documentElement.style.setProperty('--vh', '1dvh');
        }

        previousViewportHeight = newViewportHeight;
      })
      // When input is being blurred, immediately change --vh unit. If we try to do this above on viewport resize, we have to wait for the keyboard to finish hiding, which feels jankier. 
      this.elements.input.addEventListener('blur', () => {
        document.documentElement.style.setProperty('--vh', '1dvh');
      });

      const sendNow = (event) => {
        event.preventDefault();
        this._handleSendMessage(event);
      };

      this.elements.sendButton.addEventListener("pointerdown", (event) => {
        event.stopPropagation();
        event.preventDefault();
        this._handleSendMessage(event);
      });
    }
    if (!isIOS) {
      this.elements.sendButton.addEventListener("pointerdown", (event) => {
        event.stopPropagation();
        event.preventDefault();
        this._handleSendMessage(event);
      });
    }

    // Handle options menu clicks
    document.querySelectorAll(".options-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        const id = e.target.id;
        if (id === "clearChat") {
          this._clearChat();
        } else if (id === "exportChat") {
          this._exportChat();
        } else if (id === "importChat") {
          this._importChat();
        }
      });
    });

    // Close options menu when clicking outside of it
    document.addEventListener("click", (event) => {
      const optionsButton = this.elements.optionsButton;
      const optionsContainer = this.elements.optionsContainer;
      if (!optionsButton || !optionsContainer) return;
      if (!optionsButton.checked) return;
      if (!optionsContainer.contains(event.target)) {
        optionsButton.checked = false;
      }
    });
  }

  _renderInitialMessages() {
    this.messages.forEach((m) => this._renderMessage(m.message, m.sender));
  }

  _handleSendMessage(event) {
    if ((event.key === "Enter" && !event.shiftKey) || (event.type === "pointerdown")) {
      event.preventDefault();
      const messageText = this.elements.input.value;
      const isSender = this.elements.senderSwitch.checked;

      if (messageText.trim().length > 0) {
        const message = {
          id: this._generateId(),
          message: messageText,
          sender: isSender ? "self" : "other",
          timestamp: new Date().toISOString()
        };
        this.messages.push(message);
        this._renderMessage(message.message, message.sender);

        this.elements.input.value = "";
        this.elements.input.style.height = "auto";

        MessageShrinkWrap.handleResize();

        this._saveMessages();

        this._scrollToBottom("smooth");
      }
    }
  }

  _isNearBottom() {
    const container = this.elements.messageContainer;
    return (
      container.scrollHeight - container.scrollTop - container.clientHeight < 10
    );
  }

  _scrollToBottom(behavior = "auto") {
    const container = this.elements.messageContainer;
    container.scrollTo({
      top: container.scrollHeight,
      behavior: behavior
    });
  }

  _handleInputResize(event) {
    event.target.style.height = "auto";
    event.target.style.height = `${event.target.scrollHeight}px`;
  }

  _renderMessage(message, sender) {
    const messageDiv = this._createMessageElement(message, sender);
    this.elements.messageContainer.appendChild(messageDiv);
  }

  _createMessageElement(message, sender) {
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${sender}`;

    const span = document.createElement("span");
    span.textContent = message;

    const svgNS = "http://www.w3.org/2000/svg";
    const xlinkNS = "http://www.w3.org/1999/xlink";

    const svg = document.createElementNS(svgNS, "svg");
    svg.classList.add("message-tail");
    svg.style.fill = "inherit";

    const use = document.createElementNS(svgNS, "use");
    use.setAttributeNS(xlinkNS, "href", "#message-tail");

    svg.appendChild(use);
    messageDiv.appendChild(span);
    messageDiv.appendChild(svg);

    return messageDiv;
  }

  _saveMessages() {
    try {
      const payload = { version: CURRENT_SCHEMA_VERSION, messages: this.messages };
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      // Swallow write errors (e.g., storage full or disabled)
    }
  }

  _loadMessages() {
    try {
      const stored = localStorage.getItem(CHAT_STORAGE_KEY);
      if (!stored) return;
      const { messages, migrated } = this._migrateStoredData(JSON.parse(stored));
      if (Array.isArray(messages)) {
        this.messages = messages;
        if (migrated) this._saveMessages();
      }
    } catch (error) {
      alert('Error loading chat: ' + error.message);
    }
  }

  _migrateStoredData(parsed) {
    // Returns { messages, migrated }
    let migrated = false;

    // v1 only: object wrapper with optional ISO timestamps
    if (parsed && typeof parsed === 'object' && parsed.version === CURRENT_SCHEMA_VERSION) {
      let messages = Array.isArray(parsed.messages) ? parsed.messages : [];
      let changed = false;
      messages = messages.filter(this._isValidMessage);
      if (this._ensureMessageIds(messages)) changed = true;
      migrated = migrated || changed;
      return { messages, migrated };
    }

    return { messages: null, migrated };
  }

  _isValidMessage(item) {
    if (!item || typeof item !== 'object') return false;
    const { message, sender } = item;
    if (typeof message !== 'string') return false;
    if (sender !== 'self' && sender !== 'other') return false;
    if (Object.prototype.hasOwnProperty.call(item, 'timestamp')) {
      const t = item.timestamp;
      if (!(typeof t === 'string' || typeof t === 'number')) return false;
    }
    if (Object.prototype.hasOwnProperty.call(item, 'id')) {
      if (typeof item.id !== 'string' || item.id.length === 0) return false;
    }
    return true;
  }

  _generateId() {
    try {
      if (window && window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
      }
    } catch (_) {
      // fall through to fallback
    }
    return 'msg_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
  }

  _ensureMessageIds(messages) {
    let changed = false;
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      if (m && (m.id === undefined || m.id === null || m.id === '')) {
        m.id = this._generateId();
        changed = true;
      }
    }
    return changed;
  }

  _clearChat() {
  if (confirm('Are you sure you want to clear all messages?')) {
    this.messages = [];
    this.elements.messageContainer.innerHTML = '';
    this._saveMessages();
  }
}

_exportChat() {
  const dataStr = JSON.stringify(this.messages, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `chat-export-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

_importChat() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          let importedMessages = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.messages) ? parsed.messages : []);
          importedMessages = importedMessages.map((m) => {
            if (m && typeof m.timestamp === 'number') {
              return { ...m, timestamp: new Date(m.timestamp).toISOString() };
            }
            return m;
          }).filter(this._isValidMessage);
          this._ensureMessageIds(importedMessages);
          this.messages = importedMessages;
          this.elements.messageContainer.innerHTML = '';
          this._renderInitialMessages();
          MessageShrinkWrap.handleResize();
          this._saveMessages();
          this._scrollToBottom();
        } catch (error) {
          alert('Error importing chat: Invalid JSON file');
        }
      };
      reader.readAsText(file);
    }
  };
  input.click();
}
}

document.addEventListener("DOMContentLoaded", () => {
  new ChatApp();
});
