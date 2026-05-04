-- Shared PostgreSQL initialisation
-- Runs once on first container start (docker-entrypoint-initdb.d)
-- The superuser 'disaster' and database 'disasterdb' are created
-- automatically by the POSTGRES_* env vars in docker-compose.

-- J3 — Disaster Management System
CREATE USER j3user WITH PASSWORD 'j3password';
CREATE DATABASE j3db OWNER j3user;

-- Kong API Gateway
CREATE USER kong WITH PASSWORD 'kongpass';
CREATE DATABASE kong OWNER kong;

-- Keycloak Identity Provider
CREATE USER keycloak WITH PASSWORD 'keycloak123';
CREATE DATABASE keycloak OWNER keycloak;
