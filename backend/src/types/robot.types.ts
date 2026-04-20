
  export interface RobotUpdateData {
  robotId: string;
  name?: string;
  version?: string;
  status?: string;
  battery?: number;
  cpu?: number;
  memory?: number;
  disk?: number;
  temperature?: number;
  webrtclient?: number;
  position?: {
    lat: number;
    lng: number;
  };
}

export interface RobotPositionUpdateData {
  robotId: string;
  position: {
    lat: number;
    lng: number;
  };
}

export interface TcPositionCreateData {
  robotId: string;
  devicetime: string | Date;
  latitude: number;
  longitude: number;
  altitude?: number;
  speed?: number;
  accuracy?: number;
}


