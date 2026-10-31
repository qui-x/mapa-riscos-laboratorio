import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const context = { console, crypto: { randomUUID: () => 'test-id' } };
vm.createContext(context);

for (const file of ['js/types.js', 'js/geometry.js', 'js/validation.js']) {
  const code = fs.readFileSync(path.join(root, file), 'utf8');
  vm.runInContext(code, context, { filename: file });
}
vm.runInContext(`Object.assign(globalThis, { TYPES, RISK_TYPES, TIPOS_BASE, TIPOS_APOIADOS, EXIT_CLEARANCE, MODELOS, getObjectCorners, getIntersectionArea, canOverlapAsSupportedPair, isExitClearanceBlocked, calculateDoorBlockRatio, validateObject });`, context);

assert.equal(context.TYPES.door[0], 'Porta');
assert.equal(context.RISK_TYPES.length, 8);
assert.equal(context.EXIT_CLEARANCE, 1.2);
assert.equal(context.MODELOS.length, 2);

const bench = { id: 'b', type: 'bench', x: 0, y: 0, w: 2, h: 1, rot: 0 };
const equipment = { id: 'e', type: 'equipment', x: 0.2, y: 0.2, w: 0.5, h: 0.4, rot: 0 };
assert.ok(context.TIPOS_BASE.includes(bench.type));
assert.ok(context.TIPOS_APOIADOS.includes(equipment.type));
assert.equal(context.canOverlapAsSupportedPair(bench, equipment), true);
assert.ok(context.getIntersectionArea(bench, equipment) > 0);

const corners = context.getObjectCorners({ x: 0, y: 0, w: 2, h: 1, rot: 90 });
assert.equal(corners.length, 4);

const door = { id: 'd', type: 'door', x: 0, y: 0, w: 1, h: 0.12, rot: 0 };
const blocker = { id: 'x', type: 'bench', x: 0.25, y: 0, w: 0.25, h: 0.5, rot: 0 };
assert.ok(context.calculateDoorBlockRatio(door, blocker) > 0);
assert.equal(context.isExitClearanceBlocked(door, [door, blocker]), true);

const room = { w: 10, h: 8 };
const result = context.validateObject(equipment, [bench, equipment], room);
assert.equal(result.valid, true);

console.log('Core smoke tests: OK');
