import { AddressBook, Contact } from '../models/contacts';
import { ContactsClient } from '../client/contacts';
import { getClient } from '../app';

export async function nc_contacts_list_addressbooks(): Promise<AddressBook[]> {
  return getClient(ContactsClient).listAddressBooks();
}

export async function nc_contacts_create_addressbook(
  displayName: string,
  description: string
): Promise<AddressBook> {
  return getClient(ContactsClient).createAddressBook(displayName, description);
}

export async function nc_contacts_delete_addressbook(
  addressBookId: string
): Promise<void> {
  await getClient(ContactsClient).deleteAddressBook(addressBookId);
}

export async function nc_contacts_list_contacts(
  addressBookId: string
): Promise<Contact[]> {
  return getClient(ContactsClient).listContacts(addressBookId);
}

export async function nc_contacts_create_contact(
  addressBookId: string,
  contact: Partial<Contact>
): Promise<Contact> {
  return getClient(ContactsClient).createContact(addressBookId, contact);
}

export async function nc_contacts_delete_contact(
  addressBookId: string,
  contactId: string
): Promise<void> {
  await getClient(ContactsClient).deleteContact(addressBookId, contactId);
}