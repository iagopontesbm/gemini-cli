/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { SchemaValidator } from './schemaValidator.js';

describe('SchemaValidator', () => {
  describe('validate', () => {
    it('should return null for valid objects', () => {
      const schema = {
        type: 'object',
        required: ['name', 'age'],
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
          email: { type: 'string' },
        },
      };

      const validData = {
        name: 'John Doe',
        age: 30,
        email: 'john@example.com',
      };

      const result = SchemaValidator.validate(schema, validData);
      expect(result).toBeNull();
    });

    it('should return error for missing required fields', () => {
      const schema = {
        type: 'object',
        required: ['name', 'age'],
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
      };

      const invalidData = {
        name: 'John Doe',
        // missing 'age'
      };

      const result = SchemaValidator.validate(schema, invalidData);
      expect(result).toBe("Missing required field: 'age'");
    });

    it('should return error for type mismatches', () => {
      const schema = {
        type: 'object',
        required: ['name', 'age'],
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
      };

      const invalidData = {
        name: 'John Doe',
        age: 'thirty', // should be number
      };

      const result = SchemaValidator.validate(schema, invalidData);
      expect(result).toBe("Type mismatch for property 'age': expected number, got string");
    });

    it('should return error for array type validation', () => {
      const schema = {
        type: 'object',
        properties: {
          tags: { type: 'array' },
        },
      };

      const invalidData = {
        tags: 'not-an-array',
      };

      const result = SchemaValidator.validate(schema, invalidData);
      expect(result).toBe("Type mismatch for property 'tags': expected array, got string");
    });

    it('should validate arrays correctly', () => {
      const schema = {
        type: 'object',
        properties: {
          tags: { type: 'array' },
        },
      };

      const validData = {
        tags: ['tag1', 'tag2'],
      };

      const result = SchemaValidator.validate(schema, validData);
      expect(result).toBeNull();
    });

    it('should return error for non-object data', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      };

      const result = SchemaValidator.validate(schema, 'not-an-object');
      expect(result).toBe('Expected an object, but received string');
    });

    it('should return error for null data', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      };

      const result = SchemaValidator.validate(schema, null);
      expect(result).toBe('Expected an object, but received object');
    });

    it('should validate minimum value for numbers', () => {
      const schema = {
        type: 'object',
        properties: {
          count: { type: 'number', minimum: 1 },
        },
      };

      const invalidData = {
        count: 0,
      };

      const result = SchemaValidator.validate(schema, invalidData);
      expect(result).toBe("Property 'count' must be at least 1, but got 0");
    });

    it('should pass minimum value validation for valid numbers', () => {
      const schema = {
        type: 'object',
        properties: {
          count: { type: 'number', minimum: 1 },
        },
      };

      const validData = {
        count: 5,
      };

      const result = SchemaValidator.validate(schema, validData);
      expect(result).toBeNull();
    });

    it('should validate objects without required fields', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
      };

      const validData = {
        name: 'John Doe',
        // age is optional
      };

      const result = SchemaValidator.validate(schema, validData);
      expect(result).toBeNull();
    });

    it('should validate empty objects when no required fields', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      };

      const result = SchemaValidator.validate(schema, {});
      expect(result).toBeNull();
    });

    it('should handle schemas without properties', () => {
      const schema = {
        type: 'object',
        required: ['name'],
      };

      const invalidData = {};

      const result = SchemaValidator.validate(schema, invalidData);
      expect(result).toBe("Missing required field: 'name'");
    });

    it('should handle properties without type', () => {
      const schema = {
        type: 'object',
        properties: {
          name: {}, // no type specified
        },
      };

      const validData = {
        name: 'anything',
      };

      const result = SchemaValidator.validate(schema, validData);
      expect(result).toBeNull();
    });
  });

  describe('isValid (legacy method)', () => {
    it('should return true for valid data', () => {
      const schema = {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
        },
      };

      const validData = {
        name: 'John Doe',
      };

      const result = SchemaValidator.isValid(schema, validData);
      expect(result).toBe(true);
    });

    it('should return false for invalid data', () => {
      const schema = {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
        },
      };

      const invalidData = {
        // missing 'name'
      };

      const result = SchemaValidator.isValid(schema, invalidData);
      expect(result).toBe(false);
    });
  });
}); 