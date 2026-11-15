CREATE TABLE team_invitations (
  id UUID PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES teams (id),
  inviter_id UUID NOT NULL REFERENCES users (id),
  email VARCHAR(150) NOT NULL,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
  consumed_at TIMESTAMP(6) WITH TIME ZONE
);

CREATE UNIQUE INDEX idx_team_invitation_pending_email
  ON team_invitations (team_id, email) WHERE consumed_at IS NULL;
