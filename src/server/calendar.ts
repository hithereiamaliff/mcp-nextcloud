import { Calendar, Event } from '../models/calendar';
import { CalendarClient } from '../client/calendar';
import { getClient } from '../app';

export async function nc_calendar_list_calendars(): Promise<Calendar[]> {
  return getClient(CalendarClient).listCalendars();
}

export async function nc_calendar_create_event(
  calendarId: string,
  event: Partial<Event>
): Promise<Event> {
  return getClient(CalendarClient).createEvent(calendarId, event);
}

export async function nc_calendar_list_events(
  calendarId: string,
  start?: string,
  end?: string
): Promise<Event[]> {
  return getClient(CalendarClient).listEvents(calendarId, start, end);
}

export async function nc_calendar_get_event(
  calendarId: string,
  eventId: string
): Promise<Event> {
  return getClient(CalendarClient).getEvent(calendarId, eventId);
}

export async function nc_calendar_update_event(
  calendarId: string,
  eventId: string,
  event: Partial<Event>
): Promise<Event> {
  return getClient(CalendarClient).updateEvent(calendarId, eventId, event);
}

export async function nc_calendar_delete_event(
  calendarId: string,
  eventId: string
): Promise<void> {
  await getClient(CalendarClient).deleteEvent(calendarId, eventId);
}