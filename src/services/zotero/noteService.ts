export class NoteService {
  async getNotes(
    itemId: number,
  ): Promise<Array<{ id: number; title: string; content: string }>> {
    // Step 6 中完整实现
    const item = await Zotero.Items.getAsync(itemId);
    if (!item) return [];

    const noteIds = item.getNotes();
    const notes: Array<{ id: number; title: string; content: string }> = [];

    for (const noteId of noteIds) {
      const note = await Zotero.Items.getAsync(noteId);
      if (!note) continue;
      notes.push({
        id: note.id,
        title: note.getNoteTitle() || "",
        content: note.getNote() || "",
      });
    }

    return notes;
  }

  async createNote(parentItemId: number, content: string): Promise<number> {
    const note = new Zotero.Item("note");
    note.libraryID = (await Zotero.Items.getAsync(parentItemId)).libraryID;
    note.parentID = parentItemId;
    note.setNote(content);
    await note.saveTx();
    return note.id;
  }
}
