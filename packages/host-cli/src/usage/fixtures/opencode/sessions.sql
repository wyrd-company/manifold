-- relationships: { verifies: usage-decoder }
CREATE TABLE session (id TEXT PRIMARY KEY, parent_id TEXT, title TEXT, time_created INTEGER, cost REAL, tokens_input INTEGER, tokens_output INTEGER, tokens_reasoning INTEGER, tokens_cache_read INTEGER, tokens_cache_write INTEGER, model TEXT);
CREATE TABLE message (id TEXT PRIMARY KEY, session_id TEXT, time_created INTEGER, data TEXT);
CREATE TABLE part (id TEXT PRIMARY KEY, message_id TEXT, session_id TEXT, data TEXT);
INSERT INTO session VALUES ('session-db', NULL, 'Sample root', 1767225610000, 0, 0, 0, 0, 0, 0, NULL);
INSERT INTO session VALUES ('child-db', 'session-db', 'Sample child', 1767225620000, 0, 0, 0, 0, 0, 0, NULL);
INSERT INTO message VALUES ('message-db', 'child-db', 1767225620000, '{"role":"assistant","modelID":"second-model","tokens":{"input":12,"output":5,"reasoning":2,"cache":{"read":4,"write":3}}}');
INSERT INTO part VALUES ('part-db', 'message-db', 'child-db', '{"type":"text","text":"Sample inspected."}');
INSERT INTO session VALUES ('total-db', NULL, 'Sample total', 1767225630000, 0.1, 30, 10, 2, 4, 3, '{"providerID":"sample","modelID":"sample-model"}');
INSERT INTO message VALUES ('empty-db', 'total-db', 1767225630000, '{"role":"assistant"}');
