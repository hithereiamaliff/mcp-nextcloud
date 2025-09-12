export interface AddressBook {
  id: string;
  displayName: string;
  description: string;
  ctag: string;
  uri?: string;
}

export interface Contact {
  id: string;
  fn?: string;
  email?: string[];
  tel?: string[];
  adr?: string[];
  org?: string[];
  note?: string;
  etag?: string;
  uri?: string;
  addressBookId?: string;
  lastmodified?: number;
}