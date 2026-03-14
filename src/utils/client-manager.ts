import { AsyncLocalStorage } from 'async_hooks';
import { NotesClient } from '../client/notes.js';
import { CalendarClient } from '../client/calendar.js';
import { ContactsClient } from '../client/contacts.js';
import { TablesClient } from '../client/tables.js';
import { WebDAVClient } from '../client/webdav.js';

// Per-request client set (used by HTTP server via AsyncLocalStorage)
export interface ClientSet {
  notes: NotesClient;
  calendar: CalendarClient;
  contacts: ContactsClient;
  tables: TablesClient;
  webdav: WebDAVClient;
}

const requestStore = new AsyncLocalStorage<ClientSet>();

// Create a fresh set of clients for a specific request
export function createClientSet(host: string, username: string, password: string): ClientSet {
  return {
    notes: new NotesClient(host, username, password),
    calendar: new CalendarClient(host, username, password),
    contacts: new ContactsClient(host, username, password),
    tables: new TablesClient(host, username, password),
    webdav: new WebDAVClient(host, username, password),
  };
}

// Run a function with an isolated client set (per-request scoping)
export function runWithClients<T>(clientSet: ClientSet, fn: () => Promise<T>): Promise<T> {
  return requestStore.run(clientSet, fn);
}

// --- Module-level singletons for CLI/stdio mode only ---
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
    // Try to get credentials from environment variables (CLI/stdio mode only)
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
  // First check for per-request context (HTTP server mode)
  const requestClients = requestStore.getStore();
  if (requestClients) {
    if (client === NotesClient) return requestClients.notes as any;
    if (client === CalendarClient) return requestClients.calendar as any;
    if (client === ContactsClient) return requestClients.contacts as any;
    if (client === TablesClient) return requestClients.tables as any;
    if (client === WebDAVClient) return requestClients.webdav as any;
    throw new Error(`Unknown client type: ${client}`);
  }

  // Fall back to module-level singletons (CLI/stdio mode)
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
