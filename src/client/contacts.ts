import { BaseNextcloudClient } from './base';
import { AddressBook, Contact } from '../models/contacts';

export class ContactsClient extends BaseNextcloudClient {
  public async listAddressBooks(): Promise<AddressBook[]> {
    return this.makeRequest<AddressBook[]>({
      method: 'GET',
      url: '/remote.php/dav/addressbooks/users/{username}',
    });
  }

  public async createAddressBook(
    displayName: string,
    description: string
  ): Promise<AddressBook> {
    return this.makeRequest<AddressBook>({
      method: 'POST',
      url: '/remote.php/dav/addressbooks/users/{username}',
      data: { displayName, description },
    });
  }

  public async deleteAddressBook(addressBookId: string): Promise<void> {
    await this.makeRequest<void>({
      method: 'DELETE',
      url: `/remote.php/dav/addressbooks/users/{username}/${addressBookId}`,
    });
  }

  public async listContacts(addressBookId: string): Promise<Contact[]> {
    return this.makeRequest<Contact[]>({
      method: 'GET',
      url: `/remote.php/dav/addressbooks/users/{username}/${addressBookId}`,
    });
  }

  public async createContact(
    addressBookId: string,
    contact: Partial<Contact>
  ): Promise<Contact> {
    return this.makeRequest<Contact>({
      method: 'POST',
      url: `/remote.php/dav/addressbooks/users/{username}/${addressBookId}`,
      data: contact,
    });
  }

  public async deleteContact(
    addressBookId: string,
    contactId: string
  ): Promise<void> {
    await this.makeRequest<void>({
      method: 'DELETE',
      url: `/remote.php/dav/addressbooks/users/{username}/${addressBookId}/${contactId}`,
    });
  }
}