import 'dotenv/config';
import { Server } from './@modelcontextprotocol/sdk';
import { NotesClient } from './client/notes';
import { CalendarClient } from './client/calendar';
import { ContactsClient } from './client/contacts';
import { TablesClient } from './client/tables';
import { WebDAVClient } from './client/webdav';
import * as notesTools from './server/notes';
import * as calendarTools from './server/calendar';
import * as contactsTools from './server/contacts';
import * as tablesTools from './server/tables';
import * as webdavTools from './server/webdav';
import * as http from 'http';

export default function({ sessionId, config }: { sessionId: string, config: any }) {
  const server = new Server({
      name: "mcp-nextcloud",
      version: "1.0.0",
  });

  server.tool('nc_notes_create_note', notesTools.nc_notes_create_note);
  server.tool('nc_notes_update_note', notesTools.nc_notes_update_note);
  server.tool('nc_notes_append_content', notesTools.nc_notes_append_content);
  server.tool('nc_notes_delete_note', notesTools.nc_notes_delete_note);
  server.tool('nc_notes_search_notes', notesTools.nc_notes_search_notes);
  server.resource('nc://Notes/{note_id}', notesTools.getNote);

  server.tool('nc_calendar_list_calendars', calendarTools.nc_calendar_list_calendars);
  server.tool('nc_calendar_create_event', calendarTools.nc_calendar_create_event);
  server.tool('nc_calendar_list_events', calendarTools.nc_calendar_list_events);
  server.tool('nc_calendar_get_event', calendarTools.nc_calendar_get_event);
  server.tool('nc_calendar_update_event', calendarTools.nc_calendar_update_event);
  server.tool('nc_calendar_delete_event', calendarTools.nc_calendar_delete_event);

  server.tool('nc_contacts_list_addressbooks', contactsTools.nc_contacts_list_addressbooks);
  server.tool('nc_contacts_create_addressbook', contactsTools.nc_contacts_create_addressbook);
  server.tool('nc_contacts_delete_addressbook', contactsTools.nc_contacts_delete_addressbook);
  server.tool('nc_contacts_list_contacts', contactsTools.nc_contacts_list_contacts);
  server.tool('nc_contacts_create_contact', contactsTools.nc_contacts_create_contact);
  server.tool('nc_contacts_delete_contact', contactsTools.nc_contacts_delete_contact);

  server.tool('nc_tables_list_tables', tablesTools.nc_tables_list_tables);
  server.tool('nc_tables_get_schema', tablesTools.nc_tables_get_schema);
  server.tool('nc_tables_read_table', tablesTools.nc_tables_read_table);
  server.tool('nc_tables_insert_row', tablesTools.nc_tables_insert_row);
  server.tool('nc_tables_update_row', tablesTools.nc_tables_update_row);
  server.tool('nc_tables_delete_row', tablesTools.nc_tables_delete_row);

  server.tool('nc_webdav_list_directory', webdavTools.nc_webdav_list_directory);
  server.tool('nc_webdav_read_file', webdavTools.nc_webdav_read_file);
  server.tool('nc_webdav_write_file', webdavTools.nc_webdav_write_file);
  server.tool('nc_webdav_create_directory', webdavTools.nc_webdav_create_directory);
  server.tool('nc_webdav_delete_resource', webdavTools.nc_webdav_delete_resource);

  let notesClient: NotesClient;
  let calendarClient: CalendarClient;
  let contactsClient: ContactsClient;
  let tablesClient: TablesClient;
  let webDAVClient: WebDAVClient;

  server.lifespan(async () => {
    initializeClients();
    return () => Promise.resolve();
  });

  return server;
}

let notesClient: NotesClient | undefined;
let calendarClient: CalendarClient | undefined;
let contactsClient: ContactsClient | undefined;
let tablesClient: TablesClient | undefined;
let webDAVClient: WebDAVClient | undefined;

function initializeClients() {
  const {
    NEXTCLOUD_HOST,
    NEXTCLOUD_USERNAME,
    NEXTCLOUD_PASSWORD,
  } = process.env;

  if (!NEXTCLOUD_HOST || !NEXTCLOUD_USERNAME || !NEXTCLOUD_PASSWORD) {
    throw new Error('Missing Nextcloud credentials in environment variables');
  }

  notesClient = new NotesClient(
    NEXTCLOUD_HOST,
    NEXTCLOUD_USERNAME,
    NEXTCLOUD_PASSWORD
  );
  calendarClient = new CalendarClient(
    NEXTCLOUD_HOST,
    NEXTCLOUD_USERNAME,
    NEXTCLOUD_PASSWORD
  );
  contactsClient = new ContactsClient(
    NEXTCLOUD_HOST,
    NEXTCLOUD_USERNAME,
    NEXTCLOUD_PASSWORD
  );
  tablesClient = new TablesClient(
    NEXTCLOUD_HOST,
    NEXTCLOUD_USERNAME,
    NEXTCLOUD_PASSWORD
  );
  webDAVClient = new WebDAVClient(
    NEXTCLOUD_HOST,
    NEXTCLOUD_USERNAME,
    NEXTCLOUD_PASSWORD
  );
}

export function getClient<T>(client: new (...args: any[]) => T): T {
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