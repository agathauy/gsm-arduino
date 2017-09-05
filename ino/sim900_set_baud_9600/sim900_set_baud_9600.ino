#include <SoftwareSerial.h>
#include <String.h>

#define CMD_SIZE 240
char buffer[CMD_SIZE]; // buffer array for data received from Serial port
char gprs_buffer[CMD_SIZE];


SoftwareSerial GPRS(7, 8);

void setup() {
  // put your setup code here, to run once:
    GPRS.begin(19200);               // the GPRS baud rate
    Serial.begin(19200);    // the GPRS baud rate
    while (!GPRS) {};
    while (!Serial) {};
    delay(3000);
    GPRS.print("AT+CMGF=1\r\n");
    delay(100);
    GPRS.print("AT\r\n");
    delay(100);
    GPRS.print("AT+IPR=9600\r\n");
    delay(100);
}

void loop() {

   // Read and write to serial everything from GPRS
  if (GPRS.available()) {
    Serial.print("in grps available \r\n");
    int g_size = GPRS.readBytes(gprs_buffer, CMD_SIZE);
    gprs_buffer[g_size] = '\0';
    Serial.print(gprs_buffer);
    delay(100);
    //Serial.write(GPRS.read());
  }

}
