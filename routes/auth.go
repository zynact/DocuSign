package routes

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/fbn776/inkra/database"
	"github.com/fbn776/inkra/lib"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/httprate"
	"golang.org/x/crypto/bcrypt"
)

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func AuthRouter(r chi.Router) {
	var getUSerByEmailStmt, _ = database.DB.Prepare("SELECT login_email, login_password_hash from settings where login_email = ?")

	r.With(httprate.LimitByIP(5, time.Minute)).Post("/login", func(res http.ResponseWriter, req *http.Request) {
		var loginRequest LoginRequest

		if err := json.NewDecoder(req.Body).Decode(&loginRequest); err != nil {
			http.Error(res, err.Error(), http.StatusBadRequest)
			return
		}

		if loginRequest.Email == "" && loginRequest.Password == "" {
			lib.ErrorJSON(res, http.StatusBadRequest, "Email or password is empty")
			return
		}

		var dbEmail, dbPassword string

		tokenErr := getUSerByEmailStmt.QueryRow(loginRequest.Email).Scan(&dbEmail, &dbPassword)

		if tokenErr == sql.ErrNoRows {
			lib.ErrorJSON(res, http.StatusUnauthorized, "Invalid credentials")
			return
		} else if tokenErr != nil {
			lib.ErrorJSON(res, http.StatusInternalServerError, "Could not get user")
		}

		compareResult := bcrypt.CompareHashAndPassword([]byte(dbPassword), []byte(loginRequest.Password))

		if compareResult != nil {
			lib.ErrorJSON(res, http.StatusUnauthorized, "Invalid credentials")
			return
		}

		token, tokenErr := lib.GenerateJWT(loginRequest.Email)

		if tokenErr != nil {
			fmt.Println("ERROR: ", tokenErr)
			lib.ErrorJSON(res, http.StatusInternalServerError, "Could not generate token")
			return
		}

		lib.SuccessJSON(res, http.StatusOK, map[string]string{
			"token": token,
		})
	})
}
