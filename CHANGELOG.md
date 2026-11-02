# Changelog

All notable changes to the **RALT ONDC Logistics Provider (BPP)** platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.6] - 2026-11-02

### Features
- **Monorepo Architecture**: Adopted enterprise monorepo workspace standards (`apps/delivery-app`, `services/ondc-lsp-service`, `packages/database`, `deploy/`).
- **ONDC BPP Logistics**: Hyperlocal point-to-point delivery provider (`ONDC:LOG10`) with Beckn protocol async endpoints (`/search`, `/init`, `/confirm`, `/status`, `/track`, `/cancel`, `/update`).
- **PostGIS Geospatial Matching**: High-performance spatial indexing with `ST_DWithin` and `ST_Distance` spherical matching for rider proximity.
- **Enterprise Delivery Partner App**: Single responsive delivery app supporting mobile (iOS, Android, PWA) and desktop widescreen layouts.
- **Automated CI/CD**: Zero-downtime deployment pipeline to AWS Lightsail with automated health probing, rollback, and daily PostGIS snapshots.

