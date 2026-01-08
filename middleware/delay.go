package middleware

import (
	"net/http"
	"time"
)

// Delay : For testing purposes
func Delay(d time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			time.Sleep(d)
			next.ServeHTTP(w, r)
		})
	}
}
