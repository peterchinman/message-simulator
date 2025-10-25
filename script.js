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
    this.shrinkWrapAll();
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
        message: "I had a dream that I was building an iMessage simulator",
        sender: "other"
      },
      {
        message: "When I woke I decided to build it",
        sender: "other"
      },
      {
        message: "Flip the switch beside the input to change senders",
        sender: "other"
      },
      {
        message: "Use the plus menu to clear, export, and import",
        sender: "other"
      },
    ];

    this.elements = {
      messageContainer: document.querySelector(".message-container"),
      bottomArea: document.querySelector(".bottom-area"),
      input: document.querySelector(".input-container .input"),
      senderSwitch: document.querySelector("#senderSwitch"),
      optionsContainer: document.querySelector(".options-container"),
      optionsButton: document.querySelector("#options-button")
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

    const inputObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const target = entry.target;
        const height = target.getBoundingClientRect().height;

        //         Check if near bottom before adding padding
        const container = this.elements.messageContainer;
        const isNearBottom = this._isNearBottom();

        container.style.paddingBottom = `${height}px`;

        if (isNearBottom) {
          container.scrollTop = container.scrollHeight;
        }
      }
    });
    inputObserver.observe(this.elements.bottomArea);

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
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const messageText = this.elements.input.value;
      const isSender = this.elements.senderSwitch.checked;

      if (messageText.trim().length > 0) {
        const message = {
          message: messageText,
          sender: isSender ? "self" : "other"
        };
        this.messages.push(message);
        this._renderMessage(message.message, message.sender);

        this.elements.input.value = "";
        this.elements.input.style.height = "auto";

        MessageShrinkWrap.handleResize();

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

  _clearChat() {
  if (confirm('Are you sure you want to clear all messages?')) {
    this.messages = [];
    this.elements.messageContainer.innerHTML = '';
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
          const importedMessages = JSON.parse(event.target.result);
          this.messages = importedMessages;
          this.elements.messageContainer.innerHTML = '';
          this._renderInitialMessages();
          MessageShrinkWrap.handleResize();
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
