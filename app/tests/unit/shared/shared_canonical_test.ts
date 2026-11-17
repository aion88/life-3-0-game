import { expect, it } from 'vitest';
import { canonicalJson } from '../../../src/shared/canonical';

it('test_canonical_json_key_order_and_refusals', () => {
  expect(canonicalJson({ b: 1, a: [2, { d: -0, c: 3 }] })).toBe('{"a":[2,{"c":3,"d":0}],"b":1}');
  expect(() => canonicalJson({ x: Number.NaN })).toThrow();
  expect(() => canonicalJson({ x: Infinity })).toThrow();
});

it.each([
  ['map', new Map([[1, 2]])],
  ['set', new Set([1])],
  ['date', new Date(0)],
  ['class instance', new (class Foo { x = 1; })()],
  ['bigint', 1n],
  ['function', () => 1],
  ['symbol', Symbol('s')],
  ['top-level undefined', undefined],
])('test_canonical_json_refuses_%s', (_name, value) => {
  expect(() => canonicalJson(value)).toThrow(TypeError);
  expect(() => canonicalJson({ a: [value] })).toThrow(TypeError);
});

it('test_canonical_json_refuses_undefined_in_array_with_path', () => {
  expect(() => canonicalJson({ a: [1, undefined] })).toThrow(/a\.1|a\[1\]/);
});

it('test_canonical_json_drops_undefined_property', () => {
  expect(canonicalJson({ a: 1, b: undefined })).toBe('{"a":1}');
});

it('test_canonical_json_keeps_proto_key_and_null_prototype', () => {
  const o = JSON.parse('{"__proto__":{"x":1},"a":2}') as unknown;
  expect(canonicalJson(o)).toBe('{"__proto__":{"x":1},"a":2}');
  expect(canonicalJson(Object.assign(Object.create(null) as object, { k: 1 }))).toBe('{"k":1}');
});
