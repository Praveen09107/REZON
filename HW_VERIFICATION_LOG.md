# Hardware Verification Log

This log is used to document the physical verification of the hardware assembly and wiring for the REZON project.
Each hardware session requires explicit documentation of continuity checks, voltage sanity checks, and physical assembly compliance.

## Session 02: Hardware Wiring

### Component Continuity & Power Checks
- [ ] **HW-001 (Power Rails)**: Multimeter reading across sensor power rail and GND: _______ V (Expected: ~3.3V)
- [ ] **HW-002 (INMP441 - Audio)**: Continuity checked for VDD, GND, L/R, WS (GPIO 5), SCK (GPIO 4), SD (GPIO 6). Current draw: _______ mA
- [ ] **HW-003 (MPU-6050 - Vibration)**: Continuity checked for VCC, GND, SDA (GPIO 8), SCL (GPIO 9). Current draw: _______ mA
- [ ] **HW-004 (BMP280 - Environment)**: Continuity checked for VCC, GND, SDA (GPIO 8), SCL (GPIO 9). Current draw: _______ mA
- [ ] **HW-005 (DHT22 - Environment)**: Continuity checked for VCC, GND, DATA (GPIO 15). Current draw: _______ mA
- [ ] **HW-006 (MQ135 - Gas)**: Continuity checked for VCC (5V), GND. Voltage divider midpoint reading: _______ V (Expected: ~1.65V to 2.5V). Current draw: _______ mA
- [ ] **HW-007 (ACS712 - Current)**: Continuity checked for VCC, GND, OUT (GPIO 2). Current draw: _______ mA
- [ ] **HW-008 (SW-420 - Vibration Hard-Trigger)**: Continuity checked for VCC, GND, DO (GPIO 16). Current draw: _______ mA
- [ ] **HW-009 (Relay & LED/Buzzer)**: Continuity checked for Relay IN (GPIO 17), LEDs (GPIO 18, 21, 35), Buzzer (GPIO 36).

### Safety-Critical Checks
- [ ] **HW-010 (Physical Override Switch)**: Physically confirmed wired in series with the relay's load-side output to the monitored machine, NOT connected to any ESP32-S3 GPIO for the switching action. 
  - *Notes/Photo Reference*: ___________________________________________________________

---
*End of Session 02 Verification*
