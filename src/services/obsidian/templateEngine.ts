export class TemplateEngine {
  private defaultTemplate = `---
title: "{{title}}"
authors: [{{authors}}]
year: {{year}}
doi: "{{doi}}"
citekey: "{{citekey}}"
tags: []
---

# {{title}}

## Metadata
- **Authors**: {{authors}}
- **Year**: {{year}}
- **Journal**: {{journal}}
- **DOI**: {{doi}}

## Abstract
{{abstract}}

## Notes
{{notes}}

## Annotations
{{annotations}}
`;

  render(template: string | null, variables: Record<string, string>): string {
    const tmpl = template || this.defaultTemplate;
    return tmpl.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
      return variables[key] || "";
    });
  }

  getDefaultTemplate(): string {
    return this.defaultTemplate;
  }
}
