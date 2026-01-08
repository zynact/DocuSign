package lib

import (
	"encoding/json"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/fbn776/inkra/config"
	"github.com/golang-jwt/jwt/v5"
)

func SendJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	err := json.NewEncoder(w).Encode(data)
	if err != nil {
		panic(err)
	}
}

func SuccessJSON(w http.ResponseWriter, status int, data any) {
	SendJSON(w, status, map[string]any{"success": true, "data": data})
}

func ErrorJSON(w http.ResponseWriter, status int, message string) {
	SendJSON(w, status, map[string]any{"success": false, "message": message})
}

type Claims struct {
	Email string `json:"email"`
	jwt.RegisteredClaims
}

func GenerateJWT(email string) (string, error) {
	claims := Claims{
		Email: email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	return token.SignedString([]byte(config.AppConfig.JwtSecret))
}

func CsvToSlice(input string) []string {
	parts := strings.Split(input, ",")
	result := make([]string, 0, len(parts))

	for _, p := range parts {
		v := strings.TrimSpace(p)
		if v != "" {
			result = append(result, v)
		}
	}

	return result
}

func GetClientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		ips := strings.Split(xff, ",")
		return strings.TrimSpace(ips[0])
	}

	if xrip := r.Header.Get("X-Real-IP"); xrip != "" {
		return xrip
	}

	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil {
		return host
	}

	return r.RemoteAddr
}

func IsIPAllowed(ipStr string, whitelist []string) bool {
	if len(whitelist) == 0 {
		return true
	}

	ip := net.ParseIP(ipStr)
	if ip == nil {
		return false
	}

	for _, entry := range whitelist {
		if strings.Contains(entry, "/") {
			_, subnet, err := net.ParseCIDR(entry)
			if err == nil && subnet.Contains(ip) {
				return true
			}
		} else if ipStr == entry {
			return true
		}
	}
	return false
}
