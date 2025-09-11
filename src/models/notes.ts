export interface Note {
  id: number;
  etag: string;
  title: string;
  content: string;
  category: string;
  favorite: boolean;
  modified: number;
}

export interface NotesSettings {
  notesPath: string;
  fileSuffix: string;
}

export interface CreateNoteResponse {
  id: number;
  title: string;
  category: string;
  etag: string;
}

export interface UpdateNoteResponse {
  id: number;
  title: string;
  category: string;
  etag: string;
}

export interface DeleteNoteResponse {
  status_code: number;
  message: string;
  deleted_id: number;
}

export interface AppendContentResponse {
  id: number;
  title: string;
  category: string;
  etag: string;
}

export interface NoteSearchResult {
  id: number;
  title: string;
  category: string;
  score?: number;
}

export interface SearchNotesResponse {
  results: NoteSearchResult[];
  query: string;
  total_found: number;
}