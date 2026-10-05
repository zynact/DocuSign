package database

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
)

type DocumentField struct {
	ID         string  `json:"id"`
	DocumentID string  `json:"documentId"`
	Type       string  `json:"type"`
	PageNumber int     `json:"pageNumber"`
	X          float64 `json:"x"`
	Y          float64 `json:"y"`
	Width      float64 `json:"width"`
	Height     float64 `json:"height"`
	Required   bool    `json:"required"`
	Label      string  `json:"label,omitempty"`
}

type SigningSession struct {
	ID          string     `json:"id"`
	DocumentID  string     `json:"documentId"`
	SignerName  *string    `json:"signerName,omitempty"`
	Status      string     `json:"status"`
	ExpiresAt   time.Time  `json:"expiresAt"`
	ViewedAt    *time.Time `json:"viewedAt,omitempty"`
	StartedAt   *time.Time `json:"startedAt,omitempty"`
	CompletedAt *time.Time `json:"completedAt,omitempty"`
}

func hashSessionToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func EnsureDefaultField(documentID string) error {
	var count int
	if err := DB.QueryRow("SELECT COUNT(*) FROM DOCUMENT_FIELDS WHERE document_id = ?", documentID).Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	_, err := DB.Exec(`INSERT INTO DOCUMENT_FIELDS
		(id, document_id, type, page_number, x, y, width, height, required, label)
		VALUES (?, ?, 'signature', 1, 72, 72, 180, 60, 1, 'Signature')`,
		uuid.NewString(), documentID)
	return err
}

func GetDocumentFields(documentID string) ([]DocumentField, error) {
	rows, err := DB.Query(`SELECT id, document_id, type, page_number, x, y, width, height, required, COALESCE(label, '')
		FROM DOCUMENT_FIELDS WHERE document_id = ? ORDER BY page_number, id`, documentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var fields []DocumentField
	for rows.Next() {
		var f DocumentField
		if err := rows.Scan(&f.ID, &f.DocumentID, &f.Type, &f.PageNumber, &f.X, &f.Y, &f.Width, &f.Height, &f.Required, &f.Label); err != nil {
			return nil, err
		}
		fields = append(fields, f)
	}
	return fields, rows.Err()
}

func ReplaceDocumentFields(documentID string, fields []DocumentField) error {
	tx, err := DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err = tx.Exec("DELETE FROM DOCUMENT_FIELDS WHERE document_id = ?", documentID); err != nil {
		return err
	}
	for _, f := range fields {
		if f.ID == "" {
			f.ID = uuid.NewString()
		}
		if _, err = tx.Exec(`INSERT INTO DOCUMENT_FIELDS
			(id, document_id, type, page_number, x, y, width, height, required, label)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, f.ID, documentID, f.Type, f.PageNumber, f.X, f.Y, f.Width, f.Height, f.Required, f.Label); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func CreateSigningSession(documentID string, expiry time.Duration) (SigningSession, string, error) {
	if expiry <= 0 || expiry > 30*24*time.Hour {
		expiry = 7 * 24 * time.Hour
	}
	if err := EnsureDefaultField(documentID); err != nil {
		return SigningSession{}, "", err
	}
	token := uuid.NewString() + uuid.NewString()
	now := time.Now().UTC()
	s := SigningSession{ID: uuid.NewString(), DocumentID: documentID, Status: "pending", ExpiresAt: now.Add(expiry)}
	_, err := DB.Exec(`INSERT INTO SIGNING_SESSIONS (id, document_id, token_hash, status, expires_at) VALUES (?, ?, ?, ?, ?)`, s.ID, documentID, hashSessionToken(token), s.Status, s.ExpiresAt)
	return s, token, err
}

func GetSigningSession(token string) (SigningSession, error) {
	var s SigningSession
	err := DB.QueryRow(`SELECT id, document_id, signer_name, status, expires_at, viewed_at, started_at, completed_at
		FROM SIGNING_SESSIONS WHERE token_hash = ?`, hashSessionToken(token)).Scan(&s.ID, &s.DocumentID, &s.SignerName, &s.Status, &s.ExpiresAt, &s.ViewedAt, &s.StartedAt, &s.CompletedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return s, sql.ErrNoRows
	}
	if err != nil {
		return s, err
	}
	if s.Status == "pending" && time.Now().After(s.ExpiresAt) {
		_, _ = DB.Exec("UPDATE SIGNING_SESSIONS SET status = 'expired' WHERE id = ? AND status = 'pending'", s.ID)
		s.Status = "expired"
	}
	return s, nil
}

func MarkSessionViewed(id string) error {
	_, err := DB.Exec(`UPDATE SIGNING_SESSIONS SET viewed_at = COALESCE(viewed_at, CURRENT_TIMESTAMP), status = CASE WHEN status = 'pending' THEN 'in_progress' ELSE status END, started_at = COALESCE(started_at, CURRENT_TIMESTAMP) WHERE id = ?`, id)
	return err
}

func CompleteSigningSession(tx *sql.Tx, sessionID string, signerName string) error {
	_, err := tx.Exec(`UPDATE SIGNING_SESSIONS SET signer_name = ?, status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ? AND status IN ('pending', 'in_progress')`, signerName, sessionID)
	return err
}

func AddAuditEvent(tx *sql.Tx, documentID, sessionID, eventType, actorType, actorName, ip, userAgent string, metadata any) error {
	var metadataJSON []byte
	var err error
	if metadata != nil {
		metadataJSON, err = json.Marshal(metadata)
		if err != nil {
			return err
		}
	}
	_, err = tx.Exec(`INSERT INTO AUDIT_EVENTS (id, document_id, session_id, event_type, actor_type, actor_name, ip_address, user_agent, metadata)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, uuid.NewString(), documentID, sessionID, eventType, actorType, actorName, ip, userAgent, string(metadataJSON))
	return err
}
