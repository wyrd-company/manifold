-- relationships: { verifies: usage-decoder }
CREATE TABLE conversation_summaries (conversationId TEXT, model TEXT, title TEXT, updatedAt INTEGER);
INSERT INTO conversation_summaries VALUES ('conversation-a', 'sample-model', 'Sample inspection', 1767225610000);
