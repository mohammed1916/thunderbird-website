# OpenEnv Mail Triage Add-on

This is a Thunderbird MailExtension prototype for the hackathon demo.

## What it does

- Reads the currently displayed email in Thunderbird
- Sends the subject, sender, and body to the local OpenEnv demo service (if running)
- Falls back to fully local/offline triage heuristics when backend is not running
- Displays triage recommendations for category, urgency, actions, and a suggested reply

## Local setup

1. Start the backend from [../../../mail_triage_env](/Users/MohammedIbrahim/Documents/a/scaler_openenv_hackathon/mail_triage_env):

```bash
cd /Users/MohammedIbrahim/Documents/a/scaler_openenv_hackathon/mail_triage_env
uv run server
```

2. In Thunderbird, open `Tools -> Developer Tools -> Debug Add-ons`.
3. Choose `manifest.json` from this folder as a temporary add-on.
4. Open any message and click the add-on button in the message display toolbar.

## Notes

- This add-on now works in two modes:
  - Local API mode: calls `http://127.0.0.1:8000/api/triage`
  - Free offline mode: uses built-in heuristics directly in the extension
- No Cloud Run is required for Thunderbird usage.
- The add-on supports drafting replies and applying selected message actions in Thunderbird.
