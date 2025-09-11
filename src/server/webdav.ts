import { WebDAVClient } from '../client/webdav';
import { getClient } from '../app';

export async function nc_webdav_list_directory(path: string): Promise<any> {
  return getClient(WebDAVClient).listDirectory(path);
}

export async function nc_webdav_read_file(path: string): Promise<string> {
  return getClient(WebDAVClient).readFile(path);
}

export async function nc_webdav_write_file(
  path: string,
  content: string
): Promise<void> {
  await getClient(WebDAVClient).writeFile(path, content);
}

export async function nc_webdav_create_directory(path: string): Promise<void> {
  await getClient(WebDAVClient).createDirectory(path);
}

export async function nc_webdav_delete_resource(path: string): Promise<void> {
  await getClient(WebDAVClient).deleteResource(path);
}