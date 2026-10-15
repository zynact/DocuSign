package controllers

import (
	"encoding/json"
	"mime"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/fbn776/inkra/database"
	"github.com/go-chi/chi/v5"
)

func TestSignedDocumentAccess(t *testing.T) {
	t.Chdir(t.TempDir())
	previousDB := database.DB
	if err := database.InitDB(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		database.DB.Close()
		database.DB = previousDB
	})
	pdf := "%PDF-1.7\nSigned document fixture"
	path := filepath.Join(t.TempDir(), "signed.pdf")
	if err := os.WriteFile(path, []byte(pdf), 0600); err != nil {
		t.Fatal(err)
	}
	_, err := database.DB.Exec(`INSERT INTO DOCUMENTS (id, title, description, original_name, original_path, signed_path, is_signed)
		VALUES ('doc', 'Agreement', '', 'agreement.pdf', 'original.pdf', ?, 1)`, path)
	if err != nil {
		t.Fatal(err)
	}
	session, token, err := database.CreateSigningSession("doc", time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	router := chi.NewRouter()
	router.Get("/sessions/{token}", GetSigningSession)
	router.Get("/sessions/{token}/download", DownloadSignedDocument)

	for _, tc := range []struct {
		name, status                        string
		expired, deleted, unsigned, missing bool
		want                                int
	}{
		{name: "completed", status: "completed", want: http.StatusOK},
		{name: "pending", status: "pending", want: http.StatusGone},
		{name: "in progress", status: "in_progress", want: http.StatusGone},
		{name: "cancelled", status: "cancelled", want: http.StatusGone},
		{name: "expired completion", status: "completed", expired: true, want: http.StatusGone},
		{name: "deleted document", status: "completed", deleted: true, want: http.StatusGone},
		{name: "unsigned document", status: "completed", unsigned: true, want: http.StatusGone},
		{name: "missing file", status: "completed", missing: true, want: http.StatusNotFound},
	} {
		t.Run(tc.name, func(t *testing.T) {
			expires := time.Now().Add(time.Hour)
			if tc.expired {
				expires = time.Now().Add(-time.Hour)
			}
			if _, err := database.DB.Exec("UPDATE SIGNING_SESSIONS SET status = ?, expires_at = ? WHERE id = ?", tc.status, expires, session.ID); err != nil {
				t.Fatal(err)
			}
			filePath := path
			if tc.missing {
				filePath += ".missing"
			}
			if _, err := database.DB.Exec("UPDATE DOCUMENTS SET deleted = ?, is_signed = ?, signed_path = ? WHERE id = 'doc'", tc.deleted, !tc.unsigned, filePath); err != nil {
				t.Fatal(err)
			}
			recorder := httptest.NewRecorder()
			router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/sessions/"+token+"/download", nil))
			if recorder.Code != tc.want {
				t.Fatalf("got %d, want %d: %s", recorder.Code, tc.want, recorder.Body.String())
			}
			if tc.want == http.StatusOK {
				if recorder.Body.String() != pdf || recorder.Header().Get("Content-Type") != "application/pdf" {
					t.Fatal("download did not return the signed PDF")
				}
				kind, params, err := mime.ParseMediaType(recorder.Header().Get("Content-Disposition"))
				if err != nil || kind != "attachment" || params["filename"] != "agreement-signed.pdf" {
					t.Fatal("download is missing its attachment filename")
				}
				// Refreshing the completed link must preserve completion and expose no signing form.
				refreshed := httptest.NewRecorder()
				router.ServeHTTP(refreshed, httptest.NewRequest(http.MethodGet, "/sessions/"+token, nil))
				var result struct {
					Data struct {
						Session database.SigningSession `json:"session"`
					} `json:"data"`
				}
				if err := json.Unmarshal(refreshed.Body.Bytes(), &result); err != nil || refreshed.Code != http.StatusOK || result.Data.Session.Status != "completed" {
					t.Fatalf("completed link did not reopen: %s", refreshed.Body.String())
				}
				stored, err := database.GetSigningSession(token)
				if err != nil || stored.Status != "completed" {
					t.Fatal("reopening changed the completed session")
				}
			}
		})
	}
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/sessions/unknown/download", nil))
	if recorder.Code != http.StatusNotFound {
		t.Fatalf("unknown token returned %d", recorder.Code)
	}
}
