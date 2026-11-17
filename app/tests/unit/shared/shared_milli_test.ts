import { expect, it } from 'vitest';
import { GridError, clampAxis, milliToPoints, toAxisMilli, toMilli } from '../../../src/shared/milli';

it('test_on_grid_points_convert_exactly', () => {
  expect(toMilli(0.3)).toBe(300);
  expect(toMilli(-0.2)).toBe(-200);
  expect(toMilli(82.5)).toBe(82_500);
  expect(toMilli(-0)).toBe(0);
  expect(Object.is(toMilli(-0), -0)).toBe(false);
});

it('test_off_grid_or_float_artefact_refused', () => {
  expect(() => toMilli(0.0005)).toThrow(GridError);
  expect(() => toMilli(0.1 + 0.2)).toThrow(GridError); // 0.30000000000000004
  expect(() => toMilli(Number.NaN)).toThrow(GridError);
  expect(() => toMilli(Number.POSITIVE_INFINITY)).toThrow(GridError);
  expect(() => toMilli(1.005, 10)).toThrow(GridError); // couplingScale, grille 0,01
  expect(toMilli(0.8, 10)).toBe(800);
});

it('test_axis_bounds_enforced', () => {
  expect(() => toAxisMilli(100.001)).toThrow(GridError);
  expect(() => toAxisMilli(-0.001)).toThrow(GridError);
  expect(toAxisMilli(100)).toBe(100_000);
  expect(clampAxis(-5)).toBe(0);
  expect(clampAxis(100_400)).toBe(100_000);
  expect(clampAxis(42_000)).toBe(42_000);
});

it('test_clamp_refuses_non_integer_state_value', () => {
  expect(() => clampAxis(0.5)).toThrow(GridError);
  expect(() => clampAxis(Number.NaN)).toThrow(GridError);
});

it('test_milli_to_points_is_display_boundary', () => {
  expect(milliToPoints(toMilli(82.5))).toBe(82.5);
});
