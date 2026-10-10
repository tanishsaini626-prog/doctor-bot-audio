"""
Place a test call to the MediBot Twilio number.

Credentials are read from the environment (or from a local .env / doctor.env
file) - they are deliberately NOT hardcoded any more, because this file is
public on GitHub.

Windows PowerShell:
    $env:TWILIO_ACCOUNT_SID="ACxxxxxxxx"
    $env:TWILIO_AUTH_TOKEN="your_token"
    $env:TWILIO_FROM_NUMBER="+16063570297"
    $env:TEST_TO_NUMBER="+919760849372"
    $env:WEBHOOK_URL="https://your-n8n-domain/webhook/doctor-bot"
    python test_call.py
"""

import os
from pathlib import Path

from twilio.rest import Client


def load_dotenv_like() -> None:
    """Minimal .env loader - works even when the file was named doctor.env."""
    for name in (".env", "doctor.env", ".env.local"):
        path = Path(__file__).with_name(name)
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def required(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise SystemExit(
            f"Missing {name}.\n"
            "Set it as an environment variable or put it in a local .env file "
            "(see the docstring at the top of test_call.py)."
        )
    return value


def main() -> None:
    load_dotenv_like()

    account_sid = required("TWILIO_ACCOUNT_SID")
    auth_token = required("TWILIO_AUTH_TOKEN")
    from_number = required("TWILIO_FROM_NUMBER")
    to_number = required("TEST_TO_NUMBER")
    webhook_url = required("WEBHOOK_URL")

    client = Client(account_sid, auth_token)
    call = client.calls.create(
        to=to_number,
        from_=from_number,
        url=webhook_url,
    )

    print(f"Call SID: {call.sid}")
    print("Twilio is calling your phone!")


if __name__ == "__main__":
    main()
