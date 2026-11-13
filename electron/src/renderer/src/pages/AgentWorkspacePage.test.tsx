import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AgentWorkspacePage, { type WorkspaceMode } from './AgentWorkspacePage';

function render(mode: WorkspaceMode): string {
  return renderToStaticMarkup(
    React.createElement(AgentWorkspacePage, {
      mode,
      status: { running: false, spawnedByUs: false, port: 8765, url: 'http://127.0.0.1:8765' },
      projectDir: null,
      reduceMotion: true,
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
  assert.match(html, /Choose a workspace|Connect the harness/);
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
