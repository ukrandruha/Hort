import LeafletMap from "./LeafletMap";


export default function DroneMap({ robot, fullscreen}) {
  return <LeafletMap robot={robot} fullscreen={fullscreen} robotId={robot.robotId} />;
}