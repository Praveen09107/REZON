# REZON — GPIO Pin Mapping (Verified)
**Source: EdgeHax's own official pinout document for the ESP32-S3-WROOM-N16R8 board (fetched and verified directly, not assumed from a generic ESP32-S3 diagram). Produced as Session 1's core deliverable — provided here since the verification research was done as part of writing Session 2.**

**Pins deliberately avoided, and why:** GPIO 0 (BOOT strapping pin), GPIO 45/46 (strapping pins), GPIO 19/20 (native USB D-/D+), GPIO 43/44 (UART0 — reserved for programming/serial monitor), GPIO 33/34 (not broken out — internally reserved for Octal PSRAM on this N16R8 variant).

| Signal | GPIO | Notes |
|---|---|---|
| I2S_SCK (INMP441 bit clock) | GPIO 4 | |
| I2S_WS (INMP441 word select) | GPIO 5 | |
| I2S_SD (INMP441 data out) | GPIO 6 | INMP441's L/R pin wires directly to GND (left channel), not a GPIO |
| I2C_SDA (MPU-6050 + BMP280, shared bus) | GPIO 8 | 🟡 Common ESP32-S3 I2C default — confirm against the board's onboard I2C connector labeling during Session 2, easy to reassign if it conflicts |
| I2C_SCL | GPIO 9 | 🟡 same note as above |
| DHT22_DATA | GPIO 15 | Single-wire |
| MQ135_AO (via voltage divider) | GPIO 1 | ADC1_0 — confirmed ADC-capable |
| ACS712_OUT (via filter) | GPIO 2 | ADC1_1 — confirmed ADC-capable |
| SW420_OUT | GPIO 16 | Digital input, interrupt-capable (Firmware Spec §2.1) |
| RELAY_CTRL | GPIO 17 | Digital output |
| LED_RED | GPIO 18 | |
| LED_GREEN | GPIO 21 | |
| LED_BLUE | GPIO 35 | |
| BUZZER_CTRL | GPIO 36 | |
| OVERRIDE_SW | GPIO 37 | Digital input — physical override, per ADD §7.4 |
| MicroSD | *(onboard, no GPIO assignment needed)* | Board has a dedicated onboard microSD slot wired internally by the manufacturer — not user-wired |

**Power:** all sensors run off the board's 3V3 rail through the AMS1117 regulator (owned component) unless otherwise noted. GND is shared/common across all components.
