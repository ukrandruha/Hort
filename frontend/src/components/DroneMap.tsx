import LeafletMap from "./LeafletMap";


export default function DroneMap({
  robot,
  fullscreen = false,
  homeTarget = null,
  showRthPath = false,
  historicalRoute = [],
  historicalRouteFocusKey = 0,
}: {
  robot: any;
  fullscreen?: boolean;
  homeTarget?: [number, number] | null;
  showRthPath?: boolean;
  historicalRoute?: [number, number][];
  historicalRouteFocusKey?: number;
}) {
  return (
    <LeafletMap
      fullscreen={fullscreen}
      robotId={robot.robotId}
      homeTarget={homeTarget}
      showRthPath={showRthPath}
      historicalRoute={historicalRoute}
      historicalRouteFocusKey={historicalRouteFocusKey}
    />
  );
}
