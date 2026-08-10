/**
 * ProjetoAmbiencia.ino — Firmware revisado
 *
 * SIMULADOR DE AMBIÊNCIA EQUINA — UFR/ICAT
 * Curso de Engenharia Agrícola e Ambiental
 * Autores: Efraim Almeida Fernandes · Hallison Bittencourt Santos · Geovana Bertoldo de Souza Alves
 * Orientador: Prof. Jofran Luiz de Oliveira
 *
 * Protocolo compacto bidirecional:
 *   RX: ENV T:28.4 H:65.2 AIR:13 RAD:420 FAN1:0 FAN2:1
 *   TX: ACK FAN1:1 FAN2:1 MIST:0 ALERT:1 FAULT:0
 *
 * Loop não-bloqueante com millis(). Lógica evaluateControl() espelhada
 * no TypeScript (src/automation/control-logic.ts).
 */

#include "DHT.h"

#define DHTPIN 2
#define RELAY_FAN1 3
#define RELAY_FAN2 4
#define RELAY_MIST 5
#define DHTTYPE DHT11

DHT dht(DHTPIN, DHTTYPE);

const float TEMP_MAXIMA = 28.0;
const float TEMP_MINIMA = 25.0;
const float RH_MAX_LIMIT = 80.0;

const unsigned long READ_INTERVAL_MS = 2000;
const int SERIAL_BUF_SIZE = 80;

unsigned long lastReadMs = 0;

float temperatura = 25.0;
float umidade = 60.0;
bool fan1On = false;
bool fan2On = false;
bool mistOn = false;
bool sensorFault = false;

char serialBuf[SERIAL_BUF_SIZE];
uint8_t serialIdx = 0;

struct ActuatorState {
  bool fan_1;
  bool fan_2;
  bool mist_pump;
};

ActuatorState evaluateControl(float t_int, float rh_int, const ActuatorState& prev) {
  ActuatorState cmd = prev;

  if (t_int >= TEMP_MAXIMA) {
    cmd.fan_1 = true;
    cmd.fan_2 = true;
  } else if (t_int <= TEMP_MINIMA) {
    cmd.fan_1 = false;
    cmd.fan_2 = false;
  }

  cmd.mist_pump = (t_int >= TEMP_MAXIMA + 2.0f) && (rh_int < RH_MAX_LIMIT);

  return cmd;
}

void applyRelays(bool f1, bool f2, bool mist) {
  digitalWrite(RELAY_FAN1, f1 ? LOW : HIGH);
  digitalWrite(RELAY_FAN2, f2 ? LOW : HIGH);
  digitalWrite(RELAY_MIST, mist ? LOW : HIGH);
  fan1On = f1;
  fan2On = f2;
  mistOn = mist;
}

void sendAck(bool alert) {
  Serial.print("ACK FAN1:");
  Serial.print(fan1On ? 1 : 0);
  Serial.print(" FAN2:");
  Serial.print(fan2On ? 1 : 0);
  Serial.print(" MIST:");
  Serial.print(mistOn ? 1 : 0);
  Serial.print(" ALERT:");
  Serial.print(alert ? 1 : 0);
  Serial.print(" FAULT:");
  Serial.println(sensorFault ? 1 : 0);
}

bool parseEnvLine(const char* line, float* t, float* h) {
  if (strncmp(line, "ENV", 3) != 0) return false;

  float parsedT = -1;
  float parsedH = -1;

  const char* tp = strstr(line, "T:");
  const char* hp = strstr(line, "H:");

  if (tp) parsedT = atof(tp + 2);
  if (hp) parsedH = atof(hp + 2);

  if (parsedT < 0 || parsedH < 0) return false;

  *t = parsedT;
  *h = parsedH;
  return true;
}

void processSerialLine() {
  serialBuf[serialIdx] = '\0';

  float envT = 0;
  float envH = 0;

  if (parseEnvLine(serialBuf, &envT, &envH)) {
    temperatura = envT;
    umidade = envH;
    sensorFault = false;

    ActuatorState prev = { fan1On, fan2On, mistOn };
    ActuatorState cmd = evaluateControl(temperatura, umidade, prev);
    applyRelays(cmd.fan_1, cmd.fan_2, cmd.mist_pump);

    bool alert = temperatura >= TEMP_MAXIMA;
    sendAck(alert);
    return;
  }

  serialIdx = 0;
}

void pollSerial() {
  while (Serial.available() > 0) {
    char c = Serial.read();

    if (c == '\n' || c == '\r') {
      if (serialIdx > 0) {
        processSerialLine();
        serialIdx = 0;
      }
      continue;
    }

    if (serialIdx < SERIAL_BUF_SIZE - 1) {
      serialBuf[serialIdx++] = c;
    }
  }
}

void readDHTAndControl() {
  float novaUmidade = dht.readHumidity();
  float novaTemperatura = dht.readTemperature();

  if (isnan(novaUmidade) || isnan(novaTemperatura)) {
    sensorFault = true;
    sendAck(false);
    return;
  }

  temperatura = novaTemperatura;
  umidade = novaUmidade;
  sensorFault = false;

  ActuatorState prev = { fan1On, fan2On, mistOn };
  ActuatorState cmd = evaluateControl(temperatura, umidade, prev);
  applyRelays(cmd.fan_1, cmd.fan_2, cmd.mist_pump);

  bool alert = temperatura >= TEMP_MAXIMA;
  sendAck(alert);
}

void setup() {
  Serial.begin(9600);

  pinMode(RELAY_FAN1, OUTPUT);
  pinMode(RELAY_FAN2, OUTPUT);
  pinMode(RELAY_MIST, OUTPUT);

  applyRelays(false, false, false);
  dht.begin();

  serialIdx = 0;
  lastReadMs = millis();
}

void loop() {
  unsigned long now = millis();

  pollSerial();

  if (now - lastReadMs >= READ_INTERVAL_MS) {
    lastReadMs = now;
    readDHTAndControl();
  }
}
