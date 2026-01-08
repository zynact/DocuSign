package database

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"

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
	    deleted BOOLEAN NOT NULL DEFAULT 0 CHECK (deleted_at IN (0, 1)),
	    
	    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
	    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
	);
	`

	_, err = DB.Exec(query)

	if err != nil {
		fmt.Println(err)
		return err
	}

	return err
}
