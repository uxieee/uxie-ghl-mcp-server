export interface CatalogAction {
  id: string;
  category: string;
  method: string;
  path: string;
  summary: string;
  description: string;
  tags: string[];
  scopes: string[];
  parameters: ParameterInfo[];
  requestBody: RequestBodyInfo | null;
  versionHeader: string | null;
}

export interface ParameterInfo {
  name: string;
  in: string;
  required: boolean;
  description: string;
  type: string;
  enum?: string[];
}

export interface RequestBodyInfo {
  required: boolean;
  contentType: string;
  schema: Record<string, unknown>;
}

export interface Catalog {
  generatedAt: string;
  baseUrl: string;
  totalActions: number;
  categories: string[];
  actions: CatalogAction[];
}
