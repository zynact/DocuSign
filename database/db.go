package database

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	_ "github.com/mattn/go-sqlite3"
)

var DB *sql.DB

func InitDB() error {
	var err error

	// If data directory does not exist, create it
	dataDir := "./data"
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		log.Fatalf("failed to create data directory: %v", err)
	}

	dbPath := filepath.Join(dataDir, "app.db")

	DB, err = sql.Open("sqlite3", dbPath)
	if err != nil {
		return err
	}

	DB.SetMaxOpenConns(1)

	query := `
	CREATE TABLE IF NOT EXISTS SETTINGS (
	    id INTEGER PRIMARY KEY CHECK (id = 1),
		login_email TEXT UNIQUE NOT NULL,
		login_password_hash TEXT NOT NULL
	);

	CREATE TABLE IF NOT EXISTS DOCUMENTS (
		id TEXT PRIMARY KEY, -- uuid
		
		title TEXT NOT NULL,
		description TEXT NOT NULL ,
		tags TEXT DEFAULT '[]' NOT NULL ,
		
		original_name TEXT NOT NULL,
		original_path TEXT NOT NULL,

		signed_name TEXT UNIQUE,
		signed_path TEXT,
		
		is_signed BOOLEAN NOT NULL DEFAULT 0 CHECK (is_signed IN (0, 1)),
		signed_at DATETIME,
		signed_by_metadata TEXT,
		remarks TEXT,
		signed_by_ip TEXT,
		
		ip_whitelist TEXT DEFAULT '[]' NOT NULL,
	    
	    deleted_at DATETIME,
	    deleted BOOLEAN NOT NULL DEFAULT 0 CHECK (deleted IN (0, 1)),
	    
	    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
	);

	CREATE TABLE IF NOT EXISTS DOCUMENT_FIELDS (
		id TEXT PRIMARY KEY,
		document_id TEXT NOT NULL,
		type TEXT NOT NULL CHECK (type IN ('signature', 'name', 'date', 'text')),
		page_number INTEGER NOT NULL CHECK (page_number > 0),
		x REAL NOT NULL CHECK (x >= 0),
		y REAL NOT NULL CHECK (y >= 0),
		width REAL NOT NULL CHECK (width > 0),
		height REAL NOT NULL CHECK (height > 0),
		required BOOLEAN NOT NULL DEFAULT 1 CHECK (required IN (0, 1)),
		label TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
		FOREIGN KEY(document_id) REFERENCES DOCUMENTS(id)
	);

	CREATE TABLE IF NOT EXISTS SIGNING_SESSIONS (
		id TEXT PRIMARY KEY,
		document_id TEXT NOT NULL,
		token_hash TEXT UNIQUE NOT NULL,
		signer_name TEXT,
		status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'expired', 'cancelled')),
		expires_at DATETIME NOT NULL,
		viewed_at DATETIME,
		started_at DATETIME,
		completed_at DATETIME,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
		FOREIGN KEY(document_id) REFERENCES DOCUMENTS(id)
	);

	CREATE TABLE IF NOT EXISTS AUDIT_EVENTS (
		id TEXT PRIMARY KEY,
		document_id TEXT NOT NULL,
		session_id TEXT,
		event_type TEXT NOT NULL,
		actor_type TEXT NOT NULL,
		actor_name TEXT,
		ip_address TEXT,
		user_agent TEXT,
		metadata TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
		FOREIGN KEY(document_id) REFERENCES DOCUMENTS(id)
	);
	`

	_, err = DB.Exec(query)

	if err != nil {
		fmt.Println(err)
		return err
	}

	if err := migrateDocumentsDeletedConstraint(); err != nil {
		return err
	}

	return err
}

// migrateDocumentsDeletedConstraint repairs databases created before the deleted
// boolean constraint was corrected. Those databases incorrectly validate
// deleted_at as a boolean, which rejects a timestamp during deletion.
func migrateDocumentsDeletedConstraint() error {
	var schema string
	err := DB.QueryRow(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'DOCUMENTS'`).Scan(&schema)
	if err != nil || !strings.Contains(strings.ToLower(schema), "check (deleted_at in") {
		return err
	}

	if _, err := DB.Exec(`PRAGMA foreign_keys = OFF`); err != nil {
		return err
	}
	tx, err := DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err = tx.Exec(`CREATE TABLE DOCUMENTS_MIGRATION (
		id TEXT PRIMARY KEY,
		title TEXT NOT NULL,
		description TEXT NOT NULL,
		tags TEXT DEFAULT '[]' NOT NULL,
		original_name TEXT NOT NULL,
		original_path TEXT NOT NULL,
		signed_name TEXT UNIQUE,
		signed_path TEXT,
		is_signed BOOLEAN NOT NULL DEFAULT 0 CHECK (is_signed IN (0, 1)),
		signed_at DATETIME,
		signed_by_metadata TEXT,
		remarks TEXT,
		signed_by_ip TEXT,
		ip_whitelist TEXT DEFAULT '[]' NOT NULL,
		deleted_at DATETIME,
		deleted BOOLEAN NOT NULL DEFAULT 0 CHECK (deleted IN (0, 1)),
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
	)`); err != nil {
		return err
	}
	if _, err = tx.Exec(`INSERT INTO DOCUMENTS_MIGRATION
		SELECT id, title, description, tags, original_name, original_path,
		       signed_name, signed_path, is_signed, signed_at, signed_by_metadata,
		       remarks, signed_by_ip, ip_whitelist, deleted_at, deleted,
		       created_at, updated_at FROM DOCUMENTS`); err != nil {
		return err
	}
	if _, err = tx.Exec(`DROP TABLE DOCUMENTS`); err != nil {
		return err
	}
	if _, err = tx.Exec(`ALTER TABLE DOCUMENTS_MIGRATION RENAME TO DOCUMENTS`); err != nil {
		return err
	}
	return tx.Commit()
}
