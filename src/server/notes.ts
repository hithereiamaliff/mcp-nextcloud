import {
  Note,
  CreateNoteResponse,
  UpdateNoteResponse,
  DeleteNoteResponse,
  AppendContentResponse,
  SearchNotesResponse,
  NoteSearchResult,
} from '../models/notes';
import { NotesClient } from '../client/notes';
import { getClient } from '../app';

export async function getNote(note_id: number): Promise<Note> {
  return getClient(NotesClient).getNote(note_id);
}

export async function nc_notes_create_note(
  title: string,
  content: string,
  category: string
): Promise<CreateNoteResponse> {
  const note = await getClient(NotesClient).createNote(title, content, category);
  return {
    id: note.id,
    title: note.title,
    category: note.category,
    etag: note.etag,
  };
}

export async function nc_notes_update_note(
  note_id: number,
  etag: string,
  title?: string,
  content?: string,
  category?: string
): Promise<UpdateNoteResponse> {
  const note = await getClient(NotesClient).updateNote(
    note_id,
    etag,
    title,
    content,
    category
  );
  return {
    id: note.id,
    title: note.title,
    category: note.category,
    etag: note.etag,
  };
}

export async function nc_notes_append_content(
  note_id: number,
  content: string
): Promise<AppendContentResponse> {
  const note = await getClient(NotesClient).getNote(note_id);
  const newContent = `${note.content}\n---\n${content}`;
  const updatedNote = await getClient(NotesClient).updateNote(
    note_id,
    note.etag,
    undefined,
    newContent
  );
  return {
    id: updatedNote.id,
    title: updatedNote.title,
    category: updatedNote.category,
    etag: updatedNote.etag,
  };
}

export async function nc_notes_delete_note(
  note_id: number
): Promise<DeleteNoteResponse> {
  await getClient(NotesClient).deleteNote(note_id);
  return {
    status_code: 200,
    message: `Note ${note_id} deleted successfully`,
    deleted_id: note_id,
  };
}

export async function nc_notes_search_notes(
  query: string
): Promise<SearchNotesResponse> {
  const notes = await getClient(NotesClient).getAllNotes();
  const results = notes
    .filter(
      (note: Note) =>
        note.title.includes(query) || note.content.includes(query)
    )
    .map(
      (note: Note): NoteSearchResult => ({
        id: note.id,
        title: note.title,
        category: note.category,
      })
    );
  return {
    results,
    query,
    total_found: results.length,
  };
}