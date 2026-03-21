import { getDashboardStats } from '@/app/actions';
import DashboardClient from './dashboard-client';

export default async function Home() {
  const stats = await getDashboardStats();
  return <DashboardClient stats={stats} />;
}
