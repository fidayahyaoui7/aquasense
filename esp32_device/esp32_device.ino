#include "esp_camera.h"
#include <WiFi.h>
#include "ping/ping_sock.h"

// ================= WIFI (EDIT THESE) =================
// Copy config_wifi.example.h to config_wifi.h and fill in your credentials
// DO NOT commit config_wifi.h to git!
#include "config_wifi.h"

// ================= DEVICE ID (IMPORTANT) =================
const char* DEVICE_ID = "ESP32-AQUASENSE-01";  
// ================= SYSTEM =================
unsigned long captureInterval = 60000;
unsigned long lastCapture     = 0;

// ================= CAMERA PINS =================
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

// ================= CAMERA INIT =================
void startCamera() {
    camera_config_t config;
    config.ledc_channel = LEDC_CHANNEL_0;
    config.ledc_timer   = LEDC_TIMER_0;
    config.pin_d0  = Y2_GPIO_NUM;
    config.pin_d1  = Y3_GPIO_NUM;
    config.pin_d2  = Y4_GPIO_NUM;
    config.pin_d3  = Y5_GPIO_NUM;
    config.pin_d4  = Y6_GPIO_NUM;
    config.pin_d5  = Y7_GPIO_NUM;
    config.pin_d6  = Y8_GPIO_NUM;
    config.pin_d7  = Y9_GPIO_NUM;
    config.pin_xclk     = XCLK_GPIO_NUM;
    config.pin_pclk     = PCLK_GPIO_NUM;
    config.pin_vsync    = VSYNC_GPIO_NUM;
    config.pin_href     = HREF_GPIO_NUM;
    config.pin_sccb_sda = SIOD_GPIO_NUM;
    config.pin_sccb_scl = SIOC_GPIO_NUM;
    config.pin_pwdn     = PWDN_GPIO_NUM;
    config.pin_reset    = RESET_GPIO_NUM;
    config.xclk_freq_hz = 20000000;
    config.pixel_format = PIXFORMAT_JPEG;
    config.frame_size   = FRAMESIZE_VGA;
    config.jpeg_quality = 10;
    config.fb_count     = 1;

    esp_err_t err = esp_camera_init(&config);
    if (err != ESP_OK) {
        Serial.printf("❌ Camera init failed: 0x%x\n", err);
        return;
    }
    Serial.println("✅ Camera ready");
}

// ================= WIFI =================
void connectWiFi() {
    WiFi.mode(WIFI_STA);
    WiFi.setSleep(false);
    WiFi.begin(ssid, password);
    Serial.print("🔌 Connecting WiFi");
    int retry = 0;
    while (WiFi.status() != WL_CONNECTED && retry < 40) {
        delay(500);
        Serial.print(".");
        retry++;
    }
    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\n✅ WiFi connected");
        Serial.println(WiFi.localIP());
    } else {
        Serial.println("\n❌ WiFi FAILED");
    }
}

// ================= PING TEST =================
void pingTest() {
    Serial.println("🏓 Ping test vers 192.168.1.68...");
    esp_ping_config_t config = ESP_PING_DEFAULT_CONFIG();
    ip_addr_t target;
    ipaddr_aton("192.168.1.68", &target);
    config.target_addr = target;
    config.count = 4;

    esp_ping_callbacks_t cbs;
    cbs.on_ping_success = [](esp_ping_handle_t hdl, void* args) {
        uint32_t elapsed;
        esp_ping_get_profile(hdl, ESP_PING_PROF_TIMEGAP, &elapsed, sizeof(elapsed));
        Serial.printf("✅ Ping OK: %d ms\n", elapsed);
    };
    cbs.on_ping_timeout = [](esp_ping_handle_t hdl, void* args) {
        Serial.println("⏱️ Ping TIMEOUT");
    };
    cbs.on_ping_end = [](esp_ping_handle_t hdl, void* args) {
        uint32_t sent, received;
        esp_ping_get_profile(hdl, ESP_PING_PROF_REQUEST, &sent, sizeof(sent));
        esp_ping_get_profile(hdl, ESP_PING_PROF_REPLY, &received, sizeof(received));
        Serial.printf("📊 Ping terminé: %d/%d reçus\n", received, sent);
        esp_ping_delete_session(hdl);
    };
    cbs.cb_args = nullptr;

    esp_ping_handle_t ping;
    esp_ping_new_session(&config, &cbs, &ping);
    esp_ping_start(ping);
    delay(5000);
}

// ================= PING SIMPLE =================
bool testBackend() {
    WiFiClient testClient;
    testClient.setTimeout(10000);
    Serial.printf("🔍 Test connexion → %s:%d\n", SERVER_HOST, SERVER_PORT);
    if (testClient.connect(SERVER_HOST, SERVER_PORT)) {
        Serial.println("✅ Backend joignable !");
        Serial.println("📤 Envoi requête test...");
        testClient.println("GET / HTTP/1.1");
        testClient.println("Host: " + String(SERVER_HOST));
        testClient.println("Connection: close");
        testClient.println();
        
        delay(1000);
        while (testClient.available()) {
            String line = testClient.readStringUntil('\n');
            Serial.println("📥 " + line);
        }
        testClient.stop();
        return true;
    }
    Serial.println("❌ Backend NON joignable !");
    Serial.printf("WiFi status: %d\n", WiFi.status());
    return false;
}

// ================= SEND PHOTO =================
void sendPhoto(camera_fb_t* fb) {
    WiFiClient client;
    client.setTimeout(10000);
    delay(1000);

    int attempts = 0;
    bool connected = false;
    while (attempts < 3) {
        Serial.printf("⚠️ Tentative %d/3...\n", attempts + 1);
        if (client.connect(SERVER_HOST, SERVER_PORT)) {
            connected = true;
            Serial.println("✅ Connecté au backend");
            break;
        }
        attempts++;
        delay(3000);
    }

    if (!connected) {
        Serial.println("❌ Connection to backend failed après 3 tentatives");
        return;
    }

    String path = String("/readings/esp32/device/") + DEVICE_ID;
    client.println("POST " + path + " HTTP/1.1");
    client.println(String("Host: ") + SERVER_HOST + ":" + SERVER_PORT);
    client.println("Content-Type: image/jpeg");
    client.println("Content-Length: " + String(fb->len));
    client.println("Connection: close");
    client.println();

    const size_t chunkSize = 1024;
    size_t sent = 0;
    while (sent < fb->len) {
        size_t toSend = min(chunkSize, fb->len - sent);
        client.write(fb->buf + sent, toSend);
        sent += toSend;
    }

    Serial.println("📡 Image envoyée, attente réponse...");
    unsigned long timeout = millis();
    while (client.connected() && millis() - timeout < 10000) {
        while (client.available()) {
            String line = client.readStringUntil('\n');
            Serial.println(line);
            timeout = millis();
        }
    }

    client.stop();
    delay(500);
    Serial.println("✅ Upload terminé");
    Serial.printf("🧠 Free heap: %d bytes\n", ESP.getFreeHeap());
}

// ================= CAPTURE =================
void captureAndSend() {
    Serial.println("📸 Capturing...");
    camera_fb_t* fb = esp_camera_fb_get();
    if (!fb) {
        Serial.println("❌ Capture failed");
        return;
    }
    sendPhoto(fb);
    esp_camera_fb_return(fb);
}

// ================= WIFI CHECK =================
void checkWiFi() {
    if (WiFi.status() == WL_CONNECTED) return;
    if (WiFi.status() == WL_IDLE_STATUS || WiFi.status() == WL_DISCONNECTED) {
        Serial.println("⚠️ WiFi lost, reconnecting...");
        connectWiFi();
    }
}

// ================= SETUP =================
void setup() {
    Serial.begin(115200);
    connectWiFi();
    delay(8000);
    startCamera();
    Serial.println("🚀 System ready");
    Serial.printf("📟 Device ID: %s\n", DEVICE_ID);

    // ✅ Ping d'abord
    pingTest();

    // ✅ Puis test TCP
    if (testBackend()) {
        captureAndSend();
    } else {
        Serial.println("⏭️ Envoi ignoré, backend non joignable");
    }
}

// ================= LOOP =================
void loop() {
    checkWiFi();
    unsigned long now = millis();
   if (now - lastCapture >= captureInterval) {
    lastCapture = now;
    delay(3000);  // ← laisse le backend finir le traitement précédent
    if (testBackend()) {
        captureAndSend();
    }
}
    delay(1000);
}