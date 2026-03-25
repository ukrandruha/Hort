import LeafletMap from "./LeafletMap";


export default function DroneMap({
  robot,
  fullscreen = false,
  gpsTarget = null,
}: {
  robot: any;
  fullscreen?: boolean;
  gpsTarget?: [number, number] | null;
}) {
  return (
    <LeafletMap
      robot={robot}
      fullscreen={fullscreen}
      robotId={robot.robotId}
      gpsTarget={gpsTarget}
    />
  );
}
