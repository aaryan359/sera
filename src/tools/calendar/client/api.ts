import { createGoogleRequest } from "../../google/http.ts";

const BASE_URL = "https://www.googleapis.com/calendar/v3";
const MARKER_KEY = "seraMarker"; // stored on each event we create, to find it again later

export interface EventSummary {
  eventId: string;
  summary: string;
  start: string;
  end: string;
  attendees: string[];
  link: string;
}

export interface BusyBlock {
  start: string; // ISO 8601
  end: string;
}

export interface NewEvent {
  summary: string;
  start: string; // ISO 8601 with offset
  end: string;
  timeZone: string;
  attendees: string[];
  marker: string;
}

export interface CalendarApi {
  listEvents(timeMin: string, timeMax: string, max: number): Promise<EventSummary[]>;
  freeBusy(timeMin: string, timeMax: string): Promise<BusyBlock[]>;
  // A write. If it times out, the event may still have been created.
  createEvent(event: NewEvent): Promise<{ eventId: string; link: string }>;
  // Finds an event we created earlier, by its marker.
  findEventByMarker(marker: string): Promise<{ eventId: string; link: string } | null>;
}

export interface CalendarOptions {
  getAccessToken: () => Promise<string>;
  fetchImpl?: typeof fetch | undefined;
}

export function createCalendarApi(options: CalendarOptions): CalendarApi {
  const request = createGoogleRequest({
    baseUrl: BASE_URL,
    getAccessToken: options.getAccessToken,
    fetchImpl: options.fetchImpl,
  });

  return {
    async listEvents(timeMin, timeMax, max) {
      const query = new URLSearchParams({
        timeMin,
        timeMax,
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: String(max),
      });
      const data = await request(`/calendars/primary/events?${query}`);
      return (data.items ?? []).map(toSummary);
    },

    async freeBusy(timeMin, timeMax) {
      const data = await request("/freeBusy", {
        timeMin,
        timeMax,
        items: [{ id: "primary" }],
      });
      return data.calendars?.primary?.busy ?? [];
    },

    async createEvent(event) {
      // Invitations are sent only when there are attendees.
      const notify = event.attendees.length > 0 ? "all" : "none";
      const data = await request(
        `/calendars/primary/events?sendUpdates=${notify}`,
        {
          summary: event.summary,
          start: { dateTime: event.start, timeZone: event.timeZone },
          end: { dateTime: event.end, timeZone: event.timeZone },
          attendees: event.attendees.map((email) => ({ email })),
          extendedProperties: { private: { [MARKER_KEY]: event.marker } },
        },
        true,
      );
      return { eventId: data.id, link: data.htmlLink };
    },

    async findEventByMarker(marker) {
      const query = new URLSearchParams({
        privateExtendedProperty: `${MARKER_KEY}=${marker}`,
        maxResults: "1",
      });
      const data = await request(`/calendars/primary/events?${query}`);
      const hit = data.items?.[0];
      return hit ? { eventId: hit.id, link: hit.htmlLink } : null;
    },
  };
}

function toSummary(raw: any): EventSummary {
  return {
    eventId: raw.id,
    summary: raw.summary ?? "(no title)",
    start: raw.start?.dateTime ?? raw.start?.date ?? "",
    end: raw.end?.dateTime ?? raw.end?.date ?? "",
    attendees: (raw.attendees ?? []).map((a: { email?: string }) => a.email ?? ""),
    link: raw.htmlLink ?? "",
  };
}
