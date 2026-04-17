type RobotSnapshot = {
  robotId: string;
  [key: string]: any;
};

type RobotListener = (robot: RobotSnapshot) => void;

class RobotStore {
  private robots = new Map<string, RobotSnapshot>();
  private listeners = new Map<string, Set<RobotListener>>();

  setMany(robots: RobotSnapshot[]) {
    for (const robot of robots) {
      this.upsert(robot);
    }
  }

  upsert(robot: RobotSnapshot) {
    if (!robot?.robotId) return;
    const previous = this.robots.get(robot.robotId) ?? { robotId: robot.robotId };
    const next = { ...previous, ...robot };
    this.robots.set(robot.robotId, next);
    this.emit(robot.robotId, next);
  }

  get(robotId: string) {
    return this.robots.get(robotId) ?? null;
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

  private emit(robotId: string, robot: RobotSnapshot) {
    const listenersForRobot = this.listeners.get(robotId);
    if (!listenersForRobot) return;
    listenersForRobot.forEach((listener) => listener(robot));
  }
}

export const robotStore = new RobotStore();
