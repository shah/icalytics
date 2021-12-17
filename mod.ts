import { datetime, ical, moment } from "./deps.ts";
import * as config from "./config.ts";

export interface Item {
  readonly params: {
    readonly CN: string;
  };
  readonly val: string;
}

export function isItem(o: unknown): o is Item {
  return (o && typeof o === "object" && "params" in o && "val" in o)
    ? true
    : false;
}

export function isItemList(o: unknown): o is Item[] {
  return (o && Array.isArray(o)) ? true : false;
}

export interface Individual {
  readonly name: string;
  readonly email: string;
}

export function individual(name: string, emailURI: string): Individual {
  return {
    name: name.startsWith('"') ? name.substr(1, name.length - 2) : name,
    email: emailURI.startsWith("mailto:")
      ? emailURI.substr("mailto:".length)
      : emailURI,
  };
}

export interface CalendarEventParticipants {
  readonly organizer?: Individual;
  readonly attendees?: Individual[];
}

export function calendarEventParticipants(
  // deno-lint-ignore no-explicit-any
  event: Record<string, any>,
): CalendarEventParticipants {
  let organizer: Individual | unknown = event.organizer;
  if (isItem(organizer)) {
    organizer = individual(organizer.params.CN, organizer.val);
  }
  if (event.attendee) {
    let attendees: Individual[] | unknown = event.attendee;
    if (isItem(attendees)) {
      attendees = [individual(attendees.params.CN, attendees.val)];
    } else if (isItemList(attendees)) {
      attendees = attendees.map((i) => individual(i.params.CN, i.val));
    }
    return {
      organizer: organizer as Individual,
      attendees: attendees as Individual[],
    };
  } else {
    return {
      organizer: organizer as Individual,
    };
  }
}

export interface CalendarEventParticipantsFilter {
  (e: CalendarEventParticipants): boolean;
}

export function organizerOrAttendeeFilter(
  { emailFilter, nameFilter }: {
    readonly emailFilter?: RegExp;
    readonly nameFilter?: RegExp;
  },
): CalendarEventParticipantsFilter {
  return (
    e: CalendarEventParticipants,
  ): boolean => {
    if (
      emailFilter && e.organizer?.email && e.organizer.email.match(emailFilter)
    ) {
      return true;
    }
    if (nameFilter && e.organizer?.name && e.organizer.name.match(nameFilter)) {
      return true;
    }
    if (e.attendees) {
      for (const a of e.attendees) {
        if (emailFilter && a.email && a.email.match(emailFilter)) {
          return true;
        }
        if (nameFilter && a.name && a.name.match(nameFilter)) {
          return true;
        }
      }
    }
    return false;
  };
}

export interface CalendarEventDuration {
  readonly days: number;
  readonly hours: number;
  readonly minutes: number;
  readonly seconds: number;
}

export function calendarEventDuration(
  startDate: Date,
  endDate: Date,
): CalendarEventDuration {
  const diff = (startDate && endDate)
    ? endDate.getTime() - startDate.getTime()
    : 0;
  return {
    seconds: diff / 1000,
    minutes: diff / 60000,
    hours: diff / 3600000,
    days: diff / 86400000,
  };
}

export interface CalendarEvent extends CalendarEventParticipants {
  readonly organization?: string;
  readonly isRecurring: boolean;
  readonly subject: string;
  readonly startDate: Date;
  readonly endDate: Date;
  readonly duration: CalendarEventDuration;
}

const calendar = ical.default.parseFile(config.iCalSrcFile);
const events: CalendarEvent[] = [];

// deno-lint-ignore no-explicit-any
for (const event of Object.values<Record<string, any>>(calendar)) {
  if (event.type === "VEVENT") {
    const title = isItem(event.summary) ? event.summary.val : event.summary;
    let startDate = moment.moment(event.start);
    let endDate = moment.moment(event.end);

    // Calculate the duration of the event for use with recurring events.
    const duration = parseInt(endDate.format("x")) -
      parseInt(startDate.format("x"));

    // Complicated case - if an RRULE exists, handle multiple recurrences of the event.
    if (event.rrule) {
      // For recurring events, get the set of event start dates that fall within the range
      // of dates we're looking for.
      const dates = event.rrule.between(
        config.rangeStart.toDate(),
        config.rangeEnd.toDate(),
        true,
        () => true,
      );

      // The "dates" array contains the set of dates within our desired date range range that are valid
      // for the recurrence rule.  *However*, it's possible for us to have a specific recurrence that
      // had its date changed from outside the range to inside the range.  One way to handle this is
      // to add *all* recurrence override entries into the set of dates that we check, and then later
      // filter out any recurrences that don't actually belong within our range.
      if (event.recurrences != undefined) {
        for (const r in event.recurrences) {
          // Only add dates that weren't already in the range we added from the rrule so that
          // we don't double-add those events.
          if (
            moment.moment(new Date(r)).isBetween(
              config.rangeStart,
              config.rangeEnd,
            ) != true
          ) {
            dates.push(new Date(r));
          }
        }
      }

      // Loop through the set of date entries to see which recurrences should be printed.
      for (const date of dates) {
        let curEvent = event;
        let showRecurrence = true;
        let curDuration = duration;

        startDate = moment.moment(date);

        // Use just the date of the recurrence to look up overrides and exceptions (i.e. chop off time information)
        const dateLookupKey = date.toISOString().substring(0, 10);

        // For each date that we're checking, it's possible that there is a recurrence override for that one day.
        if (
          (curEvent.recurrences != undefined) &&
          (curEvent.recurrences[dateLookupKey] != undefined)
        ) {
          // We found an override, so for this recurrence, use a potentially different title, start date, and duration.
          curEvent = curEvent.recurrences[dateLookupKey];
          startDate = moment.moment(curEvent.start);
          curDuration = parseInt(moment.moment(curEvent.end).format("x")) -
            parseInt(startDate.format("x"));
        } // If there's no recurrence override, check for an exception date.  Exception dates represent exceptions to the rule.
        else if (
          (curEvent.exdate != undefined) &&
          (curEvent.exdate[dateLookupKey] != undefined)
        ) {
          // This date is an exception date, which means we should skip it in the recurrence pattern.
          showRecurrence = false;
        }

        // Set the the title and the end date from either the regular event or the recurrence override.
        const recurrenceTitle = curEvent.summary;
        endDate = moment.moment(
          parseInt(startDate.format("x")) + curDuration,
          "x",
        );

        // If this recurrence ends before the start of the date range, or starts after the end of the date range,
        // don't process it.
        if (
          endDate.isBefore(config.rangeStart) ||
          startDate.isAfter(config.rangeEnd)
        ) {
          showRecurrence = false;
        }

        if (showRecurrence) {
          events.push({
            isRecurring: true,
            subject: isItem(recurrenceTitle)
              ? recurrenceTitle.val
              : recurrenceTitle,
            startDate: startDate.toDate(),
            endDate: endDate.toDate(),
            duration: calendarEventDuration(
              startDate.toDate(),
              endDate.toDate(),
            ),
            ...calendarEventParticipants(event),
          });
        }
      }
    } // Simple case - no recurrences, just print out the calendar event.
    else {
      if (
        endDate.isBefore(config.rangeStart) ||
        startDate.isAfter(config.rangeEnd)
      ) {
        continue;
      }
      events.push({
        isRecurring: false,
        subject: isItem(title) ? title.val : title,
        startDate: startDate.toDate(),
        endDate: endDate.toDate(),
        duration: calendarEventDuration(startDate.toDate(), endDate.toDate()),
        ...calendarEventParticipants(event),
      });
    }
  }
}

export function includeCalendarEvent(e: CalendarEvent): boolean {
  for (const org of config.analyzeOrgs) {
    const filter = organizerOrAttendeeFilter(org);
    if (filter(e)) {
      // deno-lint-ignore no-explicit-any
      (e as any).organization = org.name;
      return true;
    }
  }
  return false;
}

console.log(`Parsed ${events.length} iCal entries from ${config.iCalSrcFile}.`);
const transformed = events.filter(includeCalendarEvent).map((e) =>
  [
    e.organization ? e.organization : "?",
    e.isRecurring ? "Recurring" : "",
    datetime.format(e.startDate, "yyyy-MM-dd HH:mm"),
    e.duration.minutes,
    e.subject,
    e.organizer ? e.organizer.name : "",
    e.attendees
      ? e.attendees.filter((i) =>
        !config.skipEmailAddresses.find((ea) => ea == i.email)
      ).map((i) => i.name).join(", ")
      : "",
  ].map((c) => (c && c.toString().indexOf(",")) > 0 ? `"${c}"` : c).join(",")
);

Deno.writeTextFileSync(
  config.calendarCSV,
  [
    "Organization",
    "Recurrence",
    "Start",
    "Duration (Minutes)",
    "Subject",
    "Organizer",
    "Attendees",
  ].join(",") + "\n" + transformed.join("\n"),
);
console.log(
  `Saved ${transformed.length} CSV entries in ${config.calendarCSV}.`,
);

if (config.iCalDebugJSON) {
  Deno.writeTextFileSync(
    config.iCalDebugJSON,
    JSON.stringify(events, undefined, "  "),
  );
  console.log(`Saved iCal transformation JSON in ${config.iCalDebugJSON}.`);
}
