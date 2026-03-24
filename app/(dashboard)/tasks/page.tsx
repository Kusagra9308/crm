import { getTasks, getContacts, getCompanies, getDeals } from '@/app/actions';
import TasksClient from './client';

export default async function TasksPage() {
    const tasks = await getTasks();
    const contacts = await getContacts();
    const companies = await getCompanies();
    const deals = await getDeals();
    return <TasksClient initialTasks={tasks} contacts={contacts} companies={companies} deals={deals} />;
}
