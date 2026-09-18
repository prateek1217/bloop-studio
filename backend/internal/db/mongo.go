// Package db wraps the MongoDB client used for auth storage.
package db

import (
	"context"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type DB struct {
	Client *mongo.Client
	Name   string
}

func Connect(uri, dbName string) (*DB, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client, err := mongo.Connect(options.Client().ApplyURI(uri))
	if err != nil {
		return nil, fmt.Errorf("connecting to mongodb: %w", err)
	}
	if err := client.Ping(ctx, nil); err != nil {
		return nil, fmt.Errorf("pinging mongodb: %w", err)
	}
	return &DB{Client: client, Name: dbName}, nil
}

func (d *DB) Users() *mongo.Collection {
	return d.Client.Database(d.Name).Collection("users")
}

func (d *DB) Close(ctx context.Context) error {
	return d.Client.Disconnect(ctx)
}
