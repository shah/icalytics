# iCal Analytics

Given an `*.ics` file, analyze it to find events that match organizations by participant names. This is useful if you manage your timesheet by calendar based on who's attending specific meetings.

Usage:

1. Save your calendar file as `calendar.ics`. 
   * If you use Outlook, switch to calendar view and use `File` | `Save Calendar`, pick a date range, use _Full Details_ option, and save your file into this workspace directory as `calendar.ics`. 
2. Copy `config.example.ts` to `config.ts` and setup configuration, especially `rangeStart` and `rangeEnd`.
3. Execute `deno run -A --unstable mod.ts` at command line or `Transform Calendar` VS Code task.


Dependencies:

* Deno 1.11 or above