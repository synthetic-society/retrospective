-- Sliding session expiry: extend expires_at by 30 days on any activity

-- Update session expiry when a card is inserted
CREATE TRIGGER extend_session_on_card_insert
AFTER INSERT ON cards
BEGIN
  UPDATE sessions
  SET expires_at = datetime('now', '+30 days')
  WHERE id = NEW.session_id;
END;

-- Update session expiry when a card is updated
CREATE TRIGGER extend_session_on_card_update
AFTER UPDATE ON cards
BEGIN
  UPDATE sessions
  SET expires_at = datetime('now', '+30 days')
  WHERE id = NEW.session_id;
END;

-- Update session expiry when a card is deleted
CREATE TRIGGER extend_session_on_card_delete
AFTER DELETE ON cards
BEGIN
  UPDATE sessions
  SET expires_at = datetime('now', '+30 days')
  WHERE id = OLD.session_id;
END;

-- Update session expiry when a vote is cast or removed
CREATE TRIGGER extend_session_on_vote_insert
AFTER INSERT ON votes
BEGIN
  UPDATE sessions
  SET expires_at = datetime('now', '+30 days')
  WHERE id = (SELECT session_id FROM cards WHERE id = NEW.card_id);
END;

CREATE TRIGGER extend_session_on_vote_delete
AFTER DELETE ON votes
BEGIN
  UPDATE sessions
  SET expires_at = datetime('now', '+30 days')
  WHERE id = (SELECT session_id FROM cards WHERE id = OLD.card_id);
END;
