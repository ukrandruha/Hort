
/* ==========================================================================
   Gamepad API integration for RadioMaster TX12 (HID / Liftoff-style)
   ========================================================================== */

export type AxisMap = { ch1: number; ch2: number;ch3: number;ch4: number ;ch5: number; ch6: number ;ch7: number; ch8: number  };

export interface GamepadReaderOptions {
  axisMap?: AxisMap;
  deadzone?: number;   // 0..1
  smooth?: number;     // 0..1 (higher => smoother)
  updateIntervalMs?: number;
}

export interface GamepadState {
  ch1: number;
  ch2: number;
  ch3: number; 
  ch4: number;
  ch5: number;
  ch6: number;
  ch7: number;
  ch8: number;
  b1: number;
  b2: number;
  b3: number;
  b4: number;

}


function clamp01(x: number) { return x < 0 ? 0 : x > 1 ? 1 : x; }
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

export class GamepadReader {
  axisMap: AxisMap;
  deadzone: number;
  smooth: number;
  updateIntervalMs: number;
  private last: number = 0;
  private raf: number | null = null;
  private index: number = -1;

  //private prev: Record<keyof AxisMap, number> = { thr: 0, roll: 0, pitch: 0, yaw: 0 ,armAxis:0};
  private prev: Record<keyof AxisMap, number> = {  ch1:0,ch2:0,ch3:0,ch4:0, ch5:0,ch6:0,ch7:0,ch8:0};

  onUpdate: ((s: GamepadState) => void) | null = null;

  constructor(opts: GamepadReaderOptions = {}) {
    this.axisMap = opts.axisMap ?? {  ch1:0,ch2:0,ch3:0,ch4:0, ch5:0,ch6:0,ch7:0,ch8:0};
    this.deadzone = clamp01(opts.deadzone ?? 0.05);
    this.smooth = clamp01(opts.smooth ?? 0.25);
    this.updateIntervalMs = opts.updateIntervalMs ?? 16;

    if (typeof window !== "undefined") {
      window.addEventListener("gamepadconnected", (e: any) => {
        if (this.index < 0) this.index = e.gamepad.index;
      });
      window.addEventListener("gamepaddisconnected", (e: any) => {
        if (this.index === e.gamepad.index) this.index = -1;
      });
    }
  }

  start() {
    if (this.raf != null) return;
    const step = (time: number) => {
      const pads = navigator.getGamepads ? navigator.getGamepads() : ([] as any);
      const gp: any =
        (this.index >= 0 ? pads[this.index] : null) ||
        (Array.from(pads).find(Boolean) as any) || null;

      if (gp) {
        if (this.index < 0) this.index = gp.index;

const axes: number[] = Array.from(gp.axes ?? []) as number[];

const buttons: number[] = Array.from(gp.buttons ?? []) as any;

const raw = {
  ch1: Number(axes[this.axisMap.ch1].toFixed(3) ?? 0),
  ch2: Number(axes[this.axisMap.ch2].toFixed(3) ?? 0),
  ch3: Number(axes[this.axisMap.ch3].toFixed(3) ?? 0),
  ch4: Number(axes[this.axisMap.ch4].toFixed(3) ?? 0),
  ch5: Number(axes[this.axisMap.ch5].toFixed(3) ?? 0),
  ch6: Number(axes[this.axisMap.ch6].toFixed(3) ?? 0),
  ch7: Number(axes[this.axisMap.ch7].toFixed(3) ?? 0),
  ch8: Number(axes[this.axisMap.ch8].toFixed(3) ?? 0),
  b1: Number((buttons[0]?.value ?? 0).toFixed(3)),
  b2: Number((buttons[1]?.value ?? 0).toFixed(3)),
  b3: Number((buttons[2]?.value ?? 0).toFixed(3)),
  b4: Number((buttons[3]?.value ?? 0).toFixed(3)),
};

        const dead = (x: number) => {
          const v = x;
          return Math.abs(v) < this.deadzone ? 0 : v;
        };

           const filtered = {
           ch1:  dead(raw.ch1),
           ch2:  dead(raw.ch2),
           ch3:  dead(raw.ch3),
           ch4:  dead(raw.ch4),
           ch5:  dead(raw.ch5),
           ch6:  dead(raw.ch6),
           ch7:  dead(raw.ch7),
           ch8:  dead(raw.ch8),
           b1: raw.b1,
           b2: raw.b2,
           b3: raw.b3,
           b4: raw.b4,

         };
        this.prev = filtered;

        const state: GamepadState = {
          ...filtered,

        };
        if (time - this.last >= this.updateIntervalMs) {
          this.last = time;
          
          this.onUpdate?.(state);
        }


      } else {
        if (this.onUpdate) {
          this.onUpdate({
             ch1:0,ch2:0,ch3:0,ch4:0, ch5:0,ch6:0,ch7:0,ch8:0,
             b1:0,b2:0,b3:0,b4:0,
          });
        }
      }

      this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  stop() {
    if (this.raf != null) { cancelAnimationFrame(this.raf); this.raf = null; }
  }


  setAxisMap(map: Partial<AxisMap>) {
    this.axisMap = { ...this.axisMap, ...map };
  }
}