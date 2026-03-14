import { BaseNextcloudClient } from './base.js';
import { Calendar, Event } from '../models/calendar.js';
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
          // No default personal calendar found
        }
      }
      
      return calendars;
    } catch (error) {
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
    const reportXml = `<?xml version="1.0" encoding="utf-8" ?>
<C:calendar-query xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:getetag />
    <C:calendar-data />
  </D:prop>
  <C:filter>
    <C:comp-filter name="VCALENDAR">
      <C:comp-filter name="VEVENT">
      ${start || end ? `<C:time-range ${start ? `start="${this.convertToICalDateTime(start)}"` : ''} ${end ? `end="${this.convertToICalDateTime(end)}"` : ''}/>` : ''}
      </C:comp-filter>
    </C:comp-filter>
  </C:filter>
</C:calendar-query>`;

    const response = await this.makeWebDAVRequest({
      method: 'REPORT',
      url: `/remote.php/dav/calendars/{username}/${calendarId}/`,
      data: reportXml,
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

      // Try different namespace variations for multistatus
      const multistatus = parsed['d:multistatus'] ||
                         parsed['D:multistatus'] ||
                         parsed.multistatus;
      
      if (!multistatus) {
        return [];
      }

      const responses = multistatus['d:response'] ||
                       multistatus['D:response'] ||
                       multistatus.response;

      if (!responses) {
        return [];
      }

      const responseArray = Array.isArray(responses) ? responses : [responses];

      for (const response of responseArray) {
        const href = response['d:href'] ||
                    response['D:href'] ||
                    response.href || '';
        
        let propstats = response['d:propstat'] ||
                       response['D:propstat'] ||
                       response.propstat;
        
        if (!propstats) {
          continue;
        }

        // Handle propstat array - look for the one with 200 OK status
        if (!Array.isArray(propstats)) {
          propstats = [propstats];
        }

        let prop = null;
        for (const propstat of propstats) {
          const status = propstat['d:status'] || propstat.status || '';
          if (status.includes('200 OK')) {
            prop = propstat['d:prop'] ||
                  propstat['D:prop'] ||
                  propstat.prop;
            break;
          }
        }
                    
        if (!prop) {
          continue;
        }

        const resourcetype = prop['d:resourcetype'] || prop.resourcetype;

        // Check if this is a calendar - try different namespace variations
        const isCalendar = resourcetype && (
          resourcetype['c:calendar'] !== undefined ||
          resourcetype['cal:calendar'] !== undefined ||
          resourcetype.calendar !== undefined
        );
        
        if (isCalendar) {
          const displayname = prop['d:displayname'] || '';
          const description = prop['c:calendar-description'] ||
                             prop['cal:calendar-description'] || '';
          const ctag = prop['cs:getctag'] ||
                      prop['x1:getctag'] ||
                      prop.getctag || '';
          const color = prop['c:calendar-color'] ||
                       prop['cal:calendar-color'] || '';
          const order = parseInt(prop['c:calendar-order'] ||
                               prop['cal:calendar-order'] || '0');

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
        const calendarData = prop['c:calendar-data'] ||
                            prop['C:calendar-data'] ||
                            prop['cal:calendar-data'] ||
                            prop['calendar-data'];

        if (calendarData && href.endsWith('.ics')) {
          // Decode HTML entities
          const decodedIcal = this.decodeHtmlEntities(calendarData);
          const event = this.parseICalendar(decodedIcal);
          const pathParts = href.split('/');
          const id = pathParts[pathParts.length - 1];
          const etag = prop['d:getetag'] ||
                      prop['D:getetag'] ||
                      prop.getetag || '';
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
      icalendar += `SUMMARY:${this.escapeICalProperty(event.summary)}\n`;
    }

    if (event.description) {
      icalendar += `DESCRIPTION:${this.escapeICalProperty(event.description)}\n`;
    }

    if (event.dtstart) {
      icalendar += `DTSTART:${this.convertToICalDateTime(event.dtstart)}\n`;
    }

    if (event.dtend) {
      icalendar += `DTEND:${this.convertToICalDateTime(event.dtend)}\n`;
    }

    if (event.location) {
      icalendar += `LOCATION:${this.escapeICalProperty(event.location)}\n`;
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

  /**
   * Convert ISO 8601 datetime to iCalendar format
   */
  private convertToICalDateTime(dateTimeStr: string): string {
    try {
      // If it's already in iCalendar format (YYYYMMDDTHHMMSSZ), return as-is
      if (/^\d{8}T\d{6}Z?$/.test(dateTimeStr)) {
        return dateTimeStr;
      }

      // Parse the ISO 8601 datetime
      const date = new Date(dateTimeStr);
      
      if (isNaN(date.getTime())) {
        console.warn(`Invalid date format: ${dateTimeStr}, using raw value`);
        return dateTimeStr;
      }

      // Convert to UTC and format as iCalendar datetime
      const utcYear = date.getUTCFullYear();
      const utcMonth = String(date.getUTCMonth() + 1).padStart(2, '0');
      const utcDay = String(date.getUTCDate()).padStart(2, '0');
      const utcHours = String(date.getUTCHours()).padStart(2, '0');
      const utcMinutes = String(date.getUTCMinutes()).padStart(2, '0');
      const utcSeconds = String(date.getUTCSeconds()).padStart(2, '0');

      return `${utcYear}${utcMonth}${utcDay}T${utcHours}${utcMinutes}${utcSeconds}Z`;
    } catch (error) {
      console.warn(`Error converting datetime ${dateTimeStr}:`, error);
      return dateTimeStr;
    }
  }

  /**
   * Escape special characters in iCalendar properties
   */
  private escapeICalProperty(value: string): string {
    return value
      .replace(/\\/g, '\\\\')  // Escape backslashes first
      .replace(/;/g, '\\;')    // Escape semicolons
      .replace(/,/g, '\\,')    // Escape commas
      .replace(/\n/g, '\\n')   // Escape newlines
      .replace(/\r/g, '');     // Remove carriage returns
  }

  private decodeHtmlEntities(str: string): string {
    return str
      .replace(/&#13;/g, '\r')
      .replace(/&#10;/g, '\n')
      .replace(/&#9;/g, '\t')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&'); // This should be last
  }
}