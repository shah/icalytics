import { moment } from "./deps.ts";

// The iCal file that was exported from Outlook/Exchange or other source
export const iCalSrcFile = "calendar.ics";

// The output file which should include events, durations, and participants
export const calendarCSV = "calendar.csv";

// When dealing with calendar recurrences, you need a range of dates to query against,
// because otherwise you can get an infinite number of calendar events.
export const rangeStart = moment.moment("2021-03-01");
export const rangeEnd = moment.moment("2021-07-02");

// Which organizations' events we care about (particpants from these companies)
export const analyzeOrgs = [
  { name: "Company1", emailFilter: /company1.com/ },
  { name: "Customer2", emailFilter: /customer2.com/ },
  { name: "Microsoft", emailFilter: /microsoft.com/ },
  { name: "Apple Computer", emailFilter: /apple/ },
];

// Skip these email addresses (usually your own)
export const skipEmailAddresses = ["me@apple.com"];

// The iCal file after parsing (for debugging)
export const iCalDebugJSON = "calendar.debug.json";
