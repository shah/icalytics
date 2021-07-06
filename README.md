# iCal Analytics

Given an `*.ics` file, analyze it to find events that match organizations by participant names. This is useful if you manage your timesheet by calendar based on who's attending specific meetings.

Usage:

1. Save your calendar file as `calendar.ics`.
2. Copy `config.example.ts` to `config.ts` and setup configuration.
3. `deno run -A --unstable mod.ts`
4. The results are in `calendar.csv`.

Dependencies:

* Deno 1.11 or above