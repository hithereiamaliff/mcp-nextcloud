import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getClient } from '../utils/client-manager.js';
import { ContactsClient } from '../client/contacts.js';
import { prefixToolName } from '../utils/tool-naming.js';

/**
 * Register Contacts tools with the MCP server
 * @param server MCP server instance
 */
export function registerContactsTools(server: McpServer) {
  server.tool(
    prefixToolName('contacts_list_addressbooks'),
    'List all address books',
    {},
    async () => {
      const addressBooks = await getClient(ContactsClient).listAddressBooks();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(addressBooks, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    prefixToolName('contacts_create_addressbook'),
    'Create a new address book',
    {
      displayName: z.string().describe('Display name for the address book'),
      description: z.string().describe('Description of the address book'),
    },
    async ({ displayName, description }) => {
      const addressBook = await getClient(ContactsClient).createAddressBook(displayName, description);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(addressBook, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    prefixToolName('contacts_delete_addressbook'),
    'Delete an address book',
    {
      addressBookId: z.string().describe('The ID of the address book to delete'),
    },
    async ({ addressBookId }) => {
      await getClient(ContactsClient).deleteAddressBook(addressBookId);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status_code: 200,
              message: `Address book ${addressBookId} deleted successfully`,
            }, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    prefixToolName('contacts_list_contacts'),
    'List contacts from an address book',
    {
      addressBookId: z.string().describe('The ID of the address book'),
    },
    async ({ addressBookId }) => {
      const contacts = await getClient(ContactsClient).listContacts(addressBookId);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(contacts, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    prefixToolName('contacts_create_contact'),
    'Create a new contact',
    {
      addressBookId: z.string().describe('The ID of the address book'),
      contact: z.object({
        fn: z.string().optional().describe('Full name'),
        email: z.array(z.string()).optional().describe('Array of email addresses'),
        tel: z.array(z.string()).optional().describe('Array of phone numbers'),
        adr: z.array(z.string()).optional().describe('Array of addresses'),
        org: z.array(z.string()).optional().describe('Array of organizations'),
        note: z.string().optional().describe('Note'),
      }).describe('Contact information'),
    },
    async ({ addressBookId, contact }) => {
      const result = await getClient(ContactsClient).createContact(addressBookId, contact);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    prefixToolName('contacts_delete_contact'),
    'Delete a contact',
    {
      addressBookId: z.string().describe('The ID of the address book'),
      contactId: z.string().describe('The ID of the contact to delete'),
    },
    async ({ addressBookId, contactId }) => {
      await getClient(ContactsClient).deleteContact(addressBookId, contactId);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status_code: 200,
              message: `Contact ${contactId} deleted successfully from address book ${addressBookId}`,
            }, null, 2),
          },
        ],
      };
    }
  );
}