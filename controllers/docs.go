package controllers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"path/filepath"
	"strconv"
	"time"

	"github.com/fbn776/inkra/config"
	"github.com/fbn776/inkra/database"
	"github.com/fbn776/inkra/lib"
	"github.com/fbn776/inkra/managers"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

func GetAllDocs(w http.ResponseWriter, r *http.Request) {
	page := r.URL.Query().Get("page")
	keyword := r.URL.Query().Get("keyword")
	limit := r.URL.Query().Get("limit")
	signed := r.URL.Query().Get("signed")

	var keywordParam *string
	if keyword != "" {
		k := "%" + keyword + "%"
		keywordParam = &k
	} else {
		keywordParam = nil
	}

	if page == "" {
		page = "1"
	}

	if limit == "" {
		limit = "10"
	}

	pageInt, _ := strconv.Atoi(page)
	limitInt, _ := strconv.Atoi(limit)

	if pageInt < 1 {
		pageInt = 1
	}
	if limitInt <= 0 || limitInt > 100 {
		limitInt = 10
	}

	offset := (pageInt - 1) * limitInt

	var signedParam *bool
	if signed == "true" {
		b := true
		signedParam = &b
	} else if signed == "false" {
		b := false
		signedParam = &b
	} else {
		signedParam = nil
	}

	prepRes, prepErr := database.DB.Prepare(`
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
		FROM documents
		WHERE 
		    deleted = 0 AND
		    (? IS NULL OR is_signed = ?) AND
			(? IS NULL
				OR title LIKE ?
				OR description LIKE ?
				OR original_name LIKE ?
			)
		ORDER BY created_at DESC
		LIMIT ? OFFSET ?;
	`)

	if prepErr != nil {
		lib.ErrorJSON(w, http.StatusInternalServerError, "Could not prepare statement")
		return
	}

	var total int
	countErr := database.DB.QueryRow(`
		SELECT COUNT(*)
		FROM documents
		WHERE
		    deleted = 0 AND
			(? IS NULL OR is_signed = ?)
			AND
			(
				? IS NULL
				OR title LIKE ?
				OR description LIKE ?
				OR original_name LIKE ?
			)`,
		signedParam,
		signedParam,
		keywordParam,
		keywordParam,
		keywordParam,
		keywordParam,
	).Scan(&total)

	if countErr != nil {
		lib.ErrorJSON(w, http.StatusInternalServerError, "Could not get total count")
		return
	}

	queryRes, queryErr := prepRes.Query(
		signedParam,
		signedParam,

		keywordParam,
		keywordParam,
		keywordParam,
		keywordParam,

		limitInt,
		offset,
	)

	if queryErr != nil {
		return
	}
	defer queryRes.Close()

	var docs []database.Document

	for queryRes.Next() {
		var doc database.Document
		var tagsJson, ipJson string

		scanErr := queryRes.Scan(
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

		if scanErr != nil {
			fmt.Println("ERROR AT DOC SCANNER", scanErr)
			lib.ErrorJSON(w, http.StatusInternalServerError, "Could not scan row")
			return
		}

		tagsErr := json.Unmarshal([]byte(tagsJson), &doc.Tags)
		if tagsErr != nil {
			lib.ErrorJSON(w, http.StatusInternalServerError, "Could not parse tags")
			return
		}
		ipErr := json.Unmarshal([]byte(ipJson), &doc.IpWhitelist)
		if ipErr != nil {
			lib.ErrorJSON(w, http.StatusInternalServerError, "Could not parse ip whitelist")
			return
		}

		docs = append(docs, doc)
	}

	lib.SuccessJSON(w, http.StatusOK, map[string]any{
		"total": total,
		"page":  page,
		"limit": limit,
		"docs":  docs,
	})
}

func GetDocById(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	if id == "" {
		lib.ErrorJSON(w, http.StatusBadRequest, "Missing required field: id")
		return
	}

	doc, docErr := database.GetDocByID(id)

	if errors.Is(docErr, sql.ErrNoRows) {
		lib.ErrorJSON(w, http.StatusNotFound, "Document not found")
		return
	}

	if docErr != nil {
		lib.ErrorJSON(w, http.StatusInternalServerError, "Could not get document")
		return
	}

	lib.SuccessJSON(w, http.StatusOK, doc)
}

func CreateDoc(w http.ResponseWriter, r *http.Request) {
	parseErr := r.ParseMultipartForm(config.AppConfig.MaxFileSize)

	if parseErr != nil {
		lib.ErrorJSON(w, http.StatusBadRequest, "Error parsing multipart form")
		return
	}

	title := r.FormValue("title")
	description := r.FormValue("description")
	tags := r.FormValue("tags")
	ipWhitelist := r.FormValue("ipWhitelist")

	tagsSlice, tagsSliceErr := json.Marshal(lib.CsvToSlice(tags))
	if tagsSliceErr != nil {
		lib.ErrorJSON(w, http.StatusBadRequest, "Error parsing tags")
		return
	}
	ipWhitelistSlice, ipWhitelistErr := json.Marshal(lib.CsvToSlice(ipWhitelist))
	if ipWhitelistErr != nil {
		lib.ErrorJSON(w, http.StatusBadRequest, "Error parsing ip whitelist")
		return
	}

	if title == "" || description == "" {
		lib.ErrorJSON(w, http.StatusBadRequest, "Missing required fields: title, description")
		return
	}

	file, header, formFileErr := r.FormFile("file")

	if formFileErr != nil {
		lib.ErrorJSON(w, http.StatusBadRequest, "Error parsing multipart form")
		return
	}

	defer file.Close()

	if header == nil {
		lib.ErrorJSON(w, http.StatusBadRequest, "No file uploaded")
		return
	}

	if header.Size > config.AppConfig.MaxFileSize {
		lib.ErrorJSON(w, http.StatusBadRequest, "File too large")
		return
	}

	isPdf, isPdfErr := lib.IsPDF(file)

	if isPdfErr != nil {
		lib.ErrorJSON(w, http.StatusInternalServerError, "Error parsing pdf")
		return
	}

	if !isPdf {
		lib.ErrorJSON(w, http.StatusInternalServerError, "File is not a pdf")
		return
	}

	safeName := uuid.New().String() + filepath.Ext(header.Filename)

	multipartFilePath, saveErr := lib.SaveMultipartFile(file, header, "./docs/uploads", safeName)

	if saveErr != nil {
		lib.ErrorJSON(w, http.StatusInternalServerError, "Could not save file")
		return
	}

	prepare, insertErr := database.DB.Prepare(`INSERT INTO DOCUMENTS (
                       id,
                       title,
                       description,
                       tags,
                       original_name,
                       original_path,
                       ip_whitelist,
                       created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)

	if insertErr != nil {
		lib.ErrorJSON(w, http.StatusInternalServerError, "Could not prepare statement")
		return
	}

	insertResult, insertErr := prepare.Exec(
		uuid.New().String(),
		title,
		description,
		string(tagsSlice),
		header.Filename,
		multipartFilePath,
		string(ipWhitelistSlice),
		time.Now(),
	)

	if insertErr != nil {
		lib.ErrorJSON(w, http.StatusInternalServerError, "Could not insert document")
		return
	}

	_, insertErr = insertResult.RowsAffected()
	if insertErr != nil {
		lib.ErrorJSON(w, http.StatusInternalServerError, "No rows affected")
		return
	}

	lib.SuccessJSON(w, http.StatusOK, nil)
}

func UpdateDoc(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	if id == "" {
		lib.ErrorJSON(w, http.StatusBadRequest, "Missing required field: id")
		return
	}

	parseErr := r.ParseMultipartForm(config.AppConfig.MaxFileSize)

	if parseErr != nil {
		lib.ErrorJSON(w, http.StatusBadRequest, "Error parsing multipart form")
		return
	}

	title := r.FormValue("title")
	description := r.FormValue("description")
	tags := r.FormValue("tags")
	ipWhitelist := r.FormValue("ipWhitelist")

	tagsSlice, tagsSliceErr := json.Marshal(lib.CsvToSlice(tags))
	if tagsSliceErr != nil {
		lib.ErrorJSON(w, http.StatusBadRequest, "Error parsing tags")
		return
	}
	ipWhitelistSlice, ipWhitelistErr := json.Marshal(lib.CsvToSlice(ipWhitelist))
	if ipWhitelistErr != nil {
		lib.ErrorJSON(w, http.StatusBadRequest, "Error parsing ip whitelist")
		return
	}

	if title == "" || description == "" {
		lib.ErrorJSON(w, http.StatusBadRequest, "Missing required fields: title, description")
		return
	}

	file, header, formFileErr := r.FormFile("file")
	if formFileErr != nil {
		lib.ErrorJSON(w, http.StatusBadRequest, "Error parsing multipart form")
		return
	}

	docHandleErr := managers.HandleDocPdfErrors(&file, header)
	if docHandleErr != nil {
		lib.ErrorJSON(w, http.StatusBadRequest, docHandleErr.Error())
		return
	}

	defer file.Close()

	safeName := uuid.New().String() + filepath.Ext(header.Filename)

	multipartFilePath, saveErr := lib.SaveMultipartFile(file, header, "./docs/uploads", safeName)

	if saveErr != nil {
		lib.ErrorJSON(w, http.StatusInternalServerError, "Could not save file")
		return
	}

	prepare, updateErr := database.DB.Prepare(`UPDATE DOCUMENTS SET
		title = ?,
		description = ?,
		tags = ?,
		original_name = ?,
		original_path = ?,
		ip_whitelist = ?,
		updated_at = ?
		WHERE id = ?
	`)

	if updateErr != nil {
		lib.ErrorJSON(w, http.StatusInternalServerError, "Could not prepare statement")
		return
	}

	updateRes, updateErr := prepare.Exec(
		title,
		description,
		string(tagsSlice),
		header.Filename,
		multipartFilePath,
		string(ipWhitelistSlice),
		time.Now(),
		id,
	)

	if updateErr != nil {
		lib.ErrorJSON(w, http.StatusInternalServerError, "Could not update document")
		return
	}

	_, updateErr = updateRes.RowsAffected()
	if updateErr != nil {
		lib.ErrorJSON(w, http.StatusInternalServerError, "No rows affected")
		return
	}

	lib.SuccessJSON(w, http.StatusOK, nil)
}

func DeleteDoc(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	if id == "" {
		lib.ErrorJSON(w, http.StatusBadRequest, "Missing required field: id")
		return
	}

	deleteRes, deleteErr := database.DB.Exec(`UPDATE DOCUMENTS SET deleted = 1 WHERE id = ?`, id)

	if deleteErr != nil {
		lib.ErrorJSON(w, http.StatusInternalServerError, "Could not delete document")
		return
	}

	_, rowsAffectedErr := deleteRes.RowsAffected()

	if rowsAffectedErr != nil {
		lib.ErrorJSON(w, http.StatusInternalServerError, "No rows affected")
	}

	lib.SuccessJSON(w, http.StatusOK, nil)
}

func SignDoc(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	metadata := r.FormValue("metadata")
	remarks := r.FormValue("remarks")

	if id == "" {
		lib.ErrorJSON(w, http.StatusBadRequest, "Missing required field: id")
		return
	}

	doc, docErr := database.GetDocByID(id)

	if errors.Is(docErr, sql.ErrNoRows) {
		lib.ErrorJSON(w, http.StatusNotFound, "Document not found")
		return
	}

	if docErr != nil {
		lib.ErrorJSON(w, http.StatusInternalServerError, "Could not get document")
		return
	}

	if doc.Deleted {
		lib.ErrorJSON(w, http.StatusBadRequest, "Document is deleted")
	}

	if doc.IsSigned {
		lib.ErrorJSON(w, http.StatusBadRequest, "Document is already signed")
	}

	ip := lib.GetClientIP(r)

	if !lib.IsIPAllowed(ip, doc.IpWhitelist) {
		lib.ErrorJSON(w, http.StatusBadRequest, "IP not allowed")
		return
	}

	parseErr := r.ParseMultipartForm(config.AppConfig.MaxFileSize)
	if parseErr != nil {
		lib.ErrorJSON(w, http.StatusBadRequest, "Error parsing multipart form")
		return
	}

	file, header, formFileErr := r.FormFile("file")

	if formFileErr != nil {
		lib.ErrorJSON(w, http.StatusBadRequest, "Error parsing multipart form")
		return
	}

	defer file.Close()

	docHandleErr := managers.HandleDocPdfErrors(&file, header)

	if docHandleErr != nil {
		lib.ErrorJSON(w, http.StatusBadRequest, docHandleErr.Error())
		return
	}

	safeName := "signed_" + uuid.New().String() + filepath.Ext(header.Filename)

	savePath, saveErr := lib.SaveMultipartFile(file, header, "./docs/signed", safeName)

	if saveErr != nil {
		lib.ErrorJSON(w, http.StatusInternalServerError, "Could not save file")
		return
	}

	exec, updateErr := database.DB.Exec(`
		UPDATE DOCUMENTS SET 
		                     signed_name = ?,
		                     signed_path = ?,
		                     is_signed = 1,
		                     signed_at = ?,
		                     signed_by_metadata = ?,
		                     remarks = ?,
		                     signed_by_ip = ?
		                 WHERE id = ?	                 
	`, safeName, savePath, time.Now(), metadata, remarks, ip, id)

	if updateErr != nil {
		fmt.Println("Error updating document", updateErr)
		lib.ErrorJSON(w, http.StatusInternalServerError, "Could not update document")
	}

	_, updateErr = exec.RowsAffected()

	if updateErr != nil {
		lib.ErrorJSON(w, http.StatusInternalServerError, "No rows affected")
	}

	lib.SuccessJSON(w, http.StatusOK, "Signed document")
}

func ViewDoc(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	if id == "" {
		lib.ErrorJSON(w, http.StatusBadRequest, "Missing required field: id")
		return
	}

	doc, docErr := database.GetDocByID(id)

	if errors.Is(docErr, sql.ErrNoRows) {
		lib.ErrorJSON(w, http.StatusNotFound, "Document not found")
		return
	}

	if docErr != nil {
		lib.ErrorJSON(w, http.StatusInternalServerError, "Could not get document")
		return
	}

	ip := lib.GetClientIP(r)

	if !lib.IsIPAllowed(ip, doc.IpWhitelist) {
		lib.ErrorJSON(w, http.StatusBadRequest, "IP not allowed")
		return
	}

	lib.SuccessJSON(w, http.StatusOK, doc)
}
