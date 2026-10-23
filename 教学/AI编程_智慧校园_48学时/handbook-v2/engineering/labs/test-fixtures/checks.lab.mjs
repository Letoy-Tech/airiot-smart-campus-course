// 只在独立生成的练习目录显式运行：node --test checks.lab.mjs
// 源样本刻意失败，不加入普通构建，不用skip或删断言凑通过。
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatReading } from './readings.mjs';

test('positive reading keeps its value and unit', () => {
    assert.equal(formatReading(12.5, 'kW'), '12.5 kW');
});

test('zero is a valid reading', () => {
    assert.equal(formatReading(0, 'kW'), '0 kW');
});

test('null is explicitly missing', () => {
    assert.equal(formatReading(null, 'kW'), '缺失');
});

test('NaN is rejected rather than shown as missing', () => {
    assert.throws(() => formatReading(Number.NaN), TypeError);
});

test('infinite values are rejected', () => {
    assert.throws(() => formatReading(Number.POSITIVE_INFINITY), TypeError);
});

test('numeric strings are not silently converted', () => {
    assert.throws(() => formatReading('0'), TypeError);
});

test('empty unit does not invent a unit', () => {
    assert.equal(formatReading(4, ''), '4');
});
