package database

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
)

type Document struct {
	Id               string   `json:"id"`
	Title            string   `json:"title"`
	Description      *string  `json:"description,omitempty"`
	Tags             []string `json:"tags,omitempty"`
	OriginalName     string   `json:"originalName"`
	OriginalPath     string   `json:"originalPath"`
	SignedName       *string  `json:"signedName,omitempty"`
	SignedPath       *string  `json:"signedPath,omitempty"`
	IsSigned         bool     `json:"isSigned"`
	SignedAt         *string  `json:"signedAt,omitempty"`
	SignedByMetadata *string  `json:"signedByMetadata,omitempty"`
	Remarks          *string  `json:"remarks,omitempty"`
	SignedByIp       *string  `json:"signedByIp,omitempty"`
	IpWhitelist      []string `json:"ipWhitelist"`

	DeletedAt *string `json:"deletedAt,omitempty"`
	Deleted   bool    `json:"deleted"`
	CreatedAt string  `json:"createdAt"`
	UpdatedAt string  `json:"updatedAt"`
}

func GetDocByID(id string) (Document, error) {
	doc := Document{}
	var tagsJson, ipJson string

	scanErr := DB.QueryRow(`
		SELECT 
		    id,
		    title,
		    description,
		    tags,
		    original_name,
		    original_path,
		    signed_name,
		    signed_path,
		    is_signed,
		    signed_at,
		    signed_by_metadata,
		    signed_by_ip,
		    ip_whitelist,
		    deleted_at,
		    deleted,
		    created_at,
		    updated_at
		FROM DOCUMENTS
		WHERE id = ?
	`, id).Scan(
		&doc.Id,
		&doc.Title,
		&doc.Description,
		&tagsJson,
		&doc.OriginalName,
		&doc.OriginalPath,
		&doc.SignedName,
		&doc.SignedPath,
		&doc.IsSigned,
		&doc.SignedAt,
		&doc.SignedByMetadata,
		&doc.SignedByIp,
		&ipJson,
		&doc.DeletedAt,
		&doc.Deleted,
		&doc.CreatedAt,
		&doc.UpdatedAt,
	)

	if errors.Is(scanErr, sql.ErrNoRows) {
		fmt.Println("No row found")
		return doc, scanErr
	} else if scanErr != nil {
		fmt.Println(scanErr)
		return doc, scanErr
	}

	tagsErr := json.Unmarshal([]byte(tagsJson), &doc.Tags)
	if tagsErr != nil {
		return doc, tagsErr
	}
	ipErr := json.Unmarshal([]byte(ipJson), &doc.IpWhitelist)
	if ipErr != nil {
		return doc, ipErr
	}

	return doc, nil
}
