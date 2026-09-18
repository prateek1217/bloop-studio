// Package config loads and validates the backend's environment configuration.
package config

import (
	"fmt"
	"os"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	Port         string
	MongoURI     string
	MongoDBName  string
	JWTSecret    []byte
	TokenTTL     time.Duration
	CookieName   string
	CookieSecure bool
}

// Load reads backend/.env (if present) then required environment variables.
// It fails fast on missing secrets rather than falling back to an insecure
// default — an auth server with a guessable JWT secret is worse than one
// that refuses to start.
func Load() (*Config, error) {
	_ = godotenv.Load()

	mongoURI := os.Getenv("MONGODB_URI")
	if mongoURI == "" {
		return nil, fmt.Errorf("MONGODB_URI is not set (add it to backend/.env)")
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET is not set (add it to backend/.env)")
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	dbName := os.Getenv("MONGODB_DB")
	if dbName == "" {
		dbName = "subtitle_studio"
	}

	return &Config{
		Port:         port,
		MongoURI:     mongoURI,
		MongoDBName:  dbName,
		JWTSecret:    []byte(jwtSecret),
		TokenTTL:     24 * time.Hour,
		CookieName:   "session_token",
		CookieSecure: os.Getenv("COOKIE_SECURE") == "true",
	}, nil
}
