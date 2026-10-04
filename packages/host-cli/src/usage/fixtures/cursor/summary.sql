-- relationships: { verifies: usage-decoder }
CREATE TABLE conversation_summaries (conversationId TEXT, model TEXT, title TEXT, updatedAt TEXT);
INSERT INTO conversation_summaries VALUES ('conversation-a', 'sample-model', 'Sample inspection', '2026-01-01T00:00:10Z');
