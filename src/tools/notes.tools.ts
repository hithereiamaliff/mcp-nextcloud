import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getClient } from '../index.js';
import { NotesClient } from '../client/notes.js';

/**
 * Register Notes tools with the MCP server
 * @param server MCP server instance
 */
export function registerNotesTools(server: McpServer) {
  server.tool(
    'nc_notes_create_note',
    'Create a new note in Nextcloud Notes',
    {
      title: z.string().describe('The title of the note'),
      content: z.string().describe('The content of the note'),
      category: z.string().describe('The category of the note'),
    },
    async ({ title, content, category }) => {
      const note = await getClient(NotesClient).createNote(title, content, category);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              id: note.id,
              title: note.title,
              category: note.category,
              etag: note.etag,
            }, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'nc_notes_update_note',
    'Update an existing note in Nextcloud Notes',
    {
      note_id: z.number().describe('The ID of the note to update'),
      etag: z.string().describe('The etag of the note for concurrency control'),
      title: z.string().optional().describe('The new title of the note'),
      content: z.string().optional().describe('The new content of the note'),
      category: z.string().optional().describe('The new category of the note'),
    },
    async ({ note_id, etag, title, content, category }) => {
      const note = await getClient(NotesClient).updateNote(note_id, etag, title, content, category);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              id: note.id,
              title: note.title,
              category: note.category,
              etag: note.etag,
            }, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'nc_notes_append_content',
    'Append content to an existing note',
    {
      note_id: z.number().describe('The ID of the note to append to'),
      content: z.string().describe('The content to append'),
    },
    async ({ note_id, content }) => {
      const note = await getClient(NotesClient).getNote(note_id);
      const newContent = `${note.content}\n---\n${content}`;
      const updatedNote = await getClient(NotesClient).updateNote(
        note_id,
        note.etag,
        undefined,
        newContent
      );
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              id: updatedNote.id,
              title: updatedNote.title,
              category: updatedNote.category,
              etag: updatedNote.etag,
            }, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'nc_notes_search_notes',
    'Search for notes in Nextcloud Notes',
    {
      query: z.string().describe('The search query'),
    },
    async ({ query }) => {
      const notes = await getClient(NotesClient).getAllNotes();
      const results = notes
        .filter((note: any) => note.title.includes(query) || note.content.includes(query))
        .map((note: any) => ({
          id: note.id,
          title: note.title,
          category: note.category,
        }));
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              results,
              query,
              total_found: results.length,
            }, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'nc_notes_delete_note',
    'Delete a note from Nextcloud Notes',
    {
      note_id: z.number().describe('The ID of the note to delete'),
    },
    async ({ note_id }) => {
      await getClient(NotesClient).deleteNote(note_id);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status_code: 200,
              message: `Note ${note_id} deleted successfully`,
              deleted_id: note_id,
            }, null, 2),
          },
        ],
      };
    }
  );
}