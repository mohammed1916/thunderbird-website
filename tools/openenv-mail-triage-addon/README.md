# OpenEnv Mail Triage Add-on

This is a Thunderbird MailExtension prototype for the hackathon demo.

## What it does

- Reads the currently displayed email in Thunderbird
- Sends the subject, sender, and body to the local OpenEnv demo service
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

- The add-on currently recommends actions only. It does not yet mutate messages in Thunderbird.
- The backend endpoint is `http://127.0.0.1:8000/demo/triage`.
- For a polished hackathon story, we can next wire the recommended actions to real Thunderbird APIs.
