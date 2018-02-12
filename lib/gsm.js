const SerialPort = require('serialport');
const Readline = SerialPort.parsers.Readline;
const events = require('events');
const _ = require("underscore");
const moment = require('moment');
const redis = require('redis');
const bluebird = require('bluebird');

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);


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
        // Drain immediately
        //this.serial.drain();

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
        //this.cmdWriteQueue = [];
        this.rd = {};
        this.rd.cmdWriteQueue = redis.createClient({host: 'localhost', port: '6379'});
        this.rd.cmdWriteQueue.selectAsync('2');


        this.FLAG_WRITE_CMD = false;
        this.LAST_CMD = null;

        // Check cmdWriteQueue for new cmds
        setInterval(() => {
            if (this.FLAG_WRITE_CMD == false) {
               
                //DEBUG && console.log(this.cmdWriteQueue);

                // check length
                this.rd.cmdWriteQueue.llenAsync('cmdWriteQueue')
                    .then((res) => {
                        if (res > 0) {
                            // There are commands being waited for
                            this.FLAG_WRITE_CMD = true;
                            DEBUG && console.log("[GSM-ARDUINO]: cmdWriteQueue ready");
                            DEBUG && console.log("[GSM-ARDUINO]: queue")
                            return this.rd.cmdWriteQueue.lrangeAsync('cmdWriteQueue', 0, -1)
                                .then((list_contents) => {
                                    DEBUG && console.log(list_contents);
                                    return this.rd.cmdWriteQueue.rpopAsync('cmdWriteQueue')
                                        .then((res) => {

                                            DEBUG && console.log("[GSM-ARDUINO]: Cmd = " + res);
                                            this.LAST_CMD = res;
                                            this.writeAndDrain(res);
                                            return Promise.resolve();
                                            //return this.rd.cmdWriteQueue.rpopAsync('cmdWriteQueue')
                                        })
                                })
                            

                        }
                        return Promise.resolve()
                    })
                    .catch((error) => {
                        DEBUG && console.log(`[GSM-ARDUINO]: ${error}`);
                    })

            }
        }, 500);

        this.serial.on('open', (err) => {
            if (err) {
                DEBUG && console.log("[GSM-ARDUINO]: Error in opening port");
            } else {
                DEBUG && console.log("[GSM-ARDUINO]: Port is opened");
            }

        });
        this.serial.on('error', (err) => {
            this.eventEmitter.emit('error connect', err);
        });

        this.serial.on('close', () => {
            this.eventEmitter.emit('close connect');
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

            } else if (buffer.indexOf('+CMT') === 0) {
                // response from new msg
                let msgHeader = buffer.split("+CMT: ")[1].split(',');
                DEBUG && console.log(`[GSM-ARDUINO]: ${msgHeader}`);

                this.msg.num = msgHeader[0].split('"')[1];
                this.msg.datetime = moment().format();
                this.FLAG_NEW_MSG = true;

            } else if (buffer.indexOf('+CSQ') === 0) {
                // respones from check signal
                let signal = buffer.split(" ")[1].split(",")[0] * 1;
                let signal_strength = 0;
                if (signal != 99) {
                    signal_strength = Math.round(signal / (31) * 100);
                }
                let signal_strength_msg = `${signal_strength}%`;
                this.eventEmitter.emit('signal status', signal_strength_msg);
                /*
                this.rd.cmdWriteQueue.rpopAsync('cmdWriteQueue')
                .then((res) => {
                    DEBUG && console.log(`[GSM-ARDUINO]: Popped from cmdWriteQueue ${res}`);
                    return Promise.resolve();
                })
                */

            } else if (buffer.indexOf('RING') == 0) {
                // response if there's ringing
                // hangup the call immediately
                this.writeAndDrain(CMD_HANGUP_CALL, () => {
                    DEBUG && console.log("[GSM-ARDUINO]: Stopped call");
                });
                //this.cmdWriteQueue.push(CMD_HANGUP_CALL);
            } else if (buffer.indexOf('OK') === 0) {
                // the command sent has already executed
                /*
                if (this.FLAG_WRITE_CMD == true) {
                    // there was a prior command executed
                    
                    return this.rd.cmdWriteQueue.rpopAsync('cmdWriteQueue')
                        .then((res) => {
                            DEBUG && console.log(`[GSM-ARDUINO]: Popped from cmdWriteQueue ${res}`);
                            this.FLAG_WRITE_CMD = false;

                            return Promise.resolve();
                        })
                } else {
                    DEBUG && console.log("[GSM-ARDUINO]: Set this.FLAG_WRITE_CMD to FALSE");
                    this.FLAG_WRITE_CMD = false;
                }
                */
                DEBUG && console.log("[GSM-ARDUINO]: OK Set this.FLAG_WRITE_CMD to FALSE");

                this.FLAG_WRITE_CMD = false;

               
            } else if (buffer.indexOf('ERROR' === 0)) {
                // there has been an error. Stall sending of commands.
                // Would require a restart.
                this.eventEmitter.emit('error gsm serial', this.LAST_CMD);

                //this.FLAG_WRITE_CMD = false;


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
        this.rd.cmdWriteQueue.lpushAsync('cmdWriteQueue', cmd);

        //this.cmdWriteQueue.push(cmd);
    }

    checkSignal() {
        DEBUG && console.log("[GSM-ARDUINO]: Checking signal status...");
        //this.cmdWriteQueue.push(CMD_CHECK_SIGNAL);
        this.rd.cmdWriteQueue.lrangeAsync('cmdWriteQueue', 0, 0)
            .then((res) => {
                DEBUG && console.log(`0,0: ${res[0]}`);
                if (res[0] !== undefined) {
                    if (res[0] !== `${CMD_CHECK_SIGNAL}`) {
                        DEBUG && console.log(res[0].slice(0, 17));
                        DEBUG && console.log(`${CMD_CHECK_SIGNAL}`);
                        DEBUG && console.log('in not equals match');
                        return this.rd.cmdWriteQueue.lpushAsync('cmdWriteQueue', CMD_CHECK_SIGNAL);
                    } else {
                        DEBUG && console.log('in CMD_CHECK_SIGNAL last entry');
                        return;

                    }

                } else {
                    return this.rd.cmdWriteQueue.lpushAsync('cmdWriteQueue', CMD_CHECK_SIGNAL);

                }
               

            })


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