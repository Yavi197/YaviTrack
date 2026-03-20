#!/bin/bash
# Useful commands for Med-iTrack development

# ============================================================================
# DEVELOPMENT COMMANDS
# ============================================================================

# Start development server
dev:
	npm run dev

# Build for production
build:
	npm run build

# Start production server
start:
	npm run start

# Run linter
lint:
	npm run lint

# ============================================================================
# FIREBASE COMMANDS
# ============================================================================

# Install Firebase CLI
firebase-install:
	npm install -g firebase-tools

# Login to Firebase
firebase-login:
	firebase login

# Initialize Firebase project
firebase-init:
	firebase init

# Deploy Firestore and Storage rules
firebase-deploy-rules:
	firebase deploy --only firestore:rules,storage

# Deploy all (rules, hosting, functions, etc)
firebase-deploy-all:
	firebase deploy

# Start Firebase emulator suite
firebase-emulate:
	firebase emulators:start

# View Firebase logs
firebase-logs:
	firebase functions:log

# ============================================================================
# DEVELOPMENT UTILITIES
# ============================================================================

# Install dependencies
install:
	npm install

# Update dependencies
update:
	npm update

# Audit dependencies
audit:
	npm audit

# Fix vulnerabilities
audit-fix:
	npm audit fix --force

# Clean node_modules and reinstall
clean:
	rm -rf node_modules package-lock.json
	npm install

# ============================================================================
# DATABASE COMMANDS
# ============================================================================

# Export Firestore data
db-export:
	firebase firestore:delete --recursive --yes

# Backup Firestore
db-backup:
	gcloud firestore export gs://med-itrack-backup/$(date +%Y%m%d-%H%M%S)

# ============================================================================
# DOCKER COMMANDS (for containerization)
# ============================================================================

# Build Docker image
docker-build:
	docker build -t med-itrack .

# Run Docker container
docker-run:
	docker run -p 3000:3000 med-itrack

# ============================================================================
# GIT COMMANDS
# ============================================================================

# Commit with lint check
commit:
	npm run lint && git add . && git commit -m "$(MSG)"

# Push to repository
push:
	git push origin main

# Pull latest changes
pull:
	git pull origin main

# ============================================================================
# TESTING COMMANDS
# ============================================================================

# Run tests
test:
	npm test

# Run tests with coverage
test-coverage:
	npm test -- --coverage

# ============================================================================
# HELPFUL NOTES
# ============================================================================

# Environment Setup:
# 1. Copy .env.local.example to .env.local
# 2. Fill in Firebase credentials
# 3. Run: firebase deploy --only firestore:rules

# First Time Setup:
# 1. npm install
# 2. npm run dev
# 3. Create Firebase project at console.firebase.google.com
# 4. Configure .env.local
# 5. firebase deploy --only firestore:rules
# 6. Create test users in Firebase Console

# Troubleshooting:
# - If "Missing script" error: npm install again
# - If "Firebase config incomplete": Check .env.local
# - If "Permission denied": Check firestore.rules are deployed
# - If "CORS errors": Configure Firebase Hosting

# Security Checklist:
# - [ ] .env.local created and filled
# - [ ] .env.local in .gitignore
# - [ ] firestore.rules deployed
# - [ ] Authentication enabled
# - [ ] Test users created
# - [ ] Database collections created

help:
	@echo "Med-iTrack Development Commands"
	@echo "================================"
	@echo "Development:"
	@echo "  make dev          - Start development server"
	@echo "  make build        - Build for production"
	@echo ""
	@echo "Firebase:"
	@echo "  make firebase-login        - Login to Firebase"
	@echo "  make firebase-deploy-rules - Deploy security rules"
	@echo ""
	@echo "Utilities:"
	@echo "  make install      - Install dependencies"
	@echo "  make clean        - Clean and reinstall"
	@echo "  make audit-fix    - Fix security vulnerabilities"
	@echo ""
	@echo "For more info, see SETUP.md and README.md"
