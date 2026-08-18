# SESSION 02 — Hardware Assembly & Wiring
**Risk tier: HIGH-RISK (hardware). Requires physical verification logged in `HW_VERIFICATION_LOG.md` — code correctness is not evidence for this session.**
**Branch: `session/build-02-hardware-wiring`**
**References: `PIN_MAPPING.md`, ADD §7.3-7.4, Firmware Spec §2.1**

---

## 0. Before you start
Read `PIN_MAPPING.md` in full. Have your multimeter ready — continuity-test every connection before powering anything on, per your owned-kit multimeter's role established earlier in this project. Work on the breadboard first; nothing gets soldered or made permanent this session.

## 1. Power rail first (do this before anything else)
1. Place the ESP32-S3 board at one end of the breadboard.
2. Connect ESP32-S3 **3V3** pin → breadboard positive (+) rail.
3. Connect ESP32-S3 **GND** pin → breadboard negative (−) rail.
4. Wire the AMS1117 module: input from a clean 5V source (USB), output 3.3V → a *second*, separate breadboard rail dedicated to sensor power (keeps sensor power decoupled from the ESP32-S3's own 3.3V rail — good practice, especially for the audio-sensitive INMP441).
5. **Multimeter check:** confirm ~3.3V between the sensor power rail and GND before connecting any sensor. If it's not close to 3.3V, stop and re-check the AMS1117 wiring before proceeding.

## 2. INMP441 (audio) — do this one alone first, nothing else connected yet
The INMP441 is the most power-noise-sensitive component in the whole build — wiring it in isolation first makes any audio problem easy to diagnose.
1. INMP441 **VDD** → sensor power rail (3.3V)
2. INMP441 **GND** → GND rail
3. INMP441 **L/R** → GND rail directly (selects left channel)
4. INMP441 **WS** → ESP32-S3 **GPIO 5**
5. INMP441 **SCK** → ESP32-S3 **GPIO 4**
6. INMP441 **SD** → ESP32-S3 **GPIO 6**
7. Place a 100µF capacitor and a 10µF capacitor between the INMP441's VDD and GND pins, as close to the chip as your breadboard layout allows (per ADD §7.3 — this mic is genuinely power-noise-sensitive).
8. **Multimeter check:** continuity-test each of the 6 connections above before powering on.

## 3. I2C bus — MPU-6050 + BMP280 (shared bus, wire together)
1. MPU-6050 **VCC** → sensor power rail. BMP280 **VCC** → sensor power rail.
2. MPU-6050 **GND** → GND rail. BMP280 **GND** → GND rail.
3. MPU-6050 **SDA** → ESP32-S3 **GPIO 8**. BMP280 **SDA** → the *same* GPIO 8 line (shared bus).
4. MPU-6050 **SCL** → ESP32-S3 **GPIO 9**. BMP280 **SCL** → the *same* GPIO 9 line.
5. Place a 4.7kΩ pull-up resistor between GPIO 8 (SDA) and the 3.3V rail.
6. Place a 4.7kΩ pull-up resistor between GPIO 9 (SCL) and the 3.3V rail.
7. **Confirm no address conflict:** MPU-6050 default I2C address is 0x68, BMP280 is 0x76 or 0x77 — different addresses, safe to share the bus. (This is a check to be aware of, not something to wire differently — just confirm during firmware bring-up in Session 3 that both devices actually respond at their expected addresses.)

## 4. DHT22 (environment — temperature/humidity)
1. DHT22 **VCC** → sensor power rail
2. DHT22 **GND** → GND rail
3. DHT22 **DATA** → ESP32-S3 **GPIO 15**
4. Place a 10kΩ pull-up resistor between GPIO 15 and the 3.3V rail (standard for DHT22's single-wire protocol).

## 5. MQ135 (gas) — via the voltage divider
1. MQ135 **VCC** → the 5V USB rail directly (MQ135's heating element needs 5V, not the 3.3V sensor rail)
2. MQ135 **GND** → GND rail
3. MQ135 **AO** (analog out) → build the voltage divider here: two equal-value resistors (e.g., 10kΩ + 10kΩ) in series between MQ135's AO pin and GND, with the **midpoint** of that divider connected to ESP32-S3 **GPIO 1**. This halves the signal into the ADC-safe range (ADD §7.3, Firmware Spec).
4. **Multimeter check before powering on:** confirm the divider's midpoint reads roughly half of whatever voltage MQ135's AO pin outputs once powered — do this check with the ESP32-S3 *not yet connected* to GPIO 1, to avoid any chance of feeding an unverified voltage into the chip.
5. Note: MQ135 needs 60-120 seconds after power-on before readings stabilize — this is expected, not a fault, when you get to testing in Session 3.

## 6. ACS712 (current) — clamped around the relay-controlled load's power line
1. ACS712 **VCC** → sensor power rail
2. ACS712 **GND** → GND rail
3. ACS712 **OUT** → ESP32-S3 **GPIO 2**
4. **This sensor's IP+/IP− terminals carry the actual current of the monitored machine's power line** — wire this in series with the relay-controlled load's power feed, not to the ESP32-S3's own power. Double-check this specific wiring carefully before powering the monitored machine — this is the one connection in this session touching a separate power circuit from the ESP32-S3 itself.

## 7. SW-420 (vibration hard-trigger)
1. SW-420 **VCC** → sensor power rail
2. SW-420 **GND** → GND rail
3. SW-420 **DO** (digital out) → ESP32-S3 **GPIO 16**

## 8. Relay + physical override switch
1. Relay module **VCC** → sensor power rail (5V-tolerant relay modules can also go to the 5V USB rail directly — check your specific relay module's input voltage rating first)
2. Relay module **GND** → GND rail
3. Relay module **IN** (control signal) → ESP32-S3 **GPIO 17**
4. **Physical override switch:** wire this **in series with the relay's COM/NO output line to the monitored machine** — physically between the relay's switched output and the actual load, NOT connected to any ESP32-S3 GPIO at all. This is the point of the override (ADD §7.4): it has to work even if the firmware and every GPIO on the chip are misbehaving.
5. Override switch state sensing (optional, for the frontend to *display* override status): a separate GPIO, **GPIO 37**, reading the switch's position — this is read-only telemetry, not the safety mechanism itself. The safety mechanism is the physical series wiring in step 4; GPIO 37 just lets the system know the override is engaged.

## 9. RGB LED + buzzer
1. LED **Red** anode → 220Ω resistor → ESP32-S3 **GPIO 18**. LED cathode(s)/common → GND rail.
2. LED **Green** anode → 220Ω resistor → ESP32-S3 **GPIO 21**.
3. LED **Blue** anode → 220Ω resistor → ESP32-S3 **GPIO 35**.
4. Buzzer **+** → ESP32-S3 **GPIO 36**. Buzzer **−** → GND rail.

## 10. Final power-on and verification (do this after every prior step's continuity checks pass)
1. Power the board via USB.
2. **HW-001 through HW-0XX entries required in `HW_VERIFICATION_LOG.md`** — one per sensor, minimum:
   - Confirm each sensor draws expected current (rough sanity check on your multimeter — a wildly high or zero reading signals a wiring problem before you even get to firmware).
   - You will not get real *readings* yet — that's Session 3's firmware bring-up. This session's verification is **wiring correctness**, not sensor data correctness.

## 11. Verification gate
- [ ] Every connection in steps 1-9 continuity-tested with a multimeter *before* power-on, per component, logged in `HW_VERIFICATION_LOG.md`.
- [ ] Power-on current draw sanity-checked per sensor, logged.
- [ ] Override switch physically confirmed wired in series with the relay's load-side output, NOT to any GPIO, with a photo/description logged as HW verification evidence (this is the safety-critical wiring point of the whole session).
- [ ] `STATUS.md` updated: Session 2 complete, schedule tracker day count updated, Session 3 (firmware RTOS skeleton + acquisition task) next.

**Plain-language explain-back for this session (per your stated preference):** at the end of this session, Claude Code should summarize in plain terms what got wired and why the trickiest parts (voltage divider, ACS712's separate power circuit, override switch's independence from any GPIO) work the way they do — so you can explain this wiring decision-by-decision later without re-deriving it.
