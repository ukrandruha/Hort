import LeafletMap from "./LeafletMap";


export default function DroneMap({
  robot,
  fullscreen = false,
  homeTarget = null,
  showRthPath = false,
}: {
  robot: any;
  fullscreen?: boolean;
  homeTarget?: [number, number] | null;
  showRthPath?: boolean;
}) {
  return (
    <LeafletMap
      fullscreen={fullscreen}
      robotId={robot.robotId}
      homeTarget={homeTarget}
      showRthPath={showRthPath}
    />
  );
}
