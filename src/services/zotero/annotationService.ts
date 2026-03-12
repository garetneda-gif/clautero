export class AnnotationService {
  async getAnnotations(
    itemId: number,
  ): Promise<
    Array<{
      text: string;
      comment: string;
      color: string;
      page: number;
      type: string;
    }>
  > {
    // Step 6 中完整实现
    const item = await Zotero.Items.getAsync(itemId);
    if (!item) return [];

    const attachments = item.getAttachments();
    const annotations: Array<{
      text: string;
      comment: string;
      color: string;
      page: number;
      type: string;
    }> = [];

    for (const attId of attachments) {
      const att = await Zotero.Items.getAsync(attId);
      if (!att || !att.isPDFAttachment?.()) continue;

      const annots = att.getAnnotations();
      for (const annot of annots) {
        annotations.push({
          text: annot.annotationText || "",
          comment: annot.annotationComment || "",
          color: annot.annotationColor || "",
          page: annot.annotationPageLabel
            ? parseInt(annot.annotationPageLabel)
            : 0,
          type: annot.annotationType || "highlight",
        });
      }
    }

    return annotations;
  }
}
