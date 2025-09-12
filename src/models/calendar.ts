export interface Calendar {
  id: string;
  displayName: string;
  description?: string;
  color?: string;
  order?: number;
  ctag?: string;
  uri?: string;
}

export interface Event {
  id: string;
  summary?: string;
  description?: string;
  dtstart?: string;
  dtend?: string;
  location?: string;
  allDay?: boolean;
  recurring?: boolean;
  recurrenceRule?: string;
  attendees?: string[];
  reminders?: number[];
  categories?: string[];
  priority?: number;
  status?: string;
  etag?: string;
  uri?: string;
  calendarId?: string;
  lastmodified?: number;
}