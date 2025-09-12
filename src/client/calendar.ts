import { BaseNextcloudClient } from './base';
import { Calendar, Event } from '../models/calendar';
import { XMLParser } from 'fast-xml-parser';

export class CalendarClient extends BaseNextcloudClient {
  private xmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    allowBooleanAttributes: true,
  });

  public async listCalendars(): Promise<Calendar[]> {
    const propfindXml = `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:" xmlns:cs="http://calendarserver.org/ns/" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:displayname />
    <d:resourcetype />
    <c:calendar-description />
    <cs:getctag />
    <c:calendar-color />
    <c:calendar-order />
  </d:prop>
</d:propfind>`;

    try {
      // First try the standard discovery
      const response = await this.makeWebDAVRequest({
        method: 'PROPFIND',
        url: '/remote.php/dav/calendars/{username}/',
        data: propfindXml,
        headers: {
          'Depth': '1',
        },
      });

      const calendars = this.parseCalendarsResponse(response);
      
      // If no calendars found, try to check for default "personal" calendar
      if (calendars.length === 0) {
        try {
          const defaultResponse = await this.makeWebDAVRequest({
            method: 'PROPFIND',
            url: '/remote.php/dav/calendars/{username}/personal/',
            data: propfindXml,
            headers: {
              'Depth': '0',
            },
          });
          
          const defaultCalendars = this.parseCalendarsResponse(defaultResponse);
          if (defaultCalendars.length > 0) {
            return [{
              id: 'personal',
              displayName: 'Personal',
              description: 'Default calendar',
              ctag: '',
            }];
          }
        } catch (error) {
          console.log('No default personal calendar found');
        }
      }
      
      return calendars;
    } catch (error) {
      console.error('Error listing calendars:', error);
      return [];
    }
  }

  public async createEvent(
    calendarId: string,
    event: Partial<Event>
  ): Promise<Event> {
    // Generate a unique event ID
    const eventId = `event-${Date.now()}.ics`;
    
    // Create iCalendar content
    const icalendar = this.createICalendar(event);

    await this.makeWebDAVRequest({
      method: 'PUT',
      url: `/remote.php/dav/calendars/{username}/${calendarId}/${eventId}`,
      data: icalendar,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
      },
    });

    return {
      id: eventId,
      calendarId,
      ...event,
    };
  }

  public async listEvents(
    calendarId: string,
    start?: string,
    end?: string
  ): Promise<Event[]> {
    const propfindXml = `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:getetag />
    <c:calendar-data />
  </d:prop>
</d:propfind>`;

    const response = await this.makeWebDAVRequest({
      method: 'PROPFIND',
      url: `/remote.php/dav/calendars/{username}/${calendarId}/`,
      data: propfindXml,
    });

    return this.parseEventsResponse(response);
  }

  public async getEvent(
    calendarId: string,
    eventId: string
  ): Promise<Event> {
    const response = await this.makeWebDAVRequest({
      method: 'GET',
      url: `/remote.php/dav/calendars/{username}/${calendarId}/${eventId}`,
    });

    const event = this.parseICalendar(response);
    return { ...event, id: eventId, calendarId };
  }

  public async updateEvent(
    calendarId: string,
    eventId: string,
    event: Partial<Event>
  ): Promise<Event> {
    // Create iCalendar content
    const icalendar = this.createICalendar(event);

    await this.makeWebDAVRequest({
      method: 'PUT',
      url: `/remote.php/dav/calendars/{username}/${calendarId}/${eventId}`,
      data: icalendar,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
      },
    });

    return {
      id: eventId,
      calendarId,
      ...event,
    };
  }

  public async deleteEvent(
    calendarId: string,
    eventId: string
  ): Promise<void> {
    await this.makeWebDAVRequest({
      method: 'DELETE',
      url: `/remote.php/dav/calendars/{username}/${calendarId}/${eventId}`,
    });
  }

  private parseCalendarsResponse(xmlResponse: string): Calendar[] {
    try {
      const parsed = this.xmlParser.parse(xmlResponse);
      const calendars: Calendar[] = [];

      const multistatus = parsed['d:multistatus'] || parsed.multistatus;
      if (!multistatus || !multistatus['d:response']) {
        return [];
      }

      const responses = Array.isArray(multistatus['d:response'])
        ? multistatus['d:response']
        : [multistatus['d:response']];

      for (const response of responses) {
        const href = response['d:href'] || '';
        const propstat = response['d:propstat'];
        
        if (!propstat || !propstat['d:prop']) continue;

        const prop = propstat['d:prop'];
        const resourcetype = prop['d:resourcetype'];

        // Check if this is a calendar
        if (resourcetype && resourcetype['c:calendar'] !== undefined) {
          const displayname = prop['d:displayname'] || '';
          const description = prop['c:calendar-description'] || '';
          const ctag = prop['cs:getctag'] || '';
          const color = prop['c:calendar-color'] || '';
          const order = parseInt(prop['c:calendar-order'] || '0');

          // Extract calendar ID from href
          const pathParts = href.split('/');
          const id = pathParts[pathParts.length - 2] || pathParts[pathParts.length - 1];

          if (id && id !== 'calendars' && id !== this.username) {
            calendars.push({
              id,
              displayName: displayname,
              description,
              ctag,
              color,
              order,
              uri: href,
            });
          }
        }
      }

      return calendars;
    } catch (error) {
      console.error('Error parsing calendars response:', error);
      console.error('XML Response:', xmlResponse);
      return [];
    }
  }

  private parseEventsResponse(xmlResponse: string): Event[] {
    try {
      const parsed = this.xmlParser.parse(xmlResponse);
      const events: Event[] = [];

      const multistatus = parsed['d:multistatus'] || parsed.multistatus;
      if (!multistatus || !multistatus['d:response']) {
        return [];
      }

      const responses = Array.isArray(multistatus['d:response'])
        ? multistatus['d:response']
        : [multistatus['d:response']];

      for (const response of responses) {
        const href = response['d:href'] || '';
        const propstat = response['d:propstat'];
        
        if (!propstat || !propstat['d:prop']) continue;

        const prop = propstat['d:prop'];
        const calendarData = prop['c:calendar-data'];

        if (calendarData && href.endsWith('.ics')) {
          const event = this.parseICalendar(calendarData);
          const pathParts = href.split('/');
          const id = pathParts[pathParts.length - 1];
          const etag = prop['d:getetag'] || '';
          events.push({
            id,
            etag,
            uri: href,
            ...event
          });
        }
      }

      return events;
    } catch (error) {
      console.error('Error parsing events response:', error);
      console.error('XML Response:', xmlResponse);
      return [];
    }
  }

  private parseICalendar(icalData: string): Partial<Event> {
    const event: Partial<Event> = {};
    const lines = icalData.split(/\r?\n/);

    for (const line of lines) {
      const [property, value] = line.split(':');
      if (!property || !value) continue;

      const propName = property.split(';')[0];

      switch (propName) {
        case 'SUMMARY':
          event.summary = value;
          break;
        case 'DESCRIPTION':
          event.description = value;
          break;
        case 'DTSTART':
          event.dtstart = value;
          break;
        case 'DTEND':
          event.dtend = value;
          break;
        case 'LOCATION':
          event.location = value;
          break;
        case 'STATUS':
          event.status = value;
          break;
        case 'PRIORITY':
          event.priority = parseInt(value) || 0;
          break;
      }
    }

    return event;
  }

  private createICalendar(event: Partial<Event>): string {
    const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    
    let icalendar = 'BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Nextcloud MCP//EN\nBEGIN:VEVENT\n';
    
    icalendar += `UID:${event.id || `event-${Date.now()}`}\n`;
    icalendar += `DTSTAMP:${now}\n`;

    if (event.summary) {
      icalendar += `SUMMARY:${event.summary}\n`;
    }

    if (event.description) {
      icalendar += `DESCRIPTION:${event.description}\n`;
    }

    if (event.dtstart) {
      icalendar += `DTSTART:${event.dtstart}\n`;
    }

    if (event.dtend) {
      icalendar += `DTEND:${event.dtend}\n`;
    }

    if (event.location) {
      icalendar += `LOCATION:${event.location}\n`;
    }

    if (event.status) {
      icalendar += `STATUS:${event.status}\n`;
    }

    if (event.priority) {
      icalendar += `PRIORITY:${event.priority}\n`;
    }

    icalendar += 'END:VEVENT\nEND:VCALENDAR';
    return icalendar;
  }
}