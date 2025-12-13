
  export interface RobotUpdateData {
  robotId: string;
  name?: string;
  status?: string;
  battery?: number;
  cpu?: number;
  memory?: number;
  temperature?: number;
  position?: {
    lat: number;
    lng: number;
  };
}


