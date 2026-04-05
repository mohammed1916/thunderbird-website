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
const draftReplyEl = document.getElementById("draft-reply-btn");

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
  try {
    const response = await fetch("http://127.0.0.1:8000/api/triage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(`OpenEnv demo service returned ${response.status}.`);
    }

    const result = await response.json();
    result.reasoning = `${result.reasoning || ""} Source: local OpenEnv API.`.trim();
    return result;
  } catch (error) {
    const fallback = inferRecommendationLocally(message);
    fallback.reasoning = `${fallback.reasoning} Source: local add-on heuristic fallback (no backend needed).`;
    return fallback;
  }
}

function inferRecommendationLocally(message) {
  const text = `${message.subject || ""}\n${message.body || ""}`.toLowerCase();
  const sender = (message.sender || "").toLowerCase();

  const phishingSignals = [
    "password",
    "verify account",
    "suspended",
    "urgent action",
    "click link",
    "otp",
    "bank",
  ];
  const incidentSignals = ["outage", "down", "error", "failed", "incident", "bug", "critical"];
  const requestSignals = ["please", "can you", "request", "need", "help", "support"];

  const hasPhishing = phishingSignals.some((k) => text.includes(k));
  const hasIncident = incidentSignals.some((k) => text.includes(k));
  const hasRequest = requestSignals.some((k) => text.includes(k));
  const looksVip = sender.includes("ceo") || sender.includes("founder") || sender.includes("director");

  if (hasPhishing) {
    return {
      category: "security_threat",
      urgency: "critical",
      suggested_actions: ["move_to_junk", "forward_to_it_sec", "flag"],
      suggested_reply: "",
      reasoning: "Detected suspicious phishing-like keywords in email content.",
    };
  }

  if (looksVip) {
    return {
      category: "vip",
      urgency: "high",
      suggested_actions: ["flag", "forward_to_assistant", "reply"],
      suggested_reply: "Thank you for your message. I have received this and will prioritize it immediately.",
      reasoning: "Sender appears to be high-priority/VIP by sender name.",
    };
  }

  if (hasIncident) {
    return {
      category: "Incident",
      urgency: "high",
      suggested_actions: ["flag", "forward_to_it_sec", "reply"],
      suggested_reply: "Thanks for reporting this issue. We are investigating urgently and will update you shortly.",
      reasoning: "Issue/incident keywords detected in email text.",
    };
  }

  if (hasRequest) {
    return {
      category: "Request",
      urgency: "medium",
      suggested_actions: ["reply", "create_task"],
      suggested_reply: "Thank you for your request. We have received it and will follow up soon.",
      reasoning: "Request/help language detected.",
    };
  }

  return {
    category: "general",
    urgency: "low",
    suggested_actions: ["label_general"],
    suggested_reply: "Thanks for your message. I will review and get back to you soon.",
    reasoning: "No strong signals matched; applied default local triage.",
  };
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

    if (recommendation.suggested_reply && recommendation.suggested_reply !== "-" && recommendation.suggested_reply.trim() !== "") {
      draftReplyEl.style.display = "inline-block";
    }

    if ((recommendation.reasoning || "").includes("heuristic fallback")) {
      statusEl.textContent = "Recommendation ready (free offline mode).";
    } else {
      statusEl.textContent = "Recommendation ready (local API mode).";
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    statusEl.textContent = message;
    previewEl.textContent = "Make sure Thunderbird is showing a message and the backend is running on localhost:8000.";
    replyEl.textContent = "-";
    reasoningEl.textContent = "-";
    renderActions([]);
    draftReplyEl.style.display = "none";
  }
}

draftReplyEl.addEventListener("click", async () => {
    if (!currentMessageId || !currentRecommendations?.suggested_reply) return;
    try {
        if (browser.compose && browser.compose.beginReply) {
            await browser.compose.beginReply(currentMessageId, "replyToSender", { body: currentRecommendations.suggested_reply });
        }
    } catch (err) {
        console.error("Compose API reply failed: ", err);
        statusEl.textContent = "Error opening draft reply: " + err.message;
    }
});

executeEl.addEventListener("click", async () => {
    if (!currentMessageId || !currentRecommendations) return;
    statusEl.textContent = "Executing multi-step actions...";
    
    try {
        const actions = currentRecommendations.suggested_actions || [];
        
        // Specific OpenEnv Actions Handlers:
        if (actions.includes("star") || actions.includes("flag")) {
            await browser.messages.update(currentMessageId, { flagged: true });
        }

        // Handle dynamically applying 'create_task' and 'label_*' strings as tags
        let tagsToAdd = [];
        if (actions.includes("create_task")) {
            tagsToAdd.push("$label4"); // Thunderbird's 'To Do' label
        }
        const extractedLabels = actions.filter(a => a.startsWith("label_")).map(a => a.replace("label_", ""));
        tagsToAdd = tagsToAdd.concat(extractedLabels);
        
        if (tagsToAdd.length > 0) {
            const currentMsg = await browser.messages.get(currentMessageId);
            const mergedTags = Array.from(new Set([...(currentMsg.tags || []), ...tagsToAdd]));
            await browser.messages.update(currentMessageId, { tags: mergedTags });
        }
        
        // Security report specific forwarding action
        if (actions.includes("report_security")) {
            try {
                if (browser.compose && browser.compose.beginForward) {
                    await browser.compose.beginForward(currentMessageId, "forwardInline", { to: ["security-reports@example.com"] });
                }
            } catch (err) {
                console.error("Compose API security forward failed: ", err);
            }
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

        if (actions.includes("reply")) {
            if (browser.compose && browser.compose.beginReply && currentRecommendations.suggested_reply) {
                await browser.compose.beginReply(currentMessageId, "replyToSender", { body: currentRecommendations.suggested_reply });
            }
        }
        
        if (actions.includes("mark_read")) {
            await browser.messages.update(currentMessageId, { read: true });
        }
        
        if (actions.includes("mark_unread")) {
            await browser.messages.update(currentMessageId, { read: false });
        }
        
        if (actions.includes("delete_email") || actions.includes("trash")) {
            await browser.messages.delete([currentMessageId]);
        }
        
        if (actions.includes("archive")) {
            await browser.messages.archive([currentMessageId]);
        }
        
        statusEl.textContent = "Actions executed successfully!";
        executeEl.textContent = "Executed ✓";
        executeEl.disabled = true;

    } catch (e) {
        statusEl.textContent = "Error executing actions: " + e.message;
    }
});

init();
