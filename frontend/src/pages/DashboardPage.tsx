import TopBar from "../components/TopBar";
import RobotTable from "../components/RobotTable";

export default function DashboardPage() {
  return (
    <div className="h-screen flex flex-col bg-gray-900 text-white">
      <TopBar />
      <RobotTable />
    </div>
  );
}
