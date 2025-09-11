export interface AddressBook {
  id: string;
  uri: string;
  displayname: string;
  description: string;
  synctoken: string;
}

export interface Contact {
  id: string;
  etag: string;
  uri: string;
  addressBookId: string;
  lastmodified: number;
  fn: string;
  email: string[];
  tel: string[];
  adr: string[];
  org: string[];
  note: string;
}