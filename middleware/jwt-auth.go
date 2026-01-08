package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/fbn776/inkra/config"
	"github.com/fbn776/inkra/lib"
	"github.com/golang-jwt/jwt/v5"
)

func JWTAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")

		if authHeader == "" {
			lib.ErrorJSON(w, http.StatusUnauthorized, "Authorization header is missing")
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")

		claims := &lib.Claims{}

		token, err := jwt.ParseWithClaims(
			tokenString,
			claims,
			func(token *jwt.Token) (interface{}, error) {
				return []byte(config.AppConfig.JwtSecret), nil
			},
		)

		if err != nil || !token.Valid {
			lib.ErrorJSON(w, http.StatusUnauthorized, "Invalid token")
			return
		}

		ctx := context.WithValue(r.Context(), "userEmail", claims.Email)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
