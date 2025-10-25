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
        message: "Hey! Are you still up for that camping trip this weekend?",
        sender: "self"
      },
      {
        message: "I was looking at the campsite and it looks incredible",
        sender: "self"
      },
      {
        message: "There's a lake right next to it for swimming",
        sender: "self"
      },
      {
        message: "Absolutely! I've been looking forward to it all week",
        sender: "other"
      },
      { message: "A lake? Even better than I thought", sender: "other" },
      {
        message:
          "Perfect! I was thinking we could leave Friday evening around 6pm",
        sender: "self"
      },
      { message: "That should get us there before dark", sender: "self" },
      {
        message:
          "That works for me. Should I bring my tent or do you have one big enough for both of us?",
        sender: "other"
      },
      {
        message:
          "I have a two-person tent we can use. But bring a sleeping bag and pad",
        sender: "self"
      },
      {
        message: "Got it. What about food? Should we meal prep or cook there?",
        sender: "other"
      },
      {
        message:
          "Let's do a mix. I can bring stuff for breakfast and we can cook dinner over the fire",
        sender: "self"
      },
      {
        message: "Maybe pancakes and bacon for Saturday morning?",
        sender: "self"
      },
      { message: "And I have everything we need for s'mores", sender: "self" },
      {
        message: "Sounds amazing. I'll grab snacks and lunch stuff then",
        sender: "other"
      },
      { message: "I can bring sandwich stuff and some chips", sender: "other" },
      {
        message: "Oh and trail mix, definitely need trail mix",
        sender: "other"
      },
      { message: "Yes! Trail mix is essential", sender: "self" },
      {
        message:
          "Oh and don't forget a headlamp. The trails can get pretty dark",
        sender: "self"
      },
      {
        message: "Good call. Is the weather supposed to be decent?",
        sender: "other"
      },
      {
        message:
          "Checked this morning - clear skies and mid 60s during the day, low 40s at night",
        sender: "self"
      },
      { message: "So we'll need warm layers for the evening", sender: "self" },
      {
        message: "Perfect camping weather! I'm so ready for this",
        sender: "other"
      },
      {
        message: "Same here. Work has been brutal lately, need this escape",
        sender: "self"
      },
      { message: "My boss has been on my case all week", sender: "self" },
      {
        message: "I just need to disconnect for a couple days",
        sender: "self"
      },
      {
        message: "Tell me about it. Nothing but meetings and deadlines",
        sender: "other"
      },
      {
        message: "I had three back-to-back meetings yesterday",
        sender: "other"
      },
      { message: "Didn't even have time for lunch", sender: "other" },
      {
        message:
          "That's rough. Well, in two days we'll be sitting by a campfire with no cell service",
        sender: "self"
      },
      { message: "Just us, nature, and good food", sender: "self" },
      { message: "That's the dream right there", sender: "other" },
      {
        message: "Should we invite anyone else or keep it just us two?",
        sender: "other"
      },
      {
        message: "I think just us is good. More peaceful that way",
        sender: "self"
      },
      { message: "Plus easier to coordinate", sender: "self" },
      {
        message: "Agreed. Small group is always better for camping",
        sender: "other"
      },
      {
        message:
          "Alright, I'm gonna start packing tonight so I don't forget anything",
        sender: "self"
      },
      {
        message:
          "Smart move. I always forget something when I pack last minute",
        sender: "other"
      },
      {
        message: "One time I forgot socks on a whole weekend trip",
        sender: "other"
      },
      { message: "Had to wear the same pair the entire time", sender: "other" },
      { message: "Oh no! That's terrible haha", sender: "self" },
      {
        message: "I once forgot a pillow and had to use my jacket",
        sender: "self"
      },
      { message: "Never again", sender: "self" },
      {
        message: "Lesson learned! Okay I'll text you Friday afternoon",
        sender: "other"
      },
      { message: "Sounds good. See you Friday!", sender: "self" }
    ];

    this.elements = {
      messageContainer: document.querySelector(".message-container"),
      bottomArea: document.querySelector(".bottom-area"),
      input: document.querySelector(".input-container .input"),
      senderSwitch: document.querySelector("#senderSwitch")
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
