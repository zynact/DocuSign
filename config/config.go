package config

import "os"

type Config struct {
	Port          string
	JwtSecret     string
	AdminUsername string
	AdminPassword string
	MaxFileSize   int64
}

var AppConfig Config

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func Load() {
	AppConfig = Config{
		Port:          getEnv("PORT", "8080"),
		JwtSecret:     getEnv("JWT_SECRET", "dev-secret"),
		AdminUsername: getEnv("ADMIN_USERNAME", ""),
		AdminPassword: getEnv("ADMIN_PASSWORD", ""),
		MaxFileSize:   100 << 20,
	}
}
