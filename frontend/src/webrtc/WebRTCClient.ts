import type { AyameAddStreamEvent, Connection } from "@open-ayame/ayame-web-sdk";
import { createConnection, defaultOptions } from "@open-ayame/ayame-web-sdk";
import { signal } from "@preact/signals";

import type { GamepadState } from "../utils/Gamepad.js";
import { api } from "../api/api";

// Media stream signals
export const localMediaStream = signal<MediaStream | null>(null);


export class WebRTCClient {
    // Optional callback invoked when structured data arrives from robot
    public onData: ((data: any) => void) | null = null;
    public onPing: ((ms: number | null) => void) | null = null;
    public onVideoConnectionStateChange: ((connected: boolean) => void) | null = null;
    public onStats: ((stats: {
        pingMs: number | null;
        packetsLost: number | null;
        packetsReceived: number | null;
        packetsLostInterval: number | null;
        packetsReceivedInterval: number | null;
        lossPct: number | null;
        fps: number | null;
    }) => void) | null = null;

    private videoElement: HTMLVideoElement | null = null;

    private signalingUrl = (import.meta.env.VITE_WEBRTC_SIGNALING_URL as string | undefined) ?? "";
    private roomIdPrefix = "ukrandruha@";
    private roomName = "";
    private userId = -1;
    private signalingKey = (import.meta.env.VITE_WEBRTC_SIGNALING_KEY as string | undefined) ?? "";
    private turnUrl = (import.meta.env.VITE_WEBRTC_TURN_URL as string | undefined) ?? "";
    private turnUsername = (import.meta.env.VITE_WEBRTC_TURN_USERNAME as string | undefined) ?? "";
    private turnCredential = (import.meta.env.VITE_WEBRTC_TURN_CREDENTIAL as string | undefined) ?? "";

    private clientId = crypto.randomUUID();
    private debug = true;

    private dataChannel: RTCDataChannel | null = null;
    private dataChannelTelem: RTCDataChannel | null = null;

    private connA: Connection | null = null;
    private connB: Connection | null = null;

    private mediaRecorder: MediaRecorder | null = null;
    private recordedChunks: BlobPart[] = [];
    private recordingStartTime: Date | null = null;
    private pingIntervalId: number | null = null;
    private lossWindow: Array<{ ts: number; lost: number; received: number }> = [];
    private lastLossSample: { ts: number; lost: number; received: number } | null = null;
    private sessionActivated = false;
    private activationInFlight: Promise<void> | null = null;
    

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
                urls: this.turnUrl,
                username: this.turnUsername,
                credential: this.turnCredential
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
        this.validateConfig();

        try {
            await Promise.all([this.connectA(), this.connectB()]);
        } catch (error) {
            await this.requestRebootForWebrtcError();
            throw error;
        }

        console.log("[WebRTC] Both connections established");
    }

    // =================================================
    // CONNECTION A — DataChannel
    // =================================================
    private connectA = async () => {
        this.stopConnectionA();
        const roomId = `${this.roomIdPrefix}${this.roomName}-Data`;
        const connectTimeoutMs = 15_000;

        this.connA = createConnection(
            this.signalingUrl,
            roomId,
            this.options,
            this.debug
        );

        const connected = new Promise<void>((resolve, reject) => {
            let settled = false;
            const done = (fn: () => void) => {
                if (settled) return;
                settled = true;
                window.clearTimeout(timeoutId);
                fn();
            };
            const timeoutId = window.setTimeout(() => {
                done(() => reject(new Error("[A] Timed out while connecting data channel")));
            }, connectTimeoutMs);

            this.connA?.on("disconnect", () => {
                done(() => reject(new Error("[A] Disconnected before data channel opened")));
            });

            this.connA?.on("open", async () => {
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
                        done(resolve);
                    };

                    this.dataChannel.onmessage = async (msg) => {
                        const text = await this.decodeDataChannelMessage(msg.data);
                        if (text === null) return;
                        console.log("[A] Message:", text);
                        this.handleIncomingData(text);
                    };
                } else {
                    done(() => reject(new Error("[A] Failed to create data channel")));
                }
            });
        });

        this.connA.connect(null);
        await connected;
    };

    // =================================================
    // CONNECTION B — Video Stream
    // =================================================
    private connectB = async () => {
        this.stopConnectionB();
        const roomId = `${this.roomIdPrefix}${this.roomName}-VideoA`;
        const connectTimeoutMs = 20_000;

        const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
        });
        localMediaStream.value = stream;

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

        const connected = new Promise<void>((resolve, reject) => {
            let settled = false;
            const done = (fn: () => void) => {
                if (settled) return;
                settled = true;
                window.clearTimeout(timeoutId);
                fn();
            };
            const timeoutId = window.setTimeout(() => {
                done(() => reject(new Error("[B] Timed out while connecting media stream")));
            }, connectTimeoutMs);

            this.connB?.on("disconnect", () => {
                console.warn("[B] Disconnected");

            const stream = localMediaStream.value;
                if (stream) {
                    for (const track of stream.getTracks()) {
                    track.stop();
                    }
                }
                localMediaStream.value = null;

                this.stopPingStats();
                if (this.onVideoConnectionStateChange) this.onVideoConnectionStateChange(false);
                if (!settled) {
                    done(() => reject(new Error("[B] Disconnected before connected state")));
                }
            });

            this.connB?.on("open", async () => {
                if (!this.connB) return;
                const pc = this.connB?.peerConnection;
                if (pc) {
                    pc.onconnectionstatechange = () => {
                        console.log("[B] state:", pc.connectionState);
                        if (this.onVideoConnectionStateChange) {
                            this.onVideoConnectionStateChange(pc.connectionState === "connected");
                        }
                        if (pc.connectionState === "connected") {
                            void this.ensureSessionActivated(this.roomName);
                            this.startPingStats(pc);
                            done(resolve);
                        }
                    };
                    if (pc.connectionState === "connected") {
                        void this.ensureSessionActivated(this.roomName);
                        this.startPingStats(pc);
                        done(resolve);
                    }

                    
                } else {
                    done(() => reject(new Error("[B] PeerConnection not available after open")));
                }

                // Create DataChannel
                this.dataChannelTelem = await this.connB.createDataChannel("robot-telemetr", {
                    ordered: false,
                    maxRetransmits: 0,
                });

                if (this.dataChannelTelem) {
                    console.log("[B] DataChannel created");

                    this.dataChannelTelem.onopen = () => {
                        console.log("[A] DataChannel open");
                        done(resolve);
                    };

                    this.dataChannelTelem.onmessage = async (msg) => {
                        const text = await this.decodeDataChannelMessage(msg.data);
                        if (text === null) return;
                        console.log("[B] Message:", text);
                        this.handleIncomingData(text);
                    };
                } else {
                    done(() => reject(new Error("[A] Failed to create data channel")));
                }

            });
        });

        this.connB.connect(null);
        await connected;
    };

    private async ensureSessionActivated(robotId: string) {
        if (this.sessionActivated) return;
        if (this.activationInFlight) return this.activationInFlight;
        this.activationInFlight = this.activateWebrtcSession(robotId)
            .then(() => {
                this.sessionActivated = true;
            })
            .finally(() => {
                this.activationInFlight = null;
            });
        return this.activationInFlight;
    }

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

        this.stopConnectionA();
        this.stopConnectionB();
        this.stopPingStats();
        if (this.onVideoConnectionStateChange) this.onVideoConnectionStateChange(false);

        this.connA = null;
        this.connB = null;
        this.dataChannel = null;
        if (this.videoElement) {
            this.videoElement.srcObject = null;
        }

        if (this.sessionActivated || this.activationInFlight) {
            await this.deactivateWebrtcSession(this.roomName);
            this.sessionActivated = false;
            this.activationInFlight = null;
        }

        //this.updateRobotWebRtcConnect(this.roomName, null);
    }

    private startPingStats(pc: RTCPeerConnection) {
        this.stopPingStats();
        this.pingIntervalId = window.setInterval(async () => {
            try {
                const stats = await pc.getStats();
                let rttMs: number | null = null;
                let packetsLost: number | null = null;
                let packetsReceived: number | null = null;
                let lossPct: number | null = null;
                let packetsLostInterval: number | null = null;
                let packetsReceivedInterval: number | null = null;
                let fps: number | null = null;

                for (const stat of stats.values()) {
                    if (stat.type !== "candidate-pair") continue;
                    const pair = stat as RTCIceCandidatePairStats;
                    const isSelected = (pair as any).selected || (pair as any).nominated;
                    if (!isSelected || pair.state !== "succeeded") continue;
                    if (typeof pair.currentRoundTripTime === "number") {
                        rttMs = Math.round(pair.currentRoundTripTime * 1000);
                    }
                    break;
                }

                for (const stat of stats.values()) {
                    if (stat.type !== "inbound-rtp") continue;
                    const inbound = stat as RTCInboundRtpStreamStats;
                    if (inbound.isRemote) continue;
                    if (inbound.kind !== "video") continue;

                    const lost = typeof inbound.packetsLost === "number" ? inbound.packetsLost : 0;
                    const received = typeof inbound.packetsReceived === "number" ? inbound.packetsReceived : 0;
                    const inboundFps =
                        typeof (inbound as any).framesPerSecond === "number"
                            ? (inbound as any).framesPerSecond
                            : null;

                    packetsLost = (packetsLost ?? 0) + lost;
                    packetsReceived = (packetsReceived ?? 0) + received;
                    if (inboundFps !== null) {
                        fps = fps === null ? inboundFps : Math.max(fps, inboundFps);
                    }
                }

                if (packetsLost !== null || packetsReceived !== null) {
                    const total = (packetsLost ?? 0) + (packetsReceived ?? 0);
                    lossPct = total > 0 ? Math.round(((packetsLost ?? 0) / total) * 1000) / 10 : 0;

                    // Loss over last 10 seconds (cumulative within window)
                    const now = Date.now();
                    if (this.lastLossSample) {
                        const lostDelta = Math.max(0, (packetsLost ?? 0) - this.lastLossSample.lost);
                        const recvDelta = Math.max(0, (packetsReceived ?? 0) - this.lastLossSample.received);
                        this.lossWindow.push({ ts: now, lost: lostDelta, received: recvDelta });
                        const cutoff = now - 10_000;
                        while (this.lossWindow.length > 0 && this.lossWindow[0].ts < cutoff) {
                            this.lossWindow.shift();
                        }
                        const lostSum = this.lossWindow.reduce((acc, s) => acc + s.lost, 0);
                        const recvSum = this.lossWindow.reduce((acc, s) => acc + s.received, 0);
                        packetsLostInterval = lostSum;
                        packetsReceivedInterval = recvSum;
                        const totalSum = lostSum + recvSum;
                        lossPct = totalSum > 0 ? Math.round((lostSum / totalSum) * 1000) / 10 : 0;
                    }
                    this.lastLossSample = {
                        ts: now,
                        lost: packetsLost ?? 0,
                        received: packetsReceived ?? 0,
                    };
                }

                if (this.onPing) this.onPing(rttMs);
                if (this.onStats) {
                    this.onStats({
                        pingMs: rttMs,
                        packetsLost,
                        packetsReceived,
                        packetsLostInterval,
                        packetsReceivedInterval,
                        lossPct,
                        fps: fps !== null ? Math.round(fps * 10) / 10 : null,
                    });
                }
            } catch (e) {
                console.warn("[WebRTC] Failed to read stats", e);
            }
        }, 500);
    }

    private stopPingStats() {
        if (this.pingIntervalId) {
            window.clearInterval(this.pingIntervalId);
            this.pingIntervalId = null;
        }
        this.lossWindow = [];
        this.lastLossSample = null;
    }

    private stopConnectionA() {
        const conn = this.connA;
        this.connA = null;
        this.dataChannel = null;
        if (conn) {
            void conn.disconnect().catch((e) => {
                console.warn("[A] Failed to disconnect", e);
            });
        }
    }

    private stopConnectionB() {
        const conn = this.connB;
        this.connB = null;
        if (conn) {
            void conn.disconnect().catch((e) => {
                console.warn("[B] Failed to disconnect", e);
            });
        }
    }

    private validateConfig() {
        const missing: string[] = [];
        if (!this.signalingUrl) missing.push("VITE_WEBRTC_SIGNALING_URL");
        if (!this.signalingKey) missing.push("VITE_WEBRTC_SIGNALING_KEY");
        if (!this.turnUrl) missing.push("VITE_WEBRTC_TURN_URL");
        if (!this.turnUsername) missing.push("VITE_WEBRTC_TURN_USERNAME");
        if (!this.turnCredential) missing.push("VITE_WEBRTC_TURN_CREDENTIAL");

        if (missing.length > 0) {
            throw new Error(`[WebRTC] Missing required env vars: ${missing.join(", ")}`);
        }
    }

    private async decodeDataChannelMessage(data: string | Blob | ArrayBuffer | ArrayBufferView): Promise<string | null> {
        if (typeof data === "string") return data;
        if (data instanceof Blob) return data.text();
        if (data instanceof ArrayBuffer) return new TextDecoder("utf-8").decode(new Uint8Array(data));
        if (ArrayBuffer.isView(data)) return new TextDecoder("utf-8").decode(data);
        return null;
    }

    private handleIncomingData(text: string) {
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

    private async requestRebootForWebrtcError() {
        try {
            await api.post(`/api/robots/robot-sessions/requestReboot`, {
                robotId: this.roomName,
                status: "REBOOT_WERRTC_REQUESTED",
                reason: "webrtc_connect_error",
                requestedBy: this.userId.toString(),
            });
        } catch (e) {
            console.error("[WebRTC] Failed to request reboot after connect error", e);
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
        //console.log(state.ch1, state.ch2, state.b1, state.b2, state.b3, state.b4);
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
