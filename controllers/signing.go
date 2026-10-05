package controllers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/fbn776/inkra/database"
	"github.com/fbn776/inkra/lib"
	"github.com/fbn776/inkra/signing"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

type createSessionRequest struct {
	ExpiryHours int `json:"expiryHours"`
}

func CreateSigningSession(w http.ResponseWriter, r *http.Request) {
	documentID := chi.URLParam(r, "id")
	doc, err := database.GetDocByID(documentID)
	if errors.Is(err, sql.ErrNoRows) {
		lib.ErrorJSON(w, http.StatusNotFound, "Document not found")
		return
	}
	if err != nil || doc.Deleted {
		lib.ErrorJSON(w, http.StatusBadRequest, "Document is not available")
		return
	}
	if doc.IsSigned {
		lib.ErrorJSON(w, http.StatusBadRequest, "Document is already signed")
		return
	}
	var req createSessionRequest
	if r.Body != nil {
		_ = json.NewDecoder(r.Body).Decode(&req)
	}
	if req.ExpiryHours <= 0 || req.ExpiryHours > 24*30 {
		req.ExpiryHours = 24 * 7
	}
	session, token, err := database.CreateSigningSession(documentID, time.Duration(req.ExpiryHours)*time.Hour)
	if err != nil {
		lib.ErrorJSON(w, http.StatusInternalServerError, "Could not create signing session")
		return
	}
	lib.SuccessJSON(w, http.StatusCreated, map[string]any{
		"session": session,
		"token":   token,
		"url":     "/sign/" + token,
	})
}

func ReplaceFields(w http.ResponseWriter, r *http.Request) {
	documentID := chi.URLParam(r, "id")
	if _, err := database.GetDocByID(documentID); errors.Is(err, sql.ErrNoRows) {
		lib.ErrorJSON(w, http.StatusNotFound, "Document not found")
		return
	}
	var fields []database.DocumentField
	if err := json.NewDecoder(r.Body).Decode(&fields); err != nil || len(fields) == 0 {
		lib.ErrorJSON(w, http.StatusBadRequest, "At least one signing field is required")
		return
	}
	for i := range fields {
		f := &fields[i]
		if f.Type != "signature" && f.Type != "name" && f.Type != "date" && f.Type != "text" || f.PageNumber < 1 || f.X < 0 || f.Y < 0 || f.Width <= 0 || f.Height <= 0 || f.Width > 1000 || f.Height > 1000 {
			lib.ErrorJSON(w, http.StatusBadRequest, "Invalid signing field")
			return
		}
		f.DocumentID = documentID
	}
	if err := database.ReplaceDocumentFields(documentID, fields); err != nil {
		lib.ErrorJSON(w, http.StatusInternalServerError, "Could not save signing fields")
		return
	}
	lib.SuccessJSON(w, http.StatusOK, fields)
}

func GetFields(w http.ResponseWriter, r *http.Request) {
	documentID := chi.URLParam(r, "id")
	if _, err := database.GetDocByID(documentID); errors.Is(err, sql.ErrNoRows) {
		lib.ErrorJSON(w, http.StatusNotFound, "Document not found")
		return
	}
	if err := database.EnsureDefaultField(documentID); err != nil {
		lib.ErrorJSON(w, http.StatusInternalServerError, "Could not initialize signing field")
		return
	}
	fields, err := database.GetDocumentFields(documentID)
	if err != nil {
		lib.ErrorJSON(w, http.StatusInternalServerError, "Could not get signing fields")
		return
	}
	lib.SuccessJSON(w, http.StatusOK, fields)
}

func GetSigningSession(w http.ResponseWriter, r *http.Request) {
	token := chi.URLParam(r, "token")
	session, err := database.GetSigningSession(token)
	if errors.Is(err, sql.ErrNoRows) {
		lib.ErrorJSON(w, http.StatusNotFound, "Signing link not found")
		return
	}
	if err != nil {
		lib.ErrorJSON(w, http.StatusInternalServerError, "Could not get signing session")
		return
	}
	if session.Status != "pending" && session.Status != "in_progress" {
		lib.ErrorJSON(w, http.StatusGone, "This signing link is no longer active")
		return
	}
	doc, err := database.GetDocByID(session.DocumentID)
	if err != nil || doc.Deleted || doc.IsSigned {
		lib.ErrorJSON(w, http.StatusGone, "This document is no longer available for signing")
		return
	}
	if err := database.MarkSessionViewed(session.ID); err != nil {
		lib.ErrorJSON(w, http.StatusInternalServerError, "Could not open signing session")
		return
	}
	fields, err := database.GetDocumentFields(doc.Id)
	if err != nil {
		lib.ErrorJSON(w, http.StatusInternalServerError, "Could not get signing fields")
		return
	}
	lib.SuccessJSON(w, http.StatusOK, map[string]any{
		"session":  session,
		"document": map[string]any{"id": doc.Id, "title": doc.Title, "description": doc.Description, "originalPath": doc.OriginalPath, "originalName": doc.OriginalName},
		"fields":   fields,
	})
}

func CompleteSigningSession(w http.ResponseWriter, r *http.Request) {
	token := chi.URLParam(r, "token")
	session, err := database.GetSigningSession(token)
	if errors.Is(err, sql.ErrNoRows) {
		lib.ErrorJSON(w, http.StatusNotFound, "Signing link not found")
		return
	}
	if err != nil || (session.Status != "pending" && session.Status != "in_progress") || time.Now().After(session.ExpiresAt) {
		lib.ErrorJSON(w, http.StatusGone, "This signing link is no longer active")
		return
	}
	var req signing.CompleteRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8<<20)).Decode(&req); err != nil {
		lib.ErrorJSON(w, http.StatusBadRequest, "Invalid signing request")
		return
	}
	req.SignerName = strings.TrimSpace(req.SignerName)
	if len(req.SignerName) < 2 || len(req.SignerName) > 150 {
		lib.ErrorJSON(w, http.StatusBadRequest, "Signer name must be between 2 and 150 characters")
		return
	}
	sig, err := signing.DecodeSignatureImage(req.Signature.ImageData)
	if err != nil {
		lib.ErrorJSON(w, http.StatusBadRequest, err.Error())
		return
	}
	fields, err := database.GetDocumentFields(session.DocumentID)
	if err != nil || len(fields) == 0 {
		lib.ErrorJSON(w, http.StatusBadRequest, "No signing fields are configured")
		return
	}
	var signatureField database.DocumentField
	values := map[string]string{}
	for _, v := range req.Fields {
		values[v.FieldID] = strings.TrimSpace(v.Value)
	}
	for _, f := range fields {
		if f.Required && f.Type == "signature" {
			signatureField = f
		}
		if f.Required && f.Type != "signature" && values[f.ID] == "" {
			lib.ErrorJSON(w, http.StatusBadRequest, "All required fields must be completed")
			return
		}
	}
	if signatureField.ID == "" {
		lib.ErrorJSON(w, http.StatusBadRequest, "A signature field is required")
		return
	}
	doc, err := database.GetDocByID(session.DocumentID)
	if err != nil {
		lib.ErrorJSON(w, http.StatusInternalServerError, "Could not get document")
		return
	}
	signedPath := filepath.Join("./docs/signed", "signed_"+uuid.NewString()+".pdf")
	if err := signing.RenderSignedPDF(doc.OriginalPath, signedPath, signatureField, sig); err != nil {
		lib.ErrorJSON(w, http.StatusInternalServerError, "Could not generate signed PDF")
		return
	}
	// Add text fields one by one, using the previous output as the next input.
	currentPath := signedPath
	for _, f := range fields {
		if f.Type == "signature" || values[f.ID] == "" {
			continue
		}
		nextPath := filepath.Join("./docs/signed", "signed_"+uuid.NewString()+".pdf")
		if err := signing.RenderTextPDF(currentPath, nextPath, values[f.ID], f); err != nil {
			_ = os.Remove(currentPath)
			lib.ErrorJSON(w, http.StatusInternalServerError, "Could not generate signed PDF")
			return
		}
		if currentPath != signedPath {
			_ = os.Remove(currentPath)
		}
		currentPath = nextPath
	}
	if currentPath != signedPath {
		_ = os.Remove(signedPath)
		signedPath = currentPath
	}
	tx, err := database.DB.Begin()
	if err != nil {
		_ = os.Remove(signedPath)
		lib.ErrorJSON(w, http.StatusInternalServerError, "Could not complete signing")
		return
	}
	result, err := tx.Exec(`UPDATE DOCUMENTS SET signed_name = ?, signed_path = ?, is_signed = 1, signed_at = CURRENT_TIMESTAMP, signed_by_metadata = ?, remarks = ?, signed_by_ip = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted = 0 AND is_signed = 0`, filepath.Base(signedPath), signedPath, req.SignerName, req.Remarks, lib.GetClientIP(r), doc.Id)
	if err == nil {
		var rows int64
		rows, err = result.RowsAffected()
		if rows != 1 {
			err = errors.New("document already signed")
		}
	}
	if err == nil {
		err = database.CompleteSigningSession(tx, session.ID, req.SignerName)
	}
	if err == nil {
		err = database.AddAuditEvent(tx, doc.Id, session.ID, "document_signed", "signer", req.SignerName, lib.GetClientIP(r), r.UserAgent(), map[string]any{"signedPath": signedPath})
	}
	if err != nil {
		_ = tx.Rollback()
		_ = os.Remove(signedPath)
		lib.ErrorJSON(w, http.StatusConflict, "Document could not be signed")
		return
	}
	if err := tx.Commit(); err != nil {
		_ = os.Remove(signedPath)
		lib.ErrorJSON(w, http.StatusInternalServerError, "Could not complete signing")
		return
	}
	lib.SuccessJSON(w, http.StatusOK, map[string]any{"status": "completed", "signedPath": signedPath})
}
