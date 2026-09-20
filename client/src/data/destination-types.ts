// Shared types for the generic-HTTP destination wizard.

export type GenericAuthType = "none" | "bearer" | "basic" | "header";

export interface GenericAuthConfig {
  type: GenericAuthType;
  /** For bearer/header: the value placed in the Authorization (or custom) header. */
  token?: string;
  /** For basic auth. */
  username?: string;
  password?: string;
  /** For "header" type, allows an explicit header name (default: Authorization). */
  headerName?: string;
}

export interface GenericHttpAction {
  url: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers: Array<{ name: string; value: string }>;
  bodyTemplate: string;
  auth: GenericAuthConfig;
}

export type FilterOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "greater_than"
  | "less_than";

export interface RecipeFilter {
  campaignIds: string[];
  condition: {
    field: string;
    op: FilterOperator;
    value: string;
  } | null;
}
