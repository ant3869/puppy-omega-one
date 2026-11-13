let buffer = '';
let waitingPrompt = null;
let sessionId = 'fixture-session-1';
const closeInputAfterSession = process.argv.includes('--close-stdin');

function send(value) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', ...value }) + '\n');
}

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  let end;
  while ((end = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, end);
    buffer = buffer.slice(end + 1);
    if (!line.trim()) continue;
    let frame;
    try { frame = JSON.parse(line); } catch { continue; }
    if (frame.method === 'initialize') {
      send({ id: frame.id, result: { protocolVersion: 1, agentCapabilities: { loadSession: false }, authMethods: [] } });
    } else if (frame.method === 'session/new') {
      if (frame.params.cwd !== process.cwd() || !Array.isArray(frame.params.mcpServers)) {
        send({ id: frame.id, error: { code: -32000, message: 'Unexpected project cwd' } });
      } else {
        send({ id: frame.id, result: { sessionId } });
        if (closeInputAfterSession) {
          setTimeout(() => process.stdin.destroy(), 20);
          setInterval(() => undefined, 1000);
        }
      }
    } else if (frame.method === 'session/prompt') {
      waitingPrompt = frame.id;
      send({ method: 'session/update', params: { sessionId, update: {
        sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: frame.params.prompt[0].text === 'long text' ? 'X'.repeat(5013) : 'Direct ACP works' }
      } } });
      // Bidirectional ACP request IDs legitimately overlap: use the prompt's ID.
      send({ id: frame.id, method: 'session/request_permission', params: { sessionId, toolCall: { toolCallId: 'fixture-tool', title: 'Mock write' }, options: [] } });
    } else if (frame.id === waitingPrompt && frame.result && frame.result.outcome) {
      if (frame.result.outcome?.outcome !== 'cancelled') {
        send({ id: waitingPrompt, error: { code: -32000, message: 'Unexpected approval' } });
      } else {
        send({ id: waitingPrompt, result: { stopReason: 'end_turn' } });
      }
      waitingPrompt = null;
    } else if (frame.method === 'session/cancel' && waitingPrompt !== null) {
      send({ id: waitingPrompt, result: { stopReason: 'cancelled' } });
      waitingPrompt = null;
    }
  }
});
