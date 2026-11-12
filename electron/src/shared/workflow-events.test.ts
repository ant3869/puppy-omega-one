import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  changeWorkflowConnection,
  initialWorkflow,
  reduceWorkflowEvent
} from './workflow-events';

test('turn start resets worker state without claiming successful verification', () => {
  let state = initialWorkflow('connected');
  state = reduceWorkflowEvent(state, { type: 'turn_start', agent: 'omega-orchestrator' }, 10);
  assert.equal(state.phase, 'planning');
  assert.equal(state.turnCount, 1);
  assert.equal(state.workers['omega-builder'].phase, 'idle');
  state = reduceWorkflowEvent(state, {
    type: 'message',
    kind: 'SubAgentInvocationMessage',
    data: { agent_name: 'omega-builder', prompt: 'Build report page', model_name: 'selected-model' }
  }, 20);
  assert.equal(state.phase, 'delegating');
  assert.equal(state.workers['omega-builder'].phase, 'running');
  assert.equal(state.workers['omega-builder'].model, 'selected-model');
  state = reduceWorkflowEvent(state, {
    type: 'message',
    kind: 'SubAgentResponseMessage',
    data: { agent_name: 'omega-builder', response: 'The code is ready' }
  }, 30);
  assert.equal(state.workers['omega-builder'].phase, 'responded');
  state = reduceWorkflowEvent(state, { type: 'turn_end' }, 40);
  assert.equal(state.phase, 'finished');
  assert.match(state.activity, /verification not confirmed/);
});

test('errors stay visible when turn_end follows', () => {
  let state = reduceWorkflowEvent(initialWorkflow('connected'), { type: 'turn_start', agent: 'omega' }, 1);
  state = reduceWorkflowEvent(state, { type: 'error', text: 'The provider is unavailable' }, 2);
  state = reduceWorkflowEvent(state, { type: 'turn_end' }, 3);
  assert.equal(state.phase, 'attention');
  assert.equal(state.attention?.kind, 'error');
  assert.equal(state.lastEventAt, 3);
});

test('confirmation and input requests never get automatically approved', () => {
  let state = reduceWorkflowEvent(initialWorkflow('connected'), {
    type: 'request',
    kind: 'ConfirmationRequest',
    data: { title: 'Delete a file?', prompt_id: 'secret-prompt-id' }
  }, 10);
  assert.equal(state.phase, 'attention');
  assert.equal(state.attention?.kind, 'request');
  assert.doesNotMatch(JSON.stringify(state), /secret-prompt-id/);
  state = reduceWorkflowEvent(state, {
    type: 'request',
    kind: 'UserInputRequest',
    data: { input_type: 'password', prompt_text: 'Enter secret password' }
  }, 20);
  assert.doesNotMatch(JSON.stringify(state), /secret password/);
});

test('failure status targets only the named worker; unrecognized agents are ignored', () => {
  let state = initialWorkflow('connected');
  const raw = {
    type: 'message',
    kind: 'SubAgentStatusMessage',
    data: { agent_name: 'omega-tester', status: 'error', error_message: 'Check exit code 2' }
  };
  state = reduceWorkflowEvent(state, raw, 20);
  assert.equal(state.workers['omega-tester'].phase, 'failed');
  assert.equal(state.workers['omega-builder'].phase, 'idle');
  assert.equal(state.phase, 'attention');
  assert.equal(reduceWorkflowEvent(state, {
    type: 'message',
    kind: 'SubAgentResponseMessage',
    data: { agent_name: 'unknown-external-agent', response: 'done' }
  }, 30), state);
});

test('invalid event payloads are ignored safely', () => {
  const state = initialWorkflow();
  for (const payload of [null, [], {}, { type: 5 }, 'not json', { type: 'message', data: [] }]) {
    assert.equal(reduceWorkflowEvent(state, payload, 1), state);
  }
});

test('activity queue stays bounded and displayed text is brief', () => {
  let state = initialWorkflow('connected');
  for (let n = 0; n < 70; n++) {
    state = reduceWorkflowEvent(state, {
      type: 'message',
      kind: 'SubAgentInvocationMessage',
      data: { agent_name: 'omega_researcher', prompt: 'task '.repeat(1000) }
    }, n);
  }
  assert.equal(state.events.length, 30);
  assert.equal(state.events.at(-1)?.id, 70);
  assert.ok(state.workers['omega-researcher'].detail.length <= 105);
  assert.equal(state.workers['omega-researcher'].updatedAt, 69);
});

test('disconnect is explicit and does not erase the last event history', () => {
  let state = reduceWorkflowEvent(initialWorkflow('connected'), { type: 'turn_start', agent: 'orchestrator' }, 123);
  state = changeWorkflowConnection(state, 'disconnected');
  assert.equal(state.connection, 'disconnected');
  assert.match(state.activity, /stale/);
  assert.equal(state.lastEventAt, 123);
  assert.equal(changeWorkflowConnection(state, 'disconnected'), state);
});

test('cancellation does not become a successful completion', () => {
  const state = reduceWorkflowEvent(initialWorkflow('connected'), { type: 'turn_cancelled' }, 8);
  assert.equal(state.phase, 'cancelled');
});
