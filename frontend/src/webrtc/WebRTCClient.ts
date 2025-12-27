import type { AyameAddStreamEvent, Connection } from "@open-ayame/ayame-web-sdk";
import { createConnection, defaultOptions } from "@open-ayame/ayame-web-sdk";
import type { GamepadState } from "../utils/Gamepad.js";
import { api } from "../api/api";




export class WebRTCClient {
    private videoElement: HTMLVideoElement | null = null;

    private signalingUrl = "wss://andrii.razoom-print.com/signaling";
    private roomIdPrefix = "ukrandruha@";
    private roomName = "";
    private userId = -1;
    private signalingKey = "ULFkmZABRVve9QbejPrC_wnjKkyeJDtmN69OkYGnxe1vO1Rx";

    private clientId = crypto.randomUUID();
    private debug = true;

    private dataChannel: RTCDataChannel | null = null;
    private connA: Connection | null = null;
    private connB: Connection | null = null;

    // ================= OPTIONS ======================
    private options = (() => {
        const opt = { ...defaultOptions };

        opt.clientId = this.clientId;
        opt.signalingKey = this.signalingKey;

        opt.video = opt.video ?? {};
        opt.video.codecMimeType = "video/H264";

        opt.iceServers = [
            { urls: "stun:stun.l.google.com:19302" },
            {
                urls: "turn:andrii.razoom-print.com:3478?transport=udp",
                username: "webrtc",
                credential: "password123"
            }
        ];

        return opt;
    })();
    // =================================================

    constructor(private robotId: string, userId: number) {
        this.roomName = robotId;
        this.userId = userId;
    }

    setVideoElement(video: HTMLVideoElement) {
        this.videoElement = video;
    }

    // =================================================
    // MAIN START
    // =================================================
    async start() {
        console.log(`[WebRTC] Starting for robot ${this.robotId}`);

        await this.connectA();
        await this.connectB();

        console.log("[WebRTC] Both connections established");
    }

    // =================================================
    // CONNECTION A — DataChannel
    // =================================================
    private connectA = async () => {
        const roomId = `${this.roomIdPrefix}${this.roomName}-Data`;

        this.connA = createConnection(
            this.signalingUrl,
            roomId,
            this.options,
            this.debug
        );

        this.connA.on("open", async () => {
            if (!this.connA) return;

            const pc = this.connA.peerConnection;
            if (pc) {
                pc.onconnectionstatechange = () => {
                    console.log("[A] state:", pc.connectionState);
                };
            }

            // Create DataChannel
            this.dataChannel = await this.connA.createDataChannel("robot-control", {
                ordered: false,
                maxRetransmits: 0,
            });

            if (this.dataChannel) {
                console.log("[A] DataChannel created");

                this.dataChannel.onopen = () => {
                    console.log("[A] DataChannel open");
                };

                this.dataChannel.onmessage = (msg) => {
                    console.log("[A] Message:", msg.data);
                };
            }
        });

        // this.connA.on("disconnect", () => {
        //     console.warn("[A] Disconnected");
        //     this.connA = null;
        // });
        this.connA.connect(null);
    };

    // =================================================
    // CONNECTION B — Video Stream
    // =================================================
    private connectB = async () => {
        const roomId = `${this.roomIdPrefix}${this.roomName}-VideoA`;

        this.connB = createConnection(
            this.signalingUrl,
            roomId,
            this.options,
            this.debug
        );

        this.connB.on("addstream", (event: AyameAddStreamEvent) => {
            if (this.videoElement) {
                this.videoElement.srcObject = event.stream;
            }
        });

        this.connB.on("open", () => {
            const pc = this.connB?.peerConnection;


            if (pc) {
                try {


                } catch (e) {
                    alert(e);
                    console.error(e);
                }

                pc.onconnectionstatechange = () => {
                    console.log("[B] state:", pc.connectionState);
                    if (pc.connectionState === "connected") {
                        this.createSessions(this.roomName, this.userId);
                    }
                };
            }
        });

        this.connB.on("disconnect", () => {
            console.warn("[B] Disconnected");
            //this.updateRobotWebRtcConnect(this.roomName, null);
            //     this.connB = null;
        });

        this.connB.connect(null);
    };

    private async createSessions(robotId: string, userid: number | null)
    {
     try {
            const connectData = {
                "robotId": robotId,
                "operatorId": userid
            };
            if (userid != null) {
                await api.post(`/api/robots/robot-sessions/create`, connectData);
            }

        } catch (e) {
            alert("Помилка створення сессії");
            console.error(e);
        }
    }
    // private async updateRobotWebRtcConnect(robotId: string, userid: number | null) {


    //     try {
    //         const connectData = {
    //             "robotId": robotId,
    //             "operatorId": userid
    //         };
    //         if (userid != null) {
    //             await api.post(`/api/robots/robot-sessions/create`, connectData);
    //         } else {
    //             const disconnectData = {
    //                 "robotId": robotId,
    //                 "reason": "",
    //                 "disconnectedBy": userid,
    //                 "force": false
    //             };
    //             //{ "robotId": "1000000012a168a1","reason":"force", "disconnectedBy": "4" , "force":true}
    //             await api.post(`/api/robots/robot-sessions/disconnect`, disconnectData);
    //         }

    //     } catch (e) {
    //         alert("update webrtc client failed");
    //         console.error(e);
    //     }
    // }


    // =================================================
    // STOP
    // =================================================
    async stop() {
        console.log("[WebRTC] Stopping...");

        if (this.connA) await this.connA.disconnect();
        if (this.connB) await this.connB.disconnect();

        this.connA = null;
        this.connB = null;
        this.dataChannel = null;
        if (this.videoElement) {
            this.videoElement.srcObject = null;
        }

        //this.updateRobotWebRtcConnect(this.roomName, null);
    }
    // =================================================
    // Set data GamePad
    // =================================================
    async SetDataGamePad(state: GamepadState) {

        const msgByte = this.pack7(state);

        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            await this.dataChannel.send(msgByte);
            //console.log('Sent via datachannel');
        } else {
            //console.log('DataChannel not open');
        }
    }

    pack7(state: GamepadState): Uint8Array {
        const values = [
            state.ch1, state.ch2, state.ch3,
            state.ch4, state.ch5, state.ch6, state.ch7,
        ];

        const buf = new Uint8Array(9);
        let acc = 0;
        let accBits = 0;
        let i = 0;

        for (let v of values) {
            // clamp до [-1, 1]
            v = Math.max(-1, Math.min(1, v));
            // перетворення до діапазону [1000..2000]
            const q = 1000 + Math.round((v + 1) * 500);
            const x10 = q - 1000; // 0..1000 (10 біт)

            acc |= (x10 & 0x3FF) << accBits;
            accBits += 10;

            while (accBits >= 8) {
                buf[i++] = acc & 0xFF;
                acc >>>= 8;
                accBits -= 8;
            }
        }

        if (accBits > 0) {
            buf[i++] = acc & 0xFF;
        }

        return buf; // Uint8Array довжиною 9 байтів
    }

    async sendDataArray(msg: Uint8Array) {

    }

}
