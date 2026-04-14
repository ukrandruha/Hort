import LeafletMap from "./LeafletMap";


export default function DroneMap({
  robot,
  fullscreen = false,
  gpsTarget = null,
  heading = null,
  homeTarget = null,
}: {
  robot: any;
  fullscreen?: boolean;
  gpsTarget?: [number, number] | null;
  heading?: number | null;
  homeTarget?: [number, number] | null;
}) {
  return (
    <LeafletMap
      fullscreen={fullscreen}
      robotId={robot.robotId}
      gpsTarget={gpsTarget}
      heading={heading}
      homeTarget={homeTarget}
    />
  );
}
