const SerialPort = require('serialport');
const Readline = SerialPort.parsers.Readline;
const events = require('events');
const _ = require("underscore");
const moment = require('moment');

const DEBUG = true;

// list of commands
const CMD_HANGUP_CALL = "CMD_HANGUP_CALL:\r";
const CMD_CHECK_SIGNAL = "CMD_CHECK_SIGNAL:\r";
const CMD_DELETE_MSG = "CMD_DELETE_MSG:";
const CMD_READ_MSG = "CMD_READ_MSG:";
const CMD_SEND_MSG = "CMD_SEND_MSG";
const CMD_NOTIF_INQUIRE = "CMD_NOTIF_INQUIRE:\r";
const CMD_NOTIF_SET_STORE = "CMD_NOTIF_SET_STORE:\r"
const CMD_NOTIF_SET_INSTANT = "CMD_NOTIF_SET_INSTANT:\r";
const CMD_CHECK_AT = "CMD_CHECK_AT:\r";
const CMD_SET_TEXT_MODE = "CMD_SET_TEXT_MODE:\r";



class Modem_text {
    constructor(port, options) {
        this.port = port;
        if (options = undefined) {
            var options = {};
        }
        _.defaults(options, {
            baudrate: 9600,
            dataBits: 8,
            parity: 'none',
            stopBits: 1,
            flowControl: false,
            autoOpen: false,
        });
        this.options = options;
        this.serial = new SerialPort(this.port, this.options);
        this.eventEmitter = new events.EventEmitter();
        this.parser = new Readline({ delimiter: '\n' });
        DEBUG && console.log("[GSM-ARDUINO]: " + this.port);
        DEBUG && console.log("[GSM-ARDUINO]: " + this.options);

        /* New Msg Details */
        this.FLAG_NEW_MSG = false;
        this.msg = {
            num: "",
            text: "",
            datetime: ""
        }

        // Queue for commands to be written to GSM modem
        this.cmdWriteQueue = [];
        this.FLAG_WRITE_CMD = false;

        // Check cmdWriteQueue for new cmds
        setInterval(() => {
            if (this.FLAG_WRITE_CMD == false && this.cmdWriteQueue.length > 0) {
                DEBUG && console.log("[GSM-ARDUINO]: cmdWriteQueue ready");
                DEBUG && console.log("[GSM-ARDUINO]: queue")
                DEBUG && console.log(this.cmdWriteQueue);
                this.FLAG_WRITE_CMD = true;
                DEBUG && console.log("[GSM-ARDUINO]: " + this.cmdWriteQueue[0]);
                this.writeAndDrain(this.cmdWriteQueue[0], () => {
                    this.cmdWriteQueue.shift();
                });
            }
        }, 3000);

        this.serial.on('open', (err) => {
            if (err) {
                DEBUG && console.log("[GSM-ARDUINO]: Error in opening port");
            } else {
                DEBUG && console.log("[GSM-ARDUINO]: Port is opened");
            }

        });
        this.serial.on('error', (err) => {
            this.eventEmitter('error connect', err);
        });

        this.serial.on('close', () => {
            this.eventEmitter('close connect');
        })

        this.serial.pipe(this.parser);

        this.parser.on('data', (buffer) => {
            DEBUG && console.log("[GSM-ARDUINO]: NEW DATA");
            DEBUG && console.log("[GSM-ARDUINO]: " + buffer);
            if (this.FLAG_NEW_MSG == true) {
                // get first line of text
                this.FLAG_NEW_MSG = false;
                this.msg.text = buffer;
                this.eventEmitter.emit('new message', this.msg.num, this.msg.text, this.msg.datetime);

            } else if (buffer.indexOf('+CMT') == 0) {
                // response from new msg
                let msgHeader = buffer.split("+CMT: ")[1].split(',');
                this.msg.num = msgHeader[0].split('"')[1];
                this.msg.datetime = moment().format();
                this.FLAG_NEW_MSG = true;

            } else if (buffer.indexOf('+CSQ') == 0) {
                // respones from check signal
                let signal = buffer.split(" ")[1].split(",")[0] * 1;
                let signal_strength = 0;
                if (signal != 99) {
                    signal_strength = Math.round(signal / (31) * 100);
                }
                let signal_strength_msg = `${signal_strength}%`;
                this.eventEmitter.emit('signal status', signal_strength_msg);

            } else if (buffer.indexOf('RING') == 0) {
                // response if there's ringing
                // hangup the call immediately
                this.writeAndDrain(CMD_HANGUP_CALL, () => {
                    DEBUG && console.log("[GSM-ARDUINO]: Stopped call");
                });
                //this.cmdWriteQueue.push(CMD_HANGUP_CALL);
            } else if (buffer.indexOf('OK') == 0 || buffer.indexOf('ERROR') == 0) {
                // the command sent has already executed
                DEBUG && console.log("[GSM-ARDUINO]: Set this.FLAG_WRITE_CMD to FALSE");
                this.FLAG_WRITE_CMD = false;
            } else {
                DEBUG && console.log("[GSM-ARDUINO]: Unhandled msg");
            }
        });
    }

    writeAndDrain(data, cb) {
        this.serial.write(data);
        this.serial.drain(cb);
    }

    open(cb) {
        this.serial.open((err) => {
            if (err) {
                DEBUG && console.log("[GSM-ARDUINO]: in error open()");
                DEBUG && console.log("[GSM-ARDUINO]: " + err);
                cb(err);
                return;
            }
            cb(true);
            return;
        });
    }

    newMsgs(cb) {
        this.eventEmitter.on('new message', (num, text, datetime) => {
            cb("got it");
            return true;
        });
        //return this.newMsgs;
    }

    sendMsg(num, text) {
        DEBUG && console.log("[GSM-ARDUINO]: In send msg queue");
        let cmd = CMD_SEND_MSG + ":" + num + ":" + text + "\r";
        this.cmdWriteQueue.push(cmd);
    }

    checkSignal() {
        DEBUG && console.log("[GSM-ARDUINO]: Checking signal status...");
        this.cmdWriteQueue.push(CMD_CHECK_SIGNAL);
    }
}


class Modem_pdu {
    constructor(port) {
        this.port = port;
        console.log(port);
    }
}




module.exports = {
    Modem_text: Modem_text,
    Modem_pdu: Modem_pdu
}