import { BaseNextcloudClient } from './base';
import { Note } from '../models/notes';

export class NotesClient extends BaseNextcloudClient {
  public async getAllNotes(): Promise<Note[]> {
    return this.makeRequest<Note[]>({
      method: 'GET',
      url: '/apps/notes/api/v1/notes',
    });
  }

  public async getNote(noteId: number): Promise<Note> {
    return this.makeRequest<Note>({
      method: 'GET',
      url: `/apps/notes/api/v1/notes/${noteId}`,
    });
  }

  public async createNote(
    title: string,
    content: string,
    category: string
  ): Promise<Note> {
    return this.makeRequest<Note>({
      method: 'POST',
      url: '/apps/notes/api/v1/notes',
      data: { title, content, category },
    });
  }

  public async updateNote(
    noteId: number,
    etag: string,
    title?: string,
    content?: string,
    category?: string
  ): Promise<Note> {
    return this.makeRequest<Note>({
      method: 'PUT',
      url: `/apps/notes/api/v1/notes/${noteId}`,
      headers: { 'If-Match': etag },
      data: { title, content, category },
    });
  }

  public async deleteNote(noteId: number): Promise<void> {
    await this.makeRequest<void>({
      method: 'DELETE',
      url: `/apps/notes/api/v1/notes/${noteId}`,
    });
  }
}