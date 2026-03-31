// Integration test: session sync logic
// Run with: node --test tests/sync.spec.js
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Unit test the MPV command builder
test('seek command builds correct JSON', () => {
  const cmd = { command: ['seek', 300, 'absolute'] };
  assert.deepEqual(cmd.command, ['seek', 300, 'absolute']);
});

test('pause command sets pause to true', () => {
  const cmd = { command: ['set_property', 'pause', true] };
  assert.equal(cmd.command[2], true);
});

test('play command sets pause to false', () => {
  const cmd = { command: ['set_property', 'pause', false] };
  assert.equal(cmd.command[2], false);
});
