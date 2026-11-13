import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AgentWorkspacePage, { type WorkspaceMode } from './AgentWorkspacePage';
import CodePuppyChatPage, { validateChatPrompt } from './CodePuppyChatPage';
import { unavailableCodePuppy } from '@shared/code-puppy-acp';

function render(mode: WorkspaceMode, reduceMotion = true): string {
  return renderToStaticMarkup(
    React.createElement(AgentWorkspacePage, {
      mode,
      snapshot: unavailableCodePuppy(),
      projectDir: null,
      reduceMotion,
      onModeChange: () => undefined,
      onProjectChange: () => undefined,
      onCompose: () => undefined,
      onSavedActivity: () => undefined
    })
  );
}

test('chat-first UI uses direct Code Puppy ACP, not embedded GUI/webview', () => {
  const html = render('chat');
  assert.match(html, /Chat with Code Puppy/);
  assert.match(html, /AGENT CONVERSATION/);
  assert.match(html, /direct ACP/i);
  assert.match(html, /Choose a project before starting Code Puppy/);
  assert.match(html, /Start Code Puppy/);
  assert.match(html, /aria-pressed="true"[^>]*>.*Chat</s);
  assert.doesNotMatch(html, /<webview|<iframe|Existing GUI connection|GUI OFFLINE/);
  assert.doesNotMatch(html, /OMEGA \/ WORKFLOW/);
});

test('Omega mode shares the native ACP conversation and displays the graph', () => {
  const html = render('omega');
  assert.match(html, /Omega orchestration/);
  assert.match(html, /AGENT CONVERSATION/);
  assert.match(html, /OMEGA \/ WORKFLOW/);
  assert.match(html, /Draft Omega job/);
  assert.match(html, /SIMULATED|Demo/i);
  assert.equal((html.match(/agent-chat-surface/g) ?? []).length, 1);
  assert.doesNotMatch(html, /<webview|<iframe/);
});

test('no UI claims delegation or verification success from a generic ACP turn', () => {
  for (const mode of ['chat', 'omega'] as const) {
    const html = render(mode);
    assert.match(html, /worker attribution and automated delegation are still being implemented/);
    assert.match(html, /Permissions are denied by default/);
  }
});

test('Omega worker controls are keyboard-accessible and link to the inspector', () => {
  const html = render('omega');
  assert.match(html, /aria-label="Interactive Omega workflow map:[^"]+" role="group"/);
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

test('switching the composer project locks chat sending until the matching ACP session starts', () => {
  const html = renderToStaticMarkup(React.createElement(CodePuppyChatPage, {
    snapshot: { connection: 'ready', projectDir: '/project-A', sessionId: 'session-A', events: [], error: null },
    projectDir: '/project-B',
    onProjectChange: () => undefined
  }));
  assert.match(html, /Selected project differs from the active Code Puppy session/);
  assert.match(html, /Switch to selected project/);
  assert.match(html, /aria-label="Message to Code Puppy"[^>]*disabled/);
  assert.match(html, /disabled[^>]*>.*Send</s);
});

test('oversized Omega briefs are rejected before clearing the composer', () => {
  assert.equal(validateChatPrompt('a'.repeat(20000)), null);
  assert.match(validateChatPrompt('a'.repeat(20001)) || '', /maximum 20,000 characters/);
  assert.match(validateChatPrompt('  ' ) || '', /Enter a message/);
});
