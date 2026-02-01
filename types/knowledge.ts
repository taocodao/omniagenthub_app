// types/knowledge.ts
export interface SourceSummary {
  summary: string;
  generated: string;
  sourceId: string;
  notebookId: string;
  cached?: boolean;
}

export interface NotebookSourceWithSummary {
  id: string;
  title: string;
  type: 'file' | 'website' | 'text';
  status: string;
  fileSize?: string;
  dateCreated: string;
  sourceType?: string;
  sourceUrl?: string;
  summary?: string;
}

export interface NotebookWithExpandedSources {
  id: string;
  title: string;
  sources: NotebookSourceWithSummary[];
  isExpanded: boolean;
}

export interface SelectedSource {
  notebookId: string;
  sourceId: string;
}
