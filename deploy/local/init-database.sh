#!/usr/bin/env bash
set -eu
# Variables are psql parameters, not interpolated SQL. The application is not a superuser.
psql --username postgres --dbname postgres --set ON_ERROR_STOP=1 \
  --set app_user="$APP_USER" --set app_password="$APP_PASSWORD" --set app_db="$APP_DB" <<'SQL'
CREATE ROLE :"app_user" LOGIN PASSWORD :'app_password' NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE DATABASE :"app_db" OWNER :"app_user";
SQL
