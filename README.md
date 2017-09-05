gsm-arduino
========
A gsm modem library for Node JS to send and receive text messages with an Arduino Uno and a SIM900 GSM shield.

The system currently runs in text mode for readability. This would limit SMS messages to 160 characters.

Warning, in alpha stages.

No verificaiton of responses yet, these will be changed Arduino side in the near future.


## Installation
`npm install gsm-arduino`

## Usage

### For the SIM900 + Arduino Uno side
See the `ino` folder.

Inside are two files, one to set the baud rate of the SIM900 shield to 9600, and one which would be the main sketch to use with this module.

Run the sketch for changing the baud rate to 9600 first. And then you can run the gateway ino.

### For the Node JS side
See examples/test.js

```javascript
var modem = require("gsm-arduino");

/* Change to port */
var m1 = new modem.Modem_text("/dev/cu.usbmodem1411");

const m1_open = () => {
    console.log("in m1_open")
    setTimeout(() => {
        m1.open((status) => {
            if (status == true) {
                console.log("Port is open");
            } else {
                setTimeout(() => {
                    console.log("in else m1_open");
                    console.log(status);
                }, 3000);
            }
        });
    }, 2000);

}
m1_open();

m1.eventEmitter.on('error connect', (err) => {
    console.log("Arduino connect error");
    console.log(err);

    m1_open();
});

m1.eventEmitter.on('close connect', () => {
    console.log("Arduino connect close");
    m1_open();
})

m1.eventEmitter.on('new message', (num, text, datetime) => {
    console.log("New message:");
    console.log(num);
    console.log(text);
    console.log(datetime);

    var msg = text.trim().split(/\s+/);
    if (msg[0].toUpperCase() == "HELLO") {
        var reply = "Hi";
        m1.sendMsg(num, reply);
    }
});

m1.eventEmitter.on('signal status', (signal_strength) => {
    console.log(`Signal strength: ${signal_strength}`);
})

setInterval(() => {
    m1.checkSignal();
}, 10000);
```