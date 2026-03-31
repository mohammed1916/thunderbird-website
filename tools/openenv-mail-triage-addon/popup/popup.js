const statusEl = document.getElementById("status");
const senderEl = document.getElementById("sender");
const subjectEl = document.getElementById("subject");
const previewEl = document.getElementById("preview");
const categoryEl = document.getElementById("category");
const urgencyEl = document.getElementById("urgency");
const actionsEl = document.getElementById("actions");
const replyEl = document.getElementById("reply");
const reasoningEl = document.getElementById("reasoning");
const executeEl = document.getElementById("execute-btn");

let currentMessageId = null;
let currentRecommendations = null;

function flattenParts(parts = []) {
  const values = [];
  for (const part of parts) {
    if (part.body) {
      values.push(part.body);
    }
    if (part.parts?.length) {
      values.push(flattenParts(part.parts));
    }
  }
  return values.filter(Boolean).join("\n");
}

function renderActions(actions = []) {
  actionsEl.replaceChildren();
  for (const action of actions) {
    const item = document.createElement("li");
    item.textContent = action;
    actionsEl.appendChild(item);
  }
}

async function getActiveMailTab() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

async function getDisplayedMessage(tabId) {
  if (browser.messageDisplay?.getDisplayedMessage) {
    return browser.messageDisplay.getDisplayedMessage(tabId);
  }
  if (browser.messageDisplayAction?.getDisplayedMessage) {
    return browser.messageDisplayAction.getDisplayedMessage(tabId);
  }
  throw new Error("Thunderbird message display API is unavailable.");
}

async function loadMessage() {
  const tab = await getActiveMailTab();
  if (!tab?.id) {
    throw new Error("No active Thunderbird tab found.");
  }

  const message = await getDisplayedMessage(tab.id);
  if (!message?.id) {
    throw new Error("Open an email message before using this add-on.");
  }

  const full = await browser.messages.getFull(message.id);
  const body = flattenParts(full.parts).trim();

  return {
    id: message.id,
    sender: message.author || "Unknown sender",
    subject: message.subject || "(no subject)",
    body,
  };
}

async function fetchRecommendation(message) {
  const response = await fetch("http://127.0.0.1:8000/demo/triage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    throw new Error(`OpenEnv demo service returned ${response.status}.`);
  }

  return response.json();
}

async function init() {
  try {
    const message = await loadMessage();
    currentMessageId = message.id;
    senderEl.textContent = message.sender;
    subjectEl.textContent = message.subject;
    previewEl.textContent = message.body.slice(0, 240) || "No readable body content was found.";
    statusEl.textContent = "Sending message to local OpenEnv triage service...";

    const recommendation = await fetchRecommendation(message);
    currentRecommendations = recommendation;
    categoryEl.textContent = recommendation.category;
    urgencyEl.textContent = recommendation.urgency;
    replyEl.textContent = recommendation.suggested_reply;
    reasoningEl.textContent = recommendation.reasoning;
    renderActions(recommendation.suggested_actions);
    statusEl.textContent = "Recommendation ready.";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    statusEl.textContent = message;
    previewEl.textContent = "Make sure Thunderbird is showing a message and the backend is running on localhost:8000.";
    replyEl.textContent = "-";
    reasoningEl.textContent = "-";
    renderActions([]);
  }
}

executeEl.addEventListener("click", async () => {
    if (!currentMessageId || !currentRecommendations) return;
    statusEl.textContent = "Executing multi-step actions...";
    
    try {
        const actions = currentRecommendations.suggested_actions || [];
        
        // Advanced Multi-Step Handlers:
        if (actions.includes("star")) {
            await browser.messages.update(currentMessageId, { flagged: true });
        }
        
        if (actions.includes("forward_to_assistant") || actions.includes("forward_to_it_sec")) {
            try {
                if (browser.compose && browser.compose.beginForward) {
                    await browser.compose.beginForward(currentMessageId);
                }
            } catch (err) {
                console.error("Compose API forwarding failed: ", err);
            }
        }

        if (actions.includes("move_to_junk")) {
            await browser.messages.update(currentMessageId, { junk: true });
        }
        
        statusEl.textContent = "Actions executed successfully!";
        executeEl.textContent = "Executed ✓";
        executeEl.disabled = true;

    } catch (e) {
        statusEl.textContent = "Error executing actions: " + e.message;
    }
});

init();
