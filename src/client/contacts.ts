import { BaseNextcloudClient } from './base';
import { AddressBook, Contact } from '../models/contacts';
import { XMLParser } from 'fast-xml-parser';

export class ContactsClient extends BaseNextcloudClient {
  private xmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    allowBooleanAttributes: true,
  });

  public async listAddressBooks(): Promise<AddressBook[]> {
    const propfindXml = `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:" xmlns:cs="http://calendarserver.org/ns/" xmlns:c="urn:ietf:params:xml:ns:carddav">
  <d:prop>
    <d:displayname />
    <d:resourcetype />
    <c:addressbook-description />
    <cs:getctag />
  </d:prop>
</d:propfind>`;

    try {
      const response = await this.makeWebDAVRequest({
        method: 'PROPFIND',
        url: '/remote.php/dav/addressbooks/users/{username}/',
        data: propfindXml,
        headers: {
          'Depth': '1',
        },
      });

      console.log('Raw addressbooks response:', response);
      const addressBooks = this.parseAddressBooksResponse(response);
      
      // If no address books found, assume default "contacts" exists
      if (addressBooks.length === 0) {
        console.log('No address books discovered, returning default "contacts"');
        return [{
          id: 'contacts',
          displayName: 'Contacts',
          description: 'Default address book',
          ctag: '',
        }];
      }
      
      return addressBooks;
    } catch (error) {
      console.error('Error listing address books:', error);
      console.error('Error details:', error);
      
      // Return default contacts as fallback
      return [{
        id: 'contacts',
        displayName: 'Contacts',
        description: 'Default address book',
        ctag: '',
      }];
    }
  }

  public async createAddressBook(
    displayName: string,
    description: string
  ): Promise<AddressBook> {
    // Generate a unique addressbook ID
    const addressBookId = `addressbook-${Date.now()}`;
    
    const mkcolXml = `<?xml version="1.0" encoding="utf-8" ?>
<d:mkcol xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:carddav">
  <d:set>
    <d:prop>
      <d:resourcetype>
        <d:collection />
        <c:addressbook />
      </d:resourcetype>
      <d:displayname>${displayName}</d:displayname>
      <c:addressbook-description>${description}</c:addressbook-description>
    </d:prop>
  </d:set>
</d:mkcol>`;

    await this.makeWebDAVRequest({
      method: 'MKCOL',
      url: `/remote.php/dav/addressbooks/users/{username}/${addressBookId}/`,
      data: mkcolXml,
    });

    return {
      id: addressBookId,
      displayName,
      description,
      ctag: '',
    };
  }

  public async deleteAddressBook(addressBookId: string): Promise<void> {
    await this.makeWebDAVRequest({
      method: 'DELETE',
      url: `/remote.php/dav/addressbooks/users/{username}/${addressBookId}/`,
    });
  }

  public async listContacts(addressBookId: string): Promise<Contact[]> {
    // Since REPORT is not supported, use PROPFIND to discover vCard files
    const propfindXml = `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="DAV:" xmlns:card="urn:ietf:params:xml:ns:carddav">
  <d:prop>
    <d:getetag />
    <d:getcontenttype />
    <card:address-data />
  </d:prop>
</d:propfind>`;

    try {
      const response = await this.makeWebDAVRequest({
        method: 'PROPFIND',
        url: `/remote.php/dav/addressbooks/users/{username}/${addressBookId}/`,
        data: propfindXml,
        headers: {
          'Depth': '1',
        },
      });

      console.log('Raw contacts response:', response);
      return this.parseContactsResponse(response);
    } catch (error) {
      console.error('Error listing contacts:', error);
      console.error('Error details:', error);
      return [];
    }
  }

  public async createContact(
    addressBookId: string,
    contact: Partial<Contact>
  ): Promise<Contact> {
    // Generate a unique contact ID
    const contactId = `contact-${Date.now()}.vcf`;
    
    // Create vCard content
    const vcard = this.createVCard(contact);

    await this.makeWebDAVRequest({
      method: 'PUT',
      url: `/remote.php/dav/addressbooks/users/{username}/${addressBookId}/${contactId}`,
      data: vcard,
      headers: {
        'Content-Type': 'text/vcard; charset=utf-8',
      },
    });

    return {
      id: contactId,
      addressBookId,
      ...contact,
    };
  }

  public async deleteContact(
    addressBookId: string,
    contactId: string
  ): Promise<void> {
    await this.makeWebDAVRequest({
      method: 'DELETE',
      url: `/remote.php/dav/addressbooks/users/{username}/${addressBookId}/${contactId}`,
    });
  }

  private parseAddressBooksResponse(xmlResponse: string): AddressBook[] {
    try {
      const parsed = this.xmlParser.parse(xmlResponse);
      const addressBooks: AddressBook[] = [];

      // Navigate to the multistatus responses
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
        const resourcetype = prop['d:resourcetype'];

        // Check if this is an addressbook - try different namespace variations
        const isAddressbook = resourcetype && (
          resourcetype['c:addressbook'] !== undefined ||
          resourcetype['card:addressbook'] !== undefined ||
          resourcetype.addressbook !== undefined
        );
        
        if (isAddressbook) {
          const displayname = prop['d:displayname'] || '';
          const description = prop['c:addressbook-description'] ||
                             prop['card:addressbook-description'] || '';
          const ctag = prop['cs:getctag'] ||
                      prop['x1:getctag'] ||
                      prop.getctag || '';

          // Extract addressbook ID from href
          const pathParts = href.split('/');
          const id = pathParts[pathParts.length - 2] || pathParts[pathParts.length - 1];

          console.log('Found addressbook:', { id, displayname, href, ctag });

          if (id && id !== 'users' && id !== this.username) {
            addressBooks.push({
              id,
              displayName: displayname,
              description,
              ctag,
            });
          }
        }
      }

      return addressBooks;
    } catch (error) {
      console.error('Error parsing addressbooks response:', error);
      console.error('XML Response:', xmlResponse);
      return [];
    }
  }

  private parseContactsResponse(xmlResponse: string): Contact[] {
    try {
      const parsed = this.xmlParser.parse(xmlResponse);
      const contacts: Contact[] = [];

      console.log('Parsed XML structure:', JSON.stringify(parsed, null, 2));

      // Try different namespace variations for multistatus
      const multistatus = parsed['d:multistatus'] ||
                         parsed['D:multistatus'] ||
                         parsed.multistatus;
      
      if (!multistatus) {
        console.log('No multistatus element found in response');
        return [];
      }

      const responses = multistatus['d:response'] ||
                       multistatus['D:response'] ||
                       multistatus.response;

      if (!responses) {
        console.log('No response elements found in multistatus');
        return [];
      }

      const responseArray = Array.isArray(responses) ? responses : [responses];

      for (const response of responseArray) {
        const href = response['d:href'] ||
                    response['D:href'] ||
                    response.href || '';
        
        const propstat = response['d:propstat'] ||
                        response['D:propstat'] ||
                        response.propstat;
        
        if (!propstat) {
          console.log('No propstat found for href:', href);
          continue;
        }

        const prop = propstat['d:prop'] ||
                    propstat['D:prop'] ||
                    propstat.prop;
                    
        if (!prop) {
          console.log('No prop found for href:', href);
          continue;
        }

        const addressData = prop['c:address-data'] ||
                           prop['C:address-data'] ||
                           prop['card:address-data'] ||
                           prop['address-data'];

        if (addressData && href.endsWith('.vcf')) {
          console.log('Found contact vCard:', {
            href,
            addressDataLength: addressData.length,
            addressDataPreview: addressData.substring(0, 100)
          });
          
          // Decode HTML entities
          const decodedVCard = this.decodeHtmlEntities(addressData);
          const contact = this.parseVCard(decodedVCard);
          const pathParts = href.split('/');
          const id = pathParts[pathParts.length - 1];
          const etag = prop['d:getetag'] ||
                      prop['D:getetag'] ||
                      prop.getetag || '';
          contacts.push({
            id,
            etag,
            uri: href,
            ...contact
          });
        } else if (href) {
          console.log('Skipping non-vCard resource:', href, {
            hasAddressData: !!addressData,
            addressDataKeys: Object.keys(prop).filter(k => k.includes('address'))
          });
        }
      }

      console.log(`Found ${contacts.length} contacts`);
      return contacts;
    } catch (error) {
      console.error('Error parsing contacts response:', error);
      console.error('XML Response:', xmlResponse);
      return [];
    }
  }

  private parseVCard(vcardData: string): Partial<Contact> {
    const contact: Partial<Contact> = {};
    const lines = vcardData.split(/\r?\n/);

    for (const line of lines) {
      const [property, value] = line.split(':');
      if (!property || !value) continue;

      const propName = property.split(';')[0];

      switch (propName) {
        case 'FN':
          contact.fn = value;
          break;
        case 'EMAIL':
          if (!contact.email) contact.email = [];
          contact.email.push(value);
          break;
        case 'TEL':
          if (!contact.tel) contact.tel = [];
          contact.tel.push(value);
          break;
        case 'ADR':
          if (!contact.adr) contact.adr = [];
          contact.adr.push(value);
          break;
        case 'ORG':
          if (!contact.org) contact.org = [];
          contact.org.push(value);
          break;
        case 'NOTE':
          contact.note = value;
          break;
      }
    }

    return contact;
  }

  private createVCard(contact: Partial<Contact>): string {
    let vcard = 'BEGIN:VCARD\nVERSION:3.0\n';

    if (contact.fn) {
      vcard += `FN:${contact.fn}\n`;
    }

    if (contact.email) {
      for (const email of contact.email) {
        vcard += `EMAIL:${email}\n`;
      }
    }

    if (contact.tel) {
      for (const tel of contact.tel) {
        vcard += `TEL:${tel}\n`;
      }
    }

    if (contact.adr) {
      for (const adr of contact.adr) {
        vcard += `ADR:${adr}\n`;
      }
    }

    if (contact.org) {
      for (const org of contact.org) {
        vcard += `ORG:${org}\n`;
      }
    }

    if (contact.note) {
      vcard += `NOTE:${contact.note}\n`;
    }

    vcard += 'END:VCARD';
    return vcard;
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