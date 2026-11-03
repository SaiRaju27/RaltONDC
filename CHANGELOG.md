# Changelog

All notable changes to the **RALT ONDC Logistics Provider (BPP)** platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [1.10.0](https://github.com/SaiRaju27/RaltONDC/compare/v1.9.0...v1.10.0) (2026-11-03)

### Features

* **map:** enable continuous mercator panning, trackpad pinch-zoom, and fleet radar hotspots ([338d093](https://github.com/SaiRaju27/RaltONDC/commit/338d093ab8c745f5ff209cdb99a5b60b2929b095))

## [1.9.0](https://github.com/SaiRaju27/RaltONDC/compare/v1.8.2...v1.9.0) (2026-11-02)

### Features

* **tracking:** integrate realistic maps, lb nagar cluster routing, pinch-to-zoom, and dashboard ui overhaul ([c68bbbe](https://github.com/SaiRaju27/RaltONDC/commit/c68bbbe1e63e0d676bb9e8bcadd2231b90ed08cf))

## [1.8.2](https://github.com/SaiRaju27/RaltONDC/compare/v1.8.1...v1.8.2) (2026-11-02)

### Bug Fixes

* **mobile:** remove aggressive abort controller to prevent cancelled fetch on airbrick otp dispatch ([fae6f45](https://github.com/SaiRaju27/RaltONDC/commit/fae6f450ab9a9df1df774646e5ed266c9e998af4))

## [1.8.1](https://github.com/SaiRaju27/RaltONDC/compare/v1.8.0...v1.8.1) (2026-11-02)

### Bug Fixes

* **auth:** enable fast direct airbrick fallback in registration and allow otp dispatch for all numbers ([7230c63](https://github.com/SaiRaju27/RaltONDC/commit/7230c631c1bca5af688a5594135c3c979e69e22a))
* **test:** align test SQL queries with PostgreSQL schema and allow native sqlite3 build ([71dd10f](https://github.com/SaiRaju27/RaltONDC/commit/71dd10f3735c64afc4c14ee05a225bb9613aac47))

## [1.8.0](https://github.com/SaiRaju27/RaltONDC/compare/v1.7.1...v1.8.0) (2026-11-02)

### Features

* enforce port 5001, dynamic bank ifsc resolution, remove demo data, safe registration timeout, and 85%+ test coverage ([5f402c6](https://github.com/SaiRaju27/RaltONDC/commit/5f402c68612b32b6d66224d98a221ae25a9a0bc0))

## [1.7.1](https://github.com/SaiRaju27/RaltONDC/compare/v1.7.0...v1.7.1) (2026-11-02)

### Bug Fixes

* **docker:** optimize Dockerfile for low-memory environments by copying prebuilt dist ([a43223a](https://github.com/SaiRaju27/RaltONDC/commit/a43223a662e8d37751d2e7d5898df8c9295c36ff))

## [1.7.0](https://github.com/SaiRaju27/RaltONDC/compare/v1.6.0...v1.7.0) (2026-11-02)

### Features

* **tracking:** implement 60fps vector live tracking map, telemetry hud, and public ondc tracking portal ([665c855](https://github.com/SaiRaju27/RaltONDC/commit/665c85541c9b77ed77e2208ddc05f5e45ba3a63b))

## [1.6.0](https://github.com/SaiRaju27/RaltONDC/compare/v1.5.5...v1.6.0) (2026-11-02)

### Features

* **mobile:** harmonize registration flow, 1-tap demo login, and cloud environment toggle ([4f12b66](https://github.com/SaiRaju27/RaltONDC/commit/4f12b660c42e2d74578f84e6d9a5075d01854b31))

## [1.5.5](https://github.com/SaiRaju27/RaltONDC/compare/v1.5.4...v1.5.5) (2026-11-02)

### Bug Fixes

* **mobile:** declare sdkVersion 58.0.0, block duplicate metro folders, and clear cache on start ([54aa203](https://github.com/SaiRaju27/RaltONDC/commit/54aa20321138ce8c4beb8f0b90c188e008f084d5))

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
