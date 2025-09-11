export interface Calendar {
  id: string;
  uri: string;
  displayname: string;
  description: string;
  color: string;
  order: number;
  synctoken: string;
}

export interface Event {
  id: string;
  etag: string;
  uri: string;
  calendarId: string;
  lastmodified: number;
  summary: string;
  location: string;
  description: string;
  start: string;
  end: string;
  allDay: boolean;
  recurring: boolean;
  recurrenceRule: string;
  attendees: string[];
  reminders: number[];
  categories: string[];
  priority: number;
  status: string;
}