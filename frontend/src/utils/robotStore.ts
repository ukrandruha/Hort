type RobotSnapshot = {
  robotId: string;
  [key: string]: any;
};

type RobotTelemetry = {
  [key: string]: any;
};

type RobotListener = (robot: RobotSnapshot) => void;
type TelemetryListener = (telemetry: RobotTelemetry | null) => void;
type OfflineTransitionListener = (robotId: string) => void;

class RobotStore {
  private robots = new Map<string, RobotSnapshot>();
  private listeners = new Map<string, Set<RobotListener>>();
  private telemetry = new Map<string, RobotTelemetry>();
  private telemetryListeners = new Map<string, Set<TelemetryListener>>();
  private offlineStates = new Map<string, boolean>(); // Track previous offline state
  private offlineTransitionListeners = new Map<string, Set<OfflineTransitionListener>>();

  setMany(robots: RobotSnapshot[]) {
    for (const robot of robots) {
      this.upsert(robot);
    }
  }

  upsert(robot: RobotSnapshot) {
    if (!robot?.robotId) return;
    const previous = this.robots.get(robot.robotId) ?? { robotId: robot.robotId };
    const next = { ...previous, ...robot };
    
    // Check for offline → online transition
    const wasOffline = this.isRobotOffline(previous);
    const isNowOffline = this.isRobotOffline(next);
    
    this.robots.set(robot.robotId, next);
    
    // Emit offline transition if robot came back online
    if (wasOffline && !isNowOffline) {
      this.emitOfflineTransition(robot.robotId);
    }
    
    this.emit(robot.robotId, next);
  }

  private isRobotOffline(robot: RobotSnapshot): boolean {
    const lastSeenAt = robot?.updatedAt ? new Date(robot.updatedAt).getTime() : 0;
    return !lastSeenAt || Date.now() - lastSeenAt > 10000;
  }

  get(robotId: string) {
    return this.robots.get(robotId) ?? null;
  }

  setTelemetry(robotId: string, telemetry: RobotTelemetry | null) {
    if (!robotId) return;

    if (telemetry === null) {
      this.telemetry.delete(robotId);
      this.emitTelemetry(robotId, null);
      return;
    }

    this.telemetry.set(robotId, telemetry);
    this.emitTelemetry(robotId, telemetry);
  }

  getTelemetry(robotId: string) {
    return this.telemetry.get(robotId) ?? null;
  }

  subscribe(robotId: string, listener: RobotListener) {
    if (!this.listeners.has(robotId)) {
      this.listeners.set(robotId, new Set());
    }

    const set = this.listeners.get(robotId)!;
    set.add(listener);

    const current = this.get(robotId);
    if (current) {
      listener(current);
    }

    return () => {
      const listenersForRobot = this.listeners.get(robotId);
      if (!listenersForRobot) return;
      listenersForRobot.delete(listener);
      if (listenersForRobot.size === 0) {
        this.listeners.delete(robotId);
      }
    };
  }

  subscribeTelemetry(robotId: string, listener: TelemetryListener) {
    if (!this.telemetryListeners.has(robotId)) {
      this.telemetryListeners.set(robotId, new Set());
    }

    const set = this.telemetryListeners.get(robotId)!;
    set.add(listener);

    listener(this.getTelemetry(robotId));

    return () => {
      const listenersForRobot = this.telemetryListeners.get(robotId);
      if (!listenersForRobot) return;
      listenersForRobot.delete(listener);
      if (listenersForRobot.size === 0) {
        this.telemetryListeners.delete(robotId);
      }
    };
  }

  subscribeToOfflineTransition(robotId: string, listener: OfflineTransitionListener) {
    if (!this.offlineTransitionListeners.has(robotId)) {
      this.offlineTransitionListeners.set(robotId, new Set());
    }

    const set = this.offlineTransitionListeners.get(robotId)!;
    set.add(listener);

    return () => {
      const listenersForRobot = this.offlineTransitionListeners.get(robotId);
      if (!listenersForRobot) return;
      listenersForRobot.delete(listener);
      if (listenersForRobot.size === 0) {
        this.offlineTransitionListeners.delete(robotId);
      }
    };
  }

  private emit(robotId: string, robot: RobotSnapshot) {
    const listenersForRobot = this.listeners.get(robotId);
    if (!listenersForRobot) return;
    listenersForRobot.forEach((listener) => listener(robot));
  }

  private emitTelemetry(robotId: string, telemetry: RobotTelemetry | null) {
    const listenersForRobot = this.telemetryListeners.get(robotId);
    if (!listenersForRobot) return;
    listenersForRobot.forEach((listener) => listener(telemetry));
  }

  private emitOfflineTransition(robotId: string) {
    const listenersForRobot = this.offlineTransitionListeners.get(robotId);
    if (!listenersForRobot) return;
    listenersForRobot.forEach((listener) => listener(robotId));
  }
}

export const robotStore = new RobotStore();
