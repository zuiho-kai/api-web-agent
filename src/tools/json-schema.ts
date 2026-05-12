export type JSONSchema7TypeName =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'object'
  | 'array'
  | 'null';

export interface JSONSchema7 {
  type?: JSONSchema7TypeName | JSONSchema7TypeName[];
  description?: string;
  properties?: Record<string, JSONSchema7>;
  required?: string[];
  items?: JSONSchema7;
  enum?: unknown[];
  default?: unknown;
  additionalProperties?: boolean | JSONSchema7;
}
