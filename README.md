# iCal Analytics

Given an `*.ics` file, analyze it to find events that match organizations by participant names. This is useful if you manage your timesheet by calendar based on who's attending specific meetings.

Usage:

1. Copy `config.example.ts` to `config.ts` and setup configuration
2. `deno run -A --unstable mod.ts`