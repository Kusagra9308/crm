import { getDeals, getCompanies, getContacts } from '@/app/actions';
import DealsClient from './client';

export const dynamic = "force-dynamic";

export default async function DealsPage() {
    const deals = await getDeals();
    const companies = await getCompanies();
    const contacts = await getContacts();
    return <DealsClient initialDeals={deals} companies={companies} contacts={contacts} />;
}
