import { NotesClient } from '../client/notes.js';
import { CalendarClient } from '../client/calendar.js';
import { ContactsClient } from '../client/contacts.js';
import { TablesClient } from '../client/tables.js';
import { WebDAVClient } from '../client/webdav.js';

let notesClient: NotesClient | undefined;
let calendarClient: CalendarClient | undefined;
let contactsClient: ContactsClient | undefined;
let tablesClient: TablesClient | undefined;
let webDAVClient: WebDAVClient | undefined;

export function initializeClients(host: string, username: string, password: string) {
  notesClient = new NotesClient(host, username, password);
  calendarClient = new CalendarClient(host, username, password);
  contactsClient = new ContactsClient(host, username, password);
  tablesClient = new TablesClient(host, username, password);
  webDAVClient = new WebDAVClient(host, username, password);
}

export function getClient<T>(client: new (...args: any[]) => T): T {
  if (client === NotesClient) {
    if (!notesClient) throw new Error('NotesClient not initialized');
    return notesClient as any;
  }
  if (client === CalendarClient) {
    if (!calendarClient) throw new Error('CalendarClient not initialized');
    return calendarClient as any;
  }
  if (client === ContactsClient) {
    if (!contactsClient) throw new Error('ContactsClient not initialized');
    return contactsClient as any;
  }
  if (client === TablesClient) {
    if (!tablesClient) throw new Error('TablesClient not initialized');
    return tablesClient as any;
  }
  if (client === WebDAVClient) {
    if (!webDAVClient) throw new Error('WebDAVClient not initialized');
    return webDAVClient as any;
  }
  throw new Error(`Unknown client type: ${client}`);
}