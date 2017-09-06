var modem = require("../index.js");

/* Change to port */
var m1 = new modem.Modem_text("/dev/cu.usbmodem1411");


const m1_open = () => {
    console.log("in m1_open")
    setTimeout(() => {
        m1.open((status) => {
            if (status == true) {
                console.log("Port is open");

            } else {
                console.log("Error in opening Port");
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
