import Sidebar from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { auth } from "@/auth";
import { query } from "@/lib/db";

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();
    const user = session?.user;

    let orgName = "HubSpot";

    if ((user as any)?.organization_id) {
        const res = await query(
            "SELECT name FROM organizations WHERE id = $1",
            [(user as any).organization_id]
        );
        if (res.rows.length > 0) {
            orgName = res.rows[0].name;
        }
    }

    return (
        <div className="flex h-screen overflow-hidden bg-background">
            <Sidebar user={user} orgName={orgName} />

            <div className="flex flex-1 flex-col overflow-hidden">
                <Header />
                <main className="flex-1 overflow-y-auto p-6">
                    {children}
                </main>
            </div>
        </div>
    );
}