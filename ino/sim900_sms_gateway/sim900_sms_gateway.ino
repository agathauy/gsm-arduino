#include <SoftwareSerial.h>
#include <String.h>

#define CMD_SIZE 240
#define NUM_CMDS 10

const char *list_cmds[NUM_CMDS]= {
  "HANGUP_CALL",
  "CHECK_SIGNAL",
  "DELETE_MSG",
  "READ_MSG",
  "SEND_MSG",
  "NOTIF_INQUIRE",
  "NOTIF_SET_STORE",
  "NOTIF_SET_INSTANT",
  "CHECK_AT",
  "SET_TEXT_MODE"
};

SoftwareSerial GPRS(7, 8);

int DEBUG = true;

void setup()
{
    //GPRS.begin(19200); // the GPRS baud rate
    //delay(3000);
    //setBaud9600();
    GPRS.begin(9600);
    Serial.begin(9600); // the Serial baud rate
    while (!GPRS) {};
    while (!Serial) {};
    delay(3000);
    setTextMode();
    notifSetInstant();
}

void loop()
{
  char str[CMD_SIZE]; // buffer array for data received from Serial port
  int buffer_count = 0; // counter for buffer array
  char cmd[20];
  char * ptr;
  char * ptr2;
  char mobile_num[20];
  char * sms_msg;
  int selected_cmd = 99;
  // If there's data from serialport
  if (Serial.available()) {
    int size = Serial.readBytes(str, CMD_SIZE);
    str[size] = '\0';
    ptr = strstr(str,"CMD_");
    if ((ptr != NULL) && (ptr-str == 0)) { 
      ptr2 = strchr(str, ':');
      if (ptr2 != NULL) {
        strncpy(cmd, (ptr+4), ptr2 - (ptr+4));
        cmd[ptr2-(ptr+4)] = '\0';    
        for (int i = 0; i < NUM_CMDS; i++) {
          if (strcmp(cmd, list_cmds[i]) == 0) {
            selected_cmd = i;
            break;
          }
        }
      }
      switch (selected_cmd) {
        case 0: // HANGUP_CALL
          if (DEBUG) Serial.print("[SIM900]: Hangup call\r\n");
          hangupCall();
          break;

        case 1: // CHECK_SIGNAL
          if (DEBUG) Serial.print("[SIM900]: check signal\r\n");
          checkSignal();
          break;

        case 2: // DELETE_MSG: CMD_DELETE_MSG:1
          if (DEBUG) Serial.print("[SIM900]: delete msg\r\n");
          deleteMessage(ptr2+1);
          break;

        case 3: // READ_MSG: CMD_READ_MSG:1
          if (DEBUG) Serial.print("[SIM900]: read msg\r\n");
          readMessage(ptr2+1);
          break;
          
        case 4: // SEND_MSG: CMD_SEND_MSG:+639776224038:The message is this lalaala
          if (DEBUG) Serial.print("[SIM900]: send msg\r\n");
          ptr = strchr((ptr2+1), ':'); // get end of phone number
          strncpy(mobile_num, (ptr2+1), ptr - (ptr2+1));
          mobile_num[ptr - (ptr2+1)] = '\0';
          sms_msg = (ptr+1);
          sendMessage(mobile_num, sms_msg);
          break;
        case 5: //"NOTIF_INQUIRE", CMD_NOTIF_INQUIRE:
          if (DEBUG) Serial.print("[SIM900]: notif inquire\r\n");
          notifInquire();
          break;
        case 6: //"NOTIF_SET_STORE", CMD_NOTIF_SET_STORE:
          if (DEBUG) Serial.print("[SIM900]: notif set store\r\n");
          notifSetStore();
          break;
        case 7: //"NOTIF_SET_INSTANT" CMD_NOTIF_SET_INSTANT:
          if (DEBUG) Serial.print("[SIM900]: notif set instant\r\n");
          notifSetInstant();
          break;
        case 8: // CHECK_AT CMD_CHECK_AT:
          if (DEBUG) Serial.print("[SIM900]: check at\r\n");
          checkAT();
          break;
        case 9: // SET_TEXT_MODE CMD_SET_TEXT_MODE:
          if (DEBUG) Serial.print("[SIM900]: set text mode\r\n");
          setTextMode();
          break;
        default: // not a cmd msg
          if (DEBUG) Serial.print("[SIM900]: INVALID CMD\r\n");
          break;
      }
      
    } else {
      if (DEBUG) Serial.print("INVALID CMD\r\n");
    }
  }

  // Read and write to serial everything from GPRS
  if (GPRS.available()) {
    int size = GPRS.readBytes(str, CMD_SIZE);
    str[size] = '\0';
    Serial.print(str);
  }
}

/*
 * Can wait for OK
 */
void checkAT() {
  GPRS.print("AT\r\n");
  delay(200);
}

/* Can wait for OK
 */
void hangupCall ()
{
  GPRS.print("ATH\r\n");
  delay(200);
}

/*
 * Can wait for response as well as OK
 */
void checkSignal ()
{
  GPRS.print("AT+CSQ\r\n");
  delay(200);
}

/*
 * Can wait for response and OK
 */
void readMessage (char msgNum[]) 
{
  GPRS.print("AT+CMGR=");
  GPRS.print(msgNum[0]);
  GPRS.print("\r\n");
  delay(200);
}

/*
 * Can wait for OK
 */
void deleteMessage (char msgNum[])
{
  GPRS.print("AT+CMGD=");
  GPRS.print(msgNum[0]);
  GPRS.print("\r\n");
  delay(200);
}

/*
 * 
 */

void sendMessage (char mobile_num[], char sms_msg[])
{
  GPRS.print("AT+CMGF=1\r\n");    
  delay(200);
  GPRS.print("AT+CMGS=\"");
  for (int j = 0; j < strlen(mobile_num); j++) {
    GPRS.print(mobile_num[j]);
  }
  GPRS.print("\"\r");
  delay(200);
  // need to wait for '>'
  GPRS.print(sms_msg);
  GPRS.print('\r');
  delay(200);
  GPRS.println((char)26); // ASCII code for Ctrl+Z
  delay(200);
  GPRS.print("\r");  
  delay(200);
}

void notifInquire()
{
  GPRS.print("AT+CNMI?\r\n");
  delay(200);
}

void notifSetStore()
{
  GPRS.print("AT+CNMI=2,1,0,0\r\n");
  delay(200);
}

void notifSetInstant()
{
  GPRS.print("AT+CNMI=2,2,0,0\r\n");
  delay(200);
}

void setTextMode()
{
  GPRS.print("AT+CMGF=1\r\n");
  delay(200);
}

void setBaud9600()
{
  GPRS.print("AT+IPR=9600\r\n");
}

