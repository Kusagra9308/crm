// import Link from "next/link";
// import { LayoutDashboard, Users, Building2, BarChart3, Ticket, Settings, LogOut, Github } from "lucide-react";
// import { cn } from "@/lib/utils";
// import { auth } from "@/auth";
// import { logout } from "@/app/actions";
// import { query } from "@/lib/db";
// import { Button } from "@/components/ui/button";

// const navigation = [
//     { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
//     { name: "Contacts", href: "/contacts", icon: Users },
//     { name: "Companies", href: "/companies", icon: Building2 },
//     { name: "Deals", href: "/deals", icon: BarChart3 },
//     { name: "Tasks", href: "/tasks", icon: Ticket },
//     { name: "Team", href: "/settings/team", icon: Users },
//     { name: "Settings", href: "/settings", icon: Settings },
// ];

// export async function Sidebar() {
//     const session = await auth();
//     const user = session?.user;

//     // Fetch Org Name
//     let orgName = 'HubSpot';
//     if ((user as any)?.organization_id) {
//         const res = await query('SELECT name FROM organizations WHERE id = $1', [(user as any).organization_id]);
//         if (res.rows.length > 0) {
//             orgName = res.rows[0].name;
//         }
//     }

//     return (
//         <div className="flex h-screen w-64 flex-col border-r border-border bg-surface/50 backdrop-blur-xl">
//             <div className="flex h-16 items-center px-6 border-b border-border/50">
//                 <div className="flex items-center gap-2 font-bold text-xl text-primary">
//                     <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-orange-600 flex items-center justify-center text-white">
//                         {orgName[0]}
//                     </div>
//                     <span className="truncate">{orgName}</span>
//                 </div>
//             </div>
//             <div className="flex-1 overflow-y-auto py-4">
//                 <nav className="space-y-1 px-3">
//                     {navigation.map((item) => (
//                         <Link
//                             key={item.name}
//                             href={item.href}
//                             className={cn(
//                                 "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
//                                 "text-muted-foreground hover:bg-primary/10 hover:text-primary"
//                             )}
//                         >
//                             <item.icon className="h-5 w-5 transition-colors group-hover:text-primary" />
//                             {item.name}
//                         </Link>
//                     ))}
//                 </nav>
//             </div>
//             <div className="p-4 border-t border-border/50">
//                 <div className="mt-4 flex items-center gap-3 px-2">
//                     <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
//                         {user?.name?.[0] || 'U'}
//                     </div>
//                     <div className="flex-1 overflow-hidden">
//                         <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
//                         <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
//                     </div>
//                     <form action={logout}>
//                         <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
//                             <LogOut className="h-4 w-4" />
//                         </Button>
//                     </form>
//                 </div>
//             </div>
//         </div>
//     );
// }
'use client';

import { usePathname } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Users, Building2, BarChart3, Ticket, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Contacts", href: "/contacts", icon: Users },
    { name: "Companies", href: "/companies", icon: Building2 },
    { name: "Deals", href: "/deals", icon: BarChart3 },
    { name: "Tasks", href: "/tasks", icon: Ticket },
    { name: "Team", href: "/settings/team", icon: Users },
    { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar({ user, orgName }) {
    const pathname = usePathname();

    return (
        <div className="flex h-screen w-64 flex-col border-r border-border/50 bg-background/60 backdrop-blur-xl">

            {/* HEADER */}
            <div className="flex h-16 items-center px-6 border-b border-border/50">
                <div className="flex items-center gap-3 font-semibold text-lg">
                    <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center text-white shadow-sm">
                        {orgName[0]}
                    </div>
                    <span className="truncate">{orgName}</span>
                </div>
            </div>

            {/* NAV */}
            <div className="flex-1 overflow-y-auto py-4">
                <nav className="space-y-1 px-3">
                    {navigation.map((item) => {
                        const isActive = pathname.startsWith(item.href);

                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={cn(
                                    "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                                    isActive
                                        ? "bg-primary/15 text-primary shadow-sm"
                                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                                )}
                            >
                                <item.icon className="h-5 w-5" />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            {/* USER */}
            <div className="p-4 border-t border-border/50">
                <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted/50 transition">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                        {user?.name?.[0] || "U"}
                    </div>

                    <div className="flex-1 overflow-hidden">
                        <p className="text-sm font-medium truncate">{user?.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                    </div>

                    <form action="/api/logout" method="post">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <LogOut className="h-4 w-4" />
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    );
}