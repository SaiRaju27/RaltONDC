# Changelog

All notable changes to the **RALT ONDC Logistics Provider (BPP)** platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [1.5.4](https://github.com/SaiRaju27/RaltONDC/compare/v1.5.3...v1.5.4) (2026-11-02)

### Bug Fixes

* **mobile:** ensure expo and app dependencies are installed before launch ([8cc2d86](https://github.com/SaiRaju27/RaltONDC/commit/8cc2d861c403a4add6c3f071b7a02ab0185856f6))

## [1.5.3](https://github.com/SaiRaju27/RaltONDC/compare/v1.5.2...v1.5.3) (2026-11-02)

### Bug Fixes

* **docker:** run clean npm install in Dockerfile to avoid missing hoisted monorepo dependencies like depd ([bf56103](https://github.com/SaiRaju27/RaltONDC/commit/bf561030893c91ac4da8b0c9ad8f45bc7fbf473a))

## [1.5.2](https://github.com/SaiRaju27/RaltONDC/compare/v1.5.1...v1.5.2) (2026-11-02)

### Bug Fixes

* **auth:** resolve Expo demo rider login and enable cloud-first fallback with active backend toggle ([7d699bd](https://github.com/SaiRaju27/RaltONDC/commit/7d699bddea6ccf3f736a75935f57c35fbc1747a7))

## [1.5.1](https://github.com/SaiRaju27/RaltONDC/compare/v1.5.0...v1.5.1) (2026-11-02)

### Performance Improvements

* **auth:** auto-fill instant OTP 1234 in dev, add 1-tap mobile fill pill, and enable 4-digit auto-verify ([86b84cb](https://github.com/SaiRaju27/RaltONDC/commit/86b84cb26507a998f25f8afce57fbdfb3efaad91))

## [1.5.0](https://github.com/SaiRaju27/RaltONDC/compare/v1.4.1...v1.5.0) (2026-11-02)

### Features

* **mobile:** add dynamic environment resolver for local vs production APK/iOS builds ([f6c3cac](https://github.com/SaiRaju27/RaltONDC/commit/f6c3cac0ed6924d7b66ae563ae9061d9d12b7467))

## [1.4.1](https://github.com/SaiRaju27/RaltONDC/compare/v1.4.0...v1.4.1) (2026-11-02)

### Documentation

* **bruno:** add Authorization Bearer token header and dynamic token capture script ([ab57ed3](https://github.com/SaiRaju27/RaltONDC/commit/ab57ed3fea9e95e3d4ae293ed80b989ca57d2bc4))

### Code Refactoring

* format Bruno API collection files with trailing newlines ([fe0fb99](https://github.com/SaiRaju27/RaltONDC/commit/fe0fb996a0ba8d3a4230f37d2a9a3980f1aaeef9))

## [1.4.0](https://github.com/SaiRaju27/RaltONDC/compare/v1.3.0...v1.4.0) (2026-11-02)

### Features

* **security:** enforce requireRiderAuth on protected routes and document multi-cloud push targets ([2189529](https://github.com/SaiRaju27/RaltONDC/commit/2189529821f79a9c561e0b94d9c36daf3dfd4fe5))

### Documentation

* **api:** add Bruno and Postman test collection with production endpoints ([4cb7488](https://github.com/SaiRaju27/RaltONDC/commit/4cb7488c009dbcd304b355756135197ac20e6fbb))
* **api:** structure Bruno collection into 7 categorized folders with pre-filled live URLs ([b525007](https://github.com/SaiRaju27/RaltONDC/commit/b52500716890ab0d4e17ad19e7d3b45dac6cb0ba))

## [1.3.0](https://github.com/SaiRaju27/RaltONDC/compare/v1.2.0...v1.3.0) (2026-11-02)

### Features

* **deploy:** wire full cluster networking with PostgreSQL, Redis, RabbitMQ and self-healing ([c7f54c8](https://github.com/SaiRaju27/RaltONDC/commit/c7f54c8250f9f218cfd56669fae36b9ee11a2a1e))

## [1.2.0](https://github.com/SaiRaju27/RaltONDC/compare/v1.1.0...v1.2.0) (2026-11-02)

### Features

* **deploy:** transition Lightsail runtime to Docker containers with host Nginx reverse proxy ([c548bd3](https://github.com/SaiRaju27/RaltONDC/commit/c548bd3abb4887ad5afad51441ee8e6e4fcf1c98))

## [1.1.0](https://github.com/SaiRaju27/RaltONDC/compare/v1.0.0...v1.1.0) (2026-11-02)

### Features

* **cicd:** add AWS CodeDeploy appspec and lifecycle hooks for Lightsail zero-downtime deployment ([bdd2a01](https://github.com/SaiRaju27/RaltONDC/commit/bdd2a015942f72cde438b104d329d7388b0af3e4))

## 1.0.0 (2026-11-02)

### Features

* **architecture:** monorepo reorganization, semantic release, and enterprise delivery app enhancements ([dec831e](https://github.com/SaiRaju27/RaltONDC/commit/dec831eb322a1562c3e89fd8be0c81ba1228c15e))
* **test:** add full frontend and backend test suites with 85%+ coverage, security scans, and CI/CD quality gates ([83591e7](https://github.com/SaiRaju27/RaltONDC/commit/83591e712a81b96d29b00fb45a98f64da09acd1c))

### Bug Fixes

* **ci:** add in-memory fallbacks for redis/queue services and fix test teardown ([f7872d0](https://github.com/SaiRaju27/RaltONDC/commit/f7872d0b47c3438e96bac8c33a94ff90de30ce8c))
* **ci:** hoist shared type declarations to root, add declarations fallback, and fix CI npm install in workspaces ([417ee36](https://github.com/SaiRaju27/RaltONDC/commit/417ee36121cf54ab35cb1d91c54dd34c1f07d2db))
* **ci:** update semantic release dependencies, configure manual CD trigger, and resolve delivery-app tsconfig types ([c860c24](https://github.com/SaiRaju27/RaltONDC/commit/c860c2455fd05770a772c4d018d9df0b2a6a3cf0))

## [1.2.6] - 2026-11-02

### Features
- **Monorepo Architecture**: Adopted enterprise monorepo workspace standards (`apps/delivery-app`, `services/ondc-lsp-service`, `packages/database`, `deploy/`).
- **ONDC BPP Logistics**: Hyperlocal point-to-point delivery provider (`ONDC:LOG10`) with Beckn protocol async endpoints (`/search`, `/init`, `/confirm`, `/status`, `/track`, `/cancel`, `/update`).
- **PostGIS Geospatial Matching**: High-performance spatial indexing with `ST_DWithin` and `ST_Distance` spherical matching for rider proximity.
- **Enterprise Delivery Partner App**: Single responsive delivery app supporting mobile (iOS, Android, PWA) and desktop widescreen layouts.
- **Automated CI/CD**: Zero-downtime deployment pipeline to AWS Lightsail with automated health probing, rollback, and daily PostGIS snapshots.
