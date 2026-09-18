// Package models holds the MongoDB document shapes.
package models

import (
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

type User struct {
	ID           bson.ObjectID `bson:"_id,omitempty" json:"id"`
	Email        string        `bson:"email"          json:"email"`
	PasswordHash string        `bson:"passwordHash"    json:"-"`
	CreatedAt    time.Time     `bson:"createdAt"       json:"createdAt"`
}
