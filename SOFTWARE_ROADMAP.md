# REZON Software-Only Implementation Roadmap

This document outlines the deferred-hardware execution plan. We are completing all software, cloud, and frontend infrastructure first. Hardware, firmware, and embedded ML tasks (Sessions 02-09) are deferred until this roadmap is complete.

## Phase A: Frontend Data Layer & Core Dashboards
- [x] **Session 13: Data State Layer** - Integrate `@tanstack/react-query`, set up QueryClientProvider, and build reusable data hooks for Supabase.
- [x] **Session 14: Home (Digital Twin)** - Build the main dashboard featuring real-time sensor gauges, system status, and machine visualization.
- [x] **Session 15: Sensor Streams & Timeline** - Build the high-frequency line charts (Recharts) for real-time `telemetry` visualization.
- [x] **Session 16: Incidents** - Build the anomaly event list and detailed narrative breakdown views.
- [x] **Session 17: Safety Chain Monitor** - Build the state-machine visualization for the hardware relay and safety overrides.

## Phase B: Frontend Analytics & Management
- [x] **Session 18: Analytics & Model Drift** - Build historical distribution charts and drift metrics for the IDNN model.
- [x] **Session 19: Since-Calibration & Digest** - Build the weekly reporting views and post-calibration comparison tools.
- [ ] **Session 20: Threshold Sandbox** - Build the interactive client-side threshold adjustment sandbox (simulating ML logic in the browser).
- [ ] **Session 21: Trust Audit** - Build the static documentation-as-a-feature page detailing the safety mechanisms.
- [ ] **Session 22: Device & Calibration** - Build device management and sensor baseline configuration pages.
- [ ] **Session 23: Deployments** - Build the Over-The-Air (OTA) firmware update history and rollback interface.
- [ ] **Session 24: Notifications & Access** - Build operator-only settings for RBAC and alert preferences.
- [ ] **Session 25: Settings & Help** - Build the general user settings and system help documentation.
- [ ] **Session 26: Public Status Page** - Build the `/status` route (unauthenticated) querying aggregated telemetry summaries.
- [ ] **Session 27: Resilience & Responsive Retrofit** - Final polish of empty states, error boundaries, and mobile responsiveness.
- [ ] **Session 28: Frontend Verification** - End-to-end linting, build verification, and strict type checking of the complete frontend.

## Phase C: Local MLOps Infrastructure
- [ ] **Session 29: Docker & TimescaleDB** - Scaffold the local TimescaleDB instance for hypertable analytics via `docker-compose`.
- [ ] **Session 30: MLflow & Evidently** - Set up the local model registry and data drift evaluation environment.
- [ ] **Session 31: Scheduled Scripting** - Finalize the local Python daemon for data syncing, model retraining, and Supabase interaction.
- [ ] **Session 32: Grafana** - Initialize the local Grafana dashboards pointing to TimescaleDB.

## Phase D: Cloud & Mock Testing
- [ ] **Session 33: Cloud Hardening** - Finalize Supabase Edge functions, RLS policies, and Database Webhooks.
- [ ] **Session 34-37 (Software Aspects):** - Mock telemetry streams via Python to simulate a live hardware burn-in, testing the entire Next.js and MLOps stack end-to-end.

---
*Tracker generated on 2026-08-18 to accommodate hardware deferral.*
