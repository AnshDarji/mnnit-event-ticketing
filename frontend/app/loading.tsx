import { LoadingIndicator } from "@/components/loading-indicator";

export default function Loading() {
  return <main className="route-loading"><LoadingIndicator label="Opening CampusPass" /><span>Opening your workspace</span><small>CAMPUSPASS / MNNIT</small></main>;
}
