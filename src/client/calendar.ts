import { BaseNextcloudClient } from './base';
import { Calendar, Event } from '../models/calendar';

export class CalendarClient extends BaseNextcloudClient {
  public async listCalendars(): Promise<Calendar[]> {
    return this.makeRequest<Calendar[]>({
      method: 'GET',
      url: '/remote.php/dav/calendars/{username}',
    });
  }

  public async createEvent(
    calendarId: string,
    event: Partial<Event>
  ): Promise<Event> {
    return this.makeRequest<Event>({
      method: 'POST',
      url: `/remote.php/dav/calendars/{username}/${calendarId}`,
      data: event,
    });
  }

  public async listEvents(
    calendarId: string,
    start?: string,
    end?: string
  ): Promise<Event[]> {
    return this.makeRequest<Event[]>({
      method: 'GET',
      url: `/remote.php/dav/calendars/{username}/${calendarId}`,
      params: { start, end },
    });
  }

  public async getEvent(
    calendarId: string,
    eventId: string
  ): Promise<Event> {
    return this.makeRequest<Event>({
      method: 'GET',
      url: `/remote.php/dav/calendars/{username}/${calendarId}/${eventId}`,
    });
  }

  public async updateEvent(
    calendarId: string,
    eventId: string,
    event: Partial<Event>
  ): Promise<Event> {
    return this.makeRequest<Event>({
      method: 'PUT',
      url: `/remote.php/dav/calendars/{username}/${calendarId}/${eventId}`,
      data: event,
    });
  }

  public async deleteEvent(
    calendarId: string,
    eventId: string
  ): Promise<void> {
    await this.makeRequest<void>({
      method: 'DELETE',
      url: `/remote.php/dav/calendars/{username}/${calendarId}/${eventId}`,
    });
  }
}