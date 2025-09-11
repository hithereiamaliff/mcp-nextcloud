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

let credentials: { host: string; username: string; password: string } | undefined;

export function setCredentials(host: string, username: string, password: string) {
  credentials = { host, username, password };
  // Reset clients so they get re-initialized with new credentials
  notesClient = undefined;
  calendarClient = undefined;
  contactsClient = undefined;
  tablesClient = undefined;
  webDAVClient = undefined;
}

// For backward compatibility
export function initializeClients(host: string, username: string, password: string) {
  setCredentials(host, username, password);
}

function ensureClientsInitialized() {
  if (!credentials) {
    // Try to get credentials from environment variables
    const {
      NEXTCLOUD_HOST,
      NEXTCLOUD_USERNAME,
      NEXTCLOUD_PASSWORD,
    } = process.env;

    const host = NEXTCLOUD_HOST;
    const username = NEXTCLOUD_USERNAME;
    const password = NEXTCLOUD_PASSWORD;

    if (!host || !username || !password) {
      throw new Error('Missing Nextcloud credentials. Please configure NEXTCLOUD_HOST, NEXTCLOUD_USERNAME, and NEXTCLOUD_PASSWORD in your environment or through Smithery configuration.');
    }

    credentials = { host, username, password };
  }

  if (!notesClient) {
    notesClient = new NotesClient(credentials.host, credentials.username, credentials.password);
    calendarClient = new CalendarClient(credentials.host, credentials.username, credentials.password);
    contactsClient = new ContactsClient(credentials.host, credentials.username, credentials.password);
    tablesClient = new TablesClient(credentials.host, credentials.username, credentials.password);
    webDAVClient = new WebDAVClient(credentials.host, credentials.username, credentials.password);
  }
}

export function getClient<T>(client: new (...args: any[]) => T): T {
  ensureClientsInitialized();
  
  if (client === NotesClient) {
    return notesClient as any;
  }
  if (client === CalendarClient) {
    return calendarClient as any;
  }
  if (client === ContactsClient) {
    return contactsClient as any;
  }
  if (client === TablesClient) {
    return tablesClient as any;
  }
  if (client === WebDAVClient) {
    return webDAVClient as any;
  }
  throw new Error(`Unknown client type: ${client}`);
}