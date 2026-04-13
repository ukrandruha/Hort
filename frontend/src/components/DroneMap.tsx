import LeafletMap from "./LeafletMap";


export default function DroneMap({
  robot,
  fullscreen = false,
  gpsTarget = null,
  heading = null,
}: {
  robot: any;
  fullscreen?: boolean;
  gpsTarget?: [number, number] | null;
  heading?: number | null;
}) {
  return (
    <LeafletMap
      fullscreen={fullscreen}
      robotId={robot.robotId}
      gpsTarget={gpsTarget}
      heading={heading}
    />
  );
}
