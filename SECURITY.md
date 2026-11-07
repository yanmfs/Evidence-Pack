# Security

EvidencePack runs on your computer and does not connect to anything on its own: there is no account, no telemetry and no update check.

## Reporting a problem

If you find something that could expose data (a file written where it should not be, a network connection you did not ask for, content kept in a log), please open a private report through the **Security** tab of this repository (Report a vulnerability) instead of a public issue. Include the version and the steps to reproduce, with made-up data.

I read reports as soon as I can and will say when a fix is out.

## What is in scope

- The app and its installers from the Releases page.
- Anything that sends data out, writes outside the places the app documents, or keeps what it should not.
