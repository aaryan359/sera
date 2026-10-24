import type { ToolDef } from "../safety.ts";
import { findSlots } from "./tools/find-slots.ts";
import { listEvents } from "./tools/list-events.ts";
import { createEvent } from "./tools/create-event.ts";
import { proposeEvent } from "./tools/propose-event.ts";

export { createCalendarApi, type CalendarApi } from "./client/api.ts";

// Every Calendar tool. The registry hides the EXECUTE tool from the assistant.
export const calendarTools: ToolDef[] = [listEvents, findSlots, proposeEvent, createEvent];
