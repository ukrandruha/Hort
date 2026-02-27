import type { AyameAddStreamEvent, Connection } from "@open-ayame/ayame-web-sdk";
import { createConnection, defaultOptions } from "@open-ayame/ayame-web-sdk";
import { signal } from "@preact/signals";

import type { GamepadState } from "../utils/Gamepad.js";
import { api } from "../api/api";




export class WebRTCClient {
    // Optional callback invoked when structured data arrives from robot
    public onData: ((data: any) => void) | null = null;

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

    private mediaRecorder: MediaRecorder | null = null;
    private recordedChunks: BlobPart[] = [];
    private recordingStartTime: Date | null = null;
    

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
                    const text = new TextDecoder("utf-8").decode(msg.data);
                    console.log("[A] Message:", text);
                    // Try to parse JSON-like payloads and call onData callback
                    try {
                        let parsed: any = null;
                        try {
                            parsed = JSON.parse(text);
                        } catch (e) {
                            // Fallback: replace single quotes with double quotes for python-style dicts
                            const maybeJson = text.replace(/\'/g, '"');
                            parsed = JSON.parse(maybeJson);
                        }

                        if (parsed && this.onData) {
                            this.onData(parsed);
                        }
                    } catch (e) {
                        if (this.onData) {
                            this.onData({ raw: text });
                        }
                    }
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
                        this.activateWebrtcSession(this.roomName);
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

    private async activateWebrtcSession(robotId: string) {
        try {
            await api.post(`/api/robots/robot-sessions/activateWebrtc`, {
                "robotId": robotId
            });
        } catch (e) {
            alert("Помилка активації WebRTC");
            console.error(e);
        }
    }



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

        await this.deactivateWebrtcSession(this.roomName);

        //this.updateRobotWebRtcConnect(this.roomName, null);
    }

    private async deactivateWebrtcSession(robotId: string) {
        try {
            await api.post(`/api/robots/robot-sessions/deactivateWebrtc`, {
                "robotId": robotId
            });
        } catch (e) {
            alert("Помилка деактивації WebRTC");
            console.error(e);
        }
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
            state.ch4, state.ch5, state.ch6, state.ch7,state.ch8,
            state.b1, state.b2, state.b3, state.b4,
        ];

        const buf = new Uint8Array(Math.ceil((values.length * 10) / 8));
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

        return buf; // Uint8Array довжиною 10 байтів
    }

    async sendDataArray(msg: Uint8Array) {

    }

    // =================================================
    // Recording VIDEO
    // =================================================



    startRecording() {

        const pc = this.connB?.peerConnection;
        
        if (pc?.connectionState === "connected") {
            if (!this.videoElement) {
                console.warn("Video element not set");
                return;
            }

            const stream = this.videoElement.srcObject as MediaStream | null;
            if (!stream) {
                console.warn("No MediaStream to record");
                return;
            }

            this.recordedChunks = [];
            this.recordingStartTime = new Date();

            const options: MediaRecorderOptions = {
                mimeType: "video/webm; codecs=vp8"
                // якщо браузер не підтримує vp8:
                // mimeType: "video/webm"
            };

            this.mediaRecorder = new MediaRecorder(stream, options);

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstart = () => {
                console.log("[Recorder] Recording started");
            };

            this.mediaRecorder.onstop = () => {
                console.log("[Recorder] Recording stopped");
                this.saveRecording();
            };

            this.mediaRecorder.start();
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
            this.mediaRecorder.stop();
        }
    }


    private saveRecording() {
        if (!this.recordingStartTime) return;

        const blob = new Blob(this.recordedChunks, {
            type: "video/webm"
        });

        const filename = this.formatDateForFilename(this.recordingStartTime);

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${filename}.webm`;
        a.click();

        URL.revokeObjectURL(url);
    }

    private formatDateForFilename(date: Date): string {
        const pad = (n: number) => n.toString().padStart(2, "0");

        return (
            date.getFullYear() + "-" +
            pad(date.getMonth() + 1) + "-" +
            pad(date.getDate()) + "_" +
            pad(date.getHours()) + "-" +
            pad(date.getMinutes()) + "-" +
            pad(date.getSeconds())
        );
    }


}
