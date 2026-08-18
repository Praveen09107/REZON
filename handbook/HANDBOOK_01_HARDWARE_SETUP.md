# Handbook 01 — Hardware Setup
**Workspace and tooling prep before Session 2's literal wiring steps. This is about the environment you wire in, not the wiring itself — that's `specs/sessions/SESSION_02_hardware_wiring.md`.**

## Workspace
- Clear, static-safe surface (a wooden desk is fine; avoid carpet/synthetic fabric near the components while handling the bare board).
- Good lighting — you'll be reading small pin labels on the ESP32-S3 board and sensor modules.

## Before you touch anything
- Confirm `specs/sessions/PIN_MAPPING.md` is open and visible — you'll reference it constantly during Session 2.
- Multimeter: set to continuity mode (usually a diode/beep symbol) for the pre-power checks; you'll switch to DC voltage mode for the post-power 3.3V rail check.

## Basic multimeter use, if this is new to you
- **Continuity check:** touch one probe to each end of a connection with power OFF. A beep/tone means the connection is good. No beep means a bad connection or a wire that isn't actually seated.
- **Voltage check:** touch the black probe to GND, red probe to the point you're measuring, power ON. Read the display in volts.

## ESD (static) precaution
- Touch a grounded metal object (like a laptop's metal chassis while it's plugged into a grounded outlet) before handling the bare ESP32-S3 board, especially the first time you unpack it.

## What you'll need within reach for Session 2
Breadboard, all sensors, resistor kit, Dupont wires, the ESP32-S3 board, USB-C cable, multimeter — laid out and organized before starting, not gathered mid-session.
