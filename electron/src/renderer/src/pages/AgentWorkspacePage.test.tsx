import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AgentWorkspacePage, { type WorkspaceMode } from './AgentWorkspacePage';

function render(mode: WorkspaceMode, reduceMotion = true): string {
  return renderToStaticMarkup(
    React.createElement(AgentWorkspacePage, {
      mode,
      status: { running: false, spawnedByUs: false, port: 8765, url: 'http://127.0.0.1:8765' },
      projectDir: null,
      reduceMotion,
      onModeChange: () => undefined,
      onProjectChange: () => undefined,
      onStatusChange: () => undefined,
      onCompose: () => undefined,
      onSavedActivity: () => undefined
    })
  );
}

test('ordinary chat is the main workspace and Omega is optional', () => {
  const html = render('chat');
  assert.match(html, /Chat with Code Puppy/);
  assert.match(html, /AGENT CONVERSATION/);
  assert.match(html, /Choose a workspace|Start your coding workspace/);
  assert.match(html, /aria-pressed="true"[^>]*>.*Chat</s);
  assert.doesNotMatch(html, /OMEGA \/ WORKFLOW/);
});

test('Omega mode keeps the same conversation surface and adds the workflow', () => {
  const html = render('omega');
  assert.match(html, /Omega orchestration/);
  assert.match(html, /AGENT CONVERSATION/);
  assert.match(html, /OMEGA \/ WORKFLOW/);
  assert.match(html, /Draft Omega job/);
  assert.match(html, /SIMULATED|Demo/i);
  assert.equal((html.match(/agent-chat-surface/g) ?? []).length, 1);
});

test('app mode labels do not claim native chat or live execution', () => {
  for (const mode of ['chat', 'omega'] as const) {
    const html = render(mode);
    assert.match(html, /native session-linked dispatch is not verified/);
    assert.match(html, /Existing GUI connection/);
  }
});

test('same native context bar appears in Chat and Omega without initiating a read on render', () => {
  for (const mode of ['chat', 'omega'] as const) {
    const html = render(mode);
    assert.match(html, /Read-only local harness context/);
    assert.match(html, /Agent/);
    assert.match(html, /Model/);
    assert.match(html, /Saved session/);
    assert.match(html, /Not checked/);
    assert.match(html, /Refresh local GUI context/);
    assert.match(html, /Start the GUI first/);
  }
});

test('Omega worker controls are keyboard-accessible and link to the inspector', () => {
  const html = render('omega');
  assert.match(html, /role="group" aria-label="Interactive Omega workflow map/);
  assert.equal((html.match(/aria-controls="omega-worker-inspector"/g) ?? []).length, 4);
  assert.equal((html.match(/tabindex="0"/g) ?? []).length, 4);
  assert.match(html, /id="omega-worker-inspector"/);
  assert.match(html, /aria-label="Choose worker to inspect"/);
  for (const lane of ['RESEARCH', 'BUILD', 'TEST', 'REVIEW']) {
    assert.match(html, new RegExp('>' + lane + '</button>'));
  }
});

test('reduced motion permits stepping through Demo without autoplay controls', () => {
  const reduced = render('omega', true);
  assert.match(reduced, /aria-label="Next demo stage"/);
  assert.doesNotMatch(reduced, /aria-label="Pause demo"/);
  assert.match(reduced, /omega-diagram reduce-motion/);

  const animated = render('omega', false);
  assert.match(animated, /aria-label="Pause demo"/);
  assert.doesNotMatch(animated, /aria-label="Next demo stage"/);
});
