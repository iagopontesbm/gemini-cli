/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Simple utility to validate objects against JSON Schemas
 */
export class SchemaValidator {
  /**
   * Validates data against a JSON schema
   * @param schema JSON Schema to validate against
   * @param data Data to validate
   * @returns Detailed error message if validation fails, null if valid
   */
  static validate(schema: Record<string, unknown>, data: unknown): string | null {
    // This is a simplified implementation
    // In a real application, you would use a library like Ajv for proper validation

    if (typeof data !== 'object' || data === null) {
      return `Expected an object, but received ${data === null ? 'null' : typeof data}`;
    }

    const dataObj = data as Record<string, unknown>;

    // Check for required fields
    if (schema.required && Array.isArray(schema.required)) {
      const required = schema.required as string[];

      for (const field of required) {
        if (dataObj[field] === undefined) {
          return `Missing required field: '${field}'`;
        }
      }
    }

    // Check property types if properties are defined
    if (schema.properties && typeof schema.properties === 'object') {
      const properties = schema.properties as Record<string, { type?: string; minimum?: number }>;

      for (const [key, prop] of Object.entries(properties)) {
        if (dataObj[key] !== undefined && prop.type) {
          const expectedType = prop.type;
          const actualType = Array.isArray(dataObj[key])
            ? 'array'
            : typeof dataObj[key];

          if (expectedType !== actualType) {
            return `Type mismatch for property '${key}': expected ${expectedType}, got ${actualType}`;
          }

          // Check minimum value for numbers
          if (expectedType === 'number' && prop.minimum !== undefined) {
            const numValue = dataObj[key] as number;
            if (numValue < prop.minimum) {
              return `Property '${key}' must be at least ${prop.minimum}, but got ${numValue}`;
            }
          }
        }
      }
    }

    return null; // Valid
  }

  /**
   * Legacy method for backward compatibility
   * @deprecated Use validate() method instead which returns detailed error messages
   */
  static isValid(schema: Record<string, unknown>, data: unknown): boolean {
    return this.validate(schema, data) === null;
  }
}
