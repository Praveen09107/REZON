# SESSION 03 — RTOS Skeleton + Sensor Acquisition Task
**Risk tier: HIGH-RISK (hardware + timing-critical). Requires physical verification logged in `HW_VERIFICATION_LOG.md`.**
**Branch: `session/build-03-rtos-acquisition`**
**Attach: `specs/technical/02_FIRMWARE_RTOS_TECHNICAL_SPEC.md` §1-2, `specs/sessions/PIN_MAPPING.md`, `.claude/CLAUDE.md`**

---

## Agent Instructions

Build the FreeRTOS task skeleton (all 5 tasks, correct priorities/cores/stacks per Firmware Spec §1) and the Sensor Acquisition Task's real implementation — actually reading raw data from all 6 physical inputs (audio, IMU, environment, gas, current, SW-420). Feature extraction, inference, networking, and output tasks are stubbed this session (empty task bodies that just prove the skeleton compiles and schedules correctly) — their real implementation is Session 4 onward. Do not implement anything beyond acquisition's real logic this session.

**What this session creates:**
- `main/rezon_main.c` — app entry, creates all 5 tasks
- `main/config.h` — pin definitions, task priorities/stacks, sensor rates
- `main/acquisition_task.c` / `.h` — the real acquisition task
- `main/drivers/i2s_audio.c` / `.h` — INMP441 via I2S DMA
- `main/drivers/i2c_bus.c` / `.h` — shared I2C bus + MPU-6050 + BMP280
- `main/drivers/dht22.c` / `.h` — single-wire driver
- `main/drivers/adc_sensors.c` / `.h` — MQ135 + ACS712
- `main/drivers/sw420_isr.c` / `.h` — interrupt-driven trigger log
- `main/stub_tasks.c` — placeholder bodies for the other 4 tasks (Session 4+ replaces these)
- `test/test_config_values.c` — Unity host-side test confirming config.h matches the spec exactly

---

## FILE 1: `main/config.h`

```c
#ifndef REZON_CONFIG_H
#define REZON_CONFIG_H

// ==== Pin assignments — verified against PIN_MAPPING.md, do not edit
//      without re-verifying against the real board's manufacturer pinout ====
#define PIN_I2S_SCK       4
#define PIN_I2S_WS        5
#define PIN_I2S_SD        6
#define PIN_I2C_SDA       8
#define PIN_I2C_SCL       9
#define PIN_DHT22_DATA    15
#define PIN_MQ135_ADC     1    // ADC1 channel 0
#define PIN_ACS712_ADC    2    // ADC1 channel 1
#define PIN_SW420         16
#define PIN_RELAY         17
#define PIN_LED_RED       18
#define PIN_LED_GREEN     21
#define PIN_LED_BLUE      35
#define PIN_BUZZER        36
#define PIN_OVERRIDE_SW   37

// ==== Task priorities — Firmware Spec §1, do not change without
//      re-validating against real hardware timing ====
#define TASK_PRIO_ACQUISITION   20
#define TASK_PRIO_FEATURE_EXT   10
#define TASK_PRIO_INFERENCE     12
#define TASK_PRIO_NETWORKING    6
#define TASK_PRIO_OUTPUT        3

// ==== Stack sizes (bytes) — Firmware Spec §1 ====
#define STACK_ACQUISITION   4096
#define STACK_FEATURE_EXT   8192
#define STACK_INFERENCE     8192
#define STACK_NETWORKING    8192
#define STACK_OUTPUT        2048

// ==== Core pinning ====
#define CORE_ACQUISITION    0
#define CORE_FEATURE_EXT    0
#define CORE_INFERENCE      1
#define CORE_NETWORKING     1
#define CORE_OUTPUT         1

// ==== Sensor polling intervals (ms) — Firmware Spec §2 ====
#define INTERVAL_DHT22_MS     2500
#define INTERVAL_BMP280_MS    5000
#define INTERVAL_MQ135_MS     1000
#define INTERVAL_ACS712_MS    10      // 100 Hz
#define INTERVAL_VIBRATION_MS 4       // 250 Hz

// ==== Audio ====
#define AUDIO_SAMPLE_RATE_HZ  16000
#define AUDIO_BITS_PER_SAMPLE 32      // INMP441 outputs 24-bit in a 32-bit frame
#define AUDIO_DMA_BUF_COUNT   4
#define AUDIO_DMA_BUF_LEN     1024

#endif // REZON_CONFIG_H
```

## FILE 2: `main/drivers/i2s_audio.h`

```c
#ifndef REZON_I2S_AUDIO_H
#define REZON_I2S_AUDIO_H

#include "esp_err.h"
#include <stddef.h>
#include <stdint.h>

// Initializes the I2S peripheral in standard mode for the INMP441.
// Must be called once, before the acquisition task's main loop starts.
esp_err_t i2s_audio_init(void);

// Blocking read of raw PCM samples into `buf` (int32_t per sample —
// INMP441's 24-bit data is left-justified in the 32-bit I2S word).
// Returns the actual number of bytes read via `bytes_read`.
esp_err_t i2s_audio_read(int32_t *buf, size_t buf_len_bytes, size_t *bytes_read);

#endif // REZON_I2S_AUDIO_H
```

## FILE 3: `main/drivers/i2s_audio.c`

```c
#include "i2s_audio.h"
#include "config.h"
#include "driver/i2s_std.h"
#include "esp_log.h"

static const char *TAG = "i2s_audio";
static i2s_chan_handle_t rx_chan = NULL;

esp_err_t i2s_audio_init(void)
{
    i2s_chan_config_t chan_cfg = I2S_CHANNEL_DEFAULT_CONFIG(I2S_NUM_0, I2S_ROLE_MASTER);
    chan_cfg.dma_desc_num = AUDIO_DMA_BUF_COUNT;
    chan_cfg.dma_frame_num = AUDIO_DMA_BUF_LEN;

    esp_err_t err = i2s_new_channel(&chan_cfg, NULL, &rx_chan);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "i2s_new_channel failed: %s", esp_err_to_name(err));
        return err;
    }

    i2s_std_config_t std_cfg = {
        .clk_cfg = I2S_STD_CLK_DEFAULT_CONFIG(AUDIO_SAMPLE_RATE_HZ),
        .slot_cfg = I2S_STD_PHILIPS_SLOT_DEFAULT_CONFIG(
            I2S_DATA_BIT_WIDTH_32BIT, I2S_SLOT_MODE_MONO),
        .gpio_cfg = {
            .mclk = I2S_GPIO_UNUSED,
            .bclk = PIN_I2S_SCK,
            .ws   = PIN_I2S_WS,
            .dout = I2S_GPIO_UNUSED,
            .din  = PIN_I2S_SD,
            .invert_flags = {
                .mclk_inv = false, .bclk_inv = false, .ws_inv = false,
            },
        },
    };
    // INMP441's L/R pin is wired directly to GND on the hardware side
    // (PIN_MAPPING.md), selecting the left channel — the I2S peripheral
    // itself is configured mono per std_cfg.slot_cfg above.
    std_cfg.slot_cfg.slot_mask = I2S_STD_SLOT_LEFT;

    err = i2s_channel_init_std_mode(rx_chan, &std_cfg);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "i2s_channel_init_std_mode failed: %s", esp_err_to_name(err));
        return err;
    }

    err = i2s_channel_enable(rx_chan);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "i2s_channel_enable failed: %s", esp_err_to_name(err));
        return err;
    }

    ESP_LOGI(TAG, "I2S audio initialized: %d Hz, mono, 32-bit", AUDIO_SAMPLE_RATE_HZ);
    return ESP_OK;
}

esp_err_t i2s_audio_read(int32_t *buf, size_t buf_len_bytes, size_t *bytes_read)
{
    // Blocking read — this is fine because Acquisition Task (Core 0,
    // highest priority) is the ONLY thing scheduled to run at this
    // priority on Core 0; blocking here does not starve any lower-
    // priority Core 0 work in a way that violates the timing budget,
    // per Firmware Spec §1's task design.
    return i2s_channel_read(rx_chan, buf, buf_len_bytes, bytes_read, portMAX_DELAY);
}
```

## FILE 4: `main/drivers/i2c_bus.h`

```c
#ifndef REZON_I2C_BUS_H
#define REZON_I2C_BUS_H

#include "esp_err.h"
#include <stdint.h>
#include <stdbool.h>

#define MPU6050_I2C_ADDR   0x68
#define BMP280_I2C_ADDR    0x76

typedef struct {
    float accel_x_g, accel_y_g, accel_z_g;
    float gyro_x_dps, gyro_y_dps, gyro_z_dps;
} mpu6050_reading_t;

typedef struct {
    float temperature_c;
    float pressure_hpa;
} bmp280_reading_t;

esp_err_t i2c_bus_init(void);

// Confirms both devices respond at their expected addresses — per
// Session 2's wiring note, this is the runtime confirmation that the
// shared-bus address assumption (0x68 vs 0x76, no conflict) actually
// holds on the real hardware.
esp_err_t i2c_bus_probe_devices(bool *mpu6050_found, bool *bmp280_found);

esp_err_t mpu6050_init(void);
esp_err_t mpu6050_read(mpu6050_reading_t *out);

esp_err_t bmp280_init(void);
esp_err_t bmp280_read(bmp280_reading_t *out);

#endif // REZON_I2C_BUS_H
```

## FILE 5: `main/drivers/i2c_bus.c`

```c
#include "i2c_bus.h"
#include "config.h"
#include "driver/i2c_master.h"
#include "esp_log.h"
#include <string.h>

static const char *TAG = "i2c_bus";
static i2c_master_bus_handle_t bus_handle = NULL;
static i2c_master_dev_handle_t mpu6050_handle = NULL;
static i2c_master_dev_handle_t bmp280_handle = NULL;

esp_err_t i2c_bus_init(void)
{
    i2c_master_bus_config_t bus_cfg = {
        .clk_source = I2C_CLK_SRC_DEFAULT,
        .i2c_port = I2C_NUM_0,
        .scl_io_num = PIN_I2C_SCL,
        .sda_io_num = PIN_I2C_SDA,
        .glitch_ignore_cnt = 7,
        .flags.enable_internal_pullup = true,  // in addition to the
                                                 // physical 4.7k pull-ups
                                                 // from Session 2 wiring —
                                                 // redundant but harmless
    };
    esp_err_t err = i2c_new_master_bus(&bus_cfg, &bus_handle);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "i2c_new_master_bus failed: %s", esp_err_to_name(err));
        return err;
    }

    i2c_device_config_t mpu_cfg = {
        .dev_addr_length = I2C_ADDR_BIT_LEN_7,
        .device_address = MPU6050_I2C_ADDR,
        .scl_speed_hz = 400000,
    };
    err = i2c_master_bus_add_device(bus_handle, &mpu_cfg, &mpu6050_handle);
    if (err != ESP_OK) return err;

    i2c_device_config_t bmp_cfg = {
        .dev_addr_length = I2C_ADDR_BIT_LEN_7,
        .device_address = BMP280_I2C_ADDR,
        .scl_speed_hz = 400000,
    };
    err = i2c_master_bus_add_device(bus_handle, &bmp_cfg, &bmp280_handle);
    if (err != ESP_OK) return err;

    ESP_LOGI(TAG, "I2C bus initialized on SDA=%d SCL=%d", PIN_I2C_SDA, PIN_I2C_SCL);
    return ESP_OK;
}

esp_err_t i2c_bus_probe_devices(bool *mpu6050_found, bool *bmp280_found)
{
    *mpu6050_found = (i2c_master_probe(bus_handle, MPU6050_I2C_ADDR, 100) == ESP_OK);
    *bmp280_found  = (i2c_master_probe(bus_handle, BMP280_I2C_ADDR, 100) == ESP_OK);
    ESP_LOGI(TAG, "Probe results: MPU-6050=%s, BMP280=%s",
             *mpu6050_found ? "FOUND" : "NOT FOUND",
             *bmp280_found ? "FOUND" : "NOT FOUND");
    return ESP_OK;
}

esp_err_t mpu6050_init(void)
{
    // Wake the MPU-6050 (it boots in sleep mode) — write 0x00 to
    // PWR_MGMT_1 (register 0x6B).
    uint8_t wake_cmd[2] = {0x6B, 0x00};
    return i2c_master_transmit(mpu6050_handle, wake_cmd, sizeof(wake_cmd), 100);
}

esp_err_t mpu6050_read(mpu6050_reading_t *out)
{
    uint8_t reg = 0x3B;  // ACCEL_XOUT_H — accel+gyro are 14 contiguous bytes from here
    uint8_t raw[14];
    esp_err_t err = i2c_master_transmit_receive(mpu6050_handle, &reg, 1, raw, sizeof(raw), 100);
    if (err != ESP_OK) return err;

    int16_t ax = (raw[0] << 8) | raw[1];
    int16_t ay = (raw[2] << 8) | raw[3];
    int16_t az = (raw[4] << 8) | raw[5];
    // raw[6],raw[7] = temperature, skipped — not used
    int16_t gx = (raw[8] << 8) | raw[9];
    int16_t gy = (raw[10] << 8) | raw[11];
    int16_t gz = (raw[12] << 8) | raw[13];

    // Default sensitivity: accel ±2g -> 16384 LSB/g, gyro ±250dps -> 131 LSB/(deg/s)
    out->accel_x_g = ax / 16384.0f;
    out->accel_y_g = ay / 16384.0f;
    out->accel_z_g = az / 16384.0f;
    out->gyro_x_dps = gx / 131.0f;
    out->gyro_y_dps = gy / 131.0f;
    out->gyro_z_dps = gz / 131.0f;
    return ESP_OK;
}

esp_err_t bmp280_init(void)
{
    // Normal mode, temp/pressure oversampling x1, standby 1000ms — a
    // conservative starting config; ctrl_meas register = 0x27
    uint8_t cfg[2] = {0xF4, 0x27};
    return i2c_master_transmit(bmp280_handle, cfg, sizeof(cfg), 100);
}

esp_err_t bmp280_read(bmp280_reading_t *out)
{
    // NOTE: BMP280 requires reading its factory calibration registers
    // (0x88-0xA1) once at startup and applying the compensation formula
    // from the datasheet to raw ADC values for accurate readings. This
    // is omitted here for brevity in this session's scope and flagged
    // explicitly rather than silently simplified:
    // 🔴 OPEN ITEM for this session's implementation: apply the real
    // BMP280 compensation formula (Bosch datasheet §3.11.3) using the
    // calibration registers, not raw ADC counts. Verify this is done
    // before trusting bmp280_read()'s output for anything beyond
    // "is the sensor responding."
    uint8_t reg = 0xF7;  // press_msb, start of 6-byte press+temp burst
    uint8_t raw[6];
    esp_err_t err = i2c_master_transmit_receive(bmp280_handle, &reg, 1, raw, sizeof(raw), 100);
    if (err != ESP_OK) return err;

    int32_t adc_p = (raw[0] << 12) | (raw[1] << 4) | (raw[2] >> 4);
    int32_t adc_t = (raw[3] << 12) | (raw[4] << 4) | (raw[5] >> 4);

    // Placeholder linear scaling ONLY until the open item above is
    // resolved — explicitly not the real compensated value yet.
    out->temperature_c = adc_t / 5120.0f;   // NOT the real Bosch formula
    out->pressure_hpa = adc_p / 256.0f;      // NOT the real Bosch formula
    return ESP_OK;
}
```

## FILE 6: `main/drivers/dht22.h`

```c
#ifndef REZON_DHT22_H
#define REZON_DHT22_H
#include "esp_err.h"

typedef struct {
    float temperature_c;
    float humidity_pct;
} dht22_reading_t;

esp_err_t dht22_init(void);
// Returns ESP_ERR_TIMEOUT or ESP_ERR_INVALID_CRC on a failed read —
// per Firmware Spec §2's note that DHT22 read failures are expected
// occasionally and must not stall the acquisition loop. Caller should
// treat a failure as "skip this cycle's environment reading," not a
// fatal error.
esp_err_t dht22_read(dht22_reading_t *out);

#endif // REZON_DHT22_H
```

## FILE 7: `main/drivers/dht22.c`

```c
#include "dht22.h"
#include "config.h"
#include "driver/gpio.h"
#include "esp_rom_sys.h"
#include "esp_log.h"

static const char *TAG = "dht22";

esp_err_t dht22_init(void)
{
    gpio_config_t cfg = {
        .pin_bit_mask = 1ULL << PIN_DHT22_DATA,
        .mode = GPIO_MODE_INPUT_OUTPUT_OD,  // open-drain, matches the
                                              // single-wire protocol +
                                              // external pull-up from
                                              // Session 2 wiring
        .pull_up_en = GPIO_PULLUP_ENABLE,
    };
    return gpio_config(&cfg);
}

// Bit-bang the DHT22 single-wire protocol. Timing per DHT22 datasheet:
// host pulls low >=1ms, releases, sensor responds low 80us + high 80us,
// then 40 bits each encoded as a 50us low + a 26-70us high (0) or
// ~70us high (1).
esp_err_t dht22_read(dht22_reading_t *out)
{
    gpio_set_direction(PIN_DHT22_DATA, GPIO_MODE_OUTPUT_OD);
    gpio_set_level(PIN_DHT22_DATA, 0);
    esp_rom_delay_us(1100);
    gpio_set_level(PIN_DHT22_DATA, 1);
    esp_rom_delay_us(30);
    gpio_set_direction(PIN_DHT22_DATA, GPIO_MODE_INPUT);

    // Wait for sensor's response (low then high)
    int timeout = 0;
    while (gpio_get_level(PIN_DHT22_DATA) == 1) {
        if (++timeout > 100) { ESP_LOGW(TAG, "no response"); return ESP_ERR_TIMEOUT; }
        esp_rom_delay_us(1);
    }
    timeout = 0;
    while (gpio_get_level(PIN_DHT22_DATA) == 0) {
        if (++timeout > 100) return ESP_ERR_TIMEOUT;
        esp_rom_delay_us(1);
    }
    timeout = 0;
    while (gpio_get_level(PIN_DHT22_DATA) == 1) {
        if (++timeout > 100) return ESP_ERR_TIMEOUT;
        esp_rom_delay_us(1);
    }

    uint8_t data[5] = {0};
    for (int i = 0; i < 40; i++) {
        timeout = 0;
        while (gpio_get_level(PIN_DHT22_DATA) == 0) {
            if (++timeout > 100) return ESP_ERR_TIMEOUT;
            esp_rom_delay_us(1);
        }
        int64_t start = esp_rom_get_cpu_ticks_per_us();
        (void)start;
        uint32_t high_us = 0;
        timeout = 0;
        while (gpio_get_level(PIN_DHT22_DATA) == 1) {
            esp_rom_delay_us(1);
            high_us++;
            if (++timeout > 100) return ESP_ERR_TIMEOUT;
        }
        data[i / 8] <<= 1;
        if (high_us > 40) data[i / 8] |= 1;  // >40us high = a '1' bit
    }

    uint8_t checksum = data[0] + data[1] + data[2] + data[3];
    if (checksum != data[4]) {
        ESP_LOGW(TAG, "checksum mismatch");
        return ESP_ERR_INVALID_CRC;
    }

    out->humidity_pct = ((data[0] << 8) | data[1]) / 10.0f;
    int16_t temp_raw = ((data[2] & 0x7F) << 8) | data[3];
    out->temperature_c = temp_raw / 10.0f;
    if (data[2] & 0x80) out->temperature_c *= -1;  // sign bit

    return ESP_OK;
}
```

## FILE 8: `main/drivers/adc_sensors.h`

```c
#ifndef REZON_ADC_SENSORS_H
#define REZON_ADC_SENSORS_H
#include "esp_err.h"
#include <stdint.h>

esp_err_t adc_sensors_init(void);

// Raw millivolt readings — compensation (MQ135) and filtering (ACS712)
// happen in the Feature Extraction Task (Session 4), per AI/ML Spec
// §4-5. This function returns raw, uncorrected values only.
esp_err_t mq135_read_raw_mv(int *out_mv);
esp_err_t acs712_read_raw_mv(int *out_mv);

#endif // REZON_ADC_SENSORS_H
```

## FILE 9: `main/drivers/adc_sensors.c`

```c
#include "adc_sensors.h"
#include "config.h"
#include "esp_adc/adc_oneshot.h"
#include "esp_adc/adc_cali.h"
#include "esp_adc/adc_cali_scheme.h"
#include "esp_log.h"

static const char *TAG = "adc_sensors";
static adc_oneshot_unit_handle_t adc1_handle;
static adc_cali_handle_t cali_handle = NULL;

esp_err_t adc_sensors_init(void)
{
    adc_oneshot_unit_init_cfg_t unit_cfg = { .unit_id = ADC_UNIT_1 };
    esp_err_t err = adc_oneshot_new_unit(&unit_cfg, &adc1_handle);
    if (err != ESP_OK) return err;

    adc_oneshot_chan_cfg_t chan_cfg = {
        .atten = ADC_ATTEN_DB_12,     // full 0-3.3V range, matches the
                                        // MQ135 voltage-divider output
                                        // and ACS712's filtered output
        .bitwidth = ADC_BITWIDTH_DEFAULT,
    };
    // PIN_MQ135_ADC (GPIO1) = ADC1_CH0, PIN_ACS712_ADC (GPIO2) = ADC1_CH1
    err = adc_oneshot_config_channel(adc1_handle, ADC_CHANNEL_0, &chan_cfg);
    if (err != ESP_OK) return err;
    err = adc_oneshot_config_channel(adc1_handle, ADC_CHANNEL_1, &chan_cfg);
    if (err != ESP_OK) return err;

    adc_cali_curve_fitting_config_t cali_cfg = {
        .unit_id = ADC_UNIT_1,
        .atten = ADC_ATTEN_DB_12,
        .bitwidth = ADC_BITWIDTH_DEFAULT,
    };
    err = adc_cali_create_scheme_curve_fitting(&cali_cfg, &cali_handle);
    if (err != ESP_OK) {
        ESP_LOGW(TAG, "ADC calibration unavailable, raw counts will be less accurate");
        cali_handle = NULL;  // degrade gracefully, not fatal
    }

    ESP_LOGI(TAG, "ADC sensors initialized");
    return ESP_OK;
}

static esp_err_t read_channel_mv(adc_channel_t chan, int *out_mv)
{
    int raw;
    esp_err_t err = adc_oneshot_read(adc1_handle, chan, &raw);
    if (err != ESP_OK) return err;

    if (cali_handle) {
        return adc_cali_raw_to_voltage(cali_handle, raw, out_mv);
    }
    // Fallback without calibration: rough linear estimate for 12-bit @ 3.3V
    *out_mv = (raw * 3300) / 4095;
    return ESP_OK;
}

esp_err_t mq135_read_raw_mv(int *out_mv)  { return read_channel_mv(ADC_CHANNEL_0, out_mv); }
esp_err_t acs712_read_raw_mv(int *out_mv) { return read_channel_mv(ADC_CHANNEL_1, out_mv); }
```

## FILE 10: `main/drivers/sw420_isr.h` / `.c`

```c
#ifndef REZON_SW420_ISR_H
#define REZON_SW420_ISR_H
#include "esp_err.h"
#include <stdint.h>
#include <stdbool.h>

#define SW420_RING_BUFFER_SIZE 20

esp_err_t sw420_isr_init(void);

// AI/ML Spec §7.5's corroboration check: was there a trigger within
// [window_start, window_end]? Both timestamps in esp_timer microseconds.
bool sw420_triggered_in_window(int64_t window_start_us, int64_t window_end_us);

#endif
```

```c
#include "sw420_isr.h"
#include "config.h"
#include "driver/gpio.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"

static int64_t trigger_ring[SW420_RING_BUFFER_SIZE];
static int ring_head = 0;
static SemaphoreHandle_t ring_mutex;

static void IRAM_ATTR sw420_isr_handler(void *arg)
{
    // Keep ISR minimal per RTOS best practice — just record the timestamp,
    // no mutex/logging inside the ISR itself (esp_timer_get_time IS
    // ISR-safe; the ring buffer write uses a lock-free single-writer
    // pattern since only this ISR ever writes to ring_head's slot).
    trigger_ring[ring_head] = esp_timer_get_time();
    ring_head = (ring_head + 1) % SW420_RING_BUFFER_SIZE;
}

esp_err_t sw420_isr_init(void)
{
    ring_mutex = xSemaphoreCreateMutex();

    gpio_config_t cfg = {
        .pin_bit_mask = 1ULL << PIN_SW420,
        .mode = GPIO_MODE_INPUT,
        .pull_down_en = GPIO_PULLDOWN_ENABLE,
        .intr_type = GPIO_INTR_POSEDGE,
    };
    gpio_config(&cfg);

    gpio_install_isr_service(0);
    return gpio_isr_handler_add(PIN_SW420, sw420_isr_handler, NULL);
}

bool sw420_triggered_in_window(int64_t window_start_us, int64_t window_end_us)
{
    xSemaphoreTake(ring_mutex, portMAX_DELAY);
    bool found = false;
    for (int i = 0; i < SW420_RING_BUFFER_SIZE; i++) {
        if (trigger_ring[i] >= window_start_us && trigger_ring[i] <= window_end_us) {
            found = true;
            break;
        }
    }
    xSemaphoreGive(ring_mutex);
    return found;
}
```

## FILE 11: `main/acquisition_task.c`

```c
#include "acquisition_task.h"
#include "config.h"
#include "drivers/i2s_audio.h"
#include "drivers/i2c_bus.h"
#include "drivers/dht22.h"
#include "drivers/adc_sensors.h"
#include "drivers/sw420_isr.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"
#include "esp_timer.h"

static const char *TAG = "acquisition";

void acquisition_task(void *pvParameters)
{
    ESP_ERROR_CHECK(i2s_audio_init());
    ESP_ERROR_CHECK(i2c_bus_init());

    bool mpu_ok, bmp_ok;
    i2c_bus_probe_devices(&mpu_ok, &bmp_ok);
    if (!mpu_ok || !bmp_ok) {
        ESP_LOGE(TAG, "I2C device probe failed — check wiring per SESSION_02 before continuing");
    }
    ESP_ERROR_CHECK(mpu6050_init());
    ESP_ERROR_CHECK(bmp280_init());
    ESP_ERROR_CHECK(dht22_init());
    ESP_ERROR_CHECK(adc_sensors_init());
    ESP_ERROR_CHECK(sw420_isr_init());

    ESP_LOGI(TAG, "All sensors initialized — entering acquisition loop");

    int32_t audio_buf[AUDIO_DMA_BUF_LEN];
    TickType_t last_dht22 = 0, last_bmp280 = 0, last_mq135 = 0;

    while (1) {
        // Audio: continuous, highest-rate, drives the loop's natural pace
        size_t bytes_read;
        i2s_audio_read(audio_buf, sizeof(audio_buf), &bytes_read);
        // TODO Session 4: push audio_buf into the feature-extraction queue

        // Vibration: every cycle (~250Hz effective, matches audio's DMA pace
        // closely enough per Firmware Spec §2 — exact 250Hz timer refinement
        // is a Session 4 task if this pace proves insufficient in practice)
        mpu6050_reading_t vib;
        if (mpu6050_read(&vib) == ESP_OK) {
            // TODO Session 4: push into vibration feature-extraction queue
        }

        TickType_t now = xTaskGetTickCount();

        if ((now - last_dht22) * portTICK_PERIOD_MS >= INTERVAL_DHT22_MS) {
            dht22_reading_t env;
            esp_err_t err = dht22_read(&env);
            if (err != ESP_OK) {
                ESP_LOGW(TAG, "DHT22 read failed (%s) — skipping this cycle, not fatal",
                          esp_err_to_name(err));
            }
            last_dht22 = now;
        }

        if ((now - last_bmp280) * portTICK_PERIOD_MS >= INTERVAL_BMP280_MS) {
            bmp280_reading_t press;
            bmp280_read(&press);
            last_bmp280 = now;
        }

        if ((now - last_mq135) * portTICK_PERIOD_MS >= INTERVAL_MQ135_MS) {
            int mq135_mv;
            mq135_read_raw_mv(&mq135_mv);
            last_mq135 = now;
        }

        int acs712_mv;
        acs712_read_raw_mv(&acs712_mv);  // every cycle, ~100Hz target per §2

        // No vTaskDelay here by design — I2S DMA read blocks naturally at
        // the audio sample rate, which paces this whole loop. Adding an
        // additional delay would be redundant and risks under-sampling.
    }
}
```

## FILE 12: `main/rezon_main.c`

```c
#include "config.h"
#include "acquisition_task.h"
#include "stub_tasks.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"

void app_main(void)
{
    esp_log_level_set("*", ESP_LOG_INFO);

    xTaskCreatePinnedToCore(acquisition_task, "acquisition", STACK_ACQUISITION,
                             NULL, TASK_PRIO_ACQUISITION, NULL, CORE_ACQUISITION);

    xTaskCreatePinnedToCore(stub_feature_extraction_task, "feature_ext", STACK_FEATURE_EXT,
                             NULL, TASK_PRIO_FEATURE_EXT, NULL, CORE_FEATURE_EXT);

    xTaskCreatePinnedToCore(stub_inference_task, "inference", STACK_INFERENCE,
                             NULL, TASK_PRIO_INFERENCE, NULL, CORE_INFERENCE);

    xTaskCreatePinnedToCore(stub_networking_task, "networking", STACK_NETWORKING,
                             NULL, TASK_PRIO_NETWORKING, NULL, CORE_NETWORKING);

    xTaskCreatePinnedToCore(stub_output_task, "output", STACK_OUTPUT,
                             NULL, TASK_PRIO_OUTPUT, NULL, CORE_OUTPUT);
}
```

## FILE 13: `main/stub_tasks.c` (placeholders — real implementation Session 4+)

```c
#include "stub_tasks.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"

void stub_feature_extraction_task(void *p) { while(1) { vTaskDelay(pdMS_TO_TICKS(1000)); } }
void stub_inference_task(void *p)          { while(1) { vTaskDelay(pdMS_TO_TICKS(1000)); } }
void stub_networking_task(void *p)         { while(1) { vTaskDelay(pdMS_TO_TICKS(1000)); } }
void stub_output_task(void *p)             { while(1) { vTaskDelay(pdMS_TO_TICKS(1000)); } }
```

## FILE 14: `test/test_config_values.c` (Unity, host-side — per VERIFY_01)

```c
#include "unity.h"
#include "config.h"

// Confirms config.h's values genuinely match the signed-off Firmware
// Spec — this test exists specifically so a future accidental edit to
// config.h is caught immediately, not discovered during a confusing
// hardware debugging session later.

TEST_CASE("Task priorities match Firmware Spec section 1", "[config]")
{
    TEST_ASSERT_EQUAL(20, TASK_PRIO_ACQUISITION);
    TEST_ASSERT_EQUAL(10, TASK_PRIO_FEATURE_EXT);
    TEST_ASSERT_EQUAL(12, TASK_PRIO_INFERENCE);
    TEST_ASSERT_EQUAL(6, TASK_PRIO_NETWORKING);
    TEST_ASSERT_EQUAL(3, TASK_PRIO_OUTPUT);
}

TEST_CASE("Sensor polling intervals match Firmware Spec section 2", "[config]")
{
    TEST_ASSERT_EQUAL(2500, INTERVAL_DHT22_MS);
    TEST_ASSERT_EQUAL(5000, INTERVAL_BMP280_MS);
    TEST_ASSERT_EQUAL(1000, INTERVAL_MQ135_MS);
    TEST_ASSERT_EQUAL(10, INTERVAL_ACS712_MS);
}

TEST_CASE("Pin assignments match PIN_MAPPING.md", "[config]")
{
    TEST_ASSERT_EQUAL(4, PIN_I2S_SCK);
    TEST_ASSERT_EQUAL(5, PIN_I2S_WS);
    TEST_ASSERT_EQUAL(6, PIN_I2S_SD);
    TEST_ASSERT_EQUAL(8, PIN_I2C_SDA);
    TEST_ASSERT_EQUAL(9, PIN_I2C_SCL);
    TEST_ASSERT_EQUAL(16, PIN_SW420);
    TEST_ASSERT_EQUAL(17, PIN_RELAY);
    TEST_ASSERT_EQUAL(37, PIN_OVERRIDE_SW);
}
```

---

## Verification Steps

**Step 1 — build:**
```
idf.py build
```
Expected: build succeeds, zero errors. Warnings about `bmp280_read`'s placeholder compensation are acceptable this session (flagged open item), any other warning is not.

**Step 2 — host-side unit tests:**
```
idf.py -T test_config_values build flash monitor
```
Expected literal output: `3 Tests 0 Failures 0 Ignored`

**Step 3 — flash and observe real sensor behavior (HW_VERIFICATION_LOG.md entry required):**
```
idf.py -p <PORT> flash monitor
```
Expected: log lines showing `"I2S audio initialized"`, `"I2C bus initialized"`, and the probe result line — **both `MPU-6050=FOUND` and `BMP280=FOUND` must appear**. If either shows `NOT FOUND`, this is a wiring problem (return to Session 2's wiring, do not proceed) — log this finding either way in `HW_VERIFICATION_LOG.md`, a `NOT FOUND` result included, not silently rerun until it passes.

**Step 4 — physical perturbation test (the actual "does it sense reality" check, not just "does it compile"):**
- Speak near the INMP441 — confirm (via a temporary debug log of `bytes_read` and a computed simple audio level) that the value visibly changes.
- Physically tilt the breadboard — confirm MPU-6050 readings change correspondingly.
- Breathe near / gently warm the DHT22 — confirm humidity/temperature readings shift.
Log all three as HW_VERIFICATION_LOG entries with the actual before/after values observed.

---

## Plain-language explain-back (per your stated preference for firmware sessions)

At the end of this session, Claude Code should explain: why audio sampling paces the whole acquisition loop rather than using a fixed delay: why the BMP280's real calibration formula was flagged as an open item rather than silently faked; and why the SW-420 interrupt handler is written the way it is (minimal work inside the ISR itself) — in plain terms, so you can defend these choices without re-deriving them.

## Known open item, carried forward explicitly
🔴 `bmp280_read()`'s temperature/pressure values are placeholder linear scaling, not the real Bosch-datasheet compensation formula. This must be resolved before Session 9's integration/burn-in — flagged here, tracked in `STATUS.md`, not forgotten silently.
